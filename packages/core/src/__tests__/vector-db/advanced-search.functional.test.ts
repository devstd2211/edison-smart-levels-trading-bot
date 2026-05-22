import { AdvancedSearchService } from '../../vector-db/advanced-search.service';

describe('AdvancedSearchService functional behavior', () => {
  test('searchAll requires matches across every term and searchByPattern works with global regex', async () => {
    const documents = [
      {
        id: 'shared',
        type: 'service' as const,
        filePath: 'shared.ts',
        name: 'RiskLogger',
        description: 'risk logger',
        category: 'service',
        tags: ['risk'],
        content: '',
        keywords: ['risk', 'logger'],
        size: 10,
        lastUpdated: '2026-05-22T00:00:00.000Z',
        relatedModules: [],
      },
      {
        id: 'risk-only',
        type: 'service' as const,
        filePath: 'risk.ts',
        name: 'RiskOnly',
        description: 'risk only',
        category: 'service',
        tags: ['risk'],
        content: '',
        keywords: ['risk'],
        size: 10,
        lastUpdated: '2026-05-22T00:00:00.000Z',
        relatedModules: [],
      },
    ];
    const store = {
      getDocument: jest.fn(async () => documents[0]),
      searchByFilters: jest.fn(async () => documents),
    };
    const searchService = {
      search: jest.fn(async ({ text }: { text: string }) => {
        if (text === 'risk') {
          return {
            documents: [
              {
                id: 'shared',
                name: 'RiskLogger',
                filePath: 'shared.ts',
                category: 'service',
                relevanceScore: 0.9,
                description: 'shared',
              },
              {
                id: 'risk-only',
                name: 'RiskOnly',
                filePath: 'risk.ts',
                category: 'service',
                relevanceScore: 0.7,
                description: 'risk only',
              },
            ],
          };
        }

        return {
          documents: [
            {
              id: 'shared',
              name: 'RiskLogger',
              filePath: 'shared.ts',
              category: 'service',
              relevanceScore: 0.8,
              description: 'shared',
            },
          ],
        };
      }),
    };
    const service = new AdvancedSearchService(store as never, searchService as never);

    await expect(service.searchAll(['risk', 'logger'])).resolves.toEqual([
      expect.objectContaining({ id: 'shared' }),
    ]);
    await expect(service.searchByPattern(/risk/gi)).resolves.toHaveLength(2);
  });
});
