import { CONFIDENCE_THRESHOLDS } from '../constants';
import { TIME_MULTIPLIERS, TIMING_CONSTANTS } from '../constants/technical.constants';
import type { Config } from '../types/legacy';

export type CliPorts = {
  apiPort: number;
  wsPort: number;
};

export const CLI_SEPARATOR_LENGTH = CONFIDENCE_THRESHOLDS.MODERATE;
export const MAINNET_WARNING_DELAY_MS = TIMING_CONSTANTS.MAINNET_WARNING_DELAY_MS;
export const MS_TO_SECONDS_DIVISOR = TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND;

const DEFAULT_API_PORT = 4000;
const DEFAULT_WS_PORT = 4001;

export const ICONS = {
  robot: '\u{1F916}',
  demo: '\u{1F3AF}',
  warning: '\u{26A0}\u{FE0F}',
  error: '\u{274C}',
  mainnet: '\u{1F534}',
  success: '\u{2705}',
  test: '\u{1F9EA}',
  money: '\u{1F4B0}',
  chart: '\u{1F4CA}',
  plug: '\u{1F50C}',
  satellite: '\u{1F4E1}',
  note: '\u{1F4DD}',
} as const;

function parsePort(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveCliPorts(env: NodeJS.ProcessEnv): CliPorts {
  return {
    apiPort: parsePort(env.API_PORT, DEFAULT_API_PORT),
    wsPort: parsePort(env.WS_PORT, DEFAULT_WS_PORT),
  };
}

export function detectActiveStrategy(config: Config): string {
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
  if (config.whaleHunter?.enabled) {
    return 'Whale Hunter';
  }
  if (config.whaleHunterFollow?.enabled) {
    return 'Whale Hunter Follow';
  }
  if (config.strategies?.levelBased?.enabled) {
    return 'Level Based';
  }

  return 'Mixed Strategies';
}

export function isMainnetMode(config: Config): boolean {
  return !config.exchange.demo && !config.exchange.testnet;
}

export function formatExchangeMode(config: Config): string {
  if (config.exchange.demo) {
    return `DEMO ${ICONS.demo}`;
  }
  if (config.exchange.testnet) {
    return `TESTNET ${ICONS.warning}`;
  }

  return `MAINNET ${ICONS.mainnet}`;
}
