const mockRunStandaloneEntrypoint = jest.fn().mockResolvedValue(undefined);
const mockRunStandaloneEntrypointIfMain = jest.fn<
  Promise<void> | undefined,
  [NodeModule, NodeModule | undefined, (() => Promise<void>)?]
>(() => undefined);
const mockCreateStandaloneEntrypointRunners = jest.fn(
  (defaultEntrypoint: () => Promise<void>) => ({
    shouldRunEntrypoint: jest.fn(
      (currentModule: NodeModule, mainModule: NodeModule | undefined) =>
        currentModule === mainModule,
    ),
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
  COLLECT_DATA_ENTRYPOINT_EXPORT_NAMES,
  main as collectDataMain,
  runCollectDataEntrypoint,
  runCollectDataEntrypointIfMain,
  shouldRunCollectDataEntrypoint,
} from '../../collect-data';
import {
  TEST_BALANCE_ENTRYPOINT_EXPORT_NAMES,
  main as testBalanceMain,
  runTestBalanceEntrypoint,
  runTestBalanceEntrypointIfMain,
  shouldRunTestBalanceEntrypoint,
} from '../../test-balance';
import {
  VECTOR_DB_ENTRYPOINT_EXPORT_NAMES,
  main as vectorDbMain,
  readVectorDbEntrypointArgs,
  runVectorDbEntrypoint,
  runVectorDbEntrypointIfMain,
  runVectorDbMain,
  shouldRunVectorDbEntrypoint,
} from '../../vector-db';
import * as collectDataEntrypointModule from '../../collect-data';
import * as testBalanceEntrypointModule from '../../test-balance';
import * as vectorDbEntrypointModule from '../../vector-db';

describe('standalone script entrypoints', () => {
  test('standalone wrappers keep focused export surfaces around main and shared runner helpers', () => {
    expect(Object.keys(collectDataEntrypointModule).sort()).toEqual(
      [...COLLECT_DATA_ENTRYPOINT_EXPORT_NAMES].sort(),
    );
    expect(Object.keys(testBalanceEntrypointModule).sort()).toEqual(
      [...TEST_BALANCE_ENTRYPOINT_EXPORT_NAMES].sort(),
    );
    expect(Object.keys(vectorDbEntrypointModule).sort()).toEqual(
      [...VECTOR_DB_ENTRYPOINT_EXPORT_NAMES].sort(),
    );
  });

  test('importing standalone scripts exposes main without auto-running the entrypoint body', () => {
    expect(typeof collectDataMain).toBe('function');
    expect(typeof testBalanceMain).toBe('function');
    expect(typeof vectorDbMain).toBe('function');
    expect(mockCreateStandaloneEntrypointRunners).toHaveBeenNthCalledWith(1, collectDataMain);
    expect(mockCreateStandaloneEntrypointRunners).toHaveBeenNthCalledWith(2, testBalanceMain);
    expect(mockCreateStandaloneEntrypointRunners).toHaveBeenNthCalledWith(3, vectorDbMain);
    expect(mockRunStandaloneEntrypoint).not.toHaveBeenCalled();
    expect(mockRunStandaloneEntrypointIfMain).toHaveBeenCalledTimes(3);
    expect(mockRunStandaloneEntrypointIfMain).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.anything(),
      collectDataMain,
    );
    expect(mockRunStandaloneEntrypointIfMain).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.anything(),
      testBalanceMain,
    );
    expect(mockRunStandaloneEntrypointIfMain).toHaveBeenNthCalledWith(
      3,
      expect.any(Object),
      expect.anything(),
      vectorDbMain,
    );
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

  test('main wrappers delegate to the extracted runtime-step helpers without rebuilding orchestration inline', async () => {
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

  test('test-balance wrapper delegates setup-failure classification to the shared workflow helper', async () => {
    mockRunTestBalanceWorkflow.mockClear();

    await testBalanceMain();

    expect(mockRunTestBalanceWorkflow).toHaveBeenCalledTimes(1);
  });

  test('standalone wrappers expose the shared direct-execution guard explicitly', () => {
    const currentModule = { id: 'standalone-wrapper' } as NodeModule;
    const otherModule = { id: 'other' } as NodeModule;

    expect(shouldRunCollectDataEntrypoint(currentModule, currentModule)).toBe(true);
    expect(shouldRunCollectDataEntrypoint(currentModule, otherModule)).toBe(false);
    expect(shouldRunTestBalanceEntrypoint(currentModule, currentModule)).toBe(true);
    expect(shouldRunTestBalanceEntrypoint(currentModule, otherModule)).toBe(false);
    expect(shouldRunVectorDbEntrypoint(currentModule, currentModule)).toBe(true);
    expect(shouldRunVectorDbEntrypoint(currentModule, otherModule)).toBe(false);
  });

  test('vector-db wrapper reads CLI args in one place before delegating to the extracted runtime', async () => {
    const argv = ['node', 'vector-db.js', 'stats'];
    const args = readVectorDbEntrypointArgs(argv);
    mockRunVectorDbCli.mockClear();

    expect(args).toEqual(['stats']);

    await vectorDbMain(args);
    await runVectorDbMain(['search', 'ema']);

    expect(mockRunVectorDbCli).toHaveBeenNthCalledWith(1, ['stats']);
    expect(mockRunVectorDbCli).toHaveBeenNthCalledWith(2, ['search', 'ema']);
  });
});
