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

export const CLI_DEFAULT_PORTS: CliPorts = {
  apiPort: 4000,
  wsPort: 4001,
} as const;

export const CLI_PORT_ENV_KEYS = {
  apiPort: 'API_PORT',
  wsPort: 'WS_PORT',
} as const;

export const CLI_WEB_CLIENT_DEV_SERVER = {
  command: 'cd packages/web-client && npm run dev',
  port: 3000,
} as const;

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
  alarm: '\u{1F6A8}',
  alarm_clock: '\u23F0',
  arrow_down: '\u2B07',
  arrow_right: '\u27A1',
  arrow_up: '\u2B06',
  balance: '\u2696',
  bolt: '\u26A1',
  book_open: '\u{1F4D6}',
  books: '\u{1F4DA}',
  brain: '\u{1F9E0}',
  briefcase: '\u{1F4BC}',
  broken_heart: '\u{1F494}',
  broom: '\u{1F9F9}',
  bug: '\u{1F41B}',
  cabinet: '\u{1F5C4}',
  calendar: '\u{1F4C5}',
  candle: '\u{1F56F}',
  chart_down: '\u{1F4C9}',
  chart_up: '\u{1F4C8}',
  clipboard: '\u{1F4CB}',
  construction: '\u{1F3D7}\uFE0F',
  controls: '\u{1F39B}',
  dollar_note: '\u{1F4B5}',
  door: '\u{1F6AA}',
  end: '\u{1F51A}',
  fire: '\u{1F525}',
  first_place: '\u{1F947}',
  folder: '\u{1F4C1}',
  gear: '\u2699\uFE0F',
  gem: '\u{1F48E}',
  green_circle: '\u{1F7E2}',
  handshake: '\u{1F91D}',
  hourglass: '\u23F3',
  inbox: '\u{1F4E5}',
  info: '\u2139',
  keycap_1: '\u0031\uFE0F\u20E3',
  keycap_2: '\u0032\uFE0F\u20E3',
  keycap_3: '\u0033\uFE0F\u20E3',
  keycap_4: '\u0034\uFE0F\u20E3',
  label: '\u{1F3F7}',
  light_bulb: '\u{1F4A1}',
  link: '\u{1F517}',
  megaphone: '\u{1F4E2}',
  microscope: '\u{1F52C}',
  money_out: '\u{1F4B8}',
  muted: '\u{1F507}',
  no_entry: '\u{1F6AB}',
  no_entry_sign: '\u26D4',
  numbers: '\u{1F522}',
  one_oclock: '\u{1F550}',
  open_folder: '\u{1F4C2}',
  outbox: '\u{1F4E4}',
  package: '\u{1F4E6}',
  page: '\u{1F4C4}',
  palette: '\u{1F3A8}',
  party: '\u{1F389}',
  pause: '\u23F8',
  pin: '\u{1F4CD}',
  ping_pong: '\u{1F3D3}',
  pray: '\u{1F64F}',
  pushpin: '\u{1F4CC}',
  question: '\u2753',
  red_circle: '\u{1F534}',
  refresh: '\u{1F504}',
  reply_left: '\u21A9',
  rocket: '\u{1F680}',
  ruler: '\u{1F4CF}',
  save: '\u{1F4BE}',
  search: '\u{1F50D}',
  second_place: '\u{1F948}',
  shield: '\u{1F6E1}',
  small_blue_diamond: '\u{1F539}',
  sparkles: '\u2728',
  star: '\u2B50',
  stop: '\u{1F6D1}',
  stopwatch: '\u23F1',
  target: '\u{1F3AF}',
  thinking: '\u{1F914}',
  third_place: '\u{1F949}',
  thought: '\u{1F4AD}',
  tornado: '\u{1F32A}',
  trophy: '\u{1F3C6}',
  whale: '\u{1F40B}',
  white_circle: '\u26AA',
  wrench: '\u{1F527}',
  yellow_circle: '\u{1F7E1}',
  zoom: '\u{1F50E}',
} as const;

export function parseCliPort(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveCliPorts(env: NodeJS.ProcessEnv): CliPorts {
  return {
    apiPort: parseCliPort(env[CLI_PORT_ENV_KEYS.apiPort], CLI_DEFAULT_PORTS.apiPort),
    wsPort: parseCliPort(env[CLI_PORT_ENV_KEYS.wsPort], CLI_DEFAULT_PORTS.wsPort),
  };
}

export const CLI_ACTIVE_STRATEGY_FALLBACK_LABEL = 'Mixed Strategies';

export const CLI_ACTIVE_STRATEGY_PRIORITY: Array<{
  label: string;
  isEnabled: (config: Config) => boolean | undefined;
}> = [
  { label: 'Micro-Wall', isEnabled: (config) => config.scalpingMicroWall?.enabled },
  { label: 'Tick Delta', isEnabled: (config) => config.scalpingTickDelta?.enabled },
  { label: 'Ladder TP', isEnabled: (config) => config.scalpingLadderTp?.enabled },
  { label: 'Limit Order', isEnabled: (config) => config.scalpingLimitOrder?.enabled },
  { label: 'Order Flow', isEnabled: (config) => config.scalpingOrderFlow?.enabled },
  { label: 'Whale Hunter', isEnabled: (config) => config.whaleHunter?.enabled },
  { label: 'Whale Hunter Follow', isEnabled: (config) => config.whaleHunterFollow?.enabled },
  { label: 'Level Based', isEnabled: (config) => config.strategies?.levelBased?.enabled },
];

export function detectCliActiveStrategyLabel(config: Config): string {
  const activeStrategy = CLI_ACTIVE_STRATEGY_PRIORITY.find((strategy) =>
    strategy.isEnabled(config),
  );

  return activeStrategy?.label ?? CLI_ACTIVE_STRATEGY_FALLBACK_LABEL;
}

export function detectActiveStrategy(config: Config): string {
  return detectCliActiveStrategyLabel(config);
}

export function isMainnetMode(config: Config): boolean {
  return !config.exchange.demo && !config.exchange.testnet;
}

export const CLI_EXCHANGE_MODE_LABELS: Array<{
  label: string;
  isEnabled: (config: Config) => boolean;
}> = [
  { label: `DEMO ${ICONS.demo}`, isEnabled: (config) => config.exchange.demo },
  { label: `TESTNET ${ICONS.warning}`, isEnabled: (config) => config.exchange.testnet },
  { label: `MAINNET ${ICONS.mainnet}`, isEnabled: (config) => isMainnetMode(config) },
];

export function formatCliExchangeModeLabel(config: Config): string {
  return CLI_EXCHANGE_MODE_LABELS.find((mode) => mode.isEnabled(config))?.label
    ?? `MAINNET ${ICONS.mainnet}`;
}

export function formatExchangeMode(config: Config): string {
  return formatCliExchangeModeLabel(config);
}
