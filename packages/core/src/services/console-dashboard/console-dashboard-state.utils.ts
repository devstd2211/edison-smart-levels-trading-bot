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
export type DashboardPositionLike = {
  entryPrice: number;
};

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

export function mergeDashboardMetrics(
  metrics: Map<string, DashboardMetricSnapshot>,
  timeframe: string,
  data: Partial<DashboardMetricSnapshot>,
): void {
  const existing = metrics.get(timeframe) || {
    timeframe,
    trend: 'NEUTRAL',
    rsi: 50,
  };

  metrics.set(timeframe, { ...existing, ...data });
}

export function validateDashboardTimeframe(timeframe: string): void {
  if (typeof timeframe !== 'string' || timeframe.length === 0) {
    throw new Error('Timeframe must be a non-empty string');
  }
}

export function validateDashboardMetricsInput(
  timeframe: string,
  data: Partial<DashboardMetricSnapshot>,
): void {
  validateDashboardTimeframe(timeframe);

  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.rsi !== undefined) {
    if (typeof data.rsi !== 'number' || !Number.isFinite(data.rsi)) {
      throw new Error('RSI must be a finite number');
    }

    if (data.rsi < 0 || data.rsi > 100) {
      throw new Error('RSI must be between 0 and 100');
    }
  }

  if (data.ema20 !== undefined && (typeof data.ema20 !== 'number' || !Number.isFinite(data.ema20))) {
    throw new Error('EMA20 must be a finite number');
  }

  if (data.ema50 !== undefined && (typeof data.ema50 !== 'number' || !Number.isFinite(data.ema50))) {
    throw new Error('EMA50 must be a finite number');
  }

  if (data.atr !== undefined) {
    if (typeof data.atr !== 'number' || !Number.isFinite(data.atr)) {
      throw new Error('ATR must be a finite number');
    }

    if (data.atr < 0) {
      throw new Error('ATR must be non-negative');
    }
  }

  if (data.volume !== undefined) {
    if (typeof data.volume !== 'number' || !Number.isFinite(data.volume)) {
      throw new Error('Volume must be a finite number');
    }

    if (data.volume < 0) {
      throw new Error('Volume must be non-negative');
    }
  }

  if (data.trend !== undefined && !['UPTREND', 'DOWNTREND', 'NEUTRAL'].includes(data.trend)) {
    throw new Error('Trend must be UPTREND, DOWNTREND, or NEUTRAL');
  }
}

export function validateDashboardFiniteNumber(
  value: number,
  fieldName: string,
  options: { allowNegative?: boolean } = {},
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }

  if (!options.allowNegative && value < 0) {
    throw new Error(`${fieldName} must be non-negative`);
  }
}

export function applyDashboardPosition(
  currentEntryPrice: number | undefined,
  position: DashboardPositionLike | undefined,
): { position: DashboardPositionLike | undefined; entryPrice: number | undefined } {
  if (position !== undefined && position !== null) {
    if (typeof position !== 'object') {
      throw new Error('Position must be an object or undefined');
    }

    if (typeof position.entryPrice !== 'number' || !Number.isFinite(position.entryPrice)) {
      throw new Error('Position.entryPrice must be a finite number');
    }
  }

  return {
    position,
    entryPrice: position ? position.entryPrice : currentEntryPrice,
  };
}

export function validateDashboardTakeProfitLevels(levels: DashboardTpInput[]): void {
  if (!Array.isArray(levels)) {
    throw new Error('Levels must be an array');
  }

  if (levels.length === 0) {
    throw new Error('Levels array cannot be empty');
  }

  levels.forEach((level, index) => {
    if (typeof level !== 'object' || level === null) {
      throw new Error(`Level ${index} must be an object`);
    }

    if (typeof level.percent !== 'number' || !Number.isFinite(level.percent)) {
      throw new Error(`Level ${index} percent must be a finite number`);
    }

    if (level.percent < 0 || level.percent > 100) {
      throw new Error(`Level ${index} percent must be between 0 and 100`);
    }

    if (level.price !== undefined) {
      validateDashboardFiniteNumber(level.price, `Level ${index} price`);
    }
  });
}

export function validateDashboardEventInput(type: string, message: string): void {
  if (typeof type !== 'string' || type.length === 0) {
    throw new Error('Event type must be a non-empty string');
  }

  if (typeof message !== 'string' || message.length === 0) {
    throw new Error('Event message must be a non-empty string');
  }
}
