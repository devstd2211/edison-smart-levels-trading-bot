export type StandaloneEntrypoint = () => Promise<void>;
export type StandaloneEntrypointRunner = (
  entrypoint?: StandaloneEntrypoint,
) => Promise<void>;
export type StandaloneEntrypointIfMainRunner = (
  currentModule: NodeModule,
  mainModule?: NodeModule,
  entrypoint?: StandaloneEntrypoint,
) => Promise<void> | undefined;

export type StandaloneEntrypointRunners = {
  runEntrypoint: StandaloneEntrypointRunner;
  runEntrypointIfMain: StandaloneEntrypointIfMainRunner;
};

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
): StandaloneEntrypointRunners {
  return {
    runEntrypoint: (entrypoint = defaultEntrypoint) =>
      runStandaloneEntrypoint(entrypoint),
    runEntrypointIfMain: (
      currentModule,
      mainModule = require.main,
      entrypoint = defaultEntrypoint,
    ) => runStandaloneEntrypointIfMain(currentModule, mainModule, entrypoint),
  };
}
