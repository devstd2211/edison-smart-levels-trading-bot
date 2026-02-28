/**
 * Web Entrypoint
 *
 * Starts the WebServer adapter with a bot instance.
 */

import { WebServer, type WebServerConfig, type IBotInstance, type IWebApiAdapter } from 'trading-bot-web-server';

type EventBusLike = {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
};

type WebBotAdapter = {
  eventBus: EventBusLike;
  isRunning: boolean;
  getCurrentPosition(): unknown;
  getBalance(): Promise<number>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getWebApiAdapter?: () => WebApiAdapter | undefined;
};

type WebServerInstance = {
  close(): void;
};

type WebApiAdapter = IWebApiAdapter;

export async function startWebServer(
  bot: WebBotAdapter,
  ports: WebServerConfig,
): Promise<WebServerInstance> {
  // Make bot instance behave like EventEmitter for BotBridgeService
  const botInstance = {
    ...bot,
    on: (event: string, listener: (...args: unknown[]) => void) => bot.eventBus.on(event, listener),
    off: (event: string, listener: (...args: unknown[]) => void) => bot.eventBus.off(event, listener),
    emit: (event: string, ...args: unknown[]) => bot.eventBus.emit(event, ...args),
    stop: () => { void bot.stop(); },
  };

  const webApiAdapter = typeof bot.getWebApiAdapter === 'function'
    ? bot.getWebApiAdapter()
    : undefined;

  return new WebServer(botInstance as unknown as IBotInstance, {
    apiPort: ports.apiPort,
    wsPort: ports.wsPort,
  }, webApiAdapter as IWebApiAdapter | undefined);
}
