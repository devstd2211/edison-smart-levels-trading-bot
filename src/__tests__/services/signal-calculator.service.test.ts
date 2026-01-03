/**
 * Tests for SignalCalculator Service
 *
 * Tests signal price calculations:
 * - createSignal() - full signal object creation
 * - calculateStopLoss() - SL calculation for LONG/SHORT
 * - calculateTakeProfits() - TP array generation
 */

import { SignalCalculator } from '../../services/signal-calculator.service';
import {
  LoggerService,
  LogLevel,
  Config,
  SignalDirection,
  SignalType,
  StrategyEvaluation,
  BTCAnalysis,
  BTCDirection,
} from '../../types';

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

const createTestConfig = (): Config => ({
  exchange: {
    symbol: 'BTCUSDT',
    testnet: true,
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  },
  riskManagement: {
    stopLossPercent: 2.0, // 2% stop loss
    takeProfits: [
      { level: 1, percent: 1.0, sizePercent: 50 }, // TP1: 1%, close 50%
      { level: 2, percent: 2.0, sizePercent: 30 }, // TP2: 2%, close 30%
      { level: 3, percent: 3.0, sizePercent: 20 }, // TP3: 3%, close 20%
    ],
    maxPositions: 1,
    leverage: 10,
    positionSizePercent: 10,
  },
  timeframes: {
    entry: '5m',
    primary: '15m',
    trend1: '1h',
    trend2: '4h',
    context: '1d',
  },
  indicators: {
    rsi: { period: 14, overbought: 70, oversold: 30 },
    ema: { fastPeriod: 9, slowPeriod: 21 },
    atr: { period: 14, multiplier: 1.5 },
    zigzag: { depth: 5, deviation: 0.5 },
  },
  strategy: {
    name: 'test-strategy',
    minConfidence: 70,
    btcConfirmation: {
      enabled: false,
      symbol: 'BTCUSDT',
      timeframe: '15m',
      lookbackPeriod: 10,
      candleLimit: 50,
      useCorrelation: false,
    },
  },
  logging: { level: 'ERROR', console: false, file: true },
} as any);

const createMockEvaluation = (overrides?: Partial<StrategyEvaluation>): StrategyEvaluation => ({
  shouldEnter: true,
  direction: SignalDirection.LONG,
  confidence: 0.85,
  reason: 'Test signal',
  blockedBy: undefined,
  details: undefined,
  ...overrides,
});

// ============================================================================
// TESTS
// ============================================================================

