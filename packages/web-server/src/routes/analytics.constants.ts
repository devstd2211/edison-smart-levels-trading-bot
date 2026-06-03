export const DEFAULT_EQUITY_CURVE_STARTING_BALANCE = 1000;
export const DEFAULT_ANALYTICS_JOURNAL_PAGE = 1;
export const DEFAULT_ANALYTICS_JOURNAL_LIMIT = 50;
export const MAX_ANALYTICS_JOURNAL_LIMIT = 500;
export const DEFAULT_ANALYTICS_RECENT_JOURNAL_HOURS = 24;

export const ANALYTICS_ROUTE_FALLBACK_MESSAGES = {
  journal: 'Failed to fetch journal',
  recentJournal: 'Failed to fetch recent journal',
  journalStats: 'Failed to fetch journal statistics',
  sessions: 'Failed to fetch sessions',
  compareSessions: 'Failed to compare sessions',
  strategyPerformance: 'Failed to fetch strategy performance',
  pnlHistory: 'Failed to fetch PnL history',
  equityCurve: 'Failed to fetch equity curve',
} as const;
