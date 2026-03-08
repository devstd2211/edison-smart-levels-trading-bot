import { IndicatorType } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy, ErrorLogger } from '../errors/ErrorHandler';
import { LoggerService } from './logger.service';

/**
 * Indicator Registry Service
 *
 * Responsibility:
 * - Register all available indicator types
 * - Provide metadata about registered indicators
 * - NO dependencies on actual indicator implementations
 *
 * Design:
 * - Pure registry (only IIndicatorMetadata)
 * - IndicatorLoader handles actual loading
 * - Analyzers only need to know about IIndicator interface
 *
 * SOLID:
 * - This service depends ONLY on types, not on implementations
 * - Follows Interface Segregation Principle
 * - Open/Closed: new indicator? Just add registration, no code change
 */

export interface IIndicatorMetadata {
  type: IndicatorType; // Using enum, not string!
  name: string; // 'Exponential Moving Average'
  description: string;
  enabled: boolean;
}

export class IndicatorRegistry {
  private static readonly defaultErrorLogger: ErrorLogger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  private registered = new Map<IndicatorType, IIndicatorMetadata>();
  private errorHandler: ErrorHandler;
  private logger?: LoggerService;

  constructor(logger?: LoggerService, errorHandler?: ErrorHandler) {
    this.logger = logger;
    this.errorHandler =
      errorHandler ?? new ErrorHandler((logger as ErrorLogger | undefined) ?? IndicatorRegistry.defaultErrorLogger);
  }

  /**
   * Safe logging wrapper - SKIP strategy for all logger errors
   */
  private safeLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (!this.logger) return;
    try {
      this.logger[level](message, data);
    } catch (error) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
    }
  }

  /**
   * Register an indicator type
   * THROW: On invalid type or duplicate registration
   * Called during bot initialization
   *
   * @param type Indicator type (IndicatorType enum)
   * @param metadata Indicator metadata
   */
  register(type: IndicatorType, metadata: IIndicatorMetadata): void {
    // THROW: Validate type is not null/undefined
    if (!type) {
      void this.errorHandler.handle(
        new Error('Indicator type cannot be null or undefined'),
        { strategy: RecoveryStrategy.THROW }
      );
      return;
    }

    // THROW: Validate metadata
    if (!metadata || !metadata.name) {
      void this.errorHandler.handle(
        new Error(`Invalid indicator metadata for type ${type}`),
        { strategy: RecoveryStrategy.THROW }
      );
      return;
    }

    // THROW: Check for duplicate registration
    if (this.registered.has(type)) {
      void this.errorHandler.handle(
        new Error(`Indicator type ${type} is already registered`),
        { strategy: RecoveryStrategy.THROW }
      );
      return;
    }

    this.registered.set(type, metadata);
    this.safeLog('debug', `Registered indicator: ${type}`, { name: metadata.name });
  }

  /**
   * Check if indicator type is registered
   * SKIP: Logging failures
   *
   * @param type Indicator type
   * @returns true if registered, false otherwise
   */
  isRegistered(type: IndicatorType): boolean {
    try {
      return this.registered.has(type);
    } catch (error) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      return false;
    }
  }

  /**
   * Get metadata for indicator type
   * GRACEFUL_DEGRADE: Return null for unregistered indicators (continue operation)
   *
   * @param type Indicator type
   * @returns Metadata or null if not registered
   */
  getMetadata(type: IndicatorType): IIndicatorMetadata | null {
    try {
      if (!type) {
        this.safeLog('warn', 'Attempted to get metadata for null/undefined indicator type');
        return null;
      }

      const metadata = this.registered.get(type);
      if (!metadata) {
        this.safeLog('debug', `Indicator type ${type} not registered`, {
          availableTypes: Array.from(this.registered.keys()),
        });
        // GRACEFUL_DEGRADE: Return null instead of throwing
        return null;
      }

      return metadata;
    } catch (error) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      return null;
    }
  }

  /**
   * Get all registered indicator types
   * SKIP: Logging failures
   *
   * @returns Array of type names (IndicatorType enum values)
   */
  getAll(): IndicatorType[] {
    try {
      const all = Array.from(this.registered.keys());
      this.safeLog('debug', `Retrieved all registered indicators`, { count: all.length });
      return all;
    } catch (error) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      return [];
    }
  }

  /**
   * Get only enabled indicators
   * SKIP: Logging failures
   *
   * @returns Array of enabled type names
   */
  getEnabled(): IndicatorType[] {
    try {
      const enabled = Array.from(this.registered.values())
        .filter(meta => meta.enabled)
        .map(meta => meta.type);
      this.safeLog('debug', `Retrieved enabled indicators`, { count: enabled.length });
      return enabled;
    } catch (error) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      return [];
    }
  }

  /**
   * Get indicator count
   * SKIP: Logging failures
   *
   * @returns Total registered count
   */
  getCount(): number {
    try {
      return this.registered.size;
    } catch (error) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      return 0;
    }
  }

  /**
   * Clear all registrations (for testing)
   * SKIP: Logging failures
   */
  clear(): void {
    try {
      this.registered.clear();
      this.safeLog('debug', 'Indicator registry cleared');
    } catch (error) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
    }
  }
}

