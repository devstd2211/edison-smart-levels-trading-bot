import * as path from 'path';
import type { IndexConfig } from './vector-db.types';

export const PROJECT_INDEXER_MODULE_CATEGORIES: Record<string, string> = {
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

export const PROJECT_INDEXER_DEFAULT_CONFIG: IndexConfig = {
  excludePatterns: ['node_modules', 'dist', '.git', '__tests__'],
  includePatterns: ['**/*.ts'],
  maxFileSize: 500000,
  scanDepth: 10,
};

export const createProjectIndexerGlobPattern = (projectPath: string): string =>
  path.join(projectPath, 'packages/core/src/**/*.ts').replace(/\\/g, '/');

export const createProjectIndexerIgnorePatterns = (
  projectPath: string,
  excludePatterns: string[] = [],
): string[] =>
  excludePatterns.map((pattern) => path.join(projectPath, pattern).replace(/\\/g, '/'));

export const determineProjectIndexerCategory = (filePath: string): string => {
  const normalizedFilePath = filePath.replace(/\\/g, '/');

  for (const [pattern, category] of Object.entries(PROJECT_INDEXER_MODULE_CATEGORIES)) {
    if (normalizedFilePath.includes(pattern)) {
      return category;
    }
  }

  return 'other';
};

export const determineProjectIndexerDocumentType = (
  fileName: string,
): 'file' | 'module' | 'class' | 'function' | 'service' | 'analyzer' | 'indicator' => {
  if (fileName.includes('indicator')) {
    return 'indicator';
  }
  if (fileName.includes('analyzer')) {
    return 'analyzer';
  }
  if (fileName.includes('service') || fileName.includes('orchestrator')) {
    return 'service';
  }

  return 'file';
};
