import { ErrorHandler } from '../../errors/ErrorHandler';
import { LiquidityHeatmapService } from '../../services/liquidity-heatmap.service';
import {
  LiquidityHeatmapConfig,
  LiquidityHeatmapOrderbookLevel as OrderbookLevel,
  LoggerService,
  Orderbook,
} from '../../types/legacy';

type LoggerLike = Pick<LoggerService, 'info' | 'warn' | 'debug' | 'error'>;

export function asLiquidityHeatmapConfig(value: unknown): LiquidityHeatmapConfig {
  return value as LiquidityHeatmapConfig;
}

export function asLiquidityHeatmapOrderbook(value: unknown): Orderbook {
  return value as Orderbook;
}

export function asLiquidityDirection(value: unknown): 'buy' | 'sell' {
  return value as 'buy' | 'sell';
}

export function createLiquidityHeatmapLogger(methodToFail?: keyof LoggerLike): LoggerService {
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

export function createLiquidityHeatmapConfig(
  overrides: Partial<LiquidityHeatmapConfig> = {},
): LiquidityHeatmapConfig {
  return {
    maxLevels: 50,
    minStrengthThreshold: 10,
    clusteringTolerance: 0.1,
    enableSupportResistance: true,
    enableSlippageCalc: true,
    enableExecutionCost: true,
    ...overrides,
  };
}

export function createLiquidityHeatmapOrderbook(): Orderbook {
  const bids: OrderbookLevel[] = [];
  const asks: OrderbookLevel[] = [];

  for (let i = 0; i < 20; i++) {
    bids.push({
      price: 50000 - i * 10,
      volume: Math.random() * 10 + 5,
      orderCount: Math.floor(Math.random() * 20) + 5,
    });
  }

  for (let i = 0; i < 20; i++) {
    asks.push({
      price: 50010 + i * 10,
      volume: Math.random() * 10 + 5,
      orderCount: Math.floor(Math.random() * 20) + 5,
    });
  }

  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids,
    asks,
  };
}

export function createThinLiquidityHeatmapOrderbook(): Orderbook {
  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids: [
      { price: 50000, volume: 0.1, orderCount: 1 },
      { price: 49990, volume: 0.05, orderCount: 1 },
    ],
    asks: [
      { price: 50010, volume: 0.1, orderCount: 1 },
      { price: 50020, volume: 0.05, orderCount: 1 },
    ],
  };
}

export function createDeepLiquidityHeatmapOrderbook(): Orderbook {
  const bids: OrderbookLevel[] = [];
  const asks: OrderbookLevel[] = [];

  for (let i = 0; i < 50; i++) {
    const volumeMultiplier = Math.exp(-i / 10);
    const baseVolume = 50;

    bids.push({
      price: 50000 - i * 5,
      volume: baseVolume * volumeMultiplier + Math.random() * 10,
      orderCount: Math.floor(100 * volumeMultiplier) + 10,
    });

    asks.push({
      price: 50010 + i * 5,
      volume: baseVolume * volumeMultiplier + Math.random() * 10,
      orderCount: Math.floor(100 * volumeMultiplier) + 10,
    });
  }

  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids,
    asks,
  };
}

export function createCorruptLiquidityHeatmapOrderbook(overrides: {
  bidPrice?: number;
  bidVolume?: number;
  askPrice?: number;
  askVolume?: number;
} = {}): Orderbook {
  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids: [
      {
        price: overrides.bidPrice ?? NaN,
        volume: overrides.bidVolume ?? NaN,
      },
    ],
    asks: [
      {
        price: overrides.askPrice ?? Infinity,
        volume: overrides.askVolume ?? Infinity,
      },
    ],
  };
}

export function createLiquidityHeatmapHarness(options: {
  config?: LiquidityHeatmapConfig;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createLiquidityHeatmapLogger();
  const config = options.config ?? createLiquidityHeatmapConfig();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : createLiquidityHeatmapErrorHandler(logger);
  const service = createLiquidityHeatmapService({
    config,
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });
  const createService = (
    serviceOptions: {
      config?: LiquidityHeatmapConfig;
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
      withErrorHandler?: boolean;
    } = {},
  ) =>
    createLiquidityHeatmapService({
      config,
      logger,
      errorHandler,
      withErrorHandler: options.withErrorHandler,
      ...serviceOptions,
    });

  return {
    service,
    logger,
    errorHandler,
    config,
    createService,
  };
}

export function createLiquidityHeatmapErrorHandler(
  logger: LoggerService = createLiquidityHeatmapLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createLiquidityHeatmapService(options: {
  config?: LiquidityHeatmapConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createLiquidityHeatmapLogger();
  const config =
    Object.prototype.hasOwnProperty.call(options, 'config')
      ? options.config
      : createLiquidityHeatmapConfig();

  return new LiquidityHeatmapService(
    config as LiquidityHeatmapConfig,
    undefined,
    logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}
