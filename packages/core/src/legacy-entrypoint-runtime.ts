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
 * Builds the compatibility root export contract from the composed core helper
 * surface, excluding the core marker constant and appending only the CLI handoff.
 * This runtime layer also owns the shared CLI `main` handoff so the root wrapper
 * does not need to import the dedicated CLI entrypoint directly.
 */
const CORE_ENTRYPOINT_EXPORT_MARKER = 'CORE_ENTRYPOINT_EXPORT_NAMES';

type LegacyCoreRuntimeExportName = Exclude<
  (typeof CORE_ENTRYPOINT_EXPORT_NAMES)[number],
  typeof CORE_ENTRYPOINT_EXPORT_MARKER
>;

const LEGACY_CORE_RUNTIME_EXPORT_NAMES =
  CORE_ENTRYPOINT_EXPORT_NAMES.filter(
    (name) => name !== CORE_ENTRYPOINT_EXPORT_MARKER,
  ) as LegacyCoreRuntimeExportName[];

export const LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES = Object.freeze([
  'BotFactory',
  ...LEGACY_CORE_RUNTIME_EXPORT_NAMES,
  'main',
  'runLegacyCliEntrypoint',
] as const);

export type LegacyCoreEntrypointExportName =
  (typeof LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES)[number];

type LegacyCliEntrypoint = () => Promise<void>;
export { main };

export function createLegacyEntrypointRunners(
  defaultEntrypoint: LegacyCliEntrypoint = main,
  resolveMainModule: StandaloneEntrypointMainModuleResolver =
    resolveStandaloneEntrypointMainModule,
) {
  return Object.freeze(
    createStandaloneEntrypointRunners(defaultEntrypoint, resolveMainModule),
  );
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

/**
 * Owns the root-wrapper direct-execution guard so the compatibility barrel
 * does not need to know how main-module resolution is wired.
 */
export function runLegacyCliEntrypointFromModule(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined = resolveStandaloneEntrypointMainModule(),
  cliEntrypoint: LegacyCliEntrypoint = main,
): Promise<void> | undefined {
  return runLegacyCliEntrypointIfMain(currentModule, mainModule, cliEntrypoint);
}
