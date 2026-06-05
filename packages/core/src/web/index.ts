/**
 * Explicit web entrypoint boundary.
 *
 * Public web surface exposes only runtime-pair construction and lifecycle start.
 * Builds and starts the workspace WebServer adapter from an explicit runtime pair
 * so callers keep the web-facing bot adapter and read-only web API adapter visible
 * at the boundary instead of rediscovering adapters through bot internals.
 * Callers keep adapter creation explicit at the boundary; the starter receives the pair and ports only.
 * The workspace WebServer constructor is bound here once, then receives the already-materialized runtime pair.
 * `startWebServer(...)` owns lifecycle start; lower-level construction stays in `createWebServerInstance(...)`.
 */

import { WebServer } from 'trading-bot-web-server';
import {
  createWebServerStarter,
  createWebServerBotInstance,
  createWebServerRuntime,
  type TradingBotWebServerRuntime,
  type WebServerInstance,
  type WebServerPorts,
} from './web-entrypoint-runtime';

export { createWebServerBotInstance, createWebServerRuntime };
const startWorkspaceWebServer = createWebServerStarter(WebServer);

export const WEB_ENTRYPOINT_EXPORT_NAMES = Object.freeze([
  'WEB_ENTRYPOINT_EXPORT_NAMES',
  'createWebServerBotInstance',
  'createWebServerRuntime',
  'startWebServer',
] as const);
export type {
  TradingBotWebServerBridge,
  WebServerBotPort,
  TradingBotWebServerRuntime,
  WebServerInstance,
  WebServerPorts,
} from './web-entrypoint-runtime';

export async function startWebServer(
  runtime: TradingBotWebServerRuntime,
  ports: WebServerPorts,
): Promise<WebServerInstance> {
  return startWorkspaceWebServer(runtime, ports);
}
