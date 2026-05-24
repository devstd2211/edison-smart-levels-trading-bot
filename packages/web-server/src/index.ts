/**
 * Web Server Entry Point
 *
 * Initializes Express API server and WebSocket server.
 * Connects to trading bot via BotBridgeService.
 */

import express, { Express, Response } from 'express';
import cors from 'cors';
import type { Server } from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { BotBridgeService, type IBotInstance } from './services/bot-bridge.service.js';
import type { IWebApiAdapter } from './services/web-api-adapter.types.js';
import { WebSocketService } from './websocket/ws-server.js';
import { createBotRouteApi, createBotRoutes } from './routes/bot.routes.js';
import { createDataRouteReadApi, createDataRoutes } from './routes/data.routes.js';
import { createAnalyticsRouteReadApi, createAnalyticsRoutes } from './routes/analytics.routes.js';
import {
  createFileWatcherRuntimeAdapters,
  FileWatcherService,
  type FileWatcherRuntimeAdapters,
} from './services/file-watcher.service.js';
import { createRequestLoggingMiddleware } from './middleware/request-logging.middleware.js';
import { createRateLimitMiddleware } from './middleware/rate-limit.middleware.js';
import { createErrorHandlerMiddleware } from './middleware/error-handler.middleware.js';
import { swaggerConfig } from './swagger.config.js';
import * as dotenv from 'dotenv';
import { createConfigRouteApi, createConfigRoutes } from './routes/config.routes.js';
import { ConfigManagementService } from './services/config-management.service.js';
import {
  createStatusErrorResponse,
  getErrorCode,
  getErrorMessage,
  resolveRequestId,
} from './errors/api-error-response.js';
import {
  API_DOCS_PATH,
  OPENAPI_DOCUMENT_PATH,
  RUNTIME_CONFIG_PATH,
  RUNTIME_DISCOVERY_GUIDANCE_LINES,
} from './runtime-discovery-guidance.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_PORT = parseInt(process.env.API_PORT || '4000', 10);
const WS_PORT = parseInt(process.env.WS_PORT || '4001', 10);

export interface WebServerConfig {
  apiPort?: number;
  wsPort?: number;
}

export type { IBotInstance } from './services/bot-bridge.service.js';
export type { IWebApiAdapter } from './services/web-api-adapter.types.js';

type WebServerRuntimeConfig = Required<WebServerConfig>;
type ShutdownProcess = Pick<NodeJS.Process, 'on' | 'off' | 'exit'>;
type ShutdownHandler = () => void;

function resolveWebServerConfig(config: WebServerConfig = {}): WebServerRuntimeConfig {
  return {
    apiPort: config.apiPort ?? API_PORT,
    wsPort: config.wsPort ?? WS_PORT,
  };
}

function resolveWebClientPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'packages', 'web-client', 'dist'),
    path.resolve(process.cwd(), 'web-client', 'dist'),
    path.resolve(process.cwd(), '..', 'web-client', 'dist'),
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) ?? candidates[0];
}

