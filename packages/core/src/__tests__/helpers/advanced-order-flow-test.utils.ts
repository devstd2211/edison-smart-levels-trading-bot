import { ErrorHandler } from '../../errors/ErrorHandler';
import { AdvancedOrderFlowService } from '../../services/advanced-order-flow.service';
import type { LoggerService } from '../../types/legacy';
import type {
  AdvancedOrderFlowConfig,
  Tick,
  OrderBook,
} from '../../types/advanced-order-flow';

type LoggerLike = Pick<LoggerService, 'info' | 'warn' | 'debug' | 'error'>;

export function asAdvancedOrderFlowConfig(
  value: unknown,
): AdvancedOrderFlowConfig {
  return value as AdvancedOrderFlowConfig;
}

export function asAdvancedOrderFlowTick(value: unknown): Tick {
  return value as Tick;
}

export function asAdvancedOrderFlowOrderBook(value: unknown): OrderBook {
  return value as OrderBook;
}

export function createAdvancedOrderFlowMockLogger(
  methodToFail?: 'info' | 'warn' | 'debug' | 'error',
): LoggerService {
  const logger: LoggerLike = {
    info: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'info') {
        throw new Error('Logger.info failed');
      }
    }),
    warn: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'warn') {
        throw new Error('Logger.warn failed');
      }
    }),
    debug: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'debug') {
        throw new Error('Logger.debug failed');
      }
    }),
    error: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'error') {
        throw new Error('Logger.error failed');
      }
    }),
  };

  return logger as LoggerService;
}

