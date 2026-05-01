/**
 * Web Entrypoint
 *
 * Starts the workspace WebServer adapter with a bot instance.
 */

import { WebServer } from 'trading-bot-web-server';
import type { WebServerConfig, IBotInstance, IWebApiAdapter } from 'trading-bot-web-server';
import type { Position } from '../types/position';
import type { BotRuntimeEventBusLike } from '../types/bot-events';

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

export async function startWebServer(
  bot: WebBotAdapter,
  ports: WebServerConfig,
): Promise<WebServerInstance> {
  // Make bot instance behave like EventEmitter for BotBridgeService
  const botInstance = {
    ...bot,
    on: (event: string, listener: (data?: unknown) => void) => bot.eventBus.on(event, listener),
    off: (event: string, listener: (data?: unknown) => void) => bot.eventBus.off(event, listener),
    emit: (event: string, data?: unknown) => bot.eventBus.emit(event, data),
    stop: () => { void bot.stop(); },
  };

  const webApiAdapter = typeof bot.getWebApiAdapter === 'function'
    ? bot.getWebApiAdapter()
    : undefined;

  return new WebServer(botInstance as unknown as IBotInstance, {
    apiPort: ports.apiPort,
    wsPort: ports.wsPort,
  }, webApiAdapter);
}
