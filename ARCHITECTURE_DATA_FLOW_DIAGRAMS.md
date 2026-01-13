# 📊 Architecture Data Flow Diagrams

Visual representation of how data flows through LEGO blocks

---

## 1. MAIN TRADING CYCLE (1 Minute Loop)

```
┌─ Every 1 minute (ENTRY TF closes) ──────────────────────────────────────┐
│                                                                           │
│   1m Candle Close Event                                                  │
│   ↓                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │ TradingOrchestrator.onCandleClosed(candle)                  │       │
│   └──────────────────────────────────────────────────────────────┘       │
│   ↓                                                                       │
│   ┌─ IF PRIMARY TF Closed (e.g., 4h) ──────────────────────────┐        │
│   │ ├─ MultiTimeframeTrendService.analyzeTrend()              │        │
│   │ │   ├─ Get candles (CandleProvider)                        │        │
│   │ │   ├─ Calculate EMA, RSI (with IndicatorCache)           │        │
│   │ │   ├─ Find swing points (SwingPointDetectorService)      │        │
│   │ │   └─ → TrendContext (bias, strength, support/resistance)│        │
│   │ └─ Update global trend state                               │        │
│   └────────────────────────────────────────────────────────────┘        │
│   ↓                                                                       │
│   ┌─ Run All Enabled Analyzers (Parallel) ──────────────────┐           │
│   │ ├─ RSI Analyzer                                          │           │
│   │ │   ├─ Check IndicatorCache: "RSI-14-1h"               │           │
│   │ │   ├─ If cache hit: use cached value                  │           │
│   │ │   ├─ If cache miss: calculate RSI                    │           │
│   │ │   ├─ Cache result                                     │           │
│   │ │   └─ → AnalyzerSignal { direction, confidence }     │           │
│   │ │                                                       │           │
│   │ ├─ EMA Analyzer                                          │           │
│   │ │   ├─ Check IndicatorCache: "EMA-20-1h", "EMA-50-1h"  │           │
│   │ │   ├─ Calculate cross or alignment                     │           │
│   │ │   └─ → AnalyzerSignal                                │           │
│   │ │                                                       │           │
│   │ ├─ [24 more analyzers...]                               │           │
│   │ │                                                       │           │
│   │ └─ Promise.all() → [Signal1, Signal2, ...]             │           │
│   └───────────────────────────────────────────────────────┘           │
│   ↓                                                                       │
│   ┌─ Aggregate All Signals ─────────────────────────────────┐           │
│   │ StrategyCoordinator.aggregateSignals([S1, S2, ...])     │           │
│   │   ├─ Get weights for each analyzer from strategy        │           │
│   │   ├─ Calculate weighted score:                           │           │
│   │   │   score = sum(confidence * weight) / sum(weights)   │           │
│   │   ├─ Check blind zone penalty (min signal count)        │           │
│   │   └─ → AggregatedSignal {                               │           │
│   │       direction: LONG|SHORT,                            │           │
│   │       confidence: 0-100,                                │           │
│   │       entryPrice, stopLoss, takeProfits }              │           │
│   └─────────────────────────────────────────────────────────┘           │
│   ↓                                                                       │
│   ┌─ Apply Filters (Sequential) ────────────────────────────┐           │
│   │ FilterOrchestrator.evaluateFilters(signal)              │           │
│   │   ├─ [Filter 1] Blind Zone                              │           │
│   │   │   └─ min signal count met? → NO? SKIP this signal  │           │
│   │   │                                                     │           │
│   │   ├─ [Filter 2] Flat Market                             │           │
│   │   │   └─ market structure OK? → NO? SKIP               │           │
│   │   │                                                     │           │
│   │   ├─ [Filter 3] Funding Rate (perps only)               │           │
│   │   │   └─ funding rate OK? → NO? SKIP                   │           │
│   │   │                                                     │           │
│   │   ├─ [Filter 4] BTC Correlation                         │           │
│   │   │   └─ signal aligned with BTC? → NO? SKIP           │           │
│   │   │                                                     │           │
│   │   ├─ [Filter 5] Trend Alignment                         │           │
│   │   │   └─ signal matches trend? → NO? SKIP              │           │
│   │   │                                                     │           │
│   │   ├─ [Filter 6-9] Other filters...                      │           │
│   │   │                                                     │           │
│   │   └─ → FilterResult { allowed: YES|NO, reason }        │           │
│   └─────────────────────────────────────────────────────────┘           │
│   ↓                                                                       │
│   IF blocked by filter → SKIP signal, back to waiting                   │
│   ↓                                                                       │
│   ┌─ Entry Decision Logic ──────────────────────────────────┐           │
│   │ EntryOrchestrator.evaluate(signal, trend, position)     │           │
│   │   ├─ Already in position?                               │           │
│   │   │   └─ YES? → Decision: SKIP                         │           │
│   │   │                                                     │           │
│   │   ├─ Confidence >= min threshold?                       │           │
│   │   │   └─ NO? → Decision: SKIP                          │           │
│   │   │                                                     │           │
│   │   ├─ Signal aligned with current trend?                 │           │
│   │   │   └─ NO? → Decision: WAIT                          │           │
│   │   │                                                     │           │
│   │   └─ All checks pass?                                   │           │
│   │       └─ YES? → Decision: ENTER                        │           │
│   └─────────────────────────────────────────────────────────┘           │
│   ↓                                                                       │
│   IF decision != ENTER → back to waiting                                 │
│   ↓                                                                       │
│   ┌─ Risk Approval (Gatekeeper) ────────────────────────────┐           │
│   │ RiskManager.approveRisk(signal)                         │           │
│   │   ├─ Daily loss limit reached?                          │           │
│   │   │   └─ YES? → REJECT                                 │           │
│   │   │                                                     │           │
│   │   ├─ Loss streak penalty?                               │           │
│   │   │   └─ Reduce size by 50-75% (or stop)              │           │
│   │   │                                                     │           │
│   │   ├─ Max concurrent positions exceeded?                 │           │
│   │   │   └─ YES? → REJECT                                 │           │
│   │   │                                                     │           │
│   │   ├─ Calculate position size:                           │           │
│   │   │   size = (balance * riskPercent) / (entry - SL)    │           │
│   │   │   size = size * loss_streak_multiplier              │           │
│   │   │   size = clamp(size, minSize, maxSize)             │           │
│   │   │                                                     │           │
│   │   └─ → RiskDecision { approved, positionSize }         │           │
│   └─────────────────────────────────────────────────────────┘           │
│   ↓                                                                       │
│   IF not approved → back to waiting                                      │
│   ↓                                                                       │
│   ┌─ MTF Snapshot Gate (Race Condition Prevention) ──────────┐           │
│   │ MTFSnapshotGate.capture()                               │           │
│   │   └─ Save current HTF trend state snapshot              │           │
│   │       (prevents HTF change during ENTRY execution)      │           │
│   └──────────────────────────────────────────────────────────┘           │
│   ↓                                                                       │
│   ┌─ POSITION OPENING ──────────────────────────────────────┐           │
│   │ PositionLifecycleService.openPosition(signal, size)     │           │
│   │   ├─ Create Position object with:                       │           │
│   │   │   • entryPrice = current candle close               │           │
│   │   │   • direction = signal.direction                    │           │
│   │   │   • quantity = risk-approved size                   │           │
│   │   │   • stopLoss = support - margin                     │           │
│   │   │   • takeProfits = [TP1, TP2, TP3]                  │           │
│   │   │   • state = "OPENING"                               │           │
│   │   │                                                     │           │
│   │   ├─ BybitService.openPosition(position)                │           │
│   │   │   ├─ Send REST API call to exchange                │           │
│   │   │   ├─ Set SL and TP conditional orders               │           │
│   │   │   └─ ← Position created at exchange                │           │
│   │   │                                                     │           │
│   │   ├─ Update position state to "OPEN"                    │           │
│   │   │                                                     │           │
│   │   ├─ BotEventBus.emit('positionOpened', position)       │           │
│   │   │   ├─ → TradingJournal logs entry                   │           │
│   │   │   ├─ → SessionStats updates counters              │           │
│   │   │   ├─ → Telegram sends alert                        │           │
│   │   │   └─ → RiskManager updates exposure                │           │
│   │   │                                                     │           │
│   │   ├─ PositionMonitor.startMonitoring()                 │           │
│   │   │   └─ Subscribe to WebSocket price updates          │           │
│   │   │                                                     │           │
│   │   └─ Store in currentPosition                           │           │
│   └──────────────────────────────────────────────────────────┘           │
│   ↓                                                                       │
│   Position now OPEN, waiting for exit signals...                         │
│                                                                           │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 2. POSITION MONITORING & EXIT (Continuous)

```
Position is OPEN (state = "OPEN")
│
├─ WebSocket stream delivers price updates every tick
│  ├─ Position price update: equity, margin ratio, etc
│  └─ → PositionMonitor receives update
│
└─ Every candle close (1m, 5m, 15m, 1h, etc):
   │
   ├─ TradingOrchestrator.onCandleClosed(candle)
   │  ├─ Check: is position still open?
   │  │  └─ YES → continue to exit evaluation
   │  │
   │  └─ ExitOrchestrator.evaluateExit(position, price)
   │     │
   │     ├─ [Check 1] Stop Loss Hit?
   │     │  ├─ currentPrice < position.stopLoss?
   │     │  │  └─ YES → ExitAction { type: CLOSE, reason: SL_HIT, close%: 100 }
   │     │  │
   │     │  └─ Price fell below SL?
   │     │     └─ Return immediately (SL has priority)
   │     │
   │     ├─ [Check 2] Take Profit 3 Hit? (Final exit)
   │     │  ├─ currentPrice >= position.tp3?
   │     │  │  └─ YES → ExitAction { CLOSE, reason: TP3_HIT, close%: 100 }
   │     │  │
   │     │  └─ Position liquidated at highest profit target
   │     │
   │     ├─ [Check 3] Take Profit 2 Hit? (Partial exit + trailing)
   │     │  ├─ currentPrice >= position.tp2?
   │     │  │  ├─ YES → ExitAction { CLOSE, reason: TP2_HIT, close%: 40 }
   │     │  │  ├─ AND → ExitAction { UPDATE_SL, newSL: breakeven }
   │     │  │  └─ AND → ExitAction { ACTIVATE_TRAILING, distance: 0.5% }
   │     │  │
   │     │  └─ Close 40%, move SL to breakeven, activate trailing
   │     │
   │     ├─ [Check 4] Take Profit 1 Hit? (Partial exit + move to BE)
   │     │  ├─ currentPrice >= position.tp1?
   │     │  │  ├─ YES → ExitAction { CLOSE, reason: TP1_HIT, close%: 60 }
   │     │  │  └─ AND → ExitAction { UPDATE_SL, newSL: breakeven + offset }
   │     │  │
   │     │  └─ Close 60%, move SL to breakeven + protection
   │     │
   │     ├─ [Check 5] Trailing Stop Active?
   │     │  ├─ (only if activated after TP2 hit)
   │     │  ├─ price fell > trailing distance?
   │     │  │  └─ YES → ExitAction { CLOSE, reason: TRAILING_HIT, close%: 100 }
   │     │  │
   │     │  └─ Close remaining position on trailing stop
   │     │
   │     └─ [No action needed?]
   │        └─ Return empty action list
   │           (Position continues being monitored)
   │
   └─ Execute all exit actions:
      │
      ├─ IF action.type = CLOSE:
      │  │
      │  ├─ PositionExitingService.closePosition(close%)
      │  │  │
      │  │  ├─ BybitService.closePosition(position.id, close%)
      │  │  │  ├─ Send market order to close percentage
      │  │  │  └─ ← Position partially/fully closed at exchange
      │  │  │
      │  │  ├─ Update position state
      │  │  │  └─ state = close% === 100 ? "CLOSED" : "PARTIAL"
      │  │  │
      │  │  ├─ Calculate realized PnL
      │  │  │  └─ pnl = (closePrice - entryPrice) * quantity * direction
      │  │  │
      │  │  ├─ BotEventBus.emit('positionClosed', position)
      │  │  │  ├─ → TradingJournal logs exit (entry, exit price, PnL)
      │  │  │  ├─ → SessionStats updates (W/L, streak, daily PnL)
      │  │  │  ├─ → Telegram sends alert (✅ WIN $X or ❌ LOSS -$X)
      │  │  │  └─ → RiskManager updates (daily PnL, loss streak)
      │  │  │
      │  │  ├─ PositionMonitor.stopMonitoring()
      │  │  │  └─ Unsubscribe from WebSocket updates
      │  │  │
      │  │  └─ Clear currentPosition = null
      │  │
      │  └─ IF close% = 100:
      │     └─ Back to waiting for next entry signal
      │
      │  └─ IF close% < 100:
      │     └─ Continue monitoring remaining position
      │
      ├─ IF action.type = UPDATE_SL:
      │  │
      │  ├─ PositionExitingService.updateStopLoss(newSL)
      │  │  ├─ BybitService.updateStopLoss(position.id, newSL)
      │  │  └─ ← SL updated at exchange
      │  │
      │  ├─ Update position.stopLoss = newSL
      │  │
      │  └─ Log: "SL moved to breakeven" or similar
      │
      └─ IF action.type = ACTIVATE_TRAILING:
         │
         ├─ PositionExitingService.activateTrailing(distance)
         │  ├─ BybitService.activateTrailing(position.id, distance)
         │  └─ ← Trailing stop activated at exchange
         │
         ├─ Update position.trailingActive = true
         │
         └─ Log: "Trailing stop activated at X% distance"
