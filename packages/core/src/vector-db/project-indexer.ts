/**
 * Project Indexer
 * Scans the Edison codebase and creates embeddings for all modules/files
 */

import * as fs from 'fs';
import { glob } from 'glob';
import { EmbeddedDocument, ProjectIndex, IndexConfig } from './vector-db.types';
import { ICONS } from '../cli/cli-runtime';
import {
  analyzeProjectIndexerFile,
  countProjectIndexerDocumentsByCategory,
  countProjectIndexerLines,
  createProjectIndexerDocument,
} from './project-indexer-analysis';
import {
  createProjectIndexerGlobPattern,
  createProjectIndexerIgnorePatterns,
  PROJECT_INDEXER_DEFAULT_CONFIG,
} from './project-indexer-discovery';

export class ProjectIndexer {
  private projectPath: string;
  private config: IndexConfig;

  constructor(projectPath: string, config?: IndexConfig) {
    this.projectPath = projectPath;
    this.config = { ...PROJECT_INDEXER_DEFAULT_CONFIG, ...config };
  }

  /**
   * Index entire project
   */
  async indexProject(): Promise<ProjectIndex> {
    const startTime = Date.now();
    const documents: EmbeddedDocument[] = [];

    // Get all TypeScript files
    const files = await this.findFiles();

    console.log(`
${ICONS.chart} Indexing Project...`);
    console.log(`Found ${files.length} files to analyze`);

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      try {
        const analysis = await this.analyzeFile(filePath);
        const doc = createProjectIndexerDocument(analysis);
        documents.push(doc);

        if ((i + 1) % 50 === 0) {
          console.log(`  Progress: ${i + 1}/${files.length}`);
        }
      } catch (error) {
        console.warn(`${ICONS.warning} Failed to analyze ${filePath}:`, (error as Error).message);
      }
    }

    const elapsedTime = Date.now() - startTime;

    const index: ProjectIndex = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      projectName: 'Edison Smart Levels Trading Bot',
      projectPath: this.projectPath,
      statistics: {
        totalFiles: files.length,
        totalModules: documents.length,
        totalLines: countProjectIndexerLines(documents),
        categories: countProjectIndexerDocumentsByCategory(documents),
      },
      documents,
      lastIndexUpdate: new Date().toISOString(),
    };

    console.log(`${ICONS.success} Indexing complete in ${elapsedTime}ms`);
    console.log(`${ICONS.chart_up} Statistics:`, index.statistics);

    return index;
  }

  /**
   * Find all TypeScript files
   */
  private async findFiles(): Promise<string[]> {
    try {
      const files = await glob(createProjectIndexerGlobPattern(this.projectPath), {
        ignore: createProjectIndexerIgnorePatterns(
          this.projectPath,
          this.config.excludePatterns,
        ),
      });
      return files;
    } catch (error) {
      console.error('Error finding files:', error);
      return [];
    }
  }

  /**
   * Analyze single file
   */
  private async analyzeFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return analyzeProjectIndexerFile(this.projectPath, filePath, content);
  }
}
