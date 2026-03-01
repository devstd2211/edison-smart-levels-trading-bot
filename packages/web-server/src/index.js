"use strict";
/**
 * Web Server Entry Point
 *
 * Initializes Express API server and WebSocket server.
 * Connects to trading bot via BotBridgeService.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebServer = void 0;
exports.startWebServer = startWebServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path = __importStar(require("path"));
const bot_bridge_service_js_1 = require("./services/bot-bridge.service.js");
const ws_server_js_1 = require("./websocket/ws-server.js");
const bot_routes_js_1 = require("./routes/bot.routes.js");
const data_routes_js_1 = require("./routes/data.routes.js");
const config_routes_js_1 = require("./routes/config.routes.js");
const API_PORT = 4000;
const WS_PORT = 4001;
class WebServer {
    constructor(bot, config = {}) {
        this.bot = bot;
        this.wsService = null;
        this.app = (0, express_1.default)();
        this.bridge = new bot_bridge_service_js_1.BotBridgeService(bot);
        const apiPort = config.apiPort || API_PORT;
        const wsPort = config.wsPort || WS_PORT;
        this.setupMiddleware();
        this.setupRoutes(apiPort);
        this.setupWebSocket(wsPort);
    }
    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.urlencoded({ extended: true }));
        this.app.use((0, cors_1.default)());
        // Logging middleware
        this.app.use((req, _res, next) => {
            console.log(`[API] ${req.method} ${req.path}`);
            next();
        });
    }
    /**
     * Setup API routes
     */
    setupRoutes(port) {
        const botRoutes = (0, bot_routes_js_1.createBotRoutes)(this.bridge);
        const dataRoutes = (0, data_routes_js_1.createDataRoutes)(this.bridge);
        const configPath = path.resolve(process.cwd(), 'config.json');
        const configRoutes = (0, config_routes_js_1.createConfigRoutes)(configPath);
        this.app.use('/api/bot', botRoutes);
        this.app.use('/api/data', dataRoutes);
        this.app.use('/api/config', configRoutes);
        // Health check
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                timestamp: Date.now(),
                botRunning: this.bridge.isRunning(),
            });
        });
        // Start Express server
        this.app.listen(port, () => {
            console.log(`[API] Server running on http://localhost:${port}`);
        });
    }
    /**
     * Setup WebSocket server
     */
    setupWebSocket(port) {
        this.wsService = new ws_server_js_1.WebSocketService(port, this.bridge);
        console.log(`[WS] Server running on ws://localhost:${port}`);
    }
    /**
     * Close server gracefully
     */
    close() {
        if (this.wsService) {
            this.wsService.close();
        }
        console.log('[API] Server closed');
    }
}
exports.WebServer = WebServer;
/**
 * Standalone mode - used for testing without bot
 */
async function startWebServer(bot, config) {
    const server = new WebServer(bot, config);
    return server;
}
//# sourceMappingURL=index.js.map