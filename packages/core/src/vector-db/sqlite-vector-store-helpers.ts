import { EmbeddedDocument, SearchResultItem } from './vector-db.types';

export type QueryParam = string | number;

export interface SqlDocumentRow {
  id: string;
  type: EmbeddedDocument['type'] | string;
  filePath: string;
  name: string;
  description: string;
  category: string;
  tags: string | null;
  content: string;
  keywords: string | null;
  lineNumber: number | null;
  size: number;
  lastUpdated: string;
  relatedModules: string | null;
}

export interface SqlCacheRow {
  results: string;
  timestamp: number;
  ttl: number;
}

export interface SqlCountByCategoryRow {
  category: string;
  count: number;
}

export interface SqlCountByTypeRow {
  type: string;
  count: number;
}

export interface SqlTotalCountRow {
  count: number;
}

export const SQLITE_SCHEMA_STATEMENTS = [
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
  `CREATE TABLE IF NOT EXISTS search_cache (
    query TEXT PRIMARY KEY,
    results TEXT,
    timestamp INTEGER,
    ttl INTEGER DEFAULT 3600
  )`,
  `CREATE TABLE IF NOT EXISTS project_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    lastUpdated TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS module_summaries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    summary TEXT,
    lastUpdated TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_filePath ON documents(filePath)`,
  `CREATE INDEX IF NOT EXISTS idx_embeddings_documentId ON embeddings(documentId)`,
  `CREATE INDEX IF NOT EXISTS idx_module_summaries_name ON module_summaries(name)`,
];

const VALID_DOCUMENT_TYPES: EmbeddedDocument['type'][] = [
  'file',
  'module',
  'class',
  'function',
  'service',
  'analyzer',
  'indicator',
];

export function buildSqliteDocumentFilterQuery(options: {
  category?: string;
  type?: string;
  tags?: string[];
  limit: number;
}): { params: QueryParam[]; query: string } {
  let query = 'SELECT * FROM documents WHERE 1=1';
  const params: QueryParam[] = [];

  if (options.category) {
    query += ' AND category = ?';
    params.push(options.category);
  }

  if (options.type) {
    query += ' AND type = ?';
    params.push(options.type);
  }

  if (options.tags && options.tags.length > 0) {
    const tagConditions = options.tags.map(() => 'json_each.value = ?').join(' OR ');
    query += ` AND (SELECT COUNT(*) FROM json_each(documents.tags) WHERE ${tagConditions}) > 0`;
    params.push(...options.tags);
  }

  query += ' LIMIT ?';
  params.push(options.limit);

  return { query, params };
}

export function normalizeSqliteDocumentType(type: string): EmbeddedDocument['type'] {
  return VALID_DOCUMENT_TYPES.includes(type as EmbeddedDocument['type'])
    ? (type as EmbeddedDocument['type'])
    : 'file';
}

export function mapSqliteRowToDocument(row: SqlDocumentRow): EmbeddedDocument {
  return {
    id: row.id,
    type: normalizeSqliteDocumentType(row.type),
    filePath: row.filePath,
    name: row.name,
    description: row.description,
    category: row.category,
    tags: parseStringArray(row.tags),
    content: row.content,
    keywords: parseStringArray(row.keywords),
    lineNumber: row.lineNumber ?? undefined,
    size: row.size,
    lastUpdated: row.lastUpdated,
    relatedModules: parseStringArray(row.relatedModules),
  };
}

export function scoreSqliteKeywordSearchDocument(doc: EmbeddedDocument, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const searchableText = `${doc.name} ${doc.description} ${doc.keywords.join(' ')}`.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (doc.name.toLowerCase().includes(term)) {
      score += 3;
    }
    if (doc.keywords.some((keyword) => keyword.toLowerCase().includes(term))) {
      score += 2;
    }
    if (doc.description.toLowerCase().includes(term)) {
      score += 1;
    }

    const matches = searchableText.match(new RegExp(escapeRegExp(term), 'g')) ?? [];
    score += matches.length * 0.5;
  }

  return Math.min(score / 10, 1);
}

export function hasFreshCachedSearchResult(
  row: Pick<SqlCacheRow, 'timestamp' | 'ttl'>,
  nowMs: number = Date.now(),
): boolean {
  return row.timestamp + row.ttl * 1000 > nowMs;
}

export function parseCachedSearchResults(results: string): SearchResultItem[] {
  const parsed = JSON.parse(results) as unknown;
  return Array.isArray(parsed) ? (parsed as SearchResultItem[]) : [];
}

function parseStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
