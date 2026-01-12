/**
 * SQLite Vector Store
 * Persists embeddings and documents for efficient retrieval
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import * as fs from 'fs';
import { EmbeddedDocument, ProjectIndex, SearchCache } from './vector-db.types';

export class SQLiteVectorStore {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './vector-db.sqlite') {
    this.dbPath = dbPath;
  }

  /**
   * Initialize database and create schema if needed
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        // Enable JSON1 extension
        this.db!.run('PRAGMA journal_mode = WAL;', (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }

          this.createSchema()
            .then(() => resolve())
            .catch(reject);
        });
      });
    });
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    const schemas = [
      // Documents table
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        filePath TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        tags TEXT,
        content TEXT,
        keywords TEXT,
        lineNumber INTEGER,
        size INTEGER,
        lastUpdated TEXT,
        relatedModules TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Embeddings table (vector storage)
      `CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        embedding TEXT,
        embeddingModel TEXT,
        embeddingDims INTEGER,
        embeddingNorm REAL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (documentId) REFERENCES documents(id)
      )`,

      // Search cache
      `CREATE TABLE IF NOT EXISTS search_cache (
        query TEXT PRIMARY KEY,
        results TEXT,
        timestamp INTEGER,
        ttl INTEGER DEFAULT 3600
      )`,

      // Project metadata
      `CREATE TABLE IF NOT EXISTS project_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        lastUpdated TEXT
      )`,

      // Module summary cache
      `CREATE TABLE IF NOT EXISTS module_summaries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        summary TEXT,
        lastUpdated TEXT
      )`,

      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category)`,
      `CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type)`,
      `CREATE INDEX IF NOT EXISTS idx_documents_filePath ON documents(filePath)`,
      `CREATE INDEX IF NOT EXISTS idx_embeddings_documentId ON embeddings(documentId)`,
      `CREATE INDEX IF NOT EXISTS idx_module_summaries_name ON module_summaries(name)`,
    ];

    for (const schema of schemas) {
      await new Promise<void>((resolve, reject) => {
        this.db!.run(schema, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * Store multiple documents with embeddings
   */
  async storeDocuments(documents: EmbeddedDocument[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            reject(err);
            return;
          }

          let completed = 0;

          documents.forEach((doc) => {
            const stmt = this.db!.prepare(
              `INSERT OR REPLACE INTO documents
               (id, type, filePath, name, description, category, tags, content, keywords, lineNumber, size, lastUpdated, relatedModules)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            );

            stmt.run(
              doc.id,
              doc.type,
              doc.filePath,
              doc.name,
              doc.description,
              doc.category,
              JSON.stringify(doc.tags),
              doc.content,
              JSON.stringify(doc.keywords),
              doc.lineNumber || null,
              doc.size,
              doc.lastUpdated,
              JSON.stringify(doc.relatedModules),
              (err: Error | null) => {
                if (err) {
                  reject(err);
                  return;
                }

                // Store embedding if provided
                if (doc.embedding && doc.embedding.length > 0) {
                  const embStmt = this.db!.prepare(
                    `INSERT OR REPLACE INTO embeddings
                     (id, documentId, embedding, embeddingModel, embeddingDims)
                     VALUES (?, ?, ?, ?, ?)`
                  );

                  embStmt.run(
                    `emb_${doc.id}`,
                    doc.id,
                    JSON.stringify(doc.embedding),
                    'tfidf',
                    doc.embedding.length,
                    (err: Error | null) => {
                      if (err) {
                        reject(err);
                        return;
                      }

                      completed++;
                      if (completed === documents.length) {
                        this.db!.run('COMMIT', (err) => {
                          if (err) reject(err);
                          else resolve();
                        });
                      }
                    }
                  );
                } else {
                  completed++;
                  if (completed === documents.length) {
                    this.db!.run('COMMIT', (err) => {
                      if (err) reject(err);
                      else resolve();
                    });
                  }
                }
              }
            );

            stmt.finalize();
          });
        });
      });
    });
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<EmbeddedDocument | null> {
    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT * FROM documents WHERE id = ?`,
        [id],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          resolve({
            id: row.id,
            type: row.type,
            filePath: row.filePath,
            name: row.name,
            description: row.description,
            category: row.category,
            tags: JSON.parse(row.tags || '[]'),
            content: row.content,
            keywords: JSON.parse(row.keywords || '[]'),
            lineNumber: row.lineNumber,
            size: row.size,
            lastUpdated: row.lastUpdated,
            relatedModules: JSON.parse(row.relatedModules || '[]'),
          });
        }
      );
    });
  }

  /**
   * Search by category and tags
   */
  async searchByFilters(
    category?: string,
    type?: string,
    tags?: string[],
    limit: number = 20
  ): Promise<EmbeddedDocument[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM documents WHERE 1=1';
      const params: any[] = [];

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      if (tags && tags.length > 0) {
        const tagConditions = tags.map(() => "json_each.value = ?").join(' OR ');
        query += ` AND (SELECT COUNT(*) FROM json_each(documents.tags) WHERE ${tagConditions}) > 0`;
        params.push(...tags);
      }

      query += ' LIMIT ?';
      params.push(limit);

      this.db!.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const documents = (rows || []).map((row) => ({
          id: row.id,
          type: row.type,
          filePath: row.filePath,
          name: row.name,
          description: row.description,
          category: row.category,
          tags: JSON.parse(row.tags || '[]'),
          content: row.content,
          keywords: JSON.parse(row.keywords || '[]'),
          lineNumber: row.lineNumber,
          size: row.size,
          lastUpdated: row.lastUpdated,
          relatedModules: JSON.parse(row.relatedModules || '[]'),
        }));

        resolve(documents);
      });
    });
  }

  /**
   * Keyword search (fulltext)
   */
  async keywordSearch(
    query: string,
    limit: number = 20
  ): Promise<Array<{ document: EmbeddedDocument; relevance: number }>> {
    return new Promise((resolve, reject) => {
      const terms = query.toLowerCase().split(/\s+/);

      this.db!.all(
        `SELECT * FROM documents LIMIT ?`,
        [limit * 2], // Get more than needed to score
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const results = (rows || [])
            .map((row) => {
              const doc: EmbeddedDocument = {
                id: row.id,
                type: row.type,
                filePath: row.filePath,
                name: row.name,
                description: row.description,
                category: row.category,
                tags: JSON.parse(row.tags || '[]'),
                content: row.content,
                keywords: JSON.parse(row.keywords || '[]'),
                lineNumber: row.lineNumber,
                size: row.size,
                lastUpdated: row.lastUpdated,
                relatedModules: JSON.parse(row.relatedModules || '[]'),
              };

              // Calculate relevance score
              let score = 0;
              const textToSearch = `${doc.name} ${doc.description} ${doc.keywords.join(' ')}`.toLowerCase();

              terms.forEach((term) => {
                if (doc.name.toLowerCase().includes(term)) score += 3;
                if (doc.keywords.some((k) => k.toLowerCase().includes(term))) score += 2;
                if (doc.description.toLowerCase().includes(term)) score += 1;
                const matches = (textToSearch.match(new RegExp(term, 'g')) || []).length;
                score += matches * 0.5;
              });

              return { document: doc, relevance: Math.min(score / 10, 1) };
            })
            .filter((r) => r.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);

          resolve(results);
        }
      );
    });
  }

  /**
   * Cache search results
   */
  async cacheSearchResult(query: string, results: any[], ttl: number = 3600): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(
        `INSERT OR REPLACE INTO search_cache (query, results, timestamp, ttl)
         VALUES (?, ?, ?, ?)`
      );

      stmt.run(query, JSON.stringify(results), Date.now(), ttl, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });

      stmt.finalize();
    });
  }

  /**
   * Get cached search result
   */
  async getCachedResult(query: string): Promise<any[] | null> {
    return new Promise((resolve, reject) => {
      const now = Date.now() / 1000; // seconds

      this.db!.get(
        `SELECT results FROM search_cache
         WHERE query = ? AND timestamp + ttl > ?`,
        [query, now],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          resolve(JSON.parse(row.results));
        }
      );
    });
  }

  /**
   * Get all documents by category
   */
  async getByCategory(category: string): Promise<EmbeddedDocument[]> {
    return this.searchByFilters(category, undefined, undefined, 1000);
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    byCategory: Record<string, number>;
    byType: Record<string, number>;
  }> {
    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT category, COUNT(*) as count FROM documents GROUP BY category`,
        (err, byCategory: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          this.db!.all(
            `SELECT type, COUNT(*) as count FROM documents GROUP BY type`,
            (err, byType: any[]) => {
              if (err) {
                reject(err);
                return;
              }

              this.db!.get(`SELECT COUNT(*) as count FROM documents`, (err, row: any) => {
                if (err) {
                  reject(err);
                  return;
                }

                resolve({
                  totalDocuments: row.count,
                  byCategory: Object.fromEntries(
                    (byCategory || []).map((c) => [c.category, c.count])
                  ),
                  byType: Object.fromEntries((byType || []).map((t) => [t.type, t.count])),
                });
              });
            }
          );
        }
      );
    });
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM documents', (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db!.run('DELETE FROM embeddings', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /**
   * Close database
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
