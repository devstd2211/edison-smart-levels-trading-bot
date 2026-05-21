import {
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
});
