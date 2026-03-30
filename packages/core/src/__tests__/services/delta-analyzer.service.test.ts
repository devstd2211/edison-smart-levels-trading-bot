import { DeltaAnalyzerService } from '../../services/delta-analyzer.service';
import { DeltaConfig, LoggerService, Signal, SignalDirection } from '../../types/legacy';
import {
  createDeltaAnalyzerConfig,
  createManagedDeltaAnalyzerContext,
  createDeltaAnalyzerService,
  createDeltaAnalyzerSignal,
  createDeltaAnalyzerTickBatch,
  createDeltaAnalyzerTick,
  createDeltaAnalyzerVolumePair,
  seedDeltaAnalyzerTicks,
  type DeltaAnalyzerMockLogger,
  type ManagedDeltaAnalyzerContext,
} from '../helpers/delta-analyzer-test.utils';

describe('DeltaAnalyzerService', () => {
  type DeltaAnalyzerCleanup = ManagedDeltaAnalyzerContext['cleanup'];
  let service: DeltaAnalyzerService;
  let logger: DeltaAnalyzerMockLogger;
  let config: DeltaConfig;

  type DeltaAnalyzerFixtures = Pick<
    ManagedDeltaAnalyzerContext,
    'service' | 'logger' | 'config'
  >;

  function bindDeltaAnalyzerContext() {
    let getFixtures: () => DeltaAnalyzerFixtures;
    let cleanup: DeltaAnalyzerCleanup;

    beforeEach(() => {
      const managedContext = createManagedDeltaAnalyzerContext();
      getFixtures = () => ({
        service: managedContext.service,
        logger: managedContext.logger,
        config: managedContext.config,
      });
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => getFixtures();
  }

  const getFixtures = bindDeltaAnalyzerContext();

  beforeEach(() => {
    ({ service, logger, config } = getFixtures());
  });

  describe('initialization', () => {
    it('should initialize with config', () => {
      expect(service).toBeDefined();
    });

    it('should start with zero ticks', () => {
      const analysis = service.analyze();
      expect(analysis.buyVolume).toBe(0);
      expect(analysis.sellVolume).toBe(0);
      expect(analysis.delta).toBe(0);
    });
  });

  describe('addTick', () => {
    it('should add BUY tick', () => {
      const tick = createDeltaAnalyzerTick();

      service.addTick(tick);

      const analysis = service.analyze();
      expect(analysis.buyVolume).toBe(100);
      expect(analysis.sellVolume).toBe(0);
      expect(analysis.delta).toBe(100);
    });

    it('should add SELL tick', () => {
      const tick = createDeltaAnalyzerTick({ quantity: 200, side: 'SELL' });

      service.addTick(tick);

      const analysis = service.analyze();
      expect(analysis.buyVolume).toBe(0);
      expect(analysis.sellVolume).toBe(200);
      expect(analysis.delta).toBe(-200);
    });

    it('should aggregate multiple ticks', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, [
        createDeltaAnalyzerTick({ timestamp: now, price: 50000 }),
        createDeltaAnalyzerTick({ timestamp: now + 1000, price: 50010, quantity: 150 }),
        createDeltaAnalyzerTick({ timestamp: now + 2000, price: 50005, quantity: 80, side: 'SELL' }),
      ]);

      const analysis = service.analyze();
      expect(analysis.buyVolume).toBe(250); // 100 + 150
      expect(analysis.sellVolume).toBe(80);
      expect(analysis.delta).toBe(170); // 250 - 80
    });
  });

  describe('rolling window', () => {
    it('should keep only ticks within window', () => {
      const now = Date.now();

      // Old tick (outside window)
      service.addTick(
        createDeltaAnalyzerTick({
          timestamp: now - 70000,
          quantity: 500,
        }),
      );

      // Recent tick (inside window)
      service.addTick(
        createDeltaAnalyzerTick({
          timestamp: now - 5000,
          price: 50010,
        }),
      );

      const analysis = service.analyze();
      // Only recent tick should count
      expect(analysis.buyVolume).toBe(100);
      expect(analysis.sellVolume).toBe(0);
    });

    it('should remove old ticks on addTick', () => {
      const now = Date.now();

      // Add old tick (will be filtered immediately on addTick)
      service.addTick(
        createDeltaAnalyzerTick({
          timestamp: now - 70000,
          quantity: 1000,
        }),
      );

      // Old tick should be filtered out immediately (outside 60s window)
      expect(service.getTickCount()).toBe(0);

      // Add new tick (within window)
      service.addTick(createDeltaAnalyzerTick({ timestamp: now, price: 50010, quantity: 50, side: 'SELL' }));

      // Only new tick should remain
      expect(service.getTickCount()).toBe(1);
      const analysis = service.analyze();
      expect(analysis.buyVolume).toBe(0); // Old buy was never stored
      expect(analysis.sellVolume).toBe(50); // Only new sell
    });
  });

  describe('delta calculation', () => {
    it('should calculate positive delta (bullish)', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(1500, 800, now));

      const analysis = service.analyze();
      expect(analysis.delta).toBe(700); // 1500 - 800
      expect(analysis.deltaPercent).toBeCloseTo(30.43, 1); // (700 / 2300) * 100
    });

    it('should calculate negative delta (bearish)', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(500, 1200, now, {
        sellPrice: 49990,
      }));

      const analysis = service.analyze();
      expect(analysis.delta).toBe(-700); // 500 - 1200
      expect(analysis.deltaPercent).toBeCloseTo(-41.18, 1); // (-700 / 1700) * 100
    });

    it('should calculate zero delta (balanced)', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(1000, 1000, now));

      const analysis = service.analyze();
      expect(analysis.delta).toBe(0);
      expect(analysis.deltaPercent).toBe(0);
    });
  });

  describe('trend determination', () => {
    it('should detect BULLISH trend (delta > threshold)', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(2500, 500, now));

      const analysis = service.analyze();
      expect(analysis.delta).toBe(2000); // > threshold (1000)
      expect(analysis.trend).toBe('BULLISH');
    });

    it('should detect BEARISH trend (delta < -threshold)', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(400, 2000, now, {
        sellPrice: 49990,
      }));

      const analysis = service.analyze();
      expect(analysis.delta).toBe(-1600); // < -threshold (-1000)
      expect(analysis.trend).toBe('BEARISH');
    });

    it('should detect NEUTRAL trend (|delta| < threshold)', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(600, 200, now));

      const analysis = service.analyze();
      expect(analysis.delta).toBe(400); // < threshold (1000)
      expect(analysis.trend).toBe('NEUTRAL');
    });

    it('should detect BULLISH on exactly threshold boundary', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(1500, 500, now));

      const analysis = service.analyze();
      expect(analysis.delta).toBe(1000); // Exactly threshold
      expect(analysis.trend).toBe('BULLISH'); // Math.abs(1000) < 1000 = false → BULLISH
    });

    it('should detect NEUTRAL just below threshold', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(1499, 500, now));

      const analysis = service.analyze();
      expect(analysis.delta).toBe(999); // Just below threshold
      expect(analysis.trend).toBe('NEUTRAL'); // Math.abs(999) < 1000 = true
    });
  });

  describe('strength calculation', () => {
    it('should calculate strength as absolute delta percent', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(1500, 500, now));

      const analysis = service.analyze();
      expect(analysis.deltaPercent).toBeCloseTo(50, 0); // (1000 / 2000) * 100
      expect(analysis.strength).toBeCloseTo(50, 0);
    });

    it('should cap strength at 100', () => {
      const now = Date.now();

      // All buy, no sell = 100% delta
      service.addTick(createDeltaAnalyzerTick({ timestamp: now, quantity: 2000 }));

      const analysis = service.analyze();
      expect(analysis.deltaPercent).toBe(100);
      expect(analysis.strength).toBe(100);
    });

    it('should handle zero strength (no delta)', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(1000, 1000, now));

      const analysis = service.analyze();
      expect(analysis.strength).toBe(0);
    });
  });

  describe('confirmSignal', () => {
    const mockSignal = (direction: SignalDirection): Signal => createDeltaAnalyzerSignal(direction);

    it('should confirm LONG signal with BULLISH delta', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(2500, 500, now));

      const signal = mockSignal(SignalDirection.LONG);
      const confirms = service.confirmSignal(signal);

      expect(confirms).toBe(true);
    });

    it('should confirm SHORT signal with BEARISH delta', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(400, 2000, now, {
        sellPrice: 49990,
      }));

      const signal = mockSignal(SignalDirection.SHORT);
      const confirms = service.confirmSignal(signal);

      expect(confirms).toBe(true);
    });

    it('should NOT confirm LONG signal with BEARISH delta', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(400, 2000, now, {
        sellPrice: 49990,
      }));

      const signal = mockSignal(SignalDirection.LONG);
      const confirms = service.confirmSignal(signal);

      expect(confirms).toBe(false);
    });

    it('should NOT confirm SHORT signal with BULLISH delta', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(2500, 500, now));

      const signal = mockSignal(SignalDirection.SHORT);
      const confirms = service.confirmSignal(signal);

      expect(confirms).toBe(false);
    });

    it('should NOT confirm when delta is NEUTRAL', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(600, 200, now));

      const longSignal = mockSignal(SignalDirection.LONG);
      const shortSignal = mockSignal(SignalDirection.SHORT);

      expect(service.confirmSignal(longSignal)).toBe(false);
      expect(service.confirmSignal(shortSignal)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle no ticks (empty analysis)', () => {
      const analysis = service.analyze();

      expect(analysis.buyVolume).toBe(0);
      expect(analysis.sellVolume).toBe(0);
      expect(analysis.delta).toBe(0);
      expect(analysis.deltaPercent).toBe(0);
      expect(analysis.trend).toBe('NEUTRAL');
      expect(analysis.strength).toBe(0);
    });

    it('should handle all BUY ticks', () => {
      const now = Date.now();

      createDeltaAnalyzerTickBatch(2, { side: 'BUY', timestamp: now }).forEach((tick, index) => {
        service.addTick({
          ...tick,
          quantity: index === 0 ? 500 : 1000,
          price: index === 0 ? tick.price : 50010,
          timestamp: now + index * 1000,
        });
      });

      const analysis = service.analyze();
      expect(analysis.buyVolume).toBe(1500);
      expect(analysis.sellVolume).toBe(0);
      expect(analysis.delta).toBe(1500);
      expect(analysis.deltaPercent).toBe(100);
      expect(analysis.trend).toBe('BULLISH');
    });

    it('should handle all SELL ticks', () => {
      const now = Date.now();

      createDeltaAnalyzerTickBatch(2, { side: 'SELL', timestamp: now }).forEach((tick, index) => {
        service.addTick({
          ...tick,
          quantity: index === 0 ? 800 : 700,
          price: index === 0 ? tick.price : 49990,
          timestamp: now + index * 1000,
        });
      });

      const analysis = service.analyze();
      expect(analysis.buyVolume).toBe(0);
      expect(analysis.sellVolume).toBe(1500);
      expect(analysis.delta).toBe(-1500);
      expect(analysis.deltaPercent).toBe(-100);
      expect(analysis.trend).toBe('BEARISH');
    });
  });

  describe('reset', () => {
    it('should clear all ticks', () => {
      const now = Date.now();
      seedDeltaAnalyzerTicks(service, createDeltaAnalyzerVolumePair(1000, 500, now));

      expect(service.getTickCount()).toBe(2);

      service.reset();

      expect(service.getTickCount()).toBe(0);
      const analysis = service.analyze();
      expect(analysis.buyVolume).toBe(0);
      expect(analysis.sellVolume).toBe(0);
    });
  });

  describe('disabled mode', () => {
    it('should not add ticks when disabled', () => {
      const disabledConfig: DeltaConfig = createDeltaAnalyzerConfig({ enabled: false });
      const disabledService = createDeltaAnalyzerService({
        config: disabledConfig,
        logger: logger as unknown as LoggerService,
      });

      const tick = createDeltaAnalyzerTick({ quantity: 1000 });

      disabledService.addTick(tick);

      const analysis = disabledService.analyze();
      expect(analysis.buyVolume).toBe(0); // Should not count
      expect(service.getTickCount()).toBe(0);
    });
  });
});
