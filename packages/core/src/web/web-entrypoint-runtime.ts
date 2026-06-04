import { EventEmitter } from 'events';
import type { IWebApiAdapter, WebApiBotPosition } from '@edison/contracts/web-api';
import type { Position } from '../types/position';
import type {
  TradingBotRuntimeControls,
  TradingBotReadApi,
} from '../types/trading-bot';

/**
 * Narrow web-entrypoint runtime helpers.
 *
 * Keeps the web-server handoff explicit: callers build one runtime pair
 * `{ botAdapter, webApiAdapter }` up front, then start the server with that pair.
 * createWebServerInstance(...) is construction-only and does not start lifecycle.
 * startWebServerRuntime(...) owns the lifecycle start after construction.
 */

export type TradingBotWebServerBridge = TradingBotRuntimeControls & TradingBotReadApi;

export interface WebServerBotPort extends EventEmitter {
  readonly isRunning: boolean;
  getCurrentPosition(): WebApiBotPosition | null;
  getBalance(): Promise<number>;
  start(): Promise<void>;
  stop(): void;
  on(event: string, listener: (data?: unknown) => void): this;
  off(event: string, listener: (data?: unknown) => void): this;
  emit(event: string, data?: unknown): boolean;
}

export type TradingBotWebServerRuntime = {
  botAdapter: WebServerBotPort;
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
  bot: WebServerBotPort,
  ports: WebServerPorts,
  webApiAdapter: IWebApiAdapter,
) => WebServerInstance & { start(): Promise<void> };

class WebServerBotInstanceAdapter extends EventEmitter implements WebServerBotPort {
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
    return this.bot.eventBus.emit(event, data);
  }
}

export function createWebServerBotInstance(
  bot: TradingBotWebServerBridge,
): WebServerBotPort {
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

export function createWebServerInstance(
  runtime: TradingBotWebServerRuntime,
  ports: WebServerPorts,
  WebServerCtor: WebServerFactory,
): WebServerInstance & { start(): Promise<void> } {
  return new WebServerCtor(
    runtime.botAdapter,
    {
      apiPort: ports.apiPort,
      wsPort: ports.wsPort,
    },
    runtime.webApiAdapter,
  );
}

/**
 * Adapter mapping keeps the web-server contract derived from the runtime Position shape.
 * Runtime Position does not expose a live mark price here, so the adapter uses entryPrice as the currentPrice snapshot.
 */
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
  const server = createWebServerInstance(runtime, ports, WebServerCtor);
  await server.start();
  return server;
}
