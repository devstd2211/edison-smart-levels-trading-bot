import {
  createStandaloneEntrypointWrapperRunners,
} from './standalone-entrypoint-runtime';
import {
  runVectorDbCli,
} from './vector-db/cli';

export const VECTOR_DB_ENTRYPOINT_EXPORT_NAMES = [
  'VECTOR_DB_ENTRYPOINT_EXPORT_NAMES',
  'main',
  'readVectorDbEntrypointArgs',
  'runVectorDbEntrypoint',
  'runVectorDbEntrypointIfMain',
  'runVectorDbMain',
  'shouldRunVectorDbEntrypoint',
] as const;

export function readVectorDbEntrypointArgs(argv: string[] = process.argv): string[] {
  return argv.slice(2);
}

export async function runVectorDbMain(
  args: string[],
  cliRunner: typeof runVectorDbCli = runVectorDbCli,
): Promise<void> {
  await cliRunner(args);
}

export async function main(
  args: string[] = readVectorDbEntrypointArgs(),
): Promise<void> {
  await runVectorDbMain(args);
}

const vectorDbEntrypointRunners = createStandaloneEntrypointWrapperRunners(module, main);

export function shouldRunVectorDbEntrypoint(
  currentModule: NodeModule = module,
  mainModule?: NodeModule,
): boolean {
  return vectorDbEntrypointRunners.shouldRunEntrypoint(currentModule, mainModule);
}

export const runVectorDbEntrypoint = vectorDbEntrypointRunners.runEntrypoint;
export function runVectorDbEntrypointIfMain(
  currentModule: NodeModule = module,
  mainModule?: NodeModule,
  entrypoint = main,
): Promise<void> | undefined {
  return vectorDbEntrypointRunners.runEntrypointIfMain(
    currentModule,
    mainModule,
    entrypoint,
  );
}

void runVectorDbEntrypointIfMain();
