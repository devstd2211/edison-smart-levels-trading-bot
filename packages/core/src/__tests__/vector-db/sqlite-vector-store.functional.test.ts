import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SQLiteVectorStore } from '../../vector-db/sqlite-vector-store';

describe('SQLiteVectorStore functional behavior', () => {
  test('stores documents, filters by tags, and expires cached results by ttl', async () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-vector-store-'));
    const store = new SQLiteVectorStore(path.join(tempDirectory, 'vector-db.sqlite'));
    const nowSpy = jest.spyOn(Date, 'now');

    nowSpy.mockReturnValue(1_000);
    await store.init();
    await store.storeDocuments([]);
    await store.storeDocuments([
      {
        id: 'doc-1',
        type: 'service',
        filePath: 'packages/core/src/services/logger.service.ts',
        name: 'LoggerService',
        description: 'Logs bot events',
        category: 'service',
        tags: ['logging', 'core'],
        content: 'export class LoggerService {}',
        keywords: ['logger', 'logging'],
        size: 25,
        lastUpdated: '2026-05-22T00:00:00.000Z',
        relatedModules: [],
        embedding: [0.1, 0.2],
      },
    ]);

    await store.cacheSearchResult('logger', [
      {
        id: 'doc-1',
        name: 'LoggerService',
        filePath: 'packages/core/src/services/logger.service.ts',
        category: 'service',
        relevanceScore: 1,
        description: 'Logs bot events',
      },
    ], 5);

    await expect(store.getDocument('doc-1')).resolves.toMatchObject({
      id: 'doc-1',
      name: 'LoggerService',
    });
    await expect(store.searchByFilters('service', undefined, ['logging'])).resolves.toHaveLength(1);
    await expect(store.keywordSearch('logger')).resolves.toHaveLength(1);

    nowSpy.mockReturnValue(5_000);
    await expect(store.getCachedResult('logger')).resolves.toHaveLength(1);

    nowSpy.mockReturnValue(7_000);
    await expect(store.getCachedResult('logger')).resolves.toBeNull();

    nowSpy.mockRestore();
    await store.close();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });
});
