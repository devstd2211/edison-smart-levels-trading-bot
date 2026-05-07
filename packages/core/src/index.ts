/**
 * Legacy entrypoint (wrapper).
 *
 * Delegates to CLI entrypoint while core entrypoint lives in `src/core`.
 */

import { main } from './cli';

export { createBot, startBot } from './core';
export { BotFactory } from './bot-factory';
export type { BotFactoryRuntimeBundle } from './bot-factory';
export { main };
export const runLegacyCliEntrypoint = (): Promise<void> => main();

// Start the CLI by default only when this legacy wrapper is executed directly.
if (require.main === module) {
  void runLegacyCliEntrypoint();
}
