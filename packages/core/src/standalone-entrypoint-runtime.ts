export type StandaloneEntrypoint = () => Promise<void>;
export type StandaloneEntrypointMainModuleResolver = () => NodeModule | undefined;
export type StandaloneEntrypointRunner = (
  entrypoint?: StandaloneEntrypoint,
) => Promise<void>;
export type StandaloneEntrypointIfMainRunner = (
  currentModule: NodeModule,
  mainModule?: NodeModule,
  entrypoint?: StandaloneEntrypoint,
) => Promise<void> | undefined;
export type StandaloneEntrypointGuard = (
  currentModule: NodeModule,
  mainModule?: NodeModule,
) => boolean;

export type StandaloneEntrypointRunners = {
  shouldRunEntrypoint: StandaloneEntrypointGuard;
  runEntrypoint: StandaloneEntrypointRunner;
  runEntrypointIfMain: StandaloneEntrypointIfMainRunner;
};

export function resolveStandaloneEntrypointMainModule(): NodeModule | undefined {
  return require.main;
}

export function runStandaloneEntrypoint(
  entrypoint: StandaloneEntrypoint,
): Promise<void> {
  return entrypoint();
}

export function shouldRunStandaloneEntrypoint(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined,
): boolean {
  return currentModule === mainModule;
}

export function runStandaloneEntrypointIfMain(
  currentModule: NodeModule,
  mainModule: NodeModule | undefined,
  entrypoint: StandaloneEntrypoint,
): Promise<void> | undefined {
  if (!shouldRunStandaloneEntrypoint(currentModule, mainModule)) {
    return undefined;
  }

  return runStandaloneEntrypoint(entrypoint);
}

export function createStandaloneEntrypointRunners(
  defaultEntrypoint: StandaloneEntrypoint,
  resolveMainModule: StandaloneEntrypointMainModuleResolver =
    resolveStandaloneEntrypointMainModule,
): StandaloneEntrypointRunners {
  return {
    shouldRunEntrypoint: (
      currentModule,
      mainModule = resolveMainModule(),
    ) => shouldRunStandaloneEntrypoint(currentModule, mainModule),
    runEntrypoint: (entrypoint = defaultEntrypoint) =>
      runStandaloneEntrypoint(entrypoint),
    runEntrypointIfMain: (
      currentModule,
      mainModule = resolveMainModule(),
      entrypoint = defaultEntrypoint,
    ) => runStandaloneEntrypointIfMain(currentModule, mainModule, entrypoint),
  };
}
