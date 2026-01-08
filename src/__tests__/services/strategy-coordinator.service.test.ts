/**
 * Strategy Coordinator Service Tests
 *
 * Tests for score-based signal aggregation and coordination logic.
 * Validates that signals are properly weighted and aggregated to produce coordinated decisions.
 */

import { StrategyCoordinator } from '../../services/strategy-coordinator.service';
import {
  IStrategy,
  StrategyMarketData,
  StrategySignal,
  LoggerService,
  LogLevel,
  SignalDirection,
  SignalType,
} from '../../types';
import { createTestMarketData } from '../helpers/test-data.helper';

// ============================================================================
// MOCK STRATEGIES
// ============================================================================

class MockStrategy implements IStrategy {
  constructor(
    public readonly name: string,
    public readonly priority: number,
    private returnValid: boolean,
    private returnDirection: SignalDirection = SignalDirection.LONG,
    private returnConfidence: number = 70,
  ) {}

  async evaluate(data: StrategyMarketData): Promise<StrategySignal> {
    if (!this.returnValid) {
      return {
        valid: false,
        strategyName: this.name,
        priority: this.priority,
        reason: 'Conditions not met',
      };
    }

    return {
      valid: true,
      strategyName: this.name,
      priority: this.priority,
      signal: {
        direction: this.returnDirection,
        type: SignalType.TREND_FOLLOWING,
        confidence: this.returnConfidence,
        price: data.currentPrice,
        stopLoss: data.currentPrice * 0.99,
        takeProfits: [
          {
            level: 1,
            percent: 0.5,
            sizePercent: 50,
            price: data.currentPrice * 1.005,
            hit: false,
          },
        ],
        reason: `${this.name} signal`,
        timestamp: data.timestamp,
      },
    };
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('StrategyCoordinator', () => {
  let coordinator: StrategyCoordinator;
  let logger: LoggerService;
  let mockMarketData: StrategyMarketData;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    coordinator = new StrategyCoordinator(logger, 0.55, 45, 3, 3); // 3 active analyzers

    mockMarketData = createTestMarketData({
      candles: [],
      rsi: 50,
      ema: { fast: 100, slow: 95 },
      trend: 'BULLISH',
      atr: 1.5,
      timestamp: Date.now(),
      currentPrice: 100,
    });
  });

  // ============================================================================
  // TEST 1: Strategy Registration
  // ============================================================================

  describe('registerStrategy', () => {
    it('should register strategies and sort by priority', () => {
      const strategy1 = new MockStrategy('Strategy1', 2, true);
      const strategy2 = new MockStrategy('Strategy2', 1, true);
      const strategy3 = new MockStrategy('Strategy3', 3, true);

      coordinator.registerStrategy(strategy1);
      coordinator.registerStrategy(strategy2);
      coordinator.registerStrategy(strategy3);

      const strategies = coordinator.getStrategies();
      expect(strategies.length).toBe(3);
      expect(strategies[0].name).toBe('Strategy2'); // Priority 1
      expect(strategies[1].name).toBe('Strategy1'); // Priority 2
      expect(strategies[2].name).toBe('Strategy3'); // Priority 3
    });

    it('should unregister strategy by name', () => {
      const strategy = new MockStrategy('TestStrategy', 1, true);
      coordinator.registerStrategy(strategy);
      expect(coordinator.getStrategyCount()).toBe(1);

      const removed = coordinator.unregisterStrategy('TestStrategy');
      expect(removed).toBe(true);
      expect(coordinator.getStrategyCount()).toBe(0);
    });

    it('should return false when unregistering non-existent strategy', () => {
      const removed = coordinator.unregisterStrategy('NonExistent');
      expect(removed).toBe(false);
    });

    it('should clear all strategies', () => {
      coordinator.registerStrategy(new MockStrategy('Strategy1', 1, true));
      coordinator.registerStrategy(new MockStrategy('Strategy2', 2, true));
      expect(coordinator.getStrategyCount()).toBe(2);

      coordinator.clearStrategies();
      expect(coordinator.getStrategyCount()).toBe(0);
    });

    it('should check if strategy is registered', () => {
      const strategy = new MockStrategy('TestStrategy', 1, true);
      coordinator.registerStrategy(strategy);
      expect(coordinator.hasStrategy('TestStrategy')).toBe(true);
      expect(coordinator.hasStrategy('NonExistent')).toBe(false);
    });
  });

  // ============================================================================
  // TEST 2: Signal Aggregation (Score-Based)
  // ============================================================================

  describe('evaluateStrategies - Signal Aggregation', () => {
    it('should aggregate multiple LONG signals and return LONG', async () => {
      // Two strong LONG signals
      coordinator.registerStrategy(new MockStrategy('Strategy1', 1, true, SignalDirection.LONG, 80));
      coordinator.registerStrategy(new MockStrategy('Strategy2', 2, true, SignalDirection.LONG, 70));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.LONG);
      expect(result!.signal?.confidence).toBeGreaterThan(0);
      expect(result!.strategyName).toBe('SignalCoordinator');
    });

    it('should aggregate multiple SHORT signals and return SHORT', async () => {
      coordinator.registerStrategy(new MockStrategy('Strategy1', 1, true, SignalDirection.SHORT, 75));
      coordinator.registerStrategy(new MockStrategy('Strategy2', 2, true, SignalDirection.SHORT, 65));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.SHORT);
    });

    it('should choose LONG when LONG score > SHORT score', async () => {
      // 2 LONG signals (70 + 75) vs 1 SHORT signal (50)
      coordinator.registerStrategy(new MockStrategy('LongStrategy1', 1, true, SignalDirection.LONG, 75));
      coordinator.registerStrategy(new MockStrategy('LongStrategy2', 2, true, SignalDirection.LONG, 70));
      coordinator.registerStrategy(new MockStrategy('ShortStrategy', 3, true, SignalDirection.SHORT, 50));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.LONG);
    });

