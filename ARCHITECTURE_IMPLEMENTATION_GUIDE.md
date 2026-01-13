# 🔧 Architecture Implementation Guide

**Purpose:** Code examples for each component - shows how to implement LEGO blocks correctly
**Status:** Reference for Phase 0.2-0.3 implementation

---

## 1️⃣ INDICATOR CACHE (Phase 0.2 - Critical)

### Problem
```
Current state: Each analyzer recalculates same indicators
- RSI analyzer calculates RSI-14-1h
- EMAPriceAnalyzer calculates RSI-14-1h again
- StochasticAnalyzer calculates RSI-14-1h yet again
→ 3x CPU waste, memory leak from cache entries

Example:
Loop iteration 1: RSI-14-1h calculated 28 times (28 analyzers)
Loop iteration 2: RSI-14-1h calculated 28 times again
Loop iteration N: RSI-14-1h calculated 28 times
→ Same result every loop!
```

### Solution

**File:** `src/services/indicator-cache.service.ts`

```typescript
/**
 * Shared indicator cache for all analyzers
 * Prevents recalculation of same indicators in same candle
 */

export interface CachedIndicator {
  value: number | number[] | Record<string, number>;
  timestamp: number; // When calculated
  accessCount: number; // For LRU tracking
  lastAccessed: number; // For LRU eviction
}

export class IndicatorCacheService {
  private cache: Map<string, CachedIndicator> = new Map();
  private readonly MAX_CACHE_SIZE = 500;

  /**
   * Get cached indicator result
   * @param key Format: "RSI-14-1h", "EMA-20-4h", etc
   */
  get(key: string): number | number[] | Record<string, number> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Update access tracking for LRU
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  /**
   * Set cached indicator result
   */
  set(key: string, value: number | number[] | Record<string, number>): void {
    // Evict if at capacity
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Clear all cache entries (call on every new candle)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Get cache stats for monitoring
   */
  getStats() {
    return {
      size: this.cache.size,
      capacity: this.MAX_CACHE_SIZE,
      utilization: (this.cache.size / this.MAX_CACHE_SIZE * 100).toFixed(1) + '%',
    };
  }
}
```

### Usage in Analyzers

```typescript
// File: src/analyzers/rsi.analyzer-new.ts
export class RsiAnalyzerNew {
  constructor(
    private logger: LoggerService,
    private indicatorCache: IndicatorCacheService, // Injected!
  ) {}

  async analyze(candles: Candle[], context: AnalysisContext): Promise<AnalyzerSignal> {
    const period = context.config?.period || 14;
    const timeframe = context.timeframe;

    // Create cache key
    const cacheKey = `RSI-${period}-${timeframe}`;

    // Check cache first
    let rsiValue = this.indicatorCache.get(cacheKey);

    if (rsiValue === null) {
      // Not in cache → calculate
      rsiValue = calculateRSI(candles, period);

      // Store in cache
      this.indicatorCache.set(cacheKey, rsiValue);
    }

    // Rest of analysis logic
    const signal = this.evaluateRSI(rsiValue, context);
    return signal;
  }
}
```

### Integration in BotFactory

```typescript
// File: src/services/bot-services.ts
export class BotServices {
  indicatorCache: IndicatorCacheService;
  rsiAnalyzer: RsiAnalyzerNew;
  emaAnalyzer: EmaAnalyzerNew;
  // ... other services

  constructor(config: Config, logger: LoggerService) {
    // Create cache first
    this.indicatorCache = new IndicatorCacheService();

    // Pass to analyzers
    this.rsiAnalyzer = new RsiAnalyzerNew(logger, this.indicatorCache);
    this.emaAnalyzer = new EmaAnalyzerNew(logger, this.indicatorCache);
    // ... other analyzers with same cache

    // Clear cache on every new candle
    this.candleProvider.on('newCandle', () => {
      this.indicatorCache.clear();
    });
  }
}
```

---

## 2️⃣ DECISION ENGINE (Phase 0.3 - Extract to Pure Functions)

