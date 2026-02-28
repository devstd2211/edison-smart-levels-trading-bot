/**
 * Vector Database Service
 * Main interface for semantic search and code indexing
 */

import * as fs from 'fs';
import * as path from 'path';
import { SQLiteVectorStore } from './sqlite-vector-store';
import { SemanticSearchService } from './semantic-search.service';
import { ProjectIndexer } from './project-indexer';
import { EmbeddedDocument, SearchQuery, SearchResult, SearchResultItem, ProjectIndex, IndexConfig } from './vector-db.types';

export class VectorDatabaseService {
  private store: SQLiteVectorStore;
  private searchService: SemanticSearchService;
  private indexer: ProjectIndexer;
  private projectPath: string;
  private indexPath: string;
  private initialized: boolean = false;

  constructor(
    projectPath: string = process.cwd(),
    dbPath: string = './vector-db.sqlite',
    indexPath: string = './.vector-db/index.json'
  ) {
    this.projectPath = projectPath;
    // Handle both absolute and relative paths
    const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectPath, dbPath);
    const resolvedIndexPath = path.isAbsolute(indexPath) ? indexPath : path.join(projectPath, indexPath);

    this.indexPath = resolvedIndexPath;
    this.store = new SQLiteVectorStore(resolvedDbPath);
    this.searchService = new SemanticSearchService(this.store);
    this.indexer = new ProjectIndexer(projectPath);
  }

  /**
   * Initialize Vector DB
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    console.log('🔄 Initializing Vector Database...');

    // Initialize SQLite store
    await this.store.init();

    // Load or create index
    const hasExistingIndex = fs.existsSync(this.indexPath);

    if (hasExistingIndex) {
      console.log('📂 Loading existing index...');
      await this.loadIndex();
    } else {
      console.log('🔍 Creating new index...');
      await this.createAndSaveIndex();
    }

    this.initialized = true;
    console.log('✅ Vector Database initialized');
  }

  /**
   * Create index from scratch
   */
  async createAndSaveIndex(): Promise<ProjectIndex> {
    const index = await this.indexer.indexProject();

    // Store documents in SQLite
    await this.store.storeDocuments(index.documents);

    // Save index JSON for reference
    this.ensureDirectory(this.indexPath);
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));

    return index;
  }

  /**
   * Load existing index
   */
  async loadIndex(): Promise<ProjectIndex | null> {
    try {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      const index: ProjectIndex = JSON.parse(content);

      // Store documents in SQLite
      await this.store.storeDocuments(index.documents);

      return index;
    } catch (error) {
      console.warn('⚠️ Failed to load index:', (error as Error).message);
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
  async getStats(): Promise<any> {
    if (!this.initialized) await this.init();
    return this.store.getStats();
  }

  /**
   * Reindex project (full refresh)
   */
  async reindex(): Promise<ProjectIndex> {
    console.log('🔄 Reindexing project...');
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
    const data = fs.readFileSync(this.indexPath, 'utf-8');
    return data;
  }

  /**
   * Cleanup
   */
  async close(): Promise<void> {
    await this.store.close();
  }

  /**
   * Helper: ensure directory exists
   */
  private ensureDirectory(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
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
  dbPath: string = './vector-db.sqlite',
  indexPath: string = './.vector-db/index.json'
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