```

---

## 3. MEMORY CACHING LIFECYCLE

```
Every Loop Iteration (1 minute):
│
├─ START OF LOOP
│  └─ IndicatorCache populated from previous iteration? NO (empty on new candle)
│
└─ ANALYZER EXECUTION:
   │
   ├─ RSI Analyzer needs: RSI-14-1h
   │  ├─ Check cache: "RSI-14-1h"?
   │  │  ├─ CACHE MISS (first access this minute)
   │  │  ├─ Calculate RSI from candles
   │  │  ├─ Store in cache: cache.set("RSI-14-1h", value)
   │  │  └─ Return result
   │  │
   │  └─ RSI Analyzer needs: RSI-21-1h
   │     ├─ Check cache: "RSI-21-1h"?
   │     │  ├─ CACHE MISS
   │     │  ├─ Calculate
   │     │  ├─ Store
   │     │  └─ Return
   │
   ├─ EMA Analyzer needs: EMA-20-1h, EMA-50-1h
   │  ├─ Check cache: "EMA-20-1h"?
   │  │  ├─ CACHE MISS
   │  │  ├─ Calculate
   │  │  ├─ Store
   │  │  └─ Return
   │  │
   │  └─ Check cache: "EMA-50-1h"?
   │     ├─ CACHE MISS
   │     ├─ Calculate
   │     ├─ Store
   │     └─ Return
   │
   ├─ Trend Analyzer needs: EMA-20-1h (again!)
   │  └─ Check cache: "EMA-20-1h"?
   │     ├─ CACHE HIT ✓ (already calculated by EMA analyzer)
   │     ├─ Increment hitCount++
   │     ├─ Update lastAccessed timestamp
   │     └─ Return cached value (NO RECALCULATION)
   │
   ├─ [24 more analyzers...]
   │  └─ Many hit the same cached values
   │
   └─ Cache stats after analyzers:
      ├─ Size: ~150 entries (out of 500 max)
      ├─ Hit rate: ~70% (many analyzers use same indicators)
      └─ CPU saved: ~40% compared to recalculating

