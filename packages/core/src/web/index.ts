/**
 * Web Entrypoint
 *
 * Starts the workspace WebServer adapter with a bot instance.
 */

import { WebServer } from 'trading-bot-web-server';
import {
  createWebServerBotInstance,
  createWebServerRuntime,
  startWebServerRuntime,
  type TradingBotWebServerRuntime,
  type WebServerInstance,
  type WebServerPorts,
} from './web-entrypoint-runtime';

export { createWebServerBotInstance, createWebServerRuntime };
export const WEB_ENTRYPOINT_EXPORT_NAMES = [
  'WEB_ENTRYPOINT_EXPORT_NAMES',
  'createWebServerBotInstance',
  'createWebServerRuntime',
  'startWebServer',
] as const;
export type {
  TradingBotWebServerBridge,
  TradingBotWebServerRuntime,
  WebServerInstance,
  WebServerPorts,
} from './web-entrypoint-runtime';

export async function startWebServer(
  runtime: TradingBotWebServerRuntime,
  ports: WebServerPorts,
): Promise<WebServerInstance> {
  return startWebServerRuntime(runtime, ports, WebServer);
}
