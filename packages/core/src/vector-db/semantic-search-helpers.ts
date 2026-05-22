import { EmbeddedDocument, SearchQuery, SearchResultItem } from './vector-db.types';

export const DEFAULT_SEMANTIC_SEARCH_LIMIT = 10;
const HYBRID_KEYWORD_WEIGHT = 0.6;
const HYBRID_SEMANTIC_WEIGHT = 0.4;
const MAX_CONTEXT_LENGTH = 200;

export function resolveSemanticSearchLimit(limit?: number, fallback: number = DEFAULT_SEMANTIC_SEARCH_LIMIT): number {
  return limit ?? fallback;
}

export function shouldSearchByFilters(query: SearchQuery): boolean {
  return Boolean(query.filters && (query.filters.category || query.filters.type || query.filters.tags?.length));
}

export function shouldUseKeywordSearch(query: SearchQuery): boolean {
  return Boolean(query.useKeywordMatching);
}

export function createSemanticSearchCacheKey(query: SearchQuery): string {
  return JSON.stringify({
    filters: {
      category: query.filters?.category ?? null,
      tags: [...(query.filters?.tags ?? [])].sort(),
      type: query.filters?.type ?? null,
    },
    limit: resolveSemanticSearchLimit(query.limit),
    text: query.text,
    useKeywordMatching: Boolean(query.useKeywordMatching),
  });
}

export function scoreHybridSearchDocument(doc: EmbeddedDocument, queryText: string): number {
  const terms = queryText.toLowerCase().split(/\s+/).filter(Boolean);
  let keywordScore = 0;

  for (const term of terms) {
    if (doc.name.toLowerCase().includes(term)) {
      keywordScore += 3;
    }
    if (doc.description.toLowerCase().includes(term)) {
      keywordScore += 2;
    }
    if (doc.keywords.some((keyword) => keyword.toLowerCase().includes(term))) {
      keywordScore += 1.5;
    }
  }

  const semanticScore = calculateSemanticSimilarity(queryText, doc);
  return Math.min((keywordScore * HYBRID_KEYWORD_WEIGHT + semanticScore * HYBRID_SEMANTIC_WEIGHT) / 10, 1);
}

export function calculateSemanticSimilarity(query: string, doc: EmbeddedDocument): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;

  for (const term of queryTerms) {
    for (const keyword of doc.keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      if (normalizedKeyword.includes(term) || term.includes(normalizedKeyword)) {
        score += 2;
      }
    }
  }

  for (const term of queryTerms) {
    for (const tag of doc.tags) {
      const normalizedTag = tag.toLowerCase();
      if (normalizedTag.includes(term) || term.includes(normalizedTag)) {
        score += 1.5;
      }
    }
  }

  return score;
}

export function extractMatchedSemanticKeywords(query: string, doc: EmbeddedDocument): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matched = new Set<string>();

  for (const keyword of doc.keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    if (terms.some((term) => normalizedKeyword.includes(term))) {
      matched.add(keyword);
    }
  }

  for (const tag of doc.tags) {
    const normalizedTag = tag.toLowerCase();
    if (terms.some((term) => normalizedTag.includes(term))) {
      matched.add(tag);
    }
  }

  return Array.from(matched);
}

export function extractSemanticSearchContext(content: string, query: string): string | undefined {
  if (!content) {
    return undefined;
  }

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (terms.some((term) => line.toLowerCase().includes(term))) {
      const start = Math.max(0, index - 1);
      const end = Math.min(lines.length, index + 2);
      return lines.slice(start, end).join('\n').slice(0, MAX_CONTEXT_LENGTH);
    }
  }

  return content.slice(0, MAX_CONTEXT_LENGTH);
}

export function mapKeywordSearchResult(
  document: EmbeddedDocument,
  relevance: number,
  queryText: string,
): SearchResultItem {
  return {
    id: document.id,
    name: document.name,
    filePath: document.filePath,
    category: document.category,
    relevanceScore: relevance,
    description: document.description,
    matchedKeywords: extractMatchedSemanticKeywords(queryText, document),
    context: extractSemanticSearchContext(document.content, queryText),
  };
}
