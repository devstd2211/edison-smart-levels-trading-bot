import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  MetricsConfig,
  PrometheusMetricsService,
} from '../../services/prometheus-metrics.service';
import { LoggerService } from '../../types/legacy';

export interface PrometheusMetricsHarness {
  logger: LoggerService;
  errorHandler: ErrorHandler;
  createService: (
    config?: MetricsConfig,
    logger?: LoggerService,
    handler?: ErrorHandler,
  ) => PrometheusMetricsService;
  createTrackedService: (
    trackedServices: PrometheusMetricsService[],
    config?: MetricsConfig,
    logger?: LoggerService,
    handler?: ErrorHandler,
  ) => PrometheusMetricsService;
  stopTrackedServices: (trackedServices: PrometheusMetricsService[]) => void;
}

export function createPrometheusMetricsLogger(): LoggerService {
  const logger = new LoggerService('ERROR', './logs', false);
  jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
  return logger;
}

export function createPrometheusMetricsHarness(): PrometheusMetricsHarness {
  const logger = createPrometheusMetricsLogger();
  const errorHandler = new ErrorHandler(logger);
  const createService = (
    config: MetricsConfig = {},
    serviceLogger: LoggerService | undefined = logger,
    handler: ErrorHandler | undefined = errorHandler,
  ): PrometheusMetricsService => new PrometheusMetricsService(config, serviceLogger, handler);

  return {
    logger,
    errorHandler,
    createService,
    createTrackedService(
      trackedServices: PrometheusMetricsService[],
      config: MetricsConfig = {},
      serviceLogger: LoggerService | undefined = logger,
      handler: ErrorHandler | undefined = errorHandler,
    ): PrometheusMetricsService {
      const metricsService = createService(config, serviceLogger, handler);
      trackedServices.push(metricsService);
      return metricsService;
    },
    stopTrackedServices(trackedServices: PrometheusMetricsService[]): void {
      trackedServices.forEach((metricsService) => {
        metricsService.stop();
      });
    },
  };
}
