#!/usr/bin/env node

/**
 * Vector Database CLI
 * Command-line interface for Vector DB operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { VectorDatabaseService } from './vector-db.service';
import { ICONS } from '../cli/cli-runtime';

const projectPath = process.cwd();
const vdbPath = path.join(projectPath, 'vector-db.sqlite');
const indexPath = path.join(projectPath, '.vector-db/index.json');

class VectorDBCLI {
  private vdb: VectorDatabaseService;

  constructor() {
    this.vdb = new VectorDatabaseService(projectPath, vdbPath, indexPath);
  }

  /**
   * Initialize Vector DB
   */
  async init(): Promise<void> {
    try {
      console.log(`
${ICONS.rocket} Initializing Vector Database...
`);
      await this.vdb.init();
      console.log(`
${ICONS.success} Vector Database initialized successfully!
`);
    } catch (error) {
      console.error(`${ICONS.error} Error:`, (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Search command
   */
  async search(query: string, limit: number = 10, strategy: string = 'hybrid'): Promise<void> {
    try {
      await this.vdb.init();

      console.log(`
${ICONS.search} Searching (${strategy}): "${query}"
`);

      let result;
      if (strategy === 'keyword') {
        result = await this.vdb.keywordSearch(query, limit);
      } else {
        result = await this.vdb.query(query, limit);
      }

      if (result.documents.length === 0) {
        console.log(`${ICONS.error} No results found
`);
        return;
      }

      console.log(`${ICONS.chart} Found ${result.documents.length} results (${result.executionTimeMs}ms)
`);

      result.documents.forEach((doc, index) => {
        const score = Math.round(doc.relevanceScore * 100);
        const scoreBar = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10));

        console.log(`${index + 1}. ${doc.name}`);
        console.log(`   ${ICONS.pin} ${doc.filePath}`);
        console.log(`   ${ICONS.open_folder} ${doc.category.toUpperCase()}`);
        console.log(`   ${scoreBar} ${score}%`);
        console.log(`   ${ICONS.note} ${doc.description}`);

        if (doc.matchedKeywords && doc.matchedKeywords.length > 0) {
          console.log(`   ${ICONS.label}  ${doc.matchedKeywords.slice(0, 3).join(', ')}`);
        }

        console.log();
      });
    } catch (error) {
      console.error(`${ICONS.error} Error:`, (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Category search
   */
  async category(categoryName: string): Promise<void> {
    try {
      await this.vdb.init();

      console.log(`
${ICONS.open_folder} Documents in category: "${categoryName}"
`);

      const docs = await this.vdb.searchByCategory(categoryName);

      if (docs.length === 0) {
        console.log(`${ICONS.error} No documents found
`);
        return;
      }

      console.log(`Found ${docs.length} documents:\n`);

      docs.forEach((doc, index) => {
        console.log(`${index + 1}. ${doc.name}`);
        console.log(`   ${ICONS.pin} ${doc.filePath}`);
        console.log(`   ${ICONS.note} ${doc.description || '(no description)'}`);
        console.log();
      });
    } catch (error) {
      console.error(`${ICONS.error} Error:`, (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Statistics
   */
  async stats(): Promise<void> {
    try {
      await this.vdb.init();

      console.log(`
${ICONS.chart} Vector Database Statistics
`);

      const stats = await this.vdb.getStats();

      console.log(`Total Documents: ${stats.totalDocuments}\n`);

      console.log('By Category:');
      Object.entries(stats.byCategory).forEach(([cat, count]) => {
        const bar = '█'.repeat(Math.ceil((count as number) / 10));
        console.log(`  ${cat.padEnd(15)} ${bar} ${count}`);
      });

      console.log('\nBy Type:');
      Object.entries(stats.byType).forEach(([type, count]) => {
        const bar = '█'.repeat(Math.ceil((count as number) / 10));
        console.log(`  ${type.padEnd(15)} ${bar} ${count}`);
      });

      console.log();
    } catch (error) {
      console.error(`${ICONS.error} Error:`, (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Related documents
   */
  async related(documentId: string): Promise<void> {
    try {
      await this.vdb.init();

      console.log(`
${ICONS.link} Related to: "${documentId}"
`);

      const docs = await this.vdb.findRelated(documentId);

      if (docs.length === 0) {
        console.log(`${ICONS.error} No related documents found
`);
        return;
      }

      console.log(`Found ${docs.length} related documents:\n`);

      docs.forEach((doc, index) => {
        const score = Math.round(doc.relevanceScore * 100);
        console.log(`${index + 1}. ${doc.name} [${score}%]`);
        console.log(`   ${ICONS.pin} ${doc.filePath}`);
        console.log(`   ${ICONS.open_folder} ${doc.category}`);
        console.log();
      });
    } catch (error) {
      console.error(`${ICONS.error} Error:`, (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Autocomplete
   */
  async autocomplete(prefix: string): Promise<void> {
    try {
      await this.vdb.init();

      console.log(`
${ICONS.light_bulb} Suggestions for: "${prefix}"
`);

      const suggestions = await this.vdb.autocomplete(prefix, 10);

      if (suggestions.length === 0) {
        console.log(`${ICONS.error} No suggestions found
`);
        return;
      }

      suggestions.forEach((suggestion, index) => {
        console.log(`${index + 1}. ${suggestion}`);
      });

      console.log();
    } catch (error) {
      console.error(`${ICONS.error} Error:`, (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Reindex
   */
  async reindex(): Promise<void> {
    try {
      console.log(`
${ICONS.refresh} Reindexing project...
`);
      await this.vdb.reindex();
      console.log(`
${ICONS.success} Reindexing complete!
`);
    } catch (error) {
      console.error(`${ICONS.error} Error:`, (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Get document
   */
  async getDocument(id: string): Promise<void> {
    try {
      await this.vdb.init();

      const doc = await this.vdb.getDocument(id);

      if (!doc) {
        console.log(`
${ICONS.error} Document not found: ${id}
`);
        return;
      }

      console.log(`
${ICONS.page} Document: ${doc.name}
`);
      console.log(`ID:          ${doc.id}`);
      console.log(`Type:        ${doc.type}`);
      console.log(`Category:    ${doc.category}`);
      console.log(`File:        ${doc.filePath}`);
      console.log(`Size:        ${doc.size} bytes`);
      console.log(`Updated:     ${doc.lastUpdated}`);

      console.log(`\nDescription:\n${doc.description}\n`);

      console.log(`Keywords: ${doc.keywords.join(', ')}\n`);
      console.log(`Tags:     ${doc.tags.join(', ')}\n`);

      if (doc.relatedModules && doc.relatedModules.length > 0) {
        console.log(`Related modules: ${doc.relatedModules.join(', ')}\n`);
      }
    } catch (error) {
      console.error(`${ICONS.error} Error:`, (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Export index
   */
  async export(outputPath: string): Promise<void> {
    try {
      await this.vdb.init();

      const data = await this.vdb.exportIndex();
      const outFile = outputPath || `vector-db-export-${Date.now()}.json`;

      fs.writeFileSync(outFile, data);
      console.log(`
${ICONS.success} Exported to: ${outFile}
`);
    } catch (error) {
      console.error(`${ICONS.error} Error:`, (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Help
   */
  showHelp(): void {
    console.log(`
┌──────────────────────────────────────────────────────┐
│          Vector Database CLI v1.0                    │
└──────────────────────────────────────────────────────┘

USAGE:
  npm run vector-db [command] [options]

COMMANDS:

  init                          Initialize vector database
  search <query> [limit]        Search codebase
  search <query> --keyword      Keyword search
  category <name>               List documents by category
  stats                         Show database statistics
  related <doc-id>              Find related documents
  autocomplete <prefix>         Get autocomplete suggestions
  reindex                       Rebuild entire index
  get <doc-id>                  Get document details
  export [filepath]             Export index as JSON
  help                          Show this help

EXAMPLES:

  npm run vector-db init
  npm run vector-db search "EMA indicator"
  npm run vector-db search "trend analysis" --keyword
  npm run vector-db category analyzer
  npm run vector-db stats
  npm run vector-db related "ema.analyzer-new.ts"
  npm run vector-db autocomplete "ana"
  npm run vector-db reindex
  npm run vector-db get "packages/core/src/indicators/ema.indicator-new.ts"
  npm run vector-db export ./export.json

For detailed documentation, see: .vector-db/USAGE.md
`);
  }
}

/**
 * Main
 */
async function main() {
  const cli = new VectorDBCLI();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    cli.showHelp();
    process.exit(0);
  }

  const command = args[0];
  const params = args.slice(1);

  try {
    switch (command) {
      case 'init':
        await cli.init();
        break;

      case 'search':
        if (params.length === 0) {
          console.error(`${ICONS.error} Missing search query`);
          process.exit(1);
        }
        const query = params.join(' ').replace('--keyword', '').trim();
        const isKeyword = args.join(' ').includes('--keyword');
        const limit = parseInt(params[params.length - 1]) || 10;
        await cli.search(query, limit, isKeyword ? 'keyword' : 'hybrid');
        break;

      case 'category':
        if (params.length === 0) {
          console.error(`${ICONS.error} Missing category name`);
          process.exit(1);
        }
        await cli.category(params[0]);
        break;

      case 'stats':
        await cli.stats();
        break;

      case 'related':
        if (params.length === 0) {
          console.error(`${ICONS.error} Missing document ID`);
          process.exit(1);
        }
        await cli.related(params[0]);
        break;

      case 'autocomplete':
        if (params.length === 0) {
          console.error(`${ICONS.error} Missing prefix`);
          process.exit(1);
        }
        await cli.autocomplete(params[0]);
        break;

      case 'reindex':
        await cli.reindex();
        break;

      case 'get':
        if (params.length === 0) {
          console.error(`${ICONS.error} Missing document ID`);
          process.exit(1);
        }
        await cli.getDocument(params.join(' '));
        break;

      case 'export':
        await cli.export(params[0] || '');
        break;

      case 'help':
      case '--help':
      case '-h':
        cli.showHelp();
        break;

      default:
        console.error(`${ICONS.error} Unknown command: ${command}`);
        cli.showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`${ICONS.error} Fatal error:`, (error as Error).message);
    process.exit(1);
  }
}

main();
