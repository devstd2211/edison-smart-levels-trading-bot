/**
 * BacktestEngineV4 - PHASE 4 Clean Backtest Engine
 *
 * Real trading bot emulation that:
 * - Uses PHASE 4 12-param config
 * - Works with SQLite data (1m, 5m, 15m candles, orderbook, ticks)
 * - Implements LevelBased strategy from config
 * - Simple state machine for position management
 * - No legacy code, clean PRIMARY layer
 *
 * Replaces: BacktestEngineV2 (1800+ lines with legacy support)
 */

import type {
  Candle,
  StrategyMarketData,
  Signal,
} from '../types';
import {
  PositionSide,
  SignalType,
  SignalDirection,
  TrendBias,
  LoggerService,
} from '../types';
import { LevelBasedStrategy } from '../strategies/level-based.strategy';
import { RSIIndicator } from '../indicators/rsi.indicator';
import { EMAIndicator } from '../indicators/ema.indicator';
import { ATRIndicator } from '../indicators/atr.indicator';
import { ZigZagNRIndicator } from '../indicators/zigzag-nr.indicator';

export interface BacktestConfig {
  symbol: string;
  initialBalance: number;
  positionSizeUsdt: number;
  leverage: number;
  takerFee: number;
  makerFee: number;
  config: any; // PHASE 4 minimal config
}

export interface BacktestResult {
  summary: {
    symbol: string;
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    maxDrawdown: number;
  };
  trades: Array<{
    entryPrice: number;
    exitPrice: number;
    side: string;
    pnl: number;
    pnlPercent: number;
    entryTime: number;
    exitTime: number;
  }>;
  config: BacktestConfig;
}

interface Position {
  side: PositionSide;
  entryPrice: number;
  entryTime: number;
  quantity: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  tp1Hit?: boolean;
  tp2Hit?: boolean;
  tp3Hit?: boolean;
}

/**
 * Real backtest engine that emulates bot trading
 */
export class BacktestEngineV4 {
  private balance: number;
  private maxBalance: number;
  private trades: Array<{
    entryPrice: number;
    exitPrice: number;
    side: PositionSide;
    pnl: number;
    pnlPercent: number;
    entryTime: number;
    exitTime: number;
  }> = [];
  private position: Position | null = null;
  private dailyPnL: number = 0;
  private lastTradeTime: number = 0;

  // Indicators
  private rsiIndicator: RSIIndicator;
  private emaFastIndicator: EMAIndicator;
  private emaSlowIndicator: EMAIndicator;
  private atrIndicator: ATRIndicator;
  private zigzagIndicator: ZigZagNRIndicator;

  // Strategy
  private levelBasedStrategy: LevelBasedStrategy;
  private logger: LoggerService;

  constructor(private config: BacktestConfig) {
    this.balance = config.initialBalance;
    this.maxBalance = config.initialBalance;

    // Initialize logger (LoggerService for backtest)
    this.logger = new LoggerService();

    // Initialize indicators with config periods
    const rsiPeriod = config.config?.indicators?.rsiPeriod || 14;
    const emaPeriodFast = config.config?.indicators?.fastEmaPeriod || 20;
    const emaPeriodSlow = config.config?.indicators?.slowEmaPeriod || 50;
    const atrPeriod = config.config?.indicators?.atrPeriod || 14;
    const zigzagDepth = config.config?.indicators?.zigzagDepth || 12;

    this.rsiIndicator = new RSIIndicator(rsiPeriod);
    this.emaFastIndicator = new EMAIndicator(emaPeriodFast);
    this.emaSlowIndicator = new EMAIndicator(emaPeriodSlow);
    this.atrIndicator = new ATRIndicator(atrPeriod);
    this.zigzagIndicator = new ZigZagNRIndicator(zigzagDepth);

    // Initialize strategy with config
    // Merge levelBased config with risk management (takeProfits is in riskManagement)
    const levelBasedConfig = {
      ...config.config?.strategies?.levelBased,
      takeProfits: config.config?.riskManagement?.takeProfits,
    };
    this.levelBasedStrategy = new LevelBasedStrategy(levelBasedConfig, this.logger);
  }

