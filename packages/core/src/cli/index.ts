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

export async function runCliMain(dependencies: RunCliMainDependencies = {}): Promise<void> {
  const cliOutput = dependencies.console ?? console;
  const cliProcess = dependencies.process ?? process;
  const cliEnvironmentLoader = dependencies.envLoader ?? dotenv;
  const cliConfigLoader = dependencies.loadValidatedConfig ?? loadValidatedConfig;
  const cliBotRuntimeFactory = dependencies.createBotRuntime ?? createBotRuntime;
  const cliWebRuntimeFactory = dependencies.createWebServerRuntime ?? createWebServerRuntime;
  const cliWebServerStarter = dependencies.startWebServer ?? startWebServer;
  const cliShutdownRegistrar = dependencies.setupGracefulShutdown ?? setupGracefulShutdown;
  const cliDelay = dependencies.delay ?? delay;
  const ports = resolveCliPorts(cliProcess.env);

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
    const runtime = await createCliRuntimeHandoff(config, cliBotRuntimeFactory);
    const { bot, webApiAdapter } = runtime;

    let webServer: CliWebServerInstance | null = null;
    try {
      logCliWebServerInitialization(cliOutput);
      // CLI startup attempts embedded web handoff before bot lifecycle start.
      const webRuntime = createCliWebRuntimeHandoff(bot, webApiAdapter, cliWebRuntimeFactory);
      webServer = await cliWebServerStarter(webRuntime, ports);
      logCliWebServerSuccess(cliOutput);
    } catch (error) {
      logCliWebServerFailure(cliOutput, error);
    }

    cliShutdownRegistrar(bot, webServer);

    logCliBotStartup(cliOutput);
    await bot.start();

    if (config.meta?.testMode === true) {
      bot.enableTestMode();
    }

    logCliStartupComplete(cliOutput, ports, config.meta?.testMode === true);
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
