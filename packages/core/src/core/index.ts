/**
 * Core entrypoint
 *
 * Creates the trading bot without CLI concerns.
 */

import type { Config } from '../types/legacy';
import type { BotFactoryRuntime } from '../bot-factory';
import type { TradingBotAppApi } from '../types/trading-bot';
import { BotFactory } from '../bot-factory';

export type BotLike = TradingBotAppApi;

// Expects config already processed by ConfigPipeline (strategy merge, env overrides).
export async function createBot(config: Config): Promise<BotLike> {
  return BotFactory.create({ config });
}

export async function createBotRuntime(config: Config): Promise<BotFactoryRuntime> {
  return BotFactory.createRuntime(config);
}

export async function startBot(config: Config): Promise<BotLike> {
  const bot = await createBot(config);
  await bot.start();
  return bot;
}
