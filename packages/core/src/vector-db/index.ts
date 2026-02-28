/**
 * Vector Database Module
 * Semantic search and code indexing for Edison
 */

export { VectorDatabaseService, SQLiteVectorStore, SemanticSearchService, ProjectIndexer, getVectorDB } from './vector-db.service';

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
