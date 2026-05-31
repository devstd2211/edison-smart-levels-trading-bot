import type { ErrorHandler } from '../../errors/ErrorHandler';
import type { ICoreServices } from '../../interfaces';
import type { IExchange } from '../../interfaces/IExchange';

export interface BotFactoryLoggerOverride {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export type BotFactoryTelegramOverride = Pick<
  ICoreServices['telegram'],
  'notifyBotStarted' | 'notifyBotStopped'
>;

export interface BotFactoryCoreOverrides {
  telegram?: BotFactoryTelegramOverride;
  logger?: BotFactoryLoggerOverride;
}

export interface BotFactoryRuntimeOverrides {
  bybitService?: IExchange;
  errorHandler?: ErrorHandler;
}

/**
 * Public override contract for composition-root service creation.
 * Keeps external callers on the narrowed adapter boundary.
 */
export interface BotFactoryOptions extends BotFactoryCoreOverrides, BotFactoryRuntimeOverrides {}

export const partitionBotFactoryOptions = (
  options: BotFactoryOptions,
): {
  core: BotFactoryCoreOverrides;
  runtime: BotFactoryRuntimeOverrides;
} => ({
  core: {
    telegram: options.telegram,
    logger: options.logger,
  },
  runtime: {
    bybitService: options.bybitService,
    errorHandler: options.errorHandler,
  },
});