export function createDocsHtml(): string {
  return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>API Documentation</title>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: 'Roboto', sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
            }
            .container {
              max-width: 1200px;
              margin: 20px auto;
              padding: 20px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            h1 {
              color: #333;
              text-align: center;
              margin-bottom: 10px;
            }
            .info {
              text-align: center;
              color: #666;
              margin-bottom: 20px;
            }
            .endpoints {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
              gap: 15px;
              margin-top: 20px;
            }
            .endpoint {
              border: 1px solid #e0e0e0;
              border-radius: 4px;
              padding: 15px;
              background: #f9f9f9;
            }
            .endpoint h3 {
              margin: 0 0 10px 0;
              color: #333;
            }
            .endpoint p {
              margin: 5px 0;
              color: #666;
              font-size: 14px;
            }
            .method {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 3px;
              font-weight: bold;
              font-size: 12px;
              margin-right: 5px;
            }
            .get { background: #61affe; color: white; }
            .post { background: #49cc90; color: white; }
            .put { background: #fca130; color: white; }
            .delete { background: #f93e3e; color: white; }
            .swagger-ui-link {
              text-align: center;
              margin-top: 30px;
            }
            .swagger-ui-link a {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px 30px;
              border-radius: 4px;
              text-decoration: none;
              font-weight: bold;
              display: inline-block;
            }
            .swagger-ui-link a:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Trading Bot API</h1>
            <div class="info">
              <p>Real-time API for trading bot management and data retrieval</p>
              <p>OpenAPI Spec: <code>${OPENAPI_DOCUMENT_PATH}</code></p>
              <p>Runtime endpoint discovery: <code>${RUNTIME_CONFIG_PATH}</code></p>
            </div>
            <h2>Quick Reference</h2>
            <div class="endpoints">
              <div class="endpoint">
                <h3><span class="method get">GET</span>/health</h3>
                <p>Health check endpoint</p>
              </div>
              <div class="endpoint">
                <h3><span class="method post">POST</span>/api/bot/start</h3>
                <p>Start trading bot</p>
              </div>
              <div class="endpoint">
                <h3><span class="method post">POST</span>/api/bot/stop</h3>
                <p>Stop trading bot</p>
              </div>
              <div class="endpoint">
                <h3><span class="method get">GET</span>/api/bot/status</h3>
                <p>Get bot status</p>
              </div>
              <div class="endpoint">
                <h3><span class="method get">GET</span>/api/data/position</h3>
                <p>Get current position</p>
              </div>
              <div class="endpoint">
                <h3><span class="method get">GET</span>/api/data/balance</h3>
                <p>Get account balance</p>
              </div>
              <div class="endpoint">
                <h3><span class="method get">GET</span>/api/data/market</h3>
                <p>Get market data</p>
              </div>
              <div class="endpoint">
                <h3><span class="method get">GET</span>/api/data/signals/recent</h3>
                <p>Get recent signals</p>
              </div>
              <div class="endpoint">
                <h3><span class="method get">GET</span>/api/config</h3>
                <p>Get configuration</p>
              </div>
              <div class="endpoint">
                <h3><span class="method put">PUT</span>/api/config</h3>
                <p>Update configuration</p>
              </div>
              <div class="endpoint">
                <h3><span class="method get">GET</span>/api/analytics/journal</h3>
                <p>Get trade journal</p>
              </div>
              <div class="endpoint">
                <h3><span class="method get">GET</span>/api/analytics/journal/stats</h3>
                <p>Get journal statistics</p>
              </div>
            </div>
            <div class="endpoint" style="margin-top: 20px;">
              <h3>Browser Runtime Discovery</h3>
              <p>${RUNTIME_DISCOVERY_GUIDANCE_LINES.sameOrigin}</p>
              <p>${RUNTIME_DISCOVERY_GUIDANCE_LINES.websocketFallback}</p>
              <p>${RUNTIME_DISCOVERY_GUIDANCE_LINES.legacyRetry}</p>
            </div>
            <div class="swagger-ui-link">
              <p>Use the machine-readable OpenAPI document or query the runtime config endpoint directly.</p>
              <a href="${OPENAPI_DOCUMENT_PATH}">OpenAPI JSON</a>
            </div>
          </div>
        </body>
        </html>
      `;
}

function createSigtermShutdownHandler(
  closeServer: () => void,
  processRef: Pick<NodeJS.Process, 'exit'> = process,
): ShutdownHandler {
  return () => {
    console.log('[API] SIGTERM received, closing server');
    closeServer();
    processRef.exit(0);
  };
}

function registerSigtermShutdownHandler(
  processRef: ShutdownProcess,
  shutdownHandler: ShutdownHandler,
): ShutdownHandler {
  processRef.on('SIGTERM', shutdownHandler);
  return shutdownHandler;
}

function unregisterSigtermShutdownHandler(
  processRef: Pick<NodeJS.Process, 'off'>,
  shutdownHandler: ShutdownHandler | null,
): void {
  if (!shutdownHandler) {
    return;
  }
  processRef.off('SIGTERM', shutdownHandler);
}

function clearRuntimeTarget<TTarget>(
  target: TTarget | null,
  clearTarget: (target: TTarget) => void,
): null {
  if (!target) {
    return null;
  }

  clearTarget(target);
  return null;
}

function logApiRetry(tryPort: number, nextPort: number): void {
  console.error(`[API] Port ${tryPort} is already in use`);
  console.log(`[API] Retrying on port ${nextPort}...`);
}

function sendStructuredNotFound(res: Response, requestId?: unknown): void {
  res.status(404).json(createStatusErrorResponse(404, 'Not found', { requestId }));
}

export class WebServer {
  private readonly app: Express;
  private readonly bridge: BotBridgeService;
  private apiServer: Server | null = null;
  private wsService: WebSocketService | null = null;
  private fileWatcherRuntime: FileWatcherRuntimeAdapters | null = null;
  private shutdownHandler: (() => void) | null = null;
  private runtimeServicesStarted = false;
  private apiPort: number;
  private readonly wsPort: number;

  constructor(
    private bot: IBotInstance,
    config: WebServerConfig = {},
    webApiAdapter?: IWebApiAdapter,
  ) {
    this.app = express();
    this.bridge = new BotBridgeService(bot, webApiAdapter);

    const runtimeConfig = resolveWebServerConfig(config);
    this.apiPort = runtimeConfig.apiPort;
    this.wsPort = runtimeConfig.wsPort;

    this.setupMiddleware();
    this.setupFileWatcher();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cors());
    this.app.use(
      createRequestLoggingMiddleware({
        logBody: false,
        logHeaders: false,
        excludePaths: ['/health'],
        maxBodyLength: 500,
      }),
    );
    this.app.use(
      createRateLimitMiddleware({
        windowMs: 60 * 1000,
        maxRequests: 100,
        whitelist: ['::1', '127.0.0.1'],
      }),
    );
  }

  private setupFileWatcher() {
    const journalPath = path.resolve(process.cwd(), 'data', 'trade-journal.json');
    const sessionsPath = path.resolve(process.cwd(), 'data', 'session-stats.json');
    this.fileWatcherRuntime = createFileWatcherRuntimeAdapters(
      new FileWatcherService(journalPath, sessionsPath),
    );
  }

  private setupRoutes() {
    const botRoutes = createBotRoutes(createBotRouteApi(this.bridge));
    const dataRoutes = createDataRoutes(createDataRouteReadApi(this.bridge));
    const configPath = path.resolve(process.cwd(), 'config.json');
    const configRoutes = createConfigRoutes(createConfigRouteApi(new ConfigManagementService(configPath)), () => ({
      apiPort: this.getApiPort(),
      wsPort: this.getWebSocketPort(),
    }));
    const analyticsRoutes = createAnalyticsRoutes(
      createAnalyticsRouteReadApi(this.fileWatcherRuntime!.analytics),
    );
    const webClientPath = resolveWebClientPath();

    this.app.use(express.static(webClientPath));
    this.app.use('/api/bot', botRoutes);
    this.app.use('/api/data', dataRoutes);
    this.app.use('/api/config', configRoutes);
    this.app.use('/api/analytics', analyticsRoutes);

    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        botRunning: this.bridge.isRunning(),
      });
    });

    this.app.get(OPENAPI_DOCUMENT_PATH, (_req, res) => {
      res.json(swaggerConfig);
    });

    this.app.get(API_DOCS_PATH, (_req, res) => {
      res.send(createDocsHtml());
    });

    this.app.get('*', (req, res) => {
      const indexPath = path.join(webClientPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          sendStructuredNotFound(res, resolveRequestId(req.headers['x-request-id']));
        }
      });
    });

    this.app.use(createErrorHandlerMiddleware());
  }

  private setupWebSocket(port: number) {
    if (this.wsService) {
      return;
    }
    this.wsService = new WebSocketService(
      port,
      this.bridge,
      this.fileWatcherRuntime?.realtime,
    );
    console.log(`[WS] Server running on ws://localhost:${this.wsService.getPort()}`);
  }

  private startFileWatcher() {
    if (!this.fileWatcherRuntime) {
      return;
    }
    this.fileWatcherRuntime.lifecycle.start();
    console.log('[FileWatcher] Started monitoring journal and session files');
  }

  private stopFileWatcher() {
    if (!this.fileWatcherRuntime) {
      return;
    }
    this.fileWatcherRuntime.lifecycle.stop();
  }

  private registerShutdownHandler() {
    if (this.shutdownHandler) {
      return;
    }
    this.shutdownHandler = registerSigtermShutdownHandler(
      process,
      createSigtermShutdownHandler(() => this.close()),
    );
  }

  private startRuntimeServices(): void {
    this.setupWebSocket(this.wsPort);
    this.startFileWatcher();
    this.runtimeServicesStarted = true;
  }

  private closeApiServer(): boolean {
    const hadServer = this.apiServer !== null;
    this.apiServer = clearRuntimeTarget(this.apiServer, (server) => {
      server.close();
    });
    return hadServer;
  }

  private stopRuntimeServices(): boolean {
    if (!this.runtimeServicesStarted) {
      return false;
    }

    this.stopFileWatcher();
    this.wsService = clearRuntimeTarget(this.wsService, (wsService) => {
      wsService.close();
    });
    this.runtimeServicesStarted = false;
    return true;
  }

  private unregisterShutdownHandler(): boolean {
    const hadHandler = this.shutdownHandler !== null;
    this.shutdownHandler = clearRuntimeTarget(this.shutdownHandler, (shutdownHandler) => {
      unregisterSigtermShutdownHandler(process, shutdownHandler);
    });
    return hadHandler;
  }

  private async startApiServer(tryPort: number, maxRetries: number = 3): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const server = this.app.listen(tryPort, () => {
        this.apiServer = server;
        this.apiPort = tryPort;
        console.log(`[API] Server running on http://localhost:${tryPort}`);
        resolve();
      });

      server.once('error', (error: unknown) => {
        const errorCode = getErrorCode(error);
        if (errorCode === 'EADDRINUSE' && maxRetries > 0) {
          const nextPort = tryPort + 100;
          logApiRetry(tryPort, nextPort);
          server.close();
          resolve(this.startApiServer(nextPort, maxRetries - 1));
          return;
        }

        reject(new Error(`[API] Server error: ${getErrorMessage(error)}`));
      });
    });
  }

  async start(): Promise<void> {
    if (this.apiServer) {
      return;
    }

    try {
      this.startRuntimeServices();
      await this.startApiServer(this.apiPort);
      this.registerShutdownHandler();
    } catch (error) {
      this.unregisterShutdownHandler();
      this.stopRuntimeServices();
      throw error;
    }
  }

  getApp(): Express {
    return this.app;
  }

  getApiPort(): number {
    return this.apiPort;
  }

  getWebSocketPort(): number {
    return this.wsService?.getPort() || this.wsPort;
  }

  close() {
    const didUnregisterShutdownHandler = this.unregisterShutdownHandler();
    const didCloseApiServer = this.closeApiServer();
    const didStopRuntimeServices = this.stopRuntimeServices();
    this.bridge.destroy();

    if (didUnregisterShutdownHandler || didCloseApiServer || didStopRuntimeServices) {
      console.log('[API] Server closed');
    }
  }
}

export async function startWebServer(
  bot: IBotInstance,
  config?: WebServerConfig,
  webApiAdapter?: IWebApiAdapter,
): Promise<WebServer> {
  const server = new WebServer(bot, config, webApiAdapter);
  await server.start();
  return server;
}
