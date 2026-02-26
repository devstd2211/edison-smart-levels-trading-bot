/**
 * Web Entrypoint
 *
 * Starts the WebServer adapter with a bot instance.
 */

type EventBusLike = {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
};

type WebBotAdapter = {
  eventBus: EventBusLike;
  getWebApiAdapter?: () => WebApiAdapter | undefined;
};

type WebServerConfig = { apiPort: number; wsPort: number };

type WebServerInstance = {
  close(): void;
};

type WebApiAdapter = {
  getMarketData(): Promise<unknown>;
  getCandles(timeframe: string, limit: number): Promise<unknown>;
  getPositionHistory(limit: number): Promise<unknown>;
  getOrderBook(symbol: string): Promise<unknown>;
  getWalls(symbol: string): Promise<unknown>;
  getFundingRate(symbol: string): Promise<unknown>;
  getVolumeProfile(symbol: string, levels: number): Promise<unknown>;
};

type WebServerConstructor = new (
  bot: unknown,
  config: WebServerConfig,
  webApiAdapter?: WebApiAdapter,
) => WebServerInstance;

type WebServerModule = {
  WebServer: WebServerConstructor;
};

export async function startWebServer(
  bot: WebBotAdapter,
  ports: WebServerConfig,
): Promise<WebServerInstance> {
  // Dynamic import to avoid TypeScript rootDir issues with web-server location
  // @ts-ignore - web-server is outside rootDir but will be compiled separately
  const webServerModule = await import('../../web-server/dist/index.js') as WebServerModule;
  const WebServer = webServerModule.WebServer;

  // Make bot instance behave like EventEmitter for BotBridgeService
  const botInstance = {
    ...bot,
    on: (event: string, listener: (...args: unknown[]) => void) => bot.eventBus.on(event, listener),
    off: (event: string, listener: (...args: unknown[]) => void) => bot.eventBus.off(event, listener),
    emit: (event: string, ...args: unknown[]) => bot.eventBus.emit(event, ...args),
  };

  const webApiAdapter = typeof bot.getWebApiAdapter === 'function'
    ? bot.getWebApiAdapter()
    : undefined;

  return new WebServer(botInstance, {
    apiPort: ports.apiPort,
    wsPort: ports.wsPort,
  }, webApiAdapter);
}