LOOP ENDS:
│
├─ New 1m candle arrives
│  └─ CandleProvider: "newCandle" event
│
└─ TradingOrchestrator.onCandleClosed()
   └─ IndicatorCache.clear()
      ├─ cache.clear() (remove all 150 entries)
      └─ Ready for next minute

┌─ Memory Usage ────────────────────────────────┐
│                                               │
│ CandleProvider cache:      ~240 KB           │
│   (100 candles × 8 TFs)                      │
│                                               │
│ IndicatorCache:            ~50 KB            │
│   (150 entries × 100 bytes - cleared each min)│
│                                               │
│ Trend context:             ~1 KB             │
│                                               │
│ Active position:           ~5 KB             │
│                                               │
│ Event listeners:           ~100 KB           │
│                                               │
│ ────────────────────────────────────────────  │
│ TOTAL:                    ~396 KB            │
│ (plus Node.js/V8 overhead ~50 MB)           │
│                                               │
└───────────────────────────────────────────────┘
```

---

## 4. EVENT FLOW (Decoupled Components)

```
Position opened at exchange
│
└─ PositionLifecycleService.openPosition()
   │
   ├─ Position created at BybitService
   │
   └─ BotEventBus.emit('positionOpened', { position })
      │
      ├─→ TradingJournalService listener
      │   ├─ Logs to file: entry price, direction, size, SL, TP
      │   └─ Stores in in-memory journal (last 100 trades)
      │
      ├─→ SessionStatsService listener
      │   ├─ Increments total_trades counter
      │   ├─ Starts tracking this trade
      │   └─ Updates live session stats
      │
      ├─→ TelegramService listener
      │   ├─ Constructs message:
      │   │   "📈 LONG XRP/USDT
      │   │    Entry: $2.50
      │   │    SL: $2.45 (-2.0%)
      │   │    TP1/2/3: $2.56, $2.62, $2.68
      │   │    Size: 10,000 XRP"
      │   └─ Sends via Telegram API (async)
      │
      ├─→ RiskManager listener
      │   ├─ Updates totalExposure counter
      │   └─ Tracks this position risk
      │
      └─→ ConsoleDashboard listener
          ├─ Updates display with new position
          └─ Shows live P&L and status

