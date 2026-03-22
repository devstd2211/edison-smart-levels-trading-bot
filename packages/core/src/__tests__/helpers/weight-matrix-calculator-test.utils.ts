import { ErrorHandler } from '../../errors/ErrorHandler';
import { WeightMatrixCalculatorService } from '../../services/weight-matrix-calculator.service';
import {
  LogLevel,
  LoggerService,
  SignalDirection,
  WeightMatrixConfig,
  WeightMatrixInput,
} from '../../types/legacy';

export function createWeightMatrixLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createWeightMatrixConfig(): WeightMatrixConfig {
  return {
    enabled: true,
    minConfidenceToEnter: 65,
    minConfidenceForReducedSize: 50,
    reducedSizeMultiplier: 0.5,
    weights: {
      rsi: {
        enabled: true,
        maxPoints: 20,
        thresholds: { excellent: 20, good: 30, ok: 40, weak: 50 },
      },
      stochastic: {
        enabled: true,
        maxPoints: 15,
        thresholds: { excellent: 15, good: 20, ok: 30 },
      },
      ema: {
        enabled: true,
        maxPoints: 15,
        thresholds: { excellent: 0.5, good: 1.0, ok: 1.5 },
      },
      bollingerBands: {
        enabled: true,
        maxPoints: 20,
        thresholds: { excellent: 95, good: 85, ok: 75 },
      },
      atr: {
        enabled: true,
        maxPoints: 10,
        thresholds: { excellent: 2.0, good: 1.5, ok: 1.2 },
      },
      volume: {
        enabled: true,
        maxPoints: 25,
        thresholds: { excellent: 2.0, good: 1.5, ok: 1.2, weak: 1.0 },
      },
      delta: {
        enabled: false,
        maxPoints: 15,
        thresholds: { excellent: 2.0, good: 1.5, ok: 1.0 },
      },
      orderbook: {
        enabled: true,
        maxPoints: 15,
        thresholds: { excellent: 20, good: 15, ok: 10 },
      },
      imbalance: {
        enabled: true,
        maxPoints: 15,
        thresholds: { excellent: 60, good: 45, ok: 30 },
      },
      levelStrength: {
        enabled: true,
        maxPoints: 20,
        thresholds: { excellent: 4, good: 3, ok: 2 },
      },
      levelDistance: {
        enabled: true,
        maxPoints: 15,
        thresholds: { excellent: 0.2, good: 0.5, ok: 1.0, weak: 1.5 },
      },
      swingPoints: {
        enabled: true,
        maxPoints: 10,
        thresholds: {},
      },
      chartPatterns: {
        enabled: true,
        maxPoints: 20,
        thresholds: { excellent: 90, good: 70, ok: 50 },
      },
      candlePatterns: {
        enabled: true,
        maxPoints: 15,
        thresholds: { excellent: 90, good: 70, ok: 50 },
      },
      seniorTFAlignment: {
        enabled: true,
        maxPoints: 20,
        thresholds: {},
      },
      btcCorrelation: {
        enabled: true,
        maxPoints: 15,
        thresholds: {},
      },
      tfAlignment: {
        enabled: true,
        maxPoints: 20,
        thresholds: { excellent: 90, good: 70, ok: 50 },
      },
      divergence: {
        enabled: true,
        maxPoints: 25,
        thresholds: {},
      },
      liquiditySweep: {
        enabled: true,
        maxPoints: 20,
        thresholds: {},
      },
    },
  };
}

export function createWeightMatrixErrorConfig(): WeightMatrixConfig {
  const config = createWeightMatrixConfig();
  return {
    ...config,
    weights: {
      ...config.weights,
      stochastic: { enabled: false, maxPoints: 15, thresholds: { excellent: 15, good: 20, ok: 30 } },
      ema: { enabled: false, maxPoints: 15, thresholds: { excellent: 0.5, good: 1.0, ok: 1.5 } },
      bollingerBands: { enabled: false, maxPoints: 20, thresholds: { excellent: 95, good: 85, ok: 75 } },
      delta: { enabled: false, maxPoints: 10, thresholds: { excellent: 2.0, good: 1.5, ok: 1.2 } },
      orderbook: { enabled: false, maxPoints: 10, thresholds: { excellent: 80, good: 60, ok: 40 } },
      imbalance: { enabled: false, maxPoints: 10, thresholds: { excellent: 70, good: 50, ok: 30 } },
      levelStrength: { enabled: false, maxPoints: 15, thresholds: { excellent: 5, good: 3, ok: 2 } },
      levelDistance: { enabled: false, maxPoints: 15, thresholds: { excellent: 0.5, good: 1.0, ok: 1.5, weak: 2.0 } },
      swingPoints: { enabled: false, maxPoints: 15, thresholds: {} },
      chartPatterns: { enabled: false, maxPoints: 10, thresholds: { excellent: 90, good: 70, ok: 50 } },
      candlePatterns: { enabled: false, maxPoints: 10, thresholds: { excellent: 90, good: 70, ok: 50 } },
      seniorTFAlignment: { enabled: false, maxPoints: 20, thresholds: {} },
      btcCorrelation: { enabled: false, maxPoints: 15, thresholds: {} },
      tfAlignment: { enabled: false, maxPoints: 15, thresholds: { excellent: 90, good: 70, ok: 50 } },
      divergence: { enabled: false, maxPoints: 15, thresholds: {} },
      liquiditySweep: { enabled: false, maxPoints: 10, thresholds: {} },
      volume: { enabled: true, maxPoints: 15, thresholds: { excellent: 2.0, good: 1.5, ok: 1.2, weak: 1.0 } },
    },
  };
}

