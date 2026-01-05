/**
 * Tests for StrategyRegistrationService
 * Week 13 Phase 5a: Extracted from trading-orchestrator.service.ts constructor
 */

import { StrategyRegistrationService } from '../../services/strategy-registration.service';

describe('StrategyRegistrationService', () => {
  let service: StrategyRegistrationService;
  let mockCoordinator: any;
  let mockLogger: any;
  let mockBybitService: any;
  let mockConfig: any;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCoordinator = {
      registerStrategy: jest.fn(),
      getStrategies: jest.fn().mockReturnValue([]),
    };

    mockBybitService = {
      getFundingRate: jest.fn(),
    };

    mockConfig = {
      weightMatrix: {
        enabled: true,
        minConfidenceToEnter: 50,
        minConfidenceForReducedSize: 30,
      },
      entryConfig: {
        zigzagDepth: 5,
        rsiPeriod: 14,
        fastEmaPeriod: 20,
        slowEmaPeriod: 50,
      },
      strategiesConfig: {
        trendFollowing: { enabled: false },
        levelBased: { enabled: false },
        counterTrend: { enabled: false },
      },
      whaleHunter: null,
      whaleHunterFollow: null,
      scalpingMicroWall: null,
      scalpingLimitOrder: null,
      scalpingLadderTp: null,
      scalpingTickDelta: null,
      scalpingOrderFlow: null,
      fractalBreakoutRetest: null,
      edgeReversals: null,
      sessionBasedSL: null,
      analysisConfig: {},
      marketHealth: null,
    };

    service = new StrategyRegistrationService(
      mockCoordinator,
      mockConfig,
      mockBybitService,
      mockLogger,
    );
  });

  describe('registerAllStrategies', () => {
    it('should initialize weight matrix calculator when enabled', () => {
      service.registerAllStrategies();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Weight Matrix Calculator initialized'),
        expect.any(Object),
      );
    });

    it('should not fail when no strategies are enabled', () => {
      expect(() => {
        service.registerAllStrategies();
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Strategy Coordinator initialized'),
        expect.any(Object),
      );
    });

    it('should register traditional strategies when enabled', () => {
      mockConfig.strategiesConfig.levelBased = {
        enabled: true,
        priority: 1,
      };

      service.registerAllStrategies();

      expect(mockCoordinator.registerStrategy).toHaveBeenCalled();
      // Strategy registration may log in different ways depending on the strategy
      expect(mockLogger.info.mock.calls.length).toBeGreaterThan(0);
    });

    it('should register whale strategies when enabled', () => {
      mockConfig.whaleHunter = {
        enabled: true,
        priority: 1,
        minConfidence: 60,
        detector: {
          enabled: true,
          minWallSize: 10,
        },
      };

      service.registerAllStrategies();

      expect(mockCoordinator.registerStrategy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Whale Hunter Strategy registered'),
        expect.any(Object),
      );
    });

    it('should register scalping strategies when enabled', () => {
      mockConfig.scalpingMicroWall = {
        enabled: true,
        priority: 1,
        minConfidence: 50,
        takeProfitPercent: 0.5,
        stopLossPercent: 0.3,
        detector: {
          enabled: true,
        },
      };

      service.registerAllStrategies();

      expect(mockCoordinator.registerStrategy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Scalping Micro Wall Strategy registered'),
        expect.any(Object),
      );
    });

    it('should register fractal strategy when enabled', () => {
      mockConfig.fractalBreakoutRetest = {
        enabled: true,
        priority: 1,
        minCombinedScore: 70,
        highConfidenceThreshold: 85,
        dailyLevelConfig: {
          enabled: true,
        },
        rrRatio: {
          tp1: 1,
          tp2: 2,
          tp3: 3,
        },
      };

      service.registerAllStrategies();

      expect(mockCoordinator.registerStrategy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Fractal Breakout-Retest Strategy registered'),
        expect.any(Object),
      );
    });

    it('should handle multiple strategies enabled simultaneously', () => {
      mockConfig.strategiesConfig.levelBased = {
        enabled: true,
        priority: 1,
      };
      mockConfig.whaleHunter = {
        enabled: true,
        priority: 1,
        minConfidence: 60,
        detector: { enabled: true },
      };
      service.registerAllStrategies();

      // Should call registerStrategy at least once (LevelBased + WhaleHunter when enabled)
      expect(mockCoordinator.registerStrategy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should log final strategy coordinator status', () => {
      mockCoordinator.getStrategies.mockReturnValue([
        { name: 'LevelBased' },
        { name: 'WhaleHunter' },
      ]);

      service.registerAllStrategies();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Strategy Coordinator initialized'),
        expect.objectContaining({
          strategies: expect.arrayContaining(['LevelBased', 'WhaleHunter']),
        }),
      );
    });
  });
});
