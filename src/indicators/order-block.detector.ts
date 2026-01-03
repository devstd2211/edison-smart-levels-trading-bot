/**
 * Order Block Detector
 *
 * Detects institutional consolidation zones (order blocks) where smart money
 * enters before breakouts. These are areas where price is expected to return
 * and bounce or reject.
 *
 * Smart Money Concepts (SMC) component for identifying smart money entry zones.
 */

import { Candle, OrderBlock, OrderBlockAnalysis, OrderBlockConfig, OrderBlockType, LoggerService, SignalDirection } from '../types';
import { INTEGER_MULTIPLIERS, THRESHOLD_VALUES, PERCENT_MULTIPLIER } from '../constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_CANDLES_REQUIRED = INTEGER_MULTIPLIERS.TWO;

// ============================================================================
// ORDER BLOCK DETECTOR
// ============================================================================

export class OrderBlockDetector {
  private detectedBlocks: OrderBlock[] = [];

  constructor(
    private config: OrderBlockConfig,
    private logger: LoggerService,
  ) {
    if (!config.enabled) {
      this.logger.info('Order Block Detector: Disabled in config');
    }
  }

  /**
   * Detect order blocks from candle array
   *
   * Algorithm:
   * 1. Scan for breakout patterns (consolidation → strong move)
   * 2. Bullish: strong green candle after consolidation = bullish order block
   * 3. Bearish: strong red candle after consolidation = bearish order block
   * 4. Track when price tests (returns to) the block
   * 5. Track when price breaks through the block
   * 6. Clean up old/broken blocks
   *
   * @param candles - Candle array (OHLCV)
   * @returns Array of detected order blocks
   */
  detectBlocks(candles: Candle[]): OrderBlock[] {
    if (!this.config.enabled) {
      return [];
    }

    if (candles.length < MIN_CANDLES_REQUIRED) {
      return [];
    }

    const newBlocks: OrderBlock[] = [];

    // Scan for breakout patterns
    for (let i = 0; i < candles.length - 1; i++) {
      const consolidationCandle = candles[i];
      const breakoutCandle = candles[i + 1];

      // Check for bullish breakout
      const bullishBreakout = this.isBullishBreakout(consolidationCandle, breakoutCandle);
      if (bullishBreakout) {
        const block: OrderBlock = {
          type: OrderBlockType.BULLISH,
          high: consolidationCandle.high,
          low: consolidationCandle.low,
          timestamp: consolidationCandle.timestamp,
          candle: consolidationCandle,
          strength: this.calculateBlockStrength(consolidationCandle, breakoutCandle),
          tested: false,
          testedAt: null,
          broken: false,
          brokenAt: null,
        };
        newBlocks.push(block);
      }

      // Check for bearish breakout
      const bearishBreakout = this.isBearishBreakout(consolidationCandle, breakoutCandle);
      if (bearishBreakout) {
        const block: OrderBlock = {
          type: OrderBlockType.BEARISH,
          high: consolidationCandle.high,
          low: consolidationCandle.low,
          timestamp: consolidationCandle.timestamp,
          candle: consolidationCandle,
          strength: this.calculateBlockStrength(consolidationCandle, breakoutCandle),
          tested: false,
          testedAt: null,
          broken: false,
          brokenAt: null,
        };
        newBlocks.push(block);
      }
    }

    // Add new blocks to tracked list
    this.detectedBlocks.push(...newBlocks);

    // Update existing blocks (check for tests/breaks)
    if (candles.length > 0) {
      this.updateBlocks(candles[candles.length - 1]);
    }

    // Clean up old/broken blocks
    this.cleanupBlocks();

    return this.detectedBlocks;
  }

  /**
   * Check if breakout is bullish
   *
   * Bullish breakout:
   * - Consolidation candle: small body, lower volume
   * - Breakout candle: large green candle, 1.5x+ volume, +0.5%+ move
   *
   * @private
   */
  private isBullishBreakout(consolidationCandle: Candle, breakoutCandle: Candle): boolean {
    const breakoutPercent = ((breakoutCandle.close - breakoutCandle.open) / breakoutCandle.open) * PERCENT_MULTIPLIER;
    const volumeRatio = breakoutCandle.volume / consolidationCandle.volume;

    return (
      breakoutPercent >= this.config.minBreakoutPercent &&
      volumeRatio >= this.config.minVolumeRatio &&
      breakoutCandle.close > breakoutCandle.open // Green candle
    );
  }

  /**
   * Check if breakout is bearish
   *
   * Bearish breakout:
   * - Consolidation candle: small body, lower volume
   * - Breakout candle: large red candle, 1.5x+ volume, -0.5%+ move
   *
   * @private
   */
  private isBearishBreakout(consolidationCandle: Candle, breakoutCandle: Candle): boolean {
    const breakoutPercent = Math.abs((breakoutCandle.close - breakoutCandle.open) / breakoutCandle.open) * PERCENT_MULTIPLIER;
    const volumeRatio = breakoutCandle.volume / consolidationCandle.volume;

    return (
      breakoutPercent >= this.config.minBreakoutPercent &&
      volumeRatio >= this.config.minVolumeRatio &&
      breakoutCandle.close < breakoutCandle.open // Red candle
    );
  }

