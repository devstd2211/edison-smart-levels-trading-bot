import * as path from 'path';
import type { Config } from '../types/legacy';
import {
  CLI_SEPARATOR_LENGTH,
  detectActiveStrategy,
  formatExchangeMode,
  ICONS,
  MAINNET_WARNING_DELAY_MS,
  MS_TO_SECONDS_DIVISOR,
  type CliPorts,
} from './cli-runtime';

export type CliEntryOutput = Pick<Console, 'error' | 'log' | 'warn'>;

export type CliEnvironmentLoader = {
  config(options: { path: string }): unknown;
};

export function configureCliEnvironment(
  projectPath: string,
  environmentLoader: CliEnvironmentLoader,
  resolvePath: typeof path.resolve = path.resolve,
): string {
  const envPath = resolvePath(projectPath, '.env');
  environmentLoader.config({ path: envPath });
  return envPath;
}

export function createCliWindowTitle(config: Config): string {
  return `Edison - ${detectActiveStrategy(config)} (${config.exchange.symbol})`;
}

export function logCliBanner(output: CliEntryOutput): void {
  output.log('='.repeat(CLI_SEPARATOR_LENGTH));
  output.log(`${ICONS.robot} Edison - Level-Based Trading Strategy`);
  output.log('='.repeat(CLI_SEPARATOR_LENGTH));
}

export function logCliConfiguration(output: CliEntryOutput, config: Config): void {
  const activeStrategy = detectActiveStrategy(config);

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
  output.log(`[Main] Mode: ${formatExchangeMode(config)}`);
}

export async function logCliMainnetWarning(
  output: CliEntryOutput,
  delay: (milliseconds: number) => Promise<void>,
): Promise<void> {
  output.log(`\n${ICONS.warning}  WARNING: MAINNET MODE - REAL MONEY AT RISK! ${ICONS.warning}`);
  output.log(`${ICONS.warning}  Press Ctrl+C within 5 seconds to cancel... ${ICONS.warning}\n`);
  await delay(MAINNET_WARNING_DELAY_MS);
}

export function logCliWebServerFailure(output: CliEntryOutput, error: unknown): void {
  output.error(
    '[Main] Web server initialization failed:',
    error instanceof Error ? error.message : error,
  );
  output.warn('[Main] Continuing without web server - bot can run standalone');
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

  output.log(`\n${ICONS.success} Bot is running! Press Ctrl+C to stop.`);
  output.log(`${ICONS.chart} Web Interface: http://localhost:3000`);
  output.log(`${ICONS.plug} API: http://localhost:${ports.apiPort}`);
  output.log(`${ICONS.satellite} WebSocket: ws://localhost:${ports.wsPort}`);
  output.log(
    `${ICONS.note} Note: Run web-client dev server in another terminal: cd packages/web-client && npm run dev\n`,
  );
}
