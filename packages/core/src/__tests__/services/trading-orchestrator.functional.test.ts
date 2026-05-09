import { TradingOrchestrator } from '../../services/trading-orchestrator.service';
import { ICONS } from '../../cli/cli-runtime';

describe('TradingOrchestrator functional', () => {
  it('starts and wires optional services with minimal runtime config', async () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const preCalc = { cache: { getStats: () => ({ hitRate: 100, hits: 1, misses: 0, size: 1, capacity: 10, evictions: 0 }) } };
    const service = new TradingOrchestrator(
      { indicators: {}, analyzers: [], filters: {} } as never,
      { getCandles: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      { getServerTime: jest.fn().mockResolvedValue(Date.now()) } as never,
      { getCurrentPosition: jest.fn().mockReturnValue(null), openPosition: jest.fn() } as never,
      null,
      logger as never,
      {} as never,
      null,
    );

    service.setIndicatorPreCalculationService(preCalc as never);
    await service.start();
    service.logCacheStats();

    expect(service.getActionQueue()).not.toBeNull();
    expect(logger.debug).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      `${ICONS.plug} Pre-calculation service wired to TradingOrchestrator`,
    );

    service.stop();
  });
});
