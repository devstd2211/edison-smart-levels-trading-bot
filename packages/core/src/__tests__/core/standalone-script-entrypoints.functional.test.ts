const mockRunStandaloneEntrypoint = jest.fn(
  (entrypoint: () => Promise<void>) => entrypoint(),
);
const mockRunStandaloneEntrypointIfMain = jest.fn(() => undefined);

jest.mock('../../standalone-entrypoint-runtime', () => ({
  runStandaloneEntrypoint: mockRunStandaloneEntrypoint,
  runStandaloneEntrypointIfMain: mockRunStandaloneEntrypointIfMain,
}));

import {
  main as collectDataMain,
  runCollectDataEntrypoint,
} from '../../collect-data';
import {
  main as testBalanceMain,
  runTestBalanceEntrypoint,
} from '../../test-balance';
import {
  main as vectorDbMain,
  runVectorDbEntrypoint,
} from '../../vector-db';

describe('standalone script entrypoints', () => {
  test('importing standalone scripts exposes main without auto-running the entrypoint body', () => {
    expect(typeof collectDataMain).toBe('function');
    expect(typeof testBalanceMain).toBe('function');
    expect(typeof vectorDbMain).toBe('function');
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
});