  /**
   * Run backtest on candles
   */
  async run(
    candles1m: Candle[],
    candles5m: Candle[],
    candles15m: Candle[],
  ): Promise<BacktestResult> {
    // Use 5m candles as primary (most data available)
    const mainCandles = candles5m;

    console.log(`\n🚀 Running backtest on ${mainCandles.length} candles...\n`);

    // Emulate trading on 5m timeframe (need 200 candles for swing point detection)
    for (let i = 200; i < mainCandles.length; i++) {
      const candle = mainCandles[i];
      const currentPrice = candle.close;
      const timestamp = candle.timestamp;

      // STEP 1: Check if position should exit
      if (this.position) {
        this.checkPositionExit(currentPrice, timestamp);
      }

      // STEP 2: Generate entry signal (if no position)
      if (!this.position && i > 200) {
        await this.tryEntry(mainCandles, i, currentPrice, timestamp);
      }

      // Progress logging every 200 candles
      if (i % 200 === 0) {
        console.log(`   📈 Progress: ${((i / mainCandles.length) * 100).toFixed(1)}% | Trades: ${this.trades.length} | Balance: ${this.balance.toFixed(2)}`);
      }
    }

    // Close any open position at end
    if (this.position && mainCandles.length > 0) {
      const lastCandle = mainCandles[mainCandles.length - 1];
      this.closePosition(lastCandle.close, lastCandle.timestamp, 'end-of-backtest');
    }

    return this.generateReport();
  }

  /**
   * Prepare market data for strategy evaluation
   */
  private prepareMarketData(candles: Candle[], currentIndex: number): StrategyMarketData {
    // Extract window for calculations (need at least 200 candles for swing point detection)
    const windowStart = Math.max(0, currentIndex - 200);
    const candleWindow = candles.slice(windowStart, currentIndex + 1);

    // Calculate indicators
    const rsi = this.rsiIndicator.calculate(candleWindow);
    const emaFast = this.emaFastIndicator.calculate(candleWindow);
    const emaSlow = this.emaSlowIndicator.calculate(candleWindow);
    const atr = this.atrIndicator.calculate(candleWindow);

    // Get swing points and combine highs/lows into single array
    const zigzagResult = this.zigzagIndicator.findSwingPoints(candleWindow);
    const swingPoints = [...(zigzagResult.swingHighs || []), ...(zigzagResult.swingLows || [])];

    // Detect trend from EMA and RSI (matches strategy logic)
    const trend = this.detectTrend(emaFast, emaSlow, rsi);

    // Build market data
    const marketData: StrategyMarketData = {
      timestamp: candles[currentIndex].timestamp,
      currentPrice: candles[currentIndex].close,
      candles: candleWindow,
      swingPoints,
      rsi,
      rsiTrend1: undefined,
      ema: { fast: emaFast, slow: emaSlow },
      emaTrend1: undefined,
      atr,
      trend: trend as 'NEUTRAL' | 'BULLISH' | 'BEARISH',
      liquidity: undefined,
      divergence: undefined,
      orderbook: undefined,
      context: null,
      stochastic: undefined,
      bollingerBands: undefined,
      breakoutPrediction: undefined,
      deltaAnalysis: undefined,
      imbalanceAnalysis: undefined,
    };

    return marketData;
  }

