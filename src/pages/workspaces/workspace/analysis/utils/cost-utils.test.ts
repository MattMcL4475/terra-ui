import {
  DecoratedPersistentDisk,
  diskStatuses,
  pdTypes,
  PersistentDisk,
} from 'src/libs/ajax/leonardo/models/disk-models';
import { cloudServiceTypes, GoogleRuntimeConfig } from 'src/libs/ajax/leonardo/models/runtime-config-models';
import { runtimeStatuses } from 'src/libs/ajax/leonardo/models/runtime-models';
import { getAzurePricesForRegion } from 'src/libs/azure-utils';
import {
  azureDisk,
  azureRuntime,
  galaxyDisk,
  galaxyRunning,
  getAzureDisk,
  getDisk,
  getGoogleRuntime,
  getJupyterRuntimeConfig,
} from 'src/pages/workspaces/workspace/analysis/_testData/testData';
import {
  getCostDisplayForDisk,
  getCostDisplayForTool,
  getPersistentDiskCostMonthly,
  getRuntimeCost,
  runtimeConfigCost,
} from 'src/pages/workspaces/workspace/analysis/utils/cost-utils';
import { appToolLabels, runtimeToolLabels } from 'src/pages/workspaces/workspace/analysis/utils/tool-utils';

const jupyterDisk: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-12-02T16:38:13.777424Z',
    dateAccessed: '2021-12-02T16:40:23.464Z',
  },
  blockSize: 4096,
  cloudContext: { cloudProvider: 'GCP', cloudResource: 'terra-test-f828b4cd' },
  diskType: 'pd-standard',
  id: 29,
  labels: {},
  name: 'saturn-pd-bd0d0405-c048-4212-bccf-568435933081',
  size: 50,
  status: 'Ready',
  zone: 'us-central1-a',
};

jest.mock('src/data/gce-machines', () => {
  const originalModule = jest.requireActual('src/data/gce-machines');

  return {
    ...originalModule,
    regionToPrices: [
      {
        name: 'US-CENTRAL1',
        monthlyStandardDiskPrice: 0.04,
        monthlySSDDiskPrice: 0.17,
        monthlyBalancedDiskPrice: 0.1,
        n1HourlyGBRamPrice: 0.004237,
        n1HourlyCpuPrice: 0.031611,
        preemptibleN1HourlyGBRamPrice: 0.000892,
        preemptibleN1HourlyCpuPrice: 0.006655,
        t4HourlyPrice: 0.35,
        p4HourlyPrice: 0.6,
        k80HourlyPrice: 0.45,
        v100HourlyPrice: 2.48,
        p100HourlyPrice: 1.46,
        preemptibleT4HourlyPrice: 0.11,
        preemptibleP4HourlyPrice: 0.216,
        preemptibleK80HourlyPrice: 0.0375,
        preemptibleV100HourlyPrice: 0.74,
        preemptibleP100HourlyPrice: 0.43,
      },
    ],
  };
});

