import { DynamicConfigManagerService } from '../../services/multi-strategy/dynamic-config-manager.service';
import { ICONS } from '../../cli/cli-runtime';

describe('DynamicConfigManagerService functional', () => {
  it('keeps cache reads detached from logger fallback behavior across load, watch, and clear operations', async () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const service = new DynamicConfigManagerService('./strategies/json', logger as never);

    await service.loadStrategyConfig('alpha');
    service.watchConfigFile('alpha', jest.fn());
    service.clearCache();

    expect(logger.info).toHaveBeenCalledWith('Loading strategy config', { strategyName: 'alpha' });
    expect(logger.info).toHaveBeenCalledWith('Loaded strategy config', { strategyName: 'alpha', icon: `${ICONS.success}` });
    expect(logger.info).toHaveBeenCalledWith('Watching strategy config file', { strategyName: 'alpha', icon: `${ICONS.note}` });
    expect(logger.info).toHaveBeenCalledWith('Cleared strategy config cache', undefined);
    expect(service.getCachedConfigs()).toEqual([]);
  });
});
