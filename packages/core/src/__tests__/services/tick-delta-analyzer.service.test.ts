/**
 * Tests for TickDeltaAnalyzerService (Phase 4)
 */

import { TickDeltaAnalyzerService } from '../../services/tick-delta-analyzer.service';
import { SignalDirection } from '../../types/legacy';
import {
  createTickDeltaAnalyzerConfig,
  createTickDeltaAnalyzerDirectionalTicks,
  createManagedTickDeltaAnalyzerContext,
  createTickDeltaAnalyzerTick,
  seedTickDeltaAnalyzerHistory,
  type TickDeltaAnalyzerRuntime,
} from '../helpers/tick-delta-analyzer-test.utils';

describe('TickDeltaAnalyzerService', () => {
  let service: TickDeltaAnalyzerRuntime['service'];
  let createService: TickDeltaAnalyzerRuntime['createService'];
  let cleanup: TickDeltaAnalyzerRuntime['cleanup'];

  beforeEach(() => {
    ({ service, createService, cleanup } =
      createManagedTickDeltaAnalyzerContext());
  });

  afterEach(() => {
    cleanup();
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
      seedTickDeltaAnalyzerHistory(service, [
        createTickDeltaAnalyzerTick(),
        createTickDeltaAnalyzerTick({ side: 'SELL', size: 50, timestamp: 1_700_000_000_001 }),
        createTickDeltaAnalyzerTick({ size: 75, timestamp: 1_700_000_000_002 }),
      ]);

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
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(40, 15, { timestamp: now }));

      expect(service.calculateDeltaRatio(5_000, now)).toBeCloseTo(2.67, 1);
    });

    it('should calculate delta ratio with more sells (sell > buy)', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(10, 35, { timestamp: now }));

      expect(service.calculateDeltaRatio(5_000, now)).toBeCloseTo(0.29, 1);
    });

    it('should return neutral ratio (1.0) with no ticks', () => {
      expect(service.calculateDeltaRatio()).toBe(1.0);
    });

    it('should return max ratio (10) with only buy ticks', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(20, 0, { timestamp: now }));

      expect(service.calculateDeltaRatio(5_000, now)).toBe(10);
    });

    it('should return min ratio (0.1) with only sell ticks', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(0, 20, { timestamp: now }));

      expect(service.calculateDeltaRatio(5_000, now)).toBe(0.1);
    });

    it('should only count ticks within window', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, [
        ...createTickDeltaAnalyzerDirectionalTicks(30, 0, { timestamp: now - 10_000 }),
        ...createTickDeltaAnalyzerDirectionalTicks(10, 5, { timestamp: now }),
      ]);

      expect(service.calculateDeltaRatio(5_000, now)).toBeCloseTo(2.0, 1);
    });
  });

  describe('detectMomentumSpike', () => {
    it('should detect BUY momentum spike (2x ratio)', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(40, 15, { timestamp: now }));

      const spike = service.detectMomentumSpike(now);

      expect(spike).not.toBeNull();
      expect(spike!.direction).toBe(SignalDirection.LONG);
      expect(spike!.deltaRatio).toBeCloseTo(2.67, 1);
      expect(spike!.tickCount).toBe(55);
      expect(spike!.confidence).toBeGreaterThan(0);
    });

    it('should detect SELL momentum spike (inverse 2x ratio)', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(10, 35, { timestamp: now }));

      const spike = service.detectMomentumSpike(now);

      expect(spike).not.toBeNull();
      expect(spike!.direction).toBe(SignalDirection.SHORT);
      expect(spike!.deltaRatio).toBeCloseTo(3.5, 1);
      expect(spike!.tickCount).toBe(45);
    });

    it('should NOT detect spike if ratio too weak (1.5x < 2.0x)', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(30, 20, { timestamp: now }));

      expect(service.detectMomentumSpike(now)).toBeNull();
    });

    it('should NOT detect spike if tick count too low', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(10, 5, { timestamp: now }));

      expect(service.detectMomentumSpike(now)).toBeNull();
    });

    it('should NOT detect spike if volume too low', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(20, 10, {
        timestamp: now,
        buySize: 5,
        sellSize: 5,
      }));

      expect(service.detectMomentumSpike(now)).toBeNull();
    });

    it('should calculate correct volumeUSDT', () => {
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(service, createTickDeltaAnalyzerDirectionalTicks(30, 10, {
        timestamp: now,
        buyPrice: 2.0,
        sellPrice: 2.0,
      }));

      const spike = service.detectMomentumSpike(now);

      expect(spike).not.toBeNull();
      expect(spike!.volumeUSDT).toBeCloseTo(8000, 0);
    });

    it('should cap confidence at maxConfidence', () => {
      const cappedService = createService();
      const config = createTickDeltaAnalyzerConfig();
      const now = 1_700_000_100_000;
      seedTickDeltaAnalyzerHistory(cappedService, createTickDeltaAnalyzerDirectionalTicks(200, 10, { timestamp: now }));

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
        seedTickDeltaAnalyzerHistory(service, [
          ...createTickDeltaAnalyzerDirectionalTicks(20, 0, { timestamp: now - 11_000 }),
          ...createTickDeltaAnalyzerDirectionalTicks(10, 0, { timestamp: now }),
        ]);

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
        seedTickDeltaAnalyzerHistory(service, [
          ...createTickDeltaAnalyzerDirectionalTicks(15, 0, { timestamp: now - 8_000 }),
          ...createTickDeltaAnalyzerDirectionalTicks(10, 0, { timestamp: now }),
        ]);

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
