import type { WebApiConfig, WebApiIndicatorPreferences } from '@edison/contracts/web-api';

export const DEFAULT_WEB_API_INDICATOR_PREFERENCES: Required<WebApiIndicatorPreferences> = {
  timeframes: ['1h', '4h'],
  rsiPeriods: [14],
  emaPeriods: [20, 50],
  atrPeriods: [14],
};

export const DEFAULT_WEB_API_CONFIG: Required<WebApiConfig> = {
  indicatorPreferences: DEFAULT_WEB_API_INDICATOR_PREFERENCES,
};

export const getDefaultWebApiIndicatorPreferences = (): Required<WebApiIndicatorPreferences> => ({
  timeframes: [...DEFAULT_WEB_API_INDICATOR_PREFERENCES.timeframes],
  rsiPeriods: [...DEFAULT_WEB_API_INDICATOR_PREFERENCES.rsiPeriods],
  emaPeriods: [...DEFAULT_WEB_API_INDICATOR_PREFERENCES.emaPeriods],
  atrPeriods: [...DEFAULT_WEB_API_INDICATOR_PREFERENCES.atrPeriods],
});

export const getDefaultWebApiConfig = (): { indicatorPreferences: Required<WebApiIndicatorPreferences> } => ({
  indicatorPreferences: getDefaultWebApiIndicatorPreferences(),
});

const cloneStringList = (values: unknown, fallback: string[]): string[] =>
  Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string')
    : [...fallback];

const cloneNumberList = (values: unknown, fallback: number[]): number[] =>
  Array.isArray(values)
    ? values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    : [...fallback];

export const normalizeWebApiConfig = (config?: WebApiConfig): Required<WebApiConfig> => {
  const defaults = getDefaultWebApiConfig();
  const preferences = config?.indicatorPreferences;

  return {
    indicatorPreferences: {
      timeframes: cloneStringList(preferences?.timeframes, defaults.indicatorPreferences.timeframes),
      rsiPeriods: cloneNumberList(preferences?.rsiPeriods, defaults.indicatorPreferences.rsiPeriods),
      emaPeriods: cloneNumberList(preferences?.emaPeriods, defaults.indicatorPreferences.emaPeriods),
      atrPeriods: cloneNumberList(preferences?.atrPeriods, defaults.indicatorPreferences.atrPeriods),
    },
  };
};
