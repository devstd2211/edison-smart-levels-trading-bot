/**
 * Explicit web entrypoint boundary.
 *
 * Builds and starts the workspace WebServer adapter from an explicit runtime pair
 * so callers keep the web-facing bot adapter and read-only web API adapter visible
 * at the boundary instead of rediscovering adapters through bot internals.
 * Build the runtime pair first, then hand that pair to `startWebServer(runtime, ports)`.
 * The workspace WebServer receives the already-materialized runtime pair.
 * `startWebServer(...)` owns lifecycle start; lower-level construction stays in `createWebServerInstance(...)`.
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