export function createWeightMatrixInput(): WeightMatrixInput {
  return {
    rsi: 25,
    atr: { current: 2.5, average: 1.0 },
    volume: { current: 2.0, average: 1.0 },
  };
}

export function createWeightMatrixHarness(options: {
  config?: WeightMatrixConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createWeightMatrixLogger();
  const config = options.config ?? createWeightMatrixConfig();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const service = createWeightMatrixService({
    config,
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    logger,
    config,
    errorHandler,
    createStandardService: (serviceOptions: {
      config?: WeightMatrixConfig;
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
      withErrorHandler?: boolean;
    } = {}) =>
      createWeightMatrixService({
        config: serviceOptions.config ?? config,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        withErrorHandler: serviceOptions.withErrorHandler ?? options.withErrorHandler,
      }),
    createLegacyService: (serviceOptions: {
      config?: WeightMatrixConfig;
      logger?: LoggerService;
    } = {}) =>
      createWeightMatrixService({
        config: serviceOptions.config ?? config,
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: false,
      }),
  };
}

export function createStandardWeightMatrixHarness(options: {
  config?: WeightMatrixConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createWeightMatrixLogger();
  const config = options.config ?? createWeightMatrixConfig();
  const errorHandler = options.errorHandler ?? new ErrorHandler(logger);
  const service = createStandardWeightMatrixService({
    config,
    logger,
    errorHandler,
  });

  return {
    service,
    logger,
    config,
    errorHandler,
    createStandardService: (serviceOptions: {
      config?: WeightMatrixConfig;
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
    } = {}) =>
      createStandardWeightMatrixService({
        config: serviceOptions.config ?? config,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
  };
}

export function createErrorWeightMatrixHarness(options: {
  config?: WeightMatrixConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createWeightMatrixLogger();
  const config = options.config ?? createWeightMatrixErrorConfig();
  const errorHandler = options.errorHandler ?? new ErrorHandler(logger);

  return {
    ...createWeightMatrixHarness({
      config,
      logger,
      errorHandler,
    }),
    createStandardErrorService: (serviceOptions: {
      config?: WeightMatrixConfig;
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
    } = {}) =>
      createStandardWeightMatrixService({
        config: serviceOptions.config ?? config,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
    createLegacyErrorService: (serviceOptions: {
      config?: WeightMatrixConfig;
      logger?: LoggerService;
    } = {}) =>
      createLegacyWeightMatrixService({
        config: serviceOptions.config ?? config,
        logger: serviceOptions.logger ?? logger,
      }),
  };
}

export function createLegacyWeightMatrixHarness(options: {
  config?: WeightMatrixConfig;
  logger?: LoggerService;
} = {}) {
  const logger = options.logger ?? createWeightMatrixLogger();
  const config = options.config ?? createWeightMatrixConfig();
  const service = createLegacyWeightMatrixService({
    config,
    logger,
  });

  return {
    service,
    logger,
    config,
    errorHandler: undefined,
    createLegacyService: (serviceOptions: {
      config?: WeightMatrixConfig;
      logger?: LoggerService;
    } = {}) =>
      createLegacyWeightMatrixService({
        config: serviceOptions.config ?? config,
        logger: serviceOptions.logger ?? logger,
      }),
  };
}

export function createWeightMatrixService(options: {
  config?: WeightMatrixConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const config =
    'config' in options ? options.config : createWeightMatrixConfig();
  const logger = options.logger ?? createWeightMatrixLogger();

  return new WeightMatrixCalculatorService(
    config as WeightMatrixConfig,
    logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createStandardWeightMatrixService(options: {
  config?: WeightMatrixConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) {
  return createWeightMatrixService(options);
}

export function createLegacyWeightMatrixService(options: {
  config?: WeightMatrixConfig;
  logger?: LoggerService;
} = {}) {
  return createWeightMatrixService({
    config: options.config,
    logger: options.logger,
    withErrorHandler: false,
  });
}

export function calculateWeightMatrixScore(
  input: WeightMatrixInput,
  direction: SignalDirection,
  options: {
    config?: WeightMatrixConfig;
    logger?: LoggerService;
    withErrorHandler?: boolean;
  } = {},
) {
  const { service } = createWeightMatrixHarness(options);
  return service.calculateScore(input, direction);
}
