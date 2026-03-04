/**
 * Web Entrypoint
 *
 * Starts the WebServer adapter with a bot instance.
 */

import { resolve } from 'path';
import { pathToFileURL } from 'url';
import type { WebServerConfig, IBotInstance, IWebApiAdapter } from 'trading-bot-web-server';

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
type WebServerCtor = new (
  bot: IBotInstance,
  config: WebServerConfig,
  webApiAdapter?: IWebApiAdapter,
) => WebServerInstance;

const nativeImport = new Function(
  'p',
  'return import(p)',
) as (path: string) => Promise<unknown>;

async function loadWebServerCtor(): Promise<WebServerCtor> {
  try {
    const runtimeRequire = eval('require') as (id: string) => { WebServer?: WebServerCtor };
    const mod = runtimeRequire('trading-bot-web-server');
    if (mod?.WebServer) {
      return mod.WebServer;
    }
  } catch {
    // Workspace package may be unavailable in node_modules; fallback below.
  }

  const fallbackPath = pathToFileURL(
    resolve(__dirname, '../../../web-server/dist/index.js'),
  ).href;
  const fallbackModule = (await nativeImport(fallbackPath)) as { WebServer?: WebServerCtor };
  if (!fallbackModule?.WebServer) {
    throw new Error('Unable to load WebServer from trading-bot-web-server or fallback dist path');
  }

  return fallbackModule.WebServer;
}

export async function startWebServer(
  bot: WebBotAdapter,
  ports: WebServerConfig,
): Promise<WebServerInstance> {
  const WebServer = await loadWebServerCtor();

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
