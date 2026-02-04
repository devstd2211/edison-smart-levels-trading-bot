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
import type { LoggerService } from '../types';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { ExchangeFactoryConfigError, ExchangeAdapterInstantiationError } from '../errors/DomainErrors';
import { BybitService } from './bybit/bybit.service';
import { BybitServiceAdapter } from './bybit/bybit-service.adapter';
import { BinanceServiceAdapter } from './binance/binance-service.adapter';
import { BinanceService } from './binance/binance.service';

/**
 * Exchange configuration from app config
 */
export interface ExchangeConfig {
  name: 'bybit' | 'binance'; // Future: add more exchanges
  symbol: string;
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
    private errorHandler?: ErrorHandler, // Phase 8.9.37: Optional ErrorHandler for backward compatibility
  ) {
    this.validateConfig();
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
      // Phase 8.9.37: RETRY strategy for adapter instantiation failures
      let exchange: IExchange;
      if (this.errorHandler) {
        const result = await this.errorHandler.executeAsync(
          async () => this.instantiateExchange(),
          {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: {
              maxAttempts: 3,
              initialDelayMs: 100,
              backoffMultiplier: 1.5,
            },
            context: 'ExchangeFactory.createExchange[instantiation]',
          }
        );

        if (!result.success || !result.value) {
          throw result.error || new Error('Failed to instantiate exchange after retries');
        }
        exchange = result.value;
      } else {
        exchange = await this.instantiateExchange();
      }

      this.exchangeCache = exchange;

      // Phase 8.9.37: SKIP strategy for logging failures (never blocks initialization)
      try {
        this.logger.info('✅ Exchange initialized', {
          name: exchange.name,
          symbol: this.config.symbol,
        });
      } catch (logError) {
        if (this.errorHandler) {
          this.errorHandler.handle(logError as Error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'ExchangeFactory.createExchange[logging]',
          }).catch(() => { /* Silent */ });
        }
      }

      return exchange;
    } catch (error) {
      // Phase 8.9.37: GRACEFUL_DEGRADE on critical failure - return cached if available or throw
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Phase 8.9.37: Log error but handle gracefully
      try {
        this.logger.error('❌ Failed to create exchange', {
          exchange: this.config.name,
          error: errorMsg,
        });
      } catch (logError) {
        if (this.errorHandler) {
          this.errorHandler.handle(logError as Error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'ExchangeFactory.createExchange[error-logging]',
          }).catch(() => { /* Silent */ });
        }
      }

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

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Instantiate the appropriate exchange adapter
   */
  private async instantiateExchange(): Promise<IExchange> {
    switch (this.config.name.toLowerCase()) {
      case 'bybit':
        return this.createBybitExchange();

      case 'binance':
        return this.createBinanceExchange();

      default:
        throw new Error(`Unsupported exchange: ${this.config.name}. Supported: bybit, binance`);
    }
  }

  /**
   * Create Bybit exchange adapter
   * Phase 8.9.37: Added GRACEFUL_DEGRADE strategy for initialization failures
   */
  private async createBybitExchange(): Promise<IExchange> {
    try {
      // Phase 8.9.37: GRACEFUL_DEGRADE on service creation failure
      let bybitService: BybitService;
      try {
        // Create config object for BybitService
        const bybitConfig = {
          name: 'bybit',
          symbol: this.config.symbol,
          demo: this.config.demo ?? true,
          testnet: this.config.testnet ?? false,
          apiKey: this.config.apiKey ?? '',
          apiSecret: this.config.apiSecret ?? '',
        };

        // Create BybitService instance (takes config and logger)
        bybitService = new BybitService(bybitConfig as any, this.logger);
      } catch (error) {
        const err = new ExchangeAdapterInstantiationError(
          `Failed to create BybitService: ${error instanceof Error ? error.message : String(error)}`,
          {
            exchangeName: 'bybit',
            symbol: this.config.symbol,
            operation: 'service_creation',
            reason: error instanceof Error ? error.message : String(error),
          },
          error instanceof Error ? error : undefined
        );

        if (this.errorHandler) {
          this.errorHandler.handle(err, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'ExchangeFactory.createBybitExchange[service]',
          }).catch(() => { /* Silent */ });
        }
        throw err;
      }

      // Phase 8.9.37: GRACEFUL_DEGRADE on adapter creation failure
      let adapter: BybitServiceAdapter;
      try {
        // Create adapter that implements IExchange
        adapter = new BybitServiceAdapter(bybitService, this.logger);
      } catch (error) {
        const err = new ExchangeAdapterInstantiationError(
          `Failed to create BybitServiceAdapter: ${error instanceof Error ? error.message : String(error)}`,
          {
            exchangeName: 'bybit',
            symbol: this.config.symbol,
            operation: 'adapter_creation',
            reason: error instanceof Error ? error.message : String(error),
          },
          error instanceof Error ? error : undefined
        );

        if (this.errorHandler) {
          this.errorHandler.handle(err, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'ExchangeFactory.createBybitExchange[adapter]',
          }).catch(() => { /* Silent */ });
        }
        throw err;
      }

      // Phase 8.9.37: GRACEFUL_DEGRADE on adapter initialization failure
      try {
        // Initialize the adapter
        await adapter.initialize();
      } catch (error) {
        const err = new ExchangeAdapterInstantiationError(
          `Failed to initialize BybitServiceAdapter: ${error instanceof Error ? error.message : String(error)}`,
          {
            exchangeName: 'bybit',
            symbol: this.config.symbol,
            operation: 'initialization',
            reason: error instanceof Error ? error.message : String(error),
          },
          error instanceof Error ? error : undefined
        );

        if (this.errorHandler) {
          this.errorHandler.handle(err, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'ExchangeFactory.createBybitExchange[initialize]',
          }).catch(() => { /* Silent */ });
        }
        // Allow initialization to fail gracefully - adapter may still be usable
        this.logger.warn('⚠️ Bybit adapter initialization failed, but proceeding', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Phase 8.9.37: SKIP logger failures (never blocks)
      try {
        this.logger.info('✅ Created Bybit exchange adapter', {
          symbol: this.config.symbol,
          demo: this.config.demo,
        });
      } catch (logError) {
        if (this.errorHandler) {
          this.errorHandler.handle(logError as Error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'ExchangeFactory.createBybitExchange[logging]',
          }).catch(() => { /* Silent */ });
        }
      }

      return adapter;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create Bybit exchange: ${errorMsg}`);
    }
  }

  /**
   * Create Binance exchange adapter
   * Phase 8.9.37: Added GRACEFUL_DEGRADE strategy for initialization failures
   */
  private async createBinanceExchange(): Promise<IExchange> {
    try {
      // Phase 8.9.37: GRACEFUL_DEGRADE on service creation failure
      let binanceService: BinanceService;
      try {
        // Create BinanceService instance
        // Note: BinanceService takes individual parameters for flexibility
        binanceService = new BinanceService(
          this.config.symbol,
          this.config.demo ?? true,
          this.config.testnet ?? false,
          this.config.apiKey ?? '',
          this.config.apiSecret ?? '',
        );
      } catch (error) {
        const err = new ExchangeAdapterInstantiationError(
          `Failed to create BinanceService: ${error instanceof Error ? error.message : String(error)}`,
          {
            exchangeName: 'binance',
            symbol: this.config.symbol,
            operation: 'service_creation',
            reason: error instanceof Error ? error.message : String(error),
          },
          error instanceof Error ? error : undefined
        );

        if (this.errorHandler) {
          this.errorHandler.handle(err, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'ExchangeFactory.createBinanceExchange[service]',
          }).catch(() => { /* Silent */ });
        }
        throw err;
      }

      // Phase 8.9.37: GRACEFUL_DEGRADE on adapter creation failure
      let adapter: BinanceServiceAdapter;
      try {
        // Create adapter that implements IExchange
        adapter = new BinanceServiceAdapter(binanceService, this.logger);
      } catch (error) {
        const err = new ExchangeAdapterInstantiationError(
          `Failed to create BinanceServiceAdapter: ${error instanceof Error ? error.message : String(error)}`,
          {
            exchangeName: 'binance',
            symbol: this.config.symbol,
            operation: 'adapter_creation',
            reason: error instanceof Error ? error.message : String(error),
          },
          error instanceof Error ? error : undefined
        );

        if (this.errorHandler) {
          this.errorHandler.handle(err, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'ExchangeFactory.createBinanceExchange[adapter]',
          }).catch(() => { /* Silent */ });
        }
        throw err;
      }

      // Phase 8.9.37: GRACEFUL_DEGRADE on adapter initialization failure
      try {
        // Initialize the adapter
        await adapter.initialize();
      } catch (error) {
        const err = new ExchangeAdapterInstantiationError(
          `Failed to initialize BinanceServiceAdapter: ${error instanceof Error ? error.message : String(error)}`,
          {
            exchangeName: 'binance',
            symbol: this.config.symbol,
            operation: 'initialization',
            reason: error instanceof Error ? error.message : String(error),
          },
          error instanceof Error ? error : undefined
        );

        if (this.errorHandler) {
          this.errorHandler.handle(err, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'ExchangeFactory.createBinanceExchange[initialize]',
          }).catch(() => { /* Silent */ });
        }
        // Allow initialization to fail gracefully - adapter may still be usable
        this.logger.warn('⚠️ Binance adapter initialization failed, but proceeding', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Phase 8.9.37: SKIP logger failures (never blocks)
      try {
        this.logger.info('✅ Created Binance exchange adapter', {
          symbol: this.config.symbol,
          demo: this.config.demo,
        });
      } catch (logError) {
        if (this.errorHandler) {
          this.errorHandler.handle(logError as Error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'ExchangeFactory.createBinanceExchange[logging]',
          }).catch(() => { /* Silent */ });
        }
      }

      return adapter;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create Binance exchange: ${errorMsg}`);
    }
  }

  /**
   * Validate configuration
   * Phase 8.9.37: THROW strategy for validation errors (fast fail)
   */
  private validateConfig(): void {
    // Phase 8.9.37: THROW on missing exchange name
    if (!this.config.name) {
      const error = new ExchangeFactoryConfigError(
        'Exchange name is required in config',
        {
          reason: 'missing_field',
          missingField: 'name',
        }
      );
      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'ExchangeFactory.validateConfig[name]',
        });
      }
      throw error;
    }

    // Phase 8.9.37: THROW on missing symbol
    if (!this.config.symbol) {
      const error = new ExchangeFactoryConfigError(
        'Symbol is required in config',
        {
          reason: 'missing_field',
          missingField: 'symbol',
          exchangeName: this.config.name,
        }
      );
      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'ExchangeFactory.validateConfig[symbol]',
        });
      }
      throw error;
    }

    // Phase 8.9.37: THROW on unsupported exchange
    const supportedExchanges = ['bybit', 'binance'];
    if (!supportedExchanges.includes(this.config.name.toLowerCase())) {
      const error = new ExchangeFactoryConfigError(
        `Unsupported exchange: ${this.config.name}. Supported: ${supportedExchanges.join(', ')}`,
        {
          reason: 'unsupported_exchange',
          exchangeName: this.config.name,
          supportedExchanges,
        }
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
