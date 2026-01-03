/**
 * Bot Control Routes
 *
 * API endpoints for bot management:
 * - GET /api/bot/status - Get bot status
 * - POST /api/bot/start - Start bot
 * - POST /api/bot/stop - Stop bot
 */
import { Router } from 'express';
import { BotBridgeService } from '../services/bot-bridge.service.js';
export declare function createBotRoutes(bridge: BotBridgeService): Router;
