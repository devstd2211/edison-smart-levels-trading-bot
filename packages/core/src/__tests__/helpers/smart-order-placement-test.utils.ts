import { ErrorHandler } from '../../errors/ErrorHandler';
import { SmartOrderPlacementService } from '../../services/smart-order-placement.service';
import { LoggerService, Orderbook, SmartOrderPlacementConfig } from '../../types/legacy';

type LoggerLike = Pick<LoggerService, 'info' | 'warn' | 'debug' | 'error'>;

export function asSmartOrderPlacementConfig(value: unknown): SmartOrderPlacementConfig {
  return value as SmartOrderPlacementConfig;
}

export function asSmartOrderPlacementOrderbook(value: unknown): Orderbook {
  return value as Orderbook;
}

export function asSmartOrderDirection(value: unknown): 'buy' | 'sell' {
  return value as 'buy' | 'sell';
}

export function createSmartOrderPlacementLogger(methodToFail?: keyof LoggerLike): LoggerService {
  const logger: LoggerLike = {
    info: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'info') throw new Error('Logger.info failed');
    }),
    warn: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'warn') throw new Error('Logger.warn failed');
    }),
    debug: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'debug') throw new Error('Logger.debug failed');
    }),
    error: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'error') throw new Error('Logger.error failed');
    }),
  };

  return logger as unknown as LoggerService;
}

export function createSmartOrderPlacementConfig(
  overrides: Partial<SmartOrderPlacementConfig> = {},
): SmartOrderPlacementConfig {
  return {
    maxOrderSize: 10.0,
    maxSlippageBps: 50,
    minFillProbability: 80,
    analyzeLevels: 20,
    enableAdaptive: true,
    executionTimeHorizon: 60000,
    ...overrides,
  };
}

export function createSmartOrderPlacementOrderbook(): Orderbook {
  const bids = [];
  const asks = [];

  for (let i = 0; i < 20; i++) {
    bids.push({
      price: 50000 - i * 10,
      volume: 5 + Math.random() * 10,
      orderCount: 10 + Math.floor(Math.random() * 20),
    });

    asks.push({
      price: 50010 + i * 10,
      volume: 5 + Math.random() * 10,
      orderCount: 10 + Math.floor(Math.random() * 20),
    });
  }

  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids,
    asks,
  };
}

export function createThinSmartOrderPlacementOrderbook(): Orderbook {
  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids: [
      { price: 50000, volume: 0.5, orderCount: 1 },
      { price: 49990, volume: 0.3, orderCount: 1 },
    ],
    asks: [
      { price: 50010, volume: 0.5, orderCount: 1 },
      { price: 50020, volume: 0.3, orderCount: 1 },
    ],
  };
}

export function createSmartOrderPlacementHarness(options: {
  config?: SmartOrderPlacementConfig;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createSmartOrderPlacementLogger();
  const config = options.config ?? createSmartOrderPlacementConfig();
  const errorHandler = options.withErrorHandler === false ? undefined : new ErrorHandler(logger);
  const service = new SmartOrderPlacementService(config, undefined, logger, errorHandler);

  return {
    service,
    logger,
    errorHandler,
    config,
  };
}
