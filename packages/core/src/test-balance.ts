import {
  createStandaloneEntrypointWrapperRunners,
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

const testBalanceEntrypointRunners = createStandaloneEntrypointWrapperRunners(module, main);

export function shouldRunTestBalanceEntrypoint(
  currentModule: NodeModule = module,
  mainModule?: NodeModule,
): boolean {
  return testBalanceEntrypointRunners.shouldRunEntrypoint(currentModule, mainModule);
}

export const runTestBalanceEntrypoint = testBalanceEntrypointRunners.runEntrypoint;
export function runTestBalanceEntrypointIfMain(
  currentModule: NodeModule = module,
  mainModule?: NodeModule,
  entrypoint = main,
): Promise<void> | undefined {
  return testBalanceEntrypointRunners.runEntrypointIfMain(
    currentModule,
    mainModule,
    entrypoint,
  );
}

void runTestBalanceEntrypointIfMain();
