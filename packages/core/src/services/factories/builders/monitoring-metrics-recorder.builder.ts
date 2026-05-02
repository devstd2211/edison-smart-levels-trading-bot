import type { IMonitoringMetricsRecorder } from '../../../interfaces';

export const resolveMonitoringMetricsRecorder = (
  value: unknown,
): IMonitoringMetricsRecorder | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const candidate = value as { recordOrderLatency?: unknown };
  return typeof candidate.recordOrderLatency === 'function'
    ? candidate as IMonitoringMetricsRecorder
    : undefined;
};
