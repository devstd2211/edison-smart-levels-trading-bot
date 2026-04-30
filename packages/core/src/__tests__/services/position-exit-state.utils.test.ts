import {
  applyStopLossUpdate,
  calculateDirectionalPnlSnapshot,
  isFavorableStopLossUpdate,
} from '../../services/position-exiting/position-exit-state.utils';
import { PositionSide } from '../../types/legacy';

describe('position-exit-state.utils', () => {
  describe('isFavorableStopLossUpdate', () => {
    it('returns true when a LONG stop moves up', () => {
      expect(isFavorableStopLossUpdate(PositionSide.LONG, 95, 100)).toBe(true);
      expect(isFavorableStopLossUpdate(PositionSide.LONG, 95, 94)).toBe(false);
    });

    it('returns true when a SHORT stop moves down', () => {
      expect(isFavorableStopLossUpdate(PositionSide.SHORT, 105, 100)).toBe(true);
      expect(isFavorableStopLossUpdate(PositionSide.SHORT, 105, 110)).toBe(false);
    });
  });

  describe('calculateDirectionalPnlSnapshot', () => {
    it('calculates LONG pnl, fees and percent', () => {
      const snapshot = calculateDirectionalPnlSnapshot(
        {
          entryPrice: 100,
          quantity: 2,
          side: PositionSide.LONG,
        },
        110,
        10,
        0.0002,
      );

      expect(snapshot.priceDiff).toBe(10);
      expect(snapshot.pnlPercent).toBeCloseTo(10, 8);
      expect(snapshot.pnlGross).toBe(200);
      expect(snapshot.fees).toBeCloseTo(0.084, 8);
      expect(snapshot.pnlNet).toBeCloseTo(199.916, 8);
    });

    it('calculates SHORT pnl, fees and percent', () => {
      const snapshot = calculateDirectionalPnlSnapshot(
        {
          entryPrice: 100,
          quantity: 2,
          side: PositionSide.SHORT,
        },
        90,
        10,
        0.0002,
      );

      expect(snapshot.priceDiff).toBe(-10);
      expect(snapshot.pnlPercent).toBeCloseTo(10, 8);
      expect(snapshot.pnlGross).toBe(200);
      expect(snapshot.fees).toBeCloseTo(0.076, 8);
      expect(snapshot.pnlNet).toBeCloseTo(199.924, 8);
    });
  });

  describe('applyStopLossUpdate', () => {
    it('updates stop-loss price, timestamp and extra state fields', () => {
      const position = {
        stopLoss: {
          price: 95,
          initialPrice: 95,
          updatedAt: 0,
          isBreakeven: false,
          isTrailing: false,
          trailingActivationPrice: undefined,
        },
      };

      applyStopLossUpdate(position, 101, {
        isBreakeven: true,
        trailingActivationPrice: 110,
      });

      expect(position.stopLoss.price).toBe(101);
      expect(position.stopLoss.updatedAt).toBeGreaterThan(0);
      expect(position.stopLoss.isBreakeven).toBe(true);
      expect(position.stopLoss.trailingActivationPrice).toBe(110);
    });
  });
});