### Problem
```
Current: Entry decision logic mixed in orchestrator
class EntryOrchestrator {
  evaluateEntry() {
    // 50+ lines of logic + service calls
    this.logger.debug(...);        // Side effect
    const trend = this.service...  // Service call
    // Cannot test without initializing entire bot
  }
}

Target: Pure function in separate module
// Can test with just function call
const decision = evaluateEntry(signal, context, rules);
// No side effects, no service dependencies
```

### Solution

**File:** `src/decision-engine/entry-decisions.ts`

```typescript
/**
 * Pure function for entry decision logic
 * NO side effects, NO service calls, NO logging
 * 100% testable without initializing bot
 */

export type EntryDecision = 'ENTER' | 'SKIP' | 'WAIT';

export interface EntryContext {
  signal: {
    direction: 'LONG' | 'SHORT';
    confidence: number; // 0-100
  };
  trend: {
    bias: 'UP' | 'DOWN' | 'NEUTRAL';
    strength: number; // 0-100
  };
  openPositions: Position[];
  rules: {
    minConfidence: number;
    minTrendAlignment: number;
    requiresTrendConfirmation: boolean;
  };
}

/**
 * Evaluate if entry should be executed
 * @returns ENTER | SKIP | WAIT
 */
export function evaluateEntry(context: EntryContext): EntryDecision {
  const { signal, trend, openPositions, rules } = context;

  // Rule 1: Already in position → block multiple entries
  if (openPositions.length > 0) {
    return 'SKIP';
  }

  // Rule 2: Signal confidence too low
  if (signal.confidence < rules.minConfidence) {
    return 'SKIP';
  }

  // Rule 3: No trend bias (flat market)
  if (trend.bias === 'NEUTRAL') {
    if (rules.requiresTrendConfirmation) {
      return 'WAIT';
    }
  }

  // Rule 4: Signal conflicts with trend (divergence)
  const signalBullish = signal.direction === 'LONG';
  const trendBullish = trend.bias === 'UP';

  if (signalBullish && !trendBullish && rules.requiresTrendConfirmation) {
    return 'WAIT';
  }

  if (!signalBullish && trendBullish && rules.requiresTrendConfirmation) {
    return 'WAIT';
  }

  // All checks passed
  return 'ENTER';
}
```

### Usage in Orchestrator

```typescript
// File: src/orchestrators/entry.orchestrator.ts
import { evaluateEntry, EntryContext, type EntryDecision } from '../decision-engine/entry-decisions';

export class EntryOrchestrator {
  evaluate(
    signal: AggregatedSignal,
    trend: TrendAnalysis,
    openPositions: Position[]
  ): EntryDecision {
    // Prepare context for pure function
    const context: EntryContext = {
      signal: {
        direction: signal.direction as 'LONG' | 'SHORT',
        confidence: signal.confidence,
      },
      trend: {
        bias: trend.bias as 'UP' | 'DOWN' | 'NEUTRAL',
        strength: trend.strength,
      },
      openPositions,
      rules: {
        minConfidence: 60,
        minTrendAlignment: 50,
        requiresTrendConfirmation: true,
      },
    };

    // Call pure function
    const decision = evaluateEntry(context);

    // Log after decision (side effect after pure logic)
    this.logger.debug('Entry decision:', {
      decision,
      confidence: signal.confidence,
      trend: trend.bias,
    });

    return decision;
  }
}
```

### Testing Pure Function (No Bot Setup)

