import * as dotenv from 'dotenv';
import { LoggerService } from './services/logger.service';
import { LogLevel } from './types/enums';
import type { ExchangeConfig } from './types/legacy';

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

export const TEST_BALANCE_DEFAULT_EXCHANGE_SETTINGS = {
  symbol: 'BTCUSDT',
  timeframe: '15',
  demo: true,
  testnet: false,
} as const;

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
    throw new Error('Missing BYBIT_API_KEY or BYBIT_API_SECRET in .env file');
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
