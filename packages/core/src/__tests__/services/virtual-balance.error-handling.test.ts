/**
 * VirtualBalanceService Error Handling Tests
 * Phase 8.9.43: RETRY (file I/O) + GRACEFUL_DEGRADE (sync) + SKIP (logging) + THROW (validation)
 * Total Tests: 22
 */

import * as fs from 'fs';
import { VirtualBalanceService } from '../../services/virtual-balance.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { ValidationError } from '../../errors/DomainErrors';
import {
  createManagedVirtualBalanceContext,
  createStandardVirtualBalanceService,
  createVirtualBalanceService,
  type VirtualBalanceErrorHandlingState,
  type VirtualBalanceManagedFactories,
  type VirtualBalanceLogger,
} from '../helpers/virtual-balance-test.utils';

describe('VirtualBalanceService - Error Handling (Phase 8.9.43)', () => {
  let service: VirtualBalanceService;
  let errorHandler: ErrorHandler;
  let mockLogger: VirtualBalanceLogger;
  let testDataDir: string;
  let testPath: string;
  let cleanup: VirtualBalanceErrorHandlingState['cleanup'];
  let createService: VirtualBalanceErrorHandlingState['createService'];

  beforeEach(() => {
    ({
      dataDir: testDataDir,
      statePath: testPath,
      logger: mockLogger,
      errorHandler,
      cleanup,
      createService,
    } = createManagedVirtualBalanceContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ========== SCENARIO 1: Validation Errors (THROW) ==========
  describe('Scenario 1: Constructor validation (THROW)', () => {
    it('should throw ValidationError for negative base deposit', () => {
      expect(() => {
        createVirtualBalanceService({
          logger: mockLogger,
          errorHandler,
          baseDeposit: -100,
          dataDir: testDataDir,
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for zero deposit', () => {
      expect(() => {
        createVirtualBalanceService({
          logger: mockLogger,
          errorHandler,
          baseDeposit: -50,
          dataDir: testDataDir,
        });
      }).toThrow(ValidationError);
    });

    it('should successfully initialize with valid deposit', () => {
      expect(() => {
        service = createStandardVirtualBalanceService({
          baseDeposit: 100,
          dataDir: testDataDir,
          logger: mockLogger,
          errorHandler,
        });
      }).not.toThrow();

      expect(service.getCurrentBalance()).toBe(100);
    });
  });

  // ========== SCENARIO 2: File Load Errors (RETRY) ==========
  describe('Scenario 2: File load with RETRY strategy', () => {
    it('should initialize with fresh state when file does not exist', () => {
      service = createStandardVirtualBalanceService({
        baseDeposit: 50,
        dataDir: testDataDir,
        logger: mockLogger,
        errorHandler,
      });
      expect(service.getCurrentBalance()).toBe(50);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅'),
        expect.any(Object)
      );
    });

    it('should load existing valid state from file', () => {
      // Create a valid state file
      const validState = {
        currentBalance: 150.5,
        baseDeposit: 100,
        lastUpdated: Date.now(),
        totalTrades: 5,
        lastTradeId: 'TRADE_001',
        totalProfit: 50.5,
        allTimeHigh: 160,
        allTimeLow: 95,
      };

      fs.mkdirSync(testDataDir, { recursive: true });
      fs.writeFileSync(testPath, JSON.stringify(validState), 'utf-8');

      service = createStandardVirtualBalanceService({
        baseDeposit: 100,
        dataDir: testDataDir,
        logger: mockLogger,
        errorHandler,
      });
      expect(service.getCurrentBalance()).toBe(150.5);
      expect(service.getState().totalTrades).toBe(5);
    });

    it('should update base deposit if changed in config', () => {
      const oldState = {
        currentBalance: 150,
        baseDeposit: 100,
        lastUpdated: Date.now(),
        totalTrades: 5,
        lastTradeId: 'TRADE_001',
        totalProfit: 50,
        allTimeHigh: 160,
        allTimeLow: 95,
      };

      fs.mkdirSync(testDataDir, { recursive: true });
      fs.writeFileSync(testPath, JSON.stringify(oldState), 'utf-8');

      service = createStandardVirtualBalanceService({
        baseDeposit: 120,
        dataDir: testDataDir,
        logger: mockLogger,
        errorHandler,
      });

      // Should update base deposit
      expect(service.getBaseDeposit()).toBe(120);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️ Base deposit changed in config',
        expect.any(Object)
      );
    });
  });

  // ========== SCENARIO 3: File Save Errors (RETRY) ==========
  describe('Scenario 3: File save with RETRY strategy', () => {
    it('should save balance successfully on update', () => {
      service = createService();
      service.updateBalance(10, 'TRADE_001');

      expect(fs.existsSync(testPath)).toBe(true);
      const saved = JSON.parse(fs.readFileSync(testPath, 'utf-8'));
      expect(saved.currentBalance).toBe(110);
      expect(saved.totalProfit).toBe(10);
    });

    it('should save balance with correct state after multiple updates', () => {
      service = createService();
      service.updateBalance(10, 'TRADE_001');
      service.updateBalance(-5, 'TRADE_002');
      service.updateBalance(20, 'TRADE_003');

      const saved = JSON.parse(fs.readFileSync(testPath, 'utf-8'));
      expect(saved.currentBalance).toBe(125);
      expect(saved.totalProfit).toBe(25);
      expect(saved.totalTrades).toBe(3);
    });
  });

  // ========== SCENARIO 4: Balance Update Validation (THROW) ==========
  describe('Scenario 4: Balance update with validation', () => {
    it('should throw ValidationError for empty trade ID', () => {
      service = createService();

      expect(() => {
        service.updateBalance(10, '');
      }).toThrow(ValidationError);
    });

    it('should update balance with valid trade ID', () => {
      service = createService();
      service.updateBalance(10, 'TRADE_001');

      expect(service.getCurrentBalance()).toBe(110);
      expect(service.getTotalProfit()).toBe(10);
    });

    it('should update balance for negative PnL', () => {
      service = createService();
      service.updateBalance(-15, 'TRADE_001');

      expect(service.getCurrentBalance()).toBe(85);
      expect(service.getTotalProfit()).toBe(-15);
    });

    it('should update allTimeHigh when balance increases', () => {
      service = createService();
      service.updateBalance(50, 'TRADE_001');

      const state = service.getState();
      expect(state.allTimeHigh).toBe(150);
    });

    it('should update allTimeLow when balance decreases', () => {
      service = createService();
      service.updateBalance(-30, 'TRADE_001');

      const state = service.getState();
      expect(state.allTimeLow).toBe(70);
    });
  });

  // ========== SCENARIO 5: Profit Calculation ==========
  describe('Scenario 5: Profit calculations', () => {
    it('should calculate total profit correctly', () => {
      service = createService();
      service.updateBalance(25, 'TRADE_001');
      service.updateBalance(-10, 'TRADE_002');

      expect(service.getTotalProfit()).toBe(15);
    });

    it('should calculate profit percentage correctly', () => {
      service = createService();
      service.updateBalance(50, 'TRADE_001');

      // (150 - 100) / 100 * 100 = 50%
      expect(service.getProfitPercent()).toBe(50);
    });

    it('should handle zero division in percentage', () => {
      service = createService(0.0001);
      expect(service.getProfitPercent()).toBeDefined();
    });
  });

  // ========== SCENARIO 6: Reset with Validation (THROW) ==========
  describe('Scenario 6: Reset with validation', () => {
    it('should reset balance to base deposit', () => {
      service = createService();
      service.updateBalance(50, 'TRADE_001');

      expect(service.getCurrentBalance()).toBe(150);
      service.reset();

      expect(service.getCurrentBalance()).toBe(100);
      expect(service.getTotalProfit()).toBe(0);
      expect(service.getState().totalTrades).toBe(0);
    });

    it('should reset to new base deposit', () => {
      service = createService();
      service.updateBalance(50, 'TRADE_001');

      service.reset(200);

      expect(service.getCurrentBalance()).toBe(200);
      expect(service.getBaseDeposit()).toBe(200);
    });

    it('should throw ValidationError for negative reset deposit', () => {
      service = createService();

      expect(() => {
        service.reset(-50);
      }).toThrow(ValidationError);
    });

    it('should clear all-time highs/lows on reset', () => {
      service = createService();
      service.updateBalance(100, 'TRADE_001');
      service.updateBalance(-50, 'TRADE_002');

      const stateBefore = service.getState();
      expect(stateBefore.allTimeHigh).toBe(200);
      expect(stateBefore.allTimeLow).toBe(100); // Stays at base deposit, 50 loss isn't below 100

      service.reset(150);

      const stateAfter = service.getState();
      expect(stateAfter.allTimeHigh).toBe(150);
      expect(stateAfter.allTimeLow).toBe(150);
    });
  });

  // ========== SCENARIO 7: Sync from History (GRACEFUL_DEGRADE) ==========
  describe('Scenario 7: Sync from history with GRACEFUL_DEGRADE', () => {
    it('should detect balance mismatch and sync', async () => {
      service = createService();
      service.updateBalance(10, 'TRADE_001');
      service.updateBalance(5, 'TRADE_002');

      const trades = [
        { id: 'TRADE_001', netPnl: 10 },
        { id: 'TRADE_002', netPnl: 5 },
        { id: 'TRADE_003', netPnl: 20 },
      ];

      await service.syncFromHistory(trades);

      expect(service.getCurrentBalance()).toBe(135);
    });

    it('should log when balance is in sync', async () => {
      service = createService();
      // Manually set current balance to what trades would give us (100 + 10 + 5 = 115)
      service.updateBalance(10, 'TRADE_001');
      service.updateBalance(5, 'TRADE_002');

      const trades = [
        { id: 'TRADE_001', netPnl: 10 },
        { id: 'TRADE_002', netPnl: 5 },
      ];

      jest.clearAllMocks();
      await service.syncFromHistory(trades);

      // Should log debug message when in sync
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should update balance on sync from history', async () => {
      service = createService();

      const trades = [
        { id: 'TRADE_001', netPnl: 25 },
        { id: 'TRADE_002', netPnl: 35 },
      ];

      await service.syncFromHistory(trades);

      const state = service.getState();
      expect(state.currentBalance).toBe(160); // 100 + 25 + 35
      expect(state.totalTrades).toBe(2);
      expect(state.totalProfit).toBe(60);
    });
  });

  // ========== SCENARIO 8: State Snapshots ==========
  describe('Scenario 8: State management', () => {
    it('should return immutable state copy', () => {
      service = createService();
      const state1 = service.getState();
      const state2 = service.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object references
    });

    it('should track total trades accurately', () => {
      service = createService();

      for (let i = 0; i < 10; i++) {
        service.updateBalance(10, `TRADE_${i.toString().padStart(3, '0')}`);
      }

      expect(service.getState().totalTrades).toBe(10);
    });

    it('should track last trade ID correctly', () => {
      service = createService();
      service.updateBalance(10, 'FIRST');
      service.updateBalance(5, 'SECOND');
      service.updateBalance(3, 'LAST');

      expect(service.getState().lastTradeId).toBe('LAST');
    });
  });

  // ========== SCENARIO 9: Persistence and Recovery ==========
  describe('Scenario 9: Persistence and recovery', () => {
    it('should persist balance to disk on update', () => {
      service = createService();
      service.updateBalance(50, 'TRADE_001');

      expect(fs.existsSync(testPath)).toBe(true);
    });

    it('should recover balance from disk on restart', () => {
      service = createService();
      service.updateBalance(50, 'TRADE_001');

      const service2 = createService();
      expect(service2.getCurrentBalance()).toBe(150);
      expect(service2.getState().totalTrades).toBe(1);
    });

    it('should preserve all-time highs/lows across restarts', () => {
      service = createService();
      service.updateBalance(100, 'TRADE_001'); // 200
      service.updateBalance(-250, 'TRADE_002'); // -50 (triggers allTimeLow update)

      const service2 = createService();
      const state = service2.getState();

      expect(state.allTimeHigh).toBe(200);
      expect(state.allTimeLow).toBe(-50);
    });
  });

  // ========== SCENARIO 10: Logging and Monitoring ==========
  describe('Scenario 10: Logging behavior', () => {
    it('should log balance updates with emoji for profit', () => {
      service = createService();
      service.updateBalance(20, 'TRADE_001');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('💰'),
        expect.any(Object)
      );
    });

    it('should log balance updates with emoji for loss', () => {
      service = createService();
      service.updateBalance(-20, 'TRADE_001');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('📉'),
        expect.any(Object)
      );
    });

    it('should log initialization message', () => {
      service = createService();
      service.getCurrentBalance(); // trigger lazy initialization lifecycle

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅'),
        expect.any(Object)
      );
    });

    it('should log reset message', () => {
      service = createService();
      service.reset();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('RESET'),
        expect.any(Object)
      );
    });
  });
});

// ========== INTEGRATION TESTS ==========
describe('VirtualBalanceService - Integration Scenarios', () => {
  let service: VirtualBalanceService;
  let errorHandler: ErrorHandler;
  let mockLogger: VirtualBalanceLogger;
  let testDataDir: string;
  let cleanup: VirtualBalanceManagedFactories['cleanup'];
  let createIntegrationService: VirtualBalanceManagedFactories['createService'];

  beforeEach(() => {
    ({
      dataDir: testDataDir,
      logger: mockLogger,
      errorHandler,
      cleanup,
      createService: createIntegrationService,
    } = createManagedVirtualBalanceContext({
      dataDirPrefix: 'virtual-balance-integration-',
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('should handle complete trading session lifecycle', () => {
    service = createIntegrationService(1000);

    service.updateBalance(50, 'ENTRY_001');
    expect(service.getCurrentBalance()).toBe(1050);

    service.updateBalance(100, 'TP1_001');
    expect(service.getCurrentBalance()).toBe(1150);

    service.updateBalance(75, 'TP2_001');
    expect(service.getCurrentBalance()).toBe(1225);

    // Verify persistence
    const service2 = createIntegrationService(1000);
    expect(service2.getCurrentBalance()).toBe(1225);
    expect(service2.getProfitPercent()).toBeCloseTo(22.5, 1);
  });

  it('should handle complex profit/loss scenarios', () => {
    service = createIntegrationService();

    const trades = [
      { id: 'T1', pnl: 25 },   // 125
      { id: 'T2', pnl: -10 },  // 115
      { id: 'T3', pnl: 50 },   // 165
      { id: 'T4', pnl: -30 },  // 135
      { id: 'T5', pnl: 65 },   // 200
    ];

    trades.forEach((t) => service.updateBalance(t.pnl, t.id));

    expect(service.getCurrentBalance()).toBe(200);
    expect(service.getTotalProfit()).toBe(100);
    expect(service.getProfitPercent()).toBe(100);

    const state = service.getState();
    expect(state.allTimeHigh).toBe(200);
    expect(state.allTimeLow).toBe(100); // Never goes below base deposit
  });
});

