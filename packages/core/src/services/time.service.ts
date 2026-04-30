/**
 * Time Service
 * Synchronization with exchange server time
 *
 * Responsibilities:
 * - Time offset calculation and management
 * - Periodic synchronization with exchange
 * - Time conversion (local <-> server)
 * - Sync health monitoring
 * - Error handling with RETRY strategy for network failures
 */

import { LoggerService } from './logger.service';
import type { IExchange } from '../interfaces/IExchange';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { TimeSyncError } from '../errors/DomainErrors';
import { getErrorMessage } from '../utils/error.utils';

/**
 * Sync info return type
 */
interface SyncInfo {
  offset: number;
  lastSync: Date;
  isRecent: boolean;
  nextSyncIn: number;
}

interface TimeSyncSnapshot {
  serverTime: number;
  localTimeAfter: number;
  networkLatency: number;
}

const DEFAULT_MAX_SYNC_FAILURES = 3;
const NETWORK_LATENCY_DIVISOR = 2;
const RETRY_ATTEMPTS = 3;
const RETRY_INITIAL_DELAY_MS = 100;
const RETRY_BACKOFF_MULTIPLIER = 2;
const RETRY_MAX_DELAY_MS = 800;

/**
 * TimeService - Synchronization with exchange server time
 * Phase 8.9.42: ErrorHandler integration with RETRY strategy
 */
export class TimeService {
  private readonly logger: LoggerService;
  private readonly syncInterval: number;
  private readonly maxSyncFailures: number;
  private bybitService?: IExchange;
  private readonly errorHandler: ErrorHandler;

  private timeOffset = 0;
  private lastSyncTime = 0;
  private criticalSyncFailures = 0;

  constructor(
    logger: LoggerService,
    syncIntervalMs: number,
    maxSyncFailures: number = DEFAULT_MAX_SYNC_FAILURES,
    errorHandler?: ErrorHandler,
  ) {
    this.validateSyncInterval(syncIntervalMs);

    this.logger = logger;
    this.syncInterval = syncIntervalMs;
    this.maxSyncFailures = maxSyncFailures;
    this.errorHandler = errorHandler || new ErrorHandler(logger);
  }

  /**
   * Set Bybit service for time synchronization
   */
  public setBybitService(bybitService: IExchange): void {
    this.bybitService = bybitService;
  }

  /**
   * Synchronize time with exchange server with RETRY strategy
   * Phase 8.9.42: Uses ErrorHandler with RETRY (3x) + GRACEFUL_DEGRADE
   */
  public async syncWithExchange(): Promise<void> {
    if (!this.bybitService) {
      this.warnMissingExchange();
      return;
    }

    const result = await this.errorHandler.executeAsync(
      () => this.performSyncAttempt(),
      {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: {
          maxAttempts: RETRY_ATTEMPTS,
          initialDelayMs: RETRY_INITIAL_DELAY_MS,
          backoffMultiplier: RETRY_BACKOFF_MULTIPLIER,
          maxDelayMs: RETRY_MAX_DELAY_MS,
        },
        context: 'TimeService.syncWithExchange',
      },
    );

    if (!result.success) {
      this.handleFailedSync(result.error);
    }
  }

  /**
   * Ensure time is synchronized (auto-sync if needed)
   */
  public async ensureSync(): Promise<void> {
    const now = Date.now();

    if (this.shouldSync(now)) {
      await this.syncWithExchange();
    }
  }

  /**
   * Get current timestamp synchronized with exchange
   */
  public now(): number {
    return Date.now() + this.timeOffset;
  }

  /**
   * Get Date object synchronized with exchange
   */
  public nowDate(): Date {
    return new Date(this.now());
  }

  /**
   * Convert local timestamp to server time
   */
  public toServerTime(localTimestamp: number): number {
    return localTimestamp + this.timeOffset;
  }

  /**
   * Convert server timestamp to local time
   */
  public toLocalTime(serverTimestamp: number): number {
    return serverTimestamp - this.timeOffset;
  }

  /**
   * Check if sync is recent (within sync interval)
   */
  public isSyncRecent(): boolean {
    return Date.now() - this.lastSyncTime < this.syncInterval;
  }