```typescript
// File: src/__tests__/decision-engine/entry-decisions.test.ts
import { evaluateEntry } from '../../decision-engine/entry-decisions';

describe('evaluateEntry', () => {
  it('should SKIP when already in position', () => {
    const context = {
      signal: { direction: 'LONG' as const, confidence: 85 },
      trend: { bias: 'UP' as const, strength: 75 },
      openPositions: [
        { id: '1', direction: 'LONG', quantity: 1 },
      ],
      rules: {
        minConfidence: 60,
        minTrendAlignment: 50,
        requiresTrendConfirmation: true,
      },
    };

    const decision = evaluateEntry(context);

    expect(decision).toBe('SKIP');
  });

  it('should SKIP when confidence too low', () => {
    const context = {
      signal: { direction: 'LONG' as const, confidence: 40 },
      trend: { bias: 'UP' as const, strength: 75 },
      openPositions: [],
      rules: {
        minConfidence: 60,
        minTrendAlignment: 50,
        requiresTrendConfirmation: true,
      },
    };

    const decision = evaluateEntry(context);

    expect(decision).toBe('SKIP');
  });

  it('should ENTER when all conditions met', () => {
    const context = {
      signal: { direction: 'LONG' as const, confidence: 85 },
      trend: { bias: 'UP' as const, strength: 75 },
      openPositions: [],
      rules: {
        minConfidence: 60,
        minTrendAlignment: 50,
        requiresTrendConfirmation: true,
      },
    };

    const decision = evaluateEntry(context);

    expect(decision).toBe('ENTER');
  });

  it('should WAIT when signal conflicts with trend', () => {
    const context = {
      signal: { direction: 'SHORT' as const, confidence: 85 },
      trend: { bias: 'UP' as const, strength: 75 },
      openPositions: [],
      rules: {
        minConfidence: 60,
        minTrendAlignment: 50,
        requiresTrendConfirmation: true,
      },
    };

    const decision = evaluateEntry(context);

    expect(decision).toBe('WAIT');
  });
});
```

---

## 3️⃣ RISK MANAGER (Gatekeeper)

### Code Structure

```typescript
// File: src/services/risk-manager.service.ts
export class RiskManager {
  private dailyPnL = 0;
  private consecutiveLosses = 0;
  private totalExposure = 0;

  constructor(
    private config: RiskManagerConfig,
    private logger: LoggerService,
  ) {}

  /**
   * Approve or reject trade based on all risk factors
   * Returns decision + approved position size
   */
  approveRisk(
    signal: AggregatedSignal,
    accountBalance: number,
    openPositions: Position[]
  ): RiskDecision {
    // GATE 1: Daily loss limit
    if (this.dailyPnL < -this.config.dailyLimits.maxDailyLossPercent * accountBalance / 100) {
      return { approved: false, reason: 'Daily loss limit reached' };
    }

    // GATE 2: Loss streak penalty
    let sizeFactor = 1.0;
    if (this.consecutiveLosses === 2) sizeFactor = 0.5;
    if (this.consecutiveLosses === 3) sizeFactor = 0.25;
    if (this.consecutiveLosses >= 4) return { approved: false, reason: 'Stop after 4 losses' };

    // GATE 3: Concurrent risk limit
    if (openPositions.length >= this.config.concurrentRisk.maxPositions) {
      return { approved: false, reason: 'Max concurrent positions reached' };
    }

    // GATE 4: Calculate position size
    const riskAmount = accountBalance * this.config.positionSizing.riskPerTradePercent / 100;
    const slDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    const positionSize = riskAmount / slDistance;
    const adjustedSize = positionSize * sizeFactor;

    // Clamp to limits
    const finalSize = Math.max(
      this.config.positionSizing.minPositionSizeUsdt,
      Math.min(
        adjustedSize,
        this.config.positionSizing.maxPositionSizeUsdt
      )
    );

    return {
      approved: true,
      positionSize: finalSize,
      sizeFactor,
    };
  }

  /**
   * Update daily PnL after position closed
   */
  updatePnL(pnl: number): void {
    this.dailyPnL += pnl;

    if (pnl < 0) {
      this.consecutiveLosses++;
    } else {
      this.consecutiveLosses = 0; // Reset on win
    }
  }

  /**
   * Reset daily stats at 00:00 UTC
   */
  resetDaily(): void {
    this.dailyPnL = 0;
    this.consecutiveLosses = 0;
  }
}
```

---

## 4️⃣ POSITION LIFECYCLE (Entry to Exit)

### Code Structure

