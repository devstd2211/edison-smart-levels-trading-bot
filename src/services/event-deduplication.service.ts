/**
 * Event Deduplication Service
 * Generic event deduplication with cache cleanup
 *
 * Responsibilities:
 * - Track processed events to prevent duplicates
 * - Cleanup expired events from cache
 * - Support configurable cache size and TTL
 *
 * ErrorHandler Integration (Phase 8.9.19):
 * - GRACEFUL_DEGRADE: Cache cleanup failures (continue with current state)
 * - SKIP: Logger debug failures (non-critical)
 * - Never blocks trading operations
 */

import { TIME_UNITS, INTEGER_MULTIPLIERS } from '../constants';
import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors';

/**
 * Event Deduplication Service
 * Tracks processed events to prevent handling duplicates
 * Useful for WebSocket events where duplicates can occur
 *
 * Phase 8.9.19: ErrorHandler integration for resilient cache management
 */
export class EventDeduplicationService {
  private processedEvents = new Map<string, number>(); // eventKey → timestamp
  private readonly cacheSize: number;
  private readonly cacheTtlMs: number;

  constructor(
    cacheSize: number = INTEGER_MULTIPLIERS.ONE_HUNDRED,
    cacheTtlMs: number = TIME_UNITS.MINUTE, // 1 minute TTL
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.19: Optional ErrorHandler
  ) {
    this.cacheSize = cacheSize;
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * Check if event is duplicate
   * @param eventType - Type of event (e.g., 'TP', 'SL', 'TRAILING')
   * @param eventId - Unique event identifier (orderId, etc.)
   * @param timestamp - Event timestamp (for TTL-based cleanup)
   * @returns true if event was already processed, false if new
   */
  public isDuplicate(eventType: string, eventId: string, timestamp: number): boolean {
    const eventKey = `${eventType}_${eventId}_${timestamp}`;

    // Check if event already processed
    if (this.processedEvents.has(eventKey)) {
      // SKIP strategy (Phase 8.9.19): Non-critical logging failure should never block
      try {
        this.logger?.debug('Duplicate event ignored', { eventKey });
      } catch (error) {
        // Silently skip logger failures - this is non-critical
        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'EventDeduplicationService.isDuplicate.logDuplicate',
          });
        }
      }
      return true;
    }

    // Store event with current time for TTL-based cleanup
    this.processedEvents.set(eventKey, Date.now());

    // Cleanup old events if cache exceeds size limit
    if (this.processedEvents.size > this.cacheSize) {
      this.cleanup();
    }

    return false;
  }

  /**
   * Clear all cached events
   */
  public clear(): void {
    this.processedEvents.clear();
  }

  /**
   * Cleanup expired events from cache
   * Removes events older than cacheTtlMs
   *
   * Phase 8.9.19: Uses GRACEFUL_DEGRADE strategy to continue with current cache
   * if cleanup fails due to Map corruption or other issues
   */
  private cleanup(): void {
    try {
      const now = Date.now();
      let removedCount = 0;

      // Safely iterate Map and remove expired entries
      for (const [key, time] of this.processedEvents.entries()) {
        if (now - time > this.cacheTtlMs) {
          this.processedEvents.delete(key);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        try {
          this.logger?.debug('Cleaned up expired events from deduplication cache', {
            removedCount,
            cacheSize: this.processedEvents.size,
          });
        } catch (logError) {
          // SKIP strategy (Phase 8.9.19): Ignore logging failures
          if (this.errorHandler) {
            this.errorHandler.handle(logError, {
              strategy: RecoveryStrategy.SKIP,
              context: 'EventDeduplicationService.cleanup.log',
            });
          }
        }
      }
    } catch (error) {
      // GRACEFUL_DEGRADE strategy (Phase 8.9.19): Continue with current cache state
      // Cleanup failure should never block duplicate detection
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'EventDeduplicationService.cleanup',
        });
      } else {
        // Fallback for backward compatibility: just warn and continue
        this.logger?.warn('Cache cleanup degraded - continuing with current cache state', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
