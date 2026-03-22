import { BotEventEmitter } from '../../bot-event-emitter';
import { BotEventBus } from '../../services/event-bus';
import { LoggerService, PositionSide } from '../../types/legacy';
import type { Position, StopLossConfig, TakeProfit } from '../../types/legacy';

export function createBotEventEmitterMockLogger(): Partial<LoggerService> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

export function createBotEventEmitterStopLoss(price: number): StopLossConfig {
  return {
    price,
    initialPrice: price,
    isBreakeven: false,
    isTrailing: false,
    updatedAt: Date.now(),
  };
}

export function createBotEventEmitterTakeProfits(prices: number[]): TakeProfit[] {
  return prices.map((price, index) => ({
    level: index + 1,
    price,
    percent: 1,
    sizePercent: 100 / prices.length,
    hit: false,
  }));
}

export function createBotEventEmitterPosition(
  overrides: Partial<Position> = {},
): Position {
  return {
    id: 'test-pos',
    symbol: 'BTCUSDT',
    side: PositionSide.LONG,
    quantity: 1,
    entryPrice: 50000,
    leverage: 10,
    marginUsed: 5000,
    stopLoss: createBotEventEmitterStopLoss(49000),
    takeProfits: createBotEventEmitterTakeProfits([51000, 52000]),
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: 'order-1',
    reason: 'TEST',
    status: 'OPEN',
    ...overrides,
  };
}

export function createBotEventEmitterSignal(
  overrides: Record<string, unknown> = {},
): {
  type: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  source: string;
  timestamp: number;
  indicators: unknown[];
} {
  return {
    type: 'LONG_ENTRY',
    direction: 'BUY',
    confidence: 0.75,
    source: 'TEST',
    timestamp: Date.now(),
    indicators: [],
    ...overrides,
  };
}

export function createStartedBotEventEmitterHarness(): {
  logger: LoggerService;
  eventBus: BotEventBus;
  emitter: BotEventEmitter;
} {
  const logger = createBotEventEmitterMockLogger() as LoggerService;
  const eventBus = new BotEventBus(logger);
  const emitter = new BotEventEmitter(eventBus, logger);
  emitter.start();

  return {
    logger,
    eventBus,
    emitter,
  };
}

export interface BotEventEmitterTestContext {
  logger: LoggerService;
  eventBus: BotEventBus;
  emitter: BotEventEmitter;
  createStartedEmitter: () => BotEventEmitter;
  cleanup: () => void;
}

export function createBotEventEmitterTestContext(): BotEventEmitterTestContext {
  const harness = createStartedBotEventEmitterHarness();
  const secondaryEmitters: BotEventEmitter[] = [];

  return {
    logger: harness.logger,
    eventBus: harness.eventBus,
    emitter: harness.emitter,
    createStartedEmitter() {
      const emitter = new BotEventEmitter(harness.eventBus, harness.logger);
      emitter.start();
      secondaryEmitters.push(emitter);
      return emitter;
    },
    cleanup() {
      secondaryEmitters.forEach((extraEmitter) => {
        extraEmitter.stop();
        extraEmitter.removeAllListeners();
      });
      harness.emitter.stop();
      harness.emitter.removeAllListeners();
    },
  };
}
