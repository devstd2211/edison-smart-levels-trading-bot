# 🎯 Phase 11: Dynamic Position Sizing - Progress Tracker

**Status:** 🚀 IN PROGRESS
**Started:** 2026-02-09 (Session 96)
**Estimated Duration:** 2-3 weeks
**Target:** 65 tests total

---

## 📋 Overview

Phase 11 introduces intelligent position sizing based on risk management, signal strength, and market volatility. This replaces fixed position sizes with dynamic calculations that optimize risk-adjusted returns.

---

## 🎯 Phase 11.1: Risk-Based Entry Sizing (47 tests) ✅

### Service: DynamicPositionSizerService
**Goal:** Calculate optimal position size based on account risk, signal strength, and volatility

**Status:** ✅ **COMPLETE** (2026-02-09, Session 96)

#### Core Methods
- [x] `calculateOptimalSize()` - Main sizing calculation
- [x] `adjustForVolatility()` - ATR-based adjustment
- [x] `adjustForAccountRisk()` - Account balance protection
- [x] `calculateMaxPosition()` - Maximum allowed position

#### Test Breakdown (47 tests) ✅
- [x] **6 THROW tests** - Config validation (null config, invalid risk%, etc.)
- [x] **6 THROW tests** - Input validation (null prices, negative values, NaN)
- [x] **8 GRACEFUL_DEGRADE tests** - Calculation failures (division by zero, extreme values)
- [x] **4 SKIP tests** - Logging failures
- [x] **6 Integration tests** - E2E scenarios (low/med/high confidence, volatile markets)
- [x] **4 Backward compat tests** - Works without ErrorHandler
- [x] **13 Helper method tests** - adjustForVolatility, adjustForAccountRisk, calculateMaxPosition

#### Implementation Details
```typescript
interface SizingDecision {
  baseSize: number;           // Initial calculated size
  adjustedSize: number;       // Final size after adjustments
  riskPercent: number;        // Risk as % of account
  maxRisk: number;            // Maximum allowed risk ($)
  recommendation: 'increase' | 'maintain' | 'reduce';
  confidence: number;         // Signal confidence factor
  volatilityAdjustment: number; // ATR-based multiplier
}

interface SizingConfig {
  baseRiskPercent: number;    // e.g., 1% per trade
  maxRiskPercent: number;     // e.g., 3% maximum
  minPositionSize: number;    // Minimum order size
  maxPositionSize: number;    // Maximum order size
  volatilityMultiplier: number; // ATR adjustment factor
  confidenceThreshold: number;  // Minimum confidence to trade
}
```

#### Recovery Strategies
- **THROW:** Invalid config (null, negative risk%), invalid inputs (null prices, NaN)
- **GRACEFUL_DEGRADE:** Calculation failures → return minimum position size
- **SKIP:** Logging failures

---

## 🎯 Phase 11.2: Position Scaling (~30 tests)

### Service: PositionScalingService
**Goal:** Scale positions in/out based on winning probability and profit targets

**Status:** ⏳ NOT STARTED

#### Core Methods
- [ ] `scaleIntoWinner()` - Add to winning positions
- [ ] `reduceRiskOnProfit()` - Move SL to breakeven
- [ ] `calculateScaleSize()` - Size for additional entries
- [ ] `shouldScale()` - Determine if scaling is appropriate

#### Test Breakdown (30 tests)
- [ ] **5 THROW tests** - Config validation
- [ ] **5 THROW tests** - Input validation
- [ ] **7 GRACEFUL_DEGRADE tests** - Calculation failures
- [ ] **4 SKIP tests** - Logging failures
- [ ] **5 Integration tests** - E2E scaling scenarios
- [ ] **3 Backward compat tests** - Works without ErrorHandler
- [ ] **1 Edge case test** - Scale at breakeven

#### Implementation Details
```typescript
interface ScaleAction {
  action: 'add' | 'reduce' | 'hold';
  size: number;             // Size to add/reduce
  newStopLoss: number;      // Updated SL after scale
  reasoning: string;        // Why this action
  confidence: number;       // Confidence in scale decision
}

interface ScalingConfig {
  scaleInThreshold: number;   // % profit to scale in
  maxScales: number;          // Maximum scale-ins
  scaleReduction: number;     // Reduce size each scale (e.g., 0.5x)
  breakevenThreshold: number; // Move SL to BE at X% profit
}
```

#### Recovery Strategies
- **THROW:** Invalid config, invalid position state
- **GRACEFUL_DEGRADE:** Calculation failures → return 'hold' action
- **SKIP:** Logging failures

---

## 📊 Progress Summary

| Component | Tests | Status |
|-----------|-------|--------|
| DynamicPositionSizerService | 47/47 | ✅ **COMPLETE** |
| PositionScalingService | 0/30 | ⏳ Not Started |
| **TOTAL** | **47/77** | **61%** |

---

## 🎯 Success Metrics

- [ ] Position sizing within 1% of optimal Kelly Criterion
- [ ] Risk per trade never exceeds configured maximum
- [ ] Volatile markets automatically reduce position size
- [ ] High-confidence signals get larger positions
- [ ] Account heat monitored (sum of all position risks)
- [ ] Zero division-by-zero crashes
- [ ] All tests passing with 0 regressions

---

## 🔑 Key Design Principles

1. **Kelly Criterion-Based:** Use modified Kelly for optimal sizing
2. **Volatility-Aware:** ATR/ADR adjusts position size
3. **Confidence-Weighted:** Higher confidence = larger size (within limits)
4. **Account Protection:** Never risk more than max% per trade
5. **Backward Compatible:** Works with/without ErrorHandler
6. **Production-Ready:** All magic numbers in config/constants

---

## 📝 Implementation Notes

### Phase 11.1: DynamicPositionSizerService
- Use Kelly Criterion: f* = (p*b - q) / b
  - p = win probability (from signal confidence)
  - q = loss probability (1 - p)
  - b = win/loss ratio (RR ratio)
- Limit Kelly output to max 2-3% (full Kelly too aggressive)
- ATR adjustment: size *= (avgATR / currentATR)
- Account heat: sum of all open position risks

### Phase 11.2: PositionScalingService
- Scale in at 50% of TP1, 75% of TP2 (configurable)
- Reduce size each scale: 100% → 50% → 25%
- Move SL to breakeven after first scale
- Never exceed max position size across all scales

---

## 🔗 Related Files

**Core Files:**
- `src/services/dynamic-position-sizer.service.ts` (to create)
- `src/services/position-scaling.service.ts` (to create)
- `src/constants/phase-11-constants.ts` (to create)

**Test Files:**
- `src/__tests__/services/dynamic-position-sizer.test.ts` (to create)
- `src/__tests__/services/position-scaling.test.ts` (to create)

**Config:**
- `config.json` - Add Phase 11 strategic parameters

**Documentation:**
- `CLAUDE.md` - Update build status
- `ARCHITECTURE_QUICK_START.md` - Add Phase 11 services
- `MEMORY.md` - Update progress

---

**Version:** 1.0
**Last Updated:** 2026-02-09 (Session 96)
**Next Task:** Implement DynamicPositionSizerService
