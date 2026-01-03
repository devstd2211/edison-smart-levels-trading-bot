import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
/**
 * Telegram Notification Service
 * Sends trading event notifications to Telegram
 */

import { Position, SignalDirection, PositionSide, LoggerService } from '../types';
import { TIME_MULTIPLIERS, INTEGER_MULTIPLIERS } from '../constants/technical.constants';

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

  constructor(config: TelegramConfig, logger: LoggerService) {
    this.logger = logger;
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
   * Send message to Telegram
   */
  private async sendMessage(message: string): Promise<void> {
    if (!this.enabled || !this.botToken || !this.chatId) {
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
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
        throw new Error(`Telegram API error: ${response.status} ${errorText}`);
      }

      this.logger.debug('📤 Telegram notification sent', {
        messageLength: message.length,
      });
    } catch (error) {
      this.logger.error('❌ Failed to send Telegram notification', { error });
    }
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
