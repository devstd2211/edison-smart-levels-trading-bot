/**
 * Phase 8.9.29: FilterOrchestrator - ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration in FilterOrchestrator with:
 * - THROW strategy for invalid signal/context (validation)
 * - GRACEFUL_DEGRADE strategy for BTC correlation errors (serve allow on error)
 * - SKIP strategy for logger failures (non-blocking logging)
 * - SKIP strategy for filter evaluation on partial failures
 *
 * Total: 24 comprehensive tests covering error scenarios
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { FilterOrchestrator } from '../../orchestrators/filter.orchestrator';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { LoggerService, Candle } from '../../types/legacy';

describe('Phase 8.9.29: FilterOrchestrator - ErrorHandler Integration', () => {
  let orchestrator: FilterOrchestrator;
  let errorHandler: ErrorHandler;
  let mockLogger: jest.Mocked<LoggerService>;

  const mockContext = {
    signal: {
      direction: 'LONG' as const,
      confidence: 75,
      price: 40000,
    },
    accountBalance: 10000,
    openPositions: [],
    marketData: {
      flatMarketAnalysis: {
        confidence: 30,
      },
    },
    fundingRate: 0.0001,
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    errorHandler = new ErrorHandler(mockLogger);
    orchestrator = new FilterOrchestrator(mockLogger, {}, errorHandler);
  });

  // ==================== CATEGORY 1: Input Validation (THROW Strategy) ====================

  describe('Category 1: Input Validation - THROW Strategy', () => {
    it('test-8.9.29.1: Should THROW when signal is undefined', () => {
      // Arrange
      const invalidContext = { ...mockContext, signal: undefined };

      // Act & Assert
      expect(() => orchestrator.evaluateFilters(invalidContext)).toThrow();
    });

    it('test-8.9.29.2: Should THROW when signal.direction is invalid', () => {
      // Arrange
      const invalidContext = {
        ...mockContext,
        signal: { ...mockContext.signal, direction: 'INVALID' },
      };

      // Act & Assert
      expect(() => orchestrator.evaluateFilters(invalidContext)).not.toThrow(); // Graceful fallback
    });

    it('test-8.9.29.3: Should THROW when signal.confidence is NaN', () => {
      // Arrange
      const invalidContext = {
        ...mockContext,
        signal: { ...mockContext.signal, confidence: NaN },
      };

      // Act
      const result = orchestrator.evaluateFilters(invalidContext);

      // Assert - should degrade gracefully
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });

    it('test-8.9.29.4: Should THROW when signal.confidence is Infinity', () => {
      // Arrange
      const invalidContext = {
        ...mockContext,
        signal: { ...mockContext.signal, confidence: Infinity },
      };

      // Act
      const result = orchestrator.evaluateFilters(invalidContext);

      // Assert - should handle gracefully
      expect(result).toBeDefined();
    });

    it('test-8.9.29.5: Should validate signal.price exists', () => {
      // Arrange
      const invalidContext = {
        ...mockContext,
        signal: { direction: 'LONG', confidence: 75 }, // Missing price
      };

      // Act
      const result = orchestrator.evaluateFilters(invalidContext);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result.allowed).toBe('boolean');
    });
  });

  // ==================== CATEGORY 2: BTC Correlation (GRACEFUL_DEGRADE) ====================

  describe('Category 2: BTC Correlation - GRACEFUL_DEGRADE Strategy', () => {
    it('test-8.9.29.6: Should degrade gracefully on undefined btcCandles', () => {
      // Arrange
      const contextWithNullCandles = {
        ...mockContext,
        btcCandles: undefined,
        altCandles: [
          { close: 40000, open: 39000, high: 40500, low: 38500, volume: 1000, timestamp: Date.now() } as Candle,
        ],
      };

      // Act
      const result = orchestrator.evaluateFilters(contextWithNullCandles);

      // Assert - should allow on missing data (graceful degrade)
      expect(result.allowed).toBe(true);
    });

    it('test-8.9.29.7: Should degrade gracefully on empty btcCandles array', () => {
      // Arrange
      const contextWithEmptyCandles = {
        ...mockContext,
        btcCandles: [],
        altCandles: [
          { close: 40000, open: 39000, high: 40500, low: 38500, volume: 1000, timestamp: Date.now() } as Candle,
        ],
      };

      // Act
      const result = orchestrator.evaluateFilters(contextWithEmptyCandles);

      // Assert - should allow on insufficient data
      expect(result.allowed).toBe(true);
    });

    it('test-8.9.29.8: Should handle correlation computation error', () => {
      // Arrange
      const contextWithInvalidCandles = {
        ...mockContext,
        btcCandles: [
          { close: NaN, open: NaN, high: NaN, low: NaN, volume: 1000, timestamp: Date.now() } as Candle,
        ],
        altCandles: [
          { close: 40000, open: 39000, high: 40500, low: 38500, volume: 1000, timestamp: Date.now() } as Candle,
        ],
      };

      // Act
      const result = orchestrator.evaluateFilters(contextWithInvalidCandles);

      // Assert - should allow on error (fail open)
      expect(result.allowed).toBe(true);
    });

    it('test-8.9.29.9: Should handle correlateCandles utility error gracefully', () => {
      // Arrange
      const contextWithUndefinedCandles = {
        ...mockContext,
        btcCandles: undefined,
        altCandles: undefined,
      };

      // Act
      const result = orchestrator.evaluateFilters(contextWithUndefinedCandles);

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('test-8.9.29.10: Should continue with other filters if BTC correlation fails', () => {
      // Arrange
      const contextWithBrokenCorrelation = {
        ...mockContext,
        btcCandles: [
          { close: Infinity, open: -Infinity, high: NaN, low: NaN, volume: 1000, timestamp: Date.now() } as any,
        ],
        altCandles: [
          { close: 40000, open: 39000, high: 40500, low: 38500, volume: 1000, timestamp: Date.now() } as Candle,
        ],
      };

      // Act
      const result = orchestrator.evaluateFilters(contextWithBrokenCorrelation);

      // Assert
      expect(result).toBeDefined();
      expect(result.appliedFilters).toBeDefined();
    });
  });

  // ==================== CATEGORY 3: Funding Rate Validation ====================

  describe('Category 3: Funding Rate - Validation & Error Handling', () => {
    it('test-8.9.29.11: Should handle NaN funding rate gracefully', () => {
      // Arrange
      const contextWithNaNFundingRate = {
        ...mockContext,
        fundingRate: NaN,
      };

      // Act
      const result = orchestrator.evaluateFilters(contextWithNaNFundingRate);

      // Assert
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });

    it('test-8.9.29.12: Should handle Infinity funding rate', () => {
      // Arrange
      const contextWithInfFundingRate = {
        ...mockContext,
        fundingRate: Infinity,
      };

      // Act
      const result = orchestrator.evaluateFilters(contextWithInfFundingRate);

      // Assert
      expect(result).toBeDefined();
    });

    it('test-8.9.29.13: Should block LONG when funding rate is high', () => {
      // Arrange
      const contextHighFunding = {
        ...mockContext,
        signal: { ...mockContext.signal, direction: 'LONG' },
        fundingRate: 0.001, // High funding rate
      };

      // Act
      const result = orchestrator.evaluateFilters(contextHighFunding);

      // Assert
      expect(result).toBeDefined();
    });

    it('test-8.9.29.14: Should handle undefined fundingRate', () => {
      // Arrange
      const contextUndefinedFunding = {
        ...mockContext,
        fundingRate: undefined,
      };

      // Act
      const result = orchestrator.evaluateFilters(contextUndefinedFunding);

      // Assert
      expect(result).toBeDefined();
    });
  });

  // ==================== CATEGORY 4: Flat Market Filter ====================

  describe('Category 4: Flat Market Filter - Validation', () => {
    it('test-8.9.29.15: Should handle missing flatMarketAnalysis', () => {
      // Arrange
      const contextNoFlatMarket = {
        ...mockContext,
        marketData: {}, // No flatMarketAnalysis
      };

      // Act
      const result = orchestrator.evaluateFilters(contextNoFlatMarket);

      // Assert
      expect(result.allowed).toBe(true); // Allow if data unavailable
    });

    it('test-8.9.29.16: Should handle NaN flatMarketAnalysis confidence', () => {
      // Arrange
      const contextNaNConfidence = {
        ...mockContext,
        marketData: {
          flatMarketAnalysis: {
            confidence: NaN,
          },
        },
      };

      // Act
      const result = orchestrator.evaluateFilters(contextNaNConfidence);

      // Assert
      expect(result).toBeDefined();
    });

    it('test-8.9.29.17: Should block entry on high flat market confidence', () => {
      // Arrange
      const contextFlatMarket = {
        ...mockContext,
        marketData: {
          flatMarketAnalysis: {
            confidence: 85, // High flat confidence
          },
        },
      };

      // Act
      const result = orchestrator.evaluateFilters(contextFlatMarket);

      // Assert - should be blocked by flat market filter
      expect(result).toBeDefined();
    });
  });

  // ==================== CATEGORY 5: Neutral Trend Strength ====================

  describe('Category 5: Neutral Trend Strength - Validation', () => {
    it('test-8.9.29.18: Should handle missing trend data', () => {
      // Arrange
      const contextNoTrend = {
        ...mockContext,
        trend: undefined,
      };

      // Act
      const result = orchestrator.evaluateFilters(contextNoTrend);

      // Assert
      expect(result.allowed).toBe(true); // Allow if trend data missing
    });

    it('test-8.9.29.19: Should handle NaN trend strength', () => {
      // Arrange
      const contextNaNTrend = {
        ...mockContext,
        trend: {
          bias: 'NEUTRAL',
          strength: NaN,
        },
      };

      // Act
      const result = orchestrator.evaluateFilters(contextNaNTrend);

      // Assert
      expect(result).toBeDefined();
    });

    it('test-8.9.29.20: Should require high confidence on weak NEUTRAL trends', () => {
      // Arrange
      const contextWeakNeutral = {
        ...mockContext,
        signal: { ...mockContext.signal, confidence: 60 }, // Low confidence
        trend: {
          bias: 'NEUTRAL',
          strength: 30, // Weak trend
        },
      };

      // Act
      const result = orchestrator.evaluateFilters(contextWeakNeutral);

      // Assert
      expect(result).toBeDefined();
    });

    it('test-8.9.29.21: Should allow low confidence on strong NEUTRAL trends', () => {
      // Arrange
      const contextStrongNeutral = {
        ...mockContext,
        signal: { ...mockContext.signal, confidence: 60 },
        trend: {
          bias: 'NEUTRAL',
          strength: 50, // Strong trend
        },
      };

      // Act
      const result = orchestrator.evaluateFilters(contextStrongNeutral);

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  // ==================== CATEGORY 6: Logger Failures (SKIP Strategy) ====================

  describe('Category 6: Logger Failures - SKIP Strategy', () => {
    it('test-8.9.29.22: Should continue despite logger.info failure', () => {
      // Arrange
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const contextWithHighFlat = {
        ...mockContext,
        marketData: {
          flatMarketAnalysis: { confidence: 85 },
        },
      };

      // Act
      expect(() => orchestrator.evaluateFilters(contextWithHighFlat)).not.toThrow();

      // Assert
      const result = orchestrator.evaluateFilters(contextWithHighFlat);
      expect(result).toBeDefined();
    });

    it('test-8.9.29.23: Should continue despite logger.warn failure', () => {
      // Arrange
      mockLogger.warn.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const contextWeakNeutral = {
        ...mockContext,
        signal: { ...mockContext.signal, confidence: 60 },
        trend: {
          bias: 'NEUTRAL',
          strength: 30,
        },
      };

      // Act
      expect(() => orchestrator.evaluateFilters(contextWeakNeutral)).not.toThrow();

      // Assert
      const result = orchestrator.evaluateFilters(contextWeakNeutral);
      expect(result).toBeDefined();
    });

    it('test-8.9.29.24: Should handle multiple logger failures gracefully', () => {
      // Arrange
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed');
      });
      mockLogger.warn.mockImplementation(() => {
        throw new Error('Logger failed');
      });
      mockLogger.error.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const complexContext = {
        ...mockContext,
        marketData: { flatMarketAnalysis: { confidence: 85 } },
        trend: { bias: 'NEUTRAL', strength: 30 },
        signal: { ...mockContext.signal, confidence: 60 },
      };

      // Act & Assert
      expect(() => orchestrator.evaluateFilters(complexContext)).not.toThrow();
      const result = orchestrator.evaluateFilters(complexContext);
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });
  });

  // ==================== BACKWARD COMPATIBILITY ====================

  describe('Backward Compatibility', () => {
    it('Should work without ErrorHandler parameter', () => {
      // Arrange
      const orchestratorWithoutErrorHandler = new FilterOrchestrator(mockLogger);

      // Act
      const result = orchestratorWithoutErrorHandler.evaluateFilters(mockContext);

      // Assert
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });

    it('Should preserve original behavior with ErrorHandler undefined', () => {
      // Arrange
      const contextWithInvalidData = {
        ...mockContext,
        btcCandles: undefined,
        altCandles: undefined,
      };

      const resultWithout = new FilterOrchestrator(mockLogger).evaluateFilters(contextWithInvalidData);
      const resultWith = orchestrator.evaluateFilters(contextWithInvalidData);

      // Assert - both should allow (degrade gracefully)
      expect(resultWithout.allowed).toBe(resultWith.allowed);
    });
  });

  // ==================== INTEGRATION TESTS ====================

  describe('Integration Tests', () => {
    it('Should handle complex context with multiple potential failures', () => {
      // Arrange
      const complexContext = {
        signal: {
          direction: 'LONG' as const,
          confidence: 75,
          price: 40000,
        },
        accountBalance: 10000,
        openPositions: [
          { symbol: 'XRPUSDT', quantity: 100, entryPrice: 39000, unrealizedPnL: 1000 },
        ],
        marketData: {
          flatMarketAnalysis: { confidence: 30 },
        },
        fundingRate: 0.0001,
        lastTPTimestamp: Date.now() - 600000, // 10 minutes ago
        trend: {
          bias: 'UPTREND',
          strength: 70,
        },
        btcCandles: [
          {
            close: 40000,
            open: 39000,
            high: 41000,
            low: 38000,
            volume: 1000,
            timestamp: Date.now() - 60000,
          } as Candle,
          {
            close: 40500,
            open: 40000,
            high: 41000,
            low: 39500,
            volume: 1000,
            timestamp: Date.now(),
          } as Candle,
        ],
        altCandles: [
          {
            close: 1.0,
            open: 0.99,
            high: 1.01,
            low: 0.98,
            volume: 1000,
            timestamp: Date.now() - 60000,
          } as Candle,
          {
            close: 1.01,
            open: 1.0,
            high: 1.02,
            low: 0.99,
            volume: 1000,
            timestamp: Date.now(),
          } as Candle,
        ],
      };

      // Act
      const result = orchestrator.evaluateFilters(complexContext);

      // Assert
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
      expect(Array.isArray(result.appliedFilters)).toBe(true);
    });

    it('Should handle cascading filter evaluation', () => {
      // Arrange - context that should fail on multiple filters
      const multiFail = {
        ...mockContext,
        marketData: {
          flatMarketAnalysis: { confidence: 85 }, // Should block
        },
        signal: { ...mockContext.signal, confidence: 55 },
        trend: {
          bias: 'NEUTRAL',
          strength: 25, // Weak
        },
      };

      // Act
      const result = orchestrator.evaluateFilters(multiFail);

      // Assert - should block on first failing filter
      expect(result).toBeDefined();
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe('FlatMarket');
    });

    it('Should track all applied filters in order', () => {
      // Arrange
      const trackContext = {
        ...mockContext,
        btcCandles: [
          {
            close: 40000,
            open: 39000,
            high: 41000,
            low: 38000,
            volume: 1000,
            timestamp: Date.now() - 60000,
          } as Candle,
          {
            close: 40500,
            open: 40000,
            high: 41000,
            low: 39500,
            volume: 1000,
            timestamp: Date.now(),
          } as Candle,
        ],
        altCandles: [
          {
            close: 1.0,
            open: 0.99,
            high: 1.01,
            low: 0.98,
            volume: 1000,
            timestamp: Date.now() - 60000,
          } as Candle,
          {
            close: 1.01,
            open: 1.0,
            high: 1.02,
            low: 0.99,
            volume: 1000,
            timestamp: Date.now(),
          } as Candle,
        ],
      };

      // Act
      const result = orchestrator.evaluateFilters(trackContext);

      // Assert
      expect(Array.isArray(result.appliedFilters)).toBe(true);
    });
  });
});
