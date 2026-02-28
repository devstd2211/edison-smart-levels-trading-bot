/**
 * Core entrypoint
 *
 * Creates the trading bot without CLI concerns.
 */

import type { Config } from '../types/legacy';
import type { Position } from '../types/position';
import { BotFactory } from '../bot-factory';

export type BotLike = {
  isRunning: boolean;
  eventBus: {
    on(event: string, listener: (...args: unknown[]) => void): void;
    off(event: string, listener: (...args: unknown[]) => void): void;
    emit(event: string, ...args: unknown[]): void;
  };
  getCurrentPosition(): Position | null;
  getBalance(): Promise<number>;
  start(): Promise<void>;
  stop(): Promise<void>;
  enableTestMode(): void;
};

// Expects config already processed by ConfigPipeline (strategy merge, env overrides).
export async function createBot(config: Config): Promise<BotLike> {
  return BotFactory.create({ config });
}

export async function startBot(config: Config): Promise<BotLike> {
  const bot = await createBot(config);
  await bot.start();
  return bot;
}
