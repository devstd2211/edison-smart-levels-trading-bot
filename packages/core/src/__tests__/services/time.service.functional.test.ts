import { TimeService } from '../../services/time.service';
import {
  createManagedFunctionalTimeServiceContext,
  type FunctionalTimeServiceRuntime,
} from '../helpers/time-service-test.utils';

describe('TimeService - Functional behavior', () => {
  let timeService: TimeService;
  let harness: FunctionalTimeServiceRuntime['harness'];
  let mockExchange: FunctionalTimeServiceRuntime['mockExchange'];
  let mockLogger: FunctionalTimeServiceRuntime['mockLogger'];
  let setNow: FunctionalTimeServiceRuntime['setNow'];
  let cleanup: FunctionalTimeServiceRuntime['cleanup'];

  beforeEach(() => {
    ({
      harness,
      timeService,
      mockExchange,
      mockLogger,
      setNow,
      cleanup,
    } = createManagedFunctionalTimeServiceContext());
  });

  afterEach(() => {
    cleanup();
  });

  it('synchronizes with exchange time and exposes consistent conversions', async () => {
    setNow(1_710_000_000_000);
    mockExchange.getServerTime.mockResolvedValueOnce(1_710_000_000_750);

    await timeService.syncWithExchange();

    const syncInfo = timeService.getSyncInfo();

    expect(syncInfo.offset).toBe(750);
    expect(syncInfo.lastSync.toISOString()).toBe(
      new Date(1_710_000_000_000).toISOString(),
    );
    expect(timeService.now()).toBe(1_710_000_000_750);
    expect(timeService.toServerTime(100)).toBe(850);
    expect(timeService.toLocalTime(850)).toBe(100);
    expect(timeService.getTodayString()).toBe('2024-03-09');
  });

  it('reuses the last sync within the interval and refreshes after the interval expires', async () => {
    setNow(1_710_000_000_000);
    mockExchange.getServerTime.mockResolvedValueOnce(1_710_000_000_500);

    await timeService.ensureSync();
    expect(mockExchange.getServerTime).toHaveBeenCalledTimes(1);

    setNow(1_710_000_000_700);
    await timeService.ensureSync();
    expect(mockExchange.getServerTime).toHaveBeenCalledTimes(1);

    setNow(1_710_000_001_101);
    mockExchange.getServerTime.mockResolvedValueOnce(1_710_000_001_900);

    await timeService.ensureSync();

    expect(mockExchange.getServerTime).toHaveBeenCalledTimes(2);
    expect(timeService.getSyncInfo().offset).toBe(799);
  });

  it('keeps the last known offset when later sync attempts fail', async () => {
    setNow(1_710_000_000_000);
    mockExchange.getServerTime.mockResolvedValueOnce(1_710_000_000_600);
    await timeService.syncWithExchange();

    const stableOffset = timeService.getSyncInfo().offset;

    setNow(1_710_000_001_500);
    mockExchange.getServerTime.mockRejectedValueOnce(new Error('network down'));
    mockExchange.getServerTime.mockRejectedValueOnce(new Error('network down'));
    mockExchange.getServerTime.mockRejectedValueOnce(new Error('network down'));

    await timeService.syncWithExchange();

    expect(timeService.getSyncInfo().offset).toBe(stableOffset);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to sync time with exchange',
      expect.objectContaining({
        failureCount: 1,
        maxAllowed: 3,
      }),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Using last known time offset: ${stableOffset}ms`,
      undefined,
    );
  });

  it('falls back to local time when no exchange is attached', async () => {
    timeService = harness.createServiceWithoutExchange();
    setNow(1_710_000_010_000);

    await timeService.syncWithExchange();

    expect(timeService.now()).toBe(1_710_000_010_000);
    expect(timeService.getSyncInfo().offset).toBe(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Bybit service not set for time sync',
      undefined,
    );
  });
});
