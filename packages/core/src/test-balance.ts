/**
 * Test Balance Script
 * Simple script to test Bybit Demo API connection
 * and fetch wallet balance
 */

import { BybitService } from './services/bybit';
import { ICONS } from './cli/cli-runtime';
import {
  createStandaloneEntrypointRunners,
} from './standalone-entrypoint-runtime';
import {
  createTestBalanceLogger,
  prepareTestBalanceRuntime,
} from './test-balance.entrypoint';
import {
  printStandaloneScriptBanner,
  printStandaloneScriptFooter,
} from './standalone-script-console';

export async function main(): Promise<void> {
  let logger: ReturnType<typeof prepareTestBalanceRuntime>['logger'];
  let credentials: ReturnType<typeof prepareTestBalanceRuntime>['credentials'];
  let exchangeConfig: ReturnType<typeof prepareTestBalanceRuntime>['exchangeConfig'];

  try {
    ({ logger, credentials, exchangeConfig } = prepareTestBalanceRuntime());
  } catch (_error) {
    logger = createTestBalanceLogger();
    logger.error('Missing API credentials in .env file');
    logger.error('Please set BYBIT_API_KEY and BYBIT_API_SECRET');
    process.exit(1);
    return;
  }

  printStandaloneScriptBanner(console, 'Bybit Demo API Connection Test', ICONS.robot);

  const logFilePath = logger.getLogFilePath();
  if (logFilePath) {
    printStandaloneScriptFooter(console, `${ICONS.note} Log file: ${logFilePath}`);
  }

  logger.info('API credentials loaded from .env');
  logger.debug('API Key length', { length: credentials.apiKey.length });

  logger.info('Initializing Bybit service (DEMO mode)');
  const bybitService = new BybitService(exchangeConfig, logger);

  try {
    // Test 1: Get server time
    logger.info(`
${ICONS.clipboard} Test 1: Getting server time...`);
    const serverTime = await bybitService.getServerTime();
    logger.info(`${ICONS.success} Server time retrieved`, {
      serverTime: new Date(serverTime).toISOString(),
      timestamp: serverTime,
    });

    // Test 2: Get balance
    logger.info(`
${ICONS.clipboard} Test 2: Getting wallet balance...`);
    const balance = await bybitService.getBalance();
    logger.info(`${ICONS.success} Wallet balance retrieved`, {
      balance: `${balance} USDT`,
    });

    console.log('\n========================================');
    console.log(`${ICONS.money} USDT Balance: ${balance}`);
    console.log('========================================\n');

    // Test 3: Get current price
    logger.info(`
${ICONS.clipboard} Test 3: Getting current BTC price...`);
    const currentPrice = await bybitService.getCurrentPrice();
    logger.info(`${ICONS.success} Current price retrieved`, {
      price: currentPrice,
      symbol: 'BTCUSDT',
    });

    console.log(`${ICONS.chart} BTC Price: ${currentPrice} USDT
`);

    // Test 4: Get candles
    logger.info(`
${ICONS.clipboard} Test 4: Getting candles...`);
    const candles = await bybitService.getCandles(10); // Get only 10 candles for test
    if (candles) {
      logger.info(`${ICONS.success} Candles retrieved`, {
        count: candles.length,
        firstCandle: candles[0],
        lastCandle: candles[candles.length - 1],
      });

      console.log(`${ICONS.candle} Candles retrieved: ${candles.length}`);
      console.log(`   First: ${new Date(candles[0].timestamp).toISOString()} - Close: ${candles[0].close}`);
      console.log(`   Last: ${new Date(candles[candles.length - 1].timestamp).toISOString()} - Close: ${candles[candles.length - 1].close}\n`);
    } else {
      logger.warn('No candles retrieved');
      console.log(`${ICONS.candle} No candles retrieved
`);
    }

    // Test 5: Get position (should be null for new account)
    logger.info(`
${ICONS.clipboard} Test 5: Checking open positions...`);
    const position = await bybitService.getPosition();
    if (position) {
      logger.warn('Position exists', {
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
      });
    } else {
      logger.info(`${ICONS.success} No open positions`);
      console.log(`${ICONS.chart} No open positions
`);
    }

    logger.info('\n========================================');
    logger.info(`${ICONS.success} ALL TESTS PASSED!`);
    logger.info('========================================');

    printStandaloneScriptFooter(
      console,
      `${ICONS.success} All tests passed! API connection is working correctly.`,
    );
    if (logFilePath) {
      printStandaloneScriptFooter(
        console,
        `${ICONS.note} Check detailed logs in: ${logFilePath}`,
      );
    }

  } catch (error) {
    logger.error(`${ICONS.error} Test failed`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.error(`\n${ICONS.error} Test failed! Check logs for details.\n`);
    console.error(error);
    process.exit(1);
  }
}

const testBalanceEntrypointRunners = createStandaloneEntrypointRunners(main);

export const runTestBalanceEntrypoint = testBalanceEntrypointRunners.runEntrypoint;
export const runTestBalanceEntrypointIfMain = testBalanceEntrypointRunners.runEntrypointIfMain;

void runTestBalanceEntrypointIfMain(module, require.main);
