import type { EmbeddedDocument, IndexConfig, ProjectIndex } from './vector-db.types';
import {
  countProjectIndexerDocumentsByCategory,
  countProjectIndexerLines,
} from './project-indexer-analysis';

type ProjectIndexerLogger = Pick<Console, 'error' | 'log' | 'warn'>;

type ProjectIndexerGlob = (
  pattern: string,
  options: { ignore: string[] },
) => Promise<string[]>;

type ProjectIndexerReadFile = (filePath: string, encoding: BufferEncoding) => string;

type AnalyzeProjectIndexerFile = (filePath: string) => Promise<EmbeddedDocument>;

type FindProjectIndexerFilesOptions = {
  config: IndexConfig;
  createGlobPattern: (projectPath: string) => string;
  createIgnorePatterns: (projectPath: string, excludePatterns?: string[]) => string[];
  globFiles: ProjectIndexerGlob;
  logger: ProjectIndexerLogger;
  projectPath: string;
};

type AnalyzeProjectIndexerFilesOptions = {
  analyzeFile: AnalyzeProjectIndexerFile;
  filePaths: string[];
  logger: ProjectIndexerLogger;
  progressInterval?: number;
  icons: {
    warning: string;
  };
};

type BuildProjectIndexOptions = {
  clock?: () => Date;
  documents: EmbeddedDocument[];
  elapsedTimeMs: number;
  fileCount: number;
  logger: Pick<ProjectIndexerLogger, 'log'>;
  projectName: string;
  projectPath: string;
  icons: {
    chart_up: string;
    success: string;
  };
};

export type ProjectIndexerDependencies = {
  clock?: () => Date;
  globFiles?: ProjectIndexerGlob;
  logger?: ProjectIndexerLogger;
  readFile?: ProjectIndexerReadFile;
};

export const findProjectIndexerFiles = async ({
  config,
  createGlobPattern,
  createIgnorePatterns,
  globFiles,
  logger,
  projectPath,
}: FindProjectIndexerFilesOptions): Promise<string[]> => {
  try {
    return await globFiles(createGlobPattern(projectPath), {
      ignore: createIgnorePatterns(projectPath, config.excludePatterns),
    });
  } catch (error) {
    logger.error('Error finding files:', error);
    return [];
  }
};

export const analyzeProjectIndexerFiles = async ({
  analyzeFile,
  filePaths,
  logger,
  progressInterval = 50,
  icons,
}: AnalyzeProjectIndexerFilesOptions): Promise<EmbeddedDocument[]> => {
  const documents: EmbeddedDocument[] = [];

  for (let index = 0; index < filePaths.length; index++) {
    const filePath = filePaths[index];

    try {
      documents.push(await analyzeFile(filePath));

      if ((index + 1) % progressInterval === 0) {
        logger.log(`  Progress: ${index + 1}/${filePaths.length}`);
      }
    } catch (error) {
      logger.warn(`${icons.warning} Failed to analyze ${filePath}:`, (error as Error).message);
    }
  }

  return documents;
};

export const readProjectIndexerFile = (
  filePath: string,
  readFile: ProjectIndexerReadFile,
): string => readFile(filePath, 'utf-8');

export const buildProjectIndex = ({
  clock = () => new Date(),
  documents,
  elapsedTimeMs,
  fileCount,
  logger,
  projectName,
  projectPath,
  icons,
}: BuildProjectIndexOptions): ProjectIndex => {
  const timestamp = clock().toISOString();
  const index: ProjectIndex = {
    version: '1.0',
    generatedAt: timestamp,
    projectName,
    projectPath,
    statistics: {
      totalFiles: fileCount,
      totalModules: documents.length,
      totalLines: countProjectIndexerLines(documents),
      categories: countProjectIndexerDocumentsByCategory(documents),
    },
    documents,
    lastIndexUpdate: timestamp,
  };

  logger.log(`${icons.success} Indexing complete in ${elapsedTimeMs}ms`);
  logger.log(`${icons.chart_up} Statistics:`, index.statistics);

  return index;
};