```typescript
// File: src/services/position-lifecycle.service.ts
export class PositionLifecycleService {
  private currentPosition: Position | null = null;
  private isOpening = false; // Prevent race condition

  constructor(
    private bybit: BybitService,
    private eventBus: BotEventBus,
    private logger: LoggerService,
  ) {}

  /**
   * Open position atomically with SL/TP
   */
  async openPosition(signal: AggregatedSignal, size: number): Promise<Position> {
    // Prevent double-open
    if (this.isOpening || this.currentPosition) {
      throw new Error('Position already open or opening');
    }

    this.isOpening = true;

    try {
      // Create position object
      const position: Position = {
        id: generateId(),
        direction: signal.direction,
        entryPrice: signal.entryPrice,
        quantity: size,
        stopLoss: signal.stopLoss,
        takeProfits: signal.takeProfits,
        openTime: Date.now(),
        state: 'OPENING',
      };

      // Send to exchange ATOMICALLY (SL + TP in same call)
      const result = await this.bybit.openPosition({
        symbol: 'XRPUSDT',
        side: signal.direction === 'LONG' ? 'Buy' : 'Sell',
        qty: size,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfits,
      });

      position.id = result.positionId;
      position.state = 'OPEN';
      this.currentPosition = position;

      // Emit event (triggers journal, telegram, etc)
      this.eventBus.emit('positionOpened', { position });

      this.logger.info('Position opened', {
        id: position.id,
        direction: position.direction,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        stopLoss: position.stopLoss,
      });

      return position;
    } finally {
      this.isOpening = false;
    }
  }

  /**
   * Close position (market exit)
   */
  async closePosition(reason: string): Promise<void> {
    if (!this.currentPosition) return;

    const position = this.currentPosition;

    // Close at exchange
    await this.bybit.closePosition(position.id);

    position.state = 'CLOSED';
    position.closeTime = Date.now();
    position.closeReason = reason;

    // Emit event
    this.eventBus.emit('positionClosed', { position });

    this.logger.info('Position closed', {
      id: position.id,
      reason,
      pnl: position.realizedPnL,
    });

    this.currentPosition = null;
  }

  /**
   * Get current position
   */
  getCurrentPosition(): Position | null {
    return this.currentPosition;
  }

  /**
   * Sync positions from exchange on startup
   */
  async syncPositions(): Promise<void> {
    const openPositions = await this.bybit.getOpenPositions();

    if (openPositions.length === 0) {
      this.currentPosition = null;
      return;
    }

    if (openPositions.length > 1) {
      this.logger.warn('Multiple positions detected! Bot allows only 1.');
    }

    // Load first position
    const pos = openPositions[0];
    this.currentPosition = {
      id: pos.id,
      direction: pos.side === 'Buy' ? 'LONG' : 'SHORT',
      entryPrice: pos.entryPrice,
      quantity: pos.qty,
      stopLoss: pos.stopLoss,
      takeProfits: pos.takeProfits || [],
      openTime: pos.openTime,
      state: 'OPEN',
    };

    this.logger.info('Positions synced from exchange', {
      position: this.currentPosition,
    });
  }
}
```

---

## 5️⃣ TRADING ORCHESTRATOR (Main Loop)

### Code Structure

