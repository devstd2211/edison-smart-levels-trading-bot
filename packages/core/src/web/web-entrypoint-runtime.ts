import { EventEmitter } from 'events';
import type { IWebApiAdapter, WebApiBotPosition } from '@edison/contracts/web-api';
import type { Position } from '../types/position';
import type {
  TradingBotRuntimeControls,
  TradingBotReadApi,
} from '../types/trading-bot';

export type TradingBotWebServerBridge = TradingBotRuntimeControls & TradingBotReadApi;

export type TradingBotWebServerRuntime = {
  botAdapter: WebServerBotInstanceAdapter;
  webApiAdapter: IWebApiAdapter;
};

export type WebServerPorts = {
  apiPort?: number;
  wsPort?: number;
};

export type WebServerInstance = {
  close(): void;
};

export type WebServerFactory = new (
  bot: WebServerBotInstanceAdapter,
  ports: WebServerPorts,
  webApiAdapter: IWebApiAdapter,
) => WebServerInstance & { start(): Promise<void> };

export class WebServerBotInstanceAdapter extends EventEmitter {
  constructor(private readonly bot: TradingBotWebServerBridge) {
    super();
  }

  get isRunning(): boolean {
    return this.bot.isRunning;
  }

  getCurrentPosition(): WebApiBotPosition | null {
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

export function createWebServerBotInstance(bot: TradingBotWebServerBridge) {
  return new WebServerBotInstanceAdapter(bot);
}

export function createWebServerRuntime(
  bot: TradingBotWebServerBridge,
  webApiAdapter: IWebApiAdapter,
): TradingBotWebServerRuntime {
  return {
    botAdapter: createWebServerBotInstance(bot),
    webApiAdapter,
  };
}

export function toWebServerPosition(position: Position | null): WebApiBotPosition | null {
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

export async function startWebServerRuntime(
  runtime: TradingBotWebServerRuntime,
  ports: WebServerPorts,
  WebServerCtor: WebServerFactory,
): Promise<WebServerInstance> {
  const server = new WebServerCtor(
    runtime.botAdapter,
    {
      apiPort: ports.apiPort,
      wsPort: ports.wsPort,
    },
    runtime.webApiAdapter,
  );
  await server.start();
  return server;
}
