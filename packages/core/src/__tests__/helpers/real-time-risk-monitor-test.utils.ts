import { BotEventBus } from '../../services/event-bus';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { RealTimeRiskMonitor } from '../../services/real-time-risk-monitor.service';
import type {
  LoggerService,
  LiveTradingEventType,
  Position,
  RiskMonitoringConfig,
} from '../../types/legacy';
import { PositionSide } from '../../types/legacy';
import type { PositionClosedEventPayload } from '../../types/bot-events';

type PositionClosedHandler = (data: PositionClosedEventPayload) => void;

export type MockRiskMonitorPositionService = {
  getCurrentPosition: jest.Mock;
  getPositionHistory: jest.Mock;
  updatePosition: jest.Mock;
};

export type MockRiskMonitorLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  log: jest.Mock;
};

export type MockRiskMonitorEventBus = {
  publishSync: jest.Mock;
  publish: jest.Mock;
  subscribe: jest.Mock;
  unsubscribe: jest.Mock;
  emitPositionClosed: (payload: PositionClosedEventPayload) => void;
};

export interface RealTimeRiskMonitorHarness {
  monitor: RealTimeRiskMonitor;
  mockPositionService: MockRiskMonitorPositionService;
  mockLogger: MockRiskMonitorLogger;
  mockEventBus: MockRiskMonitorEventBus;
}

export const mockRiskMonitorConfig: RiskMonitoringConfig = {
  enabled: true,
  checkIntervalCandles: 5,
  healthScoreThreshold: 30,
  emergencyCloseOnCritical: true,
};

export function createMockRiskMonitorPosition(
  overrides: Partial<Position> = {},
): Position {
  return {
    id: 'pos-123',
    symbol: 'BTCUSDT',
    side: PositionSide.LONG,
    quantity: 0.1,
    entryPrice: 45000,
    leverage: 10,
    marginUsed: 450,
    unrealizedPnL: 500,
    status: 'OPEN',
    openedAt: Date.now() - 3600000,
    orderId: 'order-123',
    reason: 'test-position',
    takeProfits: [{ level: 1, percent: 0.5, sizePercent: 50, price: 46000, hit: false }],
    stopLoss: {
      price: 44000,
      initialPrice: 44000,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    ...overrides,
  };
}

export function attachMockRiskMonitorPosition(
  harness: Pick<ReturnType<typeof createRealTimeRiskMonitorHarness>, 'mockPositionService'>,
  overrides: Partial<Position> = {},
): Position {
  const position = createMockRiskMonitorPosition(overrides);
  harness.mockPositionService.getCurrentPosition.mockReturnValue(position);
  return position;
}

export function createRiskMonitorDetailedPosition(
  overrides: Partial<Position> = {},
): Position {
  return createMockRiskMonitorPosition({
    id: 'POS-123',
    quantity: 1.0,
    marginUsed: 4500,
    unrealizedPnL: 0,
    openedAt: Date.now() - 3600000,
    orderId: 'ORDER-123',
    reason: 'Test entry',
    takeProfits: [
      {
        level: 1,
        percent: 0.5,
        sizePercent: 50,
        price: 46350,
        hit: false,
      },
      {
        level: 2,
        percent: 1.0,
        sizePercent: 50,
        price: 47700,
        hit: false,
      },
    ],
    stopLoss: {
      price: 44100,
      initialPrice: 44100,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    ...overrides,
  });
}

export function attachRiskMonitorCurrentPosition(
  harness: Pick<ReturnType<typeof createRealTimeRiskMonitorHarness>, 'mockPositionService'>,
  overrides: Partial<Position> = {},
): Position {
  const position = createRiskMonitorDetailedPosition(overrides);
  harness.mockPositionService.getCurrentPosition.mockReturnValue(position);
  return position;
}

export function createMockRiskMonitorPositionService(): MockRiskMonitorPositionService {
  return {
    getCurrentPosition: jest.fn(),
    getPositionHistory: jest.fn().mockReturnValue([]),
    updatePosition: jest.fn(),
  };
}

export function createMockRiskMonitorLogger(): MockRiskMonitorLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  };
}

export function createMockRiskMonitorEventBus(): MockRiskMonitorEventBus {
  let positionClosedHandler: PositionClosedHandler | undefined;

  const eventBus: MockRiskMonitorEventBus = {
    publishSync: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn((eventName: string, handler: PositionClosedHandler) => {
      if (eventName === 'position-closed') {
        positionClosedHandler = handler;
      }

      return () => {
        eventBus.unsubscribe(eventName, handler);
        if (positionClosedHandler === handler) {
          positionClosedHandler = undefined;
        }
      };
    }),
    unsubscribe: jest.fn(),
    emitPositionClosed: (payload: PositionClosedEventPayload) => {
      positionClosedHandler?.(payload);
    },
  };

  return eventBus;
}

