#!/usr/bin/env node

/**
 * Vector Database CLI
 * Command-line interface for Vector DB operations
 */

import * as fs from 'fs';
import { ICONS } from '../cli/cli-runtime';
import {
  resolveVectorDbRuntimePaths,
  type VectorDbRuntimePaths,
} from './vector-db-runtime-paths';
import { VectorDatabaseService } from './vector-db.service';

type VectorDbConsole = Pick<Console, 'error' | 'log'>;

type VectorDbProcessLike = {
  exit(code: number): unknown;
};

type VectorDbFileSystem = Pick<typeof fs, 'writeFileSync'>;

type VectorDbService = Pick<
  VectorDatabaseService,
  | 'autocomplete'
  | 'exportIndex'
  | 'findRelated'
  | 'getDocument'
  | 'getStats'
  | 'init'
  | 'keywordSearch'
  | 'query'
  | 'reindex'
  | 'searchByCategory'
>;

type VectorDbCommandExecutor = Pick<
  VectorDbCli,
  | 'autocomplete'
  | 'category'
  | 'export'
  | 'getDocument'
  | 'init'
  | 'related'
  | 'reindex'
  | 'search'
  | 'stats'
>;

export type VectorDbCommand =
  | { kind: 'autocomplete'; prefix: string }
  | { kind: 'category'; categoryName: string }
  | { kind: 'export'; outputPath: string }
  | { kind: 'get'; documentId: string }
  | { kind: 'help' }
  | { kind: 'init' }
  | { kind: 'related'; documentId: string }
  | { kind: 'reindex' }
  | { kind: 'search'; limit: number; query: string; strategy: 'hybrid' | 'keyword' }
  | { kind: 'stats' }
  | { kind: 'unknown'; command: string };

export type RunVectorDbCliDependencies = {
  console?: VectorDbConsole;
  fileSystem?: VectorDbFileSystem;
  now?: () => number;
  process?: VectorDbProcessLike;
  projectPath?: string;
  service?: VectorDbService;
  serviceFactory?: (paths: VectorDbRuntimePaths) => VectorDbService;
};

export type VectorDbCliRuntime = {
  output: VectorDbConsole;
  processRef: VectorDbProcessLike;
  runtimePaths: VectorDbRuntimePaths;
  service: VectorDbService;
};

export type VectorDbCommandRuntime = {
  cli?: VectorDbCommandExecutor;
  command: VectorDbCommand;
  output: VectorDbConsole;
  processRef: VectorDbProcessLike;
};

type VectorDbRuntimeDependencies = Pick<RunVectorDbCliDependencies, 'console' | 'process'>;

const DEFAULT_SEARCH_LIMIT = 10;
const HELP_TEXT = `
+------------------------------------------------------+
|                Vector Database CLI v1.0              |
+------------------------------------------------------+

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
`.trim();

function createRelevanceBar(score: number): string {
  const filledCells = Math.floor(score / 10);
  return '#'.repeat(filledCells) + '-'.repeat(10 - filledCells);
}

