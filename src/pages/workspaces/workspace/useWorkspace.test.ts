import { renderHook } from '@testing-library/react-hooks'
import _ from 'lodash/fp'
import { locationTypes } from 'src/components/region-common'
import * as WorkspaceUtils from 'src/components/workspace-utils'
import { Ajax } from 'src/libs/ajax'
import { AzureStorage, AzureStorageContract } from 'src/libs/ajax/AzureStorage'
import * as GoogleStorage from 'src/libs/ajax/GoogleStorage'
import { getConfig } from 'src/libs/config'
import * as Notifications from 'src/libs/notifications'
import { getUser, workspaceStore } from 'src/libs/state'
import { DeepPartial } from 'src/libs/type-utils/deep-partial'
import { defaultLocation } from 'src/pages/workspaces/workspace/analysis/runtime-utils'
import {
  azureBucketRecheckRate, googlePermissionsRecheckRate, useWorkspace
} from 'src/pages/workspaces/workspace/useWorkspace'
import { asMockedFn } from 'src/testing/test-utils'


jest.mock('src/libs/ajax/AzureStorage')

type AjaxExports = typeof import('src/libs/ajax')
jest.mock('src/libs/ajax')
type AjaxContract = ReturnType<AjaxExports['Ajax']>

jest.mock('src/libs/notifications')

jest.mock('src/libs/state', () => ({
  ...jest.requireActual('src/libs/state'),
  getUser: jest.fn()
}))

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({})
}))

