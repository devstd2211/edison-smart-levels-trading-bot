import { EventDeduplicationService } from '../../services/event-deduplication.service';
import { LoggerService, LogLevel } from '../../types/legacy';

export interface EventDeduplicationHarness {
  logger: LoggerService;
  createService: (cacheSize?: number, cacheTtlMs?: number, logger?: LoggerService) => EventDeduplicationService;
}

export function createEventDeduplicationLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createEventDeduplicationHarness(): EventDeduplicationHarness {
  const logger = createEventDeduplicationLogger();

  return {
    logger,
    createService: (
      cacheSize: number = 100,
      cacheTtlMs: number = 60000,
      customLogger: LoggerService = logger,
    ) => new EventDeduplicationService(cacheSize, cacheTtlMs, customLogger),
  };
}
