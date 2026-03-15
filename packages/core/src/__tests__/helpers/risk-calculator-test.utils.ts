import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  RiskCalculator,
  RiskCalculationInput,
  TakeProfitConfig,
} from '../../services/risk-calculator.service';
import { LoggerService, SignalDirection } from '../../types/legacy';

export type RiskCalculatorMockLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  minLevel: string;
  logDir: string;
  logToFile: boolean;
  logs: unknown[];
};

type RiskCalculatorHarnessOptions = {
  logger?: RiskCalculatorMockLogger;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
};

export const createRiskCalculatorMockLogger = (): RiskCalculatorMockLogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  minLevel: 'debug',
  logDir: '.logs',
  logToFile: false,
  logs: [],
});

export const createRiskCalculatorTakeProfitConfigs = (
  overrides?: TakeProfitConfig[],
): TakeProfitConfig[] =>
  overrides ?? [
    { level: 1, percent: 0.5, sizePercent: 50 },
    { level: 2, percent: 1.0, sizePercent: 50 },
  ];

export const createRiskCalculationInput = (
  overrides: Partial<RiskCalculationInput> = {},
): RiskCalculationInput => ({
  direction: SignalDirection.LONG,
  entryPrice: 100,
  referenceLevel: 95,
  atrPercent: 1.5,
  slMultiplier: 1.5,
  minSlDistancePercent: 1.0,
  takeProfitConfigs: createRiskCalculatorTakeProfitConfigs(),
  ...overrides,
});

export const createRiskCalculatorHarness = (
  options: RiskCalculatorHarnessOptions = {},
): {
  calculator: RiskCalculator;
  logger: RiskCalculatorMockLogger;
  errorHandler?: ErrorHandler;
  defaultInput: RiskCalculationInput;
} => {
  const logger = options.logger ?? createRiskCalculatorMockLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : options.errorHandler ?? new ErrorHandler(logger as unknown as LoggerService);

  return {
    calculator: createRiskCalculatorService({
      logger,
      withErrorHandler: options.withErrorHandler,
      errorHandler,
    }),
    logger,
    errorHandler,
    defaultInput: createRiskCalculationInput(),
  };
};

export const createRiskCalculatorService = (
  options: RiskCalculatorHarnessOptions = {},
): RiskCalculator => {
  const logger = options.logger ?? createRiskCalculatorMockLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : options.errorHandler ?? new ErrorHandler(logger as unknown as LoggerService);

  return new RiskCalculator(logger as unknown as LoggerService, errorHandler);
};