═══════════════════════════════════════════════════════

Position closed (TP3 hit)
│
└─ PositionExitingService.closePosition()
   │
   ├─ Position closed at BybitService
   ├─ Calculate PnL: +$150 (20% profit on initial risk)
   │
   └─ BotEventBus.emit('positionClosed', { position, pnl: 150 })
      │
      ├─→ TradingJournalService listener
      │   ├─ Logs to file: exit price, close reason (TP3_HIT), PnL, %
      │   └─ Completes trade record
      │
      ├─→ SessionStatsService listener
      │   ├─ Increments win counter (pnl > 0)
      │   ├─ Resets loss streak to 0
      │   ├─ Updates daily PnL: +$150
      │   └─ Calculates new win rate: 55% (11 wins / 20 trades)
      │
      ├─→ TelegramService listener
      │   ├─ Constructs message:
      │   │   "✅ CLOSED XRP/USDT LONG
      │   │    Exit: $2.68 (TP3_HIT)
      │    Entry: $2.50 → Exit: $2.68
      │    Profit: +$150 (+20%)
      │    Duration: 45 minutes"
      │   └─ Sends via Telegram
      │
      ├─→ RiskManager listener
      │   ├─ Updates dailyPnL: +$150
      │   ├─ Resets consecutiveLosses to 0
      │   └─ Frees up position slot
      │
      └─→ ConsoleDashboard listener
          ├─ Removes position from display
          ├─ Updates daily stats
          └─ Shows updated win rate

