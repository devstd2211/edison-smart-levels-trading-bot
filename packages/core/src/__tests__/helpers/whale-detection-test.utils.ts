import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  WhaleDetectionMode,
  WhaleDetectionService,
  WhaleDetectorConfig,
} from '../../services/whale-detection.service';
import {
  LoggerService,
  LogLevel,
  OrderBookAnalysis,
  OrderBookWall,
  SignalDirection,
} from '../../types/legacy';

export function createWhaleDetectionLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createWhaleDetectionMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
  };
}

export function createWhaleDetectionMockLoggerService(
  overrides: Partial<ReturnType<typeof createWhaleDetectionMockLogger>> = {},
): LoggerService {
  return {
    ...createWhaleDetectionMockLogger(),
    ...overrides,
  } as unknown as LoggerService;
}

export function createWhaleDetectionConfig(): WhaleDetectorConfig {
  return {
    modes: {
      wallBreak: {
        enabled: true,
        minWallSize: 15,
        breakConfirmationMs: 3000,
        maxConfidence: 85,
      },
      wallDisappearance: {
        enabled: true,
        minWallSize: 20,
        minWallDuration: 60000,
        wallGoneThresholdMs: 15000,
        maxConfidence: 80,
      },
      imbalanceSpike: {
        enabled: true,
        minRatioChange: 0.5,
        detectionWindow: 10000,
        maxConfidence: 90,
      },
    },
    maxImbalanceHistory: 20,
    wallExpiryMs: 60000,
    breakExpiryMs: 300000,
  };
}

export function createWhaleDetectionConfigWithImbalanceSpike(
  override: Partial<WhaleDetectorConfig['modes']['imbalanceSpike']>,
): WhaleDetectorConfig {
  const config = createWhaleDetectionConfig();
  return {
    ...config,
    modes: {
      ...config.modes,
      imbalanceSpike: {
        ...config.modes.imbalanceSpike,
        ...override,
      },
    },
  };
}

export function createWhaleDetectionConfigWithWallBreak(
  override: Partial<WhaleDetectorConfig['modes']['wallBreak']>,
): WhaleDetectorConfig {
  const config = createWhaleDetectionConfig();
  return {
    ...config,
    modes: {
      ...config.modes,
      wallBreak: {
        ...config.modes.wallBreak,
        ...override,
      },
    },
  };
}

export function createWhaleDetectionWall(
  side: 'BID' | 'ASK',
  price: number,
  percentOfTotal: number,
  distance: number,
  quantity = 5000,
): OrderBookWall {
  return {
    side,
    price,
    quantity,
    percentOfTotal,
    distance,
  };
}

export function createWhaleDetectionAnalysis(
  walls: OrderBookWall[] = [],
  ratio: number = 1,
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL',
): OrderBookAnalysis {
  return {
    timestamp: Date.now(),
    orderBook: {
      symbol: 'APEXUSDT',
      timestamp: Date.now(),
      bids: [],
      asks: [],
      updateId: 0,
    },
    walls,
    imbalance: {
      bidVolume: 1000,
      askVolume: 1000,
      ratio,
      direction,
      strength: 0.5,
    },
    strongestBid: null,
    strongestAsk: null,
    spread: 0.05,
    depth: { bid: 50, ask: 50 },
  };
}

