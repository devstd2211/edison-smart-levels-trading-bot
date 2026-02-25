/**
 * Main Entry Point - Edison
 * Initializes and starts the trading bot
 *
 * IMPORTANT:
 * - Graceful shutdown on SIGINT/SIGTERM
 * - Loads config from config.json + .env
 * - Connects to Bybit API (testnet or mainnet)
 * - Starts trading cycle
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { TradingBot } from './bot';
import { BotFactory } from './bot-factory';
import { getConfig } from './config';
import { CONFIDENCE_THRESHOLDS, INTEGER_MULTIPLIERS } from './constants';
import { Config } from './types/legacy';
import { ConfigValidatorService } from './services/config-validator.service';
import { TIME_MULTIPLIERS, TIMING_CONSTANTS } from './constants/technical.constants';
import { startWebServer } from './web';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ============================================================================
// CONSTANTS
// ============================================================================

const SEPARATOR_LENGTH = CONFIDENCE_THRESHOLDS.MODERATE;
const MAINNET_WARNING_DELAY_MS = TIMING_CONSTANTS.MAINNET_WARNING_DELAY_MS;
const MS_TO_SECONDS_DIVISOR = TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND;

// Load ports from .env or use defaults
const API_PORT = parseInt(process.env.API_PORT || '4000', 10);
const WS_PORT = parseInt(process.env.WS_PORT || '4001', 10);

// ============================================================================
// MAIN
// ============================================================================

export async function main(): Promise<void> {
  console.log('='.repeat(SEPARATOR_LENGTH));
  console.log('🤖 Edison - Level-Based Trading Strategy');
  console.log('='.repeat(SEPARATOR_LENGTH));

  try {
    // Load configuration
    console.log('\n[Main] Loading configuration...');
    const config = getConfig();

    // Validate configuration (fast-fail on errors)
    console.log('[Main] Validating configuration...');
    ConfigValidatorService.validateAtStartup(config);

    // Detect active strategy and set window title
    const activeStrategy = detectActiveStrategy(config);
    const windowTitle = `Edison - ${activeStrategy} (${config.exchange.symbol})`;
    process.title = windowTitle;
    console.log(`[Main] Active Strategy: ${activeStrategy}`);

    // Display config summary
    console.log(`[Main] Symbol: ${config.exchange.symbol}`);
    console.log(`[Main] Timeframe: ${config.exchange.timeframe}`);
    console.log(`[Main] Leverage: ${config.trading.leverage}x`);
    console.log(`[Main] Risk: ${config.trading.riskPercent}%`);
    console.log(`[Main] Trading Cycle: ${config.trading.tradingCycleIntervalMs / MS_TO_SECONDS_DIVISOR}s`);

    let modeStr: string;
    if (config.exchange.demo) {
      modeStr = 'DEMO 🎯';
    } else if (config.exchange.testnet) {
      modeStr = 'TESTNET ⚠️';
    } else {
      modeStr = 'MAINNET 🔴';
    }
    console.log(`[Main] Mode: ${modeStr}`);

    // Warning for mainnet
    if (!config.exchange.demo && !config.exchange.testnet) {
      console.log('\n⚠️  WARNING: MAINNET MODE - REAL MONEY AT RISK! ⚠️');
      console.log('⚠️  Press Ctrl+C within 5 seconds to cancel... ⚠️\n');
      await delay(MAINNET_WARNING_DELAY_MS);
    }

    // Initialize trading bot using BotFactory (DI Container)
    console.log('\n[Main] Initializing Trading Bot via BotFactory...');
    const bot = await BotFactory.create({ config });

    // Initialize web server (lazy import to avoid rootDir issues)
    let webServer: { close: () => void } | null = null;
    try {
      console.log('[Main] Initializing Web Server...');
      webServer = await startWebServer(bot, {
        apiPort: API_PORT,
        wsPort: WS_PORT,
      });
      console.log('[Main] ✅ Web Server initialized successfully');
    } catch (error) {
      console.error('[Main] ❌ Web server initialization failed:', error instanceof Error ? error.message : error);
      console.warn('[Main] Continuing without web server - bot can run standalone');
      // Continue without web server - bot can run standalone
    }

    // Setup graceful shutdown
    setupGracefulShutdown(bot, webServer);

    // Start bot
    console.log('[Main] Starting Trading Bot...\n');
    await bot.start();

    // Enable test mode if configured
    const testModeEnabled = config.meta?.testMode === true;
    if (testModeEnabled) {
      bot.enableTestMode();
      console.log('\n🧪 TEST MODE ENABLED - Bot will open test positions without real signals');
    }

    console.log('\n✅ Bot is running! Press Ctrl+C to stop.');
    console.log('📊 Web Interface: http://localhost:3000');
    console.log(`🔌 API: http://localhost:${API_PORT}`);
    console.log(`📡 WebSocket: ws://localhost:${WS_PORT}`);
    console.log('📝 Note: Run web-client dev server in another terminal: cd web-client && npm run dev\n');

  } catch (error) {
    console.error('\n❌ Failed to start bot:', error);
    process.exit(1);
  }
}

/**
 * Detect which strategy is active in the config
 * @param config - Bot configuration
 * @returns Active strategy name
 */
function detectActiveStrategy(config: Config): string {
  // Check scalping strategies first (highest priority)
  if (config.scalpingMicroWall?.enabled) {
    return 'Micro-Wall';
  }
  if (config.scalpingTickDelta?.enabled) {
    return 'Tick Delta';
  }
  if (config.scalpingLadderTp?.enabled) {
    return 'Ladder TP';
  }
  if (config.scalpingLimitOrder?.enabled) {
    return 'Limit Order';
  }
  if (config.scalpingOrderFlow?.enabled) {
    return 'Order Flow';
  }

  // Check whale strategies
  if (config.whaleHunter?.enabled) {
    return 'Whale Hunter';
  }
  if (config.whaleHunterFollow?.enabled) {
    return 'Whale Hunter Follow';
  }

  // Check main strategies
  if (config.strategies?.levelBased?.enabled) {
    return 'Level Based';
  }

  return 'Mixed Strategies';
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(bot: TradingBot, webServer?: { close: () => void } | null): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    // Prevent multiple shutdown calls
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(`\n[Main] Received ${signal} - shutting down gracefully...`);

    try {
      bot.stop();

      // Close web server
      if (webServer) {
        webServer.close();
      }

      // Give WebSocket connections time to close properly
      await delay(INTEGER_MULTIPLIERS.FIVE_HUNDRED);

      console.log('[Main] Bot stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('[Main] Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  // Handle SIGTERM (Docker, systemd, etc)
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('\n❌ Uncaught Exception:', error);
    void shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('\n❌ Unhandled Promise Rejection:', reason);
    void shutdown('unhandledRejection');
  });
}

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ============================================================================
// START
// ============================================================================

// Start the bot
void main();
