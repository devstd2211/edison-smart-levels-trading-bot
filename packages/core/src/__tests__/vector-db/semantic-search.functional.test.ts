import { SemanticSearchService } from '../../vector-db/semantic-search.service';

describe('SemanticSearchService functional behavior', () => {
  test('keeps cache entries distinct across filter and keyword-mode variants', async () => {
    const cachedResults = new Map<string, Array<{ id: string; name: string; filePath: string; category: string; relevanceScore: number; description: string }>>();
    const store = {
      cacheSearchResult: jest.fn(async (key: string, results: Array<{ id: string; name: string; filePath: string; category: string; relevanceScore: number; description: string }>) => {
        cachedResults.set(key, results);
      }),
      getCachedResult: jest.fn(async (key: string) => cachedResults.get(key) ?? null),
      getByCategory: jest.fn(async () => []),
      getDocument: jest.fn(async () => null),
      keywordSearch: jest.fn(async (text: string) => [
        {
          document: {
            id: `${text}-doc`,
            type: 'service' as const,
            filePath: `${text}.ts`,
            name: `${text}Name`,
            description: `${text} description`,
            category: 'service',
            tags: [text],
            content: `${text} content`,
            keywords: [text],
            size: 10,
            lastUpdated: '2026-05-22T00:00:00.000Z',
            relatedModules: [],
          },
          relevance: 0.8,
        },
      ]),
      searchByFilters: jest.fn(async (category?: string) => [
        {
          id: `${category ?? 'all'}-doc`,
          type: 'service' as const,
          filePath: `${category ?? 'all'}.ts`,
          name: `${category ?? 'all'}Name`,
          description: `${category ?? 'all'} description`,
          category: category ?? 'service',
          tags: [category ?? 'all'],
          content: `${category ?? 'all'} content`,
          keywords: [category ?? 'all'],
          size: 10,
          lastUpdated: '2026-05-22T00:00:00.000Z',
          relatedModules: [],
        },
      ]),
    };
    const service = new SemanticSearchService(store as never);

    const keywordResult = await service.search({
      text: 'risk',
      useKeywordMatching: true,
    });
    const filteredResult = await service.search({
      text: 'risk',
      filters: { category: 'service' },
    });
    const cachedKeywordResult = await service.search({
      text: 'risk',
      useKeywordMatching: true,
    });

    expect(keywordResult.documents[0].id).toBe('risk-doc');
    expect(filteredResult.documents[0].id).toBe('service-doc');
    expect(cachedKeywordResult.documents[0].id).toBe('risk-doc');
    expect(store.keywordSearch).toHaveBeenCalledTimes(1);
    expect(store.searchByFilters).toHaveBeenCalledTimes(1);
  });
});
