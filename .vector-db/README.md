# Vector Database System

## 🎯 Overview

The **Vector Database (VectorDB)** is a semantic code search system built for the Edison trading bot project. It enables intelligent, fast context gathering across the entire codebase without repeatedly scanning files.

**What it does:**
- Indexes all project files and modules (302 files, 98K lines)
- Creates semantic embeddings for fast similarity search
- Provides multiple search strategies (keyword, semantic, filter-based)
- Stores results in SQLite for persistence and offline access
- Includes CLI tools and programmatic API

**Why it exists:**
1. **Speed** - Search the entire codebase in milliseconds
2. **Context** - Understand code relationships and dependencies
3. **Efficiency** - No need to rescan project on each session
4. **Accuracy** - Find semantically related code, not just keyword matches

---

## 🚀 Quick Start

### 1️⃣ Initialize (One-time)

```bash
npm run vector-db:init
```

This will:
- Create SQLite database: `vector-db.sqlite`
- Create index file: `.vector-db/index.json`
- Scan all TypeScript files
- Build embeddings for semantic search
- Cache module relationships

### 2️⃣ Search

```bash
# Keyword search
npm run vector-db:search "EMA indicator"

# Get statistics
npm run vector-db:stats

# Find all analyzers
npm run vector-db:category analyzer

# Find related documents
npm run vector-db:related "ema.analyzer-new.ts"

# Autocomplete
npm run vector-db:autocomplete "ana"
```

### 3️⃣ Use in Code

```typescript
import { getVectorDB } from 'src/vector-db';

const vdb = await getVectorDB();

// Search
const results = await vdb.query('How does EMA work?', 5);
results.documents.forEach(doc => {
  console.log(`${doc.name}: ${doc.relevanceScore * 100}%`);
});

// Find related modules
const related = await vdb.findRelated('src/indicators/ema.indicator-new.ts');

// Get all by category
const analyzers = await vdb.searchByCategory('analyzer');
```

---

## 📁 Architecture

```
┌─────────────────────────────────────────────┐
│        Vector Database System                │
├─────────────────────────────────────────────┤
│                                              │
│  CLI Interface                               │
│  ├─ npm run vector-db:search                 │
│  ├─ npm run vector-db:category               │
│  ├─ npm run vector-db:stats                  │
│  └─ ... (9 commands total)                   │
│                                              │
│  ↓                                           │
│                                              │
│  VectorDatabaseService (Main Interface)      │
│  ├─ search()                                 │
│  ├─ query()                                  │
│  ├─ keywordSearch()                          │
│  ├─ searchByCategory()                       │
│  └─ findRelated()                            │
│                                              │
│  ↓ ↓ ↓                                       │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ProjectIndexer                         │  │
│  │ (Scans files, creates embeddings)      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ SemanticSearchService                  │  │
│  │ (Keyword + semantic search)            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ SQLiteVectorStore                      │  │
│  │ (Persistence + caching)                │  │
│  └────────────────────────────────────────┘  │
│          ↓                                   │
│    [vector-db.sqlite]                        │
│    - documents table                         │
│    - embeddings table                        │
│    - search_cache table                      │
│    - metadata table                          │
│                                              │
└─────────────────────────────────────────────┘
```

---

## 📋 What's Indexed

**Total:** 302 files, 98,408 lines of code

**By Category:**
```
├── Services (76)           ▓▓▓▓▓▓▓▓▓▓ 25%
├── Analyzers (29)          ▓▓▓▓ 10%
├── Tests (124)             ▓▓▓▓▓▓▓▓▓▓▓▓▓ 41%
├── Indicators (6)          ▓ 2%
├── Orchestrators (3)       - 1%
├── Types (11)              ▓ 4%
├── Utilities (10)          ▓ 3%
└── Other (37)              ▓▓ 12%
```

**By Type:**
- `file` - Source files
- `module` - Logical modules
- `analyzer` - Signal analyzers
- `indicator` - Technical indicators
- `service` - Business logic services
- `orchestrator` - Decision orchestrators
- `test` - Test files

---

## 🔍 Search Strategies

### 1. Keyword Search (Exact Matches)
Best for: Function names, class names, specific terms

```bash
npm run vector-db:search "EMAAnalyzer" --keyword
```

**How it works:**
- Splits query into terms
- Matches against name, keywords, tags, description
- Scores by match location (name > keywords > description)
- Fast but limited to exact/partial matches

### 2. Semantic Search (Natural Language)
Best for: Understanding, concepts, relationships

```bash
npm run vector-db:search "How to detect trends in price action?"
```

