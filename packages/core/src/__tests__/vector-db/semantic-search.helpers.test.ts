import {
  createSemanticSearchCacheKey,
  extractMatchedSemanticKeywords,
  extractSemanticSearchContext,
  scoreHybridSearchDocument,
  shouldSearchByFilters,
} from '../../vector-db/semantic-search-helpers';

const document = {
  id: 'doc-1',
  type: 'service' as const,
  filePath: 'packages/core/src/services/risk-manager.service.ts',
  name: 'RiskManagerService',
  description: 'Calculates stop loss and trade risk',
  category: 'service',
  tags: ['risk', 'stop'],
  content: 'line1\nstop loss logic\nline3',
  keywords: ['risk', 'stopLoss', 'positionSizing'],
  size: 100,
  lastUpdated: '2026-05-22T00:00:00.000Z',
  relatedModules: [],
};

describe('semantic search helpers', () => {
  test('creates cache keys that separate filters, tags order, and search mode', () => {
    expect(
      createSemanticSearchCacheKey({
        text: 'risk',
        filters: {
          category: 'service',
          tags: ['b', 'a'],
        },
        useKeywordMatching: true,
      }),
    ).toBe(
      createSemanticSearchCacheKey({
        text: 'risk',
        filters: {
          category: 'service',
          tags: ['a', 'b'],
        },
        useKeywordMatching: true,
      }),
    );

    expect(
      createSemanticSearchCacheKey({
        text: 'risk',
        useKeywordMatching: true,
      }),
    ).not.toBe(
      createSemanticSearchCacheKey({
        text: 'risk',
        useKeywordMatching: false,
      }),
    );
  });

  test('detects filter-based searches and derives hybrid matches and context', () => {
    expect(
      shouldSearchByFilters({
        text: 'risk',
        filters: { category: 'service' },
      }),
    ).toBe(true);
    expect(scoreHybridSearchDocument(document, 'risk stop')).toBeGreaterThan(0);
    expect(extractMatchedSemanticKeywords('risk stop', document)).toEqual(
      expect.arrayContaining(['risk', 'stopLoss', 'stop']),
    );
    expect(extractSemanticSearchContext(document.content, 'stop')).toContain('stop loss logic');
  });
});
