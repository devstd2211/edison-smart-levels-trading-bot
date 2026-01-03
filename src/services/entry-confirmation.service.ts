import { DECIMAL_PLACES, PERCENT_MULTIPLIER, TIME_UNITS } from '../constants';
import { TIME_MULTIPLIERS } from '../constants/technical.constants';
/**
 * Entry Confirmation Manager
 *
 * Prevents premature entries by waiting for next candle close confirmation.
 *
 * LONG Flow:
 * 1. Strategy detects potential LONG at support level
 * 2. Instead of entering immediately, save as "pending"
 * 3. Wait for next 1m candle to close
 * 4. If candle closes ABOVE support → confirm entry (bounce confirmed)
 * 5. If candle closes BELOW support → cancel (falling knife)
 *
 * SHORT Flow:
 * 1. Strategy detects potential SHORT at resistance level
 * 2. Instead of entering immediately, save as "pending"
 * 3. Wait for next 1m candle to close
 * 4. If candle closes BELOW resistance → confirm entry (rejection confirmed)
 * 5. If candle closes ABOVE resistance → cancel (pump continues)
 *
 * Benefits:
 * - Reduces quick stop-outs (< 5min holds)
 * - Confirms price rejection/bounce before entry
 * - Configurable per direction (LONG/SHORT)
 */

import { LoggerService, SignalDirection, EntryConfirmationConfig } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface PendingEntry {
  id: string; // Unique ID for tracking
  symbol: string;
  direction: SignalDirection; // LONG or SHORT
  keyLevel: number; // Support (LONG) or Resistance (SHORT) price level
  detectedAt: number; // Timestamp when signal detected
  expiresAt: number; // Timestamp when signal expires
  signalData: Record<string, unknown>; // Original signal data to use if confirmed (flexible type for different signal structures)
}

export interface ConfirmationResult {
  confirmed: boolean;
  reason: string;
  closePrice?: number;
  keyLevel?: number;
}

// ============================================================================
// ENTRY CONFIRMATION MANAGER
// ============================================================================

export class EntryConfirmationManager {
  private pendingEntries: Map<string, PendingEntry> = new Map();

  constructor(
    private config: EntryConfirmationConfig,
    private logger: LoggerService,
  ) {}

  /**
   * Check if confirmation is enabled for direction
   */
  isEnabled(direction: SignalDirection): boolean {
    return direction === SignalDirection.LONG
      ? this.config.long.enabled
      : this.config.short.enabled;
  }

  /**
   * Get expiry time in milliseconds for direction
   */
  private getExpiryMs(direction: SignalDirection): number {
    const seconds =
      direction === SignalDirection.LONG
        ? this.config.long.expirySeconds
        : this.config.short.expirySeconds;
    return seconds * TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND;
  }

  /**
   * Get tolerance percent for direction
   * Allows entry when price closes exactly at the level (within tolerance)
   */
  private getTolerancePercent(direction: SignalDirection): number {
    return direction === SignalDirection.LONG
      ? this.config.long.tolerancePercent ?? 0.05
      : this.config.short.tolerancePercent ?? 0.05;
  }

  /**
   * Get minimum bounce percent for direction
   * Requires price to bounce away from level by at least this percent
   * Helps filter weak entries right at the level
   */
  private getMinBouncePercent(direction: SignalDirection): number {
    return direction === SignalDirection.LONG
      ? this.config.long.minBouncePercent ?? 0
      : this.config.short.minBouncePercent ?? 0;
  }

  /**
   * Add pending entry waiting for confirmation
   *
   * @param entry - Pending entry details
   * @returns Pending entry ID
   */
  addPending(entry: Omit<PendingEntry, 'id' | 'expiresAt'>): string {
    const id = `${entry.symbol}_${entry.direction}_${Date.now()}`;
    const expiryMs = this.getExpiryMs(entry.direction);
    const expiresAt = Date.now() + expiryMs;

    const pendingEntry: PendingEntry = {
      id,
      expiresAt,
      ...entry,
    };

    this.pendingEntries.set(id, pendingEntry);

    const levelType = entry.direction === SignalDirection.LONG ? 'support' : 'resistance';
    const confirmCondition =
      entry.direction === SignalDirection.LONG
        ? 'candle close above support'
        : 'candle close below resistance';

    this.logger.info(`⏳ ${entry.direction} entry pending confirmation`, {
      id,
      symbol: entry.symbol,
      direction: entry.direction,
      [`${levelType}Level`]: entry.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
      waitingFor: `Next 1m ${confirmCondition}`,
      expiresIn: `${expiryMs / TIME_UNITS.MINUTE}min`,
    });

    return id;
  }