export function createWhaleDetectionHarness(options: {
  logger?: LoggerService;
  config?: WhaleDetectorConfig;
  strategy?: 'BREAKOUT' | 'FOLLOW';
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createWhaleDetectionLogger();
  const config = options.config ?? createWhaleDetectionConfig();
  const errorHandler = createWhaleDetectionErrorHandler(logger);
  const detector = createWhaleDetectionService({
    logger,
    config,
    strategy: options.strategy,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    detector,
    logger,
    config,
    errorHandler,
    createStandardService: (serviceOptions: {
      logger?: LoggerService;
      config?: WhaleDetectorConfig;
      strategy?: 'BREAKOUT' | 'FOLLOW';
      errorHandler?: ErrorHandler;
      withErrorHandler?: boolean;
    } = {}) => {
      const resolvedConfig = Object.prototype.hasOwnProperty.call(serviceOptions, 'config')
        ? serviceOptions.config
        : config;

      return createWhaleDetectionService({
        logger: serviceOptions.logger ?? logger,
        config: resolvedConfig,
        strategy: serviceOptions.strategy ?? options.strategy,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        withErrorHandler: serviceOptions.withErrorHandler ?? options.withErrorHandler,
      });
    },
    createLegacyService: (serviceOptions: {
      logger?: LoggerService;
      config?: WhaleDetectorConfig;
      strategy?: 'BREAKOUT' | 'FOLLOW';
    } = {}) => {
      const resolvedConfig = Object.prototype.hasOwnProperty.call(serviceOptions, 'config')
        ? serviceOptions.config
        : config;

      return createWhaleDetectionService({
        logger: serviceOptions.logger ?? logger,
        config: resolvedConfig,
        strategy: serviceOptions.strategy ?? options.strategy,
        withErrorHandler: false,
      });
    },
    createScenario: (scenarioOptions: {
      logger?: LoggerService;
      config?: WhaleDetectorConfig;
      strategy?: 'BREAKOUT' | 'FOLLOW';
      errorHandler?: ErrorHandler;
      withErrorHandler?: boolean;
      walls?: OrderBookWall[];
      ratio?: number;
      direction?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    } = {}) =>
      createWhaleDetectionScenarioHarness({
        logger: scenarioOptions.logger ?? logger,
        config: scenarioOptions.config ?? config,
        strategy: scenarioOptions.strategy ?? options.strategy,
        withErrorHandler: scenarioOptions.withErrorHandler ?? options.withErrorHandler,
        walls: scenarioOptions.walls,
        ratio: scenarioOptions.ratio,
        direction: scenarioOptions.direction,
      }),
  };
}

export type WhaleDetectionHarness = ReturnType<typeof createWhaleDetectionHarness>;

export type ManagedWhaleDetectionContext = WhaleDetectionHarness & {
  cleanup: () => void;
};

export function createManagedWhaleDetectionContext(options: {
  logger?: LoggerService;
  config?: WhaleDetectorConfig;
  strategy?: 'BREAKOUT' | 'FOLLOW';
  withErrorHandler?: boolean;
} = {}): ManagedWhaleDetectionContext {
  const harness = createWhaleDetectionHarness(options);
  const trackedServices = new Set<WhaleDetectionService>([harness.detector]);

  const createStandardService: WhaleDetectionHarness['createStandardService'] = (serviceOptions = {}) => {
    const service = harness.createStandardService(serviceOptions);
    trackedServices.add(service);
    return service;
  };

  const createLegacyService: WhaleDetectionHarness['createLegacyService'] = (serviceOptions = {}) => {
    const service = harness.createLegacyService(serviceOptions);
    trackedServices.add(service);
    return service;
  };

  const createScenario: WhaleDetectionHarness['createScenario'] = (scenarioOptions = {}) => {
    const detector =
      scenarioOptions.withErrorHandler === false
        ? createLegacyService({
            logger: scenarioOptions.logger,
            config: scenarioOptions.config,
            strategy: scenarioOptions.strategy,
          })
        : createStandardService({
            logger: scenarioOptions.logger,
            config: scenarioOptions.config,
            strategy: scenarioOptions.strategy,
            errorHandler: scenarioOptions.errorHandler,
            withErrorHandler: scenarioOptions.withErrorHandler,
          });

    return {
      detector,
      logger: scenarioOptions.logger ?? harness.logger,
      config: scenarioOptions.config ?? harness.config,
      errorHandler: scenarioOptions.errorHandler ?? harness.errorHandler,
      analysis: createWhaleDetectionAnalysis(
        scenarioOptions.walls,
        scenarioOptions.ratio,
        scenarioOptions.direction,
      ),
      createStandardService,
      createLegacyService,
      createScenario,
    };
  };

  return {
    ...harness,
    createStandardService,
    createLegacyService,
    createScenario,
    cleanup: () => {
      trackedServices.clear();
      jest.restoreAllMocks();
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
  };
}

export function createWhaleDetectionScenarioHarness(options: {
  logger?: LoggerService;
  config?: WhaleDetectorConfig;
  strategy?: 'BREAKOUT' | 'FOLLOW';
  withErrorHandler?: boolean;
  walls?: OrderBookWall[];
  ratio?: number;
  direction?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
} = {}) {
  const harness = createWhaleDetectionHarness(options);
  const analysis = createWhaleDetectionAnalysis(
    options.walls,
    options.ratio,
    options.direction,
  );

  return {
    ...harness,
    analysis,
  };
}

export function createWhaleDetectionErrorHandler(
  logger: LoggerService = createWhaleDetectionLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createWhaleDetectionService(options: {
  logger?: LoggerService;
  config?: WhaleDetectorConfig;
  strategy?: 'BREAKOUT' | 'FOLLOW';
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createWhaleDetectionLogger();
  const config =
    Object.prototype.hasOwnProperty.call(options, 'config')
      ? options.config
      : createWhaleDetectionConfig();

  return new WhaleDetectionService(
    config as WhaleDetectorConfig,
    logger,
    options.strategy ?? 'BREAKOUT',
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}