═══════════════════════════════════════════════════════

All listeners work INDEPENDENTLY
├─ If TradingJournal fails: others still work ✓
├─ If Telegram fails: journal still logs ✓
├─ If RiskManager fails: position still closed ✓
└─ No cascading failures!
```

---

## 5. STRATEGY CONFIGURATION FLOW

```
strategy.json (loaded at startup)
│
├─ analyzers:
│  ├─ rsi: { enabled: true, period: 14 }
│  ├─ ema: { enabled: true, fast: 20, slow: 50 }
│  ├─ breakout: { enabled: false }
│  └─ ... (28 total analyzers)
│
├─ filters:
│  ├─ blindZone: { minSignalsForLong: 3, minSignalsForShort: 3 }
│  ├─ flatMarket: { enabled: true, ... }
│  ├─ fundingRate: { enabled: true, maxRate: 0.001 }
│  └─ ... (9 total filters)
│
├─ risk:
│  ├─ dailyLimits: { maxDailyLossPercent: 5 }
│  ├─ positionSizing: { riskPerTradePercent: 1.0, minSize: 100, maxSize: 10000 }
│  └─ lossStreakPenalty: { after2: 0.5, after3: 0.25, after4: stop }
│
└─ timeframes:
   ├─ primary: "4h"     (global trend)
   ├─ entry: "1m"       (when to open)
   └─ trend: "1h"       (secondary context)

         ↓ (BotFactory loads config)

AnalyzerRegistry.loadAnalyzersForStrategy(config)
├─ Instantiate RSI Analyzer (enabled) ✓
├─ Instantiate EMA Analyzer (enabled) ✓
├─ Skip Breakout Analyzer (disabled) ✗
└─ Instantiate 24 other enabled analyzers

