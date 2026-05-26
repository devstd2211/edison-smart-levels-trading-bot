/**
 * CLI Entrypoint - Edison
 * Initializes and starts the trading bot with CLI UX.
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
  createCliWindowTitle,
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
  const output = dependencies.console ?? console;
  const processRef = dependencies.process ?? process;
  const envLoader = dependencies.envLoader ?? dotenv;
  const loadConfig = dependencies.loadValidatedConfig ?? loadValidatedConfig;
  const createRuntime = dependencies.createBotRuntime ?? createBotRuntime;
  const createWebRuntime = dependencies.createWebServerRuntime ?? createWebServerRuntime;
  const startServer = dependencies.startWebServer ?? startWebServer;
  const setupShutdown = dependencies.setupGracefulShutdown ?? setupGracefulShutdown;
  const delayRef = dependencies.delay ?? delay;
  const ports = resolveCliPorts(processRef.env);

  configureCliEnvironment(processRef.cwd(), envLoader);
  logCliBanner(output);

  try {
    const config = await loadConfig();
    logCliConfiguration(output, config);

    processRef.title = createCliWindowTitle(config);

    if (isMainnetMode(config)) {
      await logCliMainnetWarning(output, delayRef);
    }

    logCliBotInitialization(output);
    const runtime = await createRuntime(config);
    const { bot, webApiAdapter } = runtime;

    let webServer: CliWebServerInstance | null = null;
    try {
      logCliWebServerInitialization(output);
      webServer = await startServer(createWebRuntime(bot, webApiAdapter), ports);
      logCliWebServerSuccess(output);
    } catch (error) {
      logCliWebServerFailure(output, error);
    }

    setupShutdown(bot, webServer);

    logCliBotStartup(output);
    await bot.start();

    if (config.meta?.testMode === true) {
      bot.enableTestMode();
    }

    logCliStartupComplete(output, ports, config.meta?.testMode === true);
  } catch (error) {
    logCliStartupFailure(output, error);
    processRef.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const cliEntrypointRunners = createStandaloneEntrypointRunners(main);

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
