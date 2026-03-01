/**
 * Config Routes
 *
 * Endpoints for configuration management
 */
import { Router } from 'express';
export interface BotConfig {
    [key: string]: any;
}
export declare function createConfigRoutes(configPath?: string): Router;