  /**
   * Check if pending entry should be confirmed
   *
   * @param id - Pending entry ID
   * @param currentCandleClose - Current 1m candle close price
   * @returns Confirmation result
   */
  checkConfirmation(id: string, currentCandleClose: number): ConfirmationResult {
    const pending = this.pendingEntries.get(id);

    if (!pending) {
      return {
        confirmed: false,
        reason: 'Pending entry not found',
      };
    }

    // Check expiry
    if (Date.now() > pending.expiresAt) {
      const levelType = pending.direction === SignalDirection.LONG ? 'support' : 'resistance';

      this.logger.info(`⏱️ ${pending.direction} entry EXPIRED`, {
        id,
        symbol: pending.symbol,
        direction: pending.direction,
        [`${levelType}Level`]: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
        reason: 'Confirmation timeout',
      });

      this.pendingEntries.delete(id);
      return {
        confirmed: false,
        reason: 'Confirmation timeout - signal expired',
      };
    }

    // Get tolerance for this direction (allows entry when close is exactly at level)
    const tolerancePercent = this.getTolerancePercent(pending.direction);
    const toleranceAmount = pending.keyLevel * (tolerancePercent / PERCENT_MULTIPLIER);

    // LONG confirmation: candle closed ABOVE support (or within tolerance of it)
    if (pending.direction === SignalDirection.LONG) {
      // With tolerance: close >= (level - tolerance) means confirmed
      const adjustedLevel = pending.keyLevel - toleranceAmount;
      if (currentCandleClose >= adjustedLevel) {
        // Calculate bounce percent
        const bouncePercent = ((currentCandleClose - pending.keyLevel) / pending.keyLevel) * PERCENT_MULTIPLIER;
        const minBouncePercent = this.getMinBouncePercent(pending.direction);

        // Check if bounce is sufficient (if minBouncePercent is configured)
        if (minBouncePercent > 0 && bouncePercent < minBouncePercent) {
          this.logger.info('⚠️ LONG entry REJECTED - Insufficient bounce', {
            id,
            symbol: pending.symbol,
            supportLevel: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
            candleClose: currentCandleClose.toFixed(DECIMAL_PLACES.PRICE),
            bouncePercent: bouncePercent.toFixed(DECIMAL_PLACES.STRENGTH) + '%',
            minRequired: minBouncePercent.toFixed(DECIMAL_PLACES.STRENGTH) + '%',
            reason: 'Entry too close to level - weak bounce',
          });

          this.pendingEntries.delete(id);
          return {
            confirmed: false,
            reason: `Bounce too weak (${bouncePercent.toFixed(2)}% < ${minBouncePercent}% required)`,
            closePrice: currentCandleClose,
            keyLevel: pending.keyLevel,
          };
        }

        this.logger.info('✅ LONG entry CONFIRMED', {
          id,
          symbol: pending.symbol,
          supportLevel: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
          candleClose: currentCandleClose.toFixed(DECIMAL_PLACES.PRICE),
          bouncePercent: bouncePercent.toFixed(DECIMAL_PLACES.STRENGTH) + '%',
          toleranceUsed: currentCandleClose < pending.keyLevel,
        });

        this.pendingEntries.delete(id);
        return {
          confirmed: true,
          reason: currentCandleClose >= pending.keyLevel
            ? 'Candle closed above support - bounce confirmed'
            : 'Candle closed at support within tolerance - bounce confirmed',
          closePrice: currentCandleClose,
          keyLevel: pending.keyLevel,
        };
      } else {
        // Candle closed BELOW support (beyond tolerance) - falling knife!
        this.logger.info('❌ LONG entry REJECTED', {
          id,
          symbol: pending.symbol,
          supportLevel: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
          candleClose: currentCandleClose.toFixed(DECIMAL_PLACES.PRICE),
          reason: 'Candle closed below support - falling knife',
        });

        this.pendingEntries.delete(id);
        return {
          confirmed: false,
          reason: 'Candle closed below support - no bounce',
          closePrice: currentCandleClose,
          keyLevel: pending.keyLevel,
        };
      }
    }

    // SHORT confirmation: candle closed BELOW resistance (or within tolerance of it)
    if (pending.direction === SignalDirection.SHORT) {
      // With tolerance: close <= (level + tolerance) means confirmed
      const adjustedLevel = pending.keyLevel + toleranceAmount;
      if (currentCandleClose <= adjustedLevel) {
        // Calculate rejection percent
        const rejectionPercent = ((pending.keyLevel - currentCandleClose) / pending.keyLevel) * PERCENT_MULTIPLIER;
        const minBouncePercent = this.getMinBouncePercent(pending.direction);

        // Check if rejection is sufficient (if minBouncePercent is configured)
        if (minBouncePercent > 0 && rejectionPercent < minBouncePercent) {
          this.logger.info('⚠️ SHORT entry REJECTED - Insufficient rejection', {
            id,
            symbol: pending.symbol,
            resistanceLevel: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
            candleClose: currentCandleClose.toFixed(DECIMAL_PLACES.PRICE),
            rejectionPercent: rejectionPercent.toFixed(DECIMAL_PLACES.STRENGTH) + '%',
            minRequired: minBouncePercent.toFixed(DECIMAL_PLACES.STRENGTH) + '%',
            reason: 'Entry too close to level - weak rejection',
          });

          this.pendingEntries.delete(id);
          return {
            confirmed: false,
            reason: `Rejection too weak (${rejectionPercent.toFixed(2)}% < ${minBouncePercent}% required)`,
            closePrice: currentCandleClose,
            keyLevel: pending.keyLevel,
          };
        }

        this.logger.info('✅ SHORT entry CONFIRMED', {
          id,
          symbol: pending.symbol,
          resistanceLevel: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
          candleClose: currentCandleClose.toFixed(DECIMAL_PLACES.PRICE),
          rejectionPercent: rejectionPercent.toFixed(DECIMAL_PLACES.STRENGTH) + '%',
          toleranceUsed: currentCandleClose > pending.keyLevel,
        });

        this.pendingEntries.delete(id);
        return {
          confirmed: true,
          reason: currentCandleClose <= pending.keyLevel
            ? 'Candle closed below resistance - rejection confirmed'
            : 'Candle closed at resistance within tolerance - rejection confirmed',
          closePrice: currentCandleClose,
          keyLevel: pending.keyLevel,
        };
      } else {
        // Candle closed ABOVE resistance (beyond tolerance) - pump continues!
        this.logger.info('❌ SHORT entry REJECTED', {
          id,
          symbol: pending.symbol,
          resistanceLevel: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
          candleClose: currentCandleClose.toFixed(DECIMAL_PLACES.PRICE),
          reason: 'Candle closed above resistance - pump continues',
        });

        this.pendingEntries.delete(id);
        return {
          confirmed: false,
          reason: 'Candle closed above resistance - no rejection',
          closePrice: currentCandleClose,
          keyLevel: pending.keyLevel,
        };
      }
    }

    // Should never reach here
    return {
      confirmed: false,
      reason: 'Unknown direction',
    };
  }

