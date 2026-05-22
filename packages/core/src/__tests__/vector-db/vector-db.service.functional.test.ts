import { VectorDatabaseService, getVectorDB } from '../../vector-db/vector-db.service';

describe('VectorDatabaseService functional behavior', () => {
  test('initializes from persisted data, reindexes through shared helpers, and exports stored JSON', async () => {
    const storedIndex = {
      version: '1.0',
      generatedAt: '2026-05-22T00:00:00.000Z',
      projectName: 'Edison',
      projectPath: 'D:/repo',
      statistics: {
        totalFiles: 1,
        totalModules: 1,
        totalLines: 1,
        categories: { service: 1 },
      },
      documents: [
        {
          id: 'packages/core/src/services/logger.service.ts',
          type: 'service' as const,
          filePath: 'packages/core/src/services/logger.service.ts',
          name: 'LoggerService',
          description: 'Logger',
          category: 'service',
          tags: [],
          content: 'export class LoggerService {}',
          keywords: ['logger'],
          size: 10,
          lastUpdated: '2026-05-22T00:00:00.000Z',
          relatedModules: [],
        },
      ],
      lastIndexUpdate: '2026-05-22T00:00:00.000Z',
    };
    const rebuiltIndex = {
      ...storedIndex,
      documents: [
        {
          ...storedIndex.documents[0],
          id: 'packages/core/src/services/updated.service.ts',
          filePath: 'packages/core/src/services/updated.service.ts',
          name: 'UpdatedService',
        },
      ],
    };
    const store = {
      clear: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getByCategory: jest.fn(),
      getDocument: jest.fn(),
      getStats: jest.fn(),
      init: jest.fn().mockResolvedValue(undefined),
      storeDocuments: jest.fn().mockResolvedValue(undefined),
    };
    const searchService = {
      autocomplete: jest.fn(),
      findRelated: jest.fn(),
      search: jest.fn(),
      searchByCategory: jest.fn(),
    };
    const indexer = {
      indexProject: jest.fn().mockResolvedValue(rebuiltIndex),
    };
    const storage = {
      hasStoredProjectIndex: jest.fn().mockReturnValue(true),
      loadStoredProjectIndex: jest.fn().mockReturnValue(storedIndex),
      saveStoredProjectIndex: jest.fn(),
    };
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    const service = new VectorDatabaseService(
      'D:/repo',
      'vector-db.sqlite',
      '.vector-db/index.json',
      {
        createIndexer: () => indexer as never,
        createSearchService: () => searchService as never,
        createStore: () => store as never,
        logger,
        storage,
      },
    );

    await service.init();
    await service.init();
    expect(store.init).toHaveBeenCalledTimes(1);
    expect(store.storeDocuments).toHaveBeenCalledWith(storedIndex.documents);
    expect(indexer.indexProject).not.toHaveBeenCalled();

    await expect(service.exportIndex()).resolves.toContain('LoggerService');
    await expect(service.reindex()).resolves.toEqual(rebuiltIndex);
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(indexer.indexProject).toHaveBeenCalledTimes(1);
    expect(storage.saveStoredProjectIndex).toHaveBeenCalledWith(
      expect.stringContaining('.vector-db'),
      rebuiltIndex,
    );
  });

  test('getVectorDB caches the first initialized instance', async () => {
    class TestVectorDatabaseService extends VectorDatabaseService {
      public initCalls = 0;

      override async init(): Promise<void> {
        this.initCalls += 1;
      }
    }

    const createService = jest.fn(
      (projectPath: string, dbPath: string, indexPath: string) =>
        new TestVectorDatabaseService(projectPath, dbPath, indexPath),
    );

    const first = await getVectorDB('D:/singleton', 'vector-db.sqlite', '.vector-db/index.json', createService);
    const second = await getVectorDB('D:/ignored', 'other.sqlite', '.vector-db/other.json', createService);

    expect(createService).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect((first as TestVectorDatabaseService).initCalls).toBe(1);
  });
});
