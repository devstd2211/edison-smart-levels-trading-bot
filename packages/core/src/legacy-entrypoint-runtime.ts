import { main } from './cli';
import {
  runStandaloneEntrypoint,
  runStandaloneEntrypointIfMain,
  shouldRunStandaloneEntrypoint,
} from './standalone-entrypoint-runtime';

export const LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES = [
  'BotFactory',
  'createBot',
  'createBotRuntime',
  'createConfiguredBot',
  'createConfiguredBotRuntime',
  'loadBotRuntimeConfig',
  'main',
  'runLegacyCliEntrypoint',
  'startBot',
  'startConfiguredBot',
] as const;

type LegacyCliEntrypoint = () => Promise<void>;

export function runLegacyCliEntrypoint(
  cliEntrypoint: LegacyCliEntrypoint = main,
): Promise<void> {
  return runStandaloneEntrypoint(cliEntrypoint);
}

export function shouldRunLegacyCliEntrypoint(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined,
): boolean {
  return shouldRunStandaloneEntrypoint(currentModule, mainModule);
}

export function runLegacyCliEntrypointIfMain(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined = require.main,
  cliEntrypoint: LegacyCliEntrypoint = main,
): Promise<void> | undefined {
  return runStandaloneEntrypointIfMain(currentModule, mainModule, cliEntrypoint);
}
