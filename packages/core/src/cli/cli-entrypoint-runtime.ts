import * as path from 'path';
import * as dotenv from 'dotenv';
import { loadValidatedConfig } from '../config/index';
import { createBotRuntime } from '../core';
import {
  createStandaloneEntrypointRunners,
} from '../standalone-entrypoint-runtime';
import { createWebServerRuntime, startWebServer } from '../web';
import type { Config } from '../types/legacy';
import {
  CLI_SEPARATOR_LENGTH,
  isMainnetMode,
  detectCliActiveStrategyLabel,
  formatCliExchangeModeLabel,
  ICONS,
  MAINNET_WARNING_DELAY_MS,
  MS_TO_SECONDS_DIVISOR,
  CLI_WEB_CLIENT_DEV_SERVER,
  type CliPorts,
  resolveCliPorts,
} from './cli-runtime';
import { setupGracefulShutdown } from './cli-shutdown';

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

type CliProcessLike = Pick<NodeJS.Process, 'cwd' | 'env' | 'exit' | 'title'>;

type ResolvedRunCliMainDependencies = Required<
  Pick<
    RunCliMainDependencies,
    | 'console'
    | 'createBotRuntime'
    | 'createWebServerRuntime'
    | 'delay'
    | 'envLoader'
    | 'loadValidatedConfig'
    | 'process'
    | 'setupGracefulShutdown'
    | 'startWebServer'
  >
>;

export type RunCliMainDependencies = {
  console?: CliEntryOutput;
  createBotRuntime?: typeof createBotRuntime;
  createWebServerRuntime?: typeof createWebServerRuntime;
  delay?: (milliseconds: number) => Promise<void>;
  envLoader?: CliEnvironmentLoader;
  loadValidatedConfig?: typeof loadValidatedConfig;
  process?: CliProcessLike;
  setupGracefulShutdown?: typeof setupGracefulShutdown;
  startWebServer?: typeof startWebServer;
};

export const CLI_ENTRYPOINT_EXPORT_NAMES = [
  'CLI_ENTRYPOINT_EXPORT_NAMES',
  'createCliStartupPhaseRuntime',
  'loadCliStartupConfigPhase',
  'main',
  'runCliMain',
  'runCliMainIfMain',
  'shouldRunCliMain',
  'startCliWebServerPhase',
] as const;

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

export async function main(): Promise<void> {
  await runCliMain();
}

export function createCliStartupPhaseRuntime<TRuntime>(
  config: Parameters<typeof createCliRuntimeHandoff<TRuntime>>[0],
  createRuntime: Parameters<typeof createCliRuntimeHandoff<TRuntime>>[1],
): Promise<TRuntime> {
  return createCliRuntimeHandoff(config, createRuntime);
}

export async function loadCliStartupConfigPhase(
  loadConfig: typeof loadValidatedConfig,
  output: CliEntryOutput,
): Promise<Config> {
  const config = await loadCliStartupConfig(loadConfig);
  logCliConfiguration(output, config);
  return config;
}

export type StartCliWebServerPhaseOptions<TBot, TWebApiAdapter, TWebRuntime, TWebServer> = {
  bot: TBot;
  createWebServerRuntime: (
    bot: TBot,
    webApiAdapter: TWebApiAdapter,
  ) => TWebRuntime;
  output: CliEntryOutput;
  ports: CliPorts;
  startWebServer: (webRuntime: TWebRuntime, ports: CliPorts) => Promise<TWebServer>;
  webApiAdapter: TWebApiAdapter;
};

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

export async function startCliWebServerPhase<
  TBot,
  TWebApiAdapter,
  TWebRuntime,
  TWebServer,
