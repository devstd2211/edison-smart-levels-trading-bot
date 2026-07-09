import { AntiFlipService } from '../../services/anti-flip.service';
import { SignalDirection } from '../../types/legacy';
import {
  createManagedAntiFlipContext,
  createAntiFlipConfig,
  createBullishAntiFlipCandle,
  createBearishAntiFlipCandle,
} from '../helpers/anti-flip-test.utils';

describe('AntiFlipService functional', () => {
  describe('shouldBlockSignal — not blocked', () => {
    it('passes through when disabled', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService(createAntiFlipConfig({ enabled: false }));
        svc.recordSignal(SignalDirection.LONG, 100);
        const result = svc.shouldBlockSignal(SignalDirection.SHORT, 50, 100);
        expect(result.blocked).toBe(false);
      } finally {
        cleanup();
      }
    });

    it('passes through when no previous signal exists', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService();
        const result = svc.shouldBlockSignal(SignalDirection.LONG, 50, 100);
        expect(result.blocked).toBe(false);
      } finally {
        cleanup();
      }
    });

    it('passes through when direction matches previous signal', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService(createAntiFlipConfig({ cooldownMs: 60000, cooldownCandles: 5 }));
        svc.recordSignal(SignalDirection.LONG, 100);
        const result = svc.shouldBlockSignal(SignalDirection.LONG, 50, 100);
        expect(result.blocked).toBe(false);
      } finally {
        cleanup();
      }
    });

    it('passes through after cooldown candles elapsed', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService(createAntiFlipConfig({ cooldownCandles: 2, cooldownMs: 300000 }));
        svc.recordSignal(SignalDirection.LONG, 100);
        svc.onNewCandle();
        svc.onNewCandle();
        const result = svc.shouldBlockSignal(SignalDirection.SHORT, 50, 95);
        expect(result.blocked).toBe(false);
      } finally {
        cleanup();
      }
    });
  });

  describe('shouldBlockSignal — blocked', () => {
    it('blocks opposite direction within cooldown window', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService(createAntiFlipConfig({ cooldownCandles: 5, cooldownMs: 300000 }));
        svc.recordSignal(SignalDirection.LONG, 100);
        const result = svc.shouldBlockSignal(SignalDirection.SHORT, 50, 95);
        expect(result.blocked).toBe(true);
        expect(result.reason).toMatch(/blocked/i);
      } finally {
        cleanup();
      }
    });
  });

  describe('shouldBlockSignal — override conditions', () => {
    it('overrides block on high confidence', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService(createAntiFlipConfig({
          cooldownCandles: 5,
          cooldownMs: 300000,
          overrideConfidenceThreshold: 85,
        }));
        svc.recordSignal(SignalDirection.LONG, 100);
        const result = svc.shouldBlockSignal(SignalDirection.SHORT, 90, 95);
        expect(result.blocked).toBe(false);
        expect(result.reason).toMatch(/confidence/i);
      } finally {
        cleanup();
      }
    });

    it('overrides block on strong RSI reversal (oversold for LONG)', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService(createAntiFlipConfig({
          cooldownCandles: 5,
          cooldownMs: 300000,
          strongReversalRsiThreshold: 25,
        }));
        svc.recordSignal(SignalDirection.SHORT, 100);
        const result = svc.shouldBlockSignal(SignalDirection.LONG, 50, 95, 20);
        expect(result.blocked).toBe(false);
        expect(result.reason).toMatch(/RSI/i);
      } finally {
        cleanup();
      }
    });

    it('overrides block when confirmation candles align', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService(createAntiFlipConfig({
          cooldownCandles: 5,
          cooldownMs: 300000,
          requiredConfirmationCandles: 2,
        }));
        svc.recordSignal(SignalDirection.SHORT, 100);
        const candles = [createBullishAntiFlipCandle(102), createBullishAntiFlipCandle(104)];
        const result = svc.shouldBlockSignal(SignalDirection.LONG, 50, 104, undefined, candles);
        expect(result.blocked).toBe(false);
        expect(result.reason).toMatch(/confirmation/i);
      } finally {
        cleanup();
      }
    });
  });

  describe('recordSignal', () => {
    it('updates lastSignal state and resets candlesSinceSignal', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService();
        svc.recordSignal(SignalDirection.LONG, 100);
        svc.onNewCandle();
        svc.onNewCandle();
        svc.recordSignal(SignalDirection.SHORT, 95);
        const snapshot = svc.getStateSnapshot();
        expect(snapshot.lastSignal?.direction).toBe(SignalDirection.SHORT);
        expect(snapshot.candlesSinceSignal).toBe(0);
      } finally {
        cleanup();
      }
    });

    it('ignores HOLD signals', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService();
        svc.recordSignal(SignalDirection.HOLD, 100);
        expect(svc.getStateSnapshot().lastSignal).toBeNull();
      } finally {
        cleanup();
      }
    });
  });

  describe('getStateSnapshot', () => {
    it('reports isInCooldown=true immediately after signal', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService(createAntiFlipConfig({ cooldownCandles: 3, cooldownMs: 300000 }));
        svc.recordSignal(SignalDirection.LONG, 100);
        expect(svc.getStateSnapshot().isInCooldown).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('reports isInCooldown=false before any signal', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService();
        expect(svc.getStateSnapshot().isInCooldown).toBe(false);
      } finally {
        cleanup();
      }
    });
  });

  describe('reset', () => {
    it('clears lastSignal and candlesSinceSignal', () => {
      const { createService, cleanup } = createManagedAntiFlipContext();
      try {
        const svc = createService();
        svc.recordSignal(SignalDirection.LONG, 100);
        svc.onNewCandle();
        svc.reset();
        const snap = svc.getStateSnapshot();
        expect(snap.lastSignal).toBeNull();
        expect(snap.candlesSinceSignal).toBe(0);
        expect(snap.isInCooldown).toBe(false);
      } finally {
        cleanup();
      }
    });
  });

  describe('export boundary', () => {
    it('exports AntiFlipService as named export', () => {
      expect(AntiFlipService).toBeDefined();
      expect(typeof AntiFlipService).toBe('function');
    });
  });
});
