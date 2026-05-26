import {
  createStandaloneEntrypointRunners,
} from './standalone-entrypoint-runtime';
import {
  runTestBalanceWorkflow,
} from './test-balance.entrypoint';

export const TEST_BALANCE_ENTRYPOINT_EXPORT_NAMES = [
  'TEST_BALANCE_ENTRYPOINT_EXPORT_NAMES',
  'main',
  'runTestBalanceEntrypoint',
  'runTestBalanceEntrypointIfMain',
  'shouldRunTestBalanceEntrypoint',
] as const;

export async function main(): Promise<void> {
  await runTestBalanceWorkflow();
}

const testBalanceEntrypointRunners = createStandaloneEntrypointRunners(main);

export function shouldRunTestBalanceEntrypoint(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined,
): boolean {
  return testBalanceEntrypointRunners.shouldRunEntrypoint(currentModule, mainModule);
}

export const runTestBalanceEntrypoint = testBalanceEntrypointRunners.runEntrypoint;
export const runTestBalanceEntrypointIfMain = testBalanceEntrypointRunners.runEntrypointIfMain;

void runTestBalanceEntrypointIfMain(module);
