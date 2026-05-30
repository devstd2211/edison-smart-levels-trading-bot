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

export type StandaloneEntrypointModuleRunner = {
  shouldRunCurrentEntrypoint: (mainModule?: NodeModule) => boolean;
  runCurrentEntrypointIfMain: (
    mainModule?: NodeModule,
    entrypoint?: StandaloneEntrypoint,
  ) => Promise<void> | undefined;
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
  mainModule: NodeModule | undefined = resolveStandaloneEntrypointMainModule(),
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

export function createStandaloneEntrypointModuleRunners(
  currentModule: NodeModule,
  defaultEntrypoint: StandaloneEntrypoint,
  resolveMainModule: StandaloneEntrypointMainModuleResolver =
    resolveStandaloneEntrypointMainModule,
): StandaloneEntrypointModuleRunner {
  const runners = createStandaloneEntrypointRunners(
    defaultEntrypoint,
    resolveMainModule,
  );

  return {
    shouldRunCurrentEntrypoint: (mainModule = resolveMainModule()) =>
      runners.shouldRunEntrypoint(currentModule, mainModule),
    runCurrentEntrypointIfMain: (
      mainModule = resolveMainModule(),
      entrypoint = defaultEntrypoint,
    ) => runners.runEntrypointIfMain(currentModule, mainModule, entrypoint),
  };
}
