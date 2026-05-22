import {
  analyzeProjectIndexerFile,
  countProjectIndexerDocumentsByCategory,
  countProjectIndexerLines,
  createProjectIndexerDocument,
  extractProjectIndexerDescription,
  extractProjectIndexerKeywords,
  extractProjectIndexerName,
  generateProjectIndexerTags,
} from '../../vector-db/project-indexer-analysis';
import {
  createProjectIndexerGlobPattern,
  createProjectIndexerIgnorePatterns,
  determineProjectIndexerCategory,
  determineProjectIndexerDocumentType,
  PROJECT_INDEXER_DEFAULT_CONFIG,
} from '../../vector-db/project-indexer-discovery';

describe('project indexer helpers', () => {
  test('discovery helpers build the core source glob and ignore patterns from the project root', () => {
    expect(createProjectIndexerGlobPattern('D:/repo')).toBe('D:/repo/packages/core/src/**/*.ts');
    expect(
      createProjectIndexerIgnorePatterns(
        'D:/repo',
        PROJECT_INDEXER_DEFAULT_CONFIG.excludePatterns,
      ),
    ).toEqual([
      'D:/repo/node_modules',
      'D:/repo/dist',
      'D:/repo/.git',
      'D:/repo/__tests__',
    ]);
  });

  test('discovery helpers classify categories and document types by file path conventions', () => {
    expect(determineProjectIndexerCategory('packages/core/src/services/logger.service.ts')).toBe(
      'service',
    );
    expect(determineProjectIndexerCategory('packages/core/src/unknown/file.ts')).toBe('other');
    expect(determineProjectIndexerDocumentType('ema.indicator-new.ts')).toBe('indicator');
    expect(determineProjectIndexerDocumentType('trend.analyzer-new.ts')).toBe('analyzer');
    expect(determineProjectIndexerDocumentType('position-lifecycle.orchestrator.ts')).toBe(
      'service',
    );
  });

  test('analysis helpers extract name, description, keywords, tags, and normalized documents', () => {
    const content = `/**
 * Tracks signals for Entry logic
 */
import { RiskService } from './risk.service';

export class EntrySignalService {
  async collectSignals() {
    return [];
  }
}`;

    expect(extractProjectIndexerName('entry-signal.service.ts', content)).toBe(
      'EntrySignalService',
    );
    expect(extractProjectIndexerDescription(content)).toBe('Tracks signals for Entry logic');
    const keywords = extractProjectIndexerKeywords(content, 'EntrySignalService');
    expect(keywords).toEqual(expect.arrayContaining(['entrysignalservice', 'risk']));
    expect(keywords.some((keyword) => keyword.includes('collectsignals'))).toBe(true);

    const analysis = analyzeProjectIndexerFile(
      'D:/repo',
      'D:/repo/packages/core/src/services/entry-signal.service.ts',
      content,
    );
    const document = createProjectIndexerDocument(analysis, '2026-05-22T00:00:00.000Z');

    expect(generateProjectIndexerTags(analysis)).toEqual(
      expect.arrayContaining(['service', 'async', 'entry', 'signal']),
    );
    expect(document).toMatchObject({
      id: 'packages/core/src/services/entry-signal.service.ts',
      category: 'service',
      type: 'service',
      name: 'EntrySignalService',
      lastUpdated: '2026-05-22T00:00:00.000Z',
    });
  });

  test('analysis helpers aggregate line and category statistics from indexed documents', () => {
    const documents = [
      {
        id: 'one',
        type: 'service' as const,
        filePath: 'one.ts',
        name: 'One',
        description: '',
        category: 'service',
        tags: [],
        content: 'line1\nline2',
        keywords: [],
        size: 10,
        lastUpdated: '2026-05-22T00:00:00.000Z',
        relatedModules: [],
      },
      {
        id: 'two',
        type: 'analyzer' as const,
        filePath: 'two.ts',
        name: 'Two',
        description: '',
        category: 'analyzer',
        tags: [],
        content: 'line1',
        keywords: [],
        size: 5,
        lastUpdated: '2026-05-22T00:00:00.000Z',
        relatedModules: [],
      },
    ];

    expect(countProjectIndexerLines(documents)).toBe(3);
    expect(countProjectIndexerDocumentsByCategory(documents)).toEqual({
      analyzer: 1,
      service: 1,
    });
  });
});
