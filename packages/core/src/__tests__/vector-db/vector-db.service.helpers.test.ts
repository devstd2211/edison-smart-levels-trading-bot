import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEFAULT_VECTOR_DB_PATH,
  DEFAULT_VECTOR_INDEX_PATH,
  resolveVectorDbRuntimePaths,
} from '../../vector-db/vector-db-runtime-paths';
import {
  createVectorDbIndexStorage,
} from '../../vector-db/vector-db-index-storage';
import {
  createAndSaveVectorDbIndex,
  exportVectorDbIndex,
  initializeVectorDbIndex,
  loadVectorDbIndex,
  reindexVectorDbProject,
} from '../../vector-db/vector-db-service-index';
import type { ProjectIndex } from '../../vector-db/vector-db.types';

describe('vector-db service helpers', () => {
  test('resolveVectorDbRuntimePaths resolves relative db and index paths from the project root', () => {
    expect(
      resolveVectorDbRuntimePaths('D:/repo', DEFAULT_VECTOR_DB_PATH, DEFAULT_VECTOR_INDEX_PATH),
    ).toEqual({
      projectPath: path.resolve('D:/repo'),
      dbPath: path.join(path.resolve('D:/repo'), 'vector-db.sqlite'),
      indexPath: path.join(path.resolve('D:/repo'), '.vector-db/index.json'),
    });
  });

  test('resolveVectorDbRuntimePaths preserves explicit absolute storage paths', () => {
    expect(
      resolveVectorDbRuntimePaths('D:/repo', 'C:/data/vector.sqlite', 'C:/data/index.json'),
    ).toEqual({
      projectPath: path.resolve('D:/repo'),
      dbPath: 'C:/data/vector.sqlite',
      indexPath: 'C:/data/index.json',
    });
  });

  test('saveStoredProjectIndex creates the parent directory and round-trips stored data', () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-db-index-'));
    const indexPath = path.join(tempDirectory, '.vector-db', 'index.json');
    const storage = createVectorDbIndexStorage(indexPath);
    const index: ProjectIndex = {
      version: '1.0',
      generatedAt: '2026-05-22T00:00:00.000Z',
      projectName: 'Edison',
      projectPath: 'D:/repo',
      statistics: {
        totalFiles: 1,
        totalModules: 1,
        totalLines: 10,
        categories: {
          service: 1,
        },
      },
      documents: [],
      lastIndexUpdate: '2026-05-22T00:00:00.000Z',
    };

    storage.saveStoredProjectIndex(index);

    expect(storage.hasStoredProjectIndex()).toBe(true);
    expect(storage.loadStoredProjectIndex()).toEqual(index);
    expect(exportVectorDbIndex(storage)).toContain('Edison');

    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  test('service index helpers choose between loading and creating persisted indexes', async () => {
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    const storage = {
      hasStoredProjectIndex: jest.fn().mockReturnValue(true),
      loadStoredProjectIndex: jest.fn(),
      saveStoredProjectIndex: jest.fn(),
      exportStoredProjectIndex: jest.fn(),
    };
    const loadIndex = jest.fn().mockResolvedValue({ version: '1.0' });
    const createAndSaveIndex = jest.fn();

    await initializeVectorDbIndex({
      createAndSaveIndex,
      loadIndex,
      logger,
      storage,
      icons: {
        open_folder: '[open]',
        search: '[search]',
      },
    });

    expect(loadIndex).toHaveBeenCalledTimes(1);
    expect(createAndSaveIndex).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('[open] Loading existing index...');
  });

  test('service index helpers store loaded and reindexed documents through shared storage boundaries', async () => {
    const index: ProjectIndex = {
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
          type: 'service',
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
    const store = {
      clear: jest.fn().mockResolvedValue(undefined),
      storeDocuments: jest.fn().mockResolvedValue(undefined),
    };
    const storage = {
      hasStoredProjectIndex: jest.fn(),
      loadStoredProjectIndex: jest.fn().mockReturnValue(index),
      saveStoredProjectIndex: jest.fn(),
      exportStoredProjectIndex: jest.fn().mockReturnValue(JSON.stringify(index, null, 2)),
    };
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    await expect(
      loadVectorDbIndex({
        logger,
        storage,
        store,
        icons: { warning: '[warn]' },
      }),
    ).resolves.toEqual(index);

    const indexer = {
      indexProject: jest.fn().mockResolvedValue(index),
    };

    await expect(
      createAndSaveVectorDbIndex({
        indexer,
        storage,
        store,
      }),
    ).resolves.toEqual(index);

    await expect(
      reindexVectorDbProject({
        createAndSaveIndex: () =>
          createAndSaveVectorDbIndex({
            indexer,
            storage,
            store,
          }),
        store,
      }),
    ).resolves.toEqual(index);

    expect(store.storeDocuments).toHaveBeenCalledWith(index.documents);
    expect(storage.saveStoredProjectIndex).toHaveBeenCalledWith(index);
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(exportVectorDbIndex(storage)).toContain('LoggerService');
  });
});