  /**
   * Get pending entry data
   *
   * @param id - Pending entry ID
   * @returns Pending entry or undefined
   */
  getPending(id: string): PendingEntry | undefined {
    return this.pendingEntries.get(id);
  }

  /**
   * Get all pending entries
   *
   * @param direction - Optional: filter by direction
   * @returns Array of pending entries
   */
  getAllPending(direction?: SignalDirection): PendingEntry[] {
    const allEntries = Array.from(this.pendingEntries.values());

    if (direction != null) {
      return allEntries.filter((entry) => entry.direction === direction);
    }

    return allEntries;
  }

  /**
   * Cancel pending entry
   *
   * @param id - Pending entry ID
   * @returns true if cancelled, false if not found
   */
  cancel(id: string): boolean {
    const pending = this.pendingEntries.get(id);
    if (pending) {
      const levelType = pending.direction === SignalDirection.LONG ? 'support' : 'resistance';

      this.logger.info(`🚫 ${pending.direction} entry CANCELLED`, {
        id,
        symbol: pending.symbol,
        direction: pending.direction,
        [`${levelType}Level`]: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
      });

      this.pendingEntries.delete(id);
      return true;
    }

    return false;
  }

  /**
   * Clean up expired entries
   *
   * @returns Number of expired entries removed
   */
  cleanupExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [id, entry] of this.pendingEntries.entries()) {
      if (now > entry.expiresAt) {
        this.logger.debug(`Removing expired pending ${entry.direction}`, {
          id,
          symbol: entry.symbol,
          direction: entry.direction,
        });
        this.pendingEntries.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all pending entries
   */
  clear(): void {
    this.pendingEntries.clear();
  }

  /**
   * Get count of pending entries
   *
   * @param direction - Optional: filter by direction
   * @returns Count of pending entries
   */
  getPendingCount(direction?: SignalDirection): number {
    if (direction != null) {
      return this.getAllPending(direction).length;
    }
    return this.pendingEntries.size;
  }
}
