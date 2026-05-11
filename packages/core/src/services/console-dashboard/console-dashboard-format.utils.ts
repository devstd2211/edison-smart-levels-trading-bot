const DASHBOARD_PROGRESS_EMPTY = '-';
const DASHBOARD_PROGRESS_FILLED = '#';

export function formatDashboardPnL(value: number): string {
  const color = value >= 0 ? '{green-fg}' : '{red-fg}';
  const sign = value > 0 ? '+' : '';
  return `${color}${sign}$${value.toFixed(2)}{/}`;
}

export function formatDashboardPercent(value: number): string {
  const color = value >= 0 ? '{green-fg}' : '{red-fg}';
  const sign = value > 0 ? '+' : '';
  return `${color}${sign}${value.toFixed(2)}%{/}`;
}

export function renderDashboardProgressBar(
  current: number,
  target: number,
  width: number = 20,
): string {
  if (target === 0) return DASHBOARD_PROGRESS_EMPTY.repeat(width);
  const percent = Math.min(100, Math.max(0, (current / target) * 100));
  const filled = Math.floor((percent / 100) * width);
  const empty = width - filled;
  return '{green-fg}' + DASHBOARD_PROGRESS_FILLED.repeat(filled) + '{/}' + '{gray-fg}' + DASHBOARD_PROGRESS_EMPTY.repeat(empty) + '{/}';
}

export function formatDashboardDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

export function getDashboardTrendColor(trend: string): string {
  if (trend === 'UPTREND') {
    return '{green-fg}';
  }
  if (trend === 'DOWNTREND') {
    return '{red-fg}';
  }
  return '{yellow-fg}';
}

export function getDashboardRsiColor(rsi: number): string {
  if (rsi > 70) {
    return '{red-fg}';
  }
  if (rsi < 30) {
    return '{green-fg}';
  }
  return '{white-fg}';
}

export function getDashboardWinRateColor(winRate: number): string {
  if (winRate >= 60) {
    return '{green-fg}';
  }
  if (winRate >= 40) {
    return '{yellow-fg}';
  }
  return '{red-fg}';
}

export function getDashboardEventTypeColor(type: string): string {
  if (type.includes('win') || type.includes('profit')) {
    return '{green-fg}';
  }
  if (type.includes('loss') || type.includes('sl-hit')) {
    return '{red-fg}';
  }
  if (type.includes('position-open') || type.includes('tp-hit')) {
    return '{cyan-fg}';
  }
  if (type.includes('error') || type.includes('warning')) {
    return '{yellow-fg}';
  }
  return '{white-fg}';
}