  /**
   * Get synchronization information
   */
  public getSyncInfo(): SyncInfo {
    const now = Date.now();
    const nextSyncIn = Math.max(
      0,
      this.syncInterval - (now - this.lastSyncTime),
    );

    return {
      offset: this.timeOffset,
      lastSync: new Date(this.lastSyncTime),
      isRecent: this.isSyncRecent(),
      nextSyncIn,
    };
  }

  /**
   * Get today's date string (for logging filenames)
   */
  public getTodayString(): string {
    const dateStr = this.nowDate().toISOString().split('T')[0];
    if (!dateStr) {
      throw new Error('Failed to get date string');
    }
    return dateStr;
  }

  /**
   * Get bot uptime (for trading statistics)
   */
  public getUptime(startTime: number): number {
    return this.now() - startTime;
  }

  private validateSyncInterval(syncIntervalMs: number): void {
    if (!syncIntervalMs || syncIntervalMs <= 0) {
      throw new Error(
        'TimeService: syncIntervalMs is required and must be positive',
      );
    }
  }

  private warnMissingExchange(): void {
    this.logWarnSafely('Bybit service not set for time sync');
  }

  private async performSyncAttempt(): Promise<void> {
    const snapshot = await this.captureSyncSnapshot();
    this.applySyncSnapshot(snapshot);
    this.logSyncSuccess(snapshot);
  }

  private async captureSyncSnapshot(): Promise<TimeSyncSnapshot> {
    const localTimeBefore = Date.now();
    const serverTime = await this.readServerTime();
    const localTimeAfter = Date.now();

    return {
      serverTime,
      localTimeAfter,
      networkLatency:
        (localTimeAfter - localTimeBefore) / NETWORK_LATENCY_DIVISOR,
    };
  }

  private async readServerTime(): Promise<number> {
    const serverTime = await this.bybitService!.getServerTime();

    if (serverTime === undefined) {
      throw new TimeSyncError('Server time is undefined', {
        reason: 'API returned undefined serverTime',
        failureCount: this.criticalSyncFailures,
        maxAttempts: this.maxSyncFailures,
        lastKnownOffset: this.timeOffset,
      });
    }

    return serverTime;
  }

  private applySyncSnapshot(snapshot: TimeSyncSnapshot): void {
    this.timeOffset = snapshot.serverTime - snapshot.localTimeAfter;
    this.lastSyncTime = snapshot.localTimeAfter;
    this.criticalSyncFailures = 0;
  }

  private logSyncSuccess(snapshot: TimeSyncSnapshot): void {
    this.logInfoSafely('Time synchronized with Bybit', {
      serverTime: new Date(snapshot.serverTime).toISOString(),
      localTime: new Date(snapshot.localTimeAfter).toISOString(),
      offset: this.timeOffset,
      latency: snapshot.networkLatency,
    });
  }

  private handleFailedSync(error?: unknown): void {
    this.criticalSyncFailures += 1;

    if (error) {
      this.logErrorSafely('Failed to sync time with exchange', {
        error: getErrorMessage(error),
        failureCount: this.criticalSyncFailures,
        maxAllowed: this.maxSyncFailures,
      });
    }

    if (this.criticalSyncFailures >= this.maxSyncFailures) {
      this.logWarnSafely('Time sync failed, continuing with local time', {
        failureCount: this.criticalSyncFailures,
        note: 'Demo trading can continue without precise time sync',
      });
    }

    this.logWarnSafely(`Using last known time offset: ${this.timeOffset}ms`);
  }

  private shouldSync(now: number): boolean {
    return this.lastSyncTime === 0 || now - this.lastSyncTime > this.syncInterval;
  }

  private logInfoSafely(
    message: string,
    context?: Record<string, unknown>,
  ): void {
    try {
      this.logger.info(message, context);
    } catch {
      // Ignore logging failures
    }
  }

  private logWarnSafely(
    message: string,
    context?: Record<string, unknown>,
  ): void {
    try {
      this.logger.warn(message, context);
    } catch {
      // Ignore logging failures
    }
  }

  private logErrorSafely(
    message: string,
    context?: Record<string, unknown>,
  ): void {
    try {
      this.logger.error(message, context);
    } catch {
      // Ignore logging failures
    }
  }
}
