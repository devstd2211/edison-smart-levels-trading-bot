import type { ErrorHandler } from '../../errors/ErrorHandler';
import type { IBotServicesAdapterSource } from '../../interfaces';
import type { IExchange } from '../../interfaces/IExchange';

/**
 * Public override contract for composition-root service creation.
 * Keeps external callers on the narrowed adapter boundary.
 */
export interface BotFactoryOptions {
  bybitService?: IExchange;
  telegram?: IBotServicesAdapterSource['coreServices']['telegram'];
  logger?: IBotServicesAdapterSource['coreServices']['logger'];
  errorHandler?: ErrorHandler;
}
