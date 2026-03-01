/**
 * Data Routes
 *
 * API endpoints for data retrieval:
 * - GET /api/data/position - Current position
 * - GET /api/data/balance - Current balance
 * - GET /api/data/market - Market data (indicators)
 * - GET /api/data/signals/recent - Recent signals
 */
import { Router } from 'express';
import { BotBridgeService } from '../services/bot-bridge.service.js';
export declare function createDataRoutes(bridge: BotBridgeService): Router;
