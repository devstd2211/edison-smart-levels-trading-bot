import { EmbeddedDocument, SearchResultItem } from './vector-db.types';

type SearchResultAggregate = {
  document: SearchResultItem;
  matches: number;
  totalScore: number;
};

export function mergeAllSearchResults(
  termResults: SearchResultItem[][],
  totalTerms: number,
  limit: number,
): SearchResultItem[] {
  const aggregates = collectSearchResultAggregates(termResults);

  return Array.from(aggregates.values())
    .filter((aggregate) => aggregate.matches === totalTerms)
    .map((aggregate) => ({
      ...aggregate.document,
      relevanceScore: Math.min(aggregate.totalScore / aggregate.matches, 1),
    }))
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, limit);
}

export function mergeAnySearchResults(
  termResults: SearchResultItem[][],
  limit: number,
): SearchResultItem[] {
  return Array.from(collectSearchResultAggregates(termResults).values())
    .map((aggregate) => ({
      ...aggregate.document,
      relevanceScore: Math.min(aggregate.totalScore / aggregate.matches, 1),
    }))
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, limit);
}

export function buildSimilarDocumentSearchTerms(document: EmbeddedDocument): string | null {
  const terms = [...document.keywords.slice(0, 3), ...document.tags.slice(0, 2)].filter(Boolean);
  return terms.length > 0 ? terms.join(' ') : null;
}

export function matchesAdvancedSearchPattern(
  pattern: RegExp,
  document: Pick<EmbeddedDocument, 'description' | 'keywords' | 'name'>,
): boolean {
  return (
    testPattern(pattern, document.name) ||
    testPattern(pattern, document.description) ||
    document.keywords.some((keyword) => testPattern(pattern, keyword))
  );
}

export function filterDocumentsByDateRange(
  documents: EmbeddedDocument[],
  startIso: string,
  endIso: string,
  limit: number,
): EmbeddedDocument[] {
  return documents
    .filter((document) => document.lastUpdated >= startIso && document.lastUpdated <= endIso)
    .slice(0, limit);
}

export function filterDocumentsBySizeRange(
  documents: EmbeddedDocument[],
  minBytes: number,
  maxBytes: number,
  limit: number,
): EmbeddedDocument[] {
  return documents
    .filter((document) => document.size >= minBytes && document.size <= maxBytes)
    .slice(0, limit);
}

export function calculateDocumentKeywordSimilarity(
  sourceDocument: EmbeddedDocument,
  candidate: EmbeddedDocument,
): number {
  const sharedKeywords = sourceDocument.keywords.filter((keyword) => candidate.keywords.includes(keyword));
  return sharedKeywords.length / Math.max(sourceDocument.keywords.length, 1);
}

function collectSearchResultAggregates(termResults: SearchResultItem[][]): Map<string, SearchResultAggregate> {
  const results = new Map<string, SearchResultAggregate>();

  for (const documents of termResults) {
    const seenInTerm = new Set<string>();
    for (const document of documents) {
      if (seenInTerm.has(document.id)) {
        continue;
      }

      const aggregate = results.get(document.id);
      if (aggregate) {
        aggregate.matches += 1;
        aggregate.totalScore += document.relevanceScore;
      } else {
        results.set(document.id, {
          document: { ...document },
          matches: 1,
          totalScore: document.relevanceScore,
        });
      }
      seenInTerm.add(document.id);
    }
  }

  return results;
}

function testPattern(pattern: RegExp, value: string): boolean {
  const safePattern = new RegExp(pattern.source, pattern.flags);
  return safePattern.test(value);
}