>(
  options: StartCliWebServerPhaseOptions<TBot, TWebApiAdapter, TWebRuntime, TWebServer>,
): Promise<TWebServer | null> {
  try {
    logCliWebServerInitialization(options.output);
    // CLI startup attempts embedded web handoff before bot lifecycle start.
    const cliWebRuntime = createCliWebRuntimeHandoff(
      options.bot,
      options.webApiAdapter,
      options.createWebServerRuntime,
    );
    const webServer = await options.startWebServer(cliWebRuntime, options.ports);
    logCliWebServerSuccess(options.output);
    return webServer;
  } catch (error) {
    logCliWebServerFailure(options.output, error);
    return null;
  }
}

function resolveRunCliMainDependencies(
  dependencies: RunCliMainDependencies,
): ResolvedRunCliMainDependencies {
  return {
    console: dependencies.console ?? console,
    createBotRuntime: dependencies.createBotRuntime ?? createBotRuntime,
    createWebServerRuntime: dependencies.createWebServerRuntime ?? createWebServerRuntime,
    delay: dependencies.delay ?? delay,
    envLoader: dependencies.envLoader ?? dotenv,
    loadValidatedConfig: dependencies.loadValidatedConfig ?? loadValidatedConfig,
    process: dependencies.process ?? process,
    setupGracefulShutdown: dependencies.setupGracefulShutdown ?? setupGracefulShutdown,
    startWebServer: dependencies.startWebServer ?? startWebServer,
  };
}

export async function runCliMain(dependencies: RunCliMainDependencies = {}): Promise<void> {
  const cliDependencies = resolveRunCliMainDependencies(dependencies);
  const cliOutput = cliDependencies.console;
  const cliProcess = cliDependencies.process;
  const cliEnvironmentLoader = cliDependencies.envLoader;
  const cliConfigLoader = cliDependencies.loadValidatedConfig;
  const cliBotRuntimeFactory = cliDependencies.createBotRuntime;
  const cliWebRuntimeFactory = cliDependencies.createWebServerRuntime;
  const cliWebServerStarter = cliDependencies.startWebServer;
  const cliShutdownRegistrar = cliDependencies.setupGracefulShutdown;
  const cliDelay = cliDependencies.delay;
  const cliStartupPorts = resolveCliPorts(cliProcess.env);

  configureCliEnvironment(cliProcess.cwd(), cliEnvironmentLoader);
  logCliBanner(cliOutput);

  try {
    const config = await loadCliStartupConfigPhase(cliConfigLoader, cliOutput);

    cliProcess.title = createCliWindowTitle(config);

    if (isMainnetMode(config)) {
      await logCliMainnetWarning(cliOutput, cliDelay);
    }

    logCliBotInitialization(cliOutput);
    const cliBotRuntime = await createCliStartupPhaseRuntime(config, cliBotRuntimeFactory);
    const { bot, webApiAdapter } = cliBotRuntime;

    const webServer = await startCliWebServerPhase({
      bot,
      createWebServerRuntime: cliWebRuntimeFactory,
      output: cliOutput,
      ports: cliStartupPorts,
      startWebServer: cliWebServerStarter,
      webApiAdapter,
    });

    cliShutdownRegistrar(bot, webServer);

    logCliBotStartup(cliOutput);
    await bot.start();

    const cliStartupTestMode = config.meta?.testMode === true;
    if (cliStartupTestMode) {
      bot.enableTestMode();
    }

    logCliStartupComplete(cliOutput, cliStartupPorts, cliStartupTestMode);
  } catch (error) {
    logCliStartupFailure(cliOutput, error);
    cliProcess.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const cliEntrypointRunners = createStandaloneEntrypointRunners(main);

// Shared standalone if-main guard for explicit direct execution checks.
export function shouldRunCliMain(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined,
): boolean {
  return cliEntrypointRunners.shouldRunEntrypoint(currentModule, mainModule);
}

export function runCliMainIfMain(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined = require.main,
  entrypoint: () => Promise<void> = main,
): Promise<void> | undefined {
  return cliEntrypointRunners.runEntrypointIfMain(currentModule, mainModule, entrypoint);
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
