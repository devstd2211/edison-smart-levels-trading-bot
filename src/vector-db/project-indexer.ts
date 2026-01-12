/**
 * Project Indexer
 * Scans the Edison codebase and creates embeddings for all modules/files
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { EmbeddedDocument, ProjectIndex, IndexConfig } from './vector-db.types';

interface FileAnalysis {
  filePath: string;
  type: 'file' | 'module' | 'class' | 'function' | 'service' | 'analyzer' | 'indicator';
  name: string;
  category: string;
  description: string;
  keywords: string[];
  content: string;
  size: number;
}

export class ProjectIndexer {
  private projectPath: string;
  private config: IndexConfig;

  private readonly MODULE_CATEGORIES: Record<string, string> = {
    'indicators/': 'indicator',
    'analyzers/': 'analyzer',
    'services/': 'service',
    'orchestrators/': 'orchestrator',
    'types/': 'type',
    'utils/': 'utility',
    'filters/': 'filter',
    'backtest/': 'backtest',
    'strategies/': 'strategy',
    '__tests__/': 'test',
  };

  private readonly DEFAULT_CONFIG: IndexConfig = {
    excludePatterns: ['node_modules', 'dist', '.git', '__tests__'],
    includePatterns: ['**/*.ts'],
    maxFileSize: 500000, // 500KB
    scanDepth: 10,
  };

  constructor(projectPath: string, config?: IndexConfig) {
    this.projectPath = projectPath;
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Index entire project
   */
  async indexProject(): Promise<ProjectIndex> {
    const startTime = Date.now();
    const documents: EmbeddedDocument[] = [];

    // Get all TypeScript files
    const files = await this.findFiles();

    console.log(`\n📊 Indexing Project...`);
    console.log(`Found ${files.length} files to analyze`);

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      try {
        const analysis = await this.analyzeFile(filePath);
        const doc = this.createDocument(analysis);
        documents.push(doc);

        if ((i + 1) % 50 === 0) {
          console.log(`  Progress: ${i + 1}/${files.length}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to analyze ${filePath}:`, (error as Error).message);
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
        totalLines: this.countLines(documents),
        categories: this.countByCategory(documents),
      },
      documents,
      lastIndexUpdate: new Date().toISOString(),
    };

    console.log(`✅ Indexing complete in ${elapsedTime}ms`);
    console.log(`📈 Statistics:`, index.statistics);

    return index;
  }

  /**
   * Find all TypeScript files
   */
  private async findFiles(): Promise<string[]> {
    try {
      const globPattern = path.join(this.projectPath, 'src/**/*.ts').replace(/\\/g, '/');
      const ignorePatterns = (this.config.excludePatterns?.map((p) => path.join(this.projectPath, p).replace(/\\/g, '/')) || []);

      const files = await glob(globPattern, {
        ignore: ignorePatterns,
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
  private async analyzeFile(filePath: string): Promise<FileAnalysis> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const relativeFilePath = path.relative(this.projectPath, filePath);

    // Determine category
    const category = this.determineCategory(relativeFilePath);

    // Extract metadata
    const name = this.extractName(filePath, content);
    const description = this.extractDescription(content);
    const keywords = this.extractKeywords(content, name);

    return {
      filePath: relativeFilePath,
      type: this.determineType(fileName),
      name,
      category,
      description,
      keywords,
      content: content.substring(0, 10000), // Limit content size
      size: content.length,
    };
  }

  /**
   * Determine file category
   */
  private determineCategory(filePath: string): string {
    for (const [pattern, category] of Object.entries(this.MODULE_CATEGORIES)) {
      if (filePath.includes(pattern)) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Determine document type
   */
  private determineType(
    fileName: string
  ): 'file' | 'module' | 'class' | 'function' | 'service' | 'analyzer' | 'indicator' {
    if (fileName.includes('indicator')) return 'indicator';
    if (fileName.includes('analyzer')) return 'analyzer';
    if (fileName.includes('service') || fileName.includes('orchestrator')) return 'service';
    if (fileName.includes('test')) return 'file';
    return 'file';
  }

  /**
   * Extract name from file
   */
  private extractName(filePath: string, content: string): string {
    const fileName = path.basename(filePath);

    // Try to extract class name
    const classMatch = content.match(/export\s+class\s+(\w+)/);
    if (classMatch) {
      return classMatch[1];
    }

    // Try to extract interface name
    const interfaceMatch = content.match(/export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      return interfaceMatch[1];
    }

    // Use filename without extension
    return fileName.replace(/\.(ts|js)$/, '').replace(/[-_]/g, ' ');
  }

  /**
   * Extract description from JSDoc or content
   */
  private extractDescription(content: string): string {
    // Look for JSDoc description
    const jsdocMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\n\s*\*/s);
    if (jsdocMatch) {
      return jsdocMatch[1].trim();
    }

    // Look for first comment
    const commentMatch = content.match(/\/\/\s*(.+)/);
    if (commentMatch) {
      return commentMatch[1].trim();
    }

    // Extract from class/interface doc
    const docMatch = content.match(/export\s+(?:class|interface)\s+\w+[^{]*{/);
    if (docMatch) {
      // Get preceding comment if exists
      const precedingComment = content.substring(0, docMatch.index || 0);
      const lastComment = precedingComment.match(/\/\/\s*(.+?)$/m);
      if (lastComment) {
        return lastComment[1].trim();
      }
    }

    return '';
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string, name: string): string[] {
    const keywords = new Set<string>();

    // Add name parts
    const nameParts = name.split(/[_\s-]/);
    nameParts.forEach((part) => {
      if (part.length > 3) keywords.add(part.toLowerCase());
    });

    // Extract imports
    const importMatches = content.matchAll(/from\s+['"](.*?)['"]/g);
    for (const match of importMatches) {
      const imported = match[1];
      const baseName = path.basename(imported).split('.')[0];
      if (baseName.length > 3) {
        keywords.add(baseName.toLowerCase());
      }
    }

    // Extract method names
    const methodMatches = content.matchAll(/^\s*(?:public|private)?\s*(\w+)\s*\(/gm);
    for (const match of methodMatches) {
      const method = match[1];
      if (method.length > 3 && method !== 'constructor') {
        keywords.add(method.toLowerCase());
      }
    }

    // Extract key terms
    const keyTerms = ['analyzer', 'indicator', 'service', 'signal', 'candle', 'position', 'order', 'risk', 'filter', 'trading', 'orchestrator'];
    content.toLowerCase().split(/\s+/).forEach((word) => {
      if (keyTerms.some((term) => word.includes(term))) {
        keywords.add(word.toLowerCase());
      }
    });

    return Array.from(keywords).slice(0, 20); // Limit to 20 keywords
  }

  /**
   * Create EmbeddedDocument from analysis
   */
  private createDocument(analysis: FileAnalysis): EmbeddedDocument {
    return {
      id: analysis.filePath.replace(/\\/g, '/'),
      type: analysis.type,
      filePath: analysis.filePath,
      name: analysis.name,
      description: analysis.description,
      category: analysis.category,
      tags: this.generateTags(analysis),
      content: analysis.content,
      keywords: analysis.keywords,
      size: analysis.size,
      lastUpdated: new Date().toISOString(),
      relatedModules: [], // Will be populated later
    };
  }

  /**
   * Generate tags for document
   */
  private generateTags(analysis: FileAnalysis): string[] {
    const tags = new Set<string>();

    // Add category as tag
    tags.add(analysis.category);

    // Add type-based tags
    if (analysis.content.includes('@deprecated')) tags.add('deprecated');
    if (analysis.content.includes('TODO')) tags.add('todo');
    if (analysis.content.includes('FIXME')) tags.add('fixme');
    if (analysis.content.includes('new[]')) tags.add('array-operations');
    if (analysis.content.includes('async')) tags.add('async');

    // Add feature tags
    if (analysis.content.includes('Entry')) tags.add('entry');
    if (analysis.content.includes('Exit')) tags.add('exit');
    if (analysis.content.includes('Signal')) tags.add('signal');
    if (analysis.content.includes('Risk')) tags.add('risk-management');
    if (analysis.content.includes('Position')) tags.add('position-management');
    if (analysis.content.includes('OrderBook')) tags.add('orderbook');

    return Array.from(tags);
  }

  /**
   * Count total lines
   */
  private countLines(documents: EmbeddedDocument[]): number {
    let total = 0;
    documents.forEach((doc) => {
      total += doc.content.split('\n').length;
    });
    return total;
  }

  /**
   * Count documents by category
   */
  private countByCategory(documents: EmbeddedDocument[]): Record<string, number> {
    const counts: Record<string, number> = {};
    documents.forEach((doc) => {
      counts[doc.category] = (counts[doc.category] || 0) + 1;
    });
    return counts;
  }
}
