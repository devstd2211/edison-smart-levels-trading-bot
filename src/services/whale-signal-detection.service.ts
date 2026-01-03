/**
 * Whale Signal Detection Service (Week 13 Phase 5e Extract)
 *
 * Extracted from trading-orchestrator.service.ts checkWhaleSignalRealtime method
 * Responsible for real-time whale hunter strategy evaluation and signal execution
 *
 * Responsibilities:
 * - Strategy availability verification
 * - Position status checks
 * - Context readiness verification
 * - Lightweight market data preparation for whale detection
 * - Whale strategy evaluation
 * - Signal conversion to EntrySignal format
 * - Trade execution for whale signals
 */

import {
  LoggerService,
  OrderBook,
  EntrySignal,
  TradingContext,
} from '../types';
import { DECIMAL_PLACES } from '../constants';
import { StrategyCoordinator } from './strategy-coordinator.service';
import { PositionManagerService } from './position-manager.service';
import { TradeExecutionService } from './trade-execution.service';
import { MarketDataPreparationService } from './market-data-preparation.service';

/**
 * Whale Signal Detection Service
 * Handles real-time detection and execution of whale hunter signals
 */
export class WhaleSignalDetectionService {
  constructor(
    private strategyCoordinator: StrategyCoordinator,
    private positionManager: PositionManagerService,
    private marketDataPreparationService: MarketDataPreparationService,
    private tradeExecutionService: TradeExecutionService,
    private logger: LoggerService,
  ) {}

  /**
   * Check and execute real-time whale hunter signals
   * Called on orderbook updates to detect whale activity patterns
   * @param orderbook - Current orderbook snapshot
   * @param currentContext - Current trading context (trend, filters, etc.)
   */
  async checkWhaleSignalRealtime(
    orderbook: OrderBook,
    currentContext: TradingContext | null,
  ): Promise<void> {
    try {
      // Skip if no whale hunter strategy registered
      const whaleStrategy = this.findWhaleStrategy();
      if (!whaleStrategy) {
        return; // Whale hunter not enabled
      }

      // Skip if already in position
      if (this.positionManager.getCurrentPosition()) {
        return; // Already in position
      }

      // Skip if context not ready
      if (!currentContext) {
        return; // Context not initialized yet
      }

      // Prepare lightweight market data for whale detection (scalping-optimized)
      // Skips: RSI, EMA, liquidity, divergence - only orderbook + price + context
      const marketData = await this.prepareWhaleMarketData(orderbook, currentContext);
      if (!marketData) {
        return; // Failed to prepare data
      }

      // Evaluate ONLY whale hunter strategies
      const strategySignal = await whaleStrategy.evaluate(marketData);

      // Check if valid signal
      if (strategySignal.valid && strategySignal.signal) {
        this.logger.info('🐋 WHALE SIGNAL DETECTED (real-time)!', {
          strategy: strategySignal.strategyName,
          direction: strategySignal.signal.direction,
          confidence: strategySignal.signal.confidence.toFixed(DECIMAL_PLACES.PERCENT),
          reason: strategySignal.reason,
        });

        // Convert to EntrySignal and execute
        await this.executeWhaleSignal(strategySignal, marketData);
      }
    } catch (error) {
      this.logger.error('Error in real-time whale signal check', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Find whale hunter strategy from coordinator
   * @returns Whale strategy if available, null otherwise
   */
  private findWhaleStrategy(): any {
    const strategies = this.strategyCoordinator.getStrategies();
    return strategies.find(
      s => s.name === 'WHALE_HUNTER' || s.name === 'WHALE_HUNTER_FOLLOW',
    );
  }

  /**
   * Prepare lightweight market data for whale detection
   * Only includes orderbook and price data, skips heavy indicators
   */
  private async prepareWhaleMarketData(
    orderbook: OrderBook,
    currentContext: TradingContext,
  ): Promise<any> {
    try {
      this.marketDataPreparationService.setCurrentContext(currentContext);
      this.marketDataPreparationService.setCurrentOrderbook(orderbook);
      return await this.marketDataPreparationService.prepareMarketDataForWhale();
    } catch (error) {
      this.logger.warn('Failed to prepare whale market data', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Convert strategy signal to EntrySignal and execute trade
   * Whale signals are time-critical, so execution is immediate
   */
  private async executeWhaleSignal(strategySignal: any, marketData: any): Promise<void> {
    try {
      const entrySignal: EntrySignal = {
        shouldEnter: true,
        direction: strategySignal.signal.direction,
        confidence: strategySignal.signal.confidence,
        entryPrice: strategySignal.signal.price,
        stopLoss: strategySignal.signal.stopLoss,
        takeProfits: strategySignal.signal.takeProfits,
        reason: strategySignal.reason || strategySignal.strategyName,
        timestamp: strategySignal.signal.timestamp,
        strategyName: strategySignal.strategyName,
      };

      // Execute trade immediately (whale signals are time-critical!)
      await this.tradeExecutionService.executeTrade(entrySignal, marketData);
    } catch (error) {
      this.logger.error('Failed to execute whale signal', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
