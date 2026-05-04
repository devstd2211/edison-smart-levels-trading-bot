/**
 * Web Entrypoint
 *
 * Starts the workspace WebServer adapter with a bot instance.
 */

import { EventEmitter } from 'events';
import { WebServer } from 'trading-bot-web-server';
import type { WebServerConfig, IBotInstance, IWebApiAdapter } from 'trading-bot-web-server';
import type { Position } from '../types/position';
import type { BotRuntimeEventBusLike } from '../types/bot-events';
import type { Position as WebServerPosition } from 'trading-bot-web-server/dist/types/api.types';

type WebBotAdapter = {
  eventBus: BotRuntimeEventBusLike;
  isRunning: boolean;
  getCurrentPosition(): Position | null;
  getBalance(): Promise<number>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getWebApiAdapter?: () => IWebApiAdapter | undefined;
};

type WebServerInstance = {
  close(): void;
};

class WebServerBotInstanceAdapter extends EventEmitter implements IBotInstance {
  constructor(private readonly bot: WebBotAdapter) {
    super();
  }

  get isRunning(): boolean {
    return this.bot.isRunning;
  }

  getCurrentPosition(): WebServerPosition | null {
    return toWebServerPosition(this.bot.getCurrentPosition());
  }

  getBalance(): Promise<number> {
    return this.bot.getBalance();
  }

  start(): Promise<void> {
    return this.bot.start();
  }

  stop(): void {
    void this.bot.stop();
  }

  override on(event: string, listener: (data?: unknown) => void): this {
    this.bot.eventBus.on(event, listener);
    return this;
  }

  override off(event: string, listener: (data?: unknown) => void): this {
    this.bot.eventBus.off(event, listener);
    return this;
  }

  override emit(event: string, data?: unknown): boolean {
    this.bot.eventBus.emit(event, data);
    return true;
  }
}

export function createWebServerBotInstance(bot: WebBotAdapter): IBotInstance {
  return new WebServerBotInstanceAdapter(bot);
}

function toWebServerPosition(position: Position | null): WebServerPosition | null {
  if (!position) {
    return null;
  }

  const currentPrice = position.entryPrice;
  const unrealizedPnLPercent = position.marginUsed > 0
    ? (position.unrealizedPnL / position.marginUsed) * 100
    : 0;

  return {
    id: position.id,
    symbol: position.symbol,
    side: position.side,
    quantity: position.quantity,
    entryPrice: position.entryPrice,
    currentPrice,
    leverage: position.leverage,
    marginUsed: position.marginUsed,
    unrealizedPnL: position.unrealizedPnL,
    unrealizedPnLPercent,
    stopLoss: {
      price: position.stopLoss.price,
      ...(position.stopLoss.isBreakeven ? { breakeven: position.stopLoss.price } : {}),
      ...(position.stopLoss.isTrailing ? { trailing: true } : {}),
    },
    takeProfits: position.takeProfits.map((takeProfit) => ({
      price: takeProfit.price,
      quantity: takeProfit.sizePercent,
      ...(takeProfit.hit ? { hit: true } : {}),
    })),
    openedAt: position.openedAt,
    status: position.status,
  };
}

export async function startWebServer(
  bot: WebBotAdapter,
  ports: WebServerConfig,
): Promise<WebServerInstance> {
  const webApiAdapter = typeof bot.getWebApiAdapter === 'function'
    ? bot.getWebApiAdapter()
    : undefined;

  return new WebServer(createWebServerBotInstance(bot), {
    apiPort: ports.apiPort,
    wsPort: ports.wsPort,
  }, webApiAdapter);
}
