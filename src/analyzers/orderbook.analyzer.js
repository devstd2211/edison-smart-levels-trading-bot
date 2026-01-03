"use strict";
/**
 * Order Book Analyzer
 *
 * Analyzes order book depth to detect:
 * - Bid/Ask imbalance (buying vs selling pressure)
 * - Walls (large orders that can block price movement)
 * - Support/Resistance zones from order book
 *
 * Single Responsibility: Analyze order book data ONLY
 * Does NOT make trading decisions - only provides analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderBookAnalyzer = void 0;
// ============================================================================
// ORDER BOOK ANALYZER
// ============================================================================
var OrderBookAnalyzer = /** @class */ (function () {
    function OrderBookAnalyzer(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    /**
     * Analyze order book data
     *
     * @param orderBook - Order book data (bids/asks)
     * @param currentPrice - Current market price
     * @returns Order book analysis
     */
    OrderBookAnalyzer.prototype.analyze = function (orderBook, currentPrice) {
        // Calculate imbalance (buying vs selling pressure)
        var imbalance = this.calculateImbalance(orderBook);
        // Detect walls (large orders)
        var walls = this.detectWalls(orderBook, currentPrice);
        // Find strongest levels
        var strongestBid = this.findStrongestLevel(orderBook.bids);
        var strongestAsk = this.findStrongestLevel(orderBook.asks);
        // Calculate spread
        var spread = this.calculateSpread(orderBook, currentPrice);
        // Depth info
        var depth = {
            bid: orderBook.bids.length,
            ask: orderBook.asks.length,
        };
        this.logger.debug('Order book analyzed', {
            imbalance: "".concat(imbalance.direction, " (ratio: ").concat(imbalance.ratio.toFixed(2), ")"),
            walls: walls.length,
            spread: "".concat(spread.toFixed(4), "%"),
            depth: "".concat(depth.bid, " bids / ").concat(depth.ask, " asks"),
        });
        return {
            imbalance: imbalance,
            walls: walls,
            strongestBid: strongestBid,
            strongestAsk: strongestAsk,
            spread: spread,
            depth: depth,
        };
    };
    // ============================================================================
    // PRIVATE METHODS - Imbalance
    // ============================================================================
    /**
     * Calculate bid/ask imbalance
     */
    OrderBookAnalyzer.prototype.calculateImbalance = function (orderBook) {
        // Sum all bid volumes
        var bidVolume = orderBook.bids.reduce(function (sum, level) { return sum + level.quantity; }, 0);
        // Sum all ask volumes
        var askVolume = orderBook.asks.reduce(function (sum, level) { return sum + level.quantity; }, 0);
        // Calculate ratio (bid / ask)
        var ratio = askVolume > 0 ? bidVolume / askVolume : 0;
        // Determine direction
        var direction = 'NEUTRAL';
        if (ratio >= this.config.imbalanceThreshold) {
            direction = 'BULLISH'; // More buying pressure
        }
        else if (ratio <= 1 / this.config.imbalanceThreshold) {
            direction = 'BEARISH'; // More selling pressure
        }
        // Calculate strength (0-1)
        // Strength increases as ratio deviates from 1.0
        var deviation = Math.abs(ratio - 1.0);
        var strength = Math.min(deviation / 2, 1.0);
        return {
            bidVolume: bidVolume,
            askVolume: askVolume,
            ratio: ratio,
            direction: direction,
            strength: strength,
        };
    };
    // ============================================================================
    // PRIVATE METHODS - Walls
    // ============================================================================
    /**
     * Detect walls (large orders)
     */
    OrderBookAnalyzer.prototype.detectWalls = function (orderBook, currentPrice) {
        var walls = [];
        // Calculate total volumes
        var totalBidVolume = orderBook.bids.reduce(function (sum, level) { return sum + level.quantity; }, 0);
        var totalAskVolume = orderBook.asks.reduce(function (sum, level) { return sum + level.quantity; }, 0);
        // Check bid walls
        for (var _i = 0, _a = orderBook.bids; _i < _a.length; _i++) {
            var bid = _a[_i];
            var percentOfTotal = (bid.quantity / totalBidVolume) * 100;
            if (percentOfTotal >= this.config.wallThreshold * 100) {
                var distance = ((currentPrice - bid.price) / currentPrice) * 100;
                walls.push({
                    side: 'BID',
                    price: bid.price,
                    quantity: bid.quantity,
                    percentOfTotal: percentOfTotal,
                    distance: distance,
                });
            }
        }
        // Check ask walls
        for (var _b = 0, _c = orderBook.asks; _b < _c.length; _b++) {
            var ask = _c[_b];
            var percentOfTotal = (ask.quantity / totalAskVolume) * 100;
            if (percentOfTotal >= this.config.wallThreshold * 100) {
                var distance = ((ask.price - currentPrice) / currentPrice) * 100;
                walls.push({
                    side: 'ASK',
                    price: ask.price,
                    quantity: ask.quantity,
                    percentOfTotal: percentOfTotal,
                    distance: distance,
                });
            }
        }
        // Sort by distance from current price
        walls.sort(function (a, b) { return a.distance - b.distance; });
        return walls;
    };
    // ============================================================================
    // PRIVATE METHODS - Levels
    // ============================================================================
    /**
     * Find strongest level (highest quantity)
     */
    OrderBookAnalyzer.prototype.findStrongestLevel = function (levels) {
        if (levels.length === 0)
            return null;
        var strongest = levels[0];
        for (var _i = 0, levels_1 = levels; _i < levels_1.length; _i++) {
            var level = levels_1[_i];
            if (level.quantity > strongest.quantity) {
                strongest = level;
            }
        }
        return strongest;
    };
    // ============================================================================
    // PRIVATE METHODS - Spread
    // ============================================================================
    /**
     * Calculate spread (best bid - best ask)
     */
    OrderBookAnalyzer.prototype.calculateSpread = function (orderBook, currentPrice) {
        if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
            return 0;
        }
        var bestBid = orderBook.bids[0].price; // Highest bid
        var bestAsk = orderBook.asks[0].price; // Lowest ask
        var spread = ((bestAsk - bestBid) / currentPrice) * 100;
        return spread;
    };
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    /**
     * Get human-readable summary
     */
    OrderBookAnalyzer.prototype.getSummary = function (analysis) {
        var parts = [];
        // Imbalance
        parts.push("Imbalance: ".concat(analysis.imbalance.direction, " (").concat((analysis.imbalance.strength * 100).toFixed(0), "% strength)"));
        // Walls
        if (analysis.walls.length > 0) {
            var nearestWall = analysis.walls[0];
            parts.push("Nearest wall: ".concat(nearestWall.side, " @ ").concat(nearestWall.price.toFixed(2), " (").concat(nearestWall.distance.toFixed(2), "% away)"));
        }
        else {
            parts.push('No walls detected');
        }
        // Spread
        parts.push("Spread: ".concat(analysis.spread.toFixed(4), "%"));
        return parts.join(' | ');
    };
    /**
     * Check if there's a wall blocking the path
     *
     * @param analysis - Order book analysis
     * @param direction - Trade direction (LONG/SHORT)
     * @param maxDistance - Max distance to check (% from current price)
     * @returns True if wall is blocking
     */
    OrderBookAnalyzer.prototype.hasBlockingWall = function (analysis, direction, maxDistance) {
        if (maxDistance === void 0) { maxDistance = 2.0; }
        for (var _i = 0, _a = analysis.walls; _i < _a.length; _i++) {
            var wall = _a[_i];
            // For LONG: check ASK walls above current price
            if (direction === 'LONG' && wall.side === 'ASK' && wall.distance <= maxDistance) {
                return true;
            }
            // For SHORT: check BID walls below current price
            if (direction === 'SHORT' && wall.side === 'BID' && wall.distance <= maxDistance) {
                return true;
            }
        }
        return false;
    };
    return OrderBookAnalyzer;
}());
exports.OrderBookAnalyzer = OrderBookAnalyzer;
