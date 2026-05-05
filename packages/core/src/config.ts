/**
 * Configuration Loader
 * Loads config from config.json and applies environment variables
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Config } from './types/legacy';
import { normalizeWebApiConfig } from './config/web-api-config';
import { validateRiskManagementConfig } from './config/risk-management.validate';

// Load .env file
dotenv.config();

/**
 * Load configuration from config.json and apply environment variables.
 *
 * Strategy merging is handled by ConfigPipeline.
 */
export function getConfig(): Config {
  const configPath = path.resolve(__dirname, '../../../config.json');

  console.log('🔍 DEBUG: Loading config from:', configPath);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const configFile = fs.readFileSync(configPath, 'utf-8');
  const config: Config = JSON.parse(configFile) as Config;

  console.log('🔍 DEBUG: Config loaded. scalpingLadderTp exists:', !!config.scalpingLadderTp, 'enabled:', config.scalpingLadderTp?.enabled);
  console.log('🔍 DEBUG: entryConfig.divergenceDetector:', JSON.stringify(config.entryConfig?.divergenceDetector || 'MISSING'));
  // Set defaults for dataSubscriptions (if not present in config)
  if (!config.dataSubscriptions) {
    console.log('⚠️  dataSubscriptions missing in config - using defaults');
    config.dataSubscriptions = {
      candles: {
        enabled: true,              // Default: subscribe to candles
        calculateIndicators: true,  // Default: calculate indicators
      },
      orderbook: {
        enabled: config.orderBook?.enabled ?? false,  // Inherit from old orderBook config
        updateIntervalMs: 5000,     // Default: 5s throttle
      },
      ticks: {
        enabled: false,             // Default: disabled (only for specific strategies)
        calculateDelta: config.delta?.enabled ?? false,  // Inherit from old delta config
      },
    };
    console.log('✅ dataSubscriptions set to defaults:', config.dataSubscriptions);
  }

  config.webApi = normalizeWebApiConfig(config.webApi);

  // Override with environment variables if present
  // Support both BYBIT_* and legacy API_* prefixes
  if (process.env.BYBIT_API_KEY || process.env.API_KEY) {
    config.exchange.apiKey = process.env.BYBIT_API_KEY || process.env.API_KEY || config.exchange.apiKey;
  }
  if (process.env.BYBIT_API_SECRET || process.env.API_SECRET) {
    config.exchange.apiSecret = process.env.BYBIT_API_SECRET || process.env.API_SECRET || config.exchange.apiSecret;
  }
  if (process.env.BYBIT_TESTNET !== undefined) {
    config.exchange.testnet = process.env.BYBIT_TESTNET === 'true';
  }
  if (process.env.BYBIT_DEMO !== undefined) {
    config.exchange.demo = process.env.BYBIT_DEMO === 'true';
  }

  // =========================================================================
  // VALIDATE RISKMANAGEMENT CONFIG (NEW - Session 29.4c)
  // =========================================================================
  validateRiskManagementConfig(config);

  return config;
}
