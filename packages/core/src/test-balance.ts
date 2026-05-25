import {
  createStandaloneEntrypointRunners,
} from './standalone-entrypoint-runtime';
import {
  createTestBalanceLogger,
  createTestBalanceWorkflowRuntime,
  runTestBalanceChecks,
} from './test-balance.entrypoint';

export const TEST_BALANCE_ENTRYPOINT_EXPORT_NAMES = [
  'TEST_BALANCE_ENTRYPOINT_EXPORT_NAMES',
  'main',
  'runTestBalanceEntrypoint',
  'runTestBalanceEntrypointIfMain',
  'shouldRunTestBalanceEntrypoint',
] as const;

export async function main(): Promise<void> {
  try {
    const runtime = createTestBalanceWorkflowRuntime();
    await runTestBalanceChecks(runtime);
  } catch (_error) {
    const logger = createTestBalanceLogger();
    logger.error('Missing API credentials in .env file');
    logger.error('Please set BYBIT_API_KEY and BYBIT_API_SECRET');
    process.exit(1);
  }
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

void runTestBalanceEntrypointIfMain(module, require.main);
