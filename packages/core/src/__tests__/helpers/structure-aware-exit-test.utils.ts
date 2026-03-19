import { ErrorHandler } from '../../errors/ErrorHandler';
import { StructureAwareExitService } from '../../services/structure-aware-exit.service';
import {
  LiquidityZone,
  LoggerService,
  SignalDirection,
  StructureAwareExitConfig,
  SwingPoint,
  SwingPointType,
} from '../../types/legacy';

type StructureAwareExitConfigOverrides = Partial<Omit<StructureAwareExitConfig, 'dynamicTP2' | 'trailingStopAfterTP1'>> & {
  dynamicTP2?: Partial<StructureAwareExitConfig['dynamicTP2']>;
  trailingStopAfterTP1?: Partial<StructureAwareExitConfig['trailingStopAfterTP1']>;
};

type StructureAwareExitHarnessOptions = {
  config?: StructureAwareExitConfig;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
};

export const createStructureAwareExitMockLogger = (
  overrides: Partial<Record<'info' | 'debug' | 'warn' | 'error', jest.Mock>> = {},
): LoggerService =>
  ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  }) as unknown as LoggerService;

export const createStructureAwareExitConfig = (
  overrides: StructureAwareExitConfigOverrides = {},
): StructureAwareExitConfig => {
  const { dynamicTP2, trailingStopAfterTP1, ...rootOverrides } = overrides;

  return {
    enabled: true,
    ...rootOverrides,
    dynamicTP2: {
      enabled: true,
      useSwingPoints: true,
      useLiquidityZones: true,
      useVolumeProfile: true,
      bufferPercent: 0.4,
      minTP2Percent: 2.0,
      maxTP2Percent: 6.0,
      minZoneStrength: 0.6,
      ...dynamicTP2,
    },
    trailingStopAfterTP1: {
      enabled: true,
      trailingDistancePercent: 0.8,
      useBybitNativeTrailing: true,
      ...trailingStopAfterTP1,
    },
  };
};

export const createStructureAwareExitHarness = (
  options: StructureAwareExitHarnessOptions = {},
): {
  service: StructureAwareExitService;
  logger: LoggerService;
  errorHandler?: ErrorHandler;
  config: StructureAwareExitConfig;
  createService: (serviceOptions?: StructureAwareExitHarnessOptions) => StructureAwareExitService;
} => {
  const logger = options.logger ?? createStructureAwareExitMockLogger();
  const config = options.config ?? createStructureAwareExitConfig();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const createService = (
    serviceOptions: StructureAwareExitHarnessOptions = {},
  ) =>
    createStructureAwareExitService({
      config,
      logger,
      errorHandler,
      withErrorHandler: options.withErrorHandler,
      ...serviceOptions,
    });

  return {
    service: createService(),
    logger,
    errorHandler,
    config,
    createService,
  };
};

export const createStructureAwareExitService = (
  options: StructureAwareExitHarnessOptions = {},
): StructureAwareExitService => {
  const logger = options.logger ?? createStructureAwareExitMockLogger();
  const config = options.config ?? createStructureAwareExitConfig();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new StructureAwareExitService(config, logger, errorHandler);
};

export const createStructureAwareSwingPoint = (
  price: number,
  type: SwingPointType,
  timestamp = Date.now(),
): SwingPoint => ({
  price,
  type,
  timestamp,
});

export const createStructureAwareLiquidityZone = (
  price: number,
  type: LiquidityZone['type'] = 'RESISTANCE',
  strength = 0.75,
): LiquidityZone => ({
  price,
  type,
  strength,
  touches: 3,
  lastTouch: Date.now(),
});

export const createStructureAwareVolumeProfile = (
  nodes: Array<{ price: number; volume: number }>,
): { nodes: Array<{ price: number; volume: number }> } => ({
  nodes,
});

export const createStructureAwareFallbackResult = (
  entryPrice: number,
  direction: SignalDirection,
  percent: number,
): number =>
  direction === SignalDirection.LONG
    ? entryPrice * (1 + percent / 100)
    : entryPrice * (1 - percent / 100);

export const createInvalidStructureAwareLevel = (overrides: {
  price?: number;
  type?: 'SWING_POINT' | 'LIQUIDITY_ZONE' | 'VOLUME_HVN';
  strength?: number;
} = {}) => ({
  price: overrides.price ?? NaN,
  type: overrides.type ?? 'SWING_POINT',
  strength: overrides.strength ?? 0.8,
});
