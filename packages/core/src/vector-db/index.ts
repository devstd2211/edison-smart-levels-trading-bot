/**
 * Vector Database Module
 * Semantic search and code indexing for Edison
 */

export { VectorDatabaseService, getVectorDB } from './vector-db.service';
export {
  DEFAULT_VECTOR_DB_PATH,
  DEFAULT_VECTOR_INDEX_PATH,
  resolveVectorDbRuntimePaths,
} from './vector-db-runtime-paths';
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
