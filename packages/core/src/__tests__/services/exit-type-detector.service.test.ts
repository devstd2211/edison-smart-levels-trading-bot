/**
 * Exit Type Detector Service Tests
 * Tests for determining position exit type from order history
 */

import { ExitTypeDetectorService } from '../../services/exit-type-detector.service';
import { LoggerService, ExitType, PositionSide, Position, BybitOrder } from '../../types/legacy';
import {
  createManagedExitTypeDetectorContext,
  createExitTypeDetectorOrder,
  createExitTypeDetectorScenarioHarness,
  createExitTypeDetectorTakeProfits,
  createExitTypeDetectorTimedOrderHistory,
  takeProfitExitTypes,
  type ManagedExitTypeDetectorContext,
} from '../helpers/exit-type-detector-test.utils';

const createMockOrder = createExitTypeDetectorOrder;

// ============================================================================
// MOCKS
// ============================================================================

// ============================================================================
// TESTS
// ============================================================================

describe('ExitTypeDetectorService', () => {
  let service: ExitTypeDetectorService;
  let logger: LoggerService;
  let createScenario: ExitTypeDetectorFixtures['createScenario'];

  type ExitTypeDetectorFixtures = Pick<
    ManagedExitTypeDetectorContext,
    'service' | 'logger' | 'createScenario'
  >;

  function registerExitTypeDetectorFixtures() {
    let fixtures: ExitTypeDetectorFixtures;
    let cleanup: ManagedExitTypeDetectorContext['cleanup'];

    beforeEach(() => {
      const managedContext = createManagedExitTypeDetectorContext({
        withErrorHandler: false,
      });
      fixtures = {
        service: managedContext.service,
        logger: managedContext.logger,
        createScenario: managedContext.createScenario,
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => fixtures;
  }

  const useFixtures = registerExitTypeDetectorFixtures();

  beforeEach(() => {
    ({ service, logger, createScenario } = useFixtures());
  });

  // ==========================================================================
  // TEST GROUP 1: Exit Type Detection
  // ==========================================================================

  describe('determineExitTypeFromHistory', () => {
    it('should detect STOP_LOSS from stopOrderType "StopLoss"', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createExitTypeDetectorOrder({
          orderStatus: 'Filled',
          stopOrderType: 'StopLoss',
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.STOP_LOSS);
    });

    it('should detect STOP_LOSS from stopOrderType "Stop"', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createExitTypeDetectorOrder({
          orderStatus: 'Filled',
          stopOrderType: 'Stop',
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.STOP_LOSS);
    });

    it('should detect TRAILING_STOP from stopOrderType "TrailingStop"', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createExitTypeDetectorOrder({
          orderStatus: 'Filled',
          stopOrderType: 'TrailingStop',
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.TRAILING_STOP);
    });

    it('should detect TAKE_PROFIT from Limit order with reduceOnly', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createExitTypeDetectorOrder({
          orderType: 'Limit',
          reduceOnly: true,
          stopOrderType: undefined,
          price: '101.0', // Close to TP1
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(takeProfitExitTypes).toContain(exitType);
    });

    it('should detect MANUAL close from Market order with reduceOnly', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderType: 'Market',
          reduceOnly: true,
          stopOrderType: undefined,
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.MANUAL);
    });

    it('should return MANUAL when no filled orders found', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderStatus: 'Pending', // Not filled
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.MANUAL);
    });

    it('should return MANUAL for empty order history', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.MANUAL);
    });

    it('should use most recent filled order', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = createExitTypeDetectorTimedOrderHistory([
        {
          orderStatus: 'Filled',
          stopOrderType: 'Stop',
        },
        {
          orderStatus: 'Filled',
          stopOrderType: 'TrailingStop',
        },
      ]);

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.STOP_LOSS); // Most recent is Stop
    });

    it('should filter by symbol', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = createExitTypeDetectorTimedOrderHistory([
        {
          symbol: 'OTHERUSDT', // Different symbol
          orderStatus: 'Filled',
          stopOrderType: 'Stop',
        },
        {
          symbol: 'APEXUSDT',
          orderStatus: 'Filled',
          stopOrderType: 'TrailingStop',
        },
      ]);

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.TRAILING_STOP); // Only APEXUSDT orders
    });
  });

  // ==========================================================================
  // TEST GROUP 2: TP Level Identification
  // ==========================================================================

  describe('identifyTPLevel', () => {
    it('should identify TP1 when price closest to first level', () => {
      const { position } = createScenario();

      const level = service.identifyTPLevel(101.05, position); // Close to TP1 (101)

      expect(level).toBe(1);
    });

    it('should identify TP2 when price closest to second level', () => {
      const { position } = createScenario();

      const level = service.identifyTPLevel(102.05, position); // Close to TP2 (102)

      expect(level).toBe(2);
    });

    it('should identify TP3 when price closest to third level', () => {
      const { position } = createScenario();

      const level = service.identifyTPLevel(103.05, position); // Close to TP3 (103)

      expect(level).toBe(3);
    });

    it('should return 1 when no TP levels defined', () => {
      const { position } = createScenario();
      position.takeProfits = [];

      const level = service.identifyTPLevel(150, position);

      expect(level).toBe(1);
    });

    it('should handle exact match to TP level', () => {
      const { position } = createScenario();

      const level = service.identifyTPLevel(102, position); // Exact match to TP2

      expect(level).toBe(2);
    });

    it('should find closest level when price between TPs', () => {
      const { position } = createScenario();

      const level = service.identifyTPLevel(101.5, position); // Between TP1 and TP2

      // Should be closest to TP1 (101) vs TP2 (102)
      expect(level).toBe(1);
    });

    it('should handle price above all TP levels', () => {
      const { position } = createScenario();

      const level = service.identifyTPLevel(200, position);

      // Should match TP3 (103) as closest
      expect(level).toBe(3);
    });

    it('should handle price below all TP levels', () => {
      const { position } = createScenario();

      const level = service.identifyTPLevel(50, position);

      // Should match TP1 (101) as closest
      expect(level).toBe(1);
    });

    it('should handle single TP level', () => {
      const { position } = createScenario({
        positionOverrides: { takeProfits: createExitTypeDetectorTakeProfits([105]) },
      });

      const level = service.identifyTPLevel(105.5, position);

      expect(level).toBe(1);
    });

    it('should use 1-based indexing', () => {
      const { position } = createScenario();

      // Test all 3 levels to ensure 1-based
      expect(service.identifyTPLevel(101, position)).toBe(1);
      expect(service.identifyTPLevel(102, position)).toBe(2);
      expect(service.identifyTPLevel(103, position)).toBe(3);
    });
  });

  // ==========================================================================
  // TEST GROUP 3: Integration Scenarios
  // ==========================================================================

  describe('integration scenarios', () => {
    it('should determine TP1 exit correctly', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderType: 'Limit',
          reduceOnly: true,
          stopOrderType: undefined,
          price: '101.0', // TP1 price
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.TAKE_PROFIT_1);
    });

    it('should determine TP2 exit correctly', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderType: 'Limit',
          reduceOnly: true,
          stopOrderType: undefined,
          price: '102.0', // TP2 price
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.TAKE_PROFIT_2);
    });

    it('should determine TP3 exit correctly', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderType: 'Limit',
          reduceOnly: true,
          stopOrderType: undefined,
          price: '103.0', // TP3 price
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.TAKE_PROFIT_3);
    });

    it('should handle SHORT position exit correctly', () => {
      const { position } = createScenario({ positionOverrides: { side: PositionSide.SHORT } });
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderStatus: 'Filled',
          stopOrderType: 'Stop',
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.STOP_LOSS);
    });

    it('should handle multiple exit orders in history', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = createExitTypeDetectorTimedOrderHistory([
        {
          orderStatus: 'Filled',
          stopOrderType: 'Stop',
        },
        {
          orderStatus: 'Filled',
          orderType: 'Limit',
          reduceOnly: true,
          price: '101.0',
        },
      ], { stepMs: 100000 });

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      // Should use most recent (Stop)
      expect(exitType).toBe(ExitType.STOP_LOSS);
    });
  });

  // ==========================================================================
  // TEST GROUP 4: Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle order with missing updatedTime', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderStatus: 'Filled',
          stopOrderType: 'Stop',
          updatedTime: undefined as unknown as number,
        }),
      ];

      expect(() => {
        service.determineExitTypeFromHistory(orderHistory, position);
      }).not.toThrow();
    });

    it('should handle order with undefined stopOrderType', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderStatus: 'Filled',
          stopOrderType: undefined,
          orderType: 'Market',
          reduceOnly: true,
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      expect(exitType).toBe(ExitType.MANUAL);
    });

    it('should handle numeric price string parsing', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderType: 'Limit',
          reduceOnly: true,
          price: '102.5', // String that needs parsing
          stopOrderType: undefined,
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      // Should identify as TP2 since 102.5 is closest to 102
      expect(exitType).toBe(ExitType.TAKE_PROFIT_2);
    });

    it('should handle large TP level arrays', () => {
      const { position } = createScenario({
        positionOverrides: {
          takeProfits: createExitTypeDetectorTakeProfits(
            Array.from({ length: 10 }, (_, i) => 101 + i),
          ),
        },
      });

      const level = service.identifyTPLevel(107.1, position);

      expect(level).toBe(7); // Closest to 107
    });

    it('should be case-sensitive for stopOrderType comparison', () => {
      const { position } = createScenario();
      const orderHistory: BybitOrder[] = [
        createMockOrder({
          orderStatus: 'Filled',
          stopOrderType: 'stoploss' as unknown as string, // lowercase - should not match
          updatedTime: Date.now(),
        }),
      ];

      const exitType = service.determineExitTypeFromHistory(orderHistory, position);

      // Should return MANUAL because 'stoploss' !== 'StopLoss'
      expect(exitType).toBe(ExitType.MANUAL);
    });
  });
});
