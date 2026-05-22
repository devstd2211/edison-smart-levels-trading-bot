/**
 * Semantic Search Service
 * Provides intelligent search across the codebase using embeddings + keyword matching
 */

import { EmbeddedDocument, SearchQuery, SearchResult, SearchResultItem } from './vector-db.types';
import { SQLiteVectorStore } from './sqlite-vector-store';
import {
  createSemanticSearchCacheKey,
  DEFAULT_SEMANTIC_SEARCH_LIMIT,
  extractMatchedSemanticKeywords,
  extractSemanticSearchContext,
  mapKeywordSearchResult,
  resolveSemanticSearchLimit,
  scoreHybridSearchDocument,
  shouldSearchByFilters,
  shouldUseKeywordSearch,
} from './semantic-search-helpers';

export class SemanticSearchService {
  private store: SQLiteVectorStore;

  constructor(store: SQLiteVectorStore) {
    this.store = store;
  }

  /**
   * Main search method - uses multiple strategies
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const cacheKey = createSemanticSearchCacheKey(query);
    const limit = resolveSemanticSearchLimit(query.limit);

    // Check cache first
    const cached = await this.store.getCachedResult(cacheKey);
    if (cached) {
      return {
        documents: cached,
        query: query.text,
        totalMatches: cached.length,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Determine search strategy
    let results: SearchResultItem[] = [];

    if (shouldSearchByFilters(query)) {
      results = await this.searchByFilters(query);
    } else if (shouldUseKeywordSearch(query)) {
      results = await this.keywordSearch(query.text, limit);
    } else {
      results = await this.hybridSearch(query);
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply limit
    results = results.slice(0, limit);

    // Cache results
    await this.store.cacheSearchResult(cacheKey, results);

    return {
      documents: results,
      query: query.text,
      totalMatches: results.length,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Keyword-based search
   */
  private async keywordSearch(text: string, limit: number): Promise<SearchResultItem[]> {
    const results = await this.store.keywordSearch(text, limit);

    return results.map((result) => mapKeywordSearchResult(result.document, result.relevance, text));
  }

  /**
   * Filter-based search
   */
  private async searchByFilters(query: SearchQuery): Promise<SearchResultItem[]> {
    const filters = query.filters || {};

    const documents = await this.store.searchByFilters(
      filters.category,
      filters.type,
      filters.tags,
      resolveSemanticSearchLimit(query.limit, 20)
    );

    return documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      filePath: doc.filePath,
      category: doc.category,
      relevanceScore: 1.0, // Perfect match on filter
      description: doc.description,
      matchedKeywords: doc.tags,
    }));
  }

  /**
   * Hybrid search: semantic similarity + keyword
   */
  private async hybridSearch(query: SearchQuery): Promise<SearchResultItem[]> {
    // Get all documents (or use a large limit)
    const allDocs = await this.store.searchByFilters(undefined, undefined, undefined, 1000);

    const scored = allDocs
      .map((doc) => ({
        document: doc,
        score: scoreHybridSearchDocument(doc, query.text),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored
      .slice(0, resolveSemanticSearchLimit(query.limit))
      .map((r) => ({
        id: r.document.id,
        name: r.document.name,
        filePath: r.document.filePath,
        category: r.document.category,
        relevanceScore: r.score,
        description: r.document.description,
        matchedKeywords: extractMatchedSemanticKeywords(query.text, r.document),
        context: extractSemanticSearchContext(r.document.content, query.text),
      }));
  }

  /**
   * Calculate semantic similarity between query and document
   */
  private calculateSemanticSimilarity(query: string, doc: EmbeddedDocument): number {
    return scoreHybridSearchDocument(doc, query);
  }

  /**
   * Extract keywords that matched the query
   */
  private extractMatchedKeywords(query: string, doc: EmbeddedDocument): string[] {
    return extractMatchedSemanticKeywords(query, doc);
  }

  /**
   * Extract context snippet from content
   */
  private extractContext(content: string, query: string): string | undefined {
    return extractSemanticSearchContext(content, query);
  }

  /**
   * Find related documents based on module dependencies
   */
  async findRelated(documentId: string): Promise<SearchResultItem[]> {
    const doc = await this.store.getDocument(documentId);
    if (!doc) return [];

    // Get related modules
    const relatedIds = doc.relatedModules || [];
    const results: SearchResultItem[] = [];

    for (const relatedId of relatedIds) {
      const relatedDoc = await this.store.getDocument(relatedId);
      if (relatedDoc) {
        results.push({
          id: relatedDoc.id,
          name: relatedDoc.name,
          filePath: relatedDoc.filePath,
          category: relatedDoc.category,
          relevanceScore: 0.9, // High relevance for related modules
          description: relatedDoc.description,
        });
      }
    }

    return results;
  }

  /**
   * Search by category
   */
  async searchByCategory(category: string): Promise<SearchResultItem[]> {
    const documents = await this.store.getByCategory(category);

    return documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      filePath: doc.filePath,
      category: doc.category,
      relevanceScore: 1.0,
      description: doc.description,
    }));
  }

  /**
   * Autocomplete suggestions
   */
  async autocomplete(prefix: string, limit: number = 5): Promise<string[]> {
    const allDocs = await this.store.searchByFilters(undefined, undefined, undefined, 1000);

    const matches = new Set<string>();

    // Get matching names
    allDocs.forEach((doc) => {
      if (doc.name.toLowerCase().startsWith(prefix.toLowerCase())) {
        matches.add(doc.name);
      }
    });

    // Get matching keywords
    allDocs.forEach((doc) => {
      doc.keywords.forEach((keyword) => {
        if (keyword.toLowerCase().startsWith(prefix.toLowerCase())) {
          matches.add(keyword);
        }
      });
    });

    return Array.from(matches).slice(0, limit ?? DEFAULT_SEMANTIC_SEARCH_LIMIT);
  }
}
