import '@testing-library/jest-dom';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { div, h } from 'react-hyperscript-helpers';
import { useFilesInDirectory } from 'src/components/file-browser/file-browser-hooks';
import FilesInDirectory from 'src/components/file-browser/FilesInDirectory';
import FilesTable from 'src/components/file-browser/FilesTable';
import FileBrowserProvider, { FileBrowserFile } from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import { asMockedFn } from 'src/testing/test-utils';

jest.mock('src/components/file-browser/file-browser-hooks', () => ({
  ...jest.requireActual('src/components/file-browser/file-browser-hooks'),
  useFilesInDirectory: jest.fn(),
}));

jest.mock('src/components/file-browser/FilesTable', () => ({
  ...jest.requireActual('src/components/file-browser/FilesTable'),
  __esModule: true,
  default: jest.fn(),
}));

beforeEach(() => {
  asMockedFn(FilesTable).mockReturnValue(div());
});

type UseFilesInDirectoryResult = ReturnType<typeof useFilesInDirectory>;

// modals, popups, tooltips, etc. render into this element.
beforeAll(() => {
  const modalRoot = document.createElement('div');
  modalRoot.id = 'modal-root';
  document.body.append(modalRoot);
});

afterAll(() => {
  document.getElementById('modal-root')!.remove();
});

describe('FilesInDirectory', () => {
  const mockFileBrowserProvider: FileBrowserProvider = {} as FileBrowserProvider;

  it('loads files in the given path', () => {
    // Arrange
    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files: [], status: 'Loading' },
      hasNextPage: undefined,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    // Act
    render(
      h(FilesInDirectory, {
        provider: mockFileBrowserProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError: () => {},
      })
    );

    // Assert
    expect(asMockedFn(useFilesInDirectory)).toHaveBeenCalledWith(mockFileBrowserProvider, 'path/to/directory/');
  });

  it('renders FilesTable with loaded files', () => {
    // Arrange
    const files: FileBrowserFile[] = [
      {
        path: 'path/to/file.txt',
        url: 'gs://test-bucket/path/to/file.txt',
        size: 1024,
        createdAt: 1667408400000,
        updatedAt: 1667408400000,
      },
    ];

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files, status: 'Ready' },
      hasNextPage: undefined,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    // Act
    render(
      h(FilesInDirectory, {
        provider: mockFileBrowserProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError: () => {},
      })
    );

    // Assert
    expect(FilesTable).toHaveBeenCalledWith(expect.objectContaining({ files }), expect.anything());
  });

  it.each([
    { state: { status: 'Loading', files: [] }, expectedMessage: 'Loading files...' },
    { state: { status: 'Ready', files: [] }, expectedMessage: 'No files have been uploaded yet' },
    {
      state: { status: 'Error', error: new Error('Something went wrong'), files: [] },
      expectedMessage: 'Unable to load files',
    },
  ] as { state: UseFilesInDirectoryResult['state']; expectedMessage: string }[])(
    'renders a message based on loading state ($state.status) when no files are present',
    ({ state, expectedMessage }) => {
      // Arrange
      const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
        state,
        hasNextPage: false,
        loadNextPage: () => Promise.resolve(),
        loadAllRemainingItems: () => Promise.resolve(),
        reload: () => Promise.resolve(),
      };

      asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

      // Act
      render(
        h(FilesInDirectory, {
          provider: mockFileBrowserProvider,
          path: 'path/to/directory/',
          selectedFiles: {},
          setSelectedFiles: () => {},
          onClickFile: jest.fn(),
          onCreateDirectory: () => {},
          onDeleteDirectory: () => {},
          onError: () => {},
        })
      );

      // Assert
      screen.getByText(expectedMessage);
    }
  );

  it('calls onError callback on errors loading files', () => {
    // Arrange
    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { status: 'Error', error: new Error('Something went wrong'), files: [] },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    const onError = jest.fn();

    // Act
    render(
      h(FilesInDirectory, {
        provider: mockFileBrowserProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError,
      })
    );

    // Assert
    expect(onError).toHaveBeenCalledWith(new Error('Something went wrong'));
  });

  describe('when next page is available', () => {
    // Arrange
    const loadNextPage = jest.fn();
    const loadAllRemainingItems = jest.fn();

    const files: FileBrowserFile[] = [
      {
        path: 'path/to/file.txt',
        url: 'gs://test-bucket/path/to/file.txt',
        size: 1024,
        createdAt: 1667408400000,
        updatedAt: 1667408400000,
      },
    ];

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files, status: 'Ready' },
      hasNextPage: true,
      loadNextPage,
      loadAllRemainingItems,
      reload: () => Promise.resolve(),
    };

    beforeEach(() => {
      asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);
    });

    it('renders a button to load next page', async () => {
      // Arrange
      const user = userEvent.setup();

      // Act
      render(
        h(FilesInDirectory, {
          provider: mockFileBrowserProvider,
          path: 'path/to/directory/',
          selectedFiles: {},
          setSelectedFiles: () => {},
          onClickFile: jest.fn(),
          onCreateDirectory: () => {},
          onDeleteDirectory: () => {},
          onError: () => {},
        })
      );

      // Assert
      const loadNextPageButton = screen.getByText('Load next page');
      await user.click(loadNextPageButton);
      expect(loadNextPage).toHaveBeenCalled();
    });

    it('renders a button to load all remaining pages', async () => {
      // Arrange
      const user = userEvent.setup();

      // Act
      render(
        h(FilesInDirectory, {
          provider: mockFileBrowserProvider,
          path: 'path/to/directory/',
          selectedFiles: {},
          setSelectedFiles: () => {},
          onClickFile: jest.fn(),
          onCreateDirectory: () => {},
          onDeleteDirectory: () => {},
          onError: () => {},
        })
      );

      // Assert
      const loadAllPagesButton = screen.getByText('Load all');
      await user.click(loadAllPagesButton);
      expect(loadAllRemainingItems).toHaveBeenCalled();
    });
  });

  it('uploads files', async () => {
    // Arrange
    const user = userEvent.setup();

    const uploadFileToDirectory = jest.fn(() => Promise.resolve());
    const mockProvider = { uploadFileToDirectory } as Partial<FileBrowserProvider> as FileBrowserProvider;

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { status: 'Ready', files: [] },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    render(
      h(FilesInDirectory, {
        provider: mockProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError: () => {},
      })
    );

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;

    const file = new File(['somecontent'], 'example.txt');

    // Act
    await act(() => user.upload(fileInput, [file]));

    // Assert
    expect(uploadFileToDirectory).toHaveBeenCalledWith('path/to/directory/', file);
  });

  it('allows deleting empty folders', async () => {
    // Arrange
    const user = userEvent.setup();

    const deleteEmptyDirectory = jest.fn(() => Promise.resolve());
    const mockProvider = {
      supportsEmptyDirectories: true,
      deleteEmptyDirectory,
    } as Partial<FileBrowserProvider> as FileBrowserProvider;

    const onDeleteDirectory = jest.fn();

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { status: 'Ready', files: [] },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    render(
      h(FilesInDirectory, {
        provider: mockProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory,
        onError: () => {},
      })
    );

    // Act
    const deleteButton = screen.getByText('Delete this folder');
    await act(() => user.click(deleteButton));

    // Assert
    expect(deleteEmptyDirectory).toHaveBeenCalledWith('path/to/directory/');
    expect(onDeleteDirectory).toHaveBeenCalled();
  });
});
