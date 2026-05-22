import { main } from './cli';
import {
  runStandaloneEntrypoint,
  runStandaloneEntrypointIfMain,
  shouldRunStandaloneEntrypoint,
} from './standalone-entrypoint-runtime';

const LEGACY_CORE_RUNTIME_EXPORT_NAMES = [
  'createBot',
  'createBotRuntime',
  'createConfiguredBot',
  'createConfiguredBotRuntime',
  'loadBotRuntimeConfig',
  'startBot',
  'startConfiguredBot',
] as const;

export const LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES = [
  'BotFactory',
  ...LEGACY_CORE_RUNTIME_EXPORT_NAMES,
  'main',
  'runLegacyCliEntrypoint',
] as const;

export type LegacyCoreEntrypointExportName =
  (typeof LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES)[number];

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