describe('getCostDisplayForDisk', () => {
  it('GCP - will get the disk cost for a Galaxy AppDataDisk', () => {
    // Arrange
    const app = galaxyRunning;
    const appDataDisks = [galaxyDisk];
    const computeRegion = 'US-CENTRAL1';
    const currentRuntimeToolLabel = runtimeToolLabels.Jupyter;
    const persistentDisks = [];
    const runtimes = [];
    const toolLabel = appToolLabels.GALAXY;
    const expectedResult = 'Disk $0.04/hr';

    // Act
    const result = getCostDisplayForDisk(
      app,
      appDataDisks,
      computeRegion,
      currentRuntimeToolLabel,
      persistentDisks,
      runtimes,
      toolLabel
    );

    // Assert
    expect(result).toBe(expectedResult);
  });

  it('GCP - will get the disk cost for a Jupyter Persistent Disk', () => {
    // Arrange
    const jupyterRuntime = getGoogleRuntime({
      runtimeConfig: getJupyterRuntimeConfig({ diskId: jupyterDisk.id }),
    });
    const app = undefined;
    const appDataDisks = [];
    const computeRegion = 'US-CENTRAL1';
    const currentRuntimeToolLabel = runtimeToolLabels.Jupyter;
    const persistentDisks = [jupyterDisk];
    const runtimes = [jupyterRuntime];
    const toolLabel = runtimeToolLabels.Jupyter;
    const expectedResult = 'Disk < $0.01/hr';

    // Act
    const result = getCostDisplayForDisk(
      app,
      appDataDisks,
      computeRegion,
      currentRuntimeToolLabel,
      persistentDisks,
      runtimes,
      toolLabel
    );

    // Assert
    expect(result).toBe(expectedResult);
  });

  it('Will return empty string because when there is no app or runtime to get cost information from.', () => {
    // Arrange
    const app = undefined;
    const appDataDisks = [];
    const computeRegion = 'US-CENTRAL1';
    const currentRuntimeToolLabel = runtimeToolLabels.Jupyter;
    const persistentDisks = [];
    const runtimes = [];
    const toolLabel = runtimeToolLabels.Jupyter;
    const expectedResult = '';

    // Act
    const result = getCostDisplayForDisk(
      app,
      appDataDisks,
      computeRegion,
      currentRuntimeToolLabel,
      persistentDisks,
      runtimes,
      toolLabel
    );

    // Assert
    expect(result).toBe(expectedResult);
  });

  it('GCP - will return empty string because toolLabel and currentRuntimeToolLabel are not equal.', () => {
    // Arrange
    const app = undefined;
    const appDataDisks = [];
    const computeRegion = 'US-CENTRAL1';
    const currentRuntimeToolLabel = runtimeToolLabels.Jupyter;
    const persistentDisks = [];
    const runtimes = [];
    const toolLabel = runtimeToolLabels.RStudio;
    const expectedResult = '';

    // Act
    const result = getCostDisplayForDisk(
      app,
      appDataDisks,
      computeRegion,
      currentRuntimeToolLabel,
      persistentDisks,
      runtimes,
      toolLabel
    );

    // Assert
    expect(result).toBe(expectedResult);
  });

  it('GCP - will return blank string because cost is 0 due to deleting disk.', () => {
    // Arrange
    const jupyterRuntime = getGoogleRuntime({
      runtimeConfig: getJupyterRuntimeConfig({ diskId: jupyterDisk.id }),
    });
    const app = undefined;
    const appDataDisks = [];
    const computeRegion = 'US-CENTRAL1';
    const currentRuntimeToolLabel = runtimeToolLabels.Jupyter;
    const persistentDisks = [{ ...jupyterDisk, status: diskStatuses.deleting.leoLabel }];
    const runtimes = [jupyterRuntime];
    const toolLabel = runtimeToolLabels.Jupyter;
    const expectedResult = '';

    // Act
    const result = getCostDisplayForDisk(
      app,
      appDataDisks,
      computeRegion,
      currentRuntimeToolLabel,
      persistentDisks,
      runtimes,
      toolLabel
    );

    // Assert
    expect(result).toBe(expectedResult);
  });

  //  ---- Azure ----
  it('Azure - will get the disk cost display for an Azure disk.', () => {
    // Arrange
    const app = undefined;
    const appDataDisks = [];
    const computeRegion = 'eastus';
    const currentRuntimeToolLabel = runtimeToolLabels.JupyterLab;
    const persistentDisks = [azureDisk];
    const runtimes = [azureRuntime];
    const toolLabel = runtimeToolLabels.Jupyter;
    const expectedResult = 'Disk < $0.01/hr';

    // Act
    const result = getCostDisplayForDisk(
      app,
      appDataDisks,
      computeRegion,
      currentRuntimeToolLabel,
      persistentDisks,
      runtimes,
      toolLabel
    );

    // Assert
    expect(result).toBe(expectedResult);
  });
});

describe('GCP getCostDisplayForTool', () => {
  it('Will get compute cost and compute status for Galaxy app', () => {
    // Arrange
    const expectedResult = 'Running $0.52/hr';
    const app = galaxyRunning;
    const currentRuntime = undefined;
    const currentRuntimeToolLabel = undefined;
    const toolLabel = appToolLabels.GALAXY;

    // Act
    const result = getCostDisplayForTool(app, currentRuntime, currentRuntimeToolLabel, toolLabel);

    // Assert
    expect(result).toBe(expectedResult);
  });

  it('Will get compute cost and compute status for a running Jupyter runtime', () => {
    // Arrange
    const expectedResult = 'Running $0.05/hr';
    const app = undefined;
    const currentRuntime = getGoogleRuntime({
      runtimeConfig: getJupyterRuntimeConfig(),
    });
    const currentRuntimeToolLabel = runtimeToolLabels.Jupyter;
    const toolLabel = runtimeToolLabels.Jupyter;

    // Act
    const result = getCostDisplayForTool(app, currentRuntime, currentRuntimeToolLabel, toolLabel);

    // Assert
    expect(result).toBe(expectedResult);
  });

  it('Will get compute cost and compute status for a stopped Jupyter runtime', () => {
    // Arrange
    const expectedResult = 'Paused < $0.01/hr';
    const app = undefined;
    const jupyterRuntime = getGoogleRuntime({
      runtimeConfig: getJupyterRuntimeConfig(),
    });
    const currentRuntime = { ...jupyterRuntime, status: runtimeStatuses.stopped.leoLabel };
    const currentRuntimeToolLabel = runtimeToolLabels.Jupyter;
    const toolLabel = runtimeToolLabels.Jupyter;

    // Act
    const result = getCostDisplayForTool(app, currentRuntime, currentRuntimeToolLabel, toolLabel);

    // Assert
    expect(result).toBe(expectedResult);
  });

  it('Will return blank because current runtime is not equal to currentRuntimeToolLabel', () => {
    // Arrange
    const expectedResult = '';
    const app = undefined;
    const currentRuntime = getGoogleRuntime({
      runtimeConfig: getJupyterRuntimeConfig(),
    });
    const currentRuntimeToolLabel = runtimeToolLabels.RStudio;
    const toolLabel = runtimeToolLabels.Jupyter;

    // Act
    const result = getCostDisplayForTool(app, currentRuntime, currentRuntimeToolLabel, toolLabel);

    // Assert
    expect(result).toBe(expectedResult);
  });
});

