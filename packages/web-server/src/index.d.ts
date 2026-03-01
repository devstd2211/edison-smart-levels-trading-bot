/**
 * Web Server Entry Point
 *
 * Initializes Express API server and WebSocket server.
 * Connects to trading bot via BotBridgeService.
 */
import { type IBotInstance } from './services/bot-bridge.service.js';
export interface WebServerConfig {
    apiPort?: number;
    wsPort?: number;
}
export declare class WebServer {
    private bot;
    private app;
    private bridge;
    private wsService;
    constructor(bot: IBotInstance, config?: WebServerConfig);
    /**
     * Setup Express middleware
     */
    private setupMiddleware;
    /**
     * Setup API routes
     */
    private setupRoutes;
    /**
     * Setup WebSocket server
     */
    private setupWebSocket;
    /**
     * Close server gracefully
     */
    close(): void;
}
/**
 * Standalone mode - used for testing without bot
 */
export declare function startWebServer(bot: IBotInstance, config?: WebServerConfig): Promise<WebServer>;
