import {
  createStandaloneEntrypointRunners,
  createStandaloneEntrypointModuleRunners,
  resolveStandaloneEntrypointMainModule,
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

  test('exports the shared main-module resolver used by reusable standalone guards', () => {
    const currentModule = { id: 'standalone' } as NodeModule;

    expect(typeof resolveStandaloneEntrypointMainModule).toBe('function');
    expect(shouldRunStandaloneEntrypoint(currentModule, currentModule)).toBe(true);
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

  test('reusable runners consult the shared main-module resolver when the caller omits mainModule', async () => {
    const defaultEntrypoint = jest.fn().mockResolvedValue(undefined);
    const currentModule = { id: 'standalone' } as NodeModule;
    const otherModule = { id: 'other' } as NodeModule;
    const resolveMainModule = jest.fn(() => currentModule);
    const runners = createStandaloneEntrypointRunners(defaultEntrypoint, resolveMainModule);

    expect(runners.shouldRunEntrypoint(currentModule)).toBe(true);
    expect(runners.shouldRunEntrypoint(otherModule)).toBe(false);
    expect(runners.runEntrypointIfMain(otherModule)).toBeUndefined();
    await expect(runners.runEntrypointIfMain(currentModule)).resolves.toBeUndefined();

    expect(defaultEntrypoint).toHaveBeenCalledTimes(1);
    expect(resolveMainModule).toHaveBeenCalledTimes(4);
  });

  test('module-bound runners capture currentModule once and reuse the shared default main-module resolver', async () => {
    const defaultEntrypoint = jest.fn().mockResolvedValue(undefined);
    const overrideEntrypoint = jest.fn().mockResolvedValue(undefined);
    const currentModule = { id: 'standalone' } as NodeModule;
    const otherModule = { id: 'other' } as NodeModule;
    const resolveMainModule = jest.fn(() => currentModule);
    const runners = createStandaloneEntrypointModuleRunners(
      currentModule,
      defaultEntrypoint,
      resolveMainModule,
    );

    expect(runners.shouldRunCurrentEntrypoint()).toBe(true);
    expect(runners.shouldRunCurrentEntrypoint(otherModule)).toBe(false);
    expect(runners.runCurrentEntrypointIfMain(otherModule)).toBeUndefined();
    await expect(runners.runCurrentEntrypointIfMain()).resolves.toBeUndefined();
    await expect(
      runners.runCurrentEntrypointIfMain(currentModule, overrideEntrypoint),
    ).resolves.toBeUndefined();

    expect(defaultEntrypoint).toHaveBeenCalledTimes(1);
    expect(overrideEntrypoint).toHaveBeenCalledTimes(1);
    expect(resolveMainModule).toHaveBeenCalledTimes(2);
  });
});
