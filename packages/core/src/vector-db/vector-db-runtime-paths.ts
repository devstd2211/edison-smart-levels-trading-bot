import * as path from 'path';

export const DEFAULT_VECTOR_DB_PATH = './vector-db.sqlite';
export const DEFAULT_VECTOR_INDEX_PATH = './.vector-db/index.json';

export interface VectorDbRuntimePaths {
  projectPath: string;
  dbPath: string;
  indexPath: string;
}

const resolveProjectPath = (projectPath: string): string => path.resolve(projectPath);

const resolveProjectFilePath = (projectPath: string, filePath: string): string =>
  path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);

export const resolveVectorDbRuntimePaths = (
  projectPath: string = process.cwd(),
  dbPath: string = DEFAULT_VECTOR_DB_PATH,
  indexPath: string = DEFAULT_VECTOR_INDEX_PATH,
): VectorDbRuntimePaths => {
  const resolvedProjectPath = resolveProjectPath(projectPath);

  return {
    projectPath: resolvedProjectPath,
    dbPath: resolveProjectFilePath(resolvedProjectPath, dbPath),
    indexPath: resolveProjectFilePath(resolvedProjectPath, indexPath),
  };
};
