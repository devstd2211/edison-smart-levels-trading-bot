import { TIME_MULTIPLIERS } from '../../constants/technical.constants';
import { ICONS } from '../../cli/cli-runtime';

export function getPnlSign(value: number): string {
  return value >= 0 ? '+' : '';
}

export function getCloseEmoji(closeReason: string): string {
  if (closeReason.includes('Stop Loss') || closeReason.includes('SL')) {
    return `${ICONS.shield}`;
  }
  if (closeReason.includes('Take Profit') || closeReason.includes('TP')) {
    return `${ICONS.target}`;
  }
  if (closeReason.toLowerCase().includes('trailing')) {
    return `${ICONS.chart_up}`;
  }
  if (closeReason.toLowerCase().includes('time')) {
    return `${ICONS.alarm_clock}`;
  }
  return `${ICONS.end}`;
}

export function formatHoldingTime(openedAt: number, now: number = Date.now()): string {
  const holdingTimeMs = now - openedAt;
  const holdingTimeSec = Math.floor(holdingTimeMs / TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND);
  const holdingTimeMin = Math.floor(holdingTimeSec / TIME_MULTIPLIERS.SECONDS_PER_MINUTE);

  if (holdingTimeMin > 0) {
    return `${holdingTimeMin}m ${holdingTimeSec % TIME_MULTIPLIERS.SECONDS_PER_MINUTE}s`;
  }
  return `${holdingTimeSec}s`;
}
