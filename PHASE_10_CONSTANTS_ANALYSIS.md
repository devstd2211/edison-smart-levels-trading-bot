# Phase 10 Constants Analysis
## Strategic vs Technical Parameters

## Legend
- 🎯 **STRATEGIC** - Влияют на торговые решения, должны быть в config
- 🔧 **TECHNICAL** - Внутренние ограничения/формулы, можно оставить константами

---

## 1. ADVANCED_ORDER_FLOW

### 🎯 STRATEGIC (в config):
- `MOMENTUM.LONG_THRESHOLD` (20) - когда открывать LONG позицию
- `MOMENTUM.SHORT_THRESHOLD` (-20) - когда открывать SHORT позицию
- `PATTERN.ACCUMULATION_THRESHOLD` (65%) - порог для accumulation pattern
- `PATTERN.DISTRIBUTION_THRESHOLD` (30%) - порог для distribution pattern
- `SPOOFING.DETECTION_CONFIDENCE` (75) - confidence для spoofing alerts

### 🔧 TECHNICAL (константы):
- `LIMITS.MAX_TICK_BUFFER_SIZE` (10000) - лимит памяти для tick buffer
- `LIMITS.MAX_ORDERBOOK_HISTORY` (100) - лимит памяти для orderbook history

**Итого:** 5 стратегических, 2 технических

---

## 2. LIQUIDITY_HEATMAP

### 🎯 STRATEGIC (в config):
- `STRENGTH.NEUTRAL_ZONE_THRESHOLD` (35) - когда зона считается neutral (не S/R)

### 🔧 TECHNICAL (константы):
- `STRENGTH.CLUSTER_BONUS_MULTIPLIER` (0.5) - внутренняя формула расчёта strength
- `STRENGTH.MAX_CLUSTER_BONUS` (30) - cap для cluster bonus
- `STRENGTH.DISTANCE_PENALTY_PER_LEVEL` (0.3) - формула penalty по дистанции
- `SPREAD.VERY_WIDE_SPREAD_BPS` (10000) - технический fallback при errors
- `QUALITY.CORRUPT_DATA_THRESHOLD` (0.5) - validation threshold для data quality

**Итого:** 1 стратегический, 5 технических

---

## 3. SMART_ORDER_PLACEMENT

### 🎯 STRATEGIC (в config):
- `PRIORITY.PATIENT_THRESHOLD` (80%) - когда использовать patient execution
- `PRIORITY.IMMEDIATE_THRESHOLD` (50%) - когда использовать immediate execution
- `RISK.HIGH_RISK_SLIPPAGE_MULTIPLIER` (1.5x) - multiplier для high risk classification
- `RISK.HIGH_RISK_FILL_MULTIPLIER` (0.7x) - multiplier для high risk classification

### 🔧 TECHNICAL (константы):
- `SPLITTING.MAX_SPLITS` (5) - технический лимит для фрагментации
- `IMPROVEMENT.MAX_SLIPPAGE_REDUCTION_BPS` (50) - max improvement от splitting
- `IMPROVEMENT.MAX_FILL_PROBABILITY_INCREASE` (20%) - max improvement
- `IMPROVEMENT.MAX_IMPACT_REDUCTION` (30%) - max improvement
- `LIQUIDITY.DEPTH_PENALTY_PER_LEVEL` (2) - формула penalty
- `FILL_PROBABILITY_WEIGHTS.*` (0.4/0.2/0.2/0.2) - веса для ML модели

**Итого:** 4 стратегических, 6 технических

---

## 4. ML_SIGNAL_VALIDATOR

### 🎯 STRATEGIC (в config):
- `ACTION.STRONG_ACTION_THRESHOLD` (80) - confidence для strong buy/sell
- `ACTION.ACTION_THRESHOLD` (60) - confidence для buy/sell
- `RISK.LOW_RISK_CONFIDENCE` (70) - порог для low risk классификации
- `RISK.MEDIUM_RISK_CONFIDENCE` (50) - порог для medium risk
- `RISK.VOLATILITY_MULTIPLIER` (1.5x) - как учитывать волатильность в риске

### 🔧 TECHNICAL (константы):
- `REGIME.MATCH_BOOST` (1.2x) - формула boost для regime alignment
- `REGIME.TRANSITION_BOOST` (1.1x) - формула boost для transitions
- `QUALITY_WEIGHTS.*` (30/25/25/20/15/12.5) - веса для quality scoring формулы

**Итого:** 5 стратегических, 3 технических

---

## 5. PATTERN_RECOGNITION

### 🎯 STRATEGIC (в config):
- `SUPPORT_RESISTANCE.DISTANCE_THRESHOLD` (0.2 = 20%) - дистанция для S/R detection
- `FIBONACCI.TEST_THRESHOLD` (0.005 = 0.5%) - когда считать level being tested
- `ZONE_TOUCHES.HIGH_TOUCH_THRESHOLD` (5) - сколько касаний для strong zone
- `ZONE_TOUCHES.MEDIUM_TOUCH_THRESHOLD` (3) - сколько касаний для medium zone

