/**
 * Backtest Engine
 *
 * Simulates trading on historical data
 * Supports multiple strategies and parameter optimization
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel } from '../src/types';
import { ZigZagIndicator } from '../src/indicators/zigzag.indicator';
import { ATRIndicator } from '../src/indicators/atr.indicator';
import { RSIIndicator } from '../src/indicators/rsi.indicator';
import { EMAIndicator } from '../src/indicators/ema.indicator';
import { Candle, SwingPoint, LevelSnapshot, SignalDirection } from '../src/types';

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
  takerFee: number;          // 0.0006 = 0.06%
  makerFee: number;          // 0.0001 = 0.01%

  // Strategy config
  strategy: {
    maxDistancePercent: number;
    minTouchesRequired: number;
    minTouchesRequiredShort: number;
    minTouchesRequiredLong: number;
    stopLossAtrMultiplier: number;
    stopLossAtrMultiplierLong: number;
    takeProfits: Array<{
      level: number;
      percent: number;
      closePercent: number;
    }>;
  };

  // Indicator periods
  rsiPeriod: number;
  emaPeriod: number;
  atrPeriod: number;
  zigzagLength: number;
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
  holding?: number; // milliseconds
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
  avgHoldingTime: number; // milliseconds
  trades: BacktestTrade[];
  equityCurve: Array<{ time: number; balance: number }>;
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

export class BacktestEngine {
  private config: BacktestConfig;
  private logger: LoggerService;

  // Indicators
  private rsi: RSIIndicator;
  private ema: EMAIndicator;
  private atr: ATRIndicator;
  private zigzag: ZigZagIndicator;

  // State
  private currentPosition: BacktestTrade | null = null;
  private trades: BacktestTrade[] = [];
  private balance: number;
  private equityCurve: Array<{ time: number; balance: number }> = [];
  private peakBalance: number;
  private maxDrawdown: number = 0;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.logger = new LoggerService(LogLevel.ERROR, './logs', false);
    this.balance = config.initialBalance;
    this.peakBalance = config.initialBalance;

    // Initialize indicators
    this.rsi = new RSIIndicator(config.rsiPeriod);
    this.ema = new EMAIndicator(config.emaPeriod);
    this.atr = new ATRIndicator(config.atrPeriod);
    this.zigzag = new ZigZagIndicator(config.zigzagLength);
  }

  /**
   * Run backtest on historical data
   */
  async run(
    candles1m: BacktestCandle[],
    candles5m: BacktestCandle[],
    candles15m: BacktestCandle[],
  ): Promise<BacktestResult> {
    console.log('🚀 Starting backtest...');
    console.log(`📊 Data: ${candles1m.length} 1m candles`);
    console.log(`💰 Initial balance: ${this.config.initialBalance} USDT`);

    // Process each 1m candle
    for (let i = 0; i < candles1m.length; i++) {
      const currentCandle = candles1m[i];

      // Get historical data up to current point
      const historicalCandles5m = this.getHistoricalCandles(candles5m, currentCandle.timestamp, 200);
      const historicalCandles15m = this.getHistoricalCandles(candles15m, currentCandle.timestamp, 200);

      // Check exit conditions if in position
      if (this.currentPosition) {
        this.checkExit(currentCandle, historicalCandles5m);
      }

      // Check entry conditions if not in position
      if (!this.currentPosition && historicalCandles5m.length >= 100) {
        await this.checkEntry(currentCandle, historicalCandles5m, historicalCandles15m);
      }

      // Update equity curve every 1000 candles
      if (i % 1000 === 0) {
        this.equityCurve.push({
          time: currentCandle.timestamp,
          balance: this.balance,
        });
      }
    }

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
   * Check entry conditions
   */
  private async checkEntry(
    currentCandle: BacktestCandle,
    historicalCandles5m: Candle[],
    historicalCandles15m: Candle[],
  ): Promise<void> {
    if (historicalCandles5m.length < 50) return;

    try {
      // Calculate indicators
      const rsiValue = this.rsi.calculate(historicalCandles5m);
      const emaValue = this.ema.calculate(historicalCandles5m);
      const atrValue = this.atr.calculate(historicalCandles5m);

      // Find swing points
      const swingHighs = this.zigzag.findSwingHighs(historicalCandles5m);
      const swingLows = this.zigzag.findSwingLows(historicalCandles5m);

      // Detect levels
      const resistanceLevels = this.detectLevels(swingHighs);
      const supportLevels = this.detectLevels(swingLows);

      // Check for level-based signals
      const currentPrice = currentCandle.close;

      // SHORT signal: price near resistance, RSI > 55 (relaxed)
      const nearResistance = this.findNearestLevel(resistanceLevels, currentPrice);
      if (nearResistance && rsiValue > 55) {
        const distance = Math.abs(currentPrice - nearResistance.price) / currentPrice;
        if (distance <= this.config.strategy.maxDistancePercent / 100) {
          if (nearResistance.touches >= this.config.strategy.minTouchesRequiredShort) {
            this.openPosition(
              currentCandle,
              SignalDirection.SHORT,
              nearResistance.price,
              atrValue,
            );
          }
        }
      }

      // LONG signal: price near support, RSI < 45 (relaxed)
      const nearSupport = this.findNearestLevel(supportLevels, currentPrice);
      if (nearSupport && rsiValue < 45) {
        const distance = Math.abs(currentPrice - nearSupport.price) / currentPrice;
        if (distance <= this.config.strategy.maxDistancePercent / 100) {
          if (nearSupport.touches >= this.config.strategy.minTouchesRequiredLong) {
            this.openPosition(
              currentCandle,
              SignalDirection.LONG,
              nearSupport.price,
              atrValue,
            );
          }
        }
      }
    } catch (error) {
      // Skip on indicator calculation errors
    }
  }

  /**
   * Detect levels from swing points
   */
  private detectLevels(swingPoints: SwingPoint[]): Array<{ price: number; touches: number }> {
    if (swingPoints.length < 2) return [];

    const CLUSTER_PERCENT = 0.003; // 0.3% clustering
    const levels: Array<{ price: number; touches: number }> = [];

    for (const point of swingPoints) {
      // Find existing level within cluster distance
      const existingLevel = levels.find((level) => {
        const distance = Math.abs(level.price - point.price) / level.price;
        return distance <= CLUSTER_PERCENT;
      });

      if (existingLevel) {
        existingLevel.touches += 1;
        // Update price to average
        existingLevel.price = (existingLevel.price * (existingLevel.touches - 1) + point.price) / existingLevel.touches;
      } else {
        levels.push({ price: point.price, touches: 1 });
      }
    }

    return levels.filter((l) => l.touches >= 2);
  }

  /**
   * Find nearest level to price
   */
  private findNearestLevel(
    levels: Array<{ price: number; touches: number }>,
    price: number,
  ): { price: number; touches: number } | null {
    if (levels.length === 0) return null;

    let nearest = levels[0];
    let minDistance = Math.abs(nearest.price - price);

    for (const level of levels) {
      const distance = Math.abs(level.price - price);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = level;
      }
    }

    return nearest;
  }

  /**
   * Open position
   */
  private openPosition(
    candle: BacktestCandle,
    direction: SignalDirection,
    levelPrice: number,
    atr: number,
  ): void {
    const entryPrice = candle.close;
    const size = (this.config.positionSizeUsdt * this.config.leverage) / entryPrice;

    // Calculate stop loss
    const slMultiplier =
      direction === SignalDirection.LONG
        ? this.config.strategy.stopLossAtrMultiplierLong
        : this.config.strategy.stopLossAtrMultiplier;
    const stopLoss =
      direction === SignalDirection.LONG
        ? entryPrice - atr * slMultiplier
        : entryPrice + atr * slMultiplier;

    // Calculate take profits
    const takeProfits = this.config.strategy.takeProfits.map((tp) => {
      const priceMove = Math.abs(entryPrice - stopLoss) * tp.percent;
      const tpPrice =
        direction === SignalDirection.LONG
          ? entryPrice + priceMove
          : entryPrice - priceMove;
      return {
        level: tp.level,
        price: tpPrice,
        closePercent: tp.closePercent,
      };
    });

    // Calculate entry fee
    const entryFee = this.config.positionSizeUsdt * this.config.takerFee;
    this.balance -= entryFee;

    this.currentPosition = {
      entryTime: candle.timestamp,
      entryPrice,
      direction,
      size,
      stopLoss,
      takeProfits,
    };
  }

  /**
   * Check exit conditions
   */
  private checkExit(candle: BacktestCandle, historicalCandles: Candle[]): void {
    if (!this.currentPosition) return;

    const position = this.currentPosition;

    // Check stop loss FIRST (always priority)
    // Use worst-case price: LOW for LONG, HIGH for SHORT
    if (position.direction === SignalDirection.LONG) {
      if (candle.low <= position.stopLoss) {
        this.closePosition(candle, position.stopLoss, 'STOP_LOSS');
        return;
      }
    } else {
      // SHORT
      if (candle.high >= position.stopLoss) {
        this.closePosition(candle, position.stopLoss, 'STOP_LOSS');
        return;
      }
    }

    // Check take profits
    // Use best-case price: HIGH for LONG, LOW for SHORT
    for (let i = 0; i < position.takeProfits.length; i++) {
      const tp = position.takeProfits[i];
      let hit = false;

      if (position.direction === SignalDirection.LONG) {
        hit = candle.high >= tp.price;
      } else {
        // SHORT
        hit = candle.low <= tp.price;
      }

      if (hit) {
        // Partial close
        if (tp.closePercent < 100) {
          this.partialClose(candle, tp.price, tp.closePercent, `TP${i + 1}`);
          // Remove this TP
          position.takeProfits.splice(i, 1);
          return;
        } else {
          // Full close
          this.closePosition(candle, tp.price, `TP${i + 1}`);
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

    // Calculate PnL for partial close
    const priceDiff =
      position.direction === SignalDirection.LONG
        ? exitPrice - position.entryPrice
        : position.entryPrice - exitPrice;
    const pnl = (priceDiff / position.entryPrice) * closeSizeUsdt * this.config.leverage;

    // Calculate exit fee
    const exitFee = closeSizeUsdt * this.config.makerFee;

    // Update balance
    this.balance += pnl - exitFee;

    // Record partial trade
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
    });

    // Reduce position size
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

    // Calculate PnL
    const priceDiff =
      position.direction === SignalDirection.LONG
        ? exitPrice - position.entryPrice
        : position.entryPrice - exitPrice;
    const pnl = (priceDiff / position.entryPrice) * this.config.positionSizeUsdt * this.config.leverage;

    // Calculate exit fee
    const exitFee = this.config.positionSizeUsdt * this.config.makerFee;

    // Update balance
    this.balance += pnl - exitFee;

    // Update drawdown
    if (this.balance > this.peakBalance) {
      this.peakBalance = this.balance;
    }
    const drawdown = this.peakBalance - this.balance;
    if (drawdown > this.maxDrawdown) {
      this.maxDrawdown = drawdown;
    }

    // Record trade
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

    // Calculate Sharpe Ratio (simplified)
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
