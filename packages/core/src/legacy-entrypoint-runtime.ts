import { main } from './cli';
import {
  createStandaloneEntrypointRunners,
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

const legacyEntrypointRunners = createStandaloneEntrypointRunners(main);

export function runLegacyCliEntrypoint(
  cliEntrypoint: LegacyCliEntrypoint = main,
): Promise<void> {
  return legacyEntrypointRunners.runEntrypoint(cliEntrypoint);
}

export function shouldRunLegacyCliEntrypoint(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined,
): boolean {
  return legacyEntrypointRunners.shouldRunEntrypoint(currentModule, mainModule);
}

export function runLegacyCliEntrypointIfMain(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined = require.main,
  cliEntrypoint: LegacyCliEntrypoint = main,
): Promise<void> | undefined {
  return legacyEntrypointRunners.runEntrypointIfMain(
    currentModule,
    mainModule,
    cliEntrypoint,
  );
}
