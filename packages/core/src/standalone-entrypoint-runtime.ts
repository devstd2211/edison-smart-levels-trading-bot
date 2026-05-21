export type StandaloneEntrypoint = () => Promise<void>;

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
