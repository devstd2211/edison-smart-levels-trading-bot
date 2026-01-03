/**
 * LRU Cache for Arrays
 * Specialized cache with automatic cleanup to prevent memory leaks
 *
 * Responsibilities:
 * 1. Store array of items (e.g., candles)
 * 2. Automatic cleanup when size exceeds threshold
 * 3. Keep only most recent items (LIFO)
 *
 * Based on old code: old_code/src/utils/lru-cache.ts
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CLEANUP_THRESHOLD = 1.5; // Cleanup when size reaches 150% of maxSize
const SIZE_DIVISOR = 2; // After cleanup, keep 50% of maxSize

// ============================================================================
// ARRAY LRU CACHE
// ============================================================================

export class ArrayLRUCache<T> {
  private items: T[] = [];

  constructor(
    private readonly maxSize: number,
    private readonly cleanupThreshold: number = DEFAULT_CLEANUP_THRESHOLD,
  ) {}

  /**
   * Add item to cache
   * Automatically triggers cleanup if threshold exceeded
   */
  push(item: T): void {
    this.items.push(item);

    // Automatic cleanup when threshold reached
    if (this.items.length > this.maxSize * this.cleanupThreshold) {
      this.cleanup();
    }
  }

  /**
   * Get all cached items
   * Returns copy to prevent external mutations
   */
  getAll(): T[] {
    return [...this.items];
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Smart cleanup - removes old items, keeps maxSize/2 most recent
   * Example: maxSize=200 → keeps 100 most recent items
   */
  private cleanup(): void {
    const targetSize = Math.floor(this.maxSize / SIZE_DIVISOR);

    if (this.items.length > targetSize) {
      // Keep only last targetSize items (most recent)
      this.items = this.items.slice(-targetSize);
    }
  }

  /**
   * Get last N items (most recent)
   */
  getLast(count: number): T[] {
    return this.items.slice(-count);
  }

  /**
   * Get item at index
   */
  get(index: number): T | undefined {
    return this.items[index];
  }
}
