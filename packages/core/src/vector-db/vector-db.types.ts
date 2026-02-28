/**
 * Vector Database Type Definitions
 * For semantic search and embeddings across the Edison codebase
 */

export interface EmbeddedDocument {
  id: string; // Unique identifier (file path or module name)
  type: 'file' | 'module' | 'class' | 'function' | 'service' | 'analyzer' | 'indicator';
  filePath: string; // Relative path to source file
  name: string; // Document name
  description: string; // What this does
  category: string; // analyzer, indicator, service, orchestrator, etc.
  tags: string[]; // For filtering
  content: string; // Full text content (for keyword search)
  embedding?: number[]; // Vector embedding (768D for production)
  keywords: string[]; // Key terms extracted
  lineNumber?: number; // If pointing to specific function
  size: number; // File or section size in bytes
  lastUpdated: string; // ISO timestamp
  relatedModules: string[]; // IDs of related modules
}

export interface SearchQuery {
  text: string; // Natural language query
  limit?: number; // Max results (default: 10)
  filters?: {
    category?: string;
    type?: string;
    tags?: string[];
  };
  useKeywordMatching?: boolean; // Fallback to keyword search
}

export interface SearchResult {
  documents: SearchResultItem[];
  query: string;
  totalMatches: number;
  executionTimeMs: number;
}

export interface SearchResultItem {
  id: string;
  name: string;
  filePath: string;
  category: string;
  relevanceScore: number; // 0-1
  description: string;
  matchedKeywords?: string[];
  context?: string; // Snippet showing match
}

export interface ProjectIndex {
  version: string; // Schema version
  generatedAt: string; // ISO timestamp
  projectName: string;
  projectPath: string;
  statistics: {
    totalFiles: number;
    totalModules: number;
    totalLines: number;
    categories: Record<string, number>;
  };
  documents: EmbeddedDocument[];
  lastIndexUpdate: string;
}

export interface ModuleSummary {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  lineCount: number;
  mainComponents: string[];
  dependencies: string[];
  exports: string[];
}

export interface IndexConfig {
  excludePatterns?: string[];
  includePatterns?: string[];
  maxFileSize?: number;
  scanDepth?: number;
  embeddingModel?: string; // 'tfidf' | 'openai' | 'huggingface'
  saveAsJson?: boolean;
}

export interface SearchCache {
  query: string;
  results: SearchResultItem[];
  timestamp: number;
}
