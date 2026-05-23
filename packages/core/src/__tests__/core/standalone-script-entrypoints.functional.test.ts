const mockRunStandaloneEntrypoint = jest.fn().mockResolvedValue(undefined);
const mockRunStandaloneEntrypointIfMain = jest.fn<
  Promise<void> | undefined,
  [NodeModule, NodeModule | undefined, (() => Promise<void>)?]
>(() => undefined);
const mockCreateStandaloneEntrypointRunners = jest.fn(
  (defaultEntrypoint: () => Promise<void>) => ({
    runEntrypoint: (entrypoint: () => Promise<void> = defaultEntrypoint) =>
      mockRunStandaloneEntrypoint(entrypoint),
    runEntrypointIfMain: (
      currentModule: NodeModule,
      mainModule: NodeModule | undefined,
      entrypoint: () => Promise<void> = defaultEntrypoint,
    ) => mockRunStandaloneEntrypointIfMain(currentModule, mainModule, entrypoint),
  }),
);

jest.mock('../../standalone-entrypoint-runtime', () => ({
  createStandaloneEntrypointRunners: mockCreateStandaloneEntrypointRunners,
}));

const mockRunCollectDataWorkflow = jest.fn().mockResolvedValue(undefined);
const mockRunTestBalanceWorkflow = jest.fn().mockResolvedValue(undefined);
const mockRunVectorDbCli = jest.fn().mockResolvedValue(undefined);

jest.mock('../../collect-data.entrypoint', () => ({
  runCollectDataWorkflow: mockRunCollectDataWorkflow,
}));

jest.mock('../../test-balance.entrypoint', () => ({
  runTestBalanceWorkflow: mockRunTestBalanceWorkflow,
}));

jest.mock('../../vector-db/cli', () => ({
  runVectorDbCli: mockRunVectorDbCli,
}));

import {
  main as collectDataMain,
  runCollectDataEntrypoint,
  runCollectDataEntrypointIfMain,
} from '../../collect-data';
import {
  main as testBalanceMain,
  runTestBalanceEntrypoint,
  runTestBalanceEntrypointIfMain,
} from '../../test-balance';
import {
  main as vectorDbMain,
  runVectorDbEntrypoint,
  runVectorDbEntrypointIfMain,
} from '../../vector-db';

describe('standalone script entrypoints', () => {
  test('importing standalone scripts exposes main without auto-running the entrypoint body', () => {
    expect(typeof collectDataMain).toBe('function');
    expect(typeof testBalanceMain).toBe('function');
    expect(typeof vectorDbMain).toBe('function');
    expect(mockCreateStandaloneEntrypointRunners).toHaveBeenNthCalledWith(1, collectDataMain);
    expect(mockCreateStandaloneEntrypointRunners).toHaveBeenNthCalledWith(2, testBalanceMain);
    expect(mockCreateStandaloneEntrypointRunners).toHaveBeenNthCalledWith(3, vectorDbMain);
    expect(mockRunStandaloneEntrypoint).not.toHaveBeenCalled();
    expect(mockRunStandaloneEntrypointIfMain).toHaveBeenCalledTimes(3);
  });

  test('explicit standalone runners delegate execution through the shared runtime helper', async () => {
    mockRunStandaloneEntrypoint.mockClear();
    const collectDataEntrypoint = jest.fn().mockResolvedValue(undefined);
    const testBalanceEntrypoint = jest.fn().mockResolvedValue(undefined);
    const vectorDbEntrypoint = jest.fn().mockResolvedValue(undefined);

    await expect(runCollectDataEntrypoint(collectDataEntrypoint)).resolves.toBeUndefined();
    await expect(runTestBalanceEntrypoint(testBalanceEntrypoint)).resolves.toBeUndefined();
    await expect(runVectorDbEntrypoint(vectorDbEntrypoint)).resolves.toBeUndefined();

    expect(mockRunStandaloneEntrypoint).toHaveBeenNthCalledWith(1, collectDataEntrypoint);
    expect(mockRunStandaloneEntrypoint).toHaveBeenNthCalledWith(2, testBalanceEntrypoint);
    expect(mockRunStandaloneEntrypoint).toHaveBeenNthCalledWith(3, vectorDbEntrypoint);
  });

  test('main wrappers delegate to the extracted workflow helpers without rebuilding orchestration inline', async () => {
    await collectDataMain();
    await testBalanceMain();
    await vectorDbMain(['stats']);

    expect(mockRunCollectDataWorkflow).toHaveBeenCalledTimes(1);
    expect(mockRunTestBalanceWorkflow).toHaveBeenCalledTimes(1);
    expect(mockRunVectorDbCli).toHaveBeenCalledWith(['stats']);
  });

  test('shared if-main runners stay exposed for each standalone script wrapper', () => {
    expect(typeof runCollectDataEntrypointIfMain).toBe('function');
    expect(typeof runTestBalanceEntrypointIfMain).toBe('function');
    expect(typeof runVectorDbEntrypointIfMain).toBe('function');
  });
});
