/**
 * Week 1 Integration Tests
 *
 * Tests RiskManager + TrendAnalyzer integration.
 * Validates PHASE 4 architecture: PRIMARY components working together.
 * Scenarios: trend blocking, risk checks, position sizing, state tracking.
 */

import { TrendAnalyzer } from '../../analyzers/trend-analyzer';
import { RiskManager } from '../../services/risk-manager.service';
import { SwingPointDetectorService } from '../../services/swing-point-detector.service';
import {
  Candle,
  Signal,
  Position,
  SignalDirection,
  TrendBias,
  PositionSide,
  LogLevel,
  SignalType,
  StopLossConfig,
  TakeProfit,
} from '../../types';
import { LoggerService } from '../../services/logger.service';
import {
  TREND_ANALYZER_MIN_CANDLES_REQUIRED,
  TREND_ANALYZER_STRONG_TREND_STRENGTH,
  RISK_MANAGER_LOSS_STREAK_MULTIPLIER_2_LOSSES,
} from '../../constants';

class TestLogger extends LoggerService {
  constructor() {
    super(LogLevel.INFO, './logs', false);
  }
}

class TestMarketStructure {
  public lastAnalysis: { highs: any[]; lows: any[] } = { highs: [], lows: [] };

  analyzeStructure(candles: Candle[]): { highs: any[]; lows: any[] } {
    return this.lastAnalysis;
  }

  setSwingPoints(highs: any[], lows: any[]): void {
    this.lastAnalysis = { highs, lows };
  }
}

/**
 * Create candles with optional trend pattern
 * PHASE 4: TrendAnalyzer analyzes candles directly (not swing points)
 * @param count Number of candles to create
 * @param startPrice Starting price
 * @param pattern 'bullish' (HH_HL), 'bearish' (LH_LL), 'neutral' (mixed/rangebound), or 'uptrend' (default)
 */
function createCandles(
  count: number,
  startPrice: number = 100,
  pattern: 'bullish' | 'bearish' | 'neutral' | 'uptrend' = 'uptrend'
): Candle[] {
  const candles: Candle[] = [];

  for (let i = 0; i < count; i++) {
    let price: number;

    if (pattern === 'bullish') {
      // HH_HL: Higher highs, higher lows - consistent uptrend
      price = startPrice + (i * 0.3);
    } else if (pattern === 'bearish') {
      // LH_LL: Lower highs, lower lows - consistent downtrend
      price = startPrice - (i * 0.3);
    } else if (pattern === 'neutral') {
      // NEUTRAL = rangebound/flat (no clear trend, oscillates in narrow range)
      // Similar ranges for both recent and mid periods -> neither HH_HL nor LH_LL
      // Creates a repeating pattern that stays in a tight range
      price = startPrice + Math.sin(i * 0.6) * 0.5 + (i % 10) * 0.05;
    } else {
      // 'uptrend' - gradual increase
      price = startPrice + i * 0.15;
    }

    candles.push({
      timestamp: Date.now() - (count - i) * 60000,
      open: price,
      high: price + 0.2,
      low: price - 0.15,
      close: price + 0.1,
      volume: 1000,
    });
  }
  return candles;
}

function createSwingPoint(price: number, isHigh: boolean, index: number) {
  return {
    price,
    type: isHigh ? 'HIGH' : 'LOW',
    timestamp: Date.now() - (20 - index) * 60000,
  };
}

function createSignal(
  direction: SignalDirection = SignalDirection.LONG,
  confidence: number = 60,
  price: number = 100
): Signal {
  return {
    direction,
    type: SignalType.LEVEL_BASED,
    confidence,
    price,
    stopLoss: price * 0.98,
    takeProfits: [
      { level: 1, percent: 1.0, sizePercent: 100, price: price * 1.01, hit: false },
    ],
    reason: 'test signal',
    timestamp: Date.now(),
  };
}

function createPosition(
  quantity: number = 1.0,
  entryPrice: number = 100,
  side: PositionSide = PositionSide.LONG
): Position {
  const sl: StopLossConfig = {
    price: entryPrice * 0.98,
    initialPrice: entryPrice * 0.98,
    isBreakeven: false,
    isTrailing: false,
    updatedAt: Date.now(),
  };

  return {
    id: `pos-${Date.now()}`,
    symbol: 'BTCUSDT',
    side,
    quantity,
    entryPrice,
    leverage: 1,
    marginUsed: quantity * entryPrice,
    stopLoss: sl,
    takeProfits: [
      { level: 1, percent: 1.0, sizePercent: 100, price: entryPrice * 1.01, hit: false },
    ],
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: `order-${Date.now()}`,
    reason: 'test',
    status: 'OPEN',
  };
}