export function createRealTimeRiskMonitorHarness(): {
  monitor: RealTimeRiskMonitor;
  mockPositionService: MockRiskMonitorPositionService;
  mockLogger: MockRiskMonitorLogger;
  mockEventBus: MockRiskMonitorEventBus;
} {
  const mockPositionService = createMockRiskMonitorPositionService();
  const mockLogger = createMockRiskMonitorLogger();
  const mockEventBus = createMockRiskMonitorEventBus();

  return {
    monitor: new RealTimeRiskMonitor(
      mockRiskMonitorConfig,
      mockPositionService as unknown as PositionLifecycleService,
      mockLogger as unknown as LoggerService,
      mockEventBus as unknown as BotEventBus,
    ),
    mockPositionService,
    mockLogger,
    mockEventBus,
  };
}

export function createStandardRealTimeRiskMonitorHarness(): RealTimeRiskMonitorHarness {
  return createRealTimeRiskMonitorHarness();
}

export function createStartedRealTimeRiskMonitorHarness(): RealTimeRiskMonitorHarness {
  const harness = createStandardRealTimeRiskMonitorHarness();
  harness.monitor.start();
  return harness;
}

export function createRealTimeRiskMonitorPublishFailure(
  eventType: LiveTradingEventType,
  message: string = 'Event bus failure',
): (event: unknown) => void {
  return (event: unknown) => {
    if ((event as { type?: LiveTradingEventType }).type === eventType) {
      throw new Error(message);
    }
  };
}

export async function seedRiskMonitorHealthScore(
  harness: RealTimeRiskMonitorHarness,
  position: Position = createMockRiskMonitorPosition(),
  currentPrice: number = 46000,
): Promise<Position> {
  harness.mockPositionService.getCurrentPosition.mockReturnValue(position);
  await harness.monitor.calculatePositionHealth(position.id, currentPrice);
  return position;
}

export async function seedRiskMonitorHealthScores(
  harness: RealTimeRiskMonitorHarness,
  entries: Array<{
    position: Position;
    currentPrice: number;
  }>,
): Promise<Position[]> {
  const seeded: Position[] = [];

  for (const entry of entries) {
    harness.mockPositionService.getCurrentPosition.mockReturnValueOnce(entry.position);
    await harness.monitor.calculatePositionHealth(entry.position.id, entry.currentPrice);
    seeded.push(entry.position);
  }

  return seeded;
}

export function invalidateRiskMonitorPosition(
  harness: RealTimeRiskMonitorHarness,
  payload: PositionClosedEventPayload,
): void {
  harness.mockEventBus.emitPositionClosed(payload);
}

export function createRiskMonitorOpenedAtMinutesAgo(minutes: number): number {
  return Date.now() - minutes * 60 * 1000;
}

export function createRiskMonitorOpenedAtHoursAgo(hours: number): number {
  return createRiskMonitorOpenedAtMinutesAgo(hours * 60);
}

export async function seedRiskMonitorCachedHealthScore(
  harness: RealTimeRiskMonitorHarness,
  overrides: Partial<Position> = {},
  currentPrice: number = 46000,
): Promise<{ position: Position; cachedScore: ReturnType<RealTimeRiskMonitor['getLatestHealthScore']> }> {
  const position = attachRiskMonitorCurrentPosition(harness, overrides);
  await harness.monitor.calculatePositionHealth(position.id, currentPrice);
  return {
    position,
    cachedScore: harness.monitor.getLatestHealthScore(position.id),
  };
}

export async function seedRiskMonitorCachedFallbackScore(
  harness: RealTimeRiskMonitorHarness,
  overrides: Partial<Position> = {},
  currentPrice: number = 46000,
): Promise<{
  position: Position;
  initialScore: Awaited<ReturnType<RealTimeRiskMonitor['calculatePositionHealth']>>;
  fallbackScore: Awaited<ReturnType<RealTimeRiskMonitor['calculatePositionHealth']>>;
}> {
  const position = attachMockRiskMonitorPosition(harness, overrides);
  const initialScore = await harness.monitor.calculatePositionHealth(position.id, currentPrice);
  harness.mockPositionService.getCurrentPosition.mockReturnValue(null);
  const fallbackScore = await harness.monitor.calculatePositionHealth(position.id, currentPrice);
  return {
    position,
    initialScore,
    fallbackScore,
  };
}
