/**
 * Exchange Factory Service - Phase 8.9.37
 *
 * Creates and manages exchange service instances based on configuration.
 * Supports multiple exchange implementations (Bybit, Binance, etc.)
 *
 * Usage:
 * const factory = new ExchangeFactory(logger, config, errorHandler);
 * const exchange = await factory.createExchange();
 *
 * Benefits:
 * - Single place to configure which exchange to use
 * - Easy to add new exchanges (create adapter + add to factory)
 * - Type-safe: returns IExchange interface
 * - Testable: can inject mock exchanges
 *
 * Phase 8.9.37: ErrorHandler Integration
 * - THROW strategy for configuration validation errors
 * - RETRY strategy for adapter instantiation failures (exponential backoff)
 * - GRACEFUL_DEGRADE strategy for initialization failures (fallback to cached instance)
 * - SKIP strategy for logging failures (never blocks factory operations)
 */

import type { IExchange } from '../interfaces/IExchange';
import type { ExchangeConfig as BybitExchangeConfig } from '../types/config/config';
import type { LoggerService } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  ExchangeFactoryConfigError,
  ExchangeAdapterInstantiationError,
} from '../errors/DomainErrors';
import { BybitService } from './bybit/bybit.service';
import { BybitServiceAdapter } from './bybit/bybit-service.adapter';
import { BinanceServiceAdapter } from './binance/binance-service.adapter';
import { BinanceService } from './binance/binance.service';
import { getErrorMessage, normalizeError } from '../utils/error.utils';

const DEFAULT_TIMEFRAME = '15';
const DEFAULT_DEMO_MODE = true;
const DEFAULT_TESTNET_MODE = false;
const EXCHANGE_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 100,
  backoffMultiplier: 1.5,
} as const;
const SUPPORTED_EXCHANGES = ['bybit', 'binance'] as const;

type SupportedExchangeName = ExchangeConfig['name'];
type ExchangeCreationStage = 'service_creation' | 'adapter_creation' | 'initialization';

interface ExchangeCreationDefinition<TService, TAdapter extends IExchange> {
  exchangeName: SupportedExchangeName;
  createService: () => TService;
  createAdapter: (service: TService) => TAdapter;
  createdLogMessage: string;
  initializationWarningMessage: string;
}

/**
 * Exchange configuration from app config
 */
export interface ExchangeConfig {
  name: 'bybit' | 'binance';
  symbol: string;
  timeframe?: string;
  demo?: boolean;
  testnet?: boolean;
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Factory for creating exchange service instances
 * Phase 8.9.37: Added ErrorHandler integration
 */
export class ExchangeFactory {
  private exchangeCache: IExchange | null = null;

  constructor(
    private logger: LoggerService,
    private config: ExchangeConfig,
    private errorHandler?: ErrorHandler,
  ) {
    this.validateConfig();
  }

  private handleSkipError(error: unknown, context: string): void {
    if (!this.errorHandler) {
      return;
    }

    this.errorHandler.handle(normalizeError(error), {
      strategy: RecoveryStrategy.SKIP,
      context,
    }).catch(() => { /* Silent */ });
  }

  private logInfoSafely(message: string, context?: Record<string, unknown>): void {
    try {
      this.logger.info(message, context);
    } catch (error) {
      this.handleSkipError(error, 'ExchangeFactory.logInfoSafely');
    }
  }

  private logWarnSafely(message: string, context?: Record<string, unknown>): void {
    try {
      this.logger.warn(message, context);
    } catch (error) {
      this.handleSkipError(error, 'ExchangeFactory.logWarnSafely');
    }
  }

  private logErrorSafely(message: string, context?: Record<string, unknown>): void {
    try {
      this.logger.error(message, context);
    } catch (error) {
      this.handleSkipError(error, 'ExchangeFactory.logErrorSafely');
    }
  }

