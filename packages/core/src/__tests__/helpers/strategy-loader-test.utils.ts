import { ErrorHandler, ErrorHandlingResult, RecoveryStrategy } from '../../errors/ErrorHandler';
import { StrategyLoaderService } from '../../services/strategy-loader.service';

type StrategyLoaderHarness = {
  service: StrategyLoaderService;
  errorHandler: jest.Mocked<ErrorHandler>;
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
  };
}