describe('SignalCalculator', () => {
  let calculator: SignalCalculator;
  let config: Config;
  let logger: LoggerService;

  beforeEach(() => {
    config = createTestConfig();
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    calculator = new SignalCalculator(config, logger);
  });

  // ==========================================================================
  // GROUP 1: createSignal()
  // ==========================================================================

  describe('createSignal()', () => {
    it('should create LONG signal with all required fields', () => {
      // Arrange
      const evaluation = createMockEvaluation({ direction: SignalDirection.LONG });
      const currentPrice = 100.0;

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice);

      // Assert
      expect(signal).toMatchObject({
        type: SignalType.TREND_FOLLOWING,
        direction: SignalDirection.LONG,
        price: currentPrice,
        confidence: 85,
        reason: 'Test signal',
      });
      expect(signal.stopLoss).toBeLessThan(currentPrice); // SL below entry for LONG
      expect(signal.takeProfits).toHaveLength(3);
      expect(signal.takeProfits[0].price).toBeGreaterThan(currentPrice); // TP above entry for LONG
      expect(signal.timestamp).toBeGreaterThan(0);
    });

    it('should create SHORT signal with all required fields', () => {
      // Arrange
      const evaluation = createMockEvaluation({ direction: SignalDirection.SHORT });
      const currentPrice = 100.0;

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice);

      // Assert
      expect(signal).toMatchObject({
        type: SignalType.TREND_FOLLOWING,
        direction: SignalDirection.SHORT,
        price: currentPrice,
        confidence: 85,
        reason: 'Test signal',
      });
      expect(signal.stopLoss).toBeGreaterThan(currentPrice); // SL above entry for SHORT
      expect(signal.takeProfits).toHaveLength(3);
      expect(signal.takeProfits[0].price).toBeLessThan(currentPrice); // TP below entry for SHORT
    });

    it('should include btcData when provided', () => {
      // Arrange
      const evaluation = createMockEvaluation();
      const currentPrice = 100.0;
      const btcAnalysis: BTCAnalysis = {
        direction: BTCDirection.UP,
        momentum: 0.75,
        isAligned: true,
        reason: 'BTC bullish',
        priceChange: 2.5,
        consecutiveMoves: 3,
        volumeRatio: 1.2,
      };

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice, btcAnalysis);

      // Assert
      expect(signal.btcData).toEqual(btcAnalysis);
    });

    it('should not include btcData when not provided', () => {
      // Arrange
      const evaluation = createMockEvaluation();
      const currentPrice = 100.0;

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice);

      // Assert
      expect(signal.btcData).toBeUndefined();
    });

    it('should convert confidence from decimal to percentage', () => {
      // Arrange
      const evaluation = createMockEvaluation({ confidence: 0.92 });
      const currentPrice = 100.0;

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice);

      // Assert
      expect(signal.confidence).toBe(92);
    });

    it('should default confidence to 100 when not provided', () => {
      // Arrange
      const evaluation = createMockEvaluation({ confidence: undefined });
      const currentPrice = 100.0;

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice);

      // Assert
      expect(signal.confidence).toBe(100);
    });

    it('should include reason from evaluation', () => {
      // Arrange
      const evaluation = createMockEvaluation({ reason: 'Custom reason text' });
      const currentPrice = 100.0;

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice);

      // Assert
      expect(signal.reason).toBe('Custom reason text');
    });
  });

  // ==========================================================================
  // GROUP 2: calculateStopLoss()
  // ==========================================================================

  describe('calculateStopLoss()', () => {
    it('should calculate LONG stop loss below entry price', () => {
      // Arrange
      const direction = SignalDirection.LONG;
      const currentPrice = 100.0;
      const stopLossPercent = 2.0; // From config

      // Act
      const stopLoss = calculator.calculateStopLoss(direction, currentPrice);

      // Assert
      expect(stopLoss).toBeLessThan(currentPrice);
      expect(stopLoss).toBeCloseTo(98.0, 2); // 100 - 2% = 98
    });

    it('should calculate SHORT stop loss above entry price', () => {
      // Arrange
      const direction = SignalDirection.SHORT;
      const currentPrice = 100.0;
      const stopLossPercent = 2.0; // From config

      // Act
      const stopLoss = calculator.calculateStopLoss(direction, currentPrice);

      // Assert
      expect(stopLoss).toBeGreaterThan(currentPrice);
      expect(stopLoss).toBeCloseTo(102.0, 2); // 100 + 2% = 102
    });

    it('should use stopLossPercent from config', () => {
      // Arrange
      const direction = SignalDirection.LONG;
      const currentPrice = 100.0;

      // Act
      const stopLoss = calculator.calculateStopLoss(direction, currentPrice);

      // Assert
      const expectedSL = currentPrice * (1 - config.riskManagement.stopLossPercent / 100);
      expect(stopLoss).toBeCloseTo(expectedSL, 2);
    });

    it('should calculate stop loss with different percentages', () => {
      // Arrange - change config
      config.riskManagement.stopLossPercent = 5.0; // 5%
      const calculator2 = new SignalCalculator(config, logger);
      const direction = SignalDirection.LONG;
      const currentPrice = 100.0;

      // Act
      const stopLoss = calculator2.calculateStopLoss(direction, currentPrice);

      // Assert
      expect(stopLoss).toBeCloseTo(95.0, 2); // 100 - 5% = 95
    });
  });

  // ==========================================================================
  // GROUP 3: calculateTakeProfits()
  // ==========================================================================

  describe('calculateTakeProfits()', () => {
    it('should calculate LONG take profits above entry price', () => {
      // Arrange
      const direction = SignalDirection.LONG;
      const currentPrice = 100.0;

      // Act
      const takeProfits = calculator.calculateTakeProfits(direction, currentPrice);

      // Assert
      expect(takeProfits).toHaveLength(3);
      expect(takeProfits[0].price).toBeCloseTo(101.0, 2); // TP1: 100 + 1% = 101
      expect(takeProfits[1].price).toBeCloseTo(102.0, 2); // TP2: 100 + 2% = 102
      expect(takeProfits[2].price).toBeCloseTo(103.0, 2); // TP3: 100 + 3% = 103
      takeProfits.forEach((tp) => {
        expect(tp.price).toBeGreaterThan(currentPrice);
      });
    });

    it('should calculate SHORT take profits below entry price', () => {
      // Arrange
      const direction = SignalDirection.SHORT;
      const currentPrice = 100.0;

      // Act
      const takeProfits = calculator.calculateTakeProfits(direction, currentPrice);

      // Assert
      expect(takeProfits).toHaveLength(3);
      expect(takeProfits[0].price).toBeCloseTo(99.0, 2); // TP1: 100 - 1% = 99
      expect(takeProfits[1].price).toBeCloseTo(98.0, 2); // TP2: 100 - 2% = 98
      expect(takeProfits[2].price).toBeCloseTo(97.0, 2); // TP3: 100 - 3% = 97
      takeProfits.forEach((tp) => {
        expect(tp.price).toBeLessThan(currentPrice);
      });
    });

    it('should return array matching config.riskManagement.takeProfits length', () => {
      // Arrange
      const direction = SignalDirection.LONG;
      const currentPrice = 100.0;

      // Act
      const takeProfits = calculator.calculateTakeProfits(direction, currentPrice);

      // Assert
      expect(takeProfits).toHaveLength(config.riskManagement.takeProfits.length);
    });

    it('should set all hit flags to false initially', () => {
      // Arrange
      const direction = SignalDirection.LONG;
      const currentPrice = 100.0;

      // Act
      const takeProfits = calculator.calculateTakeProfits(direction, currentPrice);

      // Assert
      takeProfits.forEach((tp) => {
        expect(tp.hit).toBe(false);
      });
    });

    it('should include all TP fields (level, price, sizePercent, percent, hit)', () => {
      // Arrange
      const direction = SignalDirection.LONG;
      const currentPrice = 100.0;

      // Act
      const takeProfits = calculator.calculateTakeProfits(direction, currentPrice);

      // Assert
      takeProfits.forEach((tp, index) => {
        expect(tp).toMatchObject({
          level: config.riskManagement.takeProfits[index].level,
          price: expect.any(Number),
          sizePercent: config.riskManagement.takeProfits[index].sizePercent,
          percent: config.riskManagement.takeProfits[index].percent,
          hit: false,
        });
      });
    });

    it('should calculate correct prices from config percentages', () => {
      // Arrange
      const direction = SignalDirection.LONG;
      const currentPrice = 100.0;

      // Act
      const takeProfits = calculator.calculateTakeProfits(direction, currentPrice);

      // Assert
      expect(takeProfits[0]).toMatchObject({
        level: 1,
        percent: 1.0,
        sizePercent: 50,
        price: 101.0,
      });
      expect(takeProfits[1]).toMatchObject({
        level: 2,
        percent: 2.0,
        sizePercent: 30,
        price: 102.0,
      });
      expect(takeProfits[2]).toMatchObject({
        level: 3,
        percent: 3.0,
        sizePercent: 20,
        price: 103.0,
      });
    });

    it('should return single TP with 100% close in FLAT market (LONG)', () => {
      // Arrange
      const direction = SignalDirection.LONG;
      const currentPrice = 100.0;
      const isFlat = true;

      // Act
      const takeProfits = calculator.calculateTakeProfits(direction, currentPrice, isFlat);

      // Assert
      expect(takeProfits).toHaveLength(1);
      expect(takeProfits[0]).toMatchObject({
        level: 1,
        percent: 1.0, // TP1 percent from config
        sizePercent: 100, // Close 100% in flat
        price: 101.0,
        hit: false,
      });
    });

    it('should return single TP with 100% close in FLAT market (SHORT)', () => {
      // Arrange
      const direction = SignalDirection.SHORT;
      const currentPrice = 100.0;
      const isFlat = true;

      // Act
      const takeProfits = calculator.calculateTakeProfits(direction, currentPrice, isFlat);

      // Assert
      expect(takeProfits).toHaveLength(1);
      expect(takeProfits[0]).toMatchObject({
        level: 1,
        percent: 1.0,
        sizePercent: 100,
        price: 99.0, // SHORT: below entry
        hit: false,
      });
    });
  });

  // ==========================================================================
  // GROUP 4: createSignal() with FLAT market
  // ==========================================================================

  describe('createSignal() - FLAT market optimization', () => {
    it('should create signal with single TP when marketBias is NEUTRAL', () => {
      // Arrange
      const evaluation = createMockEvaluation({ direction: SignalDirection.LONG });
      const currentPrice = 100.0;
      const marketBias = 'NEUTRAL';

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice, undefined, marketBias);

      // Assert
      expect(signal.takeProfits).toHaveLength(1);
      expect(signal.takeProfits[0].sizePercent).toBe(100);
    });

    it('should create signal with multiple TPs when marketBias is BULLISH', () => {
      // Arrange
      const evaluation = createMockEvaluation({ direction: SignalDirection.LONG });
      const currentPrice = 100.0;
      const marketBias = 'BULLISH';

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice, undefined, marketBias);

      // Assert
      expect(signal.takeProfits).toHaveLength(3);
      expect(signal.takeProfits[0].sizePercent).toBe(50); // Not 100%
    });

    it('should create signal with multiple TPs when marketBias not provided', () => {
      // Arrange
      const evaluation = createMockEvaluation({ direction: SignalDirection.LONG });
      const currentPrice = 100.0;

      // Act
      const signal = calculator.createSignal(evaluation, currentPrice);

      // Assert
      expect(signal.takeProfits).toHaveLength(3); // Default behavior
    });
  });

  // ==========================================================================
  // GROUP 4: FlatMarketDetector Integration
  // ==========================================================================

  describe('FlatMarketDetector Integration', () => {
    it('should use FlatMarketDetector when flatMarketConfig provided and detector enabled', () => {
      // Arrange
      const flatMarketConfig = {
        enabled: true,
        flatThreshold: 80,
        emaThreshold: 0.3,
        atrThreshold: 1.5,
        rangeThreshold: 1.0,
        slopeThreshold: 5.0,
      };
      const calculatorWithDetector = new SignalCalculator(config, logger, flatMarketConfig);
      const evaluation = createMockEvaluation({ direction: SignalDirection.LONG });
      const currentPrice = 100.0;

      // Create test candles (tight range for flat detection)
      const candles = Array(30)
        .fill(null)
        .map((_, i) => ({
          timestamp: Date.now() + i * 60000,
          open: 100 + (Math.random() - 0.5) * 0.2,
          high: 100.1 + (Math.random() - 0.5) * 0.1,
          low: 99.9 + (Math.random() - 0.5) * 0.1,
          close: 100 + (Math.random() - 0.5) * 0.2,
          volume: 1000,
        }));

      const context = {
        timestamp: Date.now(),
        trend: 'NEUTRAL' as any,
        marketStructure: 'EH' as any,
        atrPercent: 1.0,
        emaDistance: 0.1,
        ema50: 100,
        atrModifier: 1.0,
        emaModifier: 1.0,
        trendModifier: 1.0,
        overallModifier: 1.0,
        isValidContext: true,
        blockedBy: [],
        warnings: [],
      };

      // Act
      const signal = calculatorWithDetector.createSignal(
        evaluation,
        currentPrice,
        undefined,
        undefined,
        candles,
        context,
        100,
        100.05,
      );

      // Assert - should detect flat market and use single TP
      expect(signal.takeProfits).toHaveLength(1);
      expect(signal.takeProfits[0].sizePercent).toBe(100);
    });

    it('should fallback to legacy detection when FlatMarketDetector disabled', () => {
      // Arrange
      const flatMarketConfig = {
        enabled: false,
        flatThreshold: 80,
        emaThreshold: 0.3,
        atrThreshold: 1.5,
        rangeThreshold: 1.0,
        slopeThreshold: 5.0,
      };
      const calculatorWithDetector = new SignalCalculator(config, logger, flatMarketConfig);
      const evaluation = createMockEvaluation({ direction: SignalDirection.LONG });
      const currentPrice = 100.0;
      const marketBias = 'NEUTRAL';

      // Act
      const signal = calculatorWithDetector.createSignal(
        evaluation,
        currentPrice,
        undefined,
        marketBias,
      );

      // Assert - should use legacy detection
      expect(signal.takeProfits).toHaveLength(1);
      expect(signal.takeProfits[0].sizePercent).toBe(100);
    });

    it('should use multi-TP when FlatMarketDetector detects trending market', () => {
      // Arrange
      const flatMarketConfig = {
        enabled: true,
        flatThreshold: 80,
        emaThreshold: 0.3,
        atrThreshold: 1.5,
        rangeThreshold: 1.0,
        slopeThreshold: 5.0,
      };
      const calculatorWithDetector = new SignalCalculator(config, logger, flatMarketConfig);
      const evaluation = createMockEvaluation({ direction: SignalDirection.LONG });
      const currentPrice = 100.0;

      // Create test candles (wide range for trend detection)
      const candles = Array(30)
        .fill(null)
        .map((_, i) => ({
          timestamp: Date.now() + i * 60000,
          open: 100 + i * 0.1,
          high: 100 + i * 0.1 + 0.5,
          low: 100 + i * 0.1 - 0.5,
          close: 100 + i * 0.1,
          volume: 1000,
        }));

      const context = {
        timestamp: Date.now(),
        trend: 'BULLISH' as any,
        marketStructure: 'HH' as any,
        atrPercent: 2.5,
        emaDistance: 1.5,
        ema50: 100,
        atrModifier: 1.0,
        emaModifier: 1.0,
        trendModifier: 1.0,
        overallModifier: 1.0,
        isValidContext: true,
        blockedBy: [],
        warnings: [],
      };

      // Act
      const signal = calculatorWithDetector.createSignal(
        evaluation,
        currentPrice,
        undefined,
        undefined,
        candles,
        context,
        100,
        102,
      );

      // Assert - should detect trending market and use multi TP
      expect(signal.takeProfits).toHaveLength(3);
    });
  });
});