  /**
   * Detect trend from EMA and RSI (matches strategy logic)
   * BULLISH: EMA20 > EMA50 AND RSI > 50
   * BEARISH: EMA20 < EMA50 AND RSI < 50
   * NEUTRAL: otherwise
   */
  private detectTrend(emaFast: number, emaSlow: number, rsi: number): string {
    const EMA_UPTREND = emaFast > emaSlow;
    const EMA_DOWNTREND = emaFast < emaSlow;
    const RSI_STRONG = rsi > 50;
    const RSI_WEAK = rsi < 50;

    // Confirmed uptrend: EMA20 > EMA50 AND RSI > 50
    if (EMA_UPTREND && RSI_STRONG) {
      return 'BULLISH';
    }

    // Confirmed downtrend: EMA20 < EMA50 AND RSI < 50
    if (EMA_DOWNTREND && RSI_WEAK) {
      return 'BEARISH';
    }

    // Default to neutral for mixed signals
    return 'NEUTRAL';
  }

  /**
   * Generate entry signal using LevelBasedStrategy
   */
  private async tryEntry(candles: Candle[], currentIndex: number, currentPrice: number, timestamp: number): Promise<void> {
    // Need minimum candles for swing point detection and indicators
    if (currentIndex < 200) return;

    // Risk check: don't trade if balance too low
    if (this.balance < this.config.initialBalance * 0.5) {
      return;
    }

    try {
      // Prepare market data with indicators and swing points
      const marketData = this.prepareMarketData(candles, currentIndex);

      // Evaluate using LevelBasedStrategy
      const strategySignal = await this.levelBasedStrategy.evaluate(marketData);

      // Check if valid signal
      if (!strategySignal || !strategySignal.valid || !strategySignal.signal) {
        return;
      }

      const signal = strategySignal.signal;

      // Validate signal has required fields
      if (!signal.direction) {
        return;
      }

      // Check minimum confidence threshold
      const minConfidence = this.config.config?.strategies?.levelBased?.minConfidenceThreshold || 0.65;
      if (signal.confidence < minConfidence) {
        return;
      }

      // Determine direction and create position
      const isLong = signal.direction === 'LONG';
      const entryPrice = currentPrice;

      // Get SL and TP from config
      const stopLossPercent = this.config.config?.riskManagement?.stopLossPercent || 1.5;
      const takeProfits = this.config.config?.riskManagement?.takeProfits || [
        { level: 1, percent: 2.0, closePercent: 50 },
        { level: 2, percent: 3.0, closePercent: 30 },
        { level: 3, percent: 4.0, closePercent: 20 }
      ];

      // Calculate SL and TPs
      const sl = isLong
        ? entryPrice * (1 - stopLossPercent / 100)
        : entryPrice * (1 + stopLossPercent / 100);

      const tp1 = isLong
        ? entryPrice * (1 + (takeProfits[0]?.percent || 2) / 100)
        : entryPrice * (1 - (takeProfits[0]?.percent || 2) / 100);

      const tp2 = isLong
        ? entryPrice * (1 + (takeProfits[1]?.percent || 3) / 100)
        : entryPrice * (1 - (takeProfits[1]?.percent || 3) / 100);

      const tp3 = isLong
        ? entryPrice * (1 + (takeProfits[2]?.percent || 4) / 100)
        : entryPrice * (1 - (takeProfits[2]?.percent || 4) / 100);

      // Open position
      this.position = {
        side: isLong ? PositionSide.LONG : PositionSide.SHORT,
        entryPrice,
        entryTime: timestamp,
        quantity: this.config.positionSizeUsdt / entryPrice,
        stopLoss: sl,
        takeProfit1: tp1,
        takeProfit2: tp2,
        takeProfit3: tp3,
      };
    } catch (error) {
      // Log but don't fail the backtest
      if (this.logger) {
        const err = error as Error;
        this.logger.error('Error evaluating entry signal', {
          error: err.message,
          stack: err.stack?.split('\n').slice(0, 5).join(' | ')
        });
      }
    }
  }