```typescript
// File: src/services/trading-orchestrator.service.ts
export class TradingOrchestrator {
  constructor(
    private candleProvider: CandleProvider,
    private trendService: MultiTimeframeTrendService,
    private analyzerRegistry: AnalyzerRegistryService,
    private strategyCoordinator: StrategyCoordinator,
    private filterOrchestrator: FilterOrchestrator,
    private entryOrchestrator: EntryOrchestrator,
    private exitOrchestrator: ExitOrchestrator,
    private riskManager: RiskManager,
    private positionLifecycle: PositionLifecycleService,
    private logger: LoggerService,
  ) {}

  /**
   * Main event handler: called on every 1m candle close
   */
  async onCandleClosed(candle: Candle): Promise<void> {
    const startTime = Date.now();

    try {
      // PHASE 1: Update context
      if (this.isPrimaryTFClosed(candle.timeframe)) {
        const trend = await this.trendService.analyzeTrend(candle);
        this.logger.debug('Context updated', { trend: trend.bias });
      }

      // PHASE 2: Check if entry TF closed
      if (!this.isEntryTFClosed(candle.timeframe)) {
        return;
      }

      // PHASE 3: Get signals from all analyzers
      const analyzers = await this.analyzerRegistry.loadAnalyzersForStrategy(
        this.strategy
      );
      const signals = await Promise.all(
        analyzers.map(a => a.analyze(candle, this.getContext()))
      );

      // PHASE 4: Aggregate signals
      const aggregated = this.strategyCoordinator.aggregateSignals(signals);
      if (!aggregated.direction) {
        this.logger.debug('No clear signal');
        return;
      }

      // PHASE 5: Apply filters
      const filterResult = this.filterOrchestrator.evaluateFilters({
        signal: aggregated,
        ...this.getContext(),
      });
      if (!filterResult.allowed) {
        this.logger.debug('Signal blocked by filter', {
          blockedBy: filterResult.blockedBy,
        });
        return;
      }

      // PHASE 6: Entry decision
      const entryDecision = this.entryOrchestrator.evaluate(
        aggregated,
        this.getCurrentTrend(),
        [this.positionLifecycle.getCurrentPosition()].filter(Boolean) as Position[]
      );

      if (entryDecision !== 'ENTER') {
        this.logger.debug('Entry decision: ' + entryDecision);
        return;
      }

      // PHASE 7: Risk approval
      const riskApproval = this.riskManager.approveRisk(
        aggregated,
        this.getAccountBalance(),
        [this.positionLifecycle.getCurrentPosition()].filter(Boolean) as Position[]
      );

      if (!riskApproval.approved) {
        this.logger.warn('Risk rejected', { reason: riskApproval.reason });
        return;
      }

      // PHASE 8: Open position
      await this.positionLifecycle.openPosition(aggregated, riskApproval.positionSize);

      // PHASE 9: Monitor exit (if position opened)
      const position = this.positionLifecycle.getCurrentPosition();
      if (position) {
        await this.monitorExit(position, candle.close);
      }
    } catch (error) {
      this.logger.error('Error in orchestrator', error);
    } finally {
      const duration = Date.now() - startTime;
      this.logger.debug('Orchestrator cycle complete', { durationMs: duration });
    }
  }

  /**
   * Monitor exit conditions for open position
   */
  private async monitorExit(position: Position, currentPrice: number): Promise<void> {
    const exitDecision = this.exitOrchestrator.evaluate(position, currentPrice);

    if (exitDecision.actions.length === 0) {
      return; // No action needed
    }

    for (const action of exitDecision.actions) {
      if (action.type === 'CLOSE') {
        await this.positionLifecycle.closePosition(action.reason);
        return; // Position closed, done monitoring
      }

      if (action.type === 'UPDATE_SL') {
        await this.positionLifecycle.updateStopLoss(action.newSL);
      }

      if (action.type === 'ACTIVATE_TRAILING') {
        await this.positionLifecycle.activateTrailing(action.trailingDistance);
      }
    }
  }

  private isPrimaryTFClosed(timeframe: string): boolean {
    const primaryTF = this.config.timeframes.primary;
    return timeframe === primaryTF;
  }

  private isEntryTFClosed(timeframe: string): boolean {
    const entryTF = this.config.timeframes.entry;
    return timeframe === entryTF;
  }

  private getCurrentTrend() {
    return this.trendService.getCurrentTrend();
  }

  private getContext() {
    return {
      trend: this.getCurrentTrend(),
      // ... other context
    };
  }

  private getAccountBalance(): number {
    // Fetch from exchange or cache
    return 10000; // Example
  }
}
```

---

## 6️⃣ EVENT BUS (Decoupling)

### Code Structure

```typescript
// File: src/services/event-bus.ts
export class BotEventBus {
  private emitter = new EventEmitter();

  /**
   * Subscribe to bot event
   */
  on(event: string, handler: (data: any) => void): void {
    this.emitter.on(event, handler);
  }

  /**
   * Emit event
   */
  emit(event: string, data: any): void {
    this.emitter.emit(event, data);
  }

  /**
   * Unsubscribe
   */
  off(event: string, handler: (data: any) => void): void {
    this.emitter.off(event, handler);
  }
}
```

