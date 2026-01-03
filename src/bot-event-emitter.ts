import { EventEmitter } from 'events';
import { Signal, Position, LoggerService } from './types';
import { BotEventBus } from './services/event-bus';

/**
 * BotEventEmitter - Event Adapter for TradingBot
 *
 * Provides a READ-ONLY event API for external consumers (web, CLI, monitoring).
 * Prevents external code from interfering with bot's internal event system.
 *
 * This adapter bridges events from BotEventBus (internal) to EventEmitter (external).
 * External code can only listen to events, not emit or manipulate them.
 */
export class BotEventEmitter extends EventEmitter {
  constructor(
    private eventBus: BotEventBus,
    private logger?: LoggerService
  ) {
    super();
    this.setupEventBridges();
  }

  /**
   * Setup bridges from internal BotEventBus to external EventEmitter
   */
  private setupEventBridges(): void {
    // Signal events
    this.eventBus.subscribe('signal', (signal: Signal) => {
      this.emit('signal', signal);
    });

    // Position lifecycle events
    this.eventBus.subscribe('position-opened', (position: Position) => {
      this.emit('position-opened', position);
    });

    this.eventBus.subscribe('position-closed', (position: Position) => {
      this.emit('position-closed', position);
    });

    // Error events
    this.eventBus.subscribe('error', (error: Error) => {
      this.emit('error', error);
    });

    // Status events
    this.eventBus.subscribe('bot-started', (isRunning: boolean) => {
      if (isRunning) {
        this.emit('bot-started');
      }
    });

    this.eventBus.subscribe('bot-stopped', (isRunning: boolean) => {
      if (!isRunning) {
        this.emit('bot-stopped');
      }
    });
  }

  /**
   * Type-safe convenience method for signal events
   * @param handler Callback function for signal events
   * @returns Unsubscribe function
   */
  onSignal(handler: (signal: Signal) => void): () => void {
    this.on('signal', handler);
    return () => this.off('signal', handler);
  }

  /**
   * Type-safe convenience method for position opened events
   * @param handler Callback function for position opened events
   * @returns Unsubscribe function
   */
  onPositionOpened(handler: (position: Position) => void): () => void {
    this.on('position-opened', handler);
    return () => this.off('position-opened', handler);
  }

  /**
   * Type-safe convenience method for position closed events
   * @param handler Callback function for position closed events
   * @returns Unsubscribe function
   */
  onPositionClosed(handler: (position: Position) => void): () => void {
    this.on('position-closed', handler);
    return () => this.off('position-closed', handler);
  }

  /**
   * Type-safe convenience method for error events
   * @param handler Callback function for error events
   * @returns Unsubscribe function
   */
  onError(handler: (error: Error) => void): () => void {
    this.on('error', handler);
    return () => this.off('error', handler);
  }

  /**
   * Type-safe convenience method for bot started events
   * @param handler Callback function for bot started
   * @returns Unsubscribe function
   */
  onBotStarted(handler: () => void): () => void {
    this.on('bot-started', handler);
    return () => this.off('bot-started', handler);
  }

  /**
   * Type-safe convenience method for bot stopped events
   * @param handler Callback function for bot stopped
   * @returns Unsubscribe function
   */
  onBotStopped(handler: () => void): () => void {
    this.on('bot-stopped', handler);
    return () => this.off('bot-stopped', handler);
  }

  /**
   * Get list of available events
   */
  static getAvailableEvents(): string[] {
    return [
      'signal',
      'position-opened',
      'position-closed',
      'error',
      'bot-started',
      'bot-stopped',
    ];
  }
}
