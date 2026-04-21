import { ErrorHandler } from '../../errors/ErrorHandler';
import { MTFSnapshotGate } from '../../services/mtf-snapshot-gate.service';
import { LoggerService } from '../../services/logger.service';
import { Candle, Signal, SignalDirection, TrendAnalysis } from '../../types/legacy';
import { TrendBias, SignalType } from '../../types/enums';

export function createMockSnapshotLogger(): LoggerService {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
  } as unknown as LoggerService;
}

export function createStartedSnapshotGate(
  logger: LoggerService,
  errorHandler?: ErrorHandler,
): MTFSnapshotGate {
  const gate = new MTFSnapshotGate(logger, errorHandler);
  gate.start();
  return gate;
}

export function createMTFSnapshotGateHarness(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createMockSnapshotLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const trackedGates: MTFSnapshotGate[] = [];

  const createTrackedGate = (
    gateLogger: LoggerService = logger,
    gateErrorHandler: ErrorHandler | undefined = errorHandler,
  ): MTFSnapshotGate => {
    const gate = createStartedSnapshotGate(gateLogger, gateErrorHandler);
    trackedGates.push(gate);
    return gate;
  };

  return {
    logger,
    errorHandler,
    trackedGates,
    gate: createTrackedGate(),
    createTrackedGate,
    cleanupTrackedGates: () => {
      while (trackedGates.length > 0) {
        trackedGates.pop()?.destroy();
      }
    },
  };
}

export type MTFSnapshotGateHarness = ReturnType<typeof createMTFSnapshotGateHarness>;

export type ManagedMTFSnapshotGateContext = MTFSnapshotGateHarness & {
  cleanup: () => void;
};

export type MTFSnapshotGateSuiteState = Pick<
  ManagedMTFSnapshotGateContext,
  'gate' | 'cleanup'
>;

export type MTFSnapshotGateFunctionalSuiteState = Pick<
  ManagedMTFSnapshotGateContext,
  'gate' | 'logger' | 'cleanup'
>;

export type MTFSnapshotGateErrorHandlingState = Pick<
  ManagedMTFSnapshotGateContext,
  'gate' | 'logger' | 'createTrackedGate' | 'cleanup'
> & {
  errorHandler: ErrorHandler;
};

export function createManagedMTFSnapshotGateContext(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): ManagedMTFSnapshotGateContext {
  const harness = createMTFSnapshotGateHarness(options);

  return {
    ...harness,
    cleanup: () => {
      harness.cleanupTrackedGates();
      jest.clearAllMocks();
      jest.useRealTimers();
    },
  };
}

export function createSnapshotSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    direction: SignalDirection.LONG,
    type: SignalType.TREND_FOLLOWING,
    confidence: 80,
    price: 1000,
    stopLoss: 990,
    takeProfits: [],
    reason: 'Test',
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createSnapshotCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    open: 1000,
    high: 1010,
    low: 990,
    close: 1005,
    volume: 1000,
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createSnapshotTrendAnalysis(
  overrides: Partial<TrendAnalysis> = {},
): TrendAnalysis {
  return {
    bias: TrendBias.BULLISH,
    strength: 0.8,
    timeframe: '4h',
    reasoning: [],
    restrictedDirections: [],
    ...overrides,
  } as TrendAnalysis;
}
