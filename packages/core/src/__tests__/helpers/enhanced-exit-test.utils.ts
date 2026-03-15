import { ErrorHandler } from '../../errors/ErrorHandler';
import { EnhancedExitConfig, EnhancedExitService } from '../../services/enhanced-exit.service';
import { LoggerService } from '../../types/legacy';

export function createEnhancedExitMockLogger(): LoggerService {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as LoggerService;
}

export function createEnhancedExitConfig(): Partial<EnhancedExitConfig> {
  return {
    riskRewardGate: {
      enabled: true,
      minRR: 1.5,
      preferredRR: 2.0,
    },
    structureBasedTP: {
      enabled: true,
      mode: 'LEVEL',
      offsetPercent: 0.1,
      fallbackPercent: 2.0,
      useNextLevelAsTP1: true,
    },
    liquidityAwareSL: {
      enabled: true,
      extendBeyondLiquidity: true,
      extensionPercent: 0.2,
      useSwingPoints: true,
      swingLookback: 20,
    },
    atrBasedTP: {
      enabled: true,
      tp1AtrMultiplier: 1.5,
      tp2AtrMultiplier: 3.0,
      minTPPercent: 0.5,
      maxTPPercent: 5.0,
    },
    dynamicBreakeven: {
      enabled: true,
      activationPercent: 1.0,
      offsetPercent: 0.1,
    },
    adaptiveTrailing: {
      enabled: true,
      activationPercent: 1.5,
      trailingDistancePercent: 0.5,
      useATRDistance: true,
      trailingDistanceATR: 0.5,
    },
  };
}

export function createEnhancedExitHarness(options: {
  logger?: LoggerService;
  config?: Partial<EnhancedExitConfig>;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createEnhancedExitMockLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const service = createEnhancedExitService({
    logger,
    config: options.config,
    withErrorHandler: options.withErrorHandler,
    errorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
  };
}

export function createEnhancedExitService(options: {
  logger?: LoggerService;
  config?: Partial<EnhancedExitConfig>;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): EnhancedExitService {
  const logger = options.logger ?? createEnhancedExitMockLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new EnhancedExitService(
    logger,
    options.config ?? createEnhancedExitConfig(),
    errorHandler,
  );
}
