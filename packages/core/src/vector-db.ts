import {
  runStandaloneEntrypoint,
  runStandaloneEntrypointIfMain,
} from './standalone-entrypoint-runtime';
import { runVectorDbCli } from './vector-db/cli';

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  await runVectorDbCli(args);
}

export function runVectorDbEntrypoint(
  entrypoint: () => Promise<void> = () => main(),
): Promise<void> {
  return runStandaloneEntrypoint(entrypoint);
}

export function runVectorDbEntrypointIfMain(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined = require.main,
  entrypoint: () => Promise<void> = () => runVectorDbEntrypoint(),
): Promise<void> | undefined {
  return runStandaloneEntrypointIfMain(currentModule, mainModule, entrypoint);
}

void runVectorDbEntrypointIfMain(module, require.main);
