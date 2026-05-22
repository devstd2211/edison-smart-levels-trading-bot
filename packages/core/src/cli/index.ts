/**
 * CLI Entrypoint - Edison
 * Initializes and starts the trading bot with CLI UX.
 */

import * as dotenv from 'dotenv';
import { loadValidatedConfig } from '../config/index';
import { createWebServerRuntime, startWebServer } from '../web';
import { createBotRuntime } from '../core';
import {
  ICONS,
  isMainnetMode,
  resolveCliPorts,
} from './cli-runtime';
import {
  configureCliEnvironment,
  createCliWindowTitle,
  logCliBanner,
  logCliConfiguration,
  logCliMainnetWarning,
  logCliStartupComplete,
  logCliWebServerFailure,
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

    output.log('\n[Main] Initializing Trading Bot via BotFactory...');
    const runtime = await createRuntime(config);
    const { bot, webApiAdapter } = runtime;

    let webServer: CliWebServerInstance | null = null;
    try {
      output.log('[Main] Initializing Web Server...');
      webServer = await startServer(createWebRuntime(bot, webApiAdapter), ports);
      output.log(`[Main] ${ICONS.success} Web Server initialized successfully`);
    } catch (error) {
      logCliWebServerFailure(output, error);
    }

    setupShutdown(bot, webServer);

    output.log('[Main] Starting Trading Bot...\n');
    await bot.start();

    if (config.meta?.testMode === true) {
      bot.enableTestMode();
    }

    logCliStartupComplete(output, ports, config.meta?.testMode === true);
  } catch (error) {
    output.error('\n[Main] Failed to start bot:', error);
    processRef.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

if (require.main === module) {
  void main();
}
