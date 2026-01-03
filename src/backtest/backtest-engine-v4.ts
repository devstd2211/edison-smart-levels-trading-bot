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
  AnalyzerSignal,
  BTCDirection,
} from '../types';
import { LevelBasedStrategy } from '../strategies/level-based.strategy';
import { RSIIndicator } from '../indicators/rsi.indicator';
import { EMAIndicator } from '../indicators/ema.indicator';
import { ATRIndicator } from '../indicators/atr.indicator';
import { ZigZagNRIndicator } from '../indicators/zigzag-nr.indicator';
import { BTCAnalyzer } from '../analyzers/btc.analyzer';
import { AnalyzerRegistry } from '../services/analyzer-registry.service';

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

  // Strategy and Analyzers
  private levelBasedStrategy: LevelBasedStrategy;
  private btcAnalyzer: BTCAnalyzer | null = null;
  private btcCandles1m: Candle[] = [];
  private analyzerRegistry: AnalyzerRegistry;
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

    // Initialize BTC analyzer if enabled
    if (config.config?.btcConfirmation?.enabled) {
      this.btcAnalyzer = new BTCAnalyzer(
        config.config.btcConfirmation,
        this.logger
      );
      this.logger.info('🔗 BTC Confirmation initialized for backtest', {
        symbol: config.config.btcConfirmation.symbol,
        useCorrelation: config.config.btcConfirmation.useCorrelation,
      });
    }

    // Initialize strategy with config
    // Merge levelBased config with risk management (takeProfits is in riskManagement)
    const levelBasedConfig = {
      ...config.config?.strategies?.levelBased,
      takeProfits: config.config?.riskManagement?.takeProfits,
    };
    this.levelBasedStrategy = new LevelBasedStrategy(levelBasedConfig, this.logger);

    // Initialize AnalyzerRegistry for unified signal collection (same as live trading)
    this.analyzerRegistry = new AnalyzerRegistry(this.logger);
    this.logger.info('📊 AnalyzerRegistry initialized for backtest', {
      mode: 'unified-signal-processing',
    });

    // Register BTC_CORRELATION analyzer - enables soft voting based on BTC direction
    if (this.btcAnalyzer) {
      const btcAnalyzerConfig = config.config?.btcConfirmation?.analyzer || {
        weight: 0.12,
        priority: 5,
        minConfidence: 25,
        maxConfidence: 85,
      };

      // Capture references for closure
      const backtestEngine = this;

      this.analyzerRegistry.register('BTC_CORRELATION', {
        name: 'BTC_CORRELATION',
        weight: btcAnalyzerConfig.weight,
        priority: btcAnalyzerConfig.priority,
        enabled: true,
        evaluate: async (data: StrategyMarketData) => {
          try {
            // Use stored BTC candles for analysis
            if (!backtestEngine.btcCandles1m || backtestEngine.btcCandles1m.length === 0) {
              return null;
            }

            // Analyze BTC momentum
            const signalDirection = data.trend === 'BULLISH' ? SignalDirection.LONG : SignalDirection.SHORT;
            const btcAnalysis = backtestEngine.btcAnalyzer!.analyze(backtestEngine.btcCandles1m, signalDirection);

            if (!btcAnalysis || btcAnalysis.direction === 'NEUTRAL') {
              return null;
            }

            // Convert BTC direction to confidence score
            let confidence = btcAnalysis.momentum * 100; // momentum is already 0-1
            const minConfidence = btcAnalyzerConfig.minConfidence ?? 25;
            const maxConfidence = btcAnalyzerConfig.maxConfidence ?? 85;

            backtestEngine.logger.info('🔗 BTC_CORRELATION evaluation', {
              direction: btcAnalysis.direction,
              momentum: btcAnalysis.momentum.toFixed(3),
              confidence: confidence.toFixed(1),
              minConfidence,
              passesMinCheck: confidence >= minConfidence,
            });

            if (confidence < minConfidence) {
              return null;
            }

            confidence = Math.min(confidence, maxConfidence);

            const direction = btcAnalysis.direction === 'UP' ? SignalDirection.LONG : SignalDirection.SHORT;

            return {
              source: 'BTC_CORRELATION',
              direction,
              confidence,
              weight: btcAnalyzerConfig.weight,
              priority: btcAnalyzerConfig.priority,
            };
          } catch (error) {
            backtestEngine.logger.error('BTC_CORRELATION analyzer error', {
              error: error instanceof Error ? error.message : String(error),
            });
            return null;
          }
        },
      });

      this.logger.info('✅ BTC_CORRELATION analyzer registered for backtest', {
        weight: btcAnalyzerConfig.weight,
        priority: btcAnalyzerConfig.priority,
      });
    }
  }

  /**
   * Run backtest on candles
   */
  async run(
    candles1m: Candle[],
    candles5m: Candle[],
    candles15m: Candle[],
    btcCandles1m?: Candle[],
  ): Promise<BacktestResult> {
    // Store BTC candles if provided and BTC confirmation is enabled
    if (btcCandles1m && this.btcAnalyzer) {
      this.btcCandles1m = btcCandles1m;
      this.logger.info('📊 BTC candles loaded for backtest', {
        count: btcCandles1m.length,
        useConfirmation: true,
      });
    }

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
   * Generate entry signal using LevelBasedStrategy + AnalyzerRegistry soft voting
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

      // STEP 1: Evaluate using LevelBasedStrategy
      const strategySignal = await this.levelBasedStrategy.evaluate(marketData);

      // Check if valid signal
      if (!strategySignal || !strategySignal.valid || !strategySignal.signal) {
        return;
      }

      let signal = strategySignal.signal;

      // Validate signal has required fields
      if (!signal.direction) {
        return;
      }

      // STEP 2: Collect signals from AnalyzerRegistry (BTC soft voting)
      const analyzerSignals = await this.analyzerRegistry.collectSignals(marketData);

      // Apply BTC_CORRELATION soft voting if available
      if (analyzerSignals.length > 0) {
        const btcSignal = analyzerSignals.find((s) => s.source === 'BTC_CORRELATION');

        if (btcSignal) {
          // BTC soft voting: adjust confidence based on BTC direction alignment
          const isStrategyLong = signal.direction === SignalDirection.LONG;
          const isBTCLong = btcSignal.direction === SignalDirection.LONG;

          // HARD RULE for LONG: Allow only if BTC LONG or BTC very weak SHORT (<= 30%)
          // Block LONG if BTC is moderately SHORT or strongly SHORT (momentum > 30%)
          if (isStrategyLong && !isBTCLong && btcSignal.confidence > 30) {
            this.logger.info('🚫 LONG blocked - BTC bearish momentum > 30%', {
              btcDir: btcSignal.direction,
              btcMomentum: btcSignal.confidence.toFixed(1),
              reason: 'LONG requires BTC LONG or very weak SHORT (<= 30%)',
            });
            return;
          }

          this.logger.info('🔗 BTC Soft Voting', {
            strategyDir: signal.direction,
            btcDir: btcSignal.direction,
            strategyLong: isStrategyLong,
            btcLong: isBTCLong,
            aligned: isStrategyLong === isBTCLong,
          });

          if (isStrategyLong === isBTCLong) {
            // BTC aligns with strategy: boost confidence (1.10x multiplier = +10%)
            const oldConf = signal.confidence;
            signal.confidence = signal.confidence * 1.10;
            this.logger.info('📈 BTC aligned - boosting confidence +10%', {
              oldConf: oldConf.toFixed(2),
              newConf: signal.confidence.toFixed(2),
              btcConf: btcSignal.confidence.toFixed(2),
            });
          } else {
            // BTC opposes strategy: reduce confidence based on direction
            const oldConf = signal.confidence;
            // SHORT gets -40% penalty (0.60x), LONG gets -25% penalty (0.75x) for better win rate
            const penalty = isStrategyLong ? 0.75 : 0.60;
            signal.confidence = signal.confidence * penalty;
            this.logger.info('📉 BTC opposed - reducing confidence', {
              direction: isStrategyLong ? 'LONG' : 'SHORT',
              penalty: `${(1 - penalty) * 100}%`,
              oldConf: oldConf.toFixed(2),
              newConf: signal.confidence.toFixed(2),
              btcConf: btcSignal.confidence.toFixed(2),
            });
          }
        }
      }

      this.logger.info('✅ Signal after BTC voting', {
        direction: signal.direction,
        confidence: signal.confidence.toFixed(2),
      });

      // STEP 3: Check minimum confidence threshold
      const minConfidence = this.config.config?.strategies?.levelBased?.minConfidenceThreshold || 0.65;
      if (signal.confidence < minConfidence) {
        return;
      }

      // Determine direction and create position
      const isLong = signal.direction === SignalDirection.LONG;
      const entryPrice = currentPrice;

      // Get SL and TP from config
      const stopLossPercent = this.config.config?.riskManagement?.stopLossPercent || 1.5;
      const takeProfits = this.config.config?.riskManagement?.takeProfits || [
        { level: 1, percent: 0.5, closePercent: 70 },
        { level: 2, percent: 1.0, closePercent: 30 }
      ];

      // Calculate SL and TPs
      const sl = isLong
        ? entryPrice * (1 - stopLossPercent / 100)
        : entryPrice * (1 + stopLossPercent / 100);

      const tp1 = isLong
        ? entryPrice * (1 + (takeProfits[0]?.percent || 0.5) / 100)
        : entryPrice * (1 - (takeProfits[0]?.percent || 0.5) / 100);

      const tp2 = isLong
        ? entryPrice * (1 + (takeProfits[1]?.percent || 1.0) / 100)
        : entryPrice * (1 - (takeProfits[1]?.percent || 1.0) / 100);

      const tp3 = isLong
        ? entryPrice * (1 + (takeProfits[2]?.percent || takeProfits[1]?.percent || 1.0) / 100)
        : entryPrice * (1 - (takeProfits[2]?.percent || takeProfits[1]?.percent || 1.0) / 100);

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
