import {
  createStandaloneEntrypointModuleRunners,
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
const testBalanceModuleEntrypointRunners =
  createStandaloneEntrypointModuleRunners(module, main);

export function shouldRunTestBalanceEntrypoint(
  currentModule: NodeModule = module,
  mainModule?: NodeModule,
): boolean {
  if (currentModule === module) {
    return testBalanceModuleEntrypointRunners.shouldRunCurrentEntrypoint(mainModule);
  }

  return testBalanceEntrypointRunners.shouldRunEntrypoint(currentModule, mainModule);
}

export const runTestBalanceEntrypoint = testBalanceEntrypointRunners.runEntrypoint;
export function runTestBalanceEntrypointIfMain(
  currentModule: NodeModule = module,
  mainModule?: NodeModule,
  entrypoint = main,
): Promise<void> | undefined {
  if (currentModule === module) {
    return testBalanceModuleEntrypointRunners.runCurrentEntrypointIfMain(
      mainModule,
      entrypoint,
    );
  }

  return testBalanceEntrypointRunners.runEntrypointIfMain(
    currentModule,
    mainModule,
    entrypoint,
  );
}

void runTestBalanceEntrypointIfMain();
