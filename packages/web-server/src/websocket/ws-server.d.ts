/**
 * WebSocket Server
 *
 * Handles real-time communication with frontend clients.
 * Broadcasts bot events and market data updates.
 */
import { BotBridgeService } from '../services/bot-bridge.service.js';
export declare class WebSocketService {
    private bridge;
    private wss;
    private clients;
    private heartbeatInterval;
    constructor(port: number, bridge: BotBridgeService);
    /**
     * Setup new client connections
     */
    private setupConnectionHandling;
    /**
     * Forward bot events to WebSocket clients
     */
    private setupEventForwarding;
    /**
     * Handle incoming messages from clients
     */
    private handleMessage;
    /**
     * Send message to single client
     */
    private send;
    /**
     * Broadcast message to all connected clients
     */
    private broadcast;
    /**
     * Send heartbeat to keep connections alive
     */
    private startHeartbeat;
    /**
     * Close WebSocket server
     */
    close(): void;
    /**
     * Get number of connected clients
     */
    getClientCount(): number;
}