  /**
   * Create exchange service instance
   * Returns cached instance if already created
   * Phase 8.9.37: Added error handling with RETRY + GRACEFUL_DEGRADE strategies
   */
  async createExchange(): Promise<IExchange> {
    if (this.exchangeCache) {
      return this.exchangeCache;
    }

    try {
      let exchange: IExchange;

      if (this.errorHandler) {
        const result = await this.errorHandler.executeAsync(
          async () => this.instantiateExchange(),
          {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: EXCHANGE_RETRY_CONFIG,
            context: 'ExchangeFactory.createExchange[instantiation]',
          },
        );

        if (!result.success || !result.value) {
          throw result.error || new Error('Failed to instantiate exchange after retries');
        }

        exchange = result.value;
      } else {
        exchange = await this.instantiateExchange();
      }

      this.exchangeCache = exchange;
      this.logInfoSafely('âœ… Exchange initialized', {
        name: exchange.name,
        symbol: this.config.symbol,
      });

      return exchange;
    } catch (error) {
      this.logErrorSafely('âŒ Failed to create exchange', {
        exchange: this.config.name,
        error: getErrorMessage(error),
      });

      throw error;
    }
  }

  /**
   * Get cached exchange instance
   * Returns null if not yet initialized
   */
  getExchange(): IExchange | null {
    return this.exchangeCache;
  }

  /**
   * Clear cache and reset exchange
   * Useful for testing or switching exchanges
   */
  reset(): void {
    this.exchangeCache = null;
  }

  /**
   * Get exchange name
   */
  getExchangeName(): string {
    return this.config.name;
  }

  /**
   * Get symbol
   */
  getSymbol(): string {
    return this.config.symbol;
  }

  private async instantiateExchange(): Promise<IExchange> {
    switch (this.getNormalizedExchangeName()) {
      case 'bybit':
        return this.createBybitExchange();
      case 'binance':
        return this.createBinanceExchange();
      default:
        throw new Error(`Unsupported exchange: ${this.config.name}. Supported: bybit, binance`);
    }
  }

  private getNormalizedExchangeName(): SupportedExchangeName {
    return this.config.name.toLowerCase() as SupportedExchangeName;
  }

  private async createBybitExchange(): Promise<IExchange> {
    return this.createExchangeAdapter({
      exchangeName: 'bybit',
      createService: () => new BybitService(this.buildBybitConfig(), this.logger),
      createAdapter: (service) => new BybitServiceAdapter(service, this.logger),
      createdLogMessage: 'âœ… Created Bybit exchange adapter',
      initializationWarningMessage: 'âš ï¸ Bybit adapter initialization failed, but proceeding',
    });
  }

  private async createBinanceExchange(): Promise<IExchange> {
    return this.createExchangeAdapter({
      exchangeName: 'binance',
      createService: () =>
        new BinanceService(
          this.config.symbol,
          this.config.demo ?? DEFAULT_DEMO_MODE,
          this.config.testnet ?? DEFAULT_TESTNET_MODE,
          this.config.apiKey ?? '',
          this.config.apiSecret ?? '',
        ),
      createAdapter: (service) => new BinanceServiceAdapter(service, this.logger),
      createdLogMessage: 'âœ… Created Binance exchange adapter',
      initializationWarningMessage: 'âš ï¸ Binance adapter initialization failed, but proceeding',
    });
  }

  private buildBybitConfig(): BybitExchangeConfig {
    return {
      name: 'bybit',
      symbol: this.config.symbol,
      timeframe: this.config.timeframe ?? DEFAULT_TIMEFRAME,
      demo: this.config.demo ?? DEFAULT_DEMO_MODE,
      testnet: this.config.testnet ?? DEFAULT_TESTNET_MODE,
      apiKey: this.config.apiKey ?? '',
      apiSecret: this.config.apiSecret ?? '',
    };
  }

  private async createExchangeAdapter<TService, TAdapter extends IExchange>(
    definition: ExchangeCreationDefinition<TService, TAdapter>,
  ): Promise<IExchange> {
    try {
      const service = this.createComponent(
        definition.exchangeName,
        'service_creation',
        definition.createService,
      );
      const adapter = this.createComponent(
        definition.exchangeName,
        'adapter_creation',
        () => definition.createAdapter(service),
      );

      await this.initializeExchangeAdapter(
        definition.exchangeName,
        adapter,
        definition.initializationWarningMessage,
      );

      this.logInfoSafely(definition.createdLogMessage, {
        symbol: this.config.symbol,
        demo: this.config.demo,
      });

      return adapter;
    } catch (error) {
      const exchangeLabel =
        definition.exchangeName.charAt(0).toUpperCase() + definition.exchangeName.slice(1);
      throw new Error(`Failed to create ${exchangeLabel} exchange: ${getErrorMessage(error)}`);
    }
  }

