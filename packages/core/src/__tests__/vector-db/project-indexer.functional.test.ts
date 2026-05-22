import { ProjectIndexer } from '../../vector-db/project-indexer';

describe('ProjectIndexer functional behavior', () => {
  test('indexes readable files, skips broken files, and builds aggregate statistics through injected runtime dependencies', async () => {
    const logger = {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };
    const readFile = jest.fn((filePath: string) => {
      if (filePath.endsWith('broken.service.ts')) {
        throw new Error('broken file');
      }

      if (filePath.endsWith('logger.service.ts')) {
        return `/**
 * Writes logs
 */
export class LoggerService {
  write() {
    return true;
  }
}`;
      }

      return `export class EntrySignalService {
  async collectSignals() {
    return [];
  }
}`;
    });

    const indexer = new ProjectIndexer(
      'D:/repo',
      undefined,
      {
        clock: () => new Date('2026-05-22T00:00:00.000Z'),
        globFiles: async () => [
          'D:/repo/packages/core/src/services/logger.service.ts',
          'D:/repo/packages/core/src/services/broken.service.ts',
          'D:/repo/packages/core/src/services/entry-signal.service.ts',
        ],
        logger,
        readFile,
      },
    );

    const index = await indexer.indexProject();

    expect(index.documents).toHaveLength(2);
    expect(index.statistics).toMatchObject({
      totalFiles: 3,
      totalModules: 2,
      categories: {
        service: 2,
      },
    });
    expect(index.documents.map((document) => document.name)).toEqual([
      'LoggerService',
      'EntrySignalService',
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to analyze D:/repo/packages/core/src/services/broken.service.ts:'),
      'broken file',
    );
  });
});
