/**
 * Tests for TickDeltaAnalyzerService (Phase 4)
 *
 * Coverage:
 * - Add ticks (buy/sell)
 * - Calculate delta ratio
 * - Detect momentum spikes
 * - Volume/tick count filtering
 * - Cleanup old ticks
 */

import { TickDeltaAnalyzerService } from '../../services/tick-delta-analyzer.service';
import {
  LoggerService,
  LogLevel,
  Tick,
  TickDeltaAnalyzerConfig,
  SignalDirection,
} from '../../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createMockTick = (side: 'BUY' | 'SELL', price: number, size: number, timestamp: number = Date.now()): Tick => {
  return { timestamp, price, size, side };
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('TickDeltaAnalyzerService', () => {
  let service: TickDeltaAnalyzerService;
  let logger: LoggerService;
  let config: TickDeltaAnalyzerConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    // Default config
    config = {
      minDeltaRatio: 2.0, // 2x buy/sell
      detectionWindow: 5000, // 5 seconds
      minTickCount: 20,
      minVolumeUSDT: 1000,
      maxConfidence: 85,
    };

    service = new TickDeltaAnalyzerService(config, logger);
  });

  // ==========================================================================
  // ADD TICKS
  // ==========================================================================

  describe('addTick', () => {
    it('should add buy tick to history', () => {
      const tick = createMockTick('BUY', 1.0, 100);

      service.addTick(tick);

      const history = service.getTickHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(tick);
    });

    it('should add sell tick to history', () => {
      const tick = createMockTick('SELL', 1.0, 50);

      service.addTick(tick);

      const history = service.getTickHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(tick);
    });

    it('should maintain multiple ticks', () => {
      const tick1 = createMockTick('BUY', 1.0, 100);
      const tick2 = createMockTick('SELL', 1.0, 50);
      const tick3 = createMockTick('BUY', 1.0, 75);

      service.addTick(tick1);
      service.addTick(tick2);
      service.addTick(tick3);

      const history = service.getTickHistory();
      expect(history).toHaveLength(3);
    });

    it('should limit history size to max', () => {
      // Add 1005 ticks (max is 1000)
      for (let i = 0; i < 1005; i++) {
        service.addTick(createMockTick('BUY', 1.0, 10, Date.now() + i));
      }

      const history = service.getTickHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  // ==========================================================================
  // CALCULATE DELTA RATIO
  // ==========================================================================

  describe('calculateDeltaRatio', () => {
    it('should calculate delta ratio with more buys (buy > sell)', () => {
      const now = Date.now();

      // Add 40 buy ticks, 15 sell ticks
      for (let i = 0; i < 40; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 15; i++) {
        service.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const ratio = service.calculateDeltaRatio();

      // 40 * 100 / 15 * 100 = 4000 / 1500 = 2.67
      expect(ratio).toBeCloseTo(2.67, 1);
    });

    it('should calculate delta ratio with more sells (sell > buy)', () => {
      const now = Date.now();

      // Add 10 buy ticks, 35 sell ticks
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 35; i++) {
        service.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const ratio = service.calculateDeltaRatio();

      // 10 * 100 / 35 * 100 = 1000 / 3500 = 0.29
      expect(ratio).toBeCloseTo(0.29, 1);
    });

    it('should return neutral ratio (1.0) with no ticks', () => {
      const ratio = service.calculateDeltaRatio();

      expect(ratio).toBe(1.0);
    });

    it('should return max ratio (10) with only buy ticks', () => {
      const now = Date.now();

      for (let i = 0; i < 20; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }

      const ratio = service.calculateDeltaRatio();

      expect(ratio).toBe(10); // Capped at 10 instead of 999
    });

    it('should return min ratio (0.1) with only sell ticks', () => {
      const now = Date.now();

      for (let i = 0; i < 20; i++) {
        service.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const ratio = service.calculateDeltaRatio();

      expect(ratio).toBe(0.1); // Capped at 0.1 instead of 0.001
    });

    it('should only count ticks within window', () => {
      const now = Date.now();

      // Add old ticks (outside 5s window)
      for (let i = 0; i < 30; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now - 10000)); // 10s ago
      }

      // Add recent ticks (inside window)
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 5; i++) {
        service.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const ratio = service.calculateDeltaRatio();

      // Should only count recent: 10 buys / 5 sells = 2.0
      expect(ratio).toBeCloseTo(2.0, 1);
    });
  });

  // ==========================================================================
  // DETECT MOMENTUM SPIKE
  // ==========================================================================

  describe('detectMomentumSpike', () => {
    it('should detect BUY momentum spike (2x ratio)', () => {
      const now = Date.now();

      // Add 40 buy ticks, 15 sell ticks = 2.67x ratio
      for (let i = 0; i < 40; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 15; i++) {
        service.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const spike = service.detectMomentumSpike();

      expect(spike).not.toBeNull();
      expect(spike!.direction).toBe(SignalDirection.LONG);
      expect(spike!.deltaRatio).toBeCloseTo(2.67, 1);
      expect(spike!.tickCount).toBe(55);
      expect(spike!.confidence).toBeGreaterThan(0);
    });

    it('should detect SELL momentum spike (inverse 2x ratio)', () => {
      const now = Date.now();

      // Add 10 buy ticks, 35 sell ticks = 0.29 ratio (inverse 3.5x)
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 35; i++) {
        service.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const spike = service.detectMomentumSpike();

      expect(spike).not.toBeNull();
      expect(spike!.direction).toBe(SignalDirection.SHORT);
      expect(spike!.deltaRatio).toBeCloseTo(3.5, 1); // Inverted
      expect(spike!.tickCount).toBe(45);
    });

    it('should NOT detect spike if ratio too weak (1.5x < 2.0x)', () => {
      const now = Date.now();

      // Add 30 buy ticks, 20 sell ticks = 1.5x ratio (below threshold)
      for (let i = 0; i < 30; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 20; i++) {
        service.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const spike = service.detectMomentumSpike();

      expect(spike).toBeNull();
    });

    it('should NOT detect spike if tick count too low', () => {
      const now = Date.now();

      // Add only 15 ticks (below min 20)
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 5; i++) {
        service.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const spike = service.detectMomentumSpike();

      expect(spike).toBeNull();
    });

    it('should NOT detect spike if volume too low', () => {
      const now = Date.now();

      // Add 30 ticks with small size (total volume < 1000 USDT)
      for (let i = 0; i < 20; i++) {
        service.addTick(createMockTick('BUY', 1.0, 5, now)); // 5 * 1.0 = 5 USDT
      }
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('SELL', 1.0, 5, now));
      }

      const spike = service.detectMomentumSpike();

      // Total volume = 30 * 5 * 1.0 = 150 USDT < 1000 USDT
      expect(spike).toBeNull();
    });

    it('should calculate correct volumeUSDT', () => {
      const now = Date.now();

      // Add ticks with known price and size
      for (let i = 0; i < 30; i++) {
        service.addTick(createMockTick('BUY', 2.0, 100, now)); // 100 * 2.0 = 200 USDT each
      }
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('SELL', 2.0, 100, now));
      }

      const spike = service.detectMomentumSpike();

      expect(spike).not.toBeNull();
      // Total: 40 ticks * 100 size * 2.0 price = 8000 USDT
      expect(spike!.volumeUSDT).toBeCloseTo(8000, 0);
    });

    it('should cap confidence at maxConfidence', () => {
      const now = Date.now();

      // Add extreme ratio (20x)
      for (let i = 0; i < 200; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const spike = service.detectMomentumSpike();

      expect(spike).not.toBeNull();
      expect(spike!.confidence).toBeLessThanOrEqual(config.maxConfidence);
    });
  });

  // ==========================================================================
  // CLEANUP OLD TICKS
  // ==========================================================================

  describe('cleanupOldTicks', () => {
    it('should remove ticks older than 2x detection window', () => {
      const now = Date.now();

      // Add old ticks (11s ago, outside 2x 5s window)
      for (let i = 0; i < 20; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now - 11000));
      }

      // Add recent ticks
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }

      service.cleanupOldTicks();

      const history = service.getTickHistory();

      // Should only keep recent ticks
      expect(history.length).toBe(10);
    });

    it('should keep ticks within 2x detection window', () => {
      const now = Date.now();

      // Add ticks 8s ago (within 2x 5s window)
      for (let i = 0; i < 15; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now - 8000));
      }

      // Add recent ticks
      for (let i = 0; i < 10; i++) {
        service.addTick(createMockTick('BUY', 1.0, 100, now));
      }

      service.cleanupOldTicks();

      const history = service.getTickHistory();

      // Should keep both old and recent
      expect(history.length).toBe(25);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty tick history', () => {
      const ratio = service.calculateDeltaRatio();
      const spike = service.detectMomentumSpike();

      expect(ratio).toBe(1.0);
      expect(spike).toBeNull();
    });

    it('should clear history', () => {
      service.addTick(createMockTick('BUY', 1.0, 100));
      service.addTick(createMockTick('SELL', 1.0, 50));

      service.clearHistory();

      const history = service.getTickHistory();
      expect(history).toHaveLength(0);
    });
  });
});
