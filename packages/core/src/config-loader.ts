import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { ICONS } from './cli/cli-runtime';
import type { Config } from './types/legacy';

type ConfigConsole = Pick<Console, 'log'>;

type ConfigFileSystem = Pick<typeof fs, 'existsSync' | 'readFileSync'>;

type ConfigEnvironment = NodeJS.ProcessEnv;

const defaultEnvironmentLoader = (): void => {
  dotenv.config();
};

let hasLoadedConfigEnvironment = false;

export function loadConfigEnvironment(
  environmentLoader: () => void = defaultEnvironmentLoader,
): void {
  if (environmentLoader !== defaultEnvironmentLoader) {
    environmentLoader();
    return;
  }

  if (hasLoadedConfigEnvironment) {
    return;
  }

  environmentLoader();
  hasLoadedConfigEnvironment = true;
}

export function resolveRootConfigPath(baseDir: string = __dirname): string {
  return path.resolve(baseDir, '../../../config.json');
}

export function readBaseConfigFile(
  configPath: string,
  fileSystem: ConfigFileSystem = fs,
): Config {
  if (!fileSystem.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const configFile = fileSystem.readFileSync(configPath, 'utf-8');
  return JSON.parse(configFile) as Config;
}

export function logConfigLoadDebug(
  logger: ConfigConsole,
  configPath: string,
  _config: Config,
  hadMissingDataSubscriptions: boolean,
): void {
  logger.log(`${ICONS.search} DEBUG: Loading config from:`, configPath);

  if (hadMissingDataSubscriptions) {
    logger.log(`${ICONS.warning}  dataSubscriptions missing in config - using defaults`);
  }
}

export function logConfigDefaultsApplied(
  logger: ConfigConsole,
  config: Config,
  hadMissingDataSubscriptions: boolean,
): void {
  if (hadMissingDataSubscriptions) {
    logger.log(`${ICONS.success} dataSubscriptions set to defaults:`, config.dataSubscriptions);
  }
}

export function applyConfigEnvironmentOverrides(
  config: Config,
  environment: ConfigEnvironment = process.env,
): void {
  if (environment.BYBIT_API_KEY || environment.API_KEY) {
    config.exchange.apiKey =
      environment.BYBIT_API_KEY || environment.API_KEY || config.exchange.apiKey;
  }
  if (environment.BYBIT_API_SECRET || environment.API_SECRET) {
    config.exchange.apiSecret =
      environment.BYBIT_API_SECRET || environment.API_SECRET || config.exchange.apiSecret;
  }
  if (environment.BYBIT_TESTNET !== undefined) {
    config.exchange.testnet = environment.BYBIT_TESTNET === 'true';
  }
  if (environment.BYBIT_DEMO !== undefined) {
    config.exchange.demo = environment.BYBIT_DEMO === 'true';
  }
}
