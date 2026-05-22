import {
  createStandaloneEntrypointRunners,
} from './standalone-entrypoint-runtime';
import { runVectorDbCli } from './vector-db/cli';

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  await runVectorDbCli(args);
}

const vectorDbEntrypointRunners = createStandaloneEntrypointRunners(main);

export const runVectorDbEntrypoint = vectorDbEntrypointRunners.runEntrypoint;
export const runVectorDbEntrypointIfMain = vectorDbEntrypointRunners.runEntrypointIfMain;

void runVectorDbEntrypointIfMain(module, require.main);