FilterOrchestrator.loadFiltersFromConfig(config)
├─ Load BlindZone filter with minSignals: 3
├─ Load FlatMarket filter
├─ Load FundingRate filter
└─ Load 6 other filters

RiskManager initialized with config
├─ dailyLossPercent = 5%
├─ riskPerTradePercent = 1%
└─ lossStreakMultipliers loaded

         ↓ (Every candle)

TradingOrchestrator.onCandleClosed()
├─ Run only enabled analyzers (RPM, EMA, ...)
├─ Skip disabled analyzers (Breakout)
├─ Apply only enabled filters (BlindZone, FlatMarket, ...)
├─ Use risk config for position sizing
└─ Use timeframe config for entry logic

         ↓ (Result)

Zero code changes needed!
├─ Change strategy JSON → different behavior
├─ Enable/disable analyzers → different signals
├─ Change filter thresholds → different filtering
└─ Adjust risk parameters → different position sizing
```

---

## 6. COMPONENT DEPENDENCY TREE (Minimal)

```
BotFactory
│
├─ Logger (singleton)
│  └─ Used by: every service
│
├─ EventBus (singleton)
│  └─ Used by: PositionLifecycle, services that emit events
│
├─ CandleProvider
│  ├─ Uses: BybitService (fetch candles)
│  └─ Used by: TrendService, TradingOrchestrator
│
├─ IndicatorCache (NEW Phase 0.2)
│  └─ Used by: Every analyzer
│
├─ TrendService
│  ├─ Uses: CandleProvider, IndicatorCache
│  └─ Used by: TradingOrchestrator, EntryOrchestrator
│
├─ AnalyzerRegistry
│  ├─ Creates: RSI, EMA, ... 28 analyzers
│  ├─ Each analyzer uses: IndicatorCache
│  └─ Used by: TradingOrchestrator
│
├─ StrategyCoordinator
│  └─ Used by: TradingOrchestrator
│
├─ FilterOrchestrator
│  └─ Used by: TradingOrchestrator
│
├─ RiskManager (singleton)
│  ├─ Tracks: dailyPnL, consecutiveLosses, exposure
│  └─ Used by: EntryOrchestrator, event listeners
│
├─ EntryOrchestrator
│  ├─ Uses: RiskManager
│  └─ Used by: TradingOrchestrator
│
├─ ExitOrchestrator
│  └─ Used by: TradingOrchestrator
│
├─ PositionLifecycleService
│  ├─ Uses: BybitService, EventBus, Logger
│  ├─ Emits: positionOpened, positionClosed
│  └─ Used by: TradingOrchestrator
│
├─ TradingOrchestrator (main loop)
│  ├─ Uses: All above components
│  └─ Called on: Every 1m candle
│
├─ Event Listeners (independent):
│  ├─ TradingJournal (listens: positionOpened, positionClosed)
│  ├─ SessionStats (listens: positionOpened, positionClosed)
│  ├─ TelegramService (listens: positionOpened, positionClosed)
│  └─ ConsoleDashboard (listens: events)
│
└─ BybitService (exchange connector)
   ├─ REST: getCandles(), openPosition(), closePosition()
   ├─ WebSocket: price updates, position updates
   └─ Used by: CandleProvider, PositionLifecycle, PositionExiting

```

---

## Summary

Key Data Flows:

1. **Signal Generation:** Candle → Analyzers → Cached Indicators → Signals
2. **Signal Aggregation:** Signals → Weighted Score → Confidence
3. **Filtering:** Score → 9 Sequential Filters → Allow/Block
4. **Entry Decision:** Filter Result → Decision Logic → ENTER/SKIP/WAIT
5. **Risk Approval:** Decision → Risk Checks → Position Size
6. **Position Opening:** Risk Approval → BybitService → Event → Listeners
7. **Position Monitoring:** WebSocket prices → Exit Logic → Exit Actions
8. **Position Closing:** Exit Action → BybitService → Event → Listeners
9. **Cache Lifecycle:** Per-candle clear → Prevent memory leaks

Memory Management:
- CandleProvider: 100 candles per TF (LRU)
- IndicatorCache: 500 entries max (LRU), clear on new candle
- Total: ~1.5 MB memory (excluding Node.js)

---

**Version:** 1.0
**Status:** Visual reference for implementation