describe('getRuntimeCost', () => {
  it('Azure - will get runtime cost', () => {
    // Arrange
    const runtime = azureRuntime;

    // Act
    const result = getRuntimeCost(runtime);

    // Assert
    expect(result).toBeGreaterThan(0);
  });

  it('GCP - Will return 0 if runtime is in error', () => {
    // Arrange
    const runtime = getGoogleRuntime({
      runtimeConfig: getJupyterRuntimeConfig(),
      status: 'Error',
    });

    // Act
    const result = getRuntimeCost(runtime);

    // Assert
    expect(result).toBe(0.0);
  });
});

describe('getCostDisplayForTool', () => {
  it('Azure - will get compute cost and compute status for a running Azure JupyterLab runtime', () => {
    // Arrange
    const app = undefined;
    const currentRuntime = azureRuntime;
    const currentRuntimeToolLabel = runtimeToolLabels.JupyterLab;
    const toolLabel = runtimeToolLabels.JupyterLab;

    // Act
    const result = getCostDisplayForTool(app, currentRuntime, currentRuntimeToolLabel, toolLabel);

    // Assert
    expect(result).toContain('Running'); // Costs may change, but we want to make sure the status prints correctly.
  });

  it('Will get blank compute cost due to no runtime.', () => {
    // Arrange
    const app = undefined;
    const currentRuntime = undefined;
    const currentRuntimeToolLabel = runtimeToolLabels.JupyterLab;
    const toolLabel = runtimeToolLabels.JupyterLab;

    // Act
    const result = getCostDisplayForTool(app, currentRuntime, currentRuntimeToolLabel, toolLabel);

    // Assert
    expect(result).toBe('');
  });
});

describe('getPersistentDiskCostMonthly', () => {
  it('GCP - Cost estimate', () => {
    // Arrange
    const gcpDiskAttached: DecoratedPersistentDisk = {
      ...getDisk({ size: 50 }),
      cloudContext: {
        cloudProvider: 'GCP',
        cloudResource: 'disk',
      },
      labels: [],
      status: diskStatuses.ready.leoLabel,
      auditInfo: {
        creator: 'trock@broadinstitute.org',
        createdDate: '2020-10-13T15:00:00.000Z',
        dateAccessed: '2020-10-13T15:00:00.000Z',
        destroyedDate: undefined,
      },
      // diskType: pdTypes.standard,
    };

    // Act
    const result = getPersistentDiskCostMonthly(gcpDiskAttached, 'US-CENTRAL1');

    // Assert
    expect(result).not.toBe(NaN); // Seems excessive to check the math, we really just want to see that it calculates a number.
  });

  // TODO: Need disk types for Azure
  it('Azure - Standard disk smallest size cost estimate', () => {
    // Arrange
    const azureDiskAttached = {
      ...getAzureDisk({ size: 50 }),
      diskType: pdTypes.standard,
    };

    // Act
    const result = getPersistentDiskCostMonthly(azureDiskAttached, 'NORTHAMERICA-NORTHEAST1');

    // Assert
    expect(result).toBe(getAzurePricesForRegion('eastus')!['S6 LRS']);
  });
});

describe('runtimeConfigCost for dataproc', () => {
  const defaultSparkSingleNode: GoogleRuntimeConfig = {
    cloudService: cloudServiceTypes.DATAPROC,
    autopauseThreshold: 30,
    region: 'US-CENTRAL1',
    masterMachineType: 'n1-standard-4',
    masterDiskSize: 150,
    numberOfWorkers: 0,
    componentGatewayEnabled: true,
    numberOfPreemptibleWorkers: 0,
    workerDiskSize: 0,
    workerPrivateAccess: false,
  };

  const defaultSparkCluster: GoogleRuntimeConfig = {
    cloudService: cloudServiceTypes.DATAPROC,
    autopauseThreshold: 30,
    region: 'US-CENTRAL1',
    masterMachineType: 'n1-standard-4',
    masterDiskSize: 150,
    numberOfWorkers: 2,
    componentGatewayEnabled: true,
    numberOfPreemptibleWorkers: 0,
    workerMachineType: 'n1-standard-4',
    workerDiskSize: 150,
    workerPrivateAccess: false,
  };
  it('gets cost for a dataproc cluster', () => {
    // Act
    const result = runtimeConfigCost(defaultSparkCluster);
    // Assert
    expect(result).toBeGreaterThan(0);
  });
  it('gets cost for single node cluster', () => {
    // Act
    const result = runtimeConfigCost(defaultSparkSingleNode);

    // Assert
    expect(result).toBeGreaterThan(0);
  });
});