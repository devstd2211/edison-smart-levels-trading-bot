import * as dotenv from 'dotenv';
import { BybitService } from './services/bybit';
import { LoggerService } from './services/logger.service';
import {
  printStandaloneScriptBanner,
  printStandaloneScriptFooter,
  printStandaloneScriptMessageBlock,
} from './standalone-script-console';
import { LogLevel } from './types/enums';
import type { ExchangeConfig } from './types/legacy';
import { ICONS } from './cli/cli-runtime';

export type BybitCredentials = {
  apiKey: string;
  apiSecret: string;
};

type TestBalanceEnvironment = NodeJS.ProcessEnv;

type TestBalanceRuntimeFactories = {
  createLogger?: () => LoggerService;
};

export type TestBalanceRuntimeSetup = {
  logger: LoggerService;
  credentials: BybitCredentials;
  exchangeConfig: ExchangeConfig;
};

export type TestBalanceWorkflowRuntime = {
  bybitService: TestBalanceBybitService;
  consoleRef: TestBalanceConsole;
  processRef: TestBalanceProcessLike;
  setup: TestBalanceRuntimeSetup;
};

type TestBalanceConsole = Pick<typeof console, 'error' | 'log'>;

type TestBalanceProcessLike = {
  exit(code: number): void;
};

type TestBalanceBybitService = Pick<
  BybitService,
  'getBalance' | 'getCandles' | 'getCurrentPrice' | 'getPosition' | 'getServerTime'
>;

type TestBalanceWorkflowDependencies = TestBalanceRuntimeFactories & {
  consoleRef?: TestBalanceConsole;
  createBybitService?: (
    exchangeConfig: ExchangeConfig,
    logger: LoggerService,
  ) => TestBalanceBybitService;
  environment?: TestBalanceEnvironment;
  environmentLoader?: () => void;
  processRef?: TestBalanceProcessLike;
};

export const TEST_BALANCE_DEFAULT_EXCHANGE_SETTINGS = {
  symbol: 'BTCUSDT',
  timeframe: '15',
  demo: true,
  testnet: false,
} as const;

const MISSING_TEST_BALANCE_CREDENTIALS_ERROR_MESSAGE =
  'Missing BYBIT_API_KEY or BYBIT_API_SECRET in .env file';

export function loadTestBalanceEnvironment(
  environmentLoader: () => void = () => {
    dotenv.config();
  },
): void {
  environmentLoader();
}

export function readTestBalanceCredentials(
  environment: TestBalanceEnvironment = process.env,
): BybitCredentials {
  const apiKey = environment.BYBIT_API_KEY;
  const apiSecret = environment.BYBIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(MISSING_TEST_BALANCE_CREDENTIALS_ERROR_MESSAGE);
  }

  return {
    apiKey,
    apiSecret,
  };
}

export function createTestBalanceLogger(): LoggerService {
  return new LoggerService(LogLevel.DEBUG, './logs', true);
}

export function createTestBalanceExchangeConfig(
  credentials: BybitCredentials,
): ExchangeConfig {
  return {
    name: 'bybit',
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    ...TEST_BALANCE_DEFAULT_EXCHANGE_SETTINGS,
  };
}

export function prepareTestBalanceRuntime(
  options: {
    environmentLoader?: () => void;
    environment?: TestBalanceEnvironment;
  } & TestBalanceRuntimeFactories = {},
): TestBalanceRuntimeSetup {
  loadTestBalanceEnvironment(options.environmentLoader);

  const logger = options.createLogger?.() ?? createTestBalanceLogger();
  const credentials = readTestBalanceCredentials(options.environment);

  return {
    logger,
    credentials,
    exchangeConfig: createTestBalanceExchangeConfig(credentials),
  };
}

export function createTestBalanceWorkflowRuntime(
  options: TestBalanceWorkflowDependencies = {},
): TestBalanceWorkflowRuntime {
  const setup = prepareTestBalanceRuntime(options);
  const consoleRef = options.consoleRef ?? console;
  const processRef = options.processRef ?? process;
  const bybitService =
    options.createBybitService?.(setup.exchangeConfig, setup.logger) ??
    new BybitService(setup.exchangeConfig, setup.logger);

  return {
    bybitService,
    consoleRef,
    processRef,
    setup,
  };
}

