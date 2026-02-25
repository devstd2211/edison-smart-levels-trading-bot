/**
 * WhaleDetectionService Error Handling Tests (Phase 8.9.73)
 *
 * Test Coverage:
 * - THROW: Config and input validation
 * - GRACEFUL_DEGRADE: Detection failures
 * - SKIP: Logging failures
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import { WhaleDetectionService, WhaleDetectorConfig, WhaleDetectionMode } from '../../services/whale-detection.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { OrderBookAnalysis, SignalDirection } from '../../types/legacy';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
});

const createValidConfig = (): WhaleDetectorConfig => ({
  modes: {
    wallBreak: {
      enabled: true,
      minWallSize: 15,
      breakConfirmationMs: 3000,
      maxConfidence: 85,
    },
    wallDisappearance: {
      enabled: true,
      minWallSize: 20,
      minWallDuration: 60000,
      wallGoneThresholdMs: 15000,
      maxConfidence: 80,
    },
    imbalanceSpike: {
      enabled: true,
      minRatioChange: 1.5,
      detectionWindow: 10000,
      maxConfidence: 90,
    },
  },
  maxImbalanceHistory: 20,
  wallExpiryMs: 60000,
  breakExpiryMs: 300000,
});

const createValidAnalysis = (): OrderBookAnalysis => ({
  timestamp: Date.now(),
  orderBook: { bids: [], asks: [] } as any,
  imbalance: {
    ratio: 1.2,
    direction: 'BULLISH',
    bidVolume: 100,
    askVolume: 83.33,
    strength: 0.2,
  },
  walls: [],
  strongestBid: null,
  strongestAsk: null,
  spread: 0.002,
  depth: { bid: 50, ask: 50 },
});

describe('WhaleDetectionService Error Handling (Phase 8.9.73)', () => {
  // ============================================================================
  // THROW: Config Validation (4 tests)
  // ============================================================================

  describe('THROW: Config Validation', () => {
    const mockLogger = createMockLogger() as any;

    test('should throw on null config', () => {
      const errorHandler = new ErrorHandler(mockLogger);
      expect(() => {
        new WhaleDetectionService(null as any, mockLogger, 'BREAKOUT', errorHandler);
      }).toThrow('Config must be a valid object');
    });

    test('should throw on invalid wallBreak minWallSize', () => {
      const errorHandler = new ErrorHandler(mockLogger);
      const config = {
        ...createValidConfig(),
        modes: {
          ...createValidConfig().modes,
          wallBreak: {
            ...createValidConfig().modes.wallBreak,
            minWallSize: -10,
          },
        },
      };
      expect(() => {
        new WhaleDetectionService(config, mockLogger, 'BREAKOUT', errorHandler);
      }).toThrow('wallBreak.minWallSize must be non-negative number');
    });

    test('should throw on invalid maxConfidence (>100)', () => {
      const errorHandler = new ErrorHandler(mockLogger);
      const config = {
        ...createValidConfig(),
        modes: {
          ...createValidConfig().modes,
          wallBreak: {
            ...createValidConfig().modes.wallBreak,
            maxConfidence: 150,
          },
        },
      };
      expect(() => {
        new WhaleDetectionService(config, mockLogger, 'BREAKOUT', errorHandler);
      }).toThrow('wallBreak.maxConfidence must be between 0 and 100');
    });

    test('should throw on invalid maxImbalanceHistory', () => {
      const errorHandler = new ErrorHandler(mockLogger);
      const config = { ...createValidConfig(), maxImbalanceHistory: 0 };
      expect(() => {
        new WhaleDetectionService(config, mockLogger, 'BREAKOUT', errorHandler);
      }).toThrow('maxImbalanceHistory must be positive number');
    });
  });

  // ============================================================================
  // THROW: Input Validation (3 tests)
  // ============================================================================

  describe('THROW: Input Validation', () => {
    const mockLogger = createMockLogger() as any;
    const errorHandler = new ErrorHandler(mockLogger);
    let service: WhaleDetectionService;

    beforeEach(() => {
      service = new WhaleDetectionService(createValidConfig(), mockLogger, 'BREAKOUT', errorHandler);
    });

    test('should throw on null analysis', () => {
      expect(() => {
        service.detectWhale(null as any, 50000);
      }).toThrow('Analysis must be a valid object');
    });

    test('should throw on invalid price (NaN)', () => {
      expect(() => {
        service.detectWhale(createValidAnalysis(), NaN);
      }).toThrow('Current price must be a finite number');
    });

    test('should throw on negative BTC momentum', () => {
      expect(() => {
        service.detectWhale(createValidAnalysis(), 50000, -0.5);
      }).toThrow('BTC momentum must be between 0 and 1');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: Detection Failures (3 tests)
  // ============================================================================

  describe('GRACEFUL_DEGRADE: Detection Failures', () => {
    const mockLogger = createMockLogger() as any;
    const errorHandler = new ErrorHandler(mockLogger);
    let service: WhaleDetectionService;

    beforeEach(() => {
      service = new WhaleDetectionService(createValidConfig(), mockLogger, 'BREAKOUT', errorHandler);
    });

    test('should handle valid detection', () => {
      const result = service.detectWhale(createValidAnalysis(), 50000);
      expect(result).toBeDefined();
      expect(typeof result.detected).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
    });

    test('should handle valid detection with BTC momentum', () => {
      const result = service.detectWhale(createValidAnalysis(), 50000, 0.75, 'UP');
      expect(result).toBeDefined();
      expect(result.confidence >= 0 && result.confidence <= 100).toBe(true);
    });

    test('should handle clear without errors', () => {
      expect(() => {
        service.clear();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // SKIP: Logging Failures (2 tests)
  // ============================================================================

  describe('SKIP: Logging Failures', () => {
    test('should not throw when detection logs fail', () => {
      const mockLogger = {
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        silly: jest.fn(),
      };
      const errorHandler = new ErrorHandler(mockLogger as any);
      const service = new WhaleDetectionService(createValidConfig(), mockLogger as any, 'BREAKOUT', errorHandler);

      expect(() => {
        service.detectWhale(createValidAnalysis(), 50000);
      }).not.toThrow();
    });

    test('should not throw when debug logs fail', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(() => {
          throw new Error('Debug failed');
        }),
        silly: jest.fn(),
      };
      const errorHandler = new ErrorHandler(mockLogger as any);
      const service = new WhaleDetectionService(createValidConfig(), mockLogger as any, 'BREAKOUT', errorHandler);

      expect(() => {
        service.detectWhale(createValidAnalysis(), 50000);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: Detection Operations (2 tests)
  // ============================================================================

  describe('Integration: Detection Operations', () => {
    const mockLogger = createMockLogger() as any;
    const errorHandler = new ErrorHandler(mockLogger);
    let service: WhaleDetectionService;

    beforeEach(() => {
      service = new WhaleDetectionService(createValidConfig(), mockLogger, 'BREAKOUT', errorHandler);
    });

    test('should handle multiple sequential detections', () => {
      for (let i = 0; i < 5; i++) {
        const result = service.detectWhale(createValidAnalysis(), 50000 + i);
        expect(result).toBeDefined();
      }
    });

    test('should get stats without errors', () => {
      service.detectWhale(createValidAnalysis(), 50000);
      const stats = service.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.trackedWalls).toBe('object');
      expect(typeof stats.recentBreaks).toBe('number');
      expect(typeof stats.imbalanceHistory).toBe('number');
    });
  });

  // ============================================================================
  // Backward Compatibility: Without ErrorHandler (2 tests)
  // ============================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    const mockLogger = createMockLogger() as any;

    test('should work without ErrorHandler', () => {
      const service = new WhaleDetectionService(createValidConfig(), mockLogger);
      const result = service.detectWhale(createValidAnalysis(), 50000);

      expect(result).toBeDefined();
      expect(result.detected === false).toBe(true);
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const service = new WhaleDetectionService(createValidConfig(), mockLogger);

      expect(() => {
        service.detectWhale(createValidAnalysis(), NaN);
      }).toThrow('Current price must be a finite number');
    });
  });
});
