import fs from 'fs';
import path from 'path';
import {
  DEFAULT_WEB_API_INDICATOR_PREFERENCES,
  getDefaultWebApiIndicatorPreferences,
  normalizeWebApiConfig,
} from '../../config/web-api-config';

describe('web-api config defaults', () => {
  test('normalizes only supported indicator preference keys and clones array values', () => {
    const config = normalizeWebApiConfig({
      indicatorPreferences: {
        timeframes: ['15m', '1h'],
        rsiPeriods: [7, 14],
        emaPeriods: [9, 21],
        atrPeriods: [10],
        ignored: true,
      } as never,
    });

    expect(config.indicatorPreferences).toEqual({
      timeframes: ['15m', '1h'],
      rsiPeriods: [7, 14],
      emaPeriods: [9, 21],
      atrPeriods: [10],
    });

    config.indicatorPreferences.timeframes?.push('4h');

    expect(getDefaultWebApiIndicatorPreferences()).toEqual({
      timeframes: ['1h', '4h'],
      rsiPeriods: [14],
      emaPeriods: [20, 50],
      atrPeriods: [14],
    });
  });

  test('normalizeWebApiConfig uses full defaults when called with no argument', () => {
    const result = normalizeWebApiConfig();

    expect(result.indicatorPreferences).toEqual(getDefaultWebApiIndicatorPreferences());
  });

  test('normalizeWebApiConfig preserves empty arrays instead of falling back to defaults', () => {
    const result = normalizeWebApiConfig({
      indicatorPreferences: { timeframes: [], rsiPeriods: [] },
    });

    expect(result.indicatorPreferences.timeframes).toEqual([]);
    expect(result.indicatorPreferences.rsiPeriods).toEqual([]);
    expect(result.indicatorPreferences.emaPeriods).toEqual(
      DEFAULT_WEB_API_INDICATOR_PREFERENCES.emaPeriods,
    );
  });

  test('normalizeWebApiConfig filters non-string values from timeframes and non-finite numbers from period lists', () => {
    const result = normalizeWebApiConfig({
      indicatorPreferences: {
        timeframes: [1, 'valid', null, '4h'] as never,
        rsiPeriods: ['bad', 14, Infinity, NaN, 7] as never,
      },
    });

    expect(result.indicatorPreferences.timeframes).toEqual(['valid', '4h']);
    expect(result.indicatorPreferences.rsiPeriods).toEqual([14, 7]);
  });

  test('getDefaultWebApiIndicatorPreferences returns independent clones across calls', () => {
    const first = getDefaultWebApiIndicatorPreferences();
    first.timeframes.push('mutated');

    const second = getDefaultWebApiIndicatorPreferences();

    expect(second.timeframes).not.toContain('mutated');
    expect(second).toEqual(DEFAULT_WEB_API_INDICATOR_PREFERENCES);
  });

  test('config.example propagates the documented default web-api preferences', () => {
    const configExamplePath = path.resolve(__dirname, '../../../../../config.example.json');
    const configExample = JSON.parse(fs.readFileSync(configExamplePath, 'utf-8')) as {
      webApi?: {
        indicatorPreferences?: Record<string, unknown>;
      };
    };
    const indicatorPreferences = configExample.webApi?.indicatorPreferences ?? {};

    expect({
      timeframes: indicatorPreferences.timeframes,
      rsiPeriods: indicatorPreferences.rsiPeriods,
      emaPeriods: indicatorPreferences.emaPeriods,
      atrPeriods: indicatorPreferences.atrPeriods,
    }).toEqual(getDefaultWebApiIndicatorPreferences());
  });
});
