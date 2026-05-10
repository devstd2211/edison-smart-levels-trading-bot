/**
 * Test Balance Script
 * Simple script to test Bybit Demo API connection
 * and fetch wallet balance
 */

import * as dotenv from 'dotenv';
import { BybitService } from './services/bybit';
import { LoggerService } from './services/logger.service';
import { LogLevel } from './types/enums';
import { ExchangeConfig } from './types/legacy';
import { ICONS } from './cli/cli-runtime';

// Load environment variables
dotenv.config();

async function main(): Promise<void> {
  // Initialize logger with DEBUG level
  const logger = new LoggerService(LogLevel.DEBUG, './logs', true);

  console.log('\n========================================');
  console.log(`${ICONS.robot} Bybit Demo API Connection Test`);
  console.log('========================================\n');

  const logFilePath = logger.getLogFilePath();
  if (logFilePath) {
    console.log(`${ICONS.note} Log file: ${logFilePath}
`);
  }

  // Check environment variables
  const apiKey = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    logger.error('Missing API credentials in .env file');
    logger.error('Please set BYBIT_API_KEY and BYBIT_API_SECRET');
    process.exit(1);
  }

  logger.info('API credentials loaded from .env');
  logger.debug('API Key length', { length: apiKey.length });

  // Configure Bybit service for DEMO
  const exchangeConfig: ExchangeConfig = {
    name: 'bybit',
    apiKey,
    apiSecret,
    symbol: 'BTCUSDT',
    timeframe: '15',
    demo: true, // DEMO mode
    testnet: false,
  };

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

    console.log(`
${ICONS.success} All tests passed! API connection is working correctly.
`);
    console.log(`${ICONS.note} Check detailed logs in: ${logFilePath}
`);

  } catch (error) {
    logger.error(`${ICONS.error} Test failed`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.error(`
${ICONS.error} Test failed! Check logs for details.
`);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
