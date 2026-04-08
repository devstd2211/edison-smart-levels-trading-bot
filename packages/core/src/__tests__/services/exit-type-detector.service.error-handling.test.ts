/**
 * Exit Type Detector Service - Error Handling Tests (Phase 8.9.18)
 *
 * Tests that ErrorHandler integration works correctly with:
 * - Empty order history fallback
 * - NaN price validation
 * - Missing TP levels handling
 * - Backward compatibility without ErrorHandler
 */

import { ExitTypeDetectorService } from '../../services/exit-type-detector.service';
import {
  ExitType,
  PositionSide,
  type BybitOrder,
  type LoggerService,
  type Position,
} from '../../types/legacy';
import {
  asExitTypeDetectorOrder,
  asExitTypeDetectorPosition,
  createManagedExitTypeDetectorContext,
  createExitTypeDetectorMockLogger,
  createExitTypeDetectorTakeProfits,
  createExitTypeDetectorTimedOrderHistory,
} from '../helpers/exit-type-detector-test.utils';

const asPosition = asExitTypeDetectorPosition;
const asOrder = asExitTypeDetectorOrder;
type ExitTypeDetectorManagedContext = ReturnType<typeof createManagedExitTypeDetectorContext>;
type ExitTypeDetectorFixtureContext = ReturnType<typeof createManagedExitTypeDetectorContext>;
type ExitTypeDetectorFixtures = Pick<
  ExitTypeDetectorFixtureContext,
  'logger' | 'service' | 'createScenario'
>;