  /**
   * Calculate order block strength (0-1)
   *
   * Factors:
   * - Breakout size (larger = stronger)
   * - Volume ratio (higher = stronger)
   *
   * @private
   */
  private calculateBlockStrength(consolidationCandle: Candle, breakoutCandle: Candle): number {
    const breakoutPercent = Math.abs((breakoutCandle.close - breakoutCandle.open) / breakoutCandle.open) * PERCENT_MULTIPLIER;
    const volumeRatio = breakoutCandle.volume / consolidationCandle.volume;

    // Normalize: larger breakout + higher volume = stronger block
    const breakoutScore = Math.min(breakoutPercent / INTEGER_MULTIPLIERS.TWO, 1.0); // Cap at 2% = 1.0
    const volumeScore = Math.min((volumeRatio - 1.0) / INTEGER_MULTIPLIERS.TWO, 1.0); // Cap at 3x volume = 1.0

    return (breakoutScore * THRESHOLD_VALUES.SIXTY_PERCENT) + (volumeScore * THRESHOLD_VALUES.FORTY_PERCENT); // 60% breakout, 40% volume
  }

  /**
   * Update blocks with current price (check for tests/breaks)
   *
   * Algorithm:
   * 1. For each block, check if price has tested it (entered block range)
   * 2. Check if price has broken through the block
   * 3. Update block state accordingly
   *
   * @private
   */
  private updateBlocks(latestCandle: Candle): void {
    for (const block of this.detectedBlocks) {
      if (block.broken) {
        continue; // Skip already broken blocks
      }

      // Check if price tested the block
      if (!block.tested) {
        if (block.type === OrderBlockType.BULLISH) {
          // Bullish block: price must drop into block range [low, high]
          if (latestCandle.low <= block.high && latestCandle.low >= block.low) {
            block.tested = true;
            block.testedAt = latestCandle.timestamp;
          }
        } else {
          // Bearish block: price must rise into block range [low, high]
          if (latestCandle.high >= block.low && latestCandle.high <= block.high) {
            block.tested = true;
            block.testedAt = latestCandle.timestamp;
          }
        }
      }

      // Check if price broke through the block
      if (block.type === OrderBlockType.BULLISH) {
        // Bullish block broken: close below block.low
        if (latestCandle.close < block.low) {
          block.broken = true;
          block.brokenAt = latestCandle.timestamp;
        }
      } else {
        // Bearish block broken: close above block.high
        if (latestCandle.close > block.high) {
          block.broken = true;
          block.brokenAt = latestCandle.timestamp;
        }
      }
    }
  }

  /**
   * Clean up old and broken blocks
   *
   * Rules:
   * 1. Remove blocks older than maxBlockAge
   * 2. Remove broken blocks
   *
   * @private
   */
  private cleanupBlocks(): void {
    const currentTime = Date.now();
    const maxAge = this.config.maxBlockAge;

    this.detectedBlocks = this.detectedBlocks.filter((block) => {
      // Keep if block is recent
      const age = currentTime - block.timestamp;
      if (age > maxAge) {
        return false; // Remove old blocks
      }

      // Remove broken blocks
      if (block.broken) {
        return false;
      }

      return true;
    });
  }

  /**
   * Analyze order blocks for signal confirmation
   *
   * Returns analysis with:
   * - All detected blocks
   * - Active blocks (untested)
   * - Nearest bullish/bearish blocks
   * - Distance to nearest block
   *
   * @param currentPrice - Current market price
   * @param direction - Signal direction (LONG/SHORT)
   * @returns Order block analysis
   */
  analyze(currentPrice: number, direction: SignalDirection): OrderBlockAnalysis {
    const activeBlocks = this.detectedBlocks.filter((b) => !b.tested && !b.broken);

    // Find blocks in relevant direction
    const bullishBlocks = activeBlocks.filter((b) => b.type === OrderBlockType.BULLISH && b.high < currentPrice);
    const bearishBlocks = activeBlocks.filter((b) => b.type === OrderBlockType.BEARISH && b.low > currentPrice);

    // Sort to find nearest
    const nearestBullishBlock = bullishBlocks.sort((a, b) => b.high - a.high)[0] || null;
    const nearestBearishBlock = bearishBlocks.sort((a, b) => a.low - b.low)[0] || null;

    let distanceToNearestBlock = Infinity;

    if (direction === SignalDirection.LONG && nearestBullishBlock) {
      // For LONG: check distance to nearest bullish block (below current price)
      distanceToNearestBlock = ((currentPrice - nearestBullishBlock.high) / currentPrice) * PERCENT_MULTIPLIER;
    } else if (direction === SignalDirection.SHORT && nearestBearishBlock) {
      // For SHORT: check distance to nearest bearish block (above current price)
      distanceToNearestBlock = ((nearestBearishBlock.low - currentPrice) / currentPrice) * PERCENT_MULTIPLIER;
    }

    return {
      blocks: this.detectedBlocks,
      activeBlocks,
      nearestBullishBlock,
      nearestBearishBlock,
      distanceToNearestBlock,
    };
  }

  /**
   * Get all detected blocks (for testing/debugging)
   */
  getAllBlocks(): OrderBlock[] {
    return [...this.detectedBlocks];
  }

  /**
   * Reset detector state (for testing)
   */
  reset(): void {
    this.detectedBlocks = [];
  }
}
