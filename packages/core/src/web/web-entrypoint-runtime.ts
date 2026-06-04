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
  private readonly eventBusListeners = new Map<string, Array<{
    original: (data?: unknown) => void;
    wrapped: (data?: unknown) => void;
  }>>();

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

  private registerEventBusListener(
    event: string,
    listener: (data?: unknown) => void,
    wrapped: (data?: unknown) => void = listener,
  ): this {
    const listeners = this.eventBusListeners.get(event) ?? [];
    listeners.push({ original: listener, wrapped });
    this.eventBusListeners.set(event, listeners);
    this.bot.eventBus.on(event, wrapped);
    return this;
  }

  private removeTrackedEventBusListener(
    event: string,
    listener?: (data?: unknown) => void,
  ): this {
    const listeners = this.eventBusListeners.get(event);
    if (!listeners || listeners.length === 0) {
      return this;
    }

    if (!listener) {
      for (const entry of listeners) {
        this.bot.eventBus.off(event, entry.wrapped);
      }
      this.eventBusListeners.delete(event);
      return this;
    }

    const nextListeners = listeners.filter((entry) => {
      const matches = entry.original === listener || entry.wrapped === listener;
      if (matches) {
        this.bot.eventBus.off(event, entry.wrapped);
      }
      return !matches;
    });

    if (nextListeners.length === 0) {
      this.eventBusListeners.delete(event);
    } else {
      this.eventBusListeners.set(event, nextListeners);
    }

    return this;
  }

  override on(event: string, listener: (data?: unknown) => void): this {
    return this.registerEventBusListener(event, listener);
  }

  override addListener(event: string, listener: (data?: unknown) => void): this {
    return this.on(event, listener);
  }

  override once(event: string, listener: (data?: unknown) => void): this {
    const wrapped = (data?: unknown) => {
      this.removeTrackedEventBusListener(event, wrapped);
      listener(data);
    };

    return this.registerEventBusListener(event, listener, wrapped);
  }

  override off(event: string, listener: (data?: unknown) => void): this {
    return this.removeTrackedEventBusListener(event, listener);
  }

  override removeListener(event: string, listener: (data?: unknown) => void): this {
    return this.off(event, listener);
  }

  override removeAllListeners(event?: string): this {
    if (event) {
      return this.removeTrackedEventBusListener(event);
    }

    for (const eventName of [...this.eventBusListeners.keys()]) {
      this.removeTrackedEventBusListener(eventName);
    }

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
