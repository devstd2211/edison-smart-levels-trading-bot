import { ErrorHandler, ErrorHandlingResult, RecoveryStrategy } from '../../errors/ErrorHandler';
import { StrategyLoaderService } from '../../services/strategy-loader.service';
import { promises as fs } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

type StrategyLoaderHarness = {
  service: StrategyLoaderService;
  errorHandler: jest.Mocked<ErrorHandler>;
  createLoader: (overrides?: Partial<StrategyLoaderOptions>) => StrategyLoaderService;
};

type StrategyLoaderOptions = {
  strategiesDir: string;
  errorHandler?: jest.Mocked<ErrorHandler>;
  withErrorHandler?: boolean;
};

export function createStrategyLoaderErrorHandler(): jest.Mocked<ErrorHandler> {
  return {
    handle: jest.fn(async (_error, options): Promise<ErrorHandlingResult> => ({
      success: true,
      recovered: options.strategy !== RecoveryStrategy.SKIP && options.strategy !== RecoveryStrategy.THROW,
      attempts: 1,
      message: 'Handled successfully',
      strategy: options.strategy,
      error: undefined,
    })),
  } as unknown as jest.Mocked<ErrorHandler>;
}

export function createStrategyLoaderService(options: StrategyLoaderOptions): StrategyLoaderService {
  if (options.withErrorHandler === false) {
    return new StrategyLoaderService(options.strategiesDir);
  }

  return new StrategyLoaderService(
    options.strategiesDir,
    options.errorHandler ?? createStrategyLoaderErrorHandler(),
  );
}

export function createStrategyLoaderHarness(options: StrategyLoaderOptions): StrategyLoaderHarness {
  const errorHandler = options.errorHandler ?? createStrategyLoaderErrorHandler();
  const service = createStrategyLoaderService({
    strategiesDir: options.strategiesDir,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    errorHandler,
    createLoader: (overrides = {}) =>
      createStrategyLoaderService({
        strategiesDir: overrides.strategiesDir ?? options.strategiesDir,
        errorHandler: overrides.errorHandler ?? errorHandler,
        withErrorHandler: overrides.withErrorHandler,
      }),
  };
}

export async function createStrategyLoaderTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'strategy-loader-test-'));
}

export async function cleanupStrategyLoaderTempDir(strategiesDir: string): Promise<void> {
  await rm(strategiesDir, { recursive: true, force: true });
}

export async function writeStrategyLoaderFile(
  strategiesDir: string,
  fileName: string,
  contents: unknown,
): Promise<string> {
  const filePath = join(strategiesDir, fileName);
  await fs.writeFile(
    filePath,
    typeof contents === 'string' ? contents : JSON.stringify(contents),
  );
  return filePath;
}

export function createStrategyLoaderStrategy(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    metadata: {
      name: 'Test Strategy',
      version: '1.0.0',
      description: 'Test',
      createdAt: '2026-01-09T00:00:00Z',
      lastModified: '2026-01-09T00:00:00Z',
      tags: [],
    },
    analyzers: [
      {
        name: 'EMA_ANALYZER_NEW',
        enabled: true,
        weight: 0.5,
        priority: 1,
      },
    ],
    ...overrides,
  };
}