### 🔧 TECHNICAL (константы):
- `PATTERN.HAMMER_LOWER_SHADOW_RATIO` (0.6) - математическое определение hammer
- `PATTERN.HAMMER_UPPER_SHADOW_MAX_RATIO` (0.3) - математическое определение
- `SUPPORT_RESISTANCE.LEVEL_BONUS` (10) - внутренняя формула bonus
- `FIBONACCI.LEVEL_STRENGTHS` {...} - strength mapping для fib levels
- `SWING.LOOKBACK_PERIOD` (5) - технический параметр алгоритма
- `ZONE_TOUCHES.HIGH_TOUCH_BONUS` (30) - внутренняя формула strength
- `ZONE_TOUCHES.MEDIUM_TOUCH_BONUS` (20) - внутренняя формула
- `CONFIRMATION.BONUS` (15) - внутренняя формула reliability

**Итого:** 4 стратегических, 8 технических

---

## 6. ANOMALY_DETECTION

### 🎯 STRATEGIC (в config):
- `Z_SCORE.CRITICAL` (4.0) - z-score для critical anomaly
- `Z_SCORE.HIGH` (3.5) - z-score для high severity
- `Z_SCORE.MEDIUM` (3.0) - z-score для medium severity
- `WHALE.ACCUMULATION_RATIO_THRESHOLD` (2.0x) - порог для whale detection
- `MANIPULATION.WASH_TRADING_SIMILARITY` (0.7 = 70%) - порог для wash trading
- `MANIPULATION.PUMP_DUMP_DECREASE` (0.08 = 8%) - порог для pump & dump

### 🔧 TECHNICAL (константы):
- `MANIPULATION.MIN_TRADES` (5) - минимум для статистического анализа
- `MANIPULATION.MIN_VOLUME_HISTORY` (10) - минимум samples для analysis
- `SEVERITY_RATIOS.*` (20/10/5) - внутренняя формула severity mapping
- `LIKELIHOOD_WEIGHTS.*` (30/40) - веса для likelihood calculation

**Итого:** 6 стратегических, 4 технических

---

## 📊 SUMMARY

| Service | Strategic | Technical | Total |
|---------|-----------|-----------|-------|
| AdvancedOrderFlow | 5 | 2 | 7 |
| LiquidityHeatmap | 1 | 5 | 6 |
| SmartOrderPlacement | 4 | 6 | 10 |
| MLSignalValidator | 5 | 3 | 8 |
| PatternRecognition | 4 | 8 | 12 |
| AnomalyDetection | 6 | 4 | 10 |
| **TOTAL** | **25** | **28** | **53** |

---

## 🎯 STRATEGIC Parameters (25 total)

Эти параметры влияют на торговые решения и должны быть в config:

### Trading Signals (11):
- Order flow momentum thresholds (LONG/SHORT)
- Accumulation/distribution pattern thresholds
- Spoofing detection confidence
- ML action thresholds (strong/normal)
- Risk confidence thresholds (low/medium)
- Support/Resistance distance threshold
- Fibonacci level test threshold

### Risk Management (4):
- High risk slippage/fill multipliers
- Volatility risk multiplier

### Execution Strategy (4):
- Patient/Immediate execution thresholds

### Anomaly Detection (6):
- Z-score severity thresholds (critical/high/medium)
- Whale accumulation threshold
- Manipulation thresholds (wash trading, pump & dump)

---

## 🔧 TECHNICAL Parameters (28 total)

Эти параметры - внутренние ограничения/формулы, можно оставить константами:

### Memory Limits (3):
- Tick buffer size, orderbook history, min samples

### Internal Formulas (25):
- Strength calculation weights/bonuses
- Distance penalties
- Probability weights
- Regime boost multipliers
- Quality scoring weights
- Pattern mathematical definitions
- Severity mapping ratios
- Likelihood weights

---

## 💡 RECOMMENDATION

### Option 1: Split Constants File (Рекомендую)
```typescript
// phase-10-constants.ts - только TECHNICAL
export const TECHNICAL = { ... }

// types.ts или config interfaces - добавить STRATEGIC в config
export interface AdvancedOrderFlowConfig {
  momentumLongThreshold: number;  // default: 20
  momentumShortThreshold: number; // default: -20
  // ... остальные strategic параметры
}
```

### Option 2: Keep Together but Mark
```typescript
// phase-10-constants.ts
export const STRATEGIC = {
  // Defaults for config
  ADVANCED_ORDER_FLOW: { ... },
  // ...
}

export const TECHNICAL = {
  // True constants
  ADVANCED_ORDER_FLOW: { ... },
  // ...
}
```

### Option 3: Migrate Strategic to Config Files
- Добавить в `config.json` секцию `phase10`
- Добавить в strategy.json секцию `advancedAnalysis`
- Обновить все 6 сервисов для чтения из config

---

## ❓ NEXT STEPS

1. Выбрать approach (Option 1/2/3)
2. Создать/обновить config interfaces
3. Переместить strategic параметры
4. Обновить сервисы для чтения из config
5. Обновить тесты (использовать default values)
6. Документировать все strategic параметры

---

**Question:** Какой approach предпочитаешь? Или есть другие идеи?