**How it works:**
- Extracts semantic meaning from query
- Matches against document keywords and relationships
- Scores based on conceptual similarity
- Better for understanding than exact matches

### 3. Filter Search (Category/Tags)
Best for: Finding specific document types

```bash
npm run vector-db:search --filter category=analyzer --tags=entry,signal
```

**How it works:**
- Filters by category (analyzer, indicator, service, etc.)
- Filters by tags (entry, exit, signal, risk, etc.)
- Returns exact matches within filters
- Fastest option for known categories

### 4. Related Documents (Dependencies)
Best for: Understanding module relationships

```bash
npm run vector-db:related "ema.analyzer-new.ts"
```

**How it works:**
- Finds documents that import/use this module
- Returns inverse dependencies
- Shows module ecosystem

---

## 💾 Database Schema

### `documents` Table
```sql
┌─────────────────────────────────────────┐
│ documents                               │
├─────────────────────────────────────────┤
│ id (PK)              TEXT                │
│ type                 TEXT                │ (file|module|analyzer|etc)
│ filePath (UNIQUE)    TEXT                │ (src/indicators/ema.ts)
│ name                 TEXT                │ (EMAIndicatorNew)
│ description          TEXT                │ (What this does)
│ category             TEXT                │ (indicator|analyzer|etc)
│ tags                 JSON[]              │ ([trending, entry])
│ content              TEXT                │ (First 10KB)
│ keywords             JSON[]              │ ([ema, indicator, ...])
│ lineNumber           INT                 │ (For functions)
│ size                 INT                 │ (File size bytes)
│ lastUpdated          TIMESTAMP           │ (ISO)
│ relatedModules       JSON[]              │ (ID references)
│ createdAt            TIMESTAMP           │
└─────────────────────────────────────────┘
```

### `embeddings` Table
```sql
┌─────────────────────────────────────────┐
│ embeddings                              │
├─────────────────────────────────────────┤
│ id (PK)              TEXT                │
│ documentId (FK)      TEXT                │ → documents.id
│ embedding            JSON (768D)         │ (Vector)
│ embeddingModel       TEXT                │ (tfidf|openai|hf)
│ embeddingDims        INT                 │ (768)
│ embeddingNorm        FLOAT               │ (L2 norm)
│ createdAt            TIMESTAMP           │
└─────────────────────────────────────────┘
```

### `search_cache` Table
```sql
┌─────────────────────────────────────────┐
│ search_cache                            │
├─────────────────────────────────────────┤
│ query (PK)           TEXT                │
│ results              JSON[]              │
│ timestamp            INT                 │
│ ttl                  INT                 │ (seconds)
└─────────────────────────────────────────┘
```

---

## 🎮 CLI Commands

### Search
```bash
npm run vector-db:search "query" [limit] [--keyword]

Examples:
npm run vector-db:search "EMA"
npm run vector-db:search "trend detection" 5
npm run vector-db:search "risk management" --keyword
```

### Categories
```bash
npm run vector-db:category <name>

Examples:
npm run vector-db:category analyzer       # List all analyzers
npm run vector-db:category indicator      # List all indicators
npm run vector-db:category service        # List all services
```

### Statistics
```bash
npm run vector-db:stats

Output:
📊 Vector Database Statistics
├── Total Documents: 302
├── By Category:
│   ├── analyzer: 29
│   ├── indicator: 6
│   └── ... (5 more)
└── By Type:
    ├── file: 200
    ├── module: 80
    └── ... (more types)
```

### Find Related
```bash
npm run vector-db:related <document-id>

Examples:
npm run vector-db:related "src/indicators/ema.indicator-new.ts"
npm run vector-db:related "EMAIndicatorNew"
```

### Autocomplete
```bash
npm run vector-db:autocomplete <prefix> [limit]

Examples:
npm run vector-db:autocomplete "ana" 5
npm run vector-db:autocomplete "ema" 3
```

### Initialize
```bash
npm run vector-db:init

# One-time setup
# Creates database, scans project, builds index
```

### Reindex
```bash
npm run vector-db:reindex

# Full rebuild (slow, but needed after major changes)
```

### Get Document
```bash
npm run vector-db:get <document-id>

Examples:
npm run vector-db:get "src/indicators/ema.indicator-new.ts"
```

### Export
```bash
npm run vector-db:export [filepath]

Examples:
npm run vector-db:export                      # Uses default timestamp filename
npm run vector-db:export ./my-export.json     # Custom path
```

---

## 🔌 API Reference

### Main Service

