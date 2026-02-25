export interface IMonitoringMetricsRecorder {
  recordOrderLatency(latencyMs: number, side: string, type?: string): void;
}
