import { ErrorHandler } from '../../errors/ErrorHandler';
import { StrategyConfigMergerService } from '../../services/strategy-config-merger.service';
import { StrategyLoaderService } from '../../services/strategy-loader.service';
import { StrategyManagerService } from '../../services/strategy-manager.service';
import type { ConfigNew } from '../../types/config/config-new.types';
import type { StrategyConfig } from '../../types/strategy-config';

export interface ManagedStrategyManagerContext {
  strategyManager: StrategyManagerService;
  mockLoader: jest.Mocked<StrategyLoaderService>;
  mockMerger: jest.Mocked<StrategyConfigMergerService>;
  mockErrorHandler: jest.Mocked<ErrorHandler>;
  mockStrategy: StrategyConfig;
  mockMainConfig: ConfigNew;
  createManager: (options?: { withErrorHandler?: boolean }) => StrategyManagerService;
  consoleLogSpy: jest.SpyInstance;
  cleanup: () => void;
}

export function createMockStrategyLoader(): jest.Mocked<StrategyLoaderService> {
  return {
    loadStrategy: jest.fn(),
    loadAllStrategies: jest.fn(),
  } as unknown as jest.Mocked<StrategyLoaderService>;
}

export function createMockStrategyMerger(): jest.Mocked<StrategyConfigMergerService> {
  return {
    mergeConfigs: jest.fn(),
    getChangeReport: jest.fn(),
  } as unknown as jest.Mocked<StrategyConfigMergerService>;
}

export function createMockStrategyErrorHandler(): jest.Mocked<ErrorHandler> {
  return {
    executeAsync: jest.fn(),
    handle: jest.fn(),
    getLogger: jest.fn(),
  } as unknown as jest.Mocked<ErrorHandler>;
}

export function createMockStrategyConfig(): StrategyConfig {
  return {
    version: 1,
    metadata: {
      name: 'test-strategy',
      version: '1.0.0',
      description: 'Test strategy',
      author: 'Test',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      tags: ['test'],
    },
    analyzers: [
      { name: 'analyzer1', weight: 0.5, enabled: true, priority: 1 },
      { name: 'analyzer2', weight: 0.3, enabled: true, priority: 2 },
      { name: 'analyzer3', weight: 0.2, enabled: false, priority: 3 },
    ],
  };
}

export function createMockStrategyMainConfig(): ConfigNew {
  return {
    version: 1,
    exchange: {
      name: 'bybit',
      symbols: ['BTCUSDT'],
    },
  } as unknown as ConfigNew;
}

export function createStrategyManagerHarness() {
  const mockLoader = createMockStrategyLoader();
  const mockMerger = createMockStrategyMerger();
  const mockErrorHandler = createMockStrategyErrorHandler();
  const strategyManager = createStrategyManagerService({
    loader: mockLoader,
    merger: mockMerger,
    errorHandler: mockErrorHandler,
  });

  return {
    strategyManager,
    mockLoader,
    mockMerger,
    mockErrorHandler,
    mockStrategy: createMockStrategyConfig(),
    mockMainConfig: createMockStrategyMainConfig(),
  };
}

export function createStrategyManagerFactory(options: {
  loader?: jest.Mocked<StrategyLoaderService>;
  merger?: jest.Mocked<StrategyConfigMergerService>;
  errorHandler?: jest.Mocked<ErrorHandler>;
} = {}) {
  return (factoryOptions: { withErrorHandler?: boolean } = {}) =>
    createStrategyManagerService({
      loader: options.loader,
      merger: options.merger,
      errorHandler: options.errorHandler,
      withErrorHandler: factoryOptions.withErrorHandler,
    });
}

export function createStrategyManagerService(options: {
  loader?: jest.Mocked<StrategyLoaderService>;
  merger?: jest.Mocked<StrategyConfigMergerService>;
  errorHandler?: jest.Mocked<ErrorHandler>;
  withErrorHandler?: boolean;
} = {}) {
  const loader = options.loader ?? createMockStrategyLoader();
  const merger = options.merger ?? createMockStrategyMerger();

  return new StrategyManagerService(
    loader,
    merger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createManagedStrategyManagerContext(): ManagedStrategyManagerContext {
  jest.clearAllMocks();

  const mockLoader = createMockStrategyLoader();
  const mockMerger = createMockStrategyMerger();
  const mockErrorHandler = createMockStrategyErrorHandler();
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  const createManager = createStrategyManagerFactory({
    loader: mockLoader,
    merger: mockMerger,
    errorHandler: mockErrorHandler,
  });

  return {
    strategyManager: createManager(),
    mockLoader,
    mockMerger,
    mockErrorHandler,
    mockStrategy: createMockStrategyConfig(),
    mockMainConfig: createMockStrategyMainConfig(),
    createManager,
    consoleLogSpy,
    cleanup() {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    },
  };
}
