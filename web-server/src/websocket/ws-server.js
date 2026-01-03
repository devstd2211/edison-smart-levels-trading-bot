"use strict";
/**
 * WebSocket Server
 *
 * Handles real-time communication with frontend clients.
 * Broadcasts bot events and market data updates.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const ws_1 = __importDefault(require("ws"));
class WebSocketService {
    constructor(port, bridge) {
        this.bridge = bridge;
        this.clients = new Set();
        this.heartbeatInterval = null;
        this.wss = new ws_1.default.Server({ port });
        this.setupConnectionHandling();
        this.setupEventForwarding();
        this.startHeartbeat();
    }
    /**
     * Setup new client connections
     */
    setupConnectionHandling() {
        this.wss.on('connection', (ws) => {
            console.log(`[WS] New client connected. Total: ${this.clients.size + 1}`);
            this.clients.add(ws);
            // Send initial bot status
            this.bridge.getStatus().then((status) => {
                this.send(ws, {
                    type: 'BOT_STATUS_CHANGE',
                    payload: status,
                    timestamp: Date.now(),
                });
            });
            ws.on('message', (message) => {
                this.handleMessage(ws, message);
            });
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
            });
            ws.on('error', (error) => {
                console.error('[WS] Client error:', error.message);
            });
        });
    }
    /**
     * Forward bot events to WebSocket clients
     */
    setupEventForwarding() {
        this.bridge.on('bot-event', (event) => {
            this.broadcast(event);
        });
    }
    /**
     * Handle incoming messages from clients
     */
    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            console.log('[WS] Received:', data.type);
            switch (data.type) {
                case 'PING':
                    this.send(ws, {
                        type: 'PONG',
                        payload: {},
                        timestamp: Date.now(),
                    });
                    break;
                case 'GET_STATUS':
                    this.bridge.getStatus().then((status) => {
                        this.send(ws, {
                            type: 'BOT_STATUS_CHANGE',
                            payload: status,
                            timestamp: Date.now(),
                        });
                    });
                    break;
                case 'GET_POSITION':
                    const position = this.bridge.getPosition();
                    this.send(ws, {
                        type: 'POSITION_UPDATE',
                        payload: { position },
                        timestamp: Date.now(),
                    });
                    break;
                default:
                    console.log('[WS] Unknown message type:', data.type);
            }
        }
        catch (error) {
            console.error('[WS] Error handling message:', error);
            this.send(ws, {
                type: 'ERROR',
                payload: { error: 'Invalid message format' },
                timestamp: Date.now(),
            });
        }
    }
    /**
     * Send message to single client
     */
    send(ws, message) {
        if (ws.readyState === ws_1.default.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    /**
     * Broadcast message to all connected clients
     */
    broadcast(message) {
        const data = JSON.stringify(message);
        this.clients.forEach((client) => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(data);
            }
        });
    }
    /**
     * Send heartbeat to keep connections alive
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.clients.forEach((ws) => {
                if (ws.readyState === ws_1.default.OPEN) {
                    ws.ping(() => { });
                }
            });
        }, 30000); // 30 seconds
    }
    /**
     * Close WebSocket server
     */
    close() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.clients.forEach((client) => client.close());
        this.wss.close();
        console.log('[WS] Server closed');
    }
    /**
     * Get number of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=ws-server.js.map