export function createAdvancedOrderFlowErrorHandler(
  logger: LoggerService = createAdvancedOrderFlowMockLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createAdvancedOrderFlowValidConfig(): AdvancedOrderFlowConfig {
  return {
    tickWindowMs: 5000,
    orderbookLevels: 10,
    imbalanceThreshold: 0.65,
    spoofingThreshold: 3.0,
    minVolumeUSDT: 1000,
    maxConfidence: 100,
    enableSpoofingDetection: true,
    enableMomentum: true,
  };
}

export function createAdvancedOrderFlowConfig(
  overrides: Partial<AdvancedOrderFlowConfig> = {},
): AdvancedOrderFlowConfig {
  return {
    ...createAdvancedOrderFlowValidConfig(),
    ...overrides,
  };
}

export function createAdvancedOrderFlowTick(
  side: 'BUY' | 'SELL',
  price = 50000,
  size = 0.1,
  timestamp = Date.now(),
): Tick {
  return { timestamp, price, size, side };
}

export function createAdvancedOrderFlowTickSequence(
  entries: Array<{
    side: 'BUY' | 'SELL';
    price?: number;
    size?: number;
    timestamp?: number;
  }>,
): Tick[] {
  return entries.map((entry) =>
    createAdvancedOrderFlowTick(
      entry.side,
      entry.price,
      entry.size,
      entry.timestamp,
    ),
  );
}

export function addAdvancedOrderFlowTicks(
  service: AdvancedOrderFlowService,
  entries: Array<{
    side: 'BUY' | 'SELL';
    price?: number;
    size?: number;
    timestamp?: number;
  }>,
): void {
  createAdvancedOrderFlowTickSequence(entries).forEach((tick) => {
    service.addTick(tick);
  });
}

export function createAdvancedOrderFlowOrderbookWithOverrides(
  overrides: Partial<OrderBook> = {},
): OrderBook {
  return {
    ...createAdvancedOrderFlowOrderbook(),
    ...overrides,
  };
}

export function createAdvancedOrderFlowOrderbook(): OrderBook {
  return {
    bids: [
      [50000, 1.0],
      [49990, 2.0],
      [49980, 1.5],
      [49970, 1.2],
      [49960, 0.8],
      [49950, 1.0],
      [49940, 0.5],
      [49930, 0.9],
      [49920, 1.1],
      [49910, 0.7],
    ],
    asks: [
      [50010, 1.0],
      [50020, 2.0],
      [50030, 1.5],
      [50040, 1.2],
      [50050, 0.8],
      [50060, 1.0],
      [50070, 0.5],
      [50080, 0.9],
      [50090, 1.1],
      [50100, 0.7],
    ],
  };
}

export function createAdvancedOrderFlowHarness(options?: {
  config?: AdvancedOrderFlowConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
}) {
  const config = options?.config ?? createAdvancedOrderFlowValidConfig();
  const logger = options?.logger ?? createAdvancedOrderFlowMockLogger();
  const errorHandler = options?.withErrorHandler === false
    ? undefined
    : options?.errorHandler ?? createAdvancedOrderFlowErrorHandler(logger);
  const service =
    options?.withErrorHandler === false
      ? createLegacyAdvancedOrderFlowService({
          config,
          logger,
        })
      : createStandardAdvancedOrderFlowService({
          config,
          logger,
          errorHandler,
        });

  return {
    service,
    logger,
    errorHandler,
    config,
  };
}

export interface ManagedAdvancedOrderFlowContext {
  service: AdvancedOrderFlowService;
  logger: LoggerService;
  errorHandler?: ErrorHandler;
  config: AdvancedOrderFlowConfig;
  createStandardService: (options?: {
    config?: AdvancedOrderFlowConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => AdvancedOrderFlowService;
  createLegacyService: (options?: {
    config?: AdvancedOrderFlowConfig;
    logger?: LoggerService;
  }) => AdvancedOrderFlowService;
  createService: (options?: {
    config?: AdvancedOrderFlowConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    withErrorHandler?: boolean;
  }) => AdvancedOrderFlowService;
  cleanup: () => void;
}

export type AdvancedOrderFlowManagedRuntime = Pick<
  ManagedAdvancedOrderFlowContext,
  'service' | 'logger' | 'errorHandler' | 'config'
>;

export type AdvancedOrderFlowManagedFactories = Pick<
  ManagedAdvancedOrderFlowContext,
  'createService' | 'createLegacyService' | 'cleanup'
>;

export function createManagedAdvancedOrderFlowContext(options?: {
  config?: AdvancedOrderFlowConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
}): ManagedAdvancedOrderFlowContext {
  jest.clearAllMocks();

  const harness = createAdvancedOrderFlowHarness(options);
  const createdServices = new Set<AdvancedOrderFlowService>([harness.service]);

  const trackService = (service: AdvancedOrderFlowService) => {
    createdServices.add(service);
    return service;
  };

  return {
    service: harness.service,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    config: harness.config,
    createStandardService: (serviceOptions = {}) => {
      const resolvedConfig = Object.prototype.hasOwnProperty.call(serviceOptions, 'config')
        ? serviceOptions.config
        : harness.config;

      return trackService(
        createStandardAdvancedOrderFlowService({
          config: resolvedConfig,
          logger: serviceOptions.logger ?? harness.logger,
          errorHandler: serviceOptions.errorHandler ?? harness.errorHandler,
        }),
      );
    },
    createLegacyService: (serviceOptions = {}) => {
      const resolvedConfig = Object.prototype.hasOwnProperty.call(serviceOptions, 'config')
        ? serviceOptions.config
        : harness.config;

      return trackService(
        createLegacyAdvancedOrderFlowService({
          config: resolvedConfig,
          logger: serviceOptions.logger ?? harness.logger,
        }),
      );
    },
    createService: (serviceOptions = {}) => {
      const resolvedConfig = Object.prototype.hasOwnProperty.call(serviceOptions, 'config')
        ? serviceOptions.config
        : harness.config;

      return trackService(
        createAdvancedOrderFlowService({
          config: resolvedConfig,
          logger: serviceOptions.logger ?? harness.logger,
          errorHandler: serviceOptions.errorHandler ?? harness.errorHandler,
          withErrorHandler: serviceOptions.withErrorHandler ?? options?.withErrorHandler,
        }),
      );
    },
    cleanup: () => {
      createdServices.forEach((service) => {
        service.clearHistory();
      });
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  } satisfies ManagedAdvancedOrderFlowContext;
}

export function createStandardAdvancedOrderFlowService(options?: {
  config?: AdvancedOrderFlowConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
}) {
  const config =
    options && 'config' in options
      ? options.config
      : createAdvancedOrderFlowValidConfig();
  const logger = options?.logger ?? createAdvancedOrderFlowMockLogger();

  return new AdvancedOrderFlowService(
    config as AdvancedOrderFlowConfig,
    undefined,
    logger,
    options?.errorHandler,
  );
}

export function createLegacyAdvancedOrderFlowService(options?: {
  config?: AdvancedOrderFlowConfig;
  logger?: LoggerService;
}) {
  const config =
    options && 'config' in options
      ? options.config
      : createAdvancedOrderFlowValidConfig();
  const logger = options?.logger ?? createAdvancedOrderFlowMockLogger();

  return new AdvancedOrderFlowService(
    config as AdvancedOrderFlowConfig,
    undefined,
    logger,
  );
}

export function createAdvancedOrderFlowService(options?: {
  config?: AdvancedOrderFlowConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
}) {
  return options?.withErrorHandler === false
    ? createLegacyAdvancedOrderFlowService(options)
    : createStandardAdvancedOrderFlowService(options);
}

export function createAdvancedOrderFlowServiceWithHarness(options?: {
  config?: AdvancedOrderFlowConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
}) {
  return createAdvancedOrderFlowService(options);
}
