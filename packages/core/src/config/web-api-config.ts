import type { WebApiConfig, WebApiIndicatorPreferences } from '@edison/contracts';

export const DEFAULT_WEB_API_INDICATOR_PREFERENCES: WebApiIndicatorPreferences = {
  timeframes: ['1h', '4h'],
  rsiPeriods: [14],
  emaPeriods: [20, 50],
  atrPeriods: [14],
};

export const getDefaultWebApiIndicatorPreferences = (): WebApiIndicatorPreferences => ({
  ...DEFAULT_WEB_API_INDICATOR_PREFERENCES,
  timeframes: [...DEFAULT_WEB_API_INDICATOR_PREFERENCES.timeframes!],
  rsiPeriods: [...DEFAULT_WEB_API_INDICATOR_PREFERENCES.rsiPeriods!],
  emaPeriods: [...DEFAULT_WEB_API_INDICATOR_PREFERENCES.emaPeriods!],
  atrPeriods: [...DEFAULT_WEB_API_INDICATOR_PREFERENCES.atrPeriods!],
});

export const normalizeWebApiConfig = (config?: WebApiConfig): Required<WebApiConfig> => ({
  indicatorPreferences: {
    ...getDefaultWebApiIndicatorPreferences(),
    ...(config?.indicatorPreferences ?? {}),
  },
});
