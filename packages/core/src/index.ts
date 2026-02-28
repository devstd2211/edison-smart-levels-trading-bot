/**
 * Legacy entrypoint (wrapper).
 *
 * Delegates to CLI entrypoint while core entrypoint lives in `src/core`.
 */

import { main } from './cli';

export { createBot, startBot } from './core';
export { main };

// Start the CLI by default for backward compatibility.
void main();