describe('useActiveWorkspace', () => {
  const initializedGoogleWorkspace = {
    accessLevel: 'PROJECT_OWNER',
    owners: [
      'christina@foo.com'
    ],
    workspace: {
      attributes: {
        description: ''
      },
      authorizationDomain: [],
      billingAccount: 'billingAccounts/google-billing-account',
      bucketName: 'bucket-name',
      cloudPlatform: 'Gcp',
      completedCloneWorkspaceFileTransfer: '2023-02-03T22:29:04.319Z',
      createdBy: 'christina@foo.com',
      createdDate: '2023-02-03T22:26:06.124Z',
      googleProject: 'google-project-id',
      isLocked: false,
      lastModified: '2023-02-03T22:26:06.202Z',
      name: 'testName',
      namespace: 'testNamespace',
      workspaceId: 'google-workspace-id',
      workspaceType: 'rawls',
      workspaceVersion: 'v2'
    },
    canShare: true,
    canCompute: true,
    workspaceInitialized: true
  }

  const initializedAzureWorkspace = {
    accessLevel: 'PROJECT_OWNER',
    owners: [
      'christina@foo.com'
    ],
    azureContext: {
      managedResourceGroupId: 'test-mrg',
      subscriptionId: 'test-sub-id',
      tenantId: 'test-tenant-id'
    },
    workspace: {
      attributes: {
        description: ''
      },
      authorizationDomain: [],
      bucketName: '',
      cloudPlatform: 'Azure',
      completedCloneWorkspaceFileTransfer: '2023-02-03T22:29:04.319Z',
      createdBy: 'christina@foo.com',
      createdDate: '2023-02-03T22:26:06.124Z',
      googleProject: '',
      isLocked: false,
      lastModified: '2023-02-03T22:26:06.202Z',
      name: 'testName',
      namespace: 'testNamespace',
      workspaceId: 'azure-workspace-id',
      workspaceType: 'rawls',
      workspaceVersion: 'v2'
    },
    canShare: true,
    canCompute: true,
    workspaceInitialized: true
  }

  const bucketLocationResponse = {
    location: 'bucket-location',
    locationType: 'location-type'
  }

  const defaultGoogleBucketOptions = {
    googleBucketLocation: defaultLocation,
    googleBucketType: locationTypes.default
  }

  const azureStorageDetails = {
    location: 'container-location',
    sas: { url: 'container-url?sas-token' }
  }

  const defaultAzureStorageOptions = {
    azureContainerRegion: undefined,
    azureContainerUrl: undefined,
    azureContainerSasUrl: undefined
  }

  beforeEach(() => {
    workspaceStore.reset()
    jest.useFakeTimers()

    // @ts-ignore
    getUser.mockReturnValue({
      email: 'christina@foo.com'
    })

    // @ts-ignore
    getConfig.mockReturnValue({ isProd: false })

    jest.spyOn(workspaceStore, 'set')
    jest.spyOn(WorkspaceUtils, 'updateRecentlyViewedWorkspaces')
    jest.spyOn(GoogleStorage, 'saToken')
    jest.spyOn(Notifications, 'notify')

    // Don't show expected error responses in logs
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  const assertResult = (result, expectedWorkspace, expectedStorageDetails, expectedAccessError) => {
    expect(result.workspace).toEqual(expectedWorkspace)
    expect(result.storageDetails).toEqual(expectedStorageDetails)
    expect(result.accessError).toBe(expectedAccessError)
    expect(result.refreshWorkspace).toBeTruthy()
    expect(result.loadingWorkspace).toBe(false)
  }

  it('can initialize from a Google workspace in workspaceStore', async () => {
    // Arrange
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse)
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract)

    workspaceStore.set(initializedGoogleWorkspace)
    const expectedStorageDetails = _.merge({
      googleBucketLocation: bucketLocationResponse.location,
      googleBucketType: bucketLocationResponse.locationType
    }, defaultAzureStorageOptions)

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useWorkspace('testNamespace', 'testName'))
    await waitForNextUpdate() // For the bucket location call

    // Assert
    assertResult(result.current, initializedGoogleWorkspace, expectedStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedGoogleWorkspace)
    expect(WorkspaceUtils.updateRecentlyViewedWorkspaces).not.toHaveBeenCalled()
    expect(GoogleStorage.saToken).not.toHaveBeenCalled()
  })

  it('can initialize from a requester pays Google workspace in workspaceStore', () => {
    // Arrange
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          checkBucketLocation: () => Promise.reject(new Response('Mock requester pays error', { status: 400 }))
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract)

    workspaceStore.set(initializedGoogleWorkspace)
    // Calling to get the bucket location fails, default options remain
    const expectedStorageDetails = _.merge(defaultGoogleBucketOptions, defaultAzureStorageOptions)

    // Act
    const { result } = renderHook(() => useWorkspace('testNamespace', 'testName'))

    // Assert
    assertResult(result.current, initializedGoogleWorkspace, expectedStorageDetails, false)
  })

  it('can initialize from an Azure workspace in workspaceStore', async () => {
    // Arrange
    const azureStorageMock: Partial<AzureStorageContract> = ({
      details: jest.fn().mockResolvedValue(azureStorageDetails)
    })
    asMockedFn(AzureStorage).mockImplementation(() => azureStorageMock as AzureStorageContract)

    workspaceStore.set(initializedAzureWorkspace)
    const expectedStorageDetails = _.merge({
      azureContainerRegion: azureStorageDetails.location,
      azureContainerUrl: 'container-url',
      azureContainerSasUrl: azureStorageDetails.sas.url
    }, defaultGoogleBucketOptions)

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useWorkspace('testNamespace', 'testName'))
    await waitForNextUpdate() // For the azure storage call

    // Assert
    assertResult(result.current, initializedAzureWorkspace, expectedStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedAzureWorkspace)
    expect(WorkspaceUtils.updateRecentlyViewedWorkspaces).not.toHaveBeenCalled()
    expect(GoogleStorage.saToken).not.toHaveBeenCalled()
  })

  it('can read workspace details from server, and poll Google until permissions are synced', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace

    // Throw error from checkBucketReadAccess
    const errorMockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
          checkBucketReadAccess: () => Promise.reject(new Response('Mock permissions error', { status: 500 }))
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => errorMockAjax as AjaxContract)

    // Expected response from useWorkspace should be false to reflect that permissions are not fully synced.
    const uninitializedGoogleWorkspace = _.clone(initializedGoogleWorkspace)
    uninitializedGoogleWorkspace.workspaceInitialized = false

    const expectedFirstStorageDetails = _.merge(defaultGoogleBucketOptions, defaultAzureStorageOptions)
    const expectedSecondStorageDetails = _.merge({
      googleBucketLocation: bucketLocationResponse.location,
      googleBucketType: bucketLocationResponse.locationType
    }, defaultAzureStorageOptions)

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useWorkspace('testNamespace', 'testName'))
    await waitForNextUpdate() // For the call to checkBucketReadAccess to execute

    // Assert
    assertResult(result.current, uninitializedGoogleWorkspace, expectedFirstStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(uninitializedGoogleWorkspace)
    expect(WorkspaceUtils.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(uninitializedGoogleWorkspace.workspace.workspaceId)
    expect(GoogleStorage.saToken).toHaveBeenCalled()

    // Arrange
    // Return success for the next call to checkBucketReadAccess
    const successMockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
          checkBucketReadAccess: jest.fn()
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => successMockAjax as AjaxContract)

    // Act
    // next call to checkBucketReadAccess is on a timer
    jest.advanceTimersByTime(googlePermissionsRecheckRate)
    await waitForNextUpdate()

    // Assert
    assertResult(result.current, initializedGoogleWorkspace, expectedSecondStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedGoogleWorkspace)
  })

  it('treats requesterPays errors as Google workspace being initialized', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace

    // Throw error from checkBucketReadAccess
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
          checkBucketReadAccess: () => Promise.reject(new Response('Mock requester pays error', { status: 500 }))
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract)

    // Will not attempt to retrieve storage details due to requester pays
    const expectedStorageDetails = _.merge(defaultGoogleBucketOptions, defaultAzureStorageOptions)

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useWorkspace('testNamespace', 'testName'))
    await waitForNextUpdate() // For the call to checkBucketReadAccess to execute

    // Assert
    assertResult(result.current, initializedGoogleWorkspace, expectedStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedGoogleWorkspace)
    expect(WorkspaceUtils.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(initializedGoogleWorkspace.workspace.workspaceId)
    expect(GoogleStorage.saToken).toHaveBeenCalled()
  })

  it('can read workspace details from server, and poll WSM until the container exists', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedAzureWorkspace

    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          details: jest.fn().mockResolvedValue(serverWorkspaceResponse)
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract)

    const errorAzureStorageMock: Partial<AzureStorageContract> = ({
      details: () => Promise.reject(new Response('Mock container error', { status: 500 }))
    })
    asMockedFn(AzureStorage).mockImplementation(() => errorAzureStorageMock as AzureStorageContract)

    // Expected response from first call.
    const uninitializedAzureWorkspace = _.clone(initializedAzureWorkspace)
    uninitializedAzureWorkspace.workspaceInitialized = false

    const expectedFirstStorageDetails = _.merge(defaultGoogleBucketOptions, defaultAzureStorageOptions)
    const expectedSecondStorageDetails = _.merge({
      azureContainerRegion: azureStorageDetails.location,
      azureContainerUrl: 'container-url',
      azureContainerSasUrl: azureStorageDetails.sas.url
    }, defaultGoogleBucketOptions)

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useWorkspace('testNamespace', 'testName'))
    await waitForNextUpdate() // For the call to AzureStorage.details to execute

    // Assert
    assertResult(result.current, uninitializedAzureWorkspace, expectedFirstStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(uninitializedAzureWorkspace)
    expect(WorkspaceUtils.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(uninitializedAzureWorkspace.workspace.workspaceId)
    expect(GoogleStorage.saToken).not.toHaveBeenCalled()

    // Arrange
    // Now return success for the next call to AzureStorage.details
    const successAzureStorageMock: Partial<AzureStorageContract> = ({
      details: jest.fn().mockResolvedValue(azureStorageDetails)
    })
    asMockedFn(AzureStorage).mockImplementation(() => successAzureStorageMock as AzureStorageContract)

    // Act
    // next call to AzureStorage.details is on a timer
    jest.advanceTimersByTime(azureBucketRecheckRate)
    await waitForNextUpdate()

    // Assert
    assertResult(result.current, initializedAzureWorkspace, expectedSecondStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedAzureWorkspace)
  })

  it('returns an access error if workspace details throws a 404', async () => {
    // Arrange
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          details: () => Promise.reject(new Response('Mock access error', { status: 404 }))
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract)

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useWorkspace('testNamespace', 'testName'))
    await waitForNextUpdate()

    // Assert
    assertResult(result.current, undefined, _.merge(defaultGoogleBucketOptions, defaultAzureStorageOptions), true)
    expect(workspaceStore.set).not.toHaveBeenCalled()
    expect(WorkspaceUtils.updateRecentlyViewedWorkspaces).not.toHaveBeenCalled()
    expect(GoogleStorage.saToken).not.toHaveBeenCalled()
  })

  it('does not request SA token for Google workspace if not a writer', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace
    serverWorkspaceResponse.accessLevel = 'READER'

    const expectedWorkspaceResponse = _.merge(_.clone(serverWorkspaceResponse), { workspaceInitialized: true })

    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
          checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
          checkBucketReadAccess: jest.fn()
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract)

    const expectStorageDetails = _.merge({
      googleBucketLocation: bucketLocationResponse.location,
      googleBucketType: bucketLocationResponse.locationType
    }, defaultAzureStorageOptions)

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useWorkspace('testNamespace', 'testName'))
    await waitForNextUpdate() // For the call to checkBucketReadAccess to execute

    // Assert
    assertResult(result.current, expectedWorkspaceResponse, expectStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(expectedWorkspaceResponse)
    expect(WorkspaceUtils.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(expectedWorkspaceResponse.workspace.workspaceId)
    expect(GoogleStorage.saToken).not.toHaveBeenCalled()
    expect(Notifications.notify).not.toHaveBeenCalled()
  })

  it('Shows a notification if workspace just created by user, but Rawls did not return that they are the owner', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace
    serverWorkspaceResponse.accessLevel = 'READER'

    const expectedWorkspaceResponse = _.merge(_.clone(serverWorkspaceResponse), { workspaceInitialized: true })

    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
          checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
          checkBucketReadAccess: jest.fn()
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract)

    const expectStorageDetails = _.merge({
      googleBucketLocation: bucketLocationResponse.location,
      googleBucketType: bucketLocationResponse.locationType
    }, defaultAzureStorageOptions)

    // Created time is '2023-02-03T22:26:06.124Z',
    jest.setSystemTime(new Date(Date.UTC(2023, 1, 3, 22, 26, 12, 0)))

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useWorkspace('testNamespace', 'testName'))
    await waitForNextUpdate() // For the call to checkBucketReadAccess to execute

    // Assert
    assertResult(result.current, expectedWorkspaceResponse, expectStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(expectedWorkspaceResponse)
    expect(WorkspaceUtils.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(expectedWorkspaceResponse.workspace.workspaceId)
    expect(GoogleStorage.saToken).not.toHaveBeenCalled()
    expect(Notifications.notify).toHaveBeenCalled()
  })

  it('Does not (temporarily) call checkBucketReadAccess in production', async () => {
    // Need to add nextflow role to old workspaces (WOR-764)

    // Arrange
    // @ts-ignore
    getConfig.mockReturnValue({ isProd: true })

    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace

    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () => ({
          details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
          checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse)
        })
      }
    }
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract)

    const expectedStorageDetails = _.merge({
      googleBucketLocation: bucketLocationResponse.location,
      googleBucketType: bucketLocationResponse.locationType
    }, defaultAzureStorageOptions)

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useWorkspace('testNamespace', 'testName'))
    await waitForNextUpdate() // For the call to checkBucketLocation to execute

    // Assert
    assertResult(result.current, initializedGoogleWorkspace, expectedStorageDetails, false)
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedGoogleWorkspace)
    expect(WorkspaceUtils.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(initializedGoogleWorkspace.workspace.workspaceId)
  })
})