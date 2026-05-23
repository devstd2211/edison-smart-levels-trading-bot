import {
  createStandaloneEntrypointRunners,
} from './standalone-entrypoint-runtime';
import { runVectorDbCli } from './vector-db/cli';

export async function runVectorDbMain(
  args: string[] = process.argv.slice(2),
  cliRunner: (cliArgs: string[]) => Promise<void> = runVectorDbCli,
): Promise<void> {
  await cliRunner(args);
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  await runVectorDbMain(args);
}

const vectorDbEntrypointRunners = createStandaloneEntrypointRunners(main);

export const runVectorDbEntrypoint = vectorDbEntrypointRunners.runEntrypoint;
export const runVectorDbEntrypointIfMain = vectorDbEntrypointRunners.runEntrypointIfMain;

void runVectorDbEntrypointIfMain(module, require.main);
