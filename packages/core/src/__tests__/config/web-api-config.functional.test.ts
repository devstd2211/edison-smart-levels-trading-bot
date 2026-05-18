import fs from 'fs';
import path from 'path';
import {
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
