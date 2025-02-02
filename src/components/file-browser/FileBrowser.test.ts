import '@testing-library/jest-dom';

import { render } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { useFilesInDirectory } from 'src/components/file-browser/file-browser-hooks';
import FileBrowser from 'src/components/file-browser/FileBrowser';
import FilesTable from 'src/components/file-browser/FilesTable';
import RequesterPaysModal from 'src/components/RequesterPaysModal';
import FileBrowserProvider, { FileBrowserFile } from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import { asMockedFn } from 'src/testing/test-utils';

jest.mock('src/components/file-browser/file-browser-hooks', () => ({
  ...jest.requireActual('src/components/file-browser/file-browser-hooks'),
  useFilesInDirectory: jest.fn(),
}));

jest.mock('src/components/file-browser/FilesTable', () => {
  const { div } = jest.requireActual('react-hyperscript-helpers');
  return {
    ...jest.requireActual('src/components/file-browser/FilesTable'),
    __esModule: true,
    default: jest.fn().mockReturnValue(div()),
  };
});

jest.mock('src/components/RequesterPaysModal', () => {
  const { div } = jest.requireActual('react-hyperscript-helpers');
  return {
    ...jest.requireActual('src/components/RequesterPaysModal'),
    __esModule: true,
    default: jest.fn().mockReturnValue(div()),
  };
});

type UseFilesInDirectoryResult = ReturnType<typeof useFilesInDirectory>;

describe('FileBrowser', () => {
  const mockFileBrowserProvider: FileBrowserProvider = {} as FileBrowserProvider;

  it('renders files', () => {
    // Arrange
    const files: FileBrowserFile[] = [
      {
        path: 'file.txt',
        url: 'gs://test-bucket/file.txt',
        size: 1024,
        createdAt: 1667408400000,
        updatedAt: 1667408400000,
      },
    ];

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files, status: 'Ready' },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    // Act
    render(
      h(FileBrowser, {
        provider: mockFileBrowserProvider,
        rootLabel: 'Test bucket',
        title: 'Files',
        workspace: {
          accessLevel: 'WRITER',
          workspace: { isLocked: false },
        },
      })
    );

    // Assert
    expect(FilesTable).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [
          {
            path: 'file.txt',
            url: 'gs://test-bucket/file.txt',
            size: 1024,
            createdAt: 1667408400000,
            updatedAt: 1667408400000,
          },
        ],
      }),
      expect.anything()
    );
  });

  it('prompts to select workspace on requester pays errors', () => {
    // Arrange
    const requesterPaysError = new Error('Requester pays bucket');
    (requesterPaysError as any).requesterPaysError = true;

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files: [], status: 'Error', error: requesterPaysError },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    // Act
    render(
      h(FileBrowser, {
        provider: mockFileBrowserProvider,
        rootLabel: 'Test bucket',
        title: 'Files',
        workspace: {
          accessLevel: 'WRITER',
          workspace: { isLocked: false },
        },
      })
    );

    // Assert
    expect(RequesterPaysModal).toHaveBeenCalled();
  });
});
