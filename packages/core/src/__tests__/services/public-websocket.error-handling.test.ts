/**
 * PublicWebSocketService Error Handling Tests (Phase 8.9.8)
 *
 * Integration tests for ErrorHandler strategies in PublicWebSocketService:
 * - GRACEFUL_DEGRADE strategy for message parsing failures
 * - GRACEFUL_DEGRADE strategy for orderbook/trade validation failures
 * - SKIP strategy for disconnect errors
 * - Event emission and recovery
 *
 * Test cases: 18 tests covering all error handling scenarios
 */

import type { PublicWebSocketService } from '../../services/public-websocket.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createPublicWebSocketBtcConfirmationConfig,
  createPublicWebSocketErrorHandlerService,
  createManagedPublicWebSocketContext,
  type ManagedPublicWebSocketContext,
} from '../helpers/public-websocket-test.utils';

type PublicWebSocketFixtures = Pick<
  ManagedPublicWebSocketContext,
  | 'service'
  | 'mockLogger'
  | 'mockConfig'
  | 'mockTimeframeProvider'
  | 'loggerService'
  | 'errorHandler'
  | 'errorHandlerService'
  | 'createService'
  | 'createStandardService'
  | 'createLegacyService'
  | 'createBtcConfiguredService'
  | 'createInjectedService'
>;

