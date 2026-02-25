import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
/**
 * Telegram Notification Service
 * Sends trading event notifications to Telegram
 * Integrates with ErrorHandler for resilient notification delivery
 */

import { Position, SignalDirection, PositionSide, LoggerService } from '../types/legacy';
import { TIME_MULTIPLIERS } from '../constants/technical.constants';
import { ErrorHandler, RecoveryStrategy, RetryConfig } from '../errors/ErrorHandler';
import {
  TelegramAPIError,
  TelegramNetworkError,
  TelegramMessageError,
  TelegramRateLimitError,
} from '../errors/DomainErrors';

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
  enabled: boolean;
}

export class TelegramService {
  private readonly botToken: string | null;
  private readonly chatId: string | null;
  private readonly enabled: boolean;
  private readonly logger: LoggerService;
  private readonly errorHandler?: ErrorHandler;

  // Telegram API constraints
  private readonly TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
  private readonly TELEGRAM_SAFE_MESSAGE_LENGTH = 4000;

  // Retry configuration for network errors
  private readonly NETWORK_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 2,
    initialDelayMs: 500,
    backoffMultiplier: 2,
    maxDelayMs: 2000,
  };

  // Retry configuration for server errors
  private readonly SERVER_ERROR_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 2,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 3000,
  };

  constructor(
    config: TelegramConfig,
    logger: LoggerService,
    errorHandler?: ErrorHandler,
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.botToken = config.botToken || null;
    this.chatId = config.chatId || null;
    this.enabled = config.enabled && !!this.botToken && !!this.chatId;

    if (this.enabled) {
      this.logger.info('✅ Telegram notifications ENABLED', {
        chatId: this.chatId,
      });
    } else {
      this.logger.info(
        '⚠️ Telegram notifications DISABLED (set telegram config in config.json)',
      );
    }
  }

  /**
   * Send message to Telegram with error handling
   * Uses FALLBACK strategy for message validation and SKIP strategy for all errors
   * (notifications should never block trading)
   */
  private async sendMessage(message: string): Promise<void> {
    if (!this.enabled || !this.botToken || !this.chatId) {
      return;
    }

    let finalMessage = message;
    try {
      // Validate message length, use FALLBACK if too long
      if (message.length > this.TELEGRAM_MAX_MESSAGE_LENGTH) {
        finalMessage = this.fallbackTruncateMessage(message);
      }

      // Send with retry for network errors, SKIP on all other errors
      await this.sendMessageWithRetry(finalMessage);
    } catch (error) {
      // All notification errors should be SKIPPED (never block trading)
      if (this.errorHandler) {
        await this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          logger: this.logger,
          context: 'TelegramService.sendMessage',
        });
      } else {
        // Fallback: silent failure if no error handler
        this.logger.debug('📤 Telegram notification skipped', {
          messageLength: finalMessage?.length,
        });
      }
    }
  }

  /**
   * Send message with retry for network errors
   * Attempts to send with exponential backoff on network failures
   */
  private async sendMessageWithRetry(message: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    let lastError: Error | undefined;

    // Classify error and determine retry strategy
    const tryWithRetry = async () => {
      try {
        await this.sendMessageRaw(url, message);
      } catch (error) {
        const classifiedError = this.classifyTelegramError(error, url);

        if (classifiedError instanceof TelegramNetworkError && this.errorHandler) {
          // Network errors: retry with backoff
          const handled = await this.errorHandler.handle(classifiedError, {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: this.NETWORK_RETRY_CONFIG,
            logger: this.logger,
            context: 'TelegramService.sendMessageWithRetry',
            onRetry: (attemptNum) => {
              this.logger.debug('🔄 Retrying Telegram send', {
                attempt: attemptNum,
              });
            },
            onFailure: () => {
              this.logger.warn('❌ Telegram send failed after retries');
            },
          });
          if (!handled.success) {
            lastError = handled.error;
            throw handled.error;
          }
        } else if (
          classifiedError instanceof TelegramAPIError &&
          classifiedError.statusCode >= 500 &&
          this.errorHandler
        ) {
          // Server errors (5xx): retry with backoff
          const handled = await this.errorHandler.handle(classifiedError, {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: this.SERVER_ERROR_RETRY_CONFIG,
            logger: this.logger,
            context: 'TelegramService.sendMessageWithRetry',
            onRetry: (attemptNum) => {
              this.logger.debug('🔄 Retrying Telegram send (server error)', {
                attempt: attemptNum,
                statusCode: classifiedError.statusCode,
              });
            },
            onFailure: () => {
              this.logger.warn('❌ Telegram send failed after retries (server error)');
            },
          });
          if (!handled.success) {
            lastError = handled.error;
            throw handled.error;
          }
        } else if (classifiedError instanceof TelegramRateLimitError && this.errorHandler) {
          // Rate limit: graceful degrade (log and continue)
          await this.errorHandler.handle(classifiedError, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            logger: this.logger,
            context: 'TelegramService.sendMessageWithRetry',
          });
        } else if (
          classifiedError instanceof TelegramMessageError &&
          this.errorHandler
        ) {
          // Message validation error: try fallback
          await this.errorHandler.handle(classifiedError, {
            strategy: RecoveryStrategy.FALLBACK,
            logger: this.logger,
            context: 'TelegramService.sendMessageWithRetry',
            onRecover: () => {
              // Fallback will be attempted in sendMessage
              this.logger.debug('📤 Falling back to plaintext message');
            },
          });
          // Re-throw to trigger fallback in sendMessage
          throw classifiedError;
        } else {
          // Unknown error: skip
          lastError = classifiedError instanceof Error ? classifiedError : new Error(String(error));
          throw lastError;
        }
      }
    };

    await tryWithRetry();
  }

  /**
   * Send raw HTTP POST to Telegram API
   * Does not handle errors - caller responsible for error handling
   */
  private async sendMessageRaw(url: string, message: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new TelegramAPIError(`Telegram API error: ${response.status}`, {
          statusCode: response.status,
          endpoint: url,
          response: errorText,
        });
      }

      this.logger.debug('📤 Telegram notification sent', {
        messageLength: message.length,
      });
    } catch (error) {
      // Classify network vs API errors
      if (error instanceof TelegramAPIError) {
        throw error;
      }

      // Network error
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TelegramNetworkError(
        `Failed to send Telegram notification: ${errorMessage}`,
        {
          operation: 'sendMessage',
          reason: errorMessage,
        },
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Classify Telegram errors into domain-specific types
   */
  private classifyTelegramError(error: unknown, endpoint: string): Error {
    if (error instanceof TelegramAPIError) return error;
    if (error instanceof TelegramNetworkError) return error;
    if (error instanceof TelegramMessageError) return error;
    if (error instanceof TelegramRateLimitError) return error;

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Network errors
    if (
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('EHOSTUNREACH')
    ) {
      return new TelegramNetworkError(`Network error: ${errorMessage}`, {
        operation: 'sendMessage',
        reason: errorMessage,
      });
    }

    // Rate limit (429)
    if (errorMessage.includes('429')) {
      return new TelegramRateLimitError('Rate limit exceeded', {
        retryAfterMs: 60000,
      });
    }

    // Message error
    if (
      errorMessage.includes('message is too long') ||
      errorMessage.includes('HTML parse error')
    ) {
      return new TelegramMessageError(`Message validation failed: ${errorMessage}`, {
        reason: errorMessage,
      });
    }

    // Unknown error
    return error instanceof Error ? error : new Error(errorMessage);
  }

  /**
   * Fallback: Truncate message to safe length and strip HTML
   */
  private fallbackTruncateMessage(message: string): string {
    let result = message;

    // First try: truncate to safe length
    if (result.length > this.TELEGRAM_SAFE_MESSAGE_LENGTH) {
      result = result.substring(0, this.TELEGRAM_SAFE_MESSAGE_LENGTH) + '...';
    }

    // Second try: if still too long, strip HTML
    if (result.length > this.TELEGRAM_MAX_MESSAGE_LENGTH) {
      result = this.stripHtmlTags(result);

      // Third try: truncate plain text
      if (result.length > this.TELEGRAM_SAFE_MESSAGE_LENGTH) {
        result = result.substring(0, this.TELEGRAM_SAFE_MESSAGE_LENGTH) + '...';
      }
    }

    return result;
  }

  /**
   * Strip HTML tags from message (fallback for invalid HTML)
   */
  private stripHtmlTags(message: string): string {
    return message.replace(/<[^>]*>/g, '');
  }

  /**
   * Notification: Bot started
   */
  async notifyBotStarted(symbol: string, timeframes: string[]): Promise<void> {
    const message = `
🚀 <b>BOT STARTED</b>

📊 Symbol: ${symbol}
⏰ Timeframes: ${timeframes.join(', ')}
⏰ Time: ${new Date().toISOString()}

✅ Bot is now monitoring the market...
`.trim();

    await this.sendMessage(message);
  }

  /**
   * Notification: Bot stopped
   */
  async notifyBotStopped(reason?: string): Promise<void> {
    const message = `
🛑 <b>BOT STOPPED</b>

⏰ Time: ${new Date().toISOString()}
${reason ? `📝 Reason: ${reason}` : ''}

❌ Bot has stopped monitoring.
`.trim();

    await this.sendMessage(message);
  }

  /**
   * Notification: Position opened
   */
  async notifyPositionOpened(position: Position): Promise<void> {
    const sideEmoji = position.side === PositionSide.LONG ? '🟢' : '🔴';
    const leverageText = position.leverage > 1 ? ` ${position.leverage}x` : '';

    const message = `
${sideEmoji} <b>${position.side.toUpperCase()}${leverageText} OPENED</b>

📊 Symbol: ${position.symbol}
💰 Entry: $${position.entryPrice.toFixed(DECIMAL_PLACES.PRICE)}
📦 Size: ${position.quantity} (${position.marginUsed.toFixed(DECIMAL_PLACES.PERCENT)} USDT margin)

🎯 Take Profits:
${position.takeProfits
    .map(
      (tp) =>
        `  TP${tp.level}: $${tp.price.toFixed(DECIMAL_PLACES.PRICE)} (+${tp.percent.toFixed(DECIMAL_PLACES.PERCENT)}%) - ${tp.sizePercent}%${tp.hit ? ' ✅' : ''}`,
    )
    .join('\n')}

🛡️ Stop Loss: $${position.stopLoss.price.toFixed(DECIMAL_PLACES.PRICE)}

📝 Strategy: ${position.strategy || 'SmartTrend'}
📝 Confidence: ${((position.confidence || 0) * PERCENT_MULTIPLIER).toFixed(1)}%
📝 Reason: ${position.reason || 'N/A'}
`.trim();

    await this.sendMessage(message);
  }

  /**
   * Notification: Position closed
   */
  async notifyPositionClosed(
    position: Position,
    closeReason: string,
    closePrice: number,
    realizedPnL: number,
    realizedPnLPercent: number,
  ): Promise<void> {
    const pnlEmoji = realizedPnL >= 0 ? '💰' : '💸';
    const pnlSign = realizedPnL >= 0 ? '+' : '';

    // Emoji for close type
    let closeEmoji = '🔚';
    if (closeReason.includes('Stop Loss') || closeReason.includes('SL')) {
      closeEmoji = '🛡️';
    } else if (closeReason.includes('Take Profit') || closeReason.includes('TP')) {
      closeEmoji = '🎯';
    } else if (closeReason.toLowerCase().includes('trailing')) {
      closeEmoji = '📈';
    } else if (closeReason.toLowerCase().includes('time')) {
      closeEmoji = '⏰';
    }

    const holdingTimeMs = Date.now() - position.openedAt;
    const holdingTimeSec = Math.floor(holdingTimeMs / TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND);
    const holdingTimeMin = Math.floor(holdingTimeSec / TIME_MULTIPLIERS.SECONDS_PER_MINUTE);
    const holdingTimeFormatted =
      holdingTimeMin > 0
        ? `${holdingTimeMin}m ${holdingTimeSec % TIME_MULTIPLIERS.SECONDS_PER_MINUTE}s`
        : `${holdingTimeSec}s`;

    const tpsHit = position.takeProfits.filter((tp) => tp.hit);

    const message = `
${closeEmoji} <b>${position.side.toUpperCase()} CLOSED</b>

📊 Symbol: ${position.symbol}
💰 Entry: $${position.entryPrice.toFixed(DECIMAL_PLACES.PRICE)}
🚪 Exit: $${closePrice.toFixed(DECIMAL_PLACES.PRICE)}

${pnlEmoji} <b>PnL: ${pnlSign}${realizedPnL.toFixed(DECIMAL_PLACES.PERCENT)} USDT (${pnlSign}${realizedPnLPercent.toFixed(DECIMAL_PLACES.PERCENT)}%)</b>

🎯 TPs Hit: ${tpsHit.length > 0 ? tpsHit.map((tp) => `TP${tp.level}`).join(', ') : 'None'}
⏱️ Duration: ${holdingTimeFormatted}
📝 Reason: ${closeReason}
`.trim();

    await this.sendMessage(message);
  }

  /**
   * Notification: Take Profit hit
   */
  async notifyTakeProfitHit(
    position: Position,
    tpLevel: number,
    tpPrice: number,
    tpPercent: number,
    sizePercent: number,
  ): Promise<void> {
    const sideEmoji = position.side === PositionSide.LONG ? '🟢' : '🔴';

    const message = `
🎯 <b>TP${tpLevel} HIT!</b>

${sideEmoji} ${position.symbol} ${position.side.toUpperCase()}
💰 Price: $${tpPrice.toFixed(DECIMAL_PLACES.PRICE)} (+${tpPercent.toFixed(DECIMAL_PLACES.PERCENT)}%)
📦 Closed: ${sizePercent}% of position

💸 Estimated Profit: ~${(
    ((position.marginUsed * sizePercent) / PERCENT_MULTIPLIER) *
      (tpPercent / PERCENT_MULTIPLIER) *
      position.leverage
  ).toFixed(DECIMAL_PLACES.PERCENT)} USDT
`.trim();

    await this.sendMessage(message);
  }

  /**
   * Notification: Stop moved to breakeven
   */
  async notifyBreakeven(position: Position, newStopPrice: number): Promise<void> {
    const sideEmoji = position.side === PositionSide.LONG ? '🟢' : '🔴';

    const message = `
🛡️ <b>STOP MOVED TO BREAKEVEN!</b>

${sideEmoji} ${position.symbol} ${position.side.toUpperCase()}
💰 Entry: $${position.entryPrice.toFixed(DECIMAL_PLACES.PRICE)}
🛡️ New Stop: $${newStopPrice.toFixed(DECIMAL_PLACES.PRICE)}

✅ Risk-free position! Minimum profit guaranteed.
`.trim();

    await this.sendMessage(message);
  }

  /**
   * Notification: Trailing stop activated
   */
  async notifyTrailingActivated(
    position: Position,
    currentPrice: number,
    newStopPrice: number,
    trailingPercent: number,
  ): Promise<void> {
    const sideEmoji = position.side === PositionSide.LONG ? '🟢' : '🔴';

    const message = `
📈 <b>TRAILING STOP ACTIVATED!</b>

${sideEmoji} ${position.symbol} ${position.side.toUpperCase()}
💰 Current Price: $${currentPrice.toFixed(DECIMAL_PLACES.PRICE)}
🛡️ New Stop: $${newStopPrice.toFixed(DECIMAL_PLACES.PRICE)}
📊 Trailing Distance: ${trailingPercent.toFixed(DECIMAL_PLACES.PERCENT)}%

🎯 Locking in profits! Stop will follow price movement.
`.trim();

    await this.sendMessage(message);
  }

  /**
   * Notification: Trailing stop updated (silent, only debug)
   */
  async notifyTrailingUpdated(
    position: Position,
    newStopPrice: number,
  ): Promise<void> {
    // Silent notification - only log, don't spam Telegram
    this.logger.debug('📈 Trailing stop updated', {
      symbol: position.symbol,
      newStop: newStopPrice,
    });
  }

  /**
   * Notification: Trade signal (entry/exit)
   */
  async sendTradeNotification(params: {
    type: 'ENTRY' | 'EXIT';
    direction: SignalDirection;
    price: number;
    stopLoss?: number;
    takeProfits?: Array<{ level: number; price: number; sizePercent: number }>;
    confidence?: number;
    reason?: string;
    pnl?: number;
    pnlPercent?: number;
  }): Promise<void> {
    const emoji = params.type === 'ENTRY'
      ? (params.direction === SignalDirection.LONG ? '🟢' : '🔴')
      : '⚪';

    let message = `
${emoji} <b>${params.type}: ${params.direction}</b>

💰 Price: $${params.price.toFixed(DECIMAL_PLACES.PRICE)}`;

    if (params.type === 'ENTRY') {
      if (params.stopLoss) {
        message += `\n🛡️ Stop Loss: $${params.stopLoss.toFixed(DECIMAL_PLACES.PRICE)}`;
      }
      if (params.takeProfits && params.takeProfits.length > 0) {
        message += '\n🎯 Take Profits:';
        params.takeProfits.forEach(tp => {
          message += `\n  • TP${tp.level}: $${tp.price.toFixed(DECIMAL_PLACES.PRICE)} (${tp.sizePercent}%)`;
        });
      }
      if (params.confidence) {
        message += `\n📊 Confidence: ${(params.confidence * PERCENT_MULTIPLIER).toFixed(0)}%`;
      }
      if (params.reason) {
        message += `\n📝 Reason: ${params.reason}`;
      }
    } else {
      // EXIT
      if (params.pnl !== undefined) {
        const pnlSign = params.pnl >= 0 ? '+' : '';
        message += `\n💵 PnL: ${pnlSign}$${params.pnl.toFixed(DECIMAL_PLACES.PERCENT)}`;
      }
      if (params.pnlPercent !== undefined) {
        const pnlSign = params.pnlPercent >= 0 ? '+' : '';
        message += `\n📈 PnL%: ${pnlSign}${params.pnlPercent.toFixed(DECIMAL_PLACES.PERCENT)}%`;
      }
      if (params.reason) {
        message += `\n📝 Reason: ${params.reason}`;
      }
    }

    message += `\n⏰ Time: ${new Date().toISOString()}`;
    message = message.trim();

    await this.sendMessage(message);
  }

  /**
   * Notification: Critical error
   */
  async notifyError(errorType: string, details: string): Promise<void> {
    const message = `
⚠️ <b>ERROR: ${errorType}</b>

${details}

⏰ Time: ${new Date().toISOString()}
`.trim();

    await this.sendMessage(message);
  }

  /**
   * Send critical alert message
   * Used for emergency notifications (unprotected positions, etc)
   */
  async sendAlert(message: string): Promise<void> {
    await this.sendMessage(message);
  }
}
