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
  hasStoredProjectIndex,
  loadStoredProjectIndex,
  saveStoredProjectIndex,
} from './vector-db-index-storage';
import {
  DEFAULT_VECTOR_DB_PATH,
  DEFAULT_VECTOR_INDEX_PATH,
  resolveVectorDbRuntimePaths,
} from './vector-db-runtime-paths';

interface VectorStoreStats {
  totalDocuments: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
}

export class VectorDatabaseService {
  private store: SQLiteVectorStore;
  private searchService: SemanticSearchService;
  private indexer: ProjectIndexer;
  private projectPath: string;
  private indexPath: string;
  private initialized: boolean = false;

  constructor(
    projectPath: string = process.cwd(),
    dbPath: string = DEFAULT_VECTOR_DB_PATH,
    indexPath: string = DEFAULT_VECTOR_INDEX_PATH
  ) {
    const runtimePaths = resolveVectorDbRuntimePaths(projectPath, dbPath, indexPath);

    this.projectPath = runtimePaths.projectPath;
    this.indexPath = runtimePaths.indexPath;
    this.store = new SQLiteVectorStore(runtimePaths.dbPath);
    this.searchService = new SemanticSearchService(this.store);
    this.indexer = new ProjectIndexer(runtimePaths.projectPath);
  }

  /**
   * Initialize Vector DB
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    console.log(`${ICONS.refresh} Initializing Vector Database...`);

    // Initialize SQLite store
    await this.store.init();

    // Load or create index
    const hasExistingIndex = hasStoredProjectIndex(this.indexPath);

    if (hasExistingIndex) {
      console.log(`${ICONS.open_folder} Loading existing index...`);
      await this.loadIndex();
    } else {
      console.log(`${ICONS.search} Creating new index...`);
      await this.createAndSaveIndex();
    }

    this.initialized = true;
    console.log(`${ICONS.success} Vector Database initialized`);
  }

  /**
   * Create index from scratch
   */
  async createAndSaveIndex(): Promise<ProjectIndex> {
    const index = await this.indexer.indexProject();

    // Store documents in SQLite
    await this.store.storeDocuments(index.documents);

    // Save index JSON for reference
    saveStoredProjectIndex(this.indexPath, index);

    return index;
  }

  /**
   * Load existing index
   */
  async loadIndex(): Promise<ProjectIndex | null> {
    try {
      const index = loadStoredProjectIndex(this.indexPath);

      // Store documents in SQLite
      await this.store.storeDocuments(index.documents);

      return index;
    } catch (error) {
      console.warn(`${ICONS.warning} Failed to load index:`, (error as Error).message);
      return null;
    }
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
    console.log(`${ICONS.refresh} Reindexing project...`);
    await this.store.clear();
    return this.createAndSaveIndex();
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
    return JSON.stringify(loadStoredProjectIndex(this.indexPath), null, 2);
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
  indexPath: string = DEFAULT_VECTOR_INDEX_PATH
): Promise<VectorDatabaseService> {
  if (!globalVectorDB) {
    globalVectorDB = new VectorDatabaseService(projectPath, dbPath, indexPath);
    await globalVectorDB.init();
  }
  return globalVectorDB;
}

export { SQLiteVectorStore, SemanticSearchService, ProjectIndexer };
export type {
  EmbeddedDocument,
  SearchQuery,
  SearchResult,
  SearchResultItem,
  ProjectIndex,
  IndexConfig,
} from './vector-db.types';
