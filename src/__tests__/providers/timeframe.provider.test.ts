/**
 * TimeframeProvider Tests
 *
 * Tests for multi-timeframe configuration management and validation.
 */

import { TimeframeProvider } from '../../providers/timeframe.provider';
import { TimeframeRole, TimeframeConfig } from '../../types';

describe('TimeframeProvider', () => {
  // ============================================================================
  // TEST DATA
  // ============================================================================

  const validConfig: Record<string, TimeframeConfig> = {
    entry: { interval: '1', candleLimit: 100, enabled: true },
    primary: { interval: '5', candleLimit: 200, enabled: true },
    trend1: { interval: '30', candleLimit: 100, enabled: true },
    trend2: { interval: '60', candleLimit: 100, enabled: false },
    context: { interval: '240', candleLimit: 50, enabled: false },
  };

  const minimalConfig: Record<string, TimeframeConfig> = {
    entry: { interval: '1', candleLimit: 100, enabled: true },
    primary: { interval: '5', candleLimit: 200, enabled: true },
    trend1: { interval: '30', candleLimit: 100, enabled: false },
    trend2: { interval: '60', candleLimit: 100, enabled: false },
    context: { interval: '240', candleLimit: 50, enabled: false },
  };

  const allEnabledConfig: Record<string, TimeframeConfig> = {
    entry: { interval: '1', candleLimit: 100, enabled: true },
    primary: { interval: '5', candleLimit: 200, enabled: true },
    trend1: { interval: '30', candleLimit: 100, enabled: true },
    trend2: { interval: '60', candleLimit: 100, enabled: true },
    context: { interval: '240', candleLimit: 50, enabled: true },
  };

  // ============================================================================
  // BASIC FUNCTIONALITY
  // ============================================================================

  describe('constructor', () => {
    it('should load valid timeframe configuration', () => {
      const provider = new TimeframeProvider(validConfig);
      expect(provider).toBeDefined();
    });

    it('should throw error if PRIMARY timeframe is not enabled', () => {
      const invalidConfig = {
        ...validConfig,
        primary: { interval: '5', candleLimit: 200, enabled: false },
      };

      expect(() => new TimeframeProvider(invalidConfig)).toThrow(
        'PRIMARY timeframe is required but not enabled in config',
      );
    });

    it('should throw error if ENTRY timeframe is not enabled', () => {
      const invalidConfig = {
        ...validConfig,
        entry: { interval: '1', candleLimit: 100, enabled: false },
      };

      expect(() => new TimeframeProvider(invalidConfig)).toThrow(
        'ENTRY timeframe is required but not enabled in config',
      );
    });

    it('should work with minimal config (only ENTRY and PRIMARY enabled)', () => {
      const provider = new TimeframeProvider(minimalConfig);
      expect(provider.isTimeframeEnabled(TimeframeRole.ENTRY)).toBe(true);
      expect(provider.isTimeframeEnabled(TimeframeRole.PRIMARY)).toBe(true);
      expect(provider.isTimeframeEnabled(TimeframeRole.TREND1)).toBe(false);
    });
  });

  // ============================================================================
  // TIMEFRAME ACCESS
  // ============================================================================

  describe('getTimeframe', () => {
    let provider: TimeframeProvider;

    beforeEach(() => {
      provider = new TimeframeProvider(validConfig);
    });

    it('should return config for enabled timeframe', () => {
      const config = provider.getTimeframe(TimeframeRole.PRIMARY);
      expect(config).toEqual({
        interval: '5',
        candleLimit: 200,
        enabled: true,
      });
    });

    it('should return undefined for disabled timeframe', () => {
      const config = provider.getTimeframe(TimeframeRole.TREND2);
      expect(config).toBeUndefined();
    });

    it('should return correct config for ENTRY timeframe', () => {
      const config = provider.getTimeframe(TimeframeRole.ENTRY);
      expect(config).toEqual({
        interval: '1',
        candleLimit: 100,
        enabled: true,
      });
    });

    it('should return correct config for TREND1 timeframe', () => {
      const config = provider.getTimeframe(TimeframeRole.TREND1);
      expect(config).toEqual({
        interval: '30',
        candleLimit: 100,
        enabled: true,
      });
    });
  });

  // ============================================================================
  // ENABLED CHECKS
  // ============================================================================

  describe('isTimeframeEnabled', () => {
    let provider: TimeframeProvider;

    beforeEach(() => {
      provider = new TimeframeProvider(validConfig);
    });

    it('should return true for enabled timeframes', () => {
      expect(provider.isTimeframeEnabled(TimeframeRole.ENTRY)).toBe(true);
      expect(provider.isTimeframeEnabled(TimeframeRole.PRIMARY)).toBe(true);
      expect(provider.isTimeframeEnabled(TimeframeRole.TREND1)).toBe(true);
    });

    it('should return false for disabled timeframes', () => {
      expect(provider.isTimeframeEnabled(TimeframeRole.TREND2)).toBe(false);
      expect(provider.isTimeframeEnabled(TimeframeRole.CONTEXT)).toBe(false);
    });
  });

  describe('getEnabledRoles', () => {
    it('should return all enabled timeframe roles (current config)', () => {
      const provider = new TimeframeProvider(validConfig);
      const enabled = provider.getEnabledRoles();

      expect(enabled).toHaveLength(3);
      expect(enabled).toContain(TimeframeRole.ENTRY);
      expect(enabled).toContain(TimeframeRole.PRIMARY);
      expect(enabled).toContain(TimeframeRole.TREND1);
      expect(enabled).not.toContain(TimeframeRole.TREND2);
      expect(enabled).not.toContain(TimeframeRole.CONTEXT);
    });

    it('should return only ENTRY and PRIMARY for minimal config', () => {
      const provider = new TimeframeProvider(minimalConfig);
      const enabled = provider.getEnabledRoles();

      expect(enabled).toHaveLength(2);
      expect(enabled).toContain(TimeframeRole.ENTRY);
      expect(enabled).toContain(TimeframeRole.PRIMARY);
    });

    it('should return all roles when all timeframes enabled', () => {
      const provider = new TimeframeProvider(allEnabledConfig);
      const enabled = provider.getEnabledRoles();

      expect(enabled).toHaveLength(5);
      expect(enabled).toContain(TimeframeRole.ENTRY);
      expect(enabled).toContain(TimeframeRole.PRIMARY);
      expect(enabled).toContain(TimeframeRole.TREND1);
      expect(enabled).toContain(TimeframeRole.TREND2);
      expect(enabled).toContain(TimeframeRole.CONTEXT);
    });
  });

  // ============================================================================
  // INTERVAL & LIMITS
  // ============================================================================

  describe('getInterval', () => {
    let provider: TimeframeProvider;

    beforeEach(() => {
      provider = new TimeframeProvider(validConfig);
    });

    it('should return correct interval for each timeframe', () => {
      expect(provider.getInterval(TimeframeRole.ENTRY)).toBe('1');
      expect(provider.getInterval(TimeframeRole.PRIMARY)).toBe('5');
      expect(provider.getInterval(TimeframeRole.TREND1)).toBe('30');
    });

    it('should return undefined for disabled timeframe', () => {
      expect(provider.getInterval(TimeframeRole.TREND2)).toBeUndefined();
      expect(provider.getInterval(TimeframeRole.CONTEXT)).toBeUndefined();
    });
  });

  describe('getCandleLimit', () => {
    let provider: TimeframeProvider;

    beforeEach(() => {
      provider = new TimeframeProvider(validConfig);
    });

    it('should return correct candle limits for each timeframe', () => {
      expect(provider.getCandleLimit(TimeframeRole.ENTRY)).toBe(100);
      expect(provider.getCandleLimit(TimeframeRole.PRIMARY)).toBe(200);
      expect(provider.getCandleLimit(TimeframeRole.TREND1)).toBe(100);
    });

    it('should return undefined for disabled timeframe', () => {
      expect(provider.getCandleLimit(TimeframeRole.TREND2)).toBeUndefined();
      expect(provider.getCandleLimit(TimeframeRole.CONTEXT)).toBeUndefined();
    });
  });

  describe('getAllTimeframes', () => {
    it('should return Map with all enabled timeframes (current config)', () => {
      const provider = new TimeframeProvider(validConfig);
      const timeframes = provider.getAllTimeframes();

      expect(timeframes.size).toBe(3);
      expect(timeframes.has(TimeframeRole.ENTRY)).toBe(true);
      expect(timeframes.has(TimeframeRole.PRIMARY)).toBe(true);
      expect(timeframes.has(TimeframeRole.TREND1)).toBe(true);
      expect(timeframes.has(TimeframeRole.TREND2)).toBe(false);
    });

    it('should return all timeframes when all enabled', () => {
      const provider = new TimeframeProvider(allEnabledConfig);
      const timeframes = provider.getAllTimeframes();

      expect(timeframes.size).toBe(5);
      expect(timeframes.has(TimeframeRole.ENTRY)).toBe(true);
      expect(timeframes.has(TimeframeRole.PRIMARY)).toBe(true);
      expect(timeframes.has(TimeframeRole.TREND1)).toBe(true);
      expect(timeframes.has(TimeframeRole.TREND2)).toBe(true);
      expect(timeframes.has(TimeframeRole.CONTEXT)).toBe(true);
    });
  });

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  describe('intervalToMinutes', () => {
    let provider: TimeframeProvider;

    beforeEach(() => {
      provider = new TimeframeProvider(validConfig);
    });

    it('should convert interval strings to minutes', () => {
      expect(provider.intervalToMinutes('1')).toBe(1);
      expect(provider.intervalToMinutes('5')).toBe(5);
      expect(provider.intervalToMinutes('15')).toBe(15);
      expect(provider.intervalToMinutes('30')).toBe(30);
      expect(provider.intervalToMinutes('60')).toBe(60);
      expect(provider.intervalToMinutes('240')).toBe(240);
      expect(provider.intervalToMinutes('1440')).toBe(1440); // 1D
    });
  });
});
