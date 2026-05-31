import * as fs from 'fs';
import * as path from 'path';
import type { ProjectIndex } from './vector-db.types';

type VectorDbFileSystem = Pick<
  typeof fs,
  'existsSync' | 'mkdirSync' | 'readFileSync' | 'writeFileSync'
>;

export interface VectorDbIndexStorage {
  hasStoredProjectIndex(): boolean;
  loadStoredProjectIndex(): ProjectIndex;
  saveStoredProjectIndex(index: ProjectIndex): void;
  exportStoredProjectIndex(): string;
}

const ensureDirectory = (filePath: string): void => {
  const directoryPath = path.dirname(filePath);
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

const createEnsureDirectory = (
  filePath: string,
  fileSystem: VectorDbFileSystem,
): (() => void) => {
  const directoryPath = path.dirname(filePath);
  return () => {
    if (!fileSystem.existsSync(directoryPath)) {
      fileSystem.mkdirSync(directoryPath, { recursive: true });
    }
  };
};

export const hasStoredProjectIndex = (indexPath: string): boolean => fs.existsSync(indexPath);

export const saveStoredProjectIndex = (indexPath: string, index: ProjectIndex): void => {
  ensureDirectory(indexPath);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
};

export const loadStoredProjectIndex = (indexPath: string): ProjectIndex => {
  const content = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(content) as ProjectIndex;
};

export const createVectorDbIndexStorage = (
  indexPath: string,
  fileSystem: VectorDbFileSystem = fs,
): VectorDbIndexStorage => {
  const ensureStorageDirectory = createEnsureDirectory(indexPath, fileSystem);

  return {
    hasStoredProjectIndex: () => fileSystem.existsSync(indexPath),
    loadStoredProjectIndex: () =>
      JSON.parse(fileSystem.readFileSync(indexPath, 'utf-8')) as ProjectIndex,
    saveStoredProjectIndex: (index) => {
      ensureStorageDirectory();
      fileSystem.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    },
    exportStoredProjectIndex: () =>
      JSON.stringify(
        JSON.parse(fileSystem.readFileSync(indexPath, 'utf-8')) as ProjectIndex,
        null,
        2,
      ),
  };
};