  /**
   * Check if position should exit
   */
  private checkPositionExit(currentPrice: number, timestamp: number): void {
    if (!this.position) return;

    const isLong = this.position.side === PositionSide.LONG;

    // Check Stop Loss
    if (isLong && currentPrice <= this.position.stopLoss) {
      this.closePosition(this.position.stopLoss, timestamp, 'stop-loss');
      return;
    }

    if (!isLong && currentPrice >= this.position.stopLoss) {
      this.closePosition(this.position.stopLoss, timestamp, 'stop-loss');
      return;
    }

    // Check Take Profits (sell portions)
    if (isLong) {
      if (currentPrice >= this.position.takeProfit3 && !this.position.tp3Hit) {
        this.closePosition(this.position.takeProfit3, timestamp, 'tp3');
      } else if (currentPrice >= this.position.takeProfit2 && !this.position.tp2Hit) {
        this.position.tp2Hit = true;
        // Don't close, just mark
      } else if (currentPrice >= this.position.takeProfit1 && !this.position.tp1Hit) {
        this.position.tp1Hit = true;
        // Don't close, just mark
      }
    } else {
      if (currentPrice <= this.position.takeProfit3 && !this.position.tp3Hit) {
        this.closePosition(this.position.takeProfit3, timestamp, 'tp3');
      } else if (currentPrice <= this.position.takeProfit2 && !this.position.tp2Hit) {
        this.position.tp2Hit = true;
      } else if (currentPrice <= this.position.takeProfit1 && !this.position.tp1Hit) {
        this.position.tp1Hit = true;
      }
    }
  }

  /**
   * Close position and record trade
   */
  private closePosition(exitPrice: number, exitTime: number, reason: string): void {
    if (!this.position) return;

    const isLong = this.position.side === PositionSide.LONG;
    const pnl = isLong
      ? (exitPrice - this.position.entryPrice) * this.position.quantity
      : (this.position.entryPrice - exitPrice) * this.position.quantity;

    const pnlPercent = ((exitPrice - this.position.entryPrice) / this.position.entryPrice) * (isLong ? 1 : -1) * 100;

    // Apply fees
    const totalFees = (this.config.positionSizeUsdt * this.config.takerFee) * 2; // Entry + Exit
    const netPnL = pnl - totalFees;

    this.trades.push({
      entryPrice: this.position.entryPrice,
      exitPrice,
      side: this.position.side,
      pnl: netPnL,
      pnlPercent,
      entryTime: this.position.entryTime,
      exitTime,
    });

    this.balance += netPnL;
    this.dailyPnL += netPnL;
    this.lastTradeTime = exitTime;

    if (this.balance > this.maxBalance) {
      this.maxBalance = this.balance;
    }

    this.position = null;
  }

  /**
   * Generate backtest report
   */
  private generateReport(): BacktestResult {
    const winningTrades = this.trades.filter((t) => t.pnl > 0).length;
    const losingTrades = this.trades.filter((t) => t.pnl < 0).length;
    const totalPnL = this.trades.reduce((sum, t) => sum + t.pnl, 0);
    const avgWin = winningTrades > 0 ? this.trades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / winningTrades : 0;
    const avgLoss =
      losingTrades > 0 ? Math.abs(this.trades.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / losingTrades) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * winningTrades) / (avgLoss * losingTrades) : 0;
    const maxDrawdown = this.calculateMaxDrawdown();

    return {
      summary: {
        symbol: this.config.symbol,
        totalTrades: this.trades.length,
        winRate: this.trades.length > 0 ? (winningTrades / this.trades.length) * 100 : 0,
        totalPnL,
        avgWin,
        avgLoss,
        profitFactor,
        maxDrawdown,
      },
      trades: this.trades,
      config: this.config,
    };
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(): number {
    let maxDrawdown = 0;
    let peak = this.config.initialBalance;

    let runningBalance = this.config.initialBalance;
    for (const trade of this.trades) {
      runningBalance += trade.pnl;
      if (runningBalance > peak) {
        peak = runningBalance;
      }
      const drawdown = ((peak - runningBalance) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }
}
