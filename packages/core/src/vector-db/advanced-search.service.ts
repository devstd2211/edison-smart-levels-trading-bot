/**
 * Advanced Search Service
 * Provides complex search patterns and batch operations
 */

import { SemanticSearchService } from './semantic-search.service';
import { SQLiteVectorStore } from './sqlite-vector-store';
import { SearchResultItem, EmbeddedDocument } from './vector-db.types';
import {
  buildSimilarDocumentSearchTerms,
  calculateDocumentKeywordSimilarity,
  filterDocumentsByDateRange,
  filterDocumentsBySizeRange,
  matchesAdvancedSearchPattern,
  mergeAllSearchResults,
  mergeAnySearchResults,
} from './advanced-search-helpers';

export interface SearchPattern {
  name: string;
  description: string;
  queries: string[];
  combineWith?: 'AND' | 'OR';
}

export interface BatchSearchResult {
  pattern: string;
  totalResults: number;
  results: SearchResultItem[];
  executionTime: number;
}

export class AdvancedSearchService {
  private store: SQLiteVectorStore;
  private searchService: SemanticSearchService;

  constructor(store: SQLiteVectorStore, searchService: SemanticSearchService) {
    this.store = store;
    this.searchService = searchService;
  }

  /**
   * Search with multiple terms (AND logic)
   */
  async searchAll(terms: string[], limit: number = 20): Promise<SearchResultItem[]> {
    const termResults: SearchResultItem[][] = [];

    for (const term of terms) {
      const searchResult = await this.searchService.search({
        text: term,
        limit: limit * terms.length,
      });
      termResults.push(searchResult.documents);
    }

    return mergeAllSearchResults(termResults, terms.length, limit);
  }

  /**
   * Search with multiple terms (OR logic)
   */
  async searchAny(terms: string[], limit: number = 20): Promise<SearchResultItem[]> {
    const termResults: SearchResultItem[][] = [];

    for (const term of terms) {
      const searchResult = await this.searchService.search({
        text: term,
        limit,
      });
      termResults.push(searchResult.documents);
    }

    return mergeAnySearchResults(termResults, limit);
  }

  /**
   * Batch search with multiple queries
   */
  async batchSearch(queries: string[], limit: number = 10): Promise<BatchSearchResult[]> {
    const results: BatchSearchResult[] = [];

    for (const query of queries) {
      const start = Date.now();
      const searchResult = await this.searchService.search({
        text: query,
        limit,
      });
      const executionTime = Date.now() - start;

      results.push({
        pattern: query,
        totalResults: searchResult.documents.length,
        results: searchResult.documents,
        executionTime,
      });
    }

    return results;
  }

  /**
   * Search by similarity to a document
   */
  async searchSimilar(documentId: string, limit: number = 10): Promise<SearchResultItem[]> {
    const sourceDoc = await this.store.getDocument(documentId);
    if (!sourceDoc) return [];

    const searchTerms = buildSimilarDocumentSearchTerms(sourceDoc);
    if (!searchTerms) {
      return [];
    }

    return (
      await this.searchService.search({
        text: searchTerms,
        limit: limit * 2, // Get more candidates
      })
    ).documents.filter((doc) => doc.id !== documentId) // Exclude source
      .slice(0, limit);
  }

  /**
   * Search within a category
   */
  async searchInCategory(
    query: string,
    category: string,
    limit: number = 20
  ): Promise<SearchResultItem[]> {
    const allResults = await this.searchService.search({
      text: query,
      limit: limit * 5, // Get extra candidates
      filters: { category },
    });

    return allResults.documents.slice(0, limit);
  }

  /**
   * Search by regex pattern
   */
  async searchByPattern(pattern: RegExp, limit: number = 20): Promise<SearchResultItem[]> {
    const allDocs = await this.store.searchByFilters(undefined, undefined, undefined, 1000);
    const matches: SearchResultItem[] = [];

    for (const doc of allDocs) {
      if (matchesAdvancedSearchPattern(pattern, doc)) {
        matches.push({
          id: doc.id,
          name: doc.name,
          filePath: doc.filePath,
          category: doc.category,
          relevanceScore: 1.0,
          description: doc.description,
        });

        if (matches.length >= limit) break;
      }
    }

    return matches;
  }

  /**
   * Find documents by date range
   */
  async searchByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ): Promise<EmbeddedDocument[]> {
    const allDocs = await this.store.searchByFilters(undefined, undefined, undefined, 1000);
    return filterDocumentsByDateRange(
      allDocs,
      startDate.toISOString(),
      endDate.toISOString(),
      limit,
    );
  }

  /**
   * Find documents by size range
   */
  async searchBySize(minBytes: number, maxBytes: number, limit: number = 20): Promise<EmbeddedDocument[]> {
    const allDocs = await this.store.searchByFilters(undefined, undefined, undefined, 1000);
    return filterDocumentsBySizeRange(allDocs, minBytes, maxBytes, limit);
  }

  /**
   * Find duplicate or similar documents
   */
  async findSimilar(documentId: string, threshold: number = 0.8): Promise<SearchResultItem[]> {
    const sourceDoc = await this.store.getDocument(documentId);
    if (!sourceDoc) return [];

    const similar: SearchResultItem[] = [];

    // Find by shared keywords
    const allDocs = await this.store.searchByFilters(undefined, undefined, undefined, 1000);

    for (const doc of allDocs) {
      if (doc.id === documentId) continue;

      const similarity = calculateDocumentKeywordSimilarity(sourceDoc, doc);

      if (similarity >= threshold) {
        similar.push({
          id: doc.id,
          name: doc.name,
          filePath: doc.filePath,
          category: doc.category,
          relevanceScore: similarity,
          description: doc.description,
        });
      }
    }

    return similar.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Advanced filter combination
   */
  async advancedFilter(
    criteria: {
      category?: string;
      type?: string;
      minSize?: number;
      maxSize?: number;
      keywords?: string[];
      tags?: string[];
      searchTerm?: string;
    },
    limit: number = 20
  ): Promise<SearchResultItem[]> {
    let results = await this.store.searchByFilters(
      criteria.category,
      criteria.type,
      criteria.tags,
      limit * 5
    );

    // Apply size filters
    if (criteria.minSize || criteria.maxSize) {
      results = results.filter((doc) => {
        const size = doc.size;
        if (criteria.minSize && size < criteria.minSize) return false;
        if (criteria.maxSize && size > criteria.maxSize) return false;
        return true;
      });
    }

    // Apply keyword filters
    if (criteria.keywords && criteria.keywords.length > 0) {
      results = results.filter((doc) => {
        return criteria.keywords!.some((k) => doc.keywords.includes(k));
      });
    }

    // Apply text search if provided
    if (criteria.searchTerm) {
      const searchResults = await this.searchService.search({
        text: criteria.searchTerm,
        limit: limit * 5,
      });
      const searchIds = new Set(searchResults.documents.map((d) => d.id));
      results = results.filter((doc) => searchIds.has(doc.id));
    }

    // Convert to SearchResultItem
    return results
      .slice(0, limit)
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        filePath: doc.filePath,
        category: doc.category,
        relevanceScore: 1.0,
        description: doc.description,
      }));
  }
}