export async function runTestBalanceChecks(
  runtime: TestBalanceWorkflowRuntime,
): Promise<void> {
  const { bybitService, consoleRef, processRef, setup } = runtime;
  const { credentials, exchangeConfig, logger } = setup;

  printStandaloneScriptBanner(consoleRef, 'Bybit Demo API Connection Test', ICONS.robot);

  const logFilePath = logger.getLogFilePath();
  if (logFilePath) {
    printStandaloneScriptFooter(consoleRef, `${ICONS.note} Log file: ${logFilePath}`);
  }

  logger.info('API credentials loaded from .env');
  logger.debug('API Key length', { length: credentials.apiKey.length });

  logger.info('Initializing Bybit service (DEMO mode)');

  try {
    logger.info(`\n${ICONS.clipboard} Test 1: Getting server time...`);
    const serverTime = await bybitService.getServerTime();
    logger.info(`${ICONS.success} Server time retrieved`, {
      serverTime: new Date(serverTime).toISOString(),
      timestamp: serverTime,
    });

    logger.info(`\n${ICONS.clipboard} Test 2: Getting wallet balance...`);
    const balance = await bybitService.getBalance();
    logger.info(`${ICONS.success} Wallet balance retrieved`, {
      balance: `${balance} USDT`,
    });

    printStandaloneScriptMessageBlock(
      consoleRef,
      `USDT Balance: ${balance}`,
      ICONS.money,
    );

    logger.info(`\n${ICONS.clipboard} Test 3: Getting current BTC price...`);
    const currentPrice = await bybitService.getCurrentPrice();
    logger.info(`${ICONS.success} Current price retrieved`, {
      price: currentPrice,
      symbol: exchangeConfig.symbol,
    });

    consoleRef.log(`${ICONS.chart} BTC Price: ${currentPrice} USDT\n`);

    logger.info(`\n${ICONS.clipboard} Test 4: Getting candles...`);
    const candles = await bybitService.getCandles(10);
    if (candles) {
      logger.info(`${ICONS.success} Candles retrieved`, {
        count: candles.length,
        firstCandle: candles[0],
        lastCandle: candles[candles.length - 1],
      });

      consoleRef.log(`${ICONS.candle} Candles retrieved: ${candles.length}`);
      consoleRef.log(
        `   First: ${new Date(candles[0].timestamp).toISOString()} - Close: ${candles[0].close}`,
      );
      consoleRef.log(
        `   Last: ${new Date(candles[candles.length - 1].timestamp).toISOString()} - Close: ${candles[candles.length - 1].close}\n`,
      );
    } else {
      logger.warn('No candles retrieved');
      consoleRef.log(`${ICONS.candle} No candles retrieved\n`);
    }

    logger.info(`\n${ICONS.clipboard} Test 5: Checking open positions...`);
    const position = await bybitService.getPosition();
    if (position) {
      logger.warn('Position exists', {
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
      });
    } else {
      logger.info(`${ICONS.success} No open positions`);
      consoleRef.log(`${ICONS.chart} No open positions\n`);
    }

    logger.info('\n========================================');
    logger.info(`${ICONS.success} ALL TESTS PASSED!`);
    logger.info('========================================');

    printStandaloneScriptFooter(
      consoleRef,
      `${ICONS.success} All tests passed! API connection is working correctly.`,
    );
    if (logFilePath) {
      printStandaloneScriptFooter(
        consoleRef,
        `${ICONS.note} Check detailed logs in: ${logFilePath}`,
      );
    }
  } catch (error) {
    logger.error(`${ICONS.error} Test failed`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    consoleRef.error(`\n${ICONS.error} Test failed! Check logs for details.\n`);
    consoleRef.error(error);
    processRef.exit(1);
  }
}

export async function runTestBalanceWorkflow(
  options: TestBalanceWorkflowDependencies = {},
): Promise<void> {
  try {
    const runtime = createTestBalanceWorkflowRuntime(options);
    await runTestBalanceChecks(runtime);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== MISSING_TEST_BALANCE_CREDENTIALS_ERROR_MESSAGE
    ) {
      throw error;
    }

    const logger = options.createLogger?.() ?? createTestBalanceLogger();
    logger.error('Missing API credentials in .env file');
    logger.error('Please set BYBIT_API_KEY and BYBIT_API_SECRET');
    (options.processRef ?? process).exit(1);
  }
}
