/**
 * BotFactory - Dependency Injection Container
 *
 * Phase 5: Dependency Injection Enhancement
 * Phase 8.9.41: ErrorHandler Integration for config validation & service creation
 *
 * Manages creation and configuration of BotServices state with proper DI and error handling.
 *
 * Error Handling Strategies:
 * - THROW: Config validation errors (missing/invalid required fields)
 * - GRACEFUL_DEGRADE: Service creation failures (continue with degraded features)
 * - SKIP: Logging failures during initialization (non-critical)
 *
 * Benefits:
 * - Single source of truth for service creation
 * - Easy to swap implementations for testing
 * - Clear dependency graph
 * - Supports partial override for testing
 * - Robust error handling with fallbacks
 *
 * Usage:
 *   // Production
 *   const services = BotFactory.create(config);
 *
 *   // Testing with mocks
 *   const services = BotFactory.create(config, {
 *     bybitService: mockExchange,
 *     telegram: mockTelegram,
 *   });
 */

import { LoggerService } from './logger.service';
import { Config } from '../types/legacy';
import { buildBotServices, type BotServicesState } from './bot-services.builder';
import { IExchange } from '../interfaces/IExchange';
import { ErrorHandler } from '../errors/ErrorHandler';
import type { IBotServicesAdapterSource } from '../interfaces';
import {
  BotFactoryInitializationError,
} from '../errors/DomainErrors';
import { applyBotServiceOverrides } from './factories/bot-services.overrides';
import { validateBotConfig } from './factories/bot-services.validate';

/**
 * Factory options for partial DI overrides
 * Allows tests to inject specific mock services
 */
export interface BotFactoryOptions {
  // Exchange service (for testing with mock exchange)
  bybitService?: IExchange;

  // Notification service (for testing without sending messages)
  telegram?: any;

  // Logger (for testing with custom logger)
  logger?: LoggerService;

  // ErrorHandler for error recovery (optional, will create if not provided)
  errorHandler?: ErrorHandler;

  // Add more as needed for other services
}

/**
 * BotFactory - Creates BotServices state with dependency injection
 */
export class BotFactory {
  /**
   * Validate bot configuration
   *
   * Phase 8.9.41: Config validation with THROW strategy
   * Required fields:
   * - exchange: { name, symbol, apiKey, apiSecret }
   * - trading: { leverage, marginType }
   * - riskManagement: { stopLossPercent, takeProfits, positionSizeUsdt }
   * - logging: { level, logDir }
   * - timeframes: { entry, primary } with intervals
   * - indicators: {} object (can be empty but must exist)
   *
   * @param config - Configuration to validate
   * @throws BotFactoryConfigValidationError - For missing or invalid fields
   */
  private static validateConfig(config: Config): void {
    validateBotConfig(config);
  }

  /**
   * Create BotServices state with optional DI overrides
   *
   * Phase 8.9.41: Service creation (backward compatible - no automatic validation)
   * For validation and error handling, use createWithValidation() instead.
   *
   * @param config - Bot configuration
   * @param options - Optional overrides for testing
   * @returns Initialized services state
   */
  static create(
    config: Config,
    options: BotFactoryOptions = {},
  ): IBotServicesAdapterSource {
    // Create services normally
    const services = buildBotServices(config);

    // Apply any test overrides (SKIP strategy - non-blocking)
    applyBotServiceOverrides(services, options);

    return services;
  }

  /**
   * Create BotServices state with config validation and error handling
   *
   * Phase 8.9.41: Service creation with strict validation
   * Strategies:
   * - THROW: For config validation errors (fail fast)
   * - THROW: For service initialization errors (fail fast on critical issues)
   * - SKIP: For logging failures (non-critical)
   *
   * Use this method when you need production-grade error handling and validation.
   *
   * @param config - Bot configuration
   * @param options - Optional overrides for testing
   * @param logger - Optional logger instance (for error reporting before BotServices init)
   * @returns Initialized services state
   * @throws BotFactoryConfigValidationError - When config is invalid
   * @throws BotFactoryInitializationError - When service initialization fails critically
   */
  static createWithValidation(
    config: Config,
    options: BotFactoryOptions = {},
    logger?: LoggerService,
  ): IBotServicesAdapterSource {
    // THROW: Validate config first (fail fast on invalid config)
    try {
      this.validateConfig(config);
    } catch (err) {
      if (logger) {
        logger.error('❌ Config validation failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }

    // THROW: Try to create BotServices
    let services: BotServicesState;
    try {
      services = buildBotServices(config);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown initialization error';
      if (logger) {
        logger.error('❌ BotServices initialization failed', {
          error: errorMsg,
          stack: err instanceof Error ? err.stack : undefined,
        });
      }

      throw new BotFactoryInitializationError(
        `Failed to initialize BotServices: ${errorMsg}`,
        { originalError: errorMsg },
      );
    }

    // SKIP: Apply test overrides (logging failures don't block)
    try {
      applyBotServiceOverrides(services, options);
    } catch (err) {
      // SKIP: Log but don't throw (DI overrides are non-critical)
      if (logger) {
        logger.warn('⚠️ Could not apply all DI overrides', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      // Continue anyway - overrides are optional
    }

    return services;
  }

  /**
   * Create minimal BotServices state for testing
   * Useful for unit tests that need basic functionality
   *
   * Phase 8.9.41: Testing helper with error handling
   * Validates config before creation for safety
   *
   * @param config - Bot configuration
   * @param mockServices - Mock implementations
   * @returns Minimal services state for testing
   * @throws BotFactoryConfigValidationError - When config is invalid
   * @throws BotFactoryInitializationError - When initialization fails
   */
  static createForTesting(
    config: Config,
    mockServices: BotFactoryOptions = {},
  ): IBotServicesAdapterSource {
    // Use createWithValidation to ensure config is valid for testing
    return this.createWithValidation(config, mockServices);
  }

  /**
   * Create with async error handling (non-throwing variant)
   *
   * Phase 8.9.41: Result-based API for callers that prefer Result<T> pattern
   * Returns success/failure result instead of throwing
   * Uses createWithValidation internally for validation
   *
   * @param config - Bot configuration
   * @param options - Optional DI overrides
   * @param logger - Optional logger for error reporting
   * @returns { success: true, services } | { success: false, error }
   */
  static createSafe(
    config: Config,
    options: BotFactoryOptions = {},
    logger?: LoggerService,
  ): { success: true; services: IBotServicesAdapterSource } | { success: false; error: Error } {
    try {
      const services = this.createWithValidation(config, options, logger);
      return { success: true, services };
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error(String(err));
      return { success: false, error };
    }
  }
}

