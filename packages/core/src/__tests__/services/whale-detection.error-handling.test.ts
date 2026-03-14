/**
 * WhaleDetectionService Error Handling Tests (Phase 8.9.73)
 *
 * Test Coverage:
 * - THROW: Config and input validation
 * - GRACEFUL_DEGRADE: Detection failures
 * - SKIP: Logging failures
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import { WhaleDetectionService, WhaleDetectorConfig } from '../../services/whale-detection.service';
import { LoggerService } from '../../services/logger.service';
import {
  createWhaleDetectionAnalysis,
  createWhaleDetectionConfig,
  createWhaleDetectionErrorHandler,
  createWhaleDetectionHarness,
  createWhaleDetectionMockLogger,
  createWhaleDetectionService,
} from '../helpers/whale-detection-test.utils';

const createMockLogger = createWhaleDetectionMockLogger;
const createValidAnalysis = () => createWhaleDetectionAnalysis([], 1.2, 'BULLISH');
const createValidConfig = (): WhaleDetectorConfig => {
  const config = createWhaleDetectionConfig();
  return {
    ...config,
    modes: {
      ...config.modes,
      imbalanceSpike: {
        ...config.modes.imbalanceSpike,
        minRatioChange: 1.5,
      },
    },
  };
};

describe('WhaleDetectionService Error Handling (Phase 8.9.73)', () => {
  // ============================================================================
  // THROW: Config Validation (4 tests)
  // ============================================================================

  describe('THROW: Config Validation', () => {
    const mockLogger = createMockLogger();
    type WhaleConfigInput = ConstructorParameters<typeof WhaleDetectionService>[0];

    test('should throw on null config', () => {
      const errorHandler = createWhaleDetectionErrorHandler(
        mockLogger as unknown as LoggerService,
      );
      expect(() => {
        createWhaleDetectionService({
          config: null as unknown as WhaleConfigInput,
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).toThrow('Config must be a valid object');
    });

    test('should throw on invalid wallBreak minWallSize', () => {
      const errorHandler = createWhaleDetectionErrorHandler(
        mockLogger as unknown as LoggerService,
      );
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
        createWhaleDetectionService({
          config,
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).toThrow('wallBreak.minWallSize must be non-negative number');
    });

    test('should throw on invalid maxConfidence (>100)', () => {
      const errorHandler = createWhaleDetectionErrorHandler(
        mockLogger as unknown as LoggerService,
      );
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
        createWhaleDetectionService({
          config,
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).toThrow('wallBreak.maxConfidence must be between 0 and 100');
    });

    test('should throw on invalid maxImbalanceHistory', () => {
      const errorHandler = createWhaleDetectionErrorHandler(
        mockLogger as unknown as LoggerService,
      );
      const config = { ...createValidConfig(), maxImbalanceHistory: 0 };
      expect(() => {
        createWhaleDetectionService({
          config,
          logger: mockLogger as unknown as LoggerService,
          errorHandler,
        });
      }).toThrow('maxImbalanceHistory must be positive number');
    });
  });

  // ============================================================================
  // THROW: Input Validation (3 tests)
  // ============================================================================

  describe('THROW: Input Validation', () => {
    const mockLogger = createMockLogger();
    let service: WhaleDetectionService;
    type WhaleAnalysisInput = Parameters<WhaleDetectionService['detectWhale']>[0];

    beforeEach(() => {
      ({ detector: service } = createWhaleDetectionHarness({
        config: createValidConfig(),
        logger: mockLogger as unknown as LoggerService,
      }));
    });

    test('should throw on null analysis', () => {
      expect(() => {
        service.detectWhale(null as unknown as WhaleAnalysisInput, 50000);
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
    const mockLogger = createMockLogger();
    let service: WhaleDetectionService;

    beforeEach(() => {
      ({ detector: service } = createWhaleDetectionHarness({
        config: createValidConfig(),
        logger: mockLogger as unknown as LoggerService,
      }));
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
      const errorHandler = createWhaleDetectionErrorHandler(
        mockLogger as unknown as LoggerService,
      );
      const service = createWhaleDetectionService({
        config: createValidConfig(),
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });

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
      const errorHandler = createWhaleDetectionErrorHandler(
        mockLogger as unknown as LoggerService,
      );
      const service = createWhaleDetectionService({
        config: createValidConfig(),
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });

      expect(() => {
        service.detectWhale(createValidAnalysis(), 50000);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: Detection Operations (2 tests)
  // ============================================================================

  describe('Integration: Detection Operations', () => {
    const mockLogger = createMockLogger();
    let service: WhaleDetectionService;

    beforeEach(() => {
      ({ detector: service } = createWhaleDetectionHarness({
        config: createValidConfig(),
        logger: mockLogger as unknown as LoggerService,
      }));
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
    const mockLogger = createMockLogger();

    test('should work without ErrorHandler', () => {
      const { detector: service } = createWhaleDetectionHarness({
        config: createValidConfig(),
        logger: mockLogger as unknown as LoggerService,
        withErrorHandler: false,
      });
      const result = service.detectWhale(createValidAnalysis(), 50000);

      expect(result).toBeDefined();
      expect(result.detected === false).toBe(true);
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const { detector: service } = createWhaleDetectionHarness({
        config: createValidConfig(),
        logger: mockLogger as unknown as LoggerService,
        withErrorHandler: false,
      });

      expect(() => {
        service.detectWhale(createValidAnalysis(), NaN);
      }).toThrow('Current price must be a finite number');
    });
  });
});
