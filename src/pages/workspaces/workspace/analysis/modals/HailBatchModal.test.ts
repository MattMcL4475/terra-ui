import '@testing-library/jest-dom';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import {
  defaultAzureWorkspace,
  generateTestAppWithAzureWorkspace,
} from 'src/pages/workspaces/workspace/analysis/_testData/testData';
import { asMockedFn } from 'src/testing/test-utils';

import { appToolLabels } from '../utils/tool-utils';
import { HailBatchModal, HailBatchModalProps } from './HailBatchModal';

const onSuccess = jest.fn();

const defaultHailBatchProps: HailBatchModalProps = {
  onDismiss: () => {},
  onError: () => {},
  onSuccess,
  apps: [],
  workspace: defaultAzureWorkspace,
};

const defaultAjaxImpl = {
  list: jest.fn(),
  listWithoutProject: jest.fn(),
  app: jest.fn(),
  listAppsV2: jest.fn(),
  createAppV2: jest.fn(),
  deleteAppV2: jest.fn(),
  deleteAllAppsV2: jest.fn(),
};

jest.mock('src/libs/ajax');
jest.mock('src/libs/ajax/leonardo/Apps');

describe('HailBatchModal', () => {
  it('Renders correctly by default', () => {
    // Act
    render(h(HailBatchModal, defaultHailBatchProps));
    // Assert
    screen.getByText('Hail Batch Cloud Environment');
    screen.getByText('Application configuration');
    screen.getByText('Create');
  });

  it('Calls createAppV2 API when create button is clicked', async () => {
    // Arrange
    const createFunc = jest.fn();
    asMockedFn(Apps).mockImplementation(() => {
      return {
        ...defaultAjaxImpl,
        createAppV2: createFunc,
      };
    });

    // Act
    await act(async () => {
      await render(h(HailBatchModal, defaultHailBatchProps));
      const createButton = screen.getByText('Create');
      await userEvent.click(createButton);
    });

    expect(createFunc).toHaveBeenCalledWith(
      expect.anything(),
      defaultAzureWorkspace.workspace.workspaceId,
      appToolLabels.HAIL_BATCH
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows deleteWarn message after initial delete click', async () => {
    // Arrange
    const deleteFunc = jest.fn();
    asMockedFn(Apps).mockImplementation(() => {
      return {
        ...defaultAjaxImpl,
        deleteAppV2: deleteFunc,
      };
    });
    const app = generateTestAppWithAzureWorkspace({ appType: appToolLabels.HAIL_BATCH });
    const props: HailBatchModalProps = {
      ...defaultHailBatchProps,
      apps: [app],
    };

    // Act
    await act(async () => {
      await render(h(HailBatchModal, props));
      const deleteButton = screen.getByText('Delete Environment');
      await userEvent.click(deleteButton);
    });

    // Assert
    screen.getByText('Delete environment');
    screen.getByText(
      'If you want to save some files permanently, such as input data, analysis outputs, or installed packages,'
    );
    screen.getByText('move them to the workspace bucket.');
    expect(deleteFunc).toHaveBeenCalledTimes(0);
  });

  it('Calls deleteAppV2 API when delete button is clicked', async () => {
    // Arrange
    const deleteFunc = jest.fn();
    asMockedFn(Apps).mockImplementation(() => {
      return {
        ...defaultAjaxImpl,
        deleteAppV2: deleteFunc,
      };
    });
    const app = generateTestAppWithAzureWorkspace({ appType: appToolLabels.HAIL_BATCH });
    const props: HailBatchModalProps = {
      ...defaultHailBatchProps,
      apps: [app],
    };

    // Act
    await act(async () => {
      await render(h(HailBatchModal, props));
      const deleteButton = screen.getByText('Delete Environment');
      await userEvent.click(deleteButton);
      const deleteButtonAgain = screen.getByText('Delete');
      await userEvent.click(deleteButtonAgain);
    });

    // Assert
    expect(deleteFunc).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });
});
