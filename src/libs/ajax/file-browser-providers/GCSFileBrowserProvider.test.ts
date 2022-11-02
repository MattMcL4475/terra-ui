import { Ajax } from 'src/libs/ajax'
import { FileBrowserDirectory, FileBrowserFile } from 'src/libs/ajax/file-browser-providers/FileBrowserProvider'
import GCSFileBrowserProvider from 'src/libs/ajax/file-browser-providers/GCSFileBrowserProvider'
import { GCSItem, GCSListObjectsResponse } from 'src/libs/ajax/GoogleStorage'
import * as Utils from 'src/libs/utils'
import { asMockedFn } from 'src/test-utils'


jest.mock('src/libs/ajax')

const gcsObject = (name: string): GCSItem => ({
  bucket: 'test-bucket',
  crc32c: 'crc32c',
  etag: 'etag',
  generation: '1666792590000000',
  id: `test-bucket}/${name}/1666792590000000`,
  kind: 'storage#object',
  md5Hash: 'abcdef',
  mediaLink: `https://storage.googleapis.com/download/storage/v1/b/test-bucket/o/${name}?generation=1666792590000000&alt=media`,
  metageneration: '1',
  name,
  selfLink: `https://www.googleapis.com/storage/v1/b/test-bucket/o/${name}`,
  size: '1',
  storageClass: 'STANDARD',
  timeCreated: '2022-10-26T13:56:30.000Z',
  timeStorageClassUpdated: '2022-10-26T13:56:30.000Z',
  updated: '2022-10-26T13:56:30.000Z'
})

const expectedFile = (path: string): FileBrowserFile => ({
  path,
  url: `gs://test-bucket/${path}`,
  size: 1,
  createdAt: 1666792590000,
  updatedAt: 1666792590000
})

describe('GCSFileBrowserProvider', () => {
  let list

  beforeEach(() => {
    list = jest.fn().mockImplementation((_googleProject, _bucket, _prefix, options = {}) => {
      const { pageToken } = options

      const response: GCSListObjectsResponse = Utils.switchCase(pageToken,
        [undefined, () => ({
          items: [
            gcsObject('a-file.txt'),
            gcsObject('b-file.txt')
          ],
          prefixes: [
            'a-prefix/'
          ],
          nextPageToken: '2'
        })],
        ['2', () => ({
          items: [
            gcsObject('c-file.txt'),
            gcsObject('d-file.txt')
          ],
          prefixes: [
            'b-prefix/'
          ],
          nextPageToken: '3'
        })],
        ['3', () => ({
          prefixes: [
            'c-prefix/',
            'd-prefix/'
          ]
        })],
        [Utils.DEFAULT, () => {
          throw new Error('Unrecognized page token')
        }]
      )

      return Promise.resolve(response)
    })

    asMockedFn(Ajax).mockImplementation(() => ({ Buckets: { list } } as ReturnType<typeof Ajax>))
  })

  it('pages through files (objects)', async () => {
    // Arrange
    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project', pageSize: 3 })

    // Act
    const firstResponse = await provider.getFilesInDirectory('')
    const numGCSRequestsAfterFirstResponse = list.mock.calls.length
    const secondResponse = await firstResponse.getNextPage()
    const numGCSRequestsAfterSecondResponse = list.mock.calls.length

    // Assert
    const expectedFirstPageFiles: FileBrowserFile[] = [
      expectedFile('a-file.txt'),
      expectedFile('b-file.txt'),
      expectedFile('c-file.txt')
    ]
    expect(firstResponse.items).toEqual(expectedFirstPageFiles)
    expect(firstResponse.hasNextPage).toBe(true)
    expect(numGCSRequestsAfterFirstResponse).toBe(2)

    const expectedSecondPageFiles: FileBrowserFile[] = [
      expectedFile('a-file.txt'),
      expectedFile('b-file.txt'),
      expectedFile('c-file.txt'),
      expectedFile('d-file.txt')
    ]
    expect(secondResponse.items).toEqual(expectedSecondPageFiles)
    expect(secondResponse.hasNextPage).toBe(false)
    expect(numGCSRequestsAfterSecondResponse).toBe(3)
  })

  it('pages through directories (prefixes)', async () => {
    // Arrange
    const provider = GCSFileBrowserProvider({ bucket: 'test-bucket', project: 'test-project', pageSize: 3 })

    // Act
    const firstResponse = await provider.getDirectoriesInDirectory('')
    const numGCSRequestsAfterFirstResponse = list.mock.calls.length
    const secondResponse = await firstResponse.getNextPage()
    const numGCSRequestsAfterSecondResponse = list.mock.calls.length

    // Assert
    const expectedFirstPageDirectories: FileBrowserDirectory[] = [
      { path: 'a-prefix/' },
      { path: 'b-prefix/' },
      { path: 'c-prefix/' }
    ]
    expect(firstResponse.items).toEqual(expectedFirstPageDirectories)
    expect(firstResponse.hasNextPage).toBe(true)
    expect(numGCSRequestsAfterFirstResponse).toBe(3)

    const expectedSecondPageDirectories: FileBrowserDirectory[] = [
      { path: 'a-prefix/' },
      { path: 'b-prefix/' },
      { path: 'c-prefix/' },
      { path: 'd-prefix/' }
    ]
    expect(secondResponse.items).toEqual(expectedSecondPageDirectories)
    expect(secondResponse.hasNextPage).toBe(false)
    expect(numGCSRequestsAfterSecondResponse).toBe(3)
  })
})