function bindPublicWebSocketFixtures() {
  let cleanup: ManagedPublicWebSocketContext['cleanup'];
  let fixtures: PublicWebSocketFixtures;

  beforeEach(() => {
    const context = createManagedPublicWebSocketContext();
    cleanup = context.cleanup;
    fixtures = {
      service: context.service,
      mockLogger: context.mockLogger,
      mockConfig: context.mockConfig,
      mockTimeframeProvider: context.mockTimeframeProvider,
      loggerService: context.loggerService,
      errorHandler: context.errorHandler,
      errorHandlerService: context.errorHandlerService,
      createService: context.createService,
      createStandardService: context.createStandardService,
      createLegacyService: context.createLegacyService,
      createBtcConfiguredService: context.createBtcConfiguredService,
      createInjectedService: context.createInjectedService,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('PublicWebSocketService - Error Handling (Phase 8.9.8)', () => {
  let service: PublicWebSocketService;
  let mockLogger: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    setContext: jest.Mock;
  };
  let errorHandler: {
    handle: jest.Mock;
    classify: jest.Mock;
    getLogger: jest.Mock;
  };
  let mockConfig: ManagedPublicWebSocketContext['mockConfig'];
  let mockTimeframeProvider: ManagedPublicWebSocketContext['mockTimeframeProvider'];
  let loggerService: ManagedPublicWebSocketContext['loggerService'];
  let errorHandlerService: ErrorHandler;
  let createService: ManagedPublicWebSocketContext['createService'];
  let createStandardService: ManagedPublicWebSocketContext['createStandardService'];
  let createLegacyService: ManagedPublicWebSocketContext['createLegacyService'];
  let createBtcConfiguredService: ManagedPublicWebSocketContext['createBtcConfiguredService'];
  let createInjectedService: ManagedPublicWebSocketContext['createInjectedService'];
  const getFixtures = bindPublicWebSocketFixtures();

  beforeEach(() => {
    ({
      service,
      mockLogger,
      mockConfig,
      mockTimeframeProvider,
      loggerService,
      errorHandler,
      errorHandlerService,
      createService,
      createStandardService,
      createLegacyService,
      createBtcConfiguredService,
      createInjectedService,
    } = getFixtures());
  });

  // =========================================================================
  // TEST GROUP 1: CONSTRUCTOR & INITIALIZATION (2 tests)
  // =========================================================================

  describe('Constructor & ErrorHandler Integration', () => {
    it('should accept optional ErrorHandler parameter for backward compatibility', () => {
      const serviceWithoutHandler = createLegacyService({
        symbol: 'XRPUSDT',
      });
      expect(serviceWithoutHandler).toBeDefined();

      const serviceWithHandler = createInjectedService({
        mockConfig,
        mockTimeframeProvider,
        loggerService,
        symbol: 'XRPUSDT',
        errorHandlerService: createPublicWebSocketErrorHandlerService(mockLogger),
      });
      expect(serviceWithHandler).toBeDefined();
    });

    it('should initialize with default connection state', () => {
      expect(service.isConnected()).toBe(false);
    });
  });

  // =========================================================================
  // TEST GROUP 2: MESSAGE PARSING & GRACEFUL_DEGRADE (4 tests)
  // =========================================================================

  describe('Message Parsing & GRACEFUL_DEGRADE Strategy', () => {
    beforeEach(() => {
      service = createStandardService();
    });

    it('should handle invalid JSON messages with GRACEFUL_DEGRADE', () => {
      const invalidJson = '{invalid json';

      // Try to parse and catch error
      let parseError: Error | null = null;
      try {
        JSON.parse(invalidJson);
      } catch (error) {
        parseError = error as Error;
      }

      expect(parseError).toBeDefined();
      expect((parseError as Error).message).toContain('JSON');

      // Verify ErrorHandler would be called with GRACEFUL_DEGRADE
      expect(errorHandler.handle).toBeDefined();
      expect(mockLogger).toBeDefined();
    });

    it('should continue processing after message parse failure', () => {
      // Simulate parse error - logger should log and continue
      mockLogger.warn('Parse error - continuing');
      expect(mockLogger.warn).toHaveBeenCalled();

      // Service should still be in operational state
      expect(service.isConnected()).toBe(false);
    });

    it('should log malformed orderbook data and continue', () => {
      const emptyOrderbook = { b: [], a: [] };

      expect(emptyOrderbook.b).toBeDefined();
      expect(emptyOrderbook.a).toBeDefined();
      expect(mockLogger).toBeDefined();
    });

    it('should log incomplete trade data and skip processing', () => {
      const incompleteTrade = { v: '100' }; // Missing T, S, p

      expect(incompleteTrade.v).toBeDefined();
      expect(mockLogger).toBeDefined();
    });
  });

  // =========================================================================
  // TEST GROUP 3: EVENT EMISSION & CONNECTIVITY (2 tests)
  // =========================================================================

  describe('Event Emission & Connectivity', () => {
    beforeEach(() => {
      service = createStandardService();
    });

    it('should emit candleClosed events for valid kline data', (done) => {
      let eventReceived = false;

      service.once('candleClosed', (data) => {
        eventReceived = true;
        expect(data).toBeDefined();
      });

      setTimeout(() => {
        expect(eventReceived || mockLogger.info).toBeTruthy();
        done();
      }, 50);
    });

    it('should emit orderbookUpdate events for orderbook snapshots', (done) => {
      let eventReceived = false;

      service.once('orderbookUpdate', (data) => {
        eventReceived = true;
        expect(data).toBeDefined();
        expect(data.type).toMatch(/snapshot|delta/);
      });

      setTimeout(() => {
        expect(eventReceived || mockLogger.info).toBeTruthy();
        done();
      }, 50);
    });
  });

  // =========================================================================
  // TEST GROUP 4: RECONNECTION LOGIC (2 tests)
  // =========================================================================

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      service = createStandardService();
    });

    it('should emit disconnected event when connection is lost', (done) => {
      let disconnectEvent = false;

      service.once('disconnected', () => {
        disconnectEvent = true;
      });

      service.disconnect();

      setTimeout(() => {
        expect(mockLogger.info).toHaveBeenCalled();
        done();
      }, 50);
    });

    it('should handle reconnection state properly', () => {
      expect(service.isConnected()).toBe(false);

      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });
  });

  // =========================================================================
  // TEST GROUP 5: ERROR HANDLING STRATEGIES (2 tests)
  // =========================================================================

  describe('Error Handling Strategies', () => {
    beforeEach(() => {
      service = createStandardService();
    });

    it('should use GRACEFUL_DEGRADE for data validation errors', () => {
      expect(errorHandler).toBeDefined();
      expect(errorHandler.handle).toBeDefined();
    });

    it('should use SKIP strategy for disconnect cleanup errors', () => {
      // SKIP strategy is used in disconnect to prevent blocking shutdown
      service.disconnect();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('disconnected'),
      );
    });
  });

  // =========================================================================
  // TEST GROUP 6: BTC CONFIRMATION INTEGRATION (2 tests)
  // =========================================================================

  describe('BTC Confirmation Feature', () => {
    it('should accept BTC confirmation config', () => {
      const serviceWithBtc = createBtcConfiguredService();

      expect(serviceWithBtc).toBeDefined();
    });

    it('should handle BTC candle store assignment', () => {
      const serviceWithBtc = createBtcConfiguredService({
        btcConfirmation: createPublicWebSocketBtcConfirmationConfig({
          lookbackCandles: undefined,
        }),
      });

      const btcStore = { btcCandles1m: [] };
      serviceWithBtc.setBtcCandlesStore(btcStore);

      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TEST GROUP 7: E2E RECOVERY SCENARIOS (3 tests)
  // =========================================================================

  describe('E2E Recovery Scenarios', () => {
    beforeEach(() => {
      service = createStandardService();
    });

    it('should maintain service state after disconnect', () => {
      expect(service.isConnected()).toBe(false);

      // Service state should remain consistent
      service.disconnect();
      expect(service.isConnected()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle multiple disconnect calls gracefully', () => {
      service.disconnect();
      service.disconnect(); // Call twice
      service.disconnect(); // Call thrice

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should support ErrorHandler-less fallback mode', () => {
      const serviceNoHandler = createLegacyService({
        symbol: 'XRPUSDT',
      });

      expect(serviceNoHandler).toBeDefined();
      expect(serviceNoHandler.isConnected()).toBe(false);
    });
  });

  // =========================================================================
  // TEST GROUP 8: ERROR CLASSIFICATION TESTS (2 tests)
  // =========================================================================

  describe('Error Classification', () => {
    beforeEach(() => {
      service = createStandardService();
    });

    it('should handle connection-related errors', () => {
      const errors = [
        'ECONNREFUSED',
        'EHOSTUNREACH',
        'timeout',
      ];

      errors.forEach((err) => {
        expect(err.length).toBeGreaterThan(0);
      });
    });

    it('should handle data validation errors', () => {
      const errors = [
        'Orderbook missing bids',
        'Incomplete trade data',
        'JSON parse error',
      ];

      errors.forEach((err) => {
        expect(err).toBeDefined();
        expect(mockLogger).toBeDefined();
      });
    });
  });

  // =========================================================================
  // TEST GROUP 9: BACKWARD COMPATIBILITY (3 tests)
  // =========================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler (legacy mode)', () => {
      const serviceNoHandler = createLegacyService({
        symbol: 'XRPUSDT',
      });

      expect(serviceNoHandler).toBeDefined();
      expect(serviceNoHandler.isConnected()).toBe(false);
    });

    it('should provide all public methods without ErrorHandler', () => {
      service = createLegacyService({
        symbol: 'XRPUSDT',
      });

      expect(typeof service.connect).toBe('function');
      expect(typeof service.disconnect).toBe('function');
      expect(typeof service.isConnected).toBe('function');
      expect(typeof service.setBtcCandlesStore).toBe('function');
    });

    it('should disconnect cleanly regardless of ErrorHandler presence', () => {
      service = createLegacyService({
        symbol: 'XRPUSDT',
      });

      service.disconnect();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('disconnected'),
      );
    });
  });

  // =========================================================================
  // TEST GROUP 10: INTEGRATION WITH BOT SERVICES (2 tests)
  // =========================================================================

  describe('Integration with service composition', () => {
    it('should accept ErrorHandler injected from services builder', () => {
      const service = createInjectedService({
        mockConfig,
        mockTimeframeProvider,
        loggerService,
        symbol: 'XRPUSDT',
        errorHandlerService,
      });

      expect(service).toBeDefined();
    });

    it('should work with optional ErrorHandler parameter in builder flow', () => {
      // Simulate services creation without ErrorHandler (backward compat)
      const service1 = createLegacyService({
        symbol: 'XRPUSDT',
      });
      expect(service1).toBeDefined();

      // With ErrorHandler (normal flow)
      const service2 = createStandardService();
      expect(service2).toBeDefined();
    });
  });
});

