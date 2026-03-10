/**
 * Monitoring and Logging Interfaces
 *
 * Abstracts logging and monitoring functionality
 */

import type { Position } from '../types/core';
import type { HealthStatus, MemorySnapshot } from '../types/architecture';

/**
 * Logger interface
 */
export interface ILogger {
  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, unknown>): void;

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>): void;

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>): void;

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown): void;

  /**
   * Set log level
   */
  setLevel(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'): void;
}

/**
 * Monitoring interface
 * Tracks bot health and performance
 */
export interface IMonitoring {
  /**
   * Record position opened
   */
  recordPositionOpened(position: Position): void;

  /**
   * Record position closed
   */
  recordPositionClosed(position: Position, exitPrice: number, exitType: string): void;

  /**
   * Record signal generated
   */
  recordSignal(symbol: string, direction: string, confidence: number): void;

  /**
   * Record action queued
   */
  recordActionQueued(actionType: string): void;

  /**
   * Record action processed
   */
  recordActionProcessed(actionType: string, success: boolean, durationMs: number): void;

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus;

  /**
   * Get memory snapshot
   */
  getMemorySnapshot(): MemorySnapshot;

  /**
   * Get performance metrics
   */
  getMetrics(): {
    uptime: number;
    signalsGenerated: number;
    signalsIgnored: number;
    positionsOpened: number;
    positionsClosed: number;
    totalPnL: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
  };

  /**
   * Reset metrics
   */
  resetMetrics(): void;
}

/**
 * Notification interface
 */
export interface INotification {
  /**
   * Send message
   */
  send(message: string, data?: unknown): Promise<void>;

  /**
   * Send error notification
   */
  sendError(message: string, error?: Error): Promise<void>;

  /**
   * Check if notification is enabled
   */
  isEnabled(): boolean;
}

