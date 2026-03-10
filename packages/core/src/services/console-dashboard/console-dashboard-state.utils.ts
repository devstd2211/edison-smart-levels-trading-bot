export type DashboardMetricSnapshot = {
  timeframe: string;
  trend: string;
  rsi: number;
  ema20?: number;
  ema50?: number;
  atr?: number;
  volume?: number;
};

export type DashboardTpInput = { price?: number; percent: number; level?: number };
export type DashboardTpLevel = {
  price: number;
  percent: number;
  level: number;
  reached?: boolean;
};

export type DashboardEvent = { timestamp: Date; type: string; message: string };

type DashboardStateInit = {
  metrics: Map<string, DashboardMetricSnapshot>;
  currentPrice: number;
  priceUpdatedAt: number;
  tpLevels: DashboardTpLevel[];
  dailyWins: number;
  dailyLosses: number;
  dailyPnL: number;
  events: DashboardEvent[];
  lastUpdate: Date;
};

export function createInitialDashboardState(): DashboardStateInit {
  return {
    metrics: new Map(),
    currentPrice: 0,
    priceUpdatedAt: 0,
    tpLevels: [],
    dailyWins: 0,
    dailyLosses: 0,
    dailyPnL: 0,
    events: [],
    lastUpdate: new Date(),
  };
}

export function buildDashboardTakeProfitLevels(levels: DashboardTpInput[]): DashboardTpLevel[] {
  return levels.map((level, index) => ({
    price: level.price || 0,
    percent: level.percent,
    level: level.level ?? index + 1,
    reached: false,
  }));
}

export function appendDashboardEventWithLimit(
  events: DashboardEvent[],
  event: DashboardEvent,
  limit: number,
): void {
  events.push(event);
  if (events.length > limit) {
    events.shift();
  }
}
