/**
 * SQLite Vector Store
 * Persists embeddings and documents for efficient retrieval
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import * as fs from 'fs';
import { EmbeddedDocument, SearchResultItem } from './vector-db.types';
import {
  buildSqliteDocumentFilterQuery,
  hasFreshCachedSearchResult,
  mapSqliteRowToDocument,
  normalizeSqliteDocumentType,
  parseCachedSearchResults,
  QueryParam,
  scoreSqliteKeywordSearchDocument,
  SQLITE_SCHEMA_STATEMENTS,
  SqlCacheRow,
  SqlCountByCategoryRow,
  SqlCountByTypeRow,
  SqlDocumentRow,
  SqlTotalCountRow,
} from './sqlite-vector-store-helpers';

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
    for (const schema of SQLITE_SCHEMA_STATEMENTS) {
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
    if (documents.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            reject(err);
            return;
          }

          let completed = 0;
          const completeDocument = () => {
            completed++;
            if (completed === documents.length) {
              this.db!.run('COMMIT', (commitError) => {
                if (commitError) reject(commitError);
                else resolve();
              });
            }
          };

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

                stmt.finalize((finalizeError) => {
                  if (finalizeError) {
                    reject(finalizeError);
                    return;
                  }

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
                      (embeddingError: Error | null) => {
                        if (embeddingError) {
                          reject(embeddingError);
                          return;
                        }

                        embStmt.finalize((embeddingFinalizeError) => {
                          if (embeddingFinalizeError) {
                            reject(embeddingFinalizeError);
                            return;
                          }

                          completeDocument();
                        });
                      }
                    );

                    return;
                  }

                  completeDocument();
                });
              }
            );
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
        (err, row: SqlDocumentRow | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }
          resolve(this.mapRowToDocument(row));
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
      const { params, query } = buildSqliteDocumentFilterQuery({
        category,
        type,
        tags,
        limit,
      });

      this.db!.all(query, params, (err, rows: SqlDocumentRow[]) => {
        if (err) {
          reject(err);
          return;
        }

        const documents = (rows || []).map((row) => mapSqliteRowToDocument(row));

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
      this.db!.all(
        `SELECT * FROM documents LIMIT ?`,
        [limit * 2], // Get more than needed to score
        (err, rows: SqlDocumentRow[]) => {
          if (err) {
            reject(err);
            return;
          }

          const results = (rows || [])
            .map((row) => {
              const doc: EmbeddedDocument = mapSqliteRowToDocument(row);
              return { document: doc, relevance: scoreSqliteKeywordSearchDocument(doc, query) };
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
  async cacheSearchResult(query: string, results: SearchResultItem[], ttl: number = 3600): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(
        `INSERT OR REPLACE INTO search_cache (query, results, timestamp, ttl)
         VALUES (?, ?, ?, ?)`
      );

      stmt.run(query, JSON.stringify(results), Date.now(), ttl, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        stmt.finalize((finalizeError) => {
          if (finalizeError) {
            reject(finalizeError);
            return;
          }

          resolve();
        });
      });
    });
  }

  /**
   * Get cached search result
   */
  async getCachedResult(query: string): Promise<SearchResultItem[] | null> {
    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT results, timestamp, ttl FROM search_cache
         WHERE query = ?`,
        [query],
        (err, row: SqlCacheRow | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          if (!hasFreshCachedSearchResult(row)) {
            resolve(null);
            return;
          }

          resolve(parseCachedSearchResults(row.results));
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
        (err, byCategory: SqlCountByCategoryRow[]) => {
          if (err) {
            reject(err);
            return;
          }

          this.db!.all(
            `SELECT type, COUNT(*) as count FROM documents GROUP BY type`,
            (err, byType: SqlCountByTypeRow[]) => {
              if (err) {
                reject(err);
                return;
              }

              this.db!.get(`SELECT COUNT(*) as count FROM documents`, (err, row: SqlTotalCountRow | undefined) => {
                if (err) {
                  reject(err);
                  return;
                }

                resolve({
                  totalDocuments: row?.count ?? 0,
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

  private mapRowToDocument(row: SqlDocumentRow): EmbeddedDocument {
    return mapSqliteRowToDocument(row);
  }

  private normalizeDocumentType(type: string): EmbeddedDocument['type'] {
    return normalizeSqliteDocumentType(type);
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