    it('should return null when no signals meet confidence threshold', async () => {
      // Set high threshold
      coordinator.setThresholds(0.8, 80);

      // Low confidence signals
      coordinator.registerStrategy(new MockStrategy('Strategy1', 1, true, SignalDirection.LONG, 40));
      coordinator.registerStrategy(new MockStrategy('Strategy2', 2, true, SignalDirection.LONG, 35));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).toBeNull();
    });

    it('should return null when score is below minimum threshold', async () => {
      // Set high threshold
      coordinator.setThresholds(0.9, 45);

      // Signals below 90% score
      coordinator.registerStrategy(new MockStrategy('Strategy1', 1, true, SignalDirection.LONG, 60));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // TEST 3: Handling Invalid Signals
  // ============================================================================

  describe('evaluateStrategies - Invalid Signals', () => {
    it('should ignore invalid signals and use only valid ones', async () => {
      coordinator.registerStrategy(new MockStrategy('InvalidStrategy', 1, false));
      coordinator.registerStrategy(new MockStrategy('ValidStrategy', 2, true, SignalDirection.LONG, 70));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.LONG);
    });

    it('should return null when all strategies are invalid', async () => {
      coordinator.registerStrategy(new MockStrategy('Strategy1', 1, false));
      coordinator.registerStrategy(new MockStrategy('Strategy2', 2, false));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).toBeNull();
    });

    it('should return null when no strategies are registered', async () => {
      const result = await coordinator.evaluateStrategies(mockMarketData);
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // TEST 4: Real-Time Strategy Filtering
  // ============================================================================

  describe('evaluateStrategies - Real-Time Filtering', () => {
    it('should exclude WHALE_HUNTER strategy by default', async () => {
      const whaleStrategy = new MockStrategy('WHALE_HUNTER', 0, true, SignalDirection.LONG, 95);
      const regularStrategy = new MockStrategy('LEVEL_BASED', 2, true, SignalDirection.SHORT, 65);

      coordinator.registerStrategy(whaleStrategy);
      coordinator.registerStrategy(regularStrategy);

      const result = await coordinator.evaluateStrategies(mockMarketData, true);

      // Should use LEVEL_BASED (SHORT), not WHALE_HUNTER (LONG)
      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.SHORT);
    });

    it('should include WHALE_HUNTER when excludeRealtimeStrategies is false', async () => {
      const whaleStrategy = new MockStrategy('WHALE_HUNTER', 0, true, SignalDirection.LONG, 95);
      const regularStrategy = new MockStrategy('LEVEL_BASED', 2, true, SignalDirection.SHORT, 65);

      coordinator.registerStrategy(whaleStrategy);
      coordinator.registerStrategy(regularStrategy);

      const result = await coordinator.evaluateStrategies(mockMarketData, false);

      // Should use WHALE_HUNTER (LONG) because it has higher weight
      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.LONG);
    });
  });

  // ============================================================================
  // TEST 5: Threshold Management
  // ============================================================================

  describe('setThresholds', () => {
    it('should update thresholds and affect subsequent evaluations', async () => {
      coordinator.registerStrategy(new MockStrategy('Strategy1', 1, true, SignalDirection.LONG, 60));

      // First evaluation with default thresholds (0.55, 45)
      let result = await coordinator.evaluateStrategies(mockMarketData);
      expect(result).not.toBeNull();

      // Update to higher thresholds
      coordinator.setThresholds(0.9, 85);

      // Second evaluation should fail
      result = await coordinator.evaluateStrategies(mockMarketData);
      expect(result).toBeNull();
    });

    it('should allow lowering thresholds', async () => {
      coordinator.setThresholds(0.95, 95); // Very high
      coordinator.registerStrategy(new MockStrategy('Strategy1', 1, true, SignalDirection.LONG, 50));

      let result = await coordinator.evaluateStrategies(mockMarketData);
      expect(result).toBeNull();

      // Lower thresholds
      coordinator.setThresholds(0.4, 40);

      result = await coordinator.evaluateStrategies(mockMarketData);
      expect(result).not.toBeNull();
    });
  });

  // ============================================================================
  // TEST 6: Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle strategy evaluation errors gracefully', async () => {
      class ErrorStrategy implements IStrategy {
        readonly name = 'ErrorStrategy';
        readonly priority = 1;

        async evaluate(): Promise<StrategySignal> {
          throw new Error('Strategy evaluation failed');
        }
      }

      coordinator.registerStrategy(new ErrorStrategy());
      coordinator.registerStrategy(new MockStrategy('ValidStrategy', 2, true, SignalDirection.LONG, 70));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      // Should skip the error and use valid strategy
      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.LONG);
    });

    it('should return null if all strategies throw errors', async () => {
      class ErrorStrategy implements IStrategy {
        readonly name = 'ErrorStrategy';
        readonly priority = 1;

        async evaluate(): Promise<StrategySignal> {
          throw new Error('Strategy evaluation failed');
        }
      }

      coordinator.registerStrategy(new ErrorStrategy());

      const result = await coordinator.evaluateStrategies(mockMarketData);
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // TEST 7: Result Format Validation
  // ============================================================================

  describe('Result Format', () => {
    it('should return properly formatted StrategySignal', async () => {
      coordinator.registerStrategy(new MockStrategy('TestStrategy', 1, true, SignalDirection.LONG, 75));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      expect(result!.valid).toBe(true);
      expect(result!.signal).toBeDefined();
      expect(result!.signal!.direction).toBeDefined();
      expect(result!.signal!.confidence).toBeGreaterThan(0);
      expect(result!.strategyName).toBe('SignalCoordinator');
      expect(result!.reason).toBeDefined();
    });

    it('should include reasoning in result', async () => {
      coordinator.registerStrategy(new MockStrategy('TestStrategy', 1, true, SignalDirection.LONG, 70));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      expect(result!.reason).toContain('LONG');
      expect(result!.reason).toContain('Score');
    });
  });

  // ============================================================================
  // TEST 8: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle single strategy correctly', async () => {
      coordinator.registerStrategy(new MockStrategy('OnlyStrategy', 1, true, SignalDirection.LONG, 65));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.LONG);
      // Confidence may be reduced by blind zone penalty (1 signal < 5 min) and other penalties
      expect(result!.signal?.confidence).toBeGreaterThanOrEqual(50);
      expect(result!.signal?.confidence).toBeLessThanOrEqual(65);
    });

    it('should handle many strategies with varying confidence', async () => {
      for (let i = 1; i <= 10; i++) {
        const confidence = 30 + i * 5; // 35, 40, 45, ..., 85
        coordinator.registerStrategy(
          new MockStrategy(`Strategy${i}`, i, true, SignalDirection.LONG, confidence),
        );
      }

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.LONG);
      // Average confidence should be around 60
      expect(result!.signal?.confidence).toBeGreaterThan(50);
    });

    it('should balance competing signals correctly', async () => {
      // 3 LONG signals with moderate confidence
      coordinator.registerStrategy(new MockStrategy('Long1', 1, true, SignalDirection.LONG, 60));
      coordinator.registerStrategy(new MockStrategy('Long2', 2, true, SignalDirection.LONG, 55));
      coordinator.registerStrategy(new MockStrategy('Long3', 3, true, SignalDirection.LONG, 50));

      // 2 SHORT signals with low confidence
      coordinator.registerStrategy(new MockStrategy('Short1', 4, true, SignalDirection.SHORT, 40));
      coordinator.registerStrategy(new MockStrategy('Short2', 5, true, SignalDirection.SHORT, 35));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      expect(result!.signal?.direction).toBe(SignalDirection.LONG);
    });
  });

  // ============================================================================
  // TEST 9: Coordinator as Aggregator (Main Feature)
  // ============================================================================

  describe('Score-Based Aggregation (Main Feature)', () => {
    it('should aggregate signals instead of "first valid wins"', async () => {
      // Old behavior would pick first valid by priority
      // New behavior aggregates all signals based on weighted scores

      // 3 LONG signals with good confidence
      coordinator.registerStrategy(new MockStrategy('LongPriority1', 1, true, SignalDirection.LONG, 80));
      coordinator.registerStrategy(new MockStrategy('LongPriority2', 2, true, SignalDirection.LONG, 75));
      coordinator.registerStrategy(new MockStrategy('LongPriority3', 3, true, SignalDirection.LONG, 70));

      // 1 SHORT signal with lower confidence
      coordinator.registerStrategy(new MockStrategy('ShortPriority4', 4, true, SignalDirection.SHORT, 50));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      // Should pick LONG because it has 3 signals with avg ~75% vs 1 SHORT (50%)
      expect(result!.signal?.direction).toBe(SignalDirection.LONG);
    });

    it('should calculate weighted scores correctly', async () => {
      // Two signals with same confidence but different implicit weights
      coordinator.registerStrategy(new MockStrategy('LEVEL_BASED', 1, true, SignalDirection.LONG, 75));
      coordinator.registerStrategy(new MockStrategy('TREND_FOLLOWING', 2, true, SignalDirection.LONG, 75));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      // Both signals have 75% confidence, should aggregate to ~75%
      // Note: Blind zone penalty (0.85) applied when < 7 signals
      expect(result!.signal?.confidence).toBeGreaterThanOrEqual(60);
    });

    it('should work with minimum viable signals', async () => {
      // Set very low thresholds
      coordinator.setThresholds(0.3, 30);

      coordinator.registerStrategy(new MockStrategy('WeakSignal', 1, true, SignalDirection.LONG, 35));

      const result = await coordinator.evaluateStrategies(mockMarketData);

      expect(result).not.toBeNull();
      // Blind zone penalty (0.85) applied: 35 * 0.85 = ~30
      expect(result!.signal?.confidence).toBeGreaterThanOrEqual(29);
    });
  });
});
