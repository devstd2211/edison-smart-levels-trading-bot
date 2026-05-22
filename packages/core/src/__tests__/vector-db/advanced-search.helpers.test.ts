import {
  buildSimilarDocumentSearchTerms,
  calculateDocumentKeywordSimilarity,
  matchesAdvancedSearchPattern,
  mergeAllSearchResults,
  mergeAnySearchResults,
} from '../../vector-db/advanced-search-helpers';

describe('advanced search helpers', () => {
  test('keeps AND and OR result merging distinct', () => {
    const termResults = [
      [
        {
          id: 'shared',
          name: 'Shared',
          filePath: 'shared.ts',
          category: 'service',
          relevanceScore: 0.8,
          description: 'shared',
        },
        {
          id: 'first-only',
          name: 'FirstOnly',
          filePath: 'first.ts',
          category: 'service',
          relevanceScore: 0.7,
          description: 'first',
        },
      ],
      [
        {
          id: 'shared',
          name: 'Shared',
          filePath: 'shared.ts',
          category: 'service',
          relevanceScore: 0.6,
          description: 'shared',
        },
      ],
    ];

    expect(mergeAllSearchResults(termResults, 2, 10).map((result) => result.id)).toEqual(['shared']);
    expect(mergeAnySearchResults(termResults, 10).map((result) => result.id)).toEqual([
      'shared',
      'first-only',
    ]);
  });

  test('handles global regex patterns and derives similarity search terms from the source document', () => {
    const document = {
      id: 'doc-1',
      type: 'service' as const,
      filePath: 'risk.ts',
      name: 'RiskManagerService',
      description: 'Handles risk and stop loss',
      category: 'service',
      tags: ['risk', 'stop'],
      content: '',
      keywords: ['risk', 'stop-loss', 'sizing'],
      size: 10,
      lastUpdated: '2026-05-22T00:00:00.000Z',
      relatedModules: [],
    };

    expect(matchesAdvancedSearchPattern(/risk/gi, document)).toBe(true);
    expect(buildSimilarDocumentSearchTerms(document)).toBe('risk stop-loss sizing risk stop');
    expect(
      calculateDocumentKeywordSimilarity(document, {
        ...document,
        id: 'doc-2',
        keywords: ['risk'],
      }),
    ).toBeGreaterThan(0);
  });
});
