import { main } from './cli';
import { CORE_ENTRYPOINT_EXPORT_NAMES } from './core';
import {
  createStandaloneEntrypointRunners,
  resolveStandaloneEntrypointMainModule,
  type StandaloneEntrypointMainModuleResolver,
} from './standalone-entrypoint-runtime';

/**
 * Legacy wrapper runtime boundary.
 *
 * Compatibility wrapper exports stay explicit: runtime helpers plus the CLI handoff.
 */
type LegacyCoreRuntimeExportName = Exclude<
  (typeof CORE_ENTRYPOINT_EXPORT_NAMES)[number],
  'CORE_ENTRYPOINT_EXPORT_NAMES'
>;

const LEGACY_CORE_RUNTIME_EXPORT_NAMES =
  CORE_ENTRYPOINT_EXPORT_NAMES.filter(
    (name) => name !== 'CORE_ENTRYPOINT_EXPORT_NAMES',
  ) as LegacyCoreRuntimeExportName[];

export const LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES = [
  'BotFactory',
  ...LEGACY_CORE_RUNTIME_EXPORT_NAMES,
  'main',
  'runLegacyCliEntrypoint',
] as const;

export type LegacyCoreEntrypointExportName =
  (typeof LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES)[number];

type LegacyCliEntrypoint = () => Promise<void>;

export function createLegacyEntrypointRunners(
  defaultEntrypoint: LegacyCliEntrypoint = main,
  resolveMainModule: StandaloneEntrypointMainModuleResolver =
    resolveStandaloneEntrypointMainModule,
) {
  return createStandaloneEntrypointRunners(defaultEntrypoint, resolveMainModule);
}

const legacyEntrypointRunners = createLegacyEntrypointRunners();

export function runLegacyCliEntrypoint(
  cliEntrypoint: LegacyCliEntrypoint = main,
): Promise<void> {
  return legacyEntrypointRunners.runEntrypoint(cliEntrypoint);
}

export function shouldRunLegacyCliEntrypoint(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined = resolveStandaloneEntrypointMainModule(),
): boolean {
  return legacyEntrypointRunners.shouldRunEntrypoint(currentModule, mainModule);
}

export function runLegacyCliEntrypointIfMain(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined = resolveStandaloneEntrypointMainModule(),
  cliEntrypoint: LegacyCliEntrypoint = main,
): Promise<void> | undefined {
  return legacyEntrypointRunners.runEntrypointIfMain(
    currentModule,
    mainModule,
    cliEntrypoint,
  );
}
