/**
 * Tests for TickDeltaAnalyzerService (Phase 4)
 */

import { TickDeltaAnalyzerService } from '../../services/tick-delta-analyzer.service';
import { SignalDirection } from '../../types/legacy';
import {
  createTickDeltaAnalyzerConfig,
  createTickDeltaAnalyzerHarness,
  createTickDeltaAnalyzerTickBatch,
  createTickDeltaAnalyzerTick,
} from '../helpers/tick-delta-analyzer-test.utils';

describe('TickDeltaAnalyzerService', () => {
  let service: TickDeltaAnalyzerService;

  beforeEach(() => {
    ({ service } = createTickDeltaAnalyzerHarness());
  });

  describe('addTick', () => {
    it('should add buy tick to history', () => {
      const tick = createTickDeltaAnalyzerTick();

      service.addTick(tick);

      const history = service.getTickHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(tick);
    });

    it('should add sell tick to history', () => {
      const tick = createTickDeltaAnalyzerTick({ side: 'SELL', size: 50 });

      service.addTick(tick);

      const history = service.getTickHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(tick);
    });

    it('should maintain multiple ticks', () => {
      const tick1 = createTickDeltaAnalyzerTick();
      const tick2 = createTickDeltaAnalyzerTick({ side: 'SELL', size: 50, timestamp: 1_700_000_000_001 });
      const tick3 = createTickDeltaAnalyzerTick({ size: 75, timestamp: 1_700_000_000_002 });

      service.addTick(tick1);
      service.addTick(tick2);
      service.addTick(tick3);

      expect(service.getTickHistory()).toHaveLength(3);
    });

    it('should limit history size to max', () => {
      for (let i = 0; i < 1005; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ timestamp: 1_700_000_000_000 + i, size: 10 }));
      }

      expect(service.getTickHistory().length).toBeLessThanOrEqual(1000);
    });
  });

  describe('calculateDeltaRatio', () => {
    it('should calculate delta ratio with more buys (buy > sell)', () => {
      const now = 1_700_000_100_000;

      createTickDeltaAnalyzerTickBatch(40, { timestamp: now }).forEach((tick) => service.addTick(tick));
      createTickDeltaAnalyzerTickBatch(15, { side: 'SELL', timestamp: now }).forEach((tick) => service.addTick(tick));

      expect(service.calculateDeltaRatio(5_000, now)).toBeCloseTo(2.67, 1);
    });

    it('should calculate delta ratio with more sells (sell > buy)', () => {
      const now = 1_700_000_100_000;

      createTickDeltaAnalyzerTickBatch(10, { timestamp: now }).forEach((tick) => service.addTick(tick));
      createTickDeltaAnalyzerTickBatch(35, { side: 'SELL', timestamp: now }).forEach((tick) => service.addTick(tick));

      expect(service.calculateDeltaRatio(5_000, now)).toBeCloseTo(0.29, 1);
    });

    it('should return neutral ratio (1.0) with no ticks', () => {
      expect(service.calculateDeltaRatio()).toBe(1.0);
    });

    it('should return max ratio (10) with only buy ticks', () => {
      const now = 1_700_000_100_000;

      createTickDeltaAnalyzerTickBatch(20, { timestamp: now }).forEach((tick) => service.addTick(tick));

      expect(service.calculateDeltaRatio(5_000, now)).toBe(10);
    });

    it('should return min ratio (0.1) with only sell ticks', () => {
      const now = 1_700_000_100_000;

      createTickDeltaAnalyzerTickBatch(20, { side: 'SELL', timestamp: now }).forEach((tick) => service.addTick(tick));

      expect(service.calculateDeltaRatio(5_000, now)).toBe(0.1);
    });

    it('should only count ticks within window', () => {
      const now = 1_700_000_100_000;

      for (let i = 0; i < 30; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ timestamp: now - 10_000 }));
      }
      for (let i = 0; i < 10; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ timestamp: now }));
      }
      for (let i = 0; i < 5; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ side: 'SELL', timestamp: now }));
      }

      expect(service.calculateDeltaRatio(5_000, now)).toBeCloseTo(2.0, 1);
    });
  });

  describe('detectMomentumSpike', () => {
    it('should detect BUY momentum spike (2x ratio)', () => {
      const now = 1_700_000_100_000;

      createTickDeltaAnalyzerTickBatch(40, { timestamp: now }).forEach((tick) => service.addTick(tick));
      createTickDeltaAnalyzerTickBatch(15, { side: 'SELL', timestamp: now }).forEach((tick) => service.addTick(tick));

      const spike = service.detectMomentumSpike(now);

      expect(spike).not.toBeNull();
      expect(spike!.direction).toBe(SignalDirection.LONG);
      expect(spike!.deltaRatio).toBeCloseTo(2.67, 1);
      expect(spike!.tickCount).toBe(55);
      expect(spike!.confidence).toBeGreaterThan(0);
    });

    it('should detect SELL momentum spike (inverse 2x ratio)', () => {
      const now = 1_700_000_100_000;

      createTickDeltaAnalyzerTickBatch(10, { timestamp: now }).forEach((tick) => service.addTick(tick));
      createTickDeltaAnalyzerTickBatch(35, { side: 'SELL', timestamp: now }).forEach((tick) => service.addTick(tick));

      const spike = service.detectMomentumSpike(now);

      expect(spike).not.toBeNull();
      expect(spike!.direction).toBe(SignalDirection.SHORT);
      expect(spike!.deltaRatio).toBeCloseTo(3.5, 1);
      expect(spike!.tickCount).toBe(45);
    });

    it('should NOT detect spike if ratio too weak (1.5x < 2.0x)', () => {
      const now = 1_700_000_100_000;

      createTickDeltaAnalyzerTickBatch(30, { timestamp: now }).forEach((tick) => service.addTick(tick));
      createTickDeltaAnalyzerTickBatch(20, { side: 'SELL', timestamp: now }).forEach((tick) => service.addTick(tick));

      expect(service.detectMomentumSpike(now)).toBeNull();
    });

    it('should NOT detect spike if tick count too low', () => {
      const now = 1_700_000_100_000;

      for (let i = 0; i < 10; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ timestamp: now }));
      }
      for (let i = 0; i < 5; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ side: 'SELL', timestamp: now }));
      }

      expect(service.detectMomentumSpike(now)).toBeNull();
    });

    it('should NOT detect spike if volume too low', () => {
      const now = 1_700_000_100_000;

      for (let i = 0; i < 20; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ timestamp: now, size: 5 }));
      }
      for (let i = 0; i < 10; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ side: 'SELL', timestamp: now, size: 5 }));
      }

      expect(service.detectMomentumSpike(now)).toBeNull();
    });

    it('should calculate correct volumeUSDT', () => {
      const now = 1_700_000_100_000;

      for (let i = 0; i < 30; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ timestamp: now, price: 2.0 }));
      }
      for (let i = 0; i < 10; i++) {
        service.addTick(createTickDeltaAnalyzerTick({ side: 'SELL', timestamp: now, price: 2.0 }));
      }

      const spike = service.detectMomentumSpike(now);

      expect(spike).not.toBeNull();
      expect(spike!.volumeUSDT).toBeCloseTo(8000, 0);
    });

    it('should cap confidence at maxConfidence', () => {
      const { service: cappedService, config } = createTickDeltaAnalyzerHarness();
      const now = 1_700_000_100_000;

      for (let i = 0; i < 200; i++) {
        cappedService.addTick(createTickDeltaAnalyzerTick({ timestamp: now }));
      }
      for (let i = 0; i < 10; i++) {
        cappedService.addTick(createTickDeltaAnalyzerTick({ side: 'SELL', timestamp: now }));
      }

      const spike = cappedService.detectMomentumSpike(now);

      expect(spike).not.toBeNull();
      expect(spike!.confidence).toBeLessThanOrEqual(config.maxConfidence);
    });
  });

  describe('cleanupOldTicks', () => {
    it('should remove ticks older than 2x detection window', () => {
      const realNow = Date.now;
      const now = 1_700_000_100_000;
      Date.now = jest.fn(() => now);

      try {
        for (let i = 0; i < 20; i++) {
          service.addTick(createTickDeltaAnalyzerTick({ timestamp: now - 11_000 }));
        }
        for (let i = 0; i < 10; i++) {
          service.addTick(createTickDeltaAnalyzerTick({ timestamp: now }));
        }

        service.cleanupOldTicks();

        expect(service.getTickHistory().length).toBe(10);
      } finally {
        Date.now = realNow;
      }
    });

    it('should keep ticks within 2x detection window', () => {
      const realNow = Date.now;
      const now = 1_700_000_100_000;
      Date.now = jest.fn(() => now);

      try {
        for (let i = 0; i < 15; i++) {
          service.addTick(createTickDeltaAnalyzerTick({ timestamp: now - 8_000 }));
        }
        for (let i = 0; i < 10; i++) {
          service.addTick(createTickDeltaAnalyzerTick({ timestamp: now }));
        }

        service.cleanupOldTicks();

        expect(service.getTickHistory().length).toBe(25);
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty tick history', () => {
      expect(service.calculateDeltaRatio()).toBe(1.0);
      expect(service.detectMomentumSpike()).toBeNull();
    });

    it('should clear history', () => {
      service.addTick(createTickDeltaAnalyzerTick());
      service.addTick(createTickDeltaAnalyzerTick({ side: 'SELL', size: 50, timestamp: 1_700_000_000_001 }));

      service.clearHistory();

      expect(service.getTickHistory()).toHaveLength(0);
    });
  });
});
