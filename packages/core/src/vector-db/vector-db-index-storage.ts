import * as fs from 'fs';
import * as path from 'path';
import type { ProjectIndex } from './vector-db.types';

const ensureDirectory = (filePath: string): void => {
  const directoryPath = path.dirname(filePath);
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
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