```typescript
class VectorDatabaseService {
  // Initialization
  async init(): Promise<void>
  async reindex(): Promise<ProjectIndex>

  // Search
  async search(query: SearchQuery): Promise<SearchResult>
  async query(text: string, limit?: number): Promise<SearchResult>
  async keywordSearch(text: string, limit?: number): Promise<SearchResult>

  // Filtering
  async searchByCategory(category: string): Promise<SearchResultItem[]>
  async findRelated(documentId: string): Promise<SearchResultItem[]>

  // Utilities
  async autocomplete(prefix: string, limit?: number): Promise<string[]>
  async getDocument(id: string): Promise<EmbeddedDocument | null>
  async updateDocument(doc: EmbeddedDocument): Promise<void>
  async getStats(): Promise<Stats>

  // Cleanup
  async close(): Promise<void>
}
```

### Search Query Interface

```typescript
interface SearchQuery {
  text: string;                    // Natural language query
  limit?: number;                  // Max results (default: 10)
  filters?: {
    category?: string;             // e.g., 'analyzer'
    type?: string;                 // e.g., 'file'
    tags?: string[];               // e.g., ['entry', 'signal']
  };
  useKeywordMatching?: boolean;    // Force keyword search
}
```

### Search Result

```typescript
interface SearchResult {
  documents: SearchResultItem[];   // Matching documents
  query: string;                   // Original query
  totalMatches: number;            // Count
  executionTimeMs: number;         // Performance
}

interface SearchResultItem {
  id: string;
  name: string;
  filePath: string;
  category: string;
  relevanceScore: number;          // 0-1
  description: string;
  matchedKeywords?: string[];
  context?: string;                // Snippet
}
```

---

## 📊 Performance

### Speeds
- **First init:** ~2-5 seconds (scans 302 files)
- **Keyword search:** <10ms (SQLite fulltext)
- **Semantic search:** <50ms (similarity matching)
- **Category filter:** <5ms (indexed lookup)
- **Cache hit:** <1ms

### Storage
- **SQLite database:** ~2-3 MB
- **Index JSON:** ~1.5 MB
- **Total:** ~4 MB

### Scalability
- Tested up to 302 files
- Efficiently handles incremental updates
- Can be extended to thousands of files

---

## 🔄 Updating Index

### Automatic Updates
```typescript
// Update single document
const doc = await vdb.getDocument('src/indicators/ema.indicator-new.ts');
doc.description = 'Updated description';
await vdb.updateDocument(doc);
```

### Full Reindex
```bash
npm run vector-db:reindex
```

Use when:
- Major refactoring across many files
- Adding/removing many modules
- Rebuilding semantic embeddings

---

## 🐛 Troubleshooting

### "No results found"
- Try keyword search instead of semantic
- Check category filters
- Verify document was indexed: `npm run vector-db:stats`

### "Database locked"
- Ensure no other instance is accessing VectorDB
- Close any database browsers/editors
- Delete `vector-db.sqlite-wal` if it exists

### "Index is stale"
- Run `npm run vector-db:reindex`
- Or delete and recreate: `rm vector-db.sqlite && npm run vector-db:init`

### "Out of memory"
- Reduce `maxFileSize` in config
- Exclude large files from indexing
- Use category filters to search subsets

---

## 📚 Documentation

- **USAGE.md** - Detailed usage guide and examples
- **API Reference** - Complete type definitions
- **.vector-db/index.json** - Generated project index
- **CLAUDE.md** - Integration with session guide

---

## 🎓 Learn More

- Read **USAGE.md** for advanced search patterns
- Check **type definitions** in `src/vector-db/vector-db.types.ts`
- Explore **examples** in integration docs
- Review **CLI source** in `src/vector-db/cli.ts`

---

## 📝 Examples

### Find all Entry Signals
```bash
npm run vector-db:search "entry signal" 20
```

### Get All Risk Management Code
```bash
npm run vector-db:search --filter category=service --tags=risk
```

### Understand EMA Indicator
```bash
npm run vector-db:search "EMA" 10
npm run vector-db:related "src/indicators/ema.indicator-new.ts"
```

### Find Test Patterns
```bash
npm run vector-db:search "functional test pattern" 5
```

### List All Analyzers with Tests
```bash
npm run vector-db:category analyzer
```

---

## 🚀 Next Steps

1. **Initialize:** `npm run vector-db:init`
2. **Explore:** Try the search commands above
3. **Integrate:** Use `getVectorDB()` in your code
4. **Build:** Create IDE plugins or web UI on top
5. **Extend:** Add custom embeddings (OpenAI, HuggingFace)

---

**Last Updated:** 2026-01-12
**Version:** 1.0
**Status:** Production Ready ✅
