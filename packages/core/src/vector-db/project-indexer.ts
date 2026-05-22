/**
 * Project Indexer
 * Scans the Edison codebase and creates embeddings for all modules/files
 */

import * as fs from 'fs';
import { glob } from 'glob';
import { ProjectIndex, IndexConfig } from './vector-db.types';
import { ICONS } from '../cli/cli-runtime';
import {
  analyzeProjectIndexerFile,
  createProjectIndexerDocument,
} from './project-indexer-analysis';
import {
  createProjectIndexerGlobPattern,
  createProjectIndexerIgnorePatterns,
  PROJECT_INDEXER_DEFAULT_CONFIG,
} from './project-indexer-discovery';
import {
  analyzeProjectIndexerFiles,
  buildProjectIndex,
  findProjectIndexerFiles,
  ProjectIndexerDependencies,
  readProjectIndexerFile,
} from './project-indexer-runtime';

export class ProjectIndexer {
  private projectPath: string;
  private config: IndexConfig;
  private dependencies: Required<ProjectIndexerDependencies>;

  constructor(
    projectPath: string,
    config?: IndexConfig,
    dependencies: ProjectIndexerDependencies = {},
  ) {
    this.projectPath = projectPath;
    this.config = { ...PROJECT_INDEXER_DEFAULT_CONFIG, ...config };
    this.dependencies = {
      clock: dependencies.clock ?? (() => new Date()),
      globFiles: dependencies.globFiles ?? glob,
      logger: dependencies.logger ?? console,
      readFile: dependencies.readFile ?? fs.readFileSync,
    };
  }

  /**
   * Index entire project
   */
  async indexProject(): Promise<ProjectIndex> {
    const startTime = Date.now();

    // Get all TypeScript files
    const files = await this.findFiles();

    this.dependencies.logger.log(`
${ICONS.chart} Indexing Project...`);
    this.dependencies.logger.log(`Found ${files.length} files to analyze`);

    const documents = await analyzeProjectIndexerFiles({
      analyzeFile: (filePath) => this.analyzeFile(filePath),
      filePaths: files,
      logger: this.dependencies.logger,
      icons: ICONS,
    });

    const elapsedTime = Date.now() - startTime;

    return buildProjectIndex({
      clock: this.dependencies.clock,
      documents,
      elapsedTimeMs: elapsedTime,
      fileCount: files.length,
      logger: this.dependencies.logger,
      projectName: 'Edison Smart Levels Trading Bot',
      projectPath: this.projectPath,
      icons: ICONS,
    });
  }

  /**
   * Find all TypeScript files
   */
  private async findFiles(): Promise<string[]> {
    return findProjectIndexerFiles({
      config: this.config,
      createGlobPattern: createProjectIndexerGlobPattern,
      createIgnorePatterns: createProjectIndexerIgnorePatterns,
      globFiles: this.dependencies.globFiles,
      logger: this.dependencies.logger,
      projectPath: this.projectPath,
    });
  }

  /**
   * Analyze single file
   */
  private async analyzeFile(filePath: string) {
    const content = readProjectIndexerFile(filePath, this.dependencies.readFile);
    const analysis = analyzeProjectIndexerFile(this.projectPath, filePath, content);
    return createProjectIndexerDocument(analysis);
  }
}
