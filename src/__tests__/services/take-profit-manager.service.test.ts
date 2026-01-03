/**
 * Tests for TakeProfitManagerService
 */

import { TakeProfitManagerService } from '../../services/take-profit-manager.service';
import { LoggerService, PositionSide, LogLevel } from '../../types';

describe('TakeProfitManagerService', () => {
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
  });

  describe('recordPartialClose', () => {
    it('should record TP1 close correctly', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      const close = manager.recordPartialClose(1, 28.4, 1.1676);

      expect(close.level).toBe(1);
      expect(close.quantity).toBe(28.4);
      expect(close.exitPrice).toBe(1.1676);
      expect(close.pnlNet).toBeCloseTo(2.008, 2); // With 0.055% fees and 10x leverage
    });

    it('should record multiple TP levels', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      manager.recordPartialClose(1, 28.4, 1.1676);
      manager.recordPartialClose(2, 28.4, 1.1617);
      manager.recordPartialClose(3, 28.4, 1.1363);

      const closes = manager.getPartialCloses();
      expect(closes).toHaveLength(3);
      expect(manager.isFullyClosed()).toBe(true);
    });

    it('should throw error if exceeding total quantity', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      manager.recordPartialClose(1, 50, 1.1676);

      expect(() => {
        manager.recordPartialClose(2, 50, 1.1617); // Would exceed 85.2
      }).toThrow();
    });

    it('should calculate PnL correctly for LONG position', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.LONG,
          entryPrice: 1.1500,
          totalQuantity: 80.0,
          leverage: 10,
        },
        logger,
      );

      const close = manager.recordPartialClose(1, 4.0, 1.1600);

      // LONG: profit when price goes up
      // Gross PnL = (1.1600 - 1.1500) × 4 × 1 × 10 = 0.4 USDT
      // Fees = (1.1500 × 4 + 1.1600 × 4) × 0.00055 = ~0.0051 USDT
      // Net PnL = 0.4 - 0.0051 = ~0.395 USDT
      expect(close.pnlGross).toBeCloseTo(0.4, 3);
      expect(close.pnlNet).toBeGreaterThan(0.394);
      expect(close.pnlNet).toBeLessThan(0.396);
    });

    it('should calculate PnL correctly for SHORT position', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      const close = manager.recordPartialClose(1, 28.4, 1.1676);

      // SHORT: profit when price goes down
      // Gross PnL = (1.1676 - 1.1748) × 28.4 × -1 × 10 = 2.045 USDT
      expect(close.pnlGross).toBeCloseTo(2.045, 3);
      expect(close.pnlNet).toBeLessThan(close.pnlGross); // Fees subtracted
    });
  });

  describe('getTotalPnL', () => {
    it('should sum PnL across all partial closes', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      manager.recordPartialClose(1, 28.4, 1.1676); // +1.795 net (10x leverage)
      manager.recordPartialClose(2, 28.4, 1.1617); // +3.471 net (10x leverage)
      manager.recordPartialClose(3, 28.4, 1.1363); // +10.573 net (10x leverage)

      const total = manager.getTotalPnL();

      // Total should be ~16.6 USDT (with 10x leverage)
      expect(total.pnlNet).toBeGreaterThan(16.4);
      expect(total.pnlNet).toBeLessThan(16.8);
    });

    it('should return zero for no closes', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      const total = manager.getTotalPnL();

      expect(total.pnlGross).toBe(0);
      expect(total.fees).toBe(0);
      expect(total.pnlNet).toBe(0);
    });
  });

  describe('getRemainingQuantity', () => {
    it('should return correct remaining quantity', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      expect(manager.getRemainingQuantity()).toBe(85.2);

      manager.recordPartialClose(1, 28.4, 1.1676);
      expect(manager.getRemainingQuantity()).toBeCloseTo(56.8, 1);

      manager.recordPartialClose(2, 28.4, 1.1617);
      expect(manager.getRemainingQuantity()).toBeCloseTo(28.4, 1);

      manager.recordPartialClose(3, 28.4, 1.1363);
      expect(manager.getRemainingQuantity()).toBeCloseTo(0, 1);
    });
  });

  describe('isFullyClosed', () => {
    it('should return false when partially closed', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      manager.recordPartialClose(1, 28.4, 1.1676);
      expect(manager.isFullyClosed()).toBe(false);
    });

    it('should return true when fully closed', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      manager.recordPartialClose(1, 28.4, 1.1676);
      manager.recordPartialClose(2, 28.4, 1.1617);
      manager.recordPartialClose(3, 28.4, 1.1363);

      expect(manager.isFullyClosed()).toBe(true);
    });
  });

  describe('getTpLevelsHit', () => {
    it('should return array of TP levels hit', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      manager.recordPartialClose(1, 28.4, 1.1676);
      manager.recordPartialClose(2, 28.4, 1.1617);

      expect(manager.getTpLevelsHit()).toEqual([1, 2]);
    });
  });

  describe('calculateFinalPnL', () => {
    it('should calculate total PnL including remaining quantity', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      manager.recordPartialClose(1, 28.4, 1.1676);
      manager.recordPartialClose(2, 28.4, 1.1617);

      // Calculate if remaining 28.4 closes at 1.1500
      const finalPnL = manager.calculateFinalPnL(1.1500);

      expect(finalPnL.partialPnL.pnlNet).toBeGreaterThan(5.0); // 10x leverage
      expect(finalPnL.remainingPnL.pnlNet).toBeGreaterThan(6.8); // 10x leverage
      expect(finalPnL.totalPnL.pnlNet).toBeGreaterThan(11.8); // 10x leverage
    });

    it('should match real Bybit data for TP3 position', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_123',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      manager.recordPartialClose(1, 28.4, 1.1676);
      manager.recordPartialClose(2, 28.4, 1.1617);
      manager.recordPartialClose(3, 28.4, 1.1363);

      const total = manager.getTotalPnL();

      // Should be ~16.6 USDT (with 10x leverage)
      expect(total.pnlNet).toBeGreaterThan(16.4);
      expect(total.pnlNet).toBeLessThan(16.8);
    });
  });
});
