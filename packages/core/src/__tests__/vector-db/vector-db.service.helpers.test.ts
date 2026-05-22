import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEFAULT_VECTOR_DB_PATH,
  DEFAULT_VECTOR_INDEX_PATH,
  resolveVectorDbRuntimePaths,
} from '../../vector-db/vector-db-runtime-paths';
import {
  hasStoredProjectIndex,
  loadStoredProjectIndex,
  saveStoredProjectIndex,
} from '../../vector-db/vector-db-index-storage';
import type { ProjectIndex } from '../../vector-db/vector-db.types';

describe('vector-db service helpers', () => {
  test('resolveVectorDbRuntimePaths resolves relative db and index paths from the project root', () => {
    expect(
      resolveVectorDbRuntimePaths('D:/repo', DEFAULT_VECTOR_DB_PATH, DEFAULT_VECTOR_INDEX_PATH),
    ).toEqual({
      projectPath: path.resolve('D:/repo'),
      dbPath: path.join(path.resolve('D:/repo'), 'vector-db.sqlite'),
      indexPath: path.join(path.resolve('D:/repo'), '.vector-db/index.json'),
    });
  });

  test('resolveVectorDbRuntimePaths preserves explicit absolute storage paths', () => {
    expect(
      resolveVectorDbRuntimePaths('D:/repo', 'C:/data/vector.sqlite', 'C:/data/index.json'),
    ).toEqual({
      projectPath: path.resolve('D:/repo'),
      dbPath: 'C:/data/vector.sqlite',
      indexPath: 'C:/data/index.json',
    });
  });

  test('saveStoredProjectIndex creates the parent directory and round-trips stored data', () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-db-index-'));
    const indexPath = path.join(tempDirectory, '.vector-db', 'index.json');
    const index: ProjectIndex = {
      version: '1.0',
      generatedAt: '2026-05-22T00:00:00.000Z',
      projectName: 'Edison',
      projectPath: 'D:/repo',
      statistics: {
        totalFiles: 1,
        totalModules: 1,
        totalLines: 10,
        categories: {
          service: 1,
        },
      },
      documents: [],
      lastIndexUpdate: '2026-05-22T00:00:00.000Z',
    };

    saveStoredProjectIndex(indexPath, index);

    expect(hasStoredProjectIndex(indexPath)).toBe(true);
    expect(loadStoredProjectIndex(indexPath)).toEqual(index);

    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });
});
