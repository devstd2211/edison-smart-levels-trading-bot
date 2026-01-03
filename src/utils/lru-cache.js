"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArrayLRUCache = void 0;
// ============================================================================
// CONSTANTS
// ============================================================================
var DEFAULT_CLEANUP_THRESHOLD = 1.5; // Cleanup when size reaches 150% of maxSize
var SIZE_DIVISOR = 2; // After cleanup, keep 50% of maxSize
// ============================================================================
// ARRAY LRU CACHE
// ============================================================================
var ArrayLRUCache = /** @class */ (function () {
    function ArrayLRUCache(maxSize, cleanupThreshold) {
        if (cleanupThreshold === void 0) { cleanupThreshold = DEFAULT_CLEANUP_THRESHOLD; }
        this.maxSize = maxSize;
        this.cleanupThreshold = cleanupThreshold;
        this.items = [];
    }
    /**
     * Add item to cache
     * Automatically triggers cleanup if threshold exceeded
     */
    ArrayLRUCache.prototype.push = function (item) {
        this.items.push(item);
        // Automatic cleanup when threshold reached
        if (this.items.length > this.maxSize * this.cleanupThreshold) {
            this.cleanup();
        }
    };
    /**
     * Get all cached items
     * Returns copy to prevent external mutations
     */
    ArrayLRUCache.prototype.getAll = function () {
        return __spreadArray([], this.items, true);
    };
    /**
     * Get current cache size
     */
    ArrayLRUCache.prototype.size = function () {
        return this.items.length;
    };
    /**
     * Clear all items
     */
    ArrayLRUCache.prototype.clear = function () {
        this.items = [];
    };
    /**
     * Smart cleanup - removes old items, keeps maxSize/2 most recent
     * Example: maxSize=200 → keeps 100 most recent items
     */
    ArrayLRUCache.prototype.cleanup = function () {
        var targetSize = Math.floor(this.maxSize / SIZE_DIVISOR);
        if (this.items.length > targetSize) {
            // Keep only last targetSize items (most recent)
            this.items = this.items.slice(-targetSize);
        }
    };
    /**
     * Get last N items (most recent)
     */
    ArrayLRUCache.prototype.getLast = function (count) {
        return this.items.slice(-count);
    };
    /**
     * Get item at index
     */
    ArrayLRUCache.prototype.get = function (index) {
        return this.items[index];
    };
    return ArrayLRUCache;
}());
exports.ArrayLRUCache = ArrayLRUCache;
