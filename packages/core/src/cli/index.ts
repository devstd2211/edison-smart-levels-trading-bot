/**
 * CLI entrypoint runtime boundary.
 * Initializes the trading bot, owns CLI UX, and hands direct execution to the
 * shared standalone if-main guard instead of open-coding the default main-module check.
 * RunCliMainDependencies keeps CLI composition injectable for tests and embedders.
 */

import * as dotenv from 'dotenv';
import { loadValidatedConfig } from '../config/index';
import {
  createStandaloneEntrypointRunners,
} from '../standalone-entrypoint-runtime';
import { createWebServerRuntime, startWebServer } from '../web';
import { createBotRuntime } from '../core';
import {
  isMainnetMode,
  resolveCliPorts,
} from './cli-runtime';
import {
  configureCliEnvironment,
  createCliRuntimeHandoff,
  createCliWebRuntimeHandoff,
  createCliWindowTitle,
  loadCliStartupConfig,
  logCliBanner,
  logCliBotInitialization,
  logCliBotStartup,
  logCliConfiguration,
  logCliMainnetWarning,
  logCliStartupFailure,
  logCliStartupComplete,
  logCliWebServerInitialization,
  logCliWebServerFailure,
  logCliWebServerSuccess,
  type CliEntryOutput,
  type CliEnvironmentLoader,
} from './cli-entrypoint-runtime';
import { setupGracefulShutdown } from './cli-shutdown';

type CliProcessLike = Pick<NodeJS.Process, 'cwd' | 'env' | 'exit' | 'title'>;

type CliWebServerInstance = { close: () => void };

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
  'main',
  'runCliMain',
  'runCliMainIfMain',
  'shouldRunCliMain',
] as const;

export async function main(): Promise<void> {
  await runCliMain();
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
    const config = await loadCliStartupConfig(cliConfigLoader);
    logCliConfiguration(cliOutput, config);

    cliProcess.title = createCliWindowTitle(config);

    if (isMainnetMode(config)) {
      await logCliMainnetWarning(cliOutput, cliDelay);
    }

    logCliBotInitialization(cliOutput);
    const cliBotRuntime = await createCliRuntimeHandoff(config, cliBotRuntimeFactory);
    const { bot, webApiAdapter } = cliBotRuntime;

    let webServer: CliWebServerInstance | null = null;
    try {
      logCliWebServerInitialization(cliOutput);
      // CLI startup attempts embedded web handoff before bot lifecycle start.
      const cliWebRuntime = createCliWebRuntimeHandoff(bot, webApiAdapter, cliWebRuntimeFactory);
      webServer = await cliWebServerStarter(cliWebRuntime, cliStartupPorts);
      logCliWebServerSuccess(cliOutput);
    } catch (error) {
      logCliWebServerFailure(cliOutput, error);
    }

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

void runCliMainIfMain(module);
