import {
  createStandaloneEntrypointRunners,
} from './standalone-entrypoint-runtime';
import {
  runTestBalanceWorkflow,
} from './test-balance.entrypoint';

export async function main(): Promise<void> {
  await runTestBalanceWorkflow();
}

const testBalanceEntrypointRunners = createStandaloneEntrypointRunners(main);

export const runTestBalanceEntrypoint = testBalanceEntrypointRunners.runEntrypoint;
export const runTestBalanceEntrypointIfMain = testBalanceEntrypointRunners.runEntrypointIfMain;

void runTestBalanceEntrypointIfMain(module, require.main);
