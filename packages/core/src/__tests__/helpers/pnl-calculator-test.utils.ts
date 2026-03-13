import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService, PositionSide } from '../../types/legacy';

export interface PnLTradeInput {
  side: PositionSide;
  entry: number;
  exit: number;
  quantity: number;
}

export interface PartialCloseInput {
  quantity: number;
  exitPrice: number;
}

export const createPnlMockLogger = (): LoggerService =>
  ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as LoggerService;

export const createPnlErrorHandler = (
  logger: LoggerService = createPnlMockLogger(),
): ErrorHandler => new ErrorHandler(logger);

export const createPnlTradeInput = (
  overrides: Partial<PnLTradeInput> = {},
): PnLTradeInput => ({
  side: PositionSide.LONG,
  entry: 1.15,
  exit: 1.16,
  quantity: 50,
  ...overrides,
});

export const createPartialCloseInput = (
  overrides: Partial<PartialCloseInput> = {},
): PartialCloseInput => ({
  quantity: 28.4,
  exitPrice: 1.1676,
  ...overrides,
});

export const createBybitPartialCloseSet = (): PartialCloseInput[] => [
  createPartialCloseInput({ quantity: 28.4, exitPrice: 1.1676 }),
  createPartialCloseInput({ quantity: 28.4, exitPrice: 1.1617 }),
  createPartialCloseInput({ quantity: 28.4, exitPrice: 1.1363 }),
];

export const createBybitTradeValidationSet = () => [
  {
    ...createPnlTradeInput({
      side: PositionSide.SHORT,
      entry: 1.1316,
      exit: 1.1428,
      quantity: 88.4,
    }),
    expectedPnL: -1.1007,
  },
  {
    ...createPnlTradeInput({
      side: PositionSide.SHORT,
      entry: 1.1748,
      exit: 1.1676,
      quantity: 28.4,
    }),
    expectedPnL: 0.1679,
  },
  {
    ...createPnlTradeInput({
      side: PositionSide.SHORT,
      entry: 1.1748,
      exit: 1.1617,
      quantity: 28.4,
    }),
    expectedPnL: 0.3356,
  },
  {
    ...createPnlTradeInput({
      side: PositionSide.SHORT,
      entry: 1.1748,
      exit: 1.1363,
      quantity: 28.4,
    }),
    expectedPnL: 1.0573,
  },
];