function createStatsBar(count: number): string {
  return '#'.repeat(Math.max(1, Math.ceil(count / 10)));
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readRequiredParam(params: string[], errorMessage: string): string {
  const value = params.join(' ').trim();
  if (!value) {
    throw new Error(errorMessage);
  }
  return value;
}

export function createVectorDbService(
  paths: VectorDbRuntimePaths,
  serviceFactory: (paths: VectorDbRuntimePaths) => VectorDbService = (runtimePaths) =>
    new VectorDatabaseService(
      runtimePaths.projectPath,
      runtimePaths.dbPath,
      runtimePaths.indexPath,
    ),
): VectorDbService {
  return serviceFactory(paths);
}

export function showVectorDbHelp(output: VectorDbConsole = console): void {
  output.log(`\n${HELP_TEXT}\n`);
}

export function parseVectorDbCommand(args: string[]): VectorDbCommand {
  if (args.length === 0) {
    return { kind: 'help' };
  }

  const [command, ...params] = args;

  switch (command) {
    case 'init':
      return { kind: 'init' };
    case 'search': {
      const filteredParams = params.filter((param) => param !== '--keyword');
      const isKeyword = params.includes('--keyword');
      const lastParam = filteredParams[filteredParams.length - 1];
      const hasExplicitLimit = filteredParams.length > 1 && /^\d+$/.test(lastParam ?? '');
      const limit = hasExplicitLimit ? Number(lastParam) : DEFAULT_SEARCH_LIMIT;
      const queryParams = hasExplicitLimit ? filteredParams.slice(0, -1) : filteredParams;
      const query = readRequiredParam(queryParams, 'Missing search query');

      return {
        kind: 'search',
        query,
        limit,
        strategy: isKeyword ? 'keyword' : 'hybrid',
      };
    }
    case 'category':
      return {
        kind: 'category',
        categoryName: readRequiredParam(params, 'Missing category name'),
      };
    case 'stats':
      return { kind: 'stats' };
    case 'related':
      return {
        kind: 'related',
        documentId: readRequiredParam(params, 'Missing document ID'),
      };
    case 'autocomplete':
      return {
        kind: 'autocomplete',
        prefix: readRequiredParam(params, 'Missing prefix'),
      };
    case 'reindex':
      return { kind: 'reindex' };
    case 'get':
      return {
        kind: 'get',
        documentId: readRequiredParam(params, 'Missing document ID'),
      };
    case 'export':
      return { kind: 'export', outputPath: params[0] ?? '' };
    case 'help':
    case '--help':
    case '-h':
      return { kind: 'help' };
    default:
      return { kind: 'unknown', command };
  }
}

export function createVectorDbCliRuntime(
  dependencies: RunVectorDbCliDependencies = {},
): VectorDbCliRuntime {
  const { output, processRef } = resolveVectorDbRuntimeDependencies(dependencies);
  const runtimePaths = resolveVectorDbRuntimePaths(dependencies.projectPath);
  const service =
    dependencies.service ??
    createVectorDbService(runtimePaths, dependencies.serviceFactory);

  return {
    output,
    processRef,
    runtimePaths,
    service,
  };
}

function resolveVectorDbRuntimeDependencies(
  dependencies: VectorDbRuntimeDependencies = {},
): Pick<VectorDbCliRuntime, 'output' | 'processRef'> {
  return {
    output: dependencies.console ?? console,
    processRef: dependencies.process ?? process,
  };
}

export function createVectorDbCommandRuntime(
  args: string[] = process.argv.slice(2),
  dependencies: RunVectorDbCliDependencies = {},
): VectorDbCommandRuntime {
  const command = parseVectorDbCommand(args);
  const { output, processRef } = resolveVectorDbRuntimeDependencies(dependencies);

  if (command.kind === 'help' || command.kind === 'unknown') {
    return {
      command,
      output,
      processRef,
    };
  }

  const { service } = createVectorDbCliRuntime(dependencies);

  return {
    cli: new VectorDbCli(
      service,
      output,
      dependencies.fileSystem ?? fs,
      dependencies.now ?? Date.now,
    ),
    command,
    output,
    processRef,
  };
}

class VectorDbCli {
  constructor(
    private readonly vdb: VectorDbService,
    private readonly output: VectorDbConsole = console,
    private readonly fileSystem: VectorDbFileSystem = fs,
    private readonly now: () => number = Date.now,
  ) {}

  async init(): Promise<void> {
    this.output.log(`\n${ICONS.rocket} Initializing Vector Database...\n`);
    await this.vdb.init();
    this.output.log(`\n${ICONS.success} Vector Database initialized successfully!\n`);
  }

  async search(
    query: string,
    limit: number = DEFAULT_SEARCH_LIMIT,
    strategy: 'hybrid' | 'keyword' = 'hybrid',
  ): Promise<void> {
    await this.vdb.init();

    this.output.log(`\n${ICONS.search} Searching (${strategy}): "${query}"\n`);

    const result =
      strategy === 'keyword'
        ? await this.vdb.keywordSearch(query, limit)
        : await this.vdb.query(query, limit);

    if (result.documents.length === 0) {
      this.output.log(`${ICONS.error} No results found\n`);
      return;
    }

    this.output.log(
      `${ICONS.chart} Found ${result.documents.length} results (${result.executionTimeMs}ms)\n`,
    );

    result.documents.forEach((doc, index) => {
      const score = Math.round(doc.relevanceScore * 100);
      const scoreBar = createRelevanceBar(score);

      this.output.log(`${index + 1}. ${doc.name}`);
      this.output.log(`   ${ICONS.pin} ${doc.filePath}`);
      this.output.log(`   ${ICONS.open_folder} ${doc.category.toUpperCase()}`);
      this.output.log(`   ${scoreBar} ${score}%`);
      this.output.log(`   ${ICONS.note} ${doc.description}`);

      if (doc.matchedKeywords && doc.matchedKeywords.length > 0) {
        this.output.log(`   ${ICONS.label} ${doc.matchedKeywords.slice(0, 3).join(', ')}`);
      }

      this.output.log('');
    });
  }

  async category(categoryName: string): Promise<void> {
    await this.vdb.init();

    this.output.log(`\n${ICONS.open_folder} Documents in category: "${categoryName}"\n`);

    const docs = await this.vdb.searchByCategory(categoryName);

    if (docs.length === 0) {
      this.output.log(`${ICONS.error} No documents found\n`);
      return;
    }

    this.output.log(`Found ${docs.length} documents:\n`);

    docs.forEach((doc, index) => {
      this.output.log(`${index + 1}. ${doc.name}`);
      this.output.log(`   ${ICONS.pin} ${doc.filePath}`);
      this.output.log(`   ${ICONS.note} ${doc.description || '(no description)'}`);
      this.output.log('');
    });
  }

  async stats(): Promise<void> {
    await this.vdb.init();

    this.output.log(`\n${ICONS.chart} Vector Database Statistics\n`);

    const stats = await this.vdb.getStats();

    this.output.log(`Total Documents: ${stats.totalDocuments}\n`);
    this.output.log('By Category:');
    Object.entries(stats.byCategory).forEach(([category, count]) => {
      this.output.log(`  ${category.padEnd(15)} ${createStatsBar(count)} ${count}`);
    });

    this.output.log('\nBy Type:');
    Object.entries(stats.byType).forEach(([type, count]) => {
      this.output.log(`  ${type.padEnd(15)} ${createStatsBar(count)} ${count}`);
    });

    this.output.log('');
  }

  async related(documentId: string): Promise<void> {
    await this.vdb.init();

    this.output.log(`\n${ICONS.link} Related to: "${documentId}"\n`);

    const docs = await this.vdb.findRelated(documentId);

    if (docs.length === 0) {
      this.output.log(`${ICONS.error} No related documents found\n`);
      return;
    }

    this.output.log(`Found ${docs.length} related documents:\n`);

    docs.forEach((doc, index) => {
      const score = Math.round(doc.relevanceScore * 100);
      this.output.log(`${index + 1}. ${doc.name} [${score}%]`);
      this.output.log(`   ${ICONS.pin} ${doc.filePath}`);
      this.output.log(`   ${ICONS.open_folder} ${doc.category}`);
      this.output.log('');
    });
  }

  async autocomplete(prefix: string): Promise<void> {
    await this.vdb.init();

    this.output.log(`\n${ICONS.light_bulb} Suggestions for: "${prefix}"\n`);

    const suggestions = await this.vdb.autocomplete(prefix, DEFAULT_SEARCH_LIMIT);

    if (suggestions.length === 0) {
      this.output.log(`${ICONS.error} No suggestions found\n`);
      return;
    }

    suggestions.forEach((suggestion, index) => {
      this.output.log(`${index + 1}. ${suggestion}`);
    });

    this.output.log('');
  }

  async reindex(): Promise<void> {
    this.output.log(`\n${ICONS.refresh} Reindexing project...\n`);
    await this.vdb.reindex();
    this.output.log(`\n${ICONS.success} Reindexing complete!\n`);
  }

  async getDocument(documentId: string): Promise<void> {
    await this.vdb.init();

    const doc = await this.vdb.getDocument(documentId);

    if (!doc) {
      this.output.log(`\n${ICONS.error} Document not found: ${documentId}\n`);
      return;
    }

    this.output.log(`\n${ICONS.page} Document: ${doc.name}\n`);
    this.output.log(`ID:          ${doc.id}`);
    this.output.log(`Type:        ${doc.type}`);
    this.output.log(`Category:    ${doc.category}`);
    this.output.log(`File:        ${doc.filePath}`);
    this.output.log(`Size:        ${doc.size} bytes`);
    this.output.log(`Updated:     ${doc.lastUpdated}`);
    this.output.log(`\nDescription:\n${doc.description}\n`);
    this.output.log(`Keywords: ${doc.keywords.join(', ')}\n`);
    this.output.log(`Tags:     ${doc.tags.join(', ')}\n`);

    if (doc.relatedModules && doc.relatedModules.length > 0) {
      this.output.log(`Related modules: ${doc.relatedModules.join(', ')}\n`);
    }
  }

  async export(outputPath: string): Promise<void> {
    await this.vdb.init();

    const data = await this.vdb.exportIndex();
    const outFile = outputPath || `vector-db-export-${this.now()}.json`;

    this.fileSystem.writeFileSync(outFile, data);
    this.output.log(`\n${ICONS.success} Exported to: ${outFile}\n`);
  }
}

export async function executeVectorDbCommand(
  command: VectorDbCommand,
  cli: VectorDbCommandExecutor,
): Promise<void> {
  switch (command.kind) {
    case 'autocomplete':
      await cli.autocomplete(command.prefix);
      return;
    case 'category':
      await cli.category(command.categoryName);
      return;
    case 'export':
      await cli.export(command.outputPath);
      return;
    case 'get':
      await cli.getDocument(command.documentId);
      return;
    case 'help':
    case 'unknown':
      return;
    case 'init':
      await cli.init();
      return;
    case 'related':
      await cli.related(command.documentId);
      return;
    case 'reindex':
      await cli.reindex();
      return;
    case 'search':
      await cli.search(command.query, command.limit, command.strategy);
      return;
    case 'stats':
      await cli.stats();
      return;
    default:
      return;
  }
}

export async function handleVectorDbCommand(
  runtime: VectorDbCommandRuntime,
  helpRenderer: (output?: VectorDbConsole) => void = showVectorDbHelp,
): Promise<void> {
  if (runtime.command.kind === 'help') {
    helpRenderer(runtime.output);
    return;
  }

  if (runtime.command.kind === 'unknown') {
    runtime.output.error(`${ICONS.error} Unknown command: ${runtime.command.command}`);
    helpRenderer(runtime.output);
    runtime.processRef.exit(1);
    return;
  }

  await executeVectorDbCommand(runtime.command, runtime.cli as VectorDbCommandExecutor);
}

export async function runVectorDbCli(
  args: string[] = process.argv.slice(2),
  dependencies: RunVectorDbCliDependencies = {},
): Promise<void> {
  const { output, processRef } = resolveVectorDbRuntimeDependencies(dependencies);

  try {
    const runtime = createVectorDbCommandRuntime(args, dependencies);
    await handleVectorDbCommand(runtime);
  } catch (error) {
    output.error(`${ICONS.error} Fatal error:`, formatErrorMessage(error));
    processRef.exit(1);
  }
}
