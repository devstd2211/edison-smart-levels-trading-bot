/**
 * Web Entrypoint
 *
 * Starts the WebServer adapter with a bot instance.
 */

export async function startWebServer(
  bot: any,
  ports: { apiPort: number; wsPort: number },
): Promise<any> {
  // Dynamic import to avoid TypeScript rootDir issues with web-server location
  // @ts-ignore - web-server is outside rootDir but will be compiled separately
  const webServerModule = await import('../../web-server/dist/index.js');
  const WebServer = (webServerModule as any).WebServer;

  // Make bot instance behave like EventEmitter for BotBridgeService
  const botInstance = {
    ...bot,
    on: (event: string, listener: any) => bot.eventBus.on(event, listener),
    off: (event: string, listener: any) => bot.eventBus.off(event, listener),
    emit: (event: string, ...args: any[]) => bot.eventBus.emit(event, ...args),
  };

  return new WebServer(botInstance, {
    apiPort: ports.apiPort,
    wsPort: ports.wsPort,
  });
}
