/**
 * Advanced Search Service
 * Provides complex search patterns and batch operations
 */

import { SemanticSearchService } from './semantic-search.service';
import { SQLiteVectorStore } from './sqlite-vector-store';
import { SearchResultItem, EmbeddedDocument } from './vector-db.types';

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
    const start = Date.now();
    const results = new Map<string, SearchResultItem>();

    // Search for each term
    for (const term of terms) {
      const termResults = await this.searchService.search({
        text: term,
        limit: limit * terms.length,
      });

      // Add/update results
      for (const doc of termResults.documents) {
        if (results.has(doc.id)) {
          // Increase score for matches in multiple queries
          const existing = results.get(doc.id)!;
          existing.relevanceScore = Math.min(
            (existing.relevanceScore + doc.relevanceScore) / 2,
            1
          );
        } else {
          results.set(doc.id, doc);
        }
      }
    }

    // Return top results
    return Array.from(results.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Search with multiple terms (OR logic)
   */
  async searchAny(terms: string[], limit: number = 20): Promise<SearchResultItem[]> {
    const start = Date.now();
    const results = new Map<string, SearchResultItem>();

    // Search for each term and collect unique results
    for (const term of terms) {
      const termResults = await this.searchService.search({
        text: term,
        limit,
      });

      // Add only new results
      for (const doc of termResults.documents) {
        if (!results.has(doc.id)) {
          results.set(doc.id, doc);
        }
      }
    }

    // Return all unique results
    return Array.from(results.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
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

    // Search using document's keywords and description
    const searchTerms = [
      ...sourceDoc.keywords.slice(0, 3),
      ...sourceDoc.tags.slice(0, 2),
    ].join(' ');

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
      // Match against name, description, keywords
      if (
        pattern.test(doc.name) ||
        pattern.test(doc.description) ||
        doc.keywords.some((k) => pattern.test(k))
      ) {
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
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const allDocs = await this.store.searchByFilters(undefined, undefined, undefined, 1000);
    const matches = allDocs.filter(
      (doc) => doc.lastUpdated >= startIso && doc.lastUpdated <= endIso
    );

    return matches.slice(0, limit);
  }

  /**
   * Find documents by size range
   */
  async searchBySize(minBytes: number, maxBytes: number, limit: number = 20): Promise<EmbeddedDocument[]> {
    const allDocs = await this.store.searchByFilters(undefined, undefined, undefined, 1000);
    const matches = allDocs.filter((doc) => doc.size >= minBytes && doc.size <= maxBytes);

    return matches.slice(0, limit);
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

      // Calculate similarity based on keyword overlap
      const sharedKeywords = sourceDoc.keywords.filter((k) =>
        doc.keywords.includes(k)
      );
      const similarity = sharedKeywords.length / Math.max(sourceDoc.keywords.length, 1);

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
