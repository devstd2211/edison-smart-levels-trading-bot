/**
 * Vector Database Module
 * Semantic search and code indexing for Edison
 */

export { VectorDatabaseService, getVectorDB } from './vector-db.service';
export { SQLiteVectorStore } from './sqlite-vector-store';
export { SemanticSearchService } from './semantic-search.service';
export { AdvancedSearchService } from './advanced-search.service';
export { ProjectIndexer } from './project-indexer';

export type {
  EmbeddedDocument,
  SearchQuery,
  SearchResult,
  SearchResultItem,
  ProjectIndex,
  ModuleSummary,
  IndexConfig,
  SearchCache,
} from './vector-db.types';
