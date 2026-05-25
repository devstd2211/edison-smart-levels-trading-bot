import {
  createStandaloneEntrypointRunners,
  runStandaloneEntrypoint,
  runStandaloneEntrypointIfMain,
  shouldRunStandaloneEntrypoint,
} from '../../standalone-entrypoint-runtime';

describe('standalone entrypoint runtime', () => {
  test('delegates execution to the provided entrypoint', async () => {
    const entrypoint = jest.fn().mockResolvedValue(undefined);

    await expect(runStandaloneEntrypoint(entrypoint)).resolves.toBeUndefined();
    expect(entrypoint).toHaveBeenCalledTimes(1);
  });

  test('only runs a standalone entrypoint when the current module is the main module', async () => {
    const entrypoint = jest.fn().mockResolvedValue(undefined);
    const currentModule = { id: 'standalone' } as NodeModule;
    const otherModule = { id: 'other' } as NodeModule;

    expect(shouldRunStandaloneEntrypoint(currentModule, currentModule)).toBe(true);
    expect(shouldRunStandaloneEntrypoint(currentModule, otherModule)).toBe(false);
    expect(runStandaloneEntrypointIfMain(currentModule, otherModule, entrypoint)).toBeUndefined();

    await expect(
      runStandaloneEntrypointIfMain(currentModule, currentModule, entrypoint),
    ).resolves.toBeUndefined();
    expect(entrypoint).toHaveBeenCalledTimes(1);
  });

  test('creates reusable standalone entrypoint runners with shared default execution guards', async () => {
    const defaultEntrypoint = jest.fn().mockResolvedValue(undefined);
    const overrideEntrypoint = jest.fn().mockResolvedValue(undefined);
    const currentModule = { id: 'standalone' } as NodeModule;
    const otherModule = { id: 'other' } as NodeModule;
    const runners = createStandaloneEntrypointRunners(defaultEntrypoint);

    await expect(runners.runEntrypoint()).resolves.toBeUndefined();
    await expect(runners.runEntrypoint(overrideEntrypoint)).resolves.toBeUndefined();
    expect(runners.shouldRunEntrypoint(currentModule, currentModule)).toBe(true);
    expect(runners.shouldRunEntrypoint(currentModule, otherModule)).toBe(false);
    expect(runners.runEntrypointIfMain(currentModule, otherModule)).toBeUndefined();

    await expect(
      runners.runEntrypointIfMain(currentModule, currentModule),
    ).resolves.toBeUndefined();
    await expect(
      runners.runEntrypointIfMain(currentModule, currentModule, overrideEntrypoint),
    ).resolves.toBeUndefined();

    expect(defaultEntrypoint).toHaveBeenCalledTimes(2);
    expect(overrideEntrypoint).toHaveBeenCalledTimes(2);
  });
});
