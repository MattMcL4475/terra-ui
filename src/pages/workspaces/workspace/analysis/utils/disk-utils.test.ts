import { addDays, subDays } from 'date-fns';
import { diskStatuses } from 'src/libs/ajax/leonardo/models/disk-models';
import {
  generateTestDisk,
  generateTestGoogleRuntime,
  getRuntimeConfig,
} from 'src/pages/workspaces/workspace/analysis/_testData/testData';
import {
  getCurrentPersistentDisk,
  getReadyPersistentDisk,
} from 'src/pages/workspaces/workspace/analysis/utils/disk-utils';

describe('getCurrentPersistentDisk', () => {
  it('returns undefined if no disks/runtimes exist', () => {
    // Assert
    expect(getCurrentPersistentDisk([], [])).toBeUndefined();
  });
  it('returns a disk if 1 exists with no runtimes', () => {
    // Arrange
    const disk1 = generateTestDisk();

    // Assert
    expect(getCurrentPersistentDisk([], [disk1])).toStrictEqual(disk1);
  });
  it('returns no disks if only deleting disks exists', () => {
    // Arrange
    const disk1 = generateTestDisk({ status: diskStatuses.deleting.leoLabel });
    const disk2 = generateTestDisk({ status: diskStatuses.deleting.leoLabel });

    // Assert
    expect(getCurrentPersistentDisk([], [disk1, disk2])).toBeUndefined();
  });
  it('returns the most recent disk in a list with no runtimes', () => {
    // chronologically, disk1 is the middle, disk2 the most recent, and disk3 the oldest
    // getCurrentPersistentDisk should return the most recent
    // Arrange
    const disk1 = generateTestDisk();
    const disk2 = generateTestDisk({
      auditInfo: {
        ...disk1.auditInfo,
        createdDate: addDays(new Date(disk1.auditInfo.createdDate), 3).toString(),
      },
    });
    const disk3 = generateTestDisk({
      auditInfo: {
        ...disk1.auditInfo,
        createdDate: subDays(new Date(disk1.auditInfo.createdDate), 3).toString(),
      },
    });

    // Assert
    expect(getCurrentPersistentDisk([], [disk1, disk2, disk3])).toStrictEqual(disk2);
  });

  it('returns the disk attached to the current runtime', () => {
    // Arrange
    const disk1 = generateTestDisk();
    const runtime1 = generateTestGoogleRuntime();
    const runtime2 = generateTestGoogleRuntime({
      runtimeConfig: getRuntimeConfig({ persistentDiskId: disk1.id }),
    });
    const disk2 = generateTestDisk({
      auditInfo: {
        ...disk1.auditInfo,
        createdDate: addDays(new Date(disk1.auditInfo.createdDate), 3).toString(),
      },
    });
    const disk3 = generateTestDisk({
      auditInfo: {
        ...disk1.auditInfo,
        createdDate: subDays(new Date(disk1.auditInfo.createdDate), 3).toString(),
      },
    });

    // Assert
    expect(getCurrentPersistentDisk([runtime1, runtime2], [disk1, disk2, disk3])).toStrictEqual(disk1);
  });

  it('returns no disk if there is a current runtime but it matches no disks', () => {
    // Arrange
    const disk1 = generateTestDisk();
    const runtime1 = generateTestGoogleRuntime();
    const runtime2 = generateTestGoogleRuntime();
    const disk2 = generateTestDisk({
      auditInfo: {
        ...disk1.auditInfo,
        createdDate: addDays(new Date(disk1.auditInfo.createdDate), 3).toString(),
      },
    });
    const disk3 = generateTestDisk({
      auditInfo: {
        ...disk1.auditInfo,
        createdDate: subDays(new Date(disk1.auditInfo.createdDate), 3).toString(),
      },
    });

    // Assert
    expect(getCurrentPersistentDisk([runtime1, runtime2], [disk1, disk2, disk3])).toStrictEqual(undefined);
  });
});

describe('getReadyPersistentDisk', () => {
  it('returns a disk if 1 exists and is ready', () => {
    // Arrange
    const disk1 = generateTestDisk();

    // Assert
    expect(getReadyPersistentDisk([disk1])).toStrictEqual(disk1);
  });
  it('returns undefined if no disks/runtimes exist', () => {
    // Assert
    expect(getReadyPersistentDisk([])).toBeUndefined();
  });
  it('returns undefined if only deleting disks exists', () => {
    // Arrange
    const disk1 = generateTestDisk({ status: diskStatuses.deleting.leoLabel });

    // Assert
    expect(getReadyPersistentDisk([disk1])).toBeUndefined();
  });
  it('returns undefined if only errored disks exists', () => {
    // Arrange
    const disk1 = generateTestDisk({ status: diskStatuses.error.leoLabel });

    // Assert
    expect(getReadyPersistentDisk([disk1])).toBeUndefined();
  });
});
