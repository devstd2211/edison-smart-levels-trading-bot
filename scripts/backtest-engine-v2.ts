/**
 * Backtest Engine V2
 *
 * Uses REAL bot classes for accurate simulation:
 * - LevelBasedStrategy, TrendFollowingStrategy, CounterTrendStrategy
 * - RSIAnalyzer, EMAAnalyzer, ATRIndicator
 * - ZigZagIndicator, LiquidityDetector
 * - StrategyCoordinator
 *
 * LIMITATIONS:
 * - FastEntry NOT supported (requires intra-candle simulation)
 * - SmartBreakeven NOT supported (requires position monitoring)
 * - RetestEntry NOT supported (requires time-based waiting)
 * - Backtest simulates only CLOSED candles (no partial fills)
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel, StrategyMarketData, SignalDirection, Candle, StrategySignal } from '../src/types';
import { LevelBasedStrategy } from '../src/strategies/level-based.strategy';
import { TrendFollowingStrategy } from '../src/strategies/trend-following.strategy';
import { CounterTrendStrategy } from '../src/strategies/counter-trend.strategy';
import { WhaleHunterStrategy } from '../src/strategies/whale-hunter.strategy';
import { RSIIndicator } from '../src/indicators/rsi.indicator';
import { EMAIndicator } from '../src/indicators/ema.indicator';
import { ATRIndicator } from '../src/indicators/atr.indicator';
import { ZigZagIndicator } from '../src/indicators/zigzag.indicator';
import { LiquidityDetector } from '../src/analyzers/liquidity.detector';
import { DivergenceDetector } from '../src/analyzers/divergence.detector';
import { StochasticIndicator } from '../src/indicators/stochastic.indicator';
import { BollingerBandsIndicator } from '../src/indicators/bollinger.indicator';
import { EntryConfirmationManager, PendingEntry } from '../src/services/entry-confirmation.service';
import { ContextAnalyzer } from '../src/analyzers/context.analyzer';
import { EntryScanner } from '../src/analyzers/entry.scanner';
import { CandleProvider } from '../src/providers/candle.provider';
import { TimeframeRole, TradingContext, EntrySignal } from '../src/types';
import { WeightMatrixCalculatorService } from '../src/services/weight-matrix-calculator.service';
import { WhaleDetectorService } from '../src/services/whale-detector.service';
import { OrderBookAnalyzer } from '../src/analyzers/orderbook.analyzer';
import { WallTrackerService } from '../src/services/wall-tracker.service';
import { SqliteDataProvider } from './data-providers/sqlite.provider';

// Scalping Strategies (Phase 1-5)
import { ScalpingMicroWallStrategy } from '../src/strategies/scalping-micro-wall.strategy';
import { ScalpingTickDeltaStrategy } from '../src/strategies/scalping-tick-delta.strategy';
import { ScalpingLadderTpStrategy } from '../src/strategies/scalping-ladder-tp.strategy';
import { ScalpingLimitOrderStrategy } from '../src/strategies/scalping-limit-order.strategy';
import { ScalpingOrderFlowStrategy } from '../src/strategies/scalping-order-flow.strategy';

// Scalping Strategy Services
import { MicroWallDetectorService } from '../src/services/micro-wall-detector.service';
import { TickDeltaAnalyzerService } from '../src/services/tick-delta-analyzer.service';
import { LadderTpManagerService } from '../src/services/ladder-tp-manager.service';
import { LimitOrderExecutorService } from '../src/services/limit-order-executor.service';
import { OrderFlowAnalyzerService } from '../src/services/order-flow-analyzer.service';

// PHASE 4: Risk services consolidated into RiskManager (ARCHIVED to src/archive/phase4-week1/)

// PHASE 6: Multi-Timeframe Services
import { TimeframeValidator } from '../src/utils/timeframe-validator';
import { VWAPIndicator } from '../src/indicators/vwap.indicator';
import { TFAlignmentService } from '../src/services/tf-alignment.service';

// ============================================================================
// MOCK CANDLE PROVIDER FOR BACKTEST
// ============================================================================

class MockCandleProvider {
  private candles1m: Candle[] = [];
  private candles5m: Candle[] = [];
  private candles15m: Candle[] = [];
  private currentTimestamp: number = 0;
  private logger: LoggerService;

  constructor(logger: LoggerService, symbol: string) {
    this.logger = logger;
  }

  setHistoricalData(candles1m: Candle[], candles5m: Candle[], candles15m: Candle[], currentTimestamp: number) {
    this.candles1m = candles1m;
    this.candles5m = candles5m;
    this.candles15m = candles15m;
    this.currentTimestamp = currentTimestamp;
  }

  async getCandles(role: TimeframeRole, limit?: number): Promise<Candle[]> {
    let candles: Candle[];

    switch (role) {
      case TimeframeRole.ENTRY:
        candles = this.candles1m.filter(c => c.timestamp <= this.currentTimestamp);
        break;
      case TimeframeRole.PRIMARY:
        candles = this.candles5m.filter(c => c.timestamp <= this.currentTimestamp);
        break;
      case TimeframeRole.TREND1:
        candles = this.candles15m.filter(c => c.timestamp <= this.currentTimestamp);
        break;
      default:
        candles = [];
    }

    if (limit) {
      return candles.slice(-limit);
    }
    return candles;
  }

  async getCurrentPrice(): Promise<number> {
    const recent = this.candles1m.filter(c => c.timestamp <= this.currentTimestamp);
    return recent.length > 0 ? recent[recent.length - 1].close : 0;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface BacktestCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestConfig {
  symbol: string;
  initialBalance: number;
  positionSizeUsdt: number;
  leverage: number;
  takerFee: number;
  makerFee: number;

  // Real bot config
  config: any; // Full config.json
}

export interface BacktestTrade {
  entryTime: number;
  entryPrice: number;
  direction: SignalDirection;
  size: number;
  stopLoss: number;
  takeProfits: Array<{ level: number; price: number; closePercent: number }>;
  exitTime?: number;
  exitPrice?: number;
  exitReason?: string;
  pnl?: number;
  pnlPercent?: number;
  fees?: number;
  holding?: number;
  confidence?: number;
  strategyName?: string;
}

export interface BacktestResult {
  config: BacktestConfig;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalFees: number;
  netPnl: number;
  netPnlPercent: number;
  winLossRatio: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  avgHoldingTime: number;
  trades: BacktestTrade[];
  equityCurve: Array<{ time: number; balance: number }>;
}

// ============================================================================
// BACKTEST ENGINE V2
// ============================================================================

export class BacktestEngineV2 {
  private config: BacktestConfig;
  private logger: LoggerService;

  // Real bot components (multiple strategies like real bot)
  private strategies: Array<LevelBasedStrategy | TrendFollowingStrategy | CounterTrendStrategy | WhaleHunterStrategy> = [];
  private rsiIndicator: RSIIndicator;
  private emaIndicator: EMAIndicator;
  private atrIndicator: ATRIndicator;
  private zigzagIndicator: ZigZagIndicator;
  private liquidityDetector: LiquidityDetector;
  private divergenceDetector: DivergenceDetector;
  private stochasticIndicator: StochasticIndicator;
  private bollingerIndicator: BollingerBandsIndicator;
  private entryConfirmation: EntryConfirmationManager;
  private wallTracker?: WallTrackerService; // PHASE 4: Wall tracking

  // Context and Entry Scanner (like live bot)
  private candleProvider: MockCandleProvider;
  private contextAnalyzer: ContextAnalyzer;
  private entryScanner: EntryScanner;
  private currentContext: TradingContext | null = null;

  // State
  private currentPosition: BacktestTrade | null = null;
  private currentIndex: number = 0;
  private trades: BacktestTrade[] = [];
  private balance: number;
  private equityCurve: Array<{ time: number; balance: number }> = [];
  private peakBalance: number;
  private maxDrawdown: number = 0;
  private pendingSignals: Map<string, { signal: StrategySignal; marketData: StrategyMarketData; atr: number }> = new Map();
  private weightMatrix: WeightMatrixCalculatorService | null = null;
  private dataProvider: SqliteDataProvider | null = null;

  // PHASE 4: Risk services consolidated into RiskManager (ARCHIVED to src/archive/phase4-week1/)
  private dailyLimitsService: any | null = null; // Consolidated into RiskManager
  private riskBasedSizingService: any | null = null; // Consolidated into RiskManager
  private lossStreakService: any | null = null; // Consolidated into RiskManager
  private maxConcurrentRiskService: any | null = null; // Consolidated into RiskManager

  // PHASE 6: Multi-Timeframe Services
  private vwapIndicator: VWAPIndicator | null = null;
  private tfAlignmentService: TFAlignmentService | null = null;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.logger = new LoggerService(LogLevel.ERROR, './logs', false);
    this.balance = config.initialBalance;
    this.peakBalance = config.initialBalance;

    // Initialize Weight Matrix if enabled
    if (config.config.weightMatrix?.enabled) {
      this.weightMatrix = new WeightMatrixCalculatorService(config.config.weightMatrix, this.logger);
      this.logger.info('✅ Weight Matrix enabled for backtest', {
        minConfidenceToEnter: config.config.weightMatrix.minConfidenceToEnter,
      });
    }

    // Initialize strategies (only if enabled) with Weight Matrix
    console.log('\n🔍 DEBUG BacktestEngineV2 constructor:');
    console.log(`  TrendFollowing enabled: ${config.config.strategies.trendFollowing?.enabled}`);
    console.log(`  LevelBased enabled: ${config.config.strategies.levelBased?.enabled}`);
    console.log(`  CounterTrend enabled: ${config.config.strategies.counterTrend?.enabled}\n`);

    if (config.config.strategies.trendFollowing?.enabled === true) {
      this.strategies.push(
        new TrendFollowingStrategy(config.config.strategies.trendFollowing, this.logger, this.weightMatrix || undefined),
      );
      console.log('  ✅ TrendFollowing strategy registered');
    }
    if (config.config.strategies.levelBased?.enabled === true) {
      this.strategies.push(
        new LevelBasedStrategy(config.config.strategies.levelBased, this.logger, this.weightMatrix || undefined),
      );
      console.log('  ✅ LevelBased strategy registered');
    }
    if (config.config.strategies.counterTrend?.enabled === true) {
      this.strategies.push(
        new CounterTrendStrategy(config.config.strategies.counterTrend, this.logger, this.weightMatrix || undefined),
      );
      console.log('  ✅ CounterTrend strategy registered');
    }

    // Initialize WhaleHunter Strategy (if enabled and orderbook available)
    if (config.config.whaleHunter?.enabled) {
      const whaleDetector = new WhaleDetectorService(config.config.whaleHunter.detector, this.logger);
      const orderbookConfig = {
        enabled: true,
        depth: 50,
        wallThreshold: 0.1,
        imbalanceThreshold: 1.5,
        updateIntervalMs: 5000,
      };
      const orderbookAnalyzer = new OrderBookAnalyzer(orderbookConfig, this.logger);

      // Initialize WallTracker if enabled (PHASE 4)
      if (config.config.wallTracking?.enabled) {
        this.wallTracker = new WallTrackerService(config.config.wallTracking, this.logger);
        this.logger.info('🧱 WallTracker enabled for backtest');
      }

      this.strategies.push(
        new WhaleHunterStrategy(
          {
            ...config.config.whaleHunter,
            sessionBasedSL: config.config.sessionBasedSL,
          },
          whaleDetector,
          orderbookAnalyzer,
          this.logger,
          this.wallTracker // Pass WallTracker (optional)
        )
      );

      this.logger.info('🐋 WhaleHunter enabled for backtest');
    }

    // Initialize Scalping Strategies (Phase 1-5)
    // Note: Scalping strategies require orderbook data
    if (config.config.scalpingMicroWall?.enabled) {
      const microWallDetector = new MicroWallDetectorService(
        config.config.scalpingMicroWall.detector,
        this.logger
      );
      this.strategies.push(
        new ScalpingMicroWallStrategy(
          config.config.scalpingMicroWall,
          microWallDetector,
          this.logger
        )
      );
      console.log('  ✅ ScalpingMicroWall strategy registered');
    }

    if (config.config.scalpingTickDelta?.enabled) {
      const tickDeltaAnalyzer = new TickDeltaAnalyzerService(
        config.config.scalpingTickDelta.analyzer,
        this.logger
      );
      this.strategies.push(
        new ScalpingTickDeltaStrategy(
          config.config.scalpingTickDelta,
          tickDeltaAnalyzer,
          this.logger
        )
      );
      console.log('  ✅ ScalpingTickDelta strategy registered');
    }

    if (config.config.scalpingLadderTp?.enabled) {
      const ladderTpManager = new LadderTpManagerService(
        config.config.scalpingLadderTp.ladderManager,
        this.logger
      );
      // LadderTp is a wrapper - needs base strategy signal
      // For backtest, we'll register it as standalone
      this.strategies.push(
        new ScalpingLadderTpStrategy(
          config.config.scalpingLadderTp,
          ladderTpManager,
          this.logger
        )
      );
      console.log('  ✅ ScalpingLadderTp strategy registered');
    }

    if (config.config.scalpingLimitOrder?.enabled) {
      const limitOrderExecutor = new LimitOrderExecutorService(
        config.config.scalpingLimitOrder.executor,
        this.logger
      );
      this.strategies.push(
        new ScalpingLimitOrderStrategy(
          config.config.scalpingLimitOrder,
          limitOrderExecutor,
          this.logger
        )
      );
      console.log('  ✅ ScalpingLimitOrder strategy registered');
    }

    if (config.config.scalpingOrderFlow?.enabled) {
      const orderFlowAnalyzer = new OrderFlowAnalyzerService(
        config.config.scalpingOrderFlow.analyzer,
        this.logger
      );
      this.strategies.push(
        new ScalpingOrderFlowStrategy(
          config.config.scalpingOrderFlow,
          orderFlowAnalyzer,
          this.logger
        )
      );
      console.log('  ✅ ScalpingOrderFlow strategy registered');
    }

    // DEBUG: Log registered strategies
    console.log(`\n🎯 Registered strategies: ${this.strategies.length}`);
    this.strategies.forEach((s: any, i) => {
      console.log(`  ${i + 1}. ${s.name || s.constructor.name} (priority: ${s.priority || 'N/A'})`);
    });
    console.log('');

    this.rsiIndicator = new RSIIndicator(14);
    this.emaIndicator = new EMAIndicator(9); // Fast EMA
    this.atrIndicator = new ATRIndicator(14);
    // Use same ZigZag depth as strategies (from config)
    const zigzagDepth = config.config.strategies.levelBased.zigzagDepth ?? 12;
    this.zigzagIndicator = new ZigZagIndicator(zigzagDepth);
    this.liquidityDetector = new LiquidityDetector(this.logger);
    this.divergenceDetector = new DivergenceDetector(this.logger);
    this.stochasticIndicator = new StochasticIndicator(14, 3, 3);
    this.bollingerIndicator = new BollingerBandsIndicator(20, 2.0);
    this.entryConfirmation = new EntryConfirmationManager(config.config.entryConfirmation, this.logger);

    // Initialize Context and Entry Scanner (like live bot)
    this.candleProvider = new MockCandleProvider(this.logger, config.symbol);
    this.contextAnalyzer = new ContextAnalyzer(
      config.config.contextConfig || {
        atrPeriod: 14,
        emaPeriod: 50,
        zigzagDepth: 5,
        minimumATR: 0.5,
        maximumATR: 3.0,
        maxEmaDistance: 2.0,
        filteringMode: 'HARD_BLOCK' as any,
      },
      this.candleProvider as any,
      this.logger
    );
    this.entryScanner = new EntryScanner(
      config.config.entryConfig || {
        rsiPeriod: 14,
        fastEmaPeriod: 9,
        slowEmaPeriod: 21,
        zigzagDepth: 5,
        rsiOversold: 30,
        rsiOverbought: 70,
        stopLossPercent: 1.5,
        takeProfits: config.config.strategies.levelBased.takeProfits.map((tp: any) => ({
          level: tp.level,
          percent: tp.percent,
          sizePercent: tp.sizePercent,
        })),
      },
      this.candleProvider as any,
      this.logger
    );

    // ======================================================================
    // PHASE 5: Initialize Risk Management Services
    // ======================================================================
    if (config.config.dailyLimits?.enabled) {
      this.dailyLimitsService = new DailyLimitsService(config.config.dailyLimits, this.logger);
      this.dailyLimitsService.setStartingBalance(config.initialBalance);
      this.logger.info('✅ Daily Limits enabled for backtest', {
        maxLoss: `-${config.config.dailyLimits.maxDailyLossPercent}%`,
        maxProfit: config.config.dailyLimits.maxDailyProfitPercent
          ? `+${config.config.dailyLimits.maxDailyProfitPercent}%`
          : 'disabled',
      });
    }

    if (config.config.riskBasedSizing?.enabled) {
      this.riskBasedSizingService = new RiskBasedSizingService(config.config.riskBasedSizing, this.logger);
      this.logger.info('🎯 Risk-Based Sizing enabled for backtest', {
        riskPercent: config.config.riskBasedSizing.riskPerTradePercent + '%',
      });
    }

    if (config.config.lossStreak?.enabled) {
      this.lossStreakService = new LossStreakService(config.config.lossStreak, this.logger);
      this.logger.info('🔻 Loss Streak enabled for backtest', {
        reductions: config.config.lossStreak.reductions,
        stopAfterLosses: config.config.lossStreak.stopAfterLosses || 'disabled',
      });
    }

    if (config.config.maxConcurrentRisk?.enabled) {
      this.maxConcurrentRiskService = new MaxConcurrentRiskService(config.config.maxConcurrentRisk, this.logger);
      this.logger.info('📊 Max Concurrent Risk enabled for backtest', {
        maxPositions: config.config.maxConcurrentRisk.maxPositions,
        maxTotalExposure: config.config.maxConcurrentRisk.maxTotalExposurePercent + '%',
        maxRiskPerPosition: config.config.maxConcurrentRisk.maxRiskPerPosition + '%',
      });
    }

    // ======================================================================
    // PHASE 6: Initialize Multi-Timeframe Services
    // ======================================================================
    this.vwapIndicator = new VWAPIndicator();
    this.tfAlignmentService = new TFAlignmentService(this.logger);
    this.logger.info('✅ PHASE6 Multi-TF services initialized (VWAP + TF Alignment)');
  }

  /**
   * Run backtest on historical data
   */
  async run(
    candles1m: BacktestCandle[],
    candles5m: BacktestCandle[],
    candles15m: BacktestCandle[],
    dataProvider?: SqliteDataProvider,
  ): Promise<BacktestResult> {
    // Save dataProvider as instance field for orderbook loading
    this.dataProvider = dataProvider || null;

    console.log('🚀 Starting backtest V2 (Real Bot Emulation)...');
    console.log(`📊 Data: ${candles1m.length} 1m candles`);
    console.log(`💰 Initial balance: ${this.config.initialBalance} USDT`);
    if (this.dataProvider) {
      console.log('📚 Orderbook data: ENABLED (SQLite)');
    }

    let progress = 0;
    const progressInterval = Math.floor(candles1m.length / 100);

    // Process each 1m candle
    for (let i = 0; i < candles1m.length; i++) {
      const currentCandle = candles1m[i];

      // Show progress
      if (i % progressInterval === 0) {
        progress = Math.floor((i / candles1m.length) * 100);
        process.stdout.write(`\r⏳ Progress: ${progress}%`);
      }

      // Get historical data up to current point
      const historicalCandles1m = this.getHistoricalCandles(candles1m, currentCandle.timestamp, 200);
      const historicalCandles5m = this.getHistoricalCandles(candles5m, currentCandle.timestamp, 200);
      const historicalCandles15m = this.getHistoricalCandles(candles15m, currentCandle.timestamp, 200);

      // Update CandleProvider (for ContextAnalyzer and EntryScanner)
      this.candleProvider.setHistoricalData(
        historicalCandles1m,
        historicalCandles5m,
        historicalCandles15m,
        currentCandle.timestamp
      );

      // Update Context every candle (like live bot)
      if (historicalCandles5m.length >= 50) {
        this.currentContext = await this.contextAnalyzer.analyze();
      }

      // Debug: Log position status every 500 candles
      if (i % 500 === 0) {
        console.log(`\n[STATUS] Candle ${i} @ ${new Date(currentCandle.timestamp).toISOString()}`);
        console.log(`  Position: ${this.currentPosition ? `OPEN (${this.currentPosition.direction} @ ${this.currentPosition.entryPrice.toFixed(4)})` : 'CLOSED'}`);
        console.log(`  Context valid: ${this.currentContext?.isValidContext ?? 'not initialized'}`);
        console.log(`  Can check entry: ${!this.currentPosition && historicalCandles5m.length >= 100 && historicalCandles15m.length >= 50}`);
      }

      // Check pending confirmations (every candle)
      if (!this.currentPosition) {
        this.checkPendingConfirmations(currentCandle);
      }

      // Check exit conditions if in position
      if (this.currentPosition) {
        this.checkExit(currentCandle, historicalCandles5m, i);
      }

      // Check entry conditions if not in position
      if (!this.currentPosition && historicalCandles5m.length >= 100 && historicalCandles15m.length >= 50) {
        await this.checkEntry(currentCandle, historicalCandles5m, historicalCandles15m, i);
      }

      // Update equity curve every 1000 candles
      if (i % 1000 === 0) {
        this.equityCurve.push({
          time: currentCandle.timestamp,
          balance: this.balance,
        });
      }
    }

    console.log('\r✅ Progress: 100%    ');

    // Close any open position at end
    if (this.currentPosition) {
      const lastCandle = candles1m[candles1m.length - 1];
      this.closePosition(lastCandle, lastCandle.close, 'END_OF_BACKTEST');
    }

    console.log(`✅ Backtest complete! Total trades: ${this.trades.length}`);

    return this.calculateResults();
  }

  /**
   * Get historical candles up to timestamp
   */
  private getHistoricalCandles(
    candles: BacktestCandle[],
    timestamp: number,
    maxCount: number,
  ): Candle[] {
    const filtered = candles.filter((c) => c.timestamp <= timestamp);
    const sliced = filtered.slice(-maxCount);
    return sliced.map((c) => ({
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  /**
   * Check entry conditions using REAL strategy
   */
  private async checkEntry(
    currentCandle: BacktestCandle,
    historicalCandles5m: Candle[],
    historicalCandles15m: Candle[],
    candleIndex: number,
  ): Promise<void> {
    try {
      const currentPrice = currentCandle.close;

      // Calculate RSI (PRIMARY 5m + TREND1 15m)
      const rsi = this.rsiIndicator.calculate(historicalCandles5m);
      const rsiTrend1 = this.rsiIndicator.calculate(historicalCandles15m);

      // Calculate EMA (PRIMARY 5m + TREND1 15m)
      const emaFast = this.emaIndicator.calculate(historicalCandles5m);
      const emaSlowIndicator = new EMAIndicator(21);
      const emaSlow = emaSlowIndicator.calculate(historicalCandles5m);
      const emaFastTrend1Indicator = new EMAIndicator(9);
      const emaFastTrend1 = emaFastTrend1Indicator.calculate(historicalCandles15m);
      const emaSlowTrend1Indicator = new EMAIndicator(21);
      const emaSlowTrend1 = emaSlowTrend1Indicator.calculate(historicalCandles15m);

      // Calculate ATR
      const atr = this.atrIndicator.calculate(historicalCandles5m);

      // Check for undefined indicators (debug)
      if (candleIndex % 5000 === 0) {
        const undefinedIndicators = [];
        if (rsi === undefined || isNaN(rsi)) undefinedIndicators.push('RSI');
        if (rsiTrend1 === undefined || isNaN(rsiTrend1)) undefinedIndicators.push('RSI15m');
        if (emaFast === undefined || isNaN(emaFast)) undefinedIndicators.push('EMA_Fast');
        if (emaSlow === undefined || isNaN(emaSlow)) undefinedIndicators.push('EMA_Slow');
        if (atr === undefined || isNaN(atr)) undefinedIndicators.push('ATR');

        if (undefinedIndicators.length > 0) {
          console.warn(`[WARNING] Candle ${candleIndex}: Undefined indicators: ${undefinedIndicators.join(', ')}`);
          console.warn(`  5m candles available: ${historicalCandles5m.length}, 15m: ${historicalCandles15m.length}`);
        }
      }

      // Find swing points
      const swingHighs = this.zigzagIndicator.findSwingHighs(historicalCandles5m);
      const swingLows = this.zigzagIndicator.findSwingLows(historicalCandles5m);
      const swingPoints = [...swingHighs, ...swingLows].sort((a, b) => a.timestamp - b.timestamp);

      // Detect liquidity (simplified - not critical for strategy)
      const liquidityAnalysis = undefined;

      // Detect divergence (simplified - not critical for strategy)
      const divergence = undefined;

      // Calculate Stochastic
      const stochasticRaw = this.stochasticIndicator.calculate(historicalCandles5m);
      const stochastic = {
        k: stochasticRaw.k,
        d: stochasticRaw.d,
        isOversold: stochasticRaw.k < 20,
        isOverbought: stochasticRaw.k > 80,
      };

      // Calculate Bollinger Bands
      const bollingerRaw = this.bollingerIndicator.calculate(historicalCandles5m);
      const bollingerBands = {
        ...bollingerRaw,
        isSqueeze: bollingerRaw.width < 2, // Simple squeeze detection
      };

      // Determine trend
      const trend = emaFast > emaSlow ? 'BULLISH' : emaFast < emaSlow ? 'BEARISH' : 'NEUTRAL';

      // Debug: Log market data every 500 candles
      if (candleIndex % 500 === 0) {
        console.log(`\n[MARKET DATA] Candle ${candleIndex} @ ${new Date(currentCandle.timestamp).toISOString()}`);
        console.log(`  Price: ${currentPrice.toFixed(4)}`);
        console.log(`  RSI: ${rsi?.toFixed(2) ?? 'undefined'} / RSI15m: ${rsiTrend1?.toFixed(2) ?? 'undefined'}`);
        console.log(`  EMA: fast=${emaFast?.toFixed(4) ?? 'undefined'}, slow=${emaSlow?.toFixed(4) ?? 'undefined'}`);
        console.log(`  EMA15m: fast=${emaFastTrend1?.toFixed(4) ?? 'undefined'}, slow=${emaSlowTrend1?.toFixed(4) ?? 'undefined'}`);
        console.log(`  ATR: ${atr?.toFixed(4) ?? 'undefined'} (${atr ? ((atr / currentPrice) * 100).toFixed(2) : 'undefined'}%)`);
        console.log(`  Swings: ${swingPoints.length} (highs=${swingHighs.length}, lows=${swingLows.length})`);
        console.log(`  Swing details: highs=[${swingHighs.slice(0, 3).map(s => s.price.toFixed(4)).join(', ')}...], lows=[${swingLows.slice(0, 3).map(s => s.price.toFixed(4)).join(', ')}...]`);
        console.log(`  Candles passed to strategies: ${historicalCandles5m.length}`);
        console.log(`  Trend: ${trend}`);
        console.log(`  Stochastic: k=${stochastic.k?.toFixed(2) ?? 'undefined'}, oversold=${stochastic.isOversold}, overbought=${stochastic.isOverbought}`);
        console.log(`  Context: ${this.currentContext ? `valid=${this.currentContext.isValidContext}, blockedBy=[${this.currentContext.blockedBy?.join(', ') ?? 'none'}]` : 'not initialized'}`);
      }

      // PHASE 6: Calculate VWAP
      const vwapValue = this.vwapIndicator ? this.vwapIndicator.calculate(historicalCandles5m) : 0;
      const vwapData = vwapValue > 0 ? {
        value: vwapValue,
        distance: Math.abs(currentPrice - vwapValue),
        distancePercent: ((currentPrice - vwapValue) / vwapValue) * 100,
      } : undefined;

      // PHASE 6: Calculate TF Alignment (for LONG direction as baseline)
      const tfAlignmentResult = this.tfAlignmentService ? this.tfAlignmentService.calculateAlignment(
        'LONG', // Use LONG as default for scoring
        currentPrice,
        {
          entry: { ema20: emaFast },
          primary: { ema20: emaFast, ema50: emaSlow },
          trend1: { ema20: emaFastTrend1, ema50: emaSlowTrend1 },
        }
      ) : undefined;
      const tfAlignmentScore = tfAlignmentResult ? tfAlignmentResult.score : undefined;

      // Build StrategyMarketData (same as real bot)
      const marketData: StrategyMarketData = {
        timestamp: currentCandle.timestamp,
        currentPrice,
        candles: historicalCandles5m,
        swingPoints,
        rsi,
        rsiTrend1,
        ema: { fast: emaFast, slow: emaSlow },
        emaTrend1: { fast: emaFastTrend1, slow: emaSlowTrend1 },
        atr,
        trend,
        liquidity: liquidityAnalysis,
        divergence,
        orderbook: this.dataProvider
          ? (await this.dataProvider.loadOrderbookForCandle(this.config.symbol, currentCandle.timestamp)) || undefined
          : undefined,
        context: {
          trend,
          momentum: rsi > 50 ? 'BULLISH' : 'BEARISH',
          volatility: atr > 0.02 ? 'HIGH' : atr > 0.01 ? 'MEDIUM' : 'LOW',
          timeframe: '5m',
        } as any,
        stochastic,
        bollingerBands,
        breakoutPrediction: undefined,
        // PHASE 6: Multi-Timeframe data
        vwap: vwapData,
        tfAlignmentScore,
      };

      // Update WallTracker with orderbook data (if enabled)
      if (this.wallTracker && marketData.orderbook) {
        const orderbook = marketData.orderbook;

        // Feed bids to WallTracker
        if (orderbook.bids && Array.isArray(orderbook.bids)) {
          for (const bid of orderbook.bids.slice(0, 20)) { // Top 20 bids
            const price = Number(Array.isArray(bid) ? bid[0] : bid.price);
            const size = Number(Array.isArray(bid) ? bid[1] : (bid.size || bid.quantity));
            if (!isNaN(price) && !isNaN(size) && size > 0) {
              this.wallTracker.detectWall(price, size, 'BID');
            }
          }
        }

        // Feed asks to WallTracker
        if (orderbook.asks && Array.isArray(orderbook.asks)) {
          for (const ask of orderbook.asks.slice(0, 20)) { // Top 20 asks
            const price = Number(Array.isArray(ask) ? ask[0] : ask.price);
            const size = Number(Array.isArray(ask) ? ask[1] : (ask.size || ask.quantity));
            if (!isNaN(price) && !isNaN(size) && size > 0) {
              this.wallTracker.detectWall(price, size, 'ASK');
            }
          }
        }
      }

      // Evaluate ALL strategies (like real bot)
      const evaluations: StrategySignal[] = [];
      for (const strategy of this.strategies) {
        const evaluation = await strategy.evaluate(marketData);
        evaluations.push(evaluation);
      }

      // Pick best signal (highest priority, then highest confidence)
      let validSignals = evaluations
        .filter(e => e.valid && e.signal && e.signal.direction !== SignalDirection.HOLD)
        .sort((a, b) => {
          // Sort by priority (lower = higher priority)
          if (a.priority !== b.priority) return a.priority - b.priority;
          // Then by confidence
          return (b.signal?.confidence || 0) - (a.signal?.confidence || 0);
        });

      // Filter by Weight Matrix confidence threshold if enabled
      if (this.weightMatrix && this.config.config.weightMatrix?.enabled) {
        validSignals = validSignals.filter(signal => {
          const confidencePercent = (signal.signal?.confidence || 0) * 100;
          const passesThreshold = this.weightMatrix!.shouldEnter(confidencePercent);
          if (!passesThreshold && candleIndex % 500 === 0) {
            this.logger.debug(`❌ Weight Matrix filtered out signal`, {
              strategy: signal.strategyName,
              confidence: confidencePercent.toFixed(1) + '%',
              required: this.config.config.weightMatrix.minConfidenceToEnter + '%',
            });
          }
          return passesThreshold;
        });
      }

      const bestSignal = validSignals[0];

      // Debug: Log evaluation result every 500 candles
      if (candleIndex % 500 === 0) {
        console.log(`[STRATEGIES] Evaluated=${evaluations.length}, Valid signals=${validSignals.length}`);
        evaluations.forEach(e => {
          const reasonPreview = e.reason ? (e.reason.length > 80 ? e.reason.substring(0, 80) + '...' : e.reason) : 'N/A';
          console.log(`  - ${e.strategyName}: valid=${e.valid}, priority=${e.priority}, reason="${reasonPreview}"`);
        });
      }

      if (bestSignal) {
        const direction = bestSignal.signal!.direction;

        // Check if entry confirmation is enabled for this direction
        if (this.entryConfirmation.isEnabled(direction)) {
          // Add to pending - wait for next candle confirmation
          const pendingId = this.entryConfirmation.addPending({
            symbol: this.config.symbol,
            direction,
            keyLevel: currentPrice, // Use current price as key level
            detectedAt: currentCandle.timestamp,
            signalData: { signal: bestSignal, atr },
          });
          this.pendingSignals.set(pendingId, { signal: bestSignal, marketData, atr });
          console.log(`[SIGNAL PENDING] ${direction} at ${currentPrice}, waiting for confirmation (id: ${pendingId}) - strategy=${bestSignal.strategyName}`);
        } else {
          // Entry confirmation disabled - open immediately
          console.log(`[SIGNAL FOUND] ${direction} at ${currentPrice}, confidence=${bestSignal.signal?.confidence}, strategy=${bestSignal.strategyName}`);
          this.openPosition(
            currentCandle,
            direction,
            currentPrice,
            atr,
            bestSignal.signal!.confidence || 0.5,
            bestSignal.strategyName,
          );
        }
      } else {
        // FALLBACK: Use Entry Scanner (like live bot)
        // Check every 10 candles instead of 100 for more frequent scanning
        if (this.currentContext && candleIndex % 10 === 0) {
          // Debug: Log scanner attempt
          if (candleIndex % 500 === 0) {
            console.log(`[ENTRY SCANNER] Attempting scan at candle ${candleIndex}`);
          }

          const entrySignal: EntrySignal = await this.entryScanner.scan(this.currentContext);

          // Debug: Log scanner result
          if (candleIndex % 500 === 0) {
            console.log(`  Scanner result: shouldEnter=${entrySignal.shouldEnter}, direction=${entrySignal.direction ?? 'N/A'}, confidence=${entrySignal.confidence?.toFixed(2) ?? 'N/A'}, reason="${entrySignal.reason ?? 'N/A'}"`);
          }

          if (entrySignal.shouldEnter) {
            const direction = entrySignal.direction;
            console.log(`[ENTRY SCANNER] ${direction} at ${currentPrice}, confidence=${entrySignal.confidence}, reason=${entrySignal.reason}`);

            // Check if entry confirmation is enabled
            if (this.entryConfirmation.isEnabled(direction)) {
              const pendingId = this.entryConfirmation.addPending({
                symbol: this.config.symbol,
                direction,
                keyLevel: currentPrice,
                detectedAt: currentCandle.timestamp,
                signalData: { entrySignal, atr },
              });
              this.pendingSignals.set(pendingId, { signal: { valid: true, signal: { direction, confidence: entrySignal.confidence }, strategyName: 'EntryScanner' } as any, marketData, atr });
              console.log(`[SCANNER PENDING] ${direction} at ${currentPrice}, waiting for confirmation (id: ${pendingId})`);
            } else {
              this.openPosition(
                currentCandle,
                direction,
                currentPrice,
                atr,
                entrySignal.confidence,
                'EntryScanner',
              );
            }
          }
        } else if (!this.currentContext && candleIndex % 500 === 0) {
          console.log(`[ENTRY SCANNER] Skipped - context not initialized`);
        }
      }
    } catch (error: any) {
      console.error(`\n[ERROR] Candle ${candleIndex} @ ${new Date(currentCandle.timestamp).toISOString()}:`);
      console.error(`  Message: ${error?.message || error}`);
      console.error(`  Stack: ${error?.stack || 'No stack trace'}`);
      console.error(`  Price: ${currentCandle.close.toFixed(4)}`);
      console.error(`  Historical data: 5m=${historicalCandles5m.length}, 15m=${historicalCandles15m.length} candles`);
    }
  }

  /**
   * Check pending entry confirmations on candle close
   */
  private checkPendingConfirmations(currentCandle: BacktestCandle): void {
    const allPending = this.entryConfirmation.getAllPending();

    for (const pending of allPending) {
      const closePrice = currentCandle.close;

      // Check confirmation
      const result = this.entryConfirmation.checkConfirmation(pending.id, closePrice);

      if (result.confirmed) {
        // Confirmation successful - open position
        const signalData = this.pendingSignals.get(pending.id);
        if (signalData) {
          console.log(`[CONFIRMED] ${pending.direction} at ${closePrice} - ${result.reason}`);
          this.openPosition(
            currentCandle,
            pending.direction,
            closePrice,
            signalData.atr,
            signalData.signal.signal?.confidence || 0.5,
            signalData.signal.strategyName,
          );
          this.pendingSignals.delete(pending.id);
        }
      } else {
        // Check if still pending (not removed by checkConfirmation)
        const stillPending = this.entryConfirmation.getAllPending().find(p => p.id === pending.id);
        if (!stillPending) {
          // Confirmation failed or expired - cleanup
          console.log(`[REJECTED] ${pending.direction} - ${result.reason}`);
          this.pendingSignals.delete(pending.id);
        }
      }
    }
  }

  /**
   * Open position
   */
  private openPosition(
    candle: BacktestCandle,
    direction: SignalDirection,
    entryPrice: number,
    atr: number,
    confidence: number,
    strategyName: string,
  ): void {
    // PHASE 5: Check Daily Limits
    if (this.dailyLimitsService) {
      const limitsCheck = this.dailyLimitsService.canTrade();
      if (!limitsCheck.allowed) {
        console.log(`❌ Trade blocked by daily limits: ${limitsCheck.reason}`);
        return;
      }
    }

    // PHASE 5: Check Loss Streak
    if (this.lossStreakService) {
      const streakCheck = this.lossStreakService.canTrade();
      if (!streakCheck.allowed) {
        console.log(`❌ Trade blocked by loss streak: ${streakCheck.reason}`);
        return;
      }
    }

    // Base position size
    let positionSizeUsdt = this.config.positionSizeUsdt;

    // Get SL multipliers from config
    const slMultiplier =
      direction === SignalDirection.LONG
        ? this.config.config.strategies.levelBased.stopLossAtrMultiplierLong
        : this.config.config.strategies.levelBased.stopLossAtrMultiplier;

    // ATR is returned as percentage, convert to price distance
    const atrDistance = entryPrice * (atr / 100) * slMultiplier;

    const stopLoss =
      direction === SignalDirection.LONG
        ? entryPrice - atrDistance
        : entryPrice + atrDistance;

    // PHASE 5: Check Max Concurrent Risk
    if (this.maxConcurrentRiskService) {
      const positionRisk = MaxConcurrentRiskService.calculatePositionRisk(
        signal.symbol,
        direction === SignalDirection.LONG ? 'LONG' : 'SHORT',
        entryPrice,
        stopLoss,
        positionSizeUsdt,
        this.balance
      );
      const riskCheck = this.maxConcurrentRiskService.canOpenPosition(this.balance, positionRisk);
      if (!riskCheck.allowed) {
        console.log(`❌ Trade blocked by max concurrent risk: ${riskCheck.reason}`);
        return;
      }
    }

    // PHASE 5: Apply Risk-Based Sizing (overrides base size)
    if (this.riskBasedSizingService) {
      positionSizeUsdt = this.riskBasedSizingService.calculatePositionSize(
        this.balance,
        entryPrice,
        stopLoss
      );
      console.log(`  🎯 Risk-Based Sizing: ${this.config.positionSizeUsdt.toFixed(2)} → ${positionSizeUsdt.toFixed(2)} USDT`);
    }

    // PHASE 5: Apply Loss Streak multiplier
    if (this.lossStreakService) {
      const multiplier = this.lossStreakService.getSizeMultiplier();
      const originalSize = positionSizeUsdt;
      positionSizeUsdt = positionSizeUsdt * multiplier;
      console.log(`  🔻 Loss Streak (${this.lossStreakService.getConsecutiveLosses()} losses): ${(multiplier * 100).toFixed(0)}% → ${originalSize.toFixed(2)} → ${positionSizeUsdt.toFixed(2)} USDT`);
    }

    const size = (positionSizeUsdt * this.config.leverage) / entryPrice;

    // Calculate take profits
    const takeProfits = this.config.config.strategies.levelBased.takeProfits.map((tp: any) => {
      const priceMove = Math.abs(entryPrice - stopLoss) * tp.percent;
      const tpPrice =
        direction === SignalDirection.LONG
          ? entryPrice + priceMove
          : entryPrice - priceMove;
      return {
        level: tp.level,
        price: tpPrice,
        closePercent: tp.sizePercent,
      };
    });

    // Calculate entry fee (use actual position size, not base size)
    const entryFee = positionSizeUsdt * this.config.takerFee;
    this.balance -= entryFee;

    this.currentPosition = {
      entryTime: candle.timestamp,
      entryPrice,
      direction,
      size,
      stopLoss,
      takeProfits,
      confidence,
      strategyName,
    };

    // PHASE 5: Register position with Max Concurrent Risk
    if (this.maxConcurrentRiskService) {
      const positionRisk = MaxConcurrentRiskService.calculatePositionRisk(
        signal.symbol,
        direction === SignalDirection.LONG ? 'LONG' : 'SHORT',
        entryPrice,
        stopLoss,
        positionSizeUsdt, // Use final position size after all adjustments
        this.balance
      );
      this.maxConcurrentRiskService.addPosition(positionRisk);
    }

    console.log(`\n[POSITION OPENED] ${direction} @ ${entryPrice.toFixed(4)}`);
    console.log(`  ATR: ${atr.toFixed(4)} (${((atr / entryPrice) * 100).toFixed(2)}% of price)`);
    console.log(`  SL multiplier: ${slMultiplier}`);
    console.log(`  SL calculation: ${entryPrice.toFixed(4)} ${direction === SignalDirection.LONG ? '-' : '+'} (${atr.toFixed(4)} * ${slMultiplier}) = ${stopLoss.toFixed(4)}`);
    console.log(`  SL: ${stopLoss.toFixed(4)} (${((Math.abs(stopLoss - entryPrice) / entryPrice) * 100).toFixed(2)}% distance)`);
    console.log(`  TPs: ${takeProfits.map((tp: any, i: number) => `TP${i + 1}=${tp.price.toFixed(4)}`).join(', ')}`);
    console.log(`  Strategy: ${strategyName}, Confidence: ${(confidence * 100).toFixed(0)}%`);
  }

  /**
   * Check exit conditions
   */
  private checkExit(candle: BacktestCandle, historicalCandles: Candle[], candleIndex: number): void {
    if (!this.currentPosition) return;

    const position = this.currentPosition;

    // Debug: Log exit check every 1000 candles
    if (candleIndex % 1000 === 0) {
      console.log(`\n[EXIT CHECK] Candle ${candleIndex} @ price ${candle.close.toFixed(4)} (high=${candle.high.toFixed(4)}, low=${candle.low.toFixed(4)})`);
      console.log(`  Position: ${position.direction} @ ${position.entryPrice.toFixed(4)}`);
      console.log(`  SL: ${position.stopLoss.toFixed(4)} | Current TPs: ${position.takeProfits.map((tp, i) => `TP${i + 1}=${tp.price.toFixed(4)}`).join(', ')}`);
      if (position.direction === SignalDirection.SHORT) {
        console.log(`  SL check: candle.high (${candle.high.toFixed(4)}) >= SL (${position.stopLoss.toFixed(4)}) ? ${candle.high >= position.stopLoss}`);
        console.log(`  TP check: candle.low (${candle.low.toFixed(4)}) <= TP1 (${position.takeProfits[0]?.price?.toFixed(4) ?? 'none'}) ? ${position.takeProfits[0] ? candle.low <= position.takeProfits[0].price : 'no TP'}`);
      } else {
        console.log(`  SL check: candle.low (${candle.low.toFixed(4)}) <= SL (${position.stopLoss.toFixed(4)}) ? ${candle.low <= position.stopLoss}`);
        console.log(`  TP check: candle.high (${candle.high.toFixed(4)}) >= TP1 (${position.takeProfits[0]?.price?.toFixed(4) ?? 'none'}) ? ${position.takeProfits[0] ? candle.high >= position.takeProfits[0].price : 'no TP'}`);
      }
    }

    // Check stop loss FIRST
    if (position.direction === SignalDirection.LONG) {
      if (candle.low <= position.stopLoss) {
        console.log(`\n[STOP LOSS HIT] LONG @ ${candle.low.toFixed(4)} (SL: ${position.stopLoss.toFixed(4)})`);
        this.closePosition(candle, position.stopLoss, 'STOP_LOSS');
        return;
      }
    } else {
      if (candle.high >= position.stopLoss) {
        console.log(`\n[STOP LOSS HIT] SHORT @ ${candle.high.toFixed(4)} (SL: ${position.stopLoss.toFixed(4)})`);
        this.closePosition(candle, position.stopLoss, 'STOP_LOSS');
        return;
      }
    }

    // Check take profits
    for (let i = 0; i < position.takeProfits.length; i++) {
      const tp = position.takeProfits[i];
      let hit = false;

      if (position.direction === SignalDirection.LONG) {
        hit = candle.high >= tp.price;
      } else {
        hit = candle.low <= tp.price;
      }

      if (hit) {
        // Check if this is the LAST TP (should close entire remaining position)
        const isLastTP = position.takeProfits.length === 1;

        if (isLastTP) {
          // Close entire remaining position
          console.log(`[TP${i + 1} HIT - LAST TP] Closing entire remaining position @ ${tp.price.toFixed(4)}`);
          this.closePosition(candle, tp.price, `TP${i + 1}`);
          return;
        } else {
          // Partial close
          console.log(`[TP${i + 1} HIT] Partial close ${tp.closePercent}% @ ${tp.price.toFixed(4)}`);
          this.partialClose(candle, tp.price, tp.closePercent, `TP${i + 1}`);
          position.takeProfits.splice(i, 1);
          return;
        }
      }
    }
  }

  /**
   * Partial close position
   */
  private partialClose(
    candle: BacktestCandle,
    exitPrice: number,
    closePercent: number,
    reason: string,
  ): void {
    if (!this.currentPosition) return;

    const position = this.currentPosition;
    const closeSizeUsdt = this.config.positionSizeUsdt * (closePercent / 100);
    const closeSize = position.size * (closePercent / 100);

    const priceDiff =
      position.direction === SignalDirection.LONG
        ? exitPrice - position.entryPrice
        : position.entryPrice - exitPrice;
    const pnl = (priceDiff / position.entryPrice) * closeSizeUsdt * this.config.leverage;

    const exitFee = closeSizeUsdt * this.config.makerFee;
    this.balance += pnl - exitFee;

    const holding = candle.timestamp - position.entryTime;
    this.trades.push({
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      direction: position.direction,
      size: closeSize,
      stopLoss: position.stopLoss,
      takeProfits: [],
      exitTime: candle.timestamp,
      exitPrice,
      exitReason: reason,
      pnl,
      pnlPercent: (pnl / closeSizeUsdt) * 100,
      fees: exitFee + (this.config.positionSizeUsdt * (closePercent / 100) * this.config.takerFee),
      holding,
      confidence: position.confidence,
      strategyName: position.strategyName
    });

    position.size -= closeSize;
    this.config.positionSizeUsdt *= (100 - closePercent) / 100;
  }

  /**
   * Close position
   */
  private closePosition(
    candle: BacktestCandle,
    exitPrice: number,
    reason: string,
  ): void {
    if (!this.currentPosition) return;

    const position = this.currentPosition;

    const priceDiff =
      position.direction === SignalDirection.LONG
        ? exitPrice - position.entryPrice
        : position.entryPrice - exitPrice;
    const pnl = (priceDiff / position.entryPrice) * this.config.positionSizeUsdt * this.config.leverage;

    const exitFee = this.config.positionSizeUsdt * this.config.makerFee;
    this.balance += pnl - exitFee;

    if (this.balance > this.peakBalance) {
      this.peakBalance = this.balance;
    }
    const drawdown = this.peakBalance - this.balance;
    if (drawdown > this.maxDrawdown) {
      this.maxDrawdown = drawdown;
    }

    const holding = candle.timestamp - position.entryTime;
    this.trades.push({
      ...position,
      exitTime: candle.timestamp,
      exitPrice,
      exitReason: reason,
      pnl,
      pnlPercent: (pnl / this.config.positionSizeUsdt) * 100,
      fees: exitFee + (this.config.positionSizeUsdt * this.config.takerFee),
      holding,
    });

    // PHASE 5: Update Daily Limits
    if (this.dailyLimitsService) {
      this.dailyLimitsService.onTradeClose(pnl, this.balance);
    }

    // PHASE 5: Record trade result for Loss Streak
    if (this.lossStreakService) {
      const isWin = pnl > 0;
      this.lossStreakService.recordTrade(isWin);
    }

    // PHASE 5: Remove position from Max Concurrent Risk
    if (this.maxConcurrentRiskService) {
      this.maxConcurrentRiskService.removePosition(this.config.config.exchange.symbol);
    }

    this.currentPosition = null;
  }

  /**
   * Calculate backtest results
   */
  private calculateResults(): BacktestResult {
    const winners = this.trades.filter((t) => (t.pnl || 0) > 0);
    const losers = this.trades.filter((t) => (t.pnl || 0) <= 0);

    const totalPnl = this.trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalFees = this.trades.reduce((sum, t) => sum + (t.fees || 0), 0);
    const netPnl = this.balance - this.config.initialBalance;

    const winRate = this.trades.length > 0 ? (winners.length / this.trades.length) * 100 : 0;

    const totalWin = winners.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLoss = Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0));

    const avgWin = winners.length > 0 ? totalWin / winners.length : 0;
    const avgLoss = losers.length > 0 ? totalLoss / losers.length : 0;

    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const profitFactor = totalLoss > 0 ? totalWin / totalLoss : 0;

    const avgHoldingTime = this.trades.length > 0
      ? this.trades.reduce((sum, t) => sum + (t.holding || 0), 0) / this.trades.length
      : 0;

    const returns = this.trades.map((t) => (t.pnlPercent || 0) / 100);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length,
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    return {
      config: this.config,
      totalTrades: this.trades.length,
      winningTrades: winners.length,
      losingTrades: losers.length,
      winRate,
      totalPnl,
      totalFees,
      netPnl,
      netPnlPercent: (netPnl / this.config.initialBalance) * 100,
      winLossRatio,
      profitFactor,
      avgWin,
      avgLoss,
      maxDrawdown: this.maxDrawdown,
      maxDrawdownPercent: (this.maxDrawdown / this.config.initialBalance) * 100,
      sharpeRatio,
      avgHoldingTime,
      trades: this.trades,
      equityCurve: this.equityCurve,
    };
  }
}
