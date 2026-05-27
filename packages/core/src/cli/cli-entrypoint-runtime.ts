import * as path from 'path';
import type { Config } from '../types/legacy';
import {
  CLI_SEPARATOR_LENGTH,
  detectCliActiveStrategyLabel,
  formatCliExchangeModeLabel,
  ICONS,
  MAINNET_WARNING_DELAY_MS,
  MS_TO_SECONDS_DIVISOR,
  CLI_WEB_CLIENT_DEV_SERVER,
  type CliPorts,
} from './cli-runtime';

export type CliEntryOutput = Pick<Console, 'error' | 'log' | 'warn'>;

export type CliEnvironmentLoader = {
  config(options: { path: string }): unknown;
};

export type CliStartupConfigLoader = () => Promise<Config>;

export type CliRuntimeFactory<TRuntime> = (config: Config) => Promise<TRuntime>;

export type CliWebRuntimeFactory<TBot, TWebApiAdapter, TWebRuntime> = (
  bot: TBot,
  webApiAdapter: TWebApiAdapter,
) => TWebRuntime;

export const CLI_STARTUP_OUTPUT_LINES = {
  botInitialization: '\n[Main] Initializing Trading Bot via BotFactory...',
  botStartup: '[Main] Starting Trading Bot...\n',
  webServerDegraded: '[Main] Embedded web server unavailable; continuing with bot lifecycle only',
  webServerFailure: '[Main] Embedded web server startup failed:',
  webServerInitialization: '[Main] Preparing embedded Web Server runtime handoff...',
} as const;

export const CLI_MAINNET_WARNING_SECONDS = MAINNET_WARNING_DELAY_MS / MS_TO_SECONDS_DIVISOR;

export const CLI_MAINNET_WARNING_OUTPUT_LINES = {
  warning: `\n${ICONS.warning}  WARNING: MAINNET MODE - REAL MONEY AT RISK! ${ICONS.warning}`,
  countdown: `${ICONS.warning}  Press Ctrl+C within ${CLI_MAINNET_WARNING_SECONDS} seconds to cancel... ${ICONS.warning}\n`,
} as const;

export const CLI_STARTUP_ENDPOINT_OUTPUT_LINES = {
  running: `\n${ICONS.success} Bot is running! Press Ctrl+C to stop.`,
  webInterface: (
    webClientPort: number = CLI_WEB_CLIENT_DEV_SERVER.port,
  ) => `${ICONS.chart} Web Interface: http://localhost:${webClientPort}`,
  api: (apiPort: number) => `${ICONS.plug} API: http://localhost:${apiPort}`,
  webSocket: (wsPort: number) => `${ICONS.satellite} WebSocket: ws://localhost:${wsPort}`,
  webClientDevServerNote: (
    command: string = CLI_WEB_CLIENT_DEV_SERVER.command,
  ) => `${ICONS.note} Note: Run web-client dev server in another terminal: ${command}\n`,
} as const;

export function configureCliEnvironment(
  projectPath: string,
  environmentLoader: CliEnvironmentLoader,
  resolvePath: typeof path.resolve = path.resolve,
): string {
  const envPath = resolvePath(projectPath, '.env');
  environmentLoader.config({ path: envPath });
  return envPath;
}

export function loadCliStartupConfig(loadConfig: CliStartupConfigLoader): Promise<Config> {
  return loadConfig();
}

export function createCliRuntimeHandoff<TRuntime>(
  config: Config,
  createRuntime: CliRuntimeFactory<TRuntime>,
): Promise<TRuntime> {
  return createRuntime(config);
}

/**
 * Materializes the CLI-owned web runtime pair from the already-created bot runtime.
 * Lifecycle start remains with `startWebServer(...)`; this helper only returns the pair.
 */
export function createCliWebRuntimeHandoff<TBot, TWebApiAdapter, TWebRuntime>(
  bot: TBot,
  webApiAdapter: TWebApiAdapter,
  createWebRuntime: CliWebRuntimeFactory<TBot, TWebApiAdapter, TWebRuntime>,
): TWebRuntime {
  return createWebRuntime(bot, webApiAdapter);
}

export function createCliWindowTitle(config: Config): string {
  return `Edison - ${detectCliActiveStrategyLabel(config)} (${config.exchange.symbol})`;
}

export function logCliBanner(output: CliEntryOutput): void {
  output.log('='.repeat(CLI_SEPARATOR_LENGTH));
  output.log(`${ICONS.robot} Edison - Level-Based Trading Strategy`);
  output.log('='.repeat(CLI_SEPARATOR_LENGTH));
}

export function logCliConfiguration(output: CliEntryOutput, config: Config): void {
  const activeStrategy = detectCliActiveStrategyLabel(config);

  output.log('\n[Main] Loading configuration...');
  output.log('[Main] Validating configuration...');
  output.log(`[Main] Active Strategy: ${activeStrategy}`);
  output.log(`[Main] Symbol: ${config.exchange.symbol}`);
  output.log(`[Main] Timeframe: ${config.exchange.timeframe}`);
  output.log(`[Main] Leverage: ${config.trading.leverage}x`);
  output.log(`[Main] Risk: ${config.trading.riskPercent}%`);
  output.log(
    `[Main] Trading Cycle: ${config.trading.tradingCycleIntervalMs / MS_TO_SECONDS_DIVISOR}s`,
  );
  output.log(`[Main] Mode: ${formatCliExchangeModeLabel(config)}`);
}

export function logCliBotInitialization(output: CliEntryOutput): void {
  output.log(CLI_STARTUP_OUTPUT_LINES.botInitialization);
}

export function logCliWebServerInitialization(output: CliEntryOutput): void {
  output.log(CLI_STARTUP_OUTPUT_LINES.webServerInitialization);
}

export function logCliWebServerSuccess(output: CliEntryOutput): void {
  output.log(`[Main] ${ICONS.success} Web Server initialized successfully`);
}

export async function logCliMainnetWarning(
  output: CliEntryOutput,
  delay: (milliseconds: number) => Promise<void>,
): Promise<void> {
  output.log(CLI_MAINNET_WARNING_OUTPUT_LINES.warning);
  output.log(CLI_MAINNET_WARNING_OUTPUT_LINES.countdown);
  await delay(MAINNET_WARNING_DELAY_MS);
}

export function logCliWebServerFailure(output: CliEntryOutput, error: unknown): void {
  output.error(
    CLI_STARTUP_OUTPUT_LINES.webServerFailure,
    error instanceof Error ? error.message : error,
  );
  output.warn(CLI_STARTUP_OUTPUT_LINES.webServerDegraded);
}

export function logCliBotStartup(output: CliEntryOutput): void {
  output.log(CLI_STARTUP_OUTPUT_LINES.botStartup);
}

export function logCliStartupComplete(
  output: CliEntryOutput,
  ports: CliPorts,
  isTestMode: boolean,
): void {
  if (isTestMode) {
    output.log(
      `\n${ICONS.test} TEST MODE ENABLED - Bot will open test positions without real signals`,
    );
  }

  output.log(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.running);
  output.log(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webInterface());
  output.log(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.api(ports.apiPort));
  output.log(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webSocket(ports.wsPort));
  output.log(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webClientDevServerNote());
}

export function logCliStartupFailure(output: CliEntryOutput, error: unknown): void {
  output.error('\n[Main] Failed to start bot:', error);
}
