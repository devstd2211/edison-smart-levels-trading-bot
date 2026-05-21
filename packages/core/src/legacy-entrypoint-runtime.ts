import { main } from './cli';

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
  return cliEntrypoint();
}

export function shouldRunLegacyCliEntrypoint(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined,
): boolean {
  return currentModule === mainModule;
}

export function runLegacyCliEntrypointIfMain(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined = require.main,
  cliEntrypoint: LegacyCliEntrypoint = main,
): Promise<void> | undefined {
  if (!shouldRunLegacyCliEntrypoint(currentModule, mainModule)) {
    return undefined;
  }

  return runLegacyCliEntrypoint(cliEntrypoint);
}