  private createComponent<T>(
    exchangeName: SupportedExchangeName,
    operation: Extract<ExchangeCreationStage, 'service_creation' | 'adapter_creation'>,
    factory: () => T,
  ): T {
    try {
      return factory();
    } catch (error) {
      const wrappedError = this.createInstantiationError(exchangeName, operation, error);
      this.reportGracefulDegrade(exchangeName, operation, wrappedError);
      throw wrappedError;
    }
  }

  private async initializeExchangeAdapter(
    exchangeName: SupportedExchangeName,
    adapter: IExchange,
    warningMessage: string,
  ): Promise<void> {
    try {
      if (adapter.initialize) {
        await adapter.initialize();
      }
    } catch (error) {
      const wrappedError = this.createInstantiationError(exchangeName, 'initialization', error);
      this.reportGracefulDegrade(exchangeName, 'initialization', wrappedError);
      this.logWarnSafely(warningMessage, {
        error: getErrorMessage(error),
      });
    }
  }

  private createInstantiationError(
    exchangeName: SupportedExchangeName,
    operation: ExchangeCreationStage,
    error: unknown,
  ): ExchangeAdapterInstantiationError {
    const errorMessage = getErrorMessage(error);

    return new ExchangeAdapterInstantiationError(
      `Failed to ${operation === 'initialization' ? 'initialize' : 'create'} ${this.getInstantiationTargetName(exchangeName, operation)}: ${errorMessage}`,
      {
        exchangeName,
        symbol: this.config.symbol,
        operation,
        reason: errorMessage,
      },
      normalizeError(error),
    );
  }

  private getInstantiationTargetName(
    exchangeName: SupportedExchangeName,
    operation: ExchangeCreationStage,
  ): string {
    if (operation === 'service_creation') {
      return exchangeName === 'bybit' ? 'BybitService' : 'BinanceService';
    }

    return exchangeName === 'bybit' ? 'BybitServiceAdapter' : 'BinanceServiceAdapter';
  }

  private reportGracefulDegrade(
    exchangeName: SupportedExchangeName,
    operation: ExchangeCreationStage,
    error: ExchangeAdapterInstantiationError,
  ): void {
    if (!this.errorHandler) {
      return;
    }

    this.errorHandler.handle(error, {
      strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
      context: this.getErrorHandlerContext(exchangeName, operation),
    }).catch(() => { /* Silent */ });
  }

  private getErrorHandlerContext(
    exchangeName: SupportedExchangeName,
    operation: ExchangeCreationStage,
  ): string {
    if (exchangeName === 'bybit') {
      switch (operation) {
        case 'service_creation':
          return 'ExchangeFactory.createBybitExchange[service]';
        case 'adapter_creation':
          return 'ExchangeFactory.createBybitExchange[adapter]';
        case 'initialization':
          return 'ExchangeFactory.createBybitExchange[initialize]';
      }
    }

    switch (operation) {
      case 'service_creation':
        return 'ExchangeFactory.createBinanceExchange[service]';
      case 'adapter_creation':
        return 'ExchangeFactory.createBinanceExchange[adapter]';
      case 'initialization':
        return 'ExchangeFactory.createBinanceExchange[initialize]';
    }
  }

  /**
   * Validate configuration
   * Phase 8.9.37: THROW strategy for validation errors (fast fail)
   */
  private validateConfig(): void {
    if (!this.config.name) {
      const error = new ExchangeFactoryConfigError(
        'Exchange name is required in config',
        {
          reason: 'missing_field',
          missingField: 'name',
        },
      );

      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'ExchangeFactory.validateConfig[name]',
        });
      }

      throw error;
    }

    if (!this.config.symbol) {
      const error = new ExchangeFactoryConfigError(
        'Symbol is required in config',
        {
          reason: 'missing_field',
          missingField: 'symbol',
          exchangeName: this.config.name,
        },
      );

      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'ExchangeFactory.validateConfig[symbol]',
        });
      }

      throw error;
    }

    if (!SUPPORTED_EXCHANGES.includes(this.getNormalizedExchangeName())) {
      const error = new ExchangeFactoryConfigError(
        `Unsupported exchange: ${this.config.name}. Supported: ${SUPPORTED_EXCHANGES.join(', ')}`,
        {
          reason: 'unsupported_exchange',
          exchangeName: this.config.name,
          supportedExchanges: [...SUPPORTED_EXCHANGES],
        },
      );

      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'ExchangeFactory.validateConfig[unsupported]',
        });
      }

      throw error;
    }
  }
}