function bindExitTypeDetectorFixtures() {
  let cleanup: ExitTypeDetectorFixtureContext['cleanup'];
  let fixtures: ExitTypeDetectorFixtures;

  beforeEach(() => {
    const mockLogger = createExitTypeDetectorMockLogger();
    const managedContext = createManagedExitTypeDetectorContext({ logger: mockLogger });
    cleanup = managedContext.cleanup;
    fixtures = {
      logger: managedContext.logger,
      service: managedContext.service,
      createScenario: managedContext.createScenario,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('ExitTypeDetectorService - Error Handling Integration (Phase 8.9.18)', () => {
  let service: ExitTypeDetectorService;
  let mockLogger: LoggerService;
  let createScenario: ExitTypeDetectorFixtures['createScenario'];
  const getFixtures = bindExitTypeDetectorFixtures();

  beforeEach(() => {
    ({ logger: mockLogger, service, createScenario } = getFixtures());
    jest.clearAllMocks();
  });

  // =============================== ===================================================
  // BASIC FUNCTIONALITY TESTS
  // ==========================================================================

  describe('Basic Exit Type Detection', () => {
    it('should detect STOP_LOSS from order history', () => {
      const position = asExitTypeDetectorPosition({
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        takeProfits: [{ level: 1, price: 46000, percent: 0.5, sizePercent: 50, hit: false }],
      });

      const order = asExitTypeDetectorOrder({
        symbol: 'BTCUSDT',
        orderStatus: 'Filled',
        stopOrderType: 'StopLoss',
        price: '44000',
      });

      const result = service.determineExitTypeFromHistory([order], position);
      expect(result).toBe(ExitType.STOP_LOSS);
    });

    it('should detect TRAILING_STOP from order history', () => {
      const position = asExitTypeDetectorPosition({
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        takeProfits: [{ level: 1, price: 46000, percent: 0.5, sizePercent: 50, hit: false }],
      });

      const order = asExitTypeDetectorOrder({
        symbol: 'BTCUSDT',
        orderStatus: 'Filled',
        stopOrderType: 'TrailingStop',
        price: '45500',
      });

      const result = service.determineExitTypeFromHistory([order], position);
      expect(result).toBe(ExitType.TRAILING_STOP);
    });

    it('should identify TP level from execution price', () => {
      const position = asExitTypeDetectorPosition({
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        takeProfits: [
          { level: 1, price: 46000, percent: 0.5, sizePercent: 50, hit: false },
          { level: 2, price: 47000, percent: 1, sizePercent: 30, hit: false },
        ],
      });

      const result = service.identifyTPLevel(46100, position);
      expect(result).toBe(1);
    });
  });

  // ==========================================================================
  // ERROR HANDLING WITH ERRORHANDLER TESTS
  // ==========================================================================

  describe('Error Handling with ErrorHandler', () => {
    it('should handle empty order history gracefully (SKIP fallback)', () => {
      const { position } = createScenario({
        positionOverrides: {
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        takeProfits: [{ level: 1, price: 46000, percent: 0.5, sizePercent: 50, hit: false }],
        },
      });

      const result = service.determineExitTypeFromHistory([], position);
      expect(result).toBe(ExitType.MANUAL);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle NaN price in TP level identification (SKIP)', () => {
      const { position } = createScenario({
        positionOverrides: {
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
          takeProfits: createExitTypeDetectorTakeProfits([46000, 47000]),
        },
      });

      const result = service.identifyTPLevel(NaN, position);
      expect(result).toBe(1); // Default to TP1
    });

    it('should handle empty takeProfits array (SKIP)', () => {
      const { position } = createScenario({
        positionOverrides: {
        symbol: 'BTCUSDT',
        side: PositionSide.LONG,
        takeProfits: [],
        },
      });

      const result = service.identifyTPLevel(46000, position);
      expect(result).toBe(1); // Default to TP1
    });

    it('should THROW when position is null', () => {
      const order = asExitTypeDetectorOrder({
        symbol: 'BTCUSDT',
        orderStatus: 'Filled',
        price: '45500',
      });

      expect(() => {
        service.determineExitTypeFromHistory([order], null as unknown as Position);
      }).toThrow();
    });
  });

  // ==========================================================================
  // BACKWARD COMPATIBILITY TESTS
  // ==========================================================================

  describe('Backward Compatibility (without ErrorHandler)', () => {
    it('should work without ErrorHandler in constructor', () => {
      const { service: legacyService, position } = createScenario({
        withErrorHandler: false,
        positionOverrides: {
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          takeProfits: createExitTypeDetectorTakeProfits([46000]),
        },
      });

      const result = legacyService.determineExitTypeFromHistory([], position);
      expect(result).toBe(ExitType.MANUAL);
    });

    it('should handle NaN without ErrorHandler', () => {
      const { service: legacyService, position } = createScenario({
        withErrorHandler: false,
        positionOverrides: {
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          takeProfits: createExitTypeDetectorTakeProfits([46000]),
        },
      });

      const result = legacyService.identifyTPLevel(NaN, position);
      expect(result).toBe(1);
    });
  });

  // ==========================================================================
  // INTEGRATION SCENARIOS
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should handle multiple orders and use most recent', () => {
      const { position } = createScenario({
        positionOverrides: {
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          takeProfits: createExitTypeDetectorTakeProfits([46000]),
        },
      });

      const orders: BybitOrder[] = createExitTypeDetectorTimedOrderHistory([
        {
          symbol: 'BTCUSDT',
          orderStatus: 'Filled',
          stopOrderType: 'StopLoss',
          price: '44000',
        },
        {
          symbol: 'BTCUSDT',
          orderStatus: 'Filled',
          orderType: 'Market',
          reduceOnly: true,
          price: '45500',
        },
      ], { stepMs: -10000 });

      const result = service.determineExitTypeFromHistory(orders, position);
      expect(result).toBe(ExitType.MANUAL); // Uses recent order
    });

    it('should identify correct TP level among multiple TPs', () => {
      const { position } = createScenario({
        positionOverrides: {
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          takeProfits: createExitTypeDetectorTakeProfits([46000, 47000, 48000]),
        },
      });

      // TP2 closest
      expect(service.identifyTPLevel(47050, position)).toBe(2);

      // TP3 closest
      expect(service.identifyTPLevel(48100, position)).toBe(3);

      // TP1 closest
      expect(service.identifyTPLevel(46100, position)).toBe(1);
    });

    it('should filter orders by symbol correctly', () => {
      const { position } = createScenario({
        positionOverrides: {
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          takeProfits: createExitTypeDetectorTakeProfits([46000]),
        },
      });

      const orders: BybitOrder[] = createExitTypeDetectorTimedOrderHistory([
        {
          symbol: 'ETHUSDT',
          orderStatus: 'Filled',
          orderType: 'Market',
          reduceOnly: true,
          price: '2000',
        },
        {
          symbol: 'BTCUSDT',
          orderStatus: 'Filled',
          stopOrderType: 'StopLoss',
          price: '44000',
        },
        ], { stepMs: 1000 });

      const result = service.determineExitTypeFromHistory(orders, position);
      expect(result).toBe(ExitType.STOP_LOSS); // Uses BTCUSDT order, not ETHUSDT
    });
  });
});
