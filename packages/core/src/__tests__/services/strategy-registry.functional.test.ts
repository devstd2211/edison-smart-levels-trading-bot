import { ICONS } from '../../cli/cli-runtime';
import { StrategyRegistryService } from '../../services/multi-strategy/strategy-registry.service';

describe('StrategyRegistryService functional', () => {
  it('logs lifecycle operations with shared icons while preserving registry state', () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const registry = new StrategyRegistryService(undefined, logger as never);

    registry.registerStrategy('alpha', {
      id: 'alpha',
      name: 'level-trading',
      version: '1.0.0',
      isActive: false,
      loadedAt: new Date(),
    });
    registry.setActive('alpha', true);
    registry.clear();

    expect(logger.info).toHaveBeenCalledWith(
      `[StrategyRegistry] ${ICONS.success} Registered strategy: alpha (level-trading)`,
      undefined,
    );
    expect(logger.info).toHaveBeenCalledWith(
      `[StrategyRegistry] ${ICONS.success} Activated strategy: alpha`,
      undefined,
    );
    expect(logger.info).toHaveBeenCalledWith(
      `[StrategyRegistry] ${ICONS.success} Cleared all strategies`,
      undefined,
    );
    expect(registry.getStats().totalStrategies).toBe(0);
  });
});
