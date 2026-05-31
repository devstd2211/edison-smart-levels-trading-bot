/**
 * Vector Database Service
 * Main interface for semantic search and code indexing
 */

import { SQLiteVectorStore } from './sqlite-vector-store';
import { SemanticSearchService } from './semantic-search.service';
import { ProjectIndexer } from './project-indexer';
import { EmbeddedDocument, SearchQuery, SearchResult, SearchResultItem, ProjectIndex, IndexConfig } from './vector-db.types';
import { ICONS } from '../cli/cli-runtime';
import {
  createVectorDbIndexStorage,
  type VectorDbIndexStorage,
} from './vector-db-index-storage';
import {
  DEFAULT_VECTOR_DB_PATH,
  DEFAULT_VECTOR_INDEX_PATH,
  resolveVectorDbRuntimePaths,
  type VectorDbRuntimePaths,
} from './vector-db-runtime-paths';
import {
  createAndSaveVectorDbIndex,
  exportVectorDbIndex,
  initializeVectorDbIndex,
  loadVectorDbIndex,
  reindexVectorDbProject,
} from './vector-db-service-index';

interface VectorStoreStats {
  totalDocuments: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
}

type VectorDbLogger = Pick<Console, 'log' | 'warn'>;

type VectorDatabaseServiceDependencies = {
  createIndexer?: (projectPath: string) => ProjectIndexer;
  createSearchService?: (store: SQLiteVectorStore) => SemanticSearchService;
  createStore?: (dbPath: string) => SQLiteVectorStore;
  logger?: VectorDbLogger;
  storage?: VectorDbIndexStorage;
};

export class VectorDatabaseService {
  private store: SQLiteVectorStore;
  private searchService: SemanticSearchService;
  private indexer: ProjectIndexer;
  private projectPath: string;
  private initialized: boolean = false;
  private logger: VectorDbLogger;
  private storage: VectorDbIndexStorage;

  constructor(
    projectPath: string = process.cwd(),
    dbPath: string = DEFAULT_VECTOR_DB_PATH,
    indexPath: string = DEFAULT_VECTOR_INDEX_PATH,
    dependencies: VectorDatabaseServiceDependencies = {},
  ) {
    const runtimePaths = resolveVectorDbRuntimePaths(projectPath, dbPath, indexPath);
    this.logger = dependencies.logger ?? console;
    this.storage =
      dependencies.storage ?? createVectorDbIndexStorage(runtimePaths.indexPath);

    this.projectPath = runtimePaths.projectPath;
    this.store =
      (dependencies.createStore ?? ((resolvedDbPath) => new SQLiteVectorStore(resolvedDbPath)))(
        runtimePaths.dbPath,
      );
    this.searchService =
      (dependencies.createSearchService ?? ((store) => new SemanticSearchService(store)))(
        this.store,
      );
    this.indexer =
      (dependencies.createIndexer ?? ((resolvedProjectPath) => new ProjectIndexer(resolvedProjectPath)))(
        runtimePaths.projectPath,
      );
  }

  /**
   * Initialize Vector DB
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    this.logger.log(`${ICONS.refresh} Initializing Vector Database...`);

    // Initialize SQLite store
    await this.store.init();

    await initializeVectorDbIndex({
      createAndSaveIndex: () => this.createAndSaveIndex(),
      loadIndex: () => this.loadIndex(),
      logger: this.logger,
      storage: this.storage,
      icons: ICONS,
    });

    this.initialized = true;
    this.logger.log(`${ICONS.success} Vector Database initialized`);
  }

  /**
   * Create index from scratch
   */
  async createAndSaveIndex(): Promise<ProjectIndex> {
    return createAndSaveVectorDbIndex({
      indexer: this.indexer,
      storage: this.storage,
      store: this.store,
    });
  }

  /**
   * Load existing index
   */
  async loadIndex(): Promise<ProjectIndex | null> {
    return loadVectorDbIndex({
      logger: this.logger,
      storage: this.storage,
      store: this.store,
      icons: ICONS,
    });
  }

  /**
   * Perform semantic search
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    if (!this.initialized) await this.init();
    return this.searchService.search(query);
  }

  /**
   * Search by natural language
   */
  async query(text: string, limit: number = 10): Promise<SearchResult> {
    return this.search({
      text,
      limit,
      useKeywordMatching: false,
    });
  }

  /**
   * Keyword search
   */
  async keywordSearch(text: string, limit: number = 10): Promise<SearchResult> {
    return this.search({
      text,
      limit,
      useKeywordMatching: true,
    });
  }

  /**
   * Search by category
   */
  async searchByCategory(category: string): Promise<SearchResultItem[]> {
    if (!this.initialized) await this.init();
    return this.searchService.searchByCategory(category);
  }

  /**
   * Find related documents
   */
  async findRelated(documentId: string): Promise<SearchResultItem[]> {
    if (!this.initialized) await this.init();
    return this.searchService.findRelated(documentId);
  }

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(prefix: string, limit: number = 5): Promise<string[]> {
    if (!this.initialized) await this.init();
    return this.searchService.autocomplete(prefix, limit);
  }

  /**
   * Update single document
   */
  async updateDocument(document: EmbeddedDocument): Promise<void> {
    if (!this.initialized) await this.init();
    await this.store.storeDocuments([document]);
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<EmbeddedDocument | null> {
    if (!this.initialized) await this.init();
    return this.store.getDocument(id);
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<VectorStoreStats> {
    if (!this.initialized) await this.init();
    return this.store.getStats();
  }

  /**
   * Reindex project (full refresh)
   */
  async reindex(): Promise<ProjectIndex> {
    this.logger.log(`${ICONS.refresh} Reindexing project...`);
    return reindexVectorDbProject({
      createAndSaveIndex: () => this.createAndSaveIndex(),
      store: this.store,
    });
  }

  /**
   * Get all documents by category
   */
  async getByCategory(category: string): Promise<EmbeddedDocument[]> {
    if (!this.initialized) await this.init();
    return this.store.getByCategory(category);
  }

  /**
   * Export index as JSON
   */
  async exportIndex(): Promise<string> {
    return exportVectorDbIndex(this.storage);
  }

  /**
   * Cleanup
   */
  async close(): Promise<void> {
    await this.store.close();
  }
}

/**
 * Global instance (singleton pattern)
 */
let globalVectorDB: VectorDatabaseService | null = null;

/**
 * Get or create global Vector DB instance
 */
export async function getVectorDB(
  projectPath: string = process.cwd(),
  dbPath: string = DEFAULT_VECTOR_DB_PATH,
  indexPath: string = DEFAULT_VECTOR_INDEX_PATH,
  createService: (
    paths: VectorDbRuntimePaths,
  ) => VectorDatabaseService = (runtimePaths) =>
    new VectorDatabaseService(
      runtimePaths.projectPath,
      runtimePaths.dbPath,
      runtimePaths.indexPath,
    ),
): Promise<VectorDatabaseService> {
  if (!globalVectorDB) {
    globalVectorDB = createService(
      resolveVectorDbRuntimePaths(projectPath, dbPath, indexPath),
    );
    await globalVectorDB.init();
  }
  return globalVectorDB;
}
export type {
  EmbeddedDocument,
  SearchQuery,
  SearchResult,
  SearchResultItem,
  ProjectIndex,
  IndexConfig,
} from './vector-db.types';
