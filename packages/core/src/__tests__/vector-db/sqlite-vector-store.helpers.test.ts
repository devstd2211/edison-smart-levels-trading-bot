import {
  buildSqliteDocumentFilterQuery,
  hasFreshCachedSearchResult,
  mapSqliteRowToDocument,
  normalizeSqliteDocumentType,
  parseCachedSearchResults,
  scoreSqliteKeywordSearchDocument,
} from '../../vector-db/sqlite-vector-store-helpers';

describe('sqlite vector store helpers', () => {
  test('builds filter queries with category, type, tags, and limit in a stable order', () => {
    expect(
      buildSqliteDocumentFilterQuery({
        category: 'service',
        type: 'file',
        tags: ['risk', 'entry'],
        limit: 5,
      }),
    ).toEqual({
      query:
        'SELECT * FROM documents WHERE 1=1 AND category = ? AND type = ? AND (SELECT COUNT(*) FROM json_each(documents.tags) WHERE json_each.value = ? OR json_each.value = ?) > 0 LIMIT ?',
      params: ['service', 'file', 'risk', 'entry', 5],
    });
  });

  test('maps stored rows back into embedded documents and normalizes unknown types', () => {
    expect(
      mapSqliteRowToDocument({
        id: 'doc-1',
        type: 'unknown',
        filePath: 'packages/core/src/services/logger.service.ts',
        name: 'LoggerService',
        description: 'Logger',
        category: 'service',
        tags: '["core"]',
        content: 'export class LoggerService {}',
        keywords: '["logger"]',
        lineNumber: 12,
        size: 42,
        lastUpdated: '2026-05-22T00:00:00.000Z',
        relatedModules: '["dep-1"]',
      }),
    ).toMatchObject({
      id: 'doc-1',
      type: 'file',
      tags: ['core'],
      keywords: ['logger'],
      relatedModules: ['dep-1'],
    });

    expect(normalizeSqliteDocumentType('service')).toBe('service');
  });

  test('scores keyword matches safely even when the query contains regex characters', () => {
    const document = {
      id: 'doc-1',
      type: 'service' as const,
      filePath: 'file.ts',
      name: 'RiskManager',
      description: 'Manages stop loss and risk sizing',
      category: 'service',
      tags: ['risk'],
      content: '',
      keywords: ['risk', 'stop-loss'],
      size: 10,
      lastUpdated: '2026-05-22T00:00:00.000Z',
      relatedModules: [],
    };

    expect(scoreSqliteKeywordSearchDocument(document, 'risk .*')).toBeGreaterThan(0);
  });

  test('recognizes fresh cache rows using millisecond timestamps and parses cached payloads', () => {
    expect(
      hasFreshCachedSearchResult(
        {
          timestamp: 10_000,
          ttl: 5,
        },
        14_000,
      ),
    ).toBe(true);
    expect(
      hasFreshCachedSearchResult(
        {
          timestamp: 10_000,
          ttl: 5,
        },
        15_001,
      ),
    ).toBe(false);
    expect(parseCachedSearchResults('[{"id":"doc-1","name":"One","filePath":"one.ts","category":"service","relevanceScore":1,"description":"desc"}]')).toHaveLength(1);
  });
});