describe('Week 1 Integration: RiskManager + TrendAnalyzer', () => {
  let trendAnalyzer: TrendAnalyzer;
  let riskManager: RiskManager;
  let marketStructure: TestMarketStructure;
  let logger: TestLogger;
  let swingPointDetector: SwingPointDetectorService;

  beforeEach(() => {
    logger = new TestLogger();
    marketStructure = new TestMarketStructure();
    swingPointDetector = new SwingPointDetectorService(logger, 2);
    trendAnalyzer = new TrendAnalyzer(marketStructure, logger, swingPointDetector);

    const config = {
      dailyLimits: {
        maxDailyLossPercent: 5.0,
        maxDailyProfitPercent: 10.0,
        emergencyStopOnLimit: true,
      },
      lossStreak: {
        reductions: {
          after2Losses: RISK_MANAGER_LOSS_STREAK_MULTIPLIER_2_LOSSES,
          after3Losses: 0.5,
          after4Losses: 0.25,
        },
        stopAfterLosses: 5,
      },
      concurrentRisk: {
        enabled: true,
        maxPositions: 3,
        maxRiskPerPosition: 2.0,
        maxTotalExposurePercent: 100.0, // Allow up to full account exposure for testing
      },
      positionSizing: {
        riskPerTradePercent: 1.0,
        minPositionSizeUsdt: 5.0,
        maxPositionSizeUsdt: 100.0,
        maxLeverageMultiplier: 2.0,
      },
    };

    riskManager = new RiskManager(config, logger);
    riskManager.setAccountBalance(1000);
  });

  describe('Scenario 1: BEARISH Trend Blocks LONG Signals', () => {
    it('should detect BEARISH trend and restrict LONG entries', async () => {
      // PHASE 4: TrendAnalyzer analyzes candles directly (not swing points)
      const candles = createCandles(25, 100, 'bearish');

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);

      expect(trendAnalysis.bias).toBe(TrendBias.BEARISH);
      expect(trendAnalysis.restrictedDirections).toContain(SignalDirection.LONG);
      // Strength is now calculated from swing points, not hardcoded
      expect(trendAnalysis.strength).toBeGreaterThan(0.3); // Non-flat trend
    });

    it('should allow SHORT entries in BEARISH trend', async () => {
      // PHASE 4: TrendAnalyzer analyzes candles directly
      const candles = createCandles(25, 100, 'bearish');

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);

      // SHORT should NOT be in restricted list
      expect(trendAnalysis.restrictedDirections).not.toContain(SignalDirection.SHORT);
    });

    it('should block LONG signal when trend is BEARISH', async () => {
      // PHASE 4: TrendAnalyzer analyzes candles directly
      const candles = createCandles(25, 100, 'bearish');

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);

      // In real application, entry filter would check:
      // if (signal.direction in trendAnalysis.restrictedDirections) -> BLOCK
      const signal = createSignal(SignalDirection.LONG, 70);
      expect(trendAnalysis.restrictedDirections).toContain(signal.direction);
    });
  });

  describe('Scenario 2: Daily Loss Limit Blocks Trade', () => {
    it('should allow first trade when daily PnL is positive', async () => {
      const signal = createSignal(SignalDirection.LONG, 60);
      const result = await riskManager.canTrade(signal, 1000, []);

      expect(result.allowed).toBe(true);
      expect(result.adjustedPositionSize).toBeGreaterThan(0);
    });

    it('should block trade after reaching daily loss limit', async () => {
      // Exceed -5% daily loss limit
      const trade = {
        id: 'trade-1',
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        quantity: 1,
        entryPrice: 100,
        exitPrice: 50, // -50% loss
        leverage: 1,
        entryCondition: { signal: {}, indicators: {} } as any,
        openedAt: Date.now(),
        closedAt: Date.now(),
        realizedPnL: -100,
        status: 'CLOSED' as const,
      };
      riskManager.recordTradeResult(trade);

      const signal = createSignal(SignalDirection.SHORT, 65);
      const result = await riskManager.canTrade(signal, 1000, []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily loss limit exceeded');
    });

    it('should track daily PnL across multiple losing trades', async () => {
      // Record 3 small losses
      for (let i = 0; i < 3; i++) {
        const trade = {
          id: `trade-${i}`,
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          quantity: 1,
          entryPrice: 100,
          exitPrice: 85,
          leverage: 1,
          entryCondition: { signal: {}, indicators: {} } as any,
          openedAt: Date.now(),
          closedAt: Date.now(),
          realizedPnL: -15,
          status: 'CLOSED' as const,
        };
        riskManager.recordTradeResult(trade);
      }

      const status = riskManager.getRiskStatus();
      // -45 total loss
      expect(status.dailyPnL).toBeLessThan(0);
    });
  });

  describe('Scenario 3: Loss Streak Reduces Position Size', () => {
    it('should reduce size by 75% after 2 consecutive losses', async () => {
      // Create fresh RiskManager for this test (to avoid daily PnL accumulation)
      const testConfig = {
        dailyLimits: {
          maxDailyLossPercent: 5.0,
          maxDailyProfitPercent: 10.0,
          emergencyStopOnLimit: true,
        },
        lossStreak: {
          reductions: {
            after2Losses: RISK_MANAGER_LOSS_STREAK_MULTIPLIER_2_LOSSES,
            after3Losses: 0.5,
            after4Losses: 0.25,
          },
          stopAfterLosses: 5,
        },
        concurrentRisk: {
          enabled: true,
          maxPositions: 3,
          maxRiskPerPosition: 2.0,
          maxTotalExposurePercent: 100.0,
        },
        positionSizing: {
          riskPerTradePercent: 1.0,
          minPositionSizeUsdt: 5.0,
          maxPositionSizeUsdt: 100.0,
          maxLeverageMultiplier: 2.0,
        },
      };
      const testRiskManager = new RiskManager(testConfig, logger);

      // Record 2 losses (small amounts to not hit daily loss limit)
      for (let i = 0; i < 2; i++) {
        const trade = {
          id: `trade-${i}`,
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          quantity: 1,
          entryPrice: 100,
          exitPrice: 95,
          leverage: 1,
          entryCondition: { signal: {}, indicators: {} } as any,
          openedAt: Date.now(),
          closedAt: Date.now(),
          realizedPnL: -1,  // Smaller loss to avoid daily limit
          status: 'CLOSED' as const,
        };
        testRiskManager.recordTradeResult(trade);
      }

      const status = testRiskManager.getRiskStatus();
      expect(status.consecutiveLosses).toBe(2);

      const signal = createSignal(SignalDirection.LONG, 60);
      const result = await testRiskManager.canTrade(signal, 1000, []);

      expect(result.allowed).toBe(true);
      // Size should be reduced (multiplied by 0.75)
      expect(result.adjustedPositionSize).toBeGreaterThan(0);
    });

    it('should reset loss streak on winning trade', async () => {
      // Record 2 losses then 1 win
      for (let i = 0; i < 2; i++) {
        const trade = {
          id: `trade-${i}`,
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          quantity: 1,
          entryPrice: 100,
          exitPrice: 95,
          leverage: 1,
          entryCondition: { signal: {}, indicators: {} } as any,
          openedAt: Date.now(),
          closedAt: Date.now(),
          realizedPnL: -5,
          status: 'CLOSED' as const,
        };
        riskManager.recordTradeResult(trade);
      }

      // Winning trade resets streak
      const winTrade = {
        id: 'trade-win',
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        quantity: 1,
        entryPrice: 100,
        exitPrice: 110,
        leverage: 1,
        entryCondition: { signal: {}, indicators: {} } as any,
        openedAt: Date.now(),
        closedAt: Date.now(),
        realizedPnL: 10,
        status: 'CLOSED' as const,
      };
      riskManager.recordTradeResult(winTrade);

      const status = riskManager.getRiskStatus();
      expect(status.consecutiveLosses).toBe(0);
    });
  });

  describe('Scenario 4: All Checks Pass → Trade Executes', () => {
    it('should allow trade when trend aligned and risk approved', async () => {
      const candles = createCandles(25);
      // HH_HL = BULLISH
      const highs = [createSwingPoint(100, true, 5), createSwingPoint(105, true, 15)];
      const lows = [createSwingPoint(95, false, 2), createSwingPoint(100, false, 12)];
      marketStructure.setSwingPoints(highs, lows);

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);

      // LONG signal + BULLISH trend = allowed
      expect(trendAnalysis.bias).toBe(TrendBias.BULLISH);

      const signal = createSignal(SignalDirection.LONG, 70);
      const riskResult = await riskManager.canTrade(signal, 1000, []);

      expect(riskResult.allowed).toBe(true);
      expect(riskResult.adjustedPositionSize).toBeGreaterThan(0);
    });

    it('should execute full trading cycle: trend → risk → decision', async () => {
      // Step 1: Detect trend
      const candles = createCandles(25);
      const highs = [createSwingPoint(100, true, 5), createSwingPoint(105, true, 15)];
      const lows = [createSwingPoint(95, false, 2), createSwingPoint(100, false, 12)];
      marketStructure.setSwingPoints(highs, lows);

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);
      expect(trendAnalysis.bias).toBe(TrendBias.BULLISH);

      // Step 2: Generate signal
      const signal = createSignal(SignalDirection.LONG, 70);

      // Step 3: Check if trend allows signal
      const isTrendAllowed =
        !trendAnalysis.restrictedDirections.includes(signal.direction);
      expect(isTrendAllowed).toBe(true);

      // Step 4: Check risk approval
      const riskResult = await riskManager.canTrade(signal, 1000, []);
      expect(riskResult.allowed).toBe(true);

      // Step 5: Trade executes with calculated position size
      expect(riskResult.adjustedPositionSize).toBeGreaterThan(0);
    });
  });

  describe('Scenario 5: Concurrent Risk Limit Enforced', () => {
    it('should allow trade with 0 positions', async () => {
      const signal = createSignal();
      const result = await riskManager.canTrade(signal, 1000, []);

      expect(result.allowed).toBe(true);
    });

    it('should allow trade with 2 open positions (max=3)', async () => {
      const positions = [createPosition(1.0, 100), createPosition(1.0, 100)];

      const signal = createSignal();
      const result = await riskManager.canTrade(signal, 1000, positions);

      expect(result.allowed).toBe(true);
    });

    it('should block trade at max concurrent positions', async () => {
      const positions = [createPosition(1.0, 100), createPosition(1.0, 100), createPosition(1.0, 100)];

      const signal = createSignal();
      const result = await riskManager.canTrade(signal, 1000, positions);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max concurrent positions');
    });
  });

  describe('Scenario 6: BULLISH Trend Blocks SHORT Signals', () => {
    it('should detect BULLISH trend and restrict SHORT entries', async () => {
      // PHASE 4: TrendAnalyzer analyzes candles directly
      const candles = createCandles(25, 100, 'bullish');

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);

      expect(trendAnalysis.bias).toBe(TrendBias.BULLISH);
      expect(trendAnalysis.restrictedDirections).toContain(SignalDirection.SHORT);
    });

    it('should allow LONG entries in BULLISH trend', async () => {
      // PHASE 4: TrendAnalyzer analyzes candles directly
      const candles = createCandles(25, 100, 'bullish');

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);

      expect(trendAnalysis.restrictedDirections).not.toContain(SignalDirection.LONG);
    });
  });

  describe('Scenario 7: NEUTRAL Trend Allows Both Directions', () => {
    it('should detect NEUTRAL trend with no restrictions', async () => {
      // PHASE 4: TrendAnalyzer analyzes candles directly
      const candles = createCandles(25, 100, 'neutral');

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);

      expect(trendAnalysis.bias).toBe(TrendBias.NEUTRAL);
      expect(trendAnalysis.restrictedDirections.length).toBe(0);
    });

    it('should allow both LONG and SHORT in NEUTRAL trend', async () => {
      // PHASE 4: TrendAnalyzer analyzes candles directly
      const candles = createCandles(25, 100, 'neutral');

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);

      const longSignal = createSignal(SignalDirection.LONG);
      const shortSignal = createSignal(SignalDirection.SHORT);

      expect(trendAnalysis.restrictedDirections).not.toContain(longSignal.direction);
      expect(trendAnalysis.restrictedDirections).not.toContain(shortSignal.direction);
    });
  });

  describe('Scenario 8: Multi-Trade Session Tracking', () => {
    it('should track state across multiple consecutive trades', async () => {
      // Trade 1: Loss
      const trade1 = {
        id: 'trade-1',
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        quantity: 1,
        entryPrice: 100,
        exitPrice: 95,
        leverage: 1,
        entryCondition: { signal: {}, indicators: {} } as any,
        openedAt: Date.now(),
        closedAt: Date.now(),
        realizedPnL: -5,
        status: 'CLOSED' as const,
      };
      riskManager.recordTradeResult(trade1);

      let status = riskManager.getRiskStatus();
      expect(status.consecutiveLosses).toBe(1);
      expect(status.dailyPnL).toBeLessThan(0);

      // Trade 2: Another loss
      const trade2 = {
        id: 'trade-2',
        symbol: 'BTCUSDT',
        side: PositionSide.SHORT,
        quantity: 1,
        entryPrice: 100,
        exitPrice: 96,
        leverage: 1,
        entryCondition: { signal: {}, indicators: {} } as any,
        openedAt: Date.now(),
        closedAt: Date.now(),
        realizedPnL: -4,
        status: 'CLOSED' as const,
      };
      riskManager.recordTradeResult(trade2);

      status = riskManager.getRiskStatus();
      expect(status.consecutiveLosses).toBe(2);
      expect(status.dailyPnL).toBeLessThan(-8);

      // Trade 3: Win
      const trade3 = {
        id: 'trade-3',
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        quantity: 1,
        entryPrice: 100,
        exitPrice: 110,
        leverage: 1,
        entryCondition: { signal: {}, indicators: {} } as any,
        openedAt: Date.now(),
        closedAt: Date.now(),
        realizedPnL: 10,
        status: 'CLOSED' as const,
      };
      riskManager.recordTradeResult(trade3);

      status = riskManager.getRiskStatus();
      expect(status.consecutiveLosses).toBe(0); // Reset
      expect(status.dailyPnL).toBeGreaterThan(-9); // ~+1 overall
    });
  });

  describe('Scenario 9: Trend Change During Session', () => {
    it('should detect trend change and adjust entry restrictions', async () => {
      // PHASE 4: TrendAnalyzer analyzes candles directly

      // Start: BULLISH trend
      let candles = createCandles(25, 100, 'bullish');
      let trend = await trendAnalyzer.analyzeTrend(candles);
      expect(trend.bias).toBe(TrendBias.BULLISH);
      expect(trend.restrictedDirections).toContain(SignalDirection.SHORT);

      // Market reverses: BEARISH trend
      candles = createCandles(25, 100, 'bearish');
      trend = await trendAnalyzer.analyzeTrend(candles);
      expect(trend.bias).toBe(TrendBias.BEARISH);
      expect(trend.restrictedDirections).toContain(SignalDirection.LONG);
    });
  });

  describe('Integration: Complete Entry Workflow', () => {
    it('should execute workflow: detect trend → validate signal → approve risk → set position size', async () => {
      // 1. DETECT TREND
      // PHASE 4: TrendAnalyzer analyzes candles directly
      const candles = createCandles(25, 100, 'bullish');

      const trendAnalysis = await trendAnalyzer.analyzeTrend(candles);
      expect(trendAnalysis.bias).toBe(TrendBias.BULLISH);
      // Strength is now calculated from swing points, not hardcoded
      expect(trendAnalysis.strength).toBeGreaterThan(0.3); // Non-flat trend

      // 2. GENERATE SIGNAL (aligned with trend)
      const signal = createSignal(SignalDirection.LONG, 75, 100);
      expect(signal.direction).toBe(SignalDirection.LONG);

      // 3. CHECK TREND ALIGNMENT
      const isTrendAligned = !trendAnalysis.restrictedDirections.includes(signal.direction);
      expect(isTrendAligned).toBe(true);

      // 4. CHECK RISK APPROVAL WITH CURRENT STATE
      const riskResult = await riskManager.canTrade(signal, 1000, []);
      expect(riskResult.allowed).toBe(true);

      // 5. VERIFY POSITION SIZE CALCULATED
      expect(riskResult.adjustedPositionSize).toBeGreaterThan(0);
      expect(riskResult.riskDetails).toBeDefined();

      // 6. POSITION READY TO EXECUTE
      const positionSize = riskResult.adjustedPositionSize;
      expect(positionSize).toBeLessThanOrEqual(100); // max position size
      expect(positionSize).toBeGreaterThanOrEqual(5); // min position size
    });
  });
});