### Usage (Decoupled Components)

```typescript
// In TradingJournalService
eventBus.on('positionOpened', (position) => {
  this.logEntry(position);
});

eventBus.on('positionClosed', (position) => {
  this.logExit(position);
});

// In TelegramService
eventBus.on('positionOpened', (position) => {
  this.sendAlert(`Position opened: ${position.direction}`);
});

eventBus.on('positionClosed', (position) => {
  this.sendAlert(`Position closed: ${position.pnl > 0 ? '✅' : '❌'}`);
});

// In SessionStatsService
eventBus.on('positionClosed', (position) => {
  this.updateWinRate(position.pnl);
  this.updateDailyStats();
});

// All happen independently - if one fails, others still work!
```

---

## 7️⃣ ANALYZER LOADING (Pluggable)

### Code Structure

```typescript
// File: src/services/analyzer-registry.service.ts
export class AnalyzerRegistryService {
  private loadedAnalyzers: Map<string, AnalyzerInstance> = new Map();

  /**
   * Load only enabled analyzers from strategy config
   */
  async loadAnalyzersForStrategy(strategy: StrategyConfig): Promise<AnalyzerInstance[]> {
    const analyzers: AnalyzerInstance[] = [];

    // RSI Analyzer
    if (strategy.analyzers.rsi?.enabled) {
      const RsiAnalyzer = await this.loadAnalyzerClass('RSI');
      analyzers.push(
        new RsiAnalyzer(strategy.analyzers.rsi, this.logger, this.indicatorCache)
      );
    }

    // EMA Analyzer
    if (strategy.analyzers.ema?.enabled) {
      const EmaAnalyzer = await this.loadAnalyzerClass('EMA');
      analyzers.push(
        new EmaAnalyzer(strategy.analyzers.ema, this.logger, this.indicatorCache)
      );
    }

    // ... etc for all 28 analyzers

    return analyzers;
  }

  private async loadAnalyzerClass(name: string): Promise<any> {
    // Lazy-load analyzer class
    const module = await import(`../analyzers/${name.toLowerCase()}.analyzer-new`);
    return module[`${name}AnalyzerNew`];
  }
}
```

### Strategy Config (JSON)

```json
{
  "analyzers": {
    "rsi": {
      "enabled": true,
      "period": 14,
      "overbought": 70,
      "oversold": 30
    },
    "ema": {
      "enabled": true,
      "fast": 20,
      "slow": 50
    },
    "breakout": {
      "enabled": false
    },
    "divergence": {
      "enabled": true,
      "lookback": 50
    }
  }
}
```

### Result: Only loaded analyzers run
- RSI: ✅ loaded
- EMA: ✅ loaded
- Breakout: ❌ skipped
- Divergence: ✅ loaded

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 0.2: Indicator Cache
- [ ] Create `IndicatorCacheService`
- [ ] Update 3 main analyzers (RSI, EMA, ATR)
- [ ] Clear cache on new candle
- [ ] Test backtesting shows same results
- [ ] Measure CPU improvement

### Phase 0.3: Decision Functions
- [ ] Extract `evaluateEntry()` to pure function
- [ ] Extract `evaluateExit()` to pure function
- [ ] Write unit tests for pure functions
- [ ] Update orchestrators to call pure functions
- [ ] Verify same behavior as before

### Phase 1: Action Queue
- [ ] Create `ActionQueueService`
- [ ] Create action handlers (OpenPosition, ClosePosition)
- [ ] Update orchestrator to use queue
- [ ] Test queue processes correctly
- [ ] Verify no performance regression

---

## 📚 References

- **Main Architecture:** `ARCHITECTURE_LEGO_BLUEPRINT.md`
- **Config Types:** `src/types/config-new.types.ts`
- **Existing Examples:** `src/indicators/ema.indicator-new.ts`
- **Testing Examples:** `src/__tests__/indicators/ema.indicator-new.test.ts`

---

**Version:** 1.0
**Status:** Ready for Phase 0.2 Implementation
