/**
 * Semantic Search Service
 * Provides intelligent search across the codebase using embeddings + keyword matching
 */

import { EmbeddedDocument, SearchQuery, SearchResult, SearchResultItem } from './vector-db.types';
import { SQLiteVectorStore } from './sqlite-vector-store';

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

    // Check cache first
    const cached = await this.store.getCachedResult(query.text);
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

    if (query.filters && (query.filters.category || query.filters.type || query.filters.tags)) {
      // Filter-based search
      results = await this.searchByFilters(query);
    } else if (query.useKeywordMatching) {
      // Keyword search
      results = await this.keywordSearch(query.text, query.limit || 10);
    } else {
      // Hybrid search: semantic + keyword
      results = await this.hybridSearch(query);
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply limit
    const limit = query.limit || 10;
    results = results.slice(0, limit);

    // Cache results
    await this.store.cacheSearchResult(query.text, results);

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

    return results.map((r) => ({
      id: r.document.id,
      name: r.document.name,
      filePath: r.document.filePath,
      category: r.document.category,
      relevanceScore: r.relevance,
      description: r.document.description,
      matchedKeywords: this.extractMatchedKeywords(text, r.document),
      context: this.extractContext(r.document.content, text),
    }));
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
      query.limit || 20
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
    const terms = query.text.toLowerCase().split(/\s+/);

    // Get all documents (or use a large limit)
    const allDocs = await this.store.searchByFilters(undefined, undefined, undefined, 1000);

    const scored = allDocs
      .map((doc) => {
        // Score based on keyword matching
        let keywordScore = 0;
        terms.forEach((term) => {
          if (doc.name.toLowerCase().includes(term)) keywordScore += 3;
          if (doc.description.toLowerCase().includes(term)) keywordScore += 2;
          if (doc.keywords.some((k) => k.toLowerCase().includes(term))) keywordScore += 1.5;
        });

        // Score based on semantic relatedness (simplified)
        const semanticScore = this.calculateSemanticSimilarity(query.text, doc);

        // Combine scores (60% keyword, 40% semantic)
        const combined = keywordScore * 0.6 + semanticScore * 0.4;

        return {
          document: doc,
          score: Math.min(combined / 10, 1),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored
      .slice(0, query.limit || 10)
      .map((r) => ({
        id: r.document.id,
        name: r.document.name,
        filePath: r.document.filePath,
        category: r.document.category,
        relevanceScore: r.score,
        description: r.document.description,
        matchedKeywords: this.extractMatchedKeywords(query.text, r.document),
        context: this.extractContext(r.document.content, query.text),
      }));
  }

  /**
   * Calculate semantic similarity between query and document
   */
  private calculateSemanticSimilarity(query: string, doc: EmbeddedDocument): number {
    // Simple semantic similarity based on category and keywords
    const queryTerms = query.toLowerCase().split(/\s+/);

    let score = 0;

    // Match against keywords
    queryTerms.forEach((term) => {
      doc.keywords.forEach((keyword) => {
        if (keyword.toLowerCase().includes(term) || term.includes(keyword.toLowerCase())) {
          score += 2;
        }
      });
    });

    // Match against tags
    queryTerms.forEach((term) => {
      doc.tags.forEach((tag) => {
        if (tag.toLowerCase().includes(term) || term.includes(tag.toLowerCase())) {
          score += 1.5;
        }
      });
    });

    return score;
  }

  /**
   * Extract keywords that matched the query
   */
  private extractMatchedKeywords(query: string, doc: EmbeddedDocument): string[] {
    const terms = query.toLowerCase().split(/\s+/);
    const matched = new Set<string>();

    doc.keywords.forEach((keyword) => {
      terms.forEach((term) => {
        if (keyword.toLowerCase().includes(term)) {
          matched.add(keyword);
        }
      });
    });

    doc.tags.forEach((tag) => {
      terms.forEach((term) => {
        if (tag.toLowerCase().includes(term)) {
          matched.add(tag);
        }
      });
    });

    return Array.from(matched);
  }

  /**
   * Extract context snippet from content
   */
  private extractContext(content: string, query: string): string | undefined {
    if (!content) return undefined;

    const terms = query.toLowerCase().split(/\s+/);
    const lines = content.split('\n');

    // Find first line containing a query term
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (terms.some((term) => line.toLowerCase().includes(term))) {
        // Return context with surrounding lines
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        return lines.slice(start, end).join('\n').substring(0, 200);
      }
    }

    // Fallback: return first 200 chars
    return content.substring(0, 200);
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

    return Array.from(matches).slice(0, limit);
  }
}
