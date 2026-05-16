/**
 * CLI Entrypoint - Edison
 * Initializes and starts the trading bot with CLI UX.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { loadRuntimeConfig } from '../config/index';
import { createWebServerRuntime, startWebServer } from '../web';
import { createBotRuntime } from '../core';
import {
  CLI_SEPARATOR_LENGTH,
  detectActiveStrategy,
  formatExchangeMode,
  ICONS,
  isMainnetMode,
  MAINNET_WARNING_DELAY_MS,
  MS_TO_SECONDS_DIVISOR,
  resolveCliPorts,
} from './cli-runtime';
import { setupGracefulShutdown } from './cli-shutdown';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function main(): Promise<void> {
  const ports = resolveCliPorts(process.env);

  console.log('='.repeat(CLI_SEPARATOR_LENGTH));
  console.log(`${ICONS.robot} Edison - Level-Based Trading Strategy`);
  console.log('='.repeat(CLI_SEPARATOR_LENGTH));

  try {
    console.log('\n[Main] Loading configuration...');
    console.log('[Main] Validating configuration...');
    const config = await loadRuntimeConfig();

    const activeStrategy = detectActiveStrategy(config);
    const windowTitle = `Edison - ${activeStrategy} (${config.exchange.symbol})`;
    process.title = windowTitle;
    console.log(`[Main] Active Strategy: ${activeStrategy}`);

    console.log(`[Main] Symbol: ${config.exchange.symbol}`);
    console.log(`[Main] Timeframe: ${config.exchange.timeframe}`);
    console.log(`[Main] Leverage: ${config.trading.leverage}x`);
    console.log(`[Main] Risk: ${config.trading.riskPercent}%`);
    console.log(`[Main] Trading Cycle: ${config.trading.tradingCycleIntervalMs / MS_TO_SECONDS_DIVISOR}s`);
    console.log(`[Main] Mode: ${formatExchangeMode(config)}`);

    if (isMainnetMode(config)) {
      console.log(`\n${ICONS.warning}  WARNING: MAINNET MODE - REAL MONEY AT RISK! ${ICONS.warning}`);
      console.log(`${ICONS.warning}  Press Ctrl+C within 5 seconds to cancel... ${ICONS.warning}\n`);
      await delay(MAINNET_WARNING_DELAY_MS);
    }

    console.log('\n[Main] Initializing Trading Bot via BotFactory...');
    const runtime = await createBotRuntime(config);
    const { bot, webApiAdapter } = runtime;

    let webServer: { close: () => void } | null = null;
    try {
      console.log('[Main] Initializing Web Server...');
      webServer = await startWebServer(createWebServerRuntime(bot, webApiAdapter), ports);
      console.log(`[Main] ${ICONS.success} Web Server initialized successfully`);
    } catch (error) {
      console.error('[Main] Web server initialization failed:', error instanceof Error ? error.message : error);
      console.warn('[Main] Continuing without web server - bot can run standalone');
    }

    setupGracefulShutdown(bot, webServer);

    console.log('[Main] Starting Trading Bot...\n');
    await bot.start();

    if (config.meta?.testMode === true) {
      bot.enableTestMode();
      console.log(`\n${ICONS.test} TEST MODE ENABLED - Bot will open test positions without real signals`);
    }

    console.log(`\n${ICONS.success} Bot is running! Press Ctrl+C to stop.`);
    console.log(`${ICONS.chart} Web Interface: http://localhost:3000`);
    console.log(`${ICONS.plug} API: http://localhost:${ports.apiPort}`);
    console.log(`${ICONS.satellite} WebSocket: ws://localhost:${ports.wsPort}`);
    console.log(`${ICONS.note} Note: Run web-client dev server in another terminal: cd packages/web-client && npm run dev\n`);
  } catch (error) {
    console.error('\n[Main] Failed to start bot:', error);
    process.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

if (require.main === module) {
  void main();
}
