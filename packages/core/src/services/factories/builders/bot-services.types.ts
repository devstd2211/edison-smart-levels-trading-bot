import type { SizingConfig } from '../../dynamic-position-sizer.service';
import type { ScalingConfig } from '../../position-scaling.service';
import type { SmartOrderConfig } from '../../smart-order-execution.service';
import type { HealthCheckConfig } from '../../health-check.service';
import type { MonitoringServerConfig } from '../../monitoring-server.service';
import type { BulkheadConfig } from '../../resilience/bulkhead.service';
import type { CircuitBreakerConfig } from '../../resilience/circuit-breaker.service';
import type { RateLimiterConfig } from '../../resilience/rate-limiter.service';
import type { RetryPolicyConfig } from '../../resilience/retry-policy.service';

export type DashboardConfig = {
  enabled?: boolean;
  updateInterval?: number;
  theme?: 'dark' | 'light';
};

export type StrategyMeta = {
  strategy?: string;
  strategyFile?: string;
  notes?: string;
};

export type AnalyzerConfig = {
  enabled?: boolean;
  name?: string;
  weight?: number;
  priority?: number;
};

export type IndicatorConfigParams = {
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  kPeriod?: number;
  dPeriod?: number;
  stdDev?: number;
};

export type DynamicPositionSizingConfig = SizingConfig & { enabled?: boolean };
export type PositionScalingConfig = ScalingConfig & { enabled?: boolean };
export type SmartOrderExecutionConfig = SmartOrderConfig & { enabled?: boolean };

export type OrderStateMachineConfig = {
  enabled?: boolean;
  [key: string]: unknown;
};

export type MonitoringConfig = {
  metricsEnabled?: boolean;
  metricsPrefix?: string;
  collectInterval?: number;
  defaultLabels?: Record<string, string>;
  healthCheckEnabled?: boolean;
  thresholds?: {
    memoryUsagePercent?: number;
    cpuUsagePercent?: number;
    diskUsagePercent?: number;
  };
  serverEnabled?: boolean;
  port?: number;
  metricsPath?: string;
  healthPath?: string;
  cors?: boolean;
};

export type ResilienceConfig = {
  enabled?: boolean;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  rateLimiter?: {
    bybit?: Partial<RateLimiterConfig>;
    [key: string]: Partial<RateLimiterConfig> | undefined;
  };
  retry?: Partial<RetryPolicyConfig>;
  bulkhead?: {
    trading?: Partial<BulkheadConfig>;
    [key: string]: Partial<BulkheadConfig> | undefined;
  };
};

export type MultiStrategyConfig = {
  enabled?: boolean;
};

export type MonitoringThresholdsConfig = NonNullable<HealthCheckConfig['thresholds']>;
export type MonitoringHealthCheckBuilderConfig = Required<
  Pick<HealthCheckConfig, 'enabled' | 'thresholds'>
>;
export type MonitoringServerBuilderConfig = Required<
  Pick<MonitoringServerConfig, 'enabled' | 'port' | 'metricsPath' | 'healthPath' | 'cors'>
>;
