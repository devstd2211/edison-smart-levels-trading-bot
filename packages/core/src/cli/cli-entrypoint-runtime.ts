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

export const CLI_BANNER_OUTPUT_LINES = {
  separator: '='.repeat(CLI_SEPARATOR_LENGTH),
  title: `${ICONS.robot} Edison - Level-Based Trading Strategy`,
} as const;

export const CLI_STARTUP_OUTPUT_LINES = {
  botInitialization: '\n[Main] Initializing Trading Bot via BotFactory...',
  botStartup: '[Main] Starting Trading Bot...\n',
  fatalStartupFailure: '\n[Main] Failed to start bot:',
  testMode: `\n${ICONS.test} TEST MODE ENABLED - Bot will open test positions without real signals`,
  webServerDegraded: '[Main] Embedded web server unavailable; continuing with bot lifecycle only',
  webServerFailure: '[Main] Embedded web server startup failed:',
  webServerInitialization: '[Main] Preparing embedded Web Server runtime handoff...',
  webServerSuccess: `[Main] ${ICONS.success} Web Server initialized successfully`,
} as const;

export const CLI_CONFIGURATION_OUTPUT_LINES = {
  loadingConfiguration: '\n[Main] Loading configuration...',
  validatingConfiguration: '[Main] Validating configuration...',
  activeStrategy: (activeStrategy: string) => `[Main] Active Strategy: ${activeStrategy}`,
  symbol: (symbol: string) => `[Main] Symbol: ${symbol}`,
  timeframe: (timeframe: string) => `[Main] Timeframe: ${timeframe}`,
  leverage: (leverage: number) => `[Main] Leverage: ${leverage}x`,
  risk: (riskPercent: number) => `[Main] Risk: ${riskPercent}%`,
  tradingCycle: (tradingCycleSeconds: number) =>
    `[Main] Trading Cycle: ${tradingCycleSeconds}s`,
  mode: (mode: string) => `[Main] Mode: ${mode}`,
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

export function createCliBannerOutputRows(): string[] {
  return [
    CLI_BANNER_OUTPUT_LINES.separator,
    CLI_BANNER_OUTPUT_LINES.title,
    CLI_BANNER_OUTPUT_LINES.separator,
  ];
}

export function createCliConfigurationOutputRows(config: Config): string[] {
  const activeStrategy = detectCliActiveStrategyLabel(config);

  return [
    CLI_CONFIGURATION_OUTPUT_LINES.loadingConfiguration,
    CLI_CONFIGURATION_OUTPUT_LINES.validatingConfiguration,
    CLI_CONFIGURATION_OUTPUT_LINES.activeStrategy(activeStrategy),
    CLI_CONFIGURATION_OUTPUT_LINES.symbol(config.exchange.symbol),
    CLI_CONFIGURATION_OUTPUT_LINES.timeframe(config.exchange.timeframe),
    CLI_CONFIGURATION_OUTPUT_LINES.leverage(config.trading.leverage),
    CLI_CONFIGURATION_OUTPUT_LINES.risk(config.trading.riskPercent),
    CLI_CONFIGURATION_OUTPUT_LINES.tradingCycle(
      config.trading.tradingCycleIntervalMs / MS_TO_SECONDS_DIVISOR,
    ),
    CLI_CONFIGURATION_OUTPUT_LINES.mode(formatCliExchangeModeLabel(config)),
  ];
}

export function createCliStartupEndpointOutputRows(ports: CliPorts): string[] {
  return [
    CLI_STARTUP_ENDPOINT_OUTPUT_LINES.running,
    CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webInterface(),
    CLI_STARTUP_ENDPOINT_OUTPUT_LINES.api(ports.apiPort),
    CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webSocket(ports.wsPort),
    CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webClientDevServerNote(),
  ];
}

export function createCliStartupLifecycleOutputRows(isTestMode: boolean): string[] {
  return [
    CLI_STARTUP_OUTPUT_LINES.botInitialization,
    CLI_STARTUP_OUTPUT_LINES.botStartup,
    ...(isTestMode ? [CLI_STARTUP_OUTPUT_LINES.testMode] : []),
  ];
}

export function createCliMainnetWarningOutputRows(): string[] {
  return [
    CLI_MAINNET_WARNING_OUTPUT_LINES.warning,
    CLI_MAINNET_WARNING_OUTPUT_LINES.countdown,
  ];
}

export function createCliWebServerOutputRows(): string[] {
  return [
    CLI_STARTUP_OUTPUT_LINES.webServerInitialization,
    CLI_STARTUP_OUTPUT_LINES.webServerSuccess,
  ];
}

export function createCliWebServerFailureOutput(error: unknown): {
  errorArgs: [string, unknown];
  warning: string;
} {
  return {
    errorArgs: [
      CLI_STARTUP_OUTPUT_LINES.webServerFailure,
      error instanceof Error ? error.message : error,
    ],
    warning: CLI_STARTUP_OUTPUT_LINES.webServerDegraded,
  };
}

export function createCliStartupFailureOutput(error: unknown): [string, unknown] {
  return [CLI_STARTUP_OUTPUT_LINES.fatalStartupFailure, error];
}

export function logCliBanner(output: CliEntryOutput): void {
  for (const outputRow of createCliBannerOutputRows()) {
    output.log(outputRow);
  }
}

export function logCliConfiguration(output: CliEntryOutput, config: Config): void {
  for (const outputRow of createCliConfigurationOutputRows(config)) {
    output.log(outputRow);
  }
}

export function logCliBotInitialization(output: CliEntryOutput): void {
  output.log(createCliStartupLifecycleOutputRows(false)[0]);
}

export function logCliWebServerInitialization(output: CliEntryOutput): void {
  output.log(createCliWebServerOutputRows()[0]);
}

export function logCliWebServerSuccess(output: CliEntryOutput): void {
  output.log(createCliWebServerOutputRows()[1]);
}

export async function logCliMainnetWarning(
  output: CliEntryOutput,
  delay: (milliseconds: number) => Promise<void>,
): Promise<void> {
  for (const outputRow of createCliMainnetWarningOutputRows()) {
    output.log(outputRow);
  }
  await delay(MAINNET_WARNING_DELAY_MS);
}

export function logCliWebServerFailure(output: CliEntryOutput, error: unknown): void {
  const failureOutput = createCliWebServerFailureOutput(error);

  output.error(...failureOutput.errorArgs);
  output.warn(failureOutput.warning);
}

export function logCliBotStartup(output: CliEntryOutput): void {
  output.log(createCliStartupLifecycleOutputRows(false)[1]);
}

export function logCliStartupComplete(
  output: CliEntryOutput,
  ports: CliPorts,
  isTestMode: boolean,
): void {
  if (isTestMode) {
    output.log(createCliStartupLifecycleOutputRows(true)[2]);
  }

  for (const outputRow of createCliStartupEndpointOutputRows(ports)) {
    output.log(outputRow);
  }
}

export function logCliStartupFailure(output: CliEntryOutput, error: unknown): void {
  output.error(...createCliStartupFailureOutput(error));
}
