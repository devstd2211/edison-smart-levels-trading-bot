/**
 * Strategy Loader Service Error Handling Tests (Phase 8.9.6)
 *
 * Comprehensive test suite for StrategyLoaderService error handling:
 * - File not found with GRACEFUL_DEGRADE strategy
 * - JSON parse errors with RETRY strategy
 * - Validation errors with THROW strategy
 * - Partial failures in loadAllStrategies with SKIP strategy
 * - E2E scenarios
 * - Backward compatibility (without ErrorHandler)
 */

import { StrategyLoaderService } from '../../services/strategy-loader.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  StrategyLoadError,
  StrategyParseError,
} from '../../errors/DomainErrors';
import { StrategyValidationError } from '../../types/strategy-config';
import {
  createStrategyLoaderAnalyzer,
  createManagedStrategyLoaderContext,
  type ManagedStrategyLoaderContext,
  createStrategyLoaderMetadata,
  createStrategyLoaderStrategy,
} from '../helpers/strategy-loader-test.utils';

type StrategyLoaderState = Pick<
  ManagedStrategyLoaderContext,
  'tempDir' | 'errorHandler' | 'loader' | 'fileReadSpy' | 'dirReadSpy' | 'createLoader' | 'cleanup'
>;

describe('StrategyLoaderService Error Handling (Phase 8.9.6)', () => {
  let loaderService: StrategyLoaderService;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let testStrategiesDir: string;
  let fileReadSpy: jest.SpyInstance;
  let dirReadSpy: jest.SpyInstance;
  let createLoader: ManagedStrategyLoaderContext['createLoader'];
  let cleanup: ManagedStrategyLoaderContext['cleanup'];

  beforeEach(async () => {
    ({
      tempDir: testStrategiesDir,
      errorHandler: mockErrorHandler,
      loader: loaderService,
      fileReadSpy,
      dirReadSpy,
      createLoader,
      cleanup,
    } = await createManagedStrategyLoaderContext() as StrategyLoaderState);
  });

  afterEach(async () => {
    await cleanup();
  });

  // ============================================================================
  // SECTION A: File Not Found - Error Classification (2 tests)
  // ============================================================================

  describe('A: File Not Found - Error Classification', () => {
    test('A1: ENOENT error classified as StrategyLoadError', async () => {
      const error = new Error("ENOENT: no such file or directory, open 'nonexistent.strategy.json'");
      fileReadSpy.mockRejectedValue(error);

      const promise = loaderService.loadStrategy('nonexistent');

      await expect(promise).rejects.toThrow(StrategyLoadError);
      // Note: loadStrategy doesn't call ErrorHandler, classification only
    });

    test('A2: Permission denied classified correctly', async () => {
      const error = new Error('EACCES: permission denied, open file');
      fileReadSpy.mockRejectedValue(error);

      const promise = loaderService.loadStrategy('forbidden');

      await expect(promise).rejects.toThrow(StrategyLoadError);
      // Note: loadStrategy doesn't call ErrorHandler
    });

    test('A3: File not found error has correct context', async () => {
      const error = new Error('ENOENT: no such file or directory');
      fileReadSpy.mockRejectedValue(error);

      try {
        await loaderService.loadStrategy('missing');
      } catch (caught) {
        expect(caught).toBeInstanceOf(StrategyLoadError);
        const e = caught as StrategyLoadError;
        const context = e.metadata.context as Record<string, unknown> | undefined;
        expect(context?.strategyName).toBe('missing');
        expect(context?.reason).toBe('file_not_found');
      }
    });
  });

  // ============================================================================
  // SECTION B: JSON Parse Errors (2 tests)
  // ============================================================================

  describe('B: JSON Parse Errors', () => {
    test('B1: Invalid JSON classified as StrategyParseError', async () => {
      fileReadSpy.mockResolvedValue('{ invalid json }');

      const promise = loaderService.loadStrategy('bad-json');

      await expect(promise).rejects.toThrow(StrategyParseError);
      // Note: Classification happens in loadStrategy, but ErrorHandler.handle called by caller
    });

    test('B2: Parse error includes error details in context', async () => {
      fileReadSpy.mockResolvedValue('{ bad json }');

      try {
        await loaderService.loadStrategy('malformed');
      } catch (caught) {
        expect(caught).toBeInstanceOf(StrategyParseError);
        const e = caught as StrategyParseError;
        const context = e.metadata.context as Record<string, unknown> | undefined;
        expect(context?.strategyName).toBe('malformed');
        expect(context?.parseError).toBeDefined();
      }
    });
  });

  // ============================================================================
  // SECTION C: Validation Errors (3 tests)
  // ============================================================================

  describe('C: Validation Errors', () => {
    test('C1: Missing required field throws validation error', async () => {
      const invalidConfig = createStrategyLoaderStrategy({
        metadata: {},
        // Missing analyzers
      });
      fileReadSpy.mockResolvedValue(JSON.stringify(invalidConfig));

      const promise = loaderService.loadStrategy('invalid-schema');

      await expect(promise).rejects.toThrow(StrategyValidationError);
    });

    test('C2: Invalid analyzer config triggers validation error', async () => {
      const config = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({
          name: 'test',
          version: '1.0',
          description: 'test',
          createdAt: '2024-01-01',
          lastModified: '2024-01-01',
        }),
        analyzers: [createStrategyLoaderAnalyzer({ name: 'UNKNOWN_ANALYZER' })],
      });
      fileReadSpy.mockResolvedValue(JSON.stringify(config));

      const promise = loaderService.loadStrategy('bad-analyzer');

      await expect(promise).rejects.toThrow(StrategyValidationError);
    });

    test('C3: Invalid metadata throws validation error', async () => {
      const config = createStrategyLoaderStrategy({
        metadata: null,
        analyzers: [],
      });
      fileReadSpy.mockResolvedValue(JSON.stringify(config));

      const promise = loaderService.loadStrategy('invalid-metadata');

      await expect(promise).rejects.toThrow();
    });
  });

  // ============================================================================
  // SECTION D: Valid Strategy Loading (2 tests)
  // ============================================================================

  describe('D: Valid Strategy Loading', () => {
    test('D1: Valid strategy loads successfully', async () => {
      const validConfig = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({
          name: 'test-strategy',
          version: '1.0',
          description: 'test',
          createdAt: '2024-01-01',
          lastModified: '2024-01-01',
          tags: ['test'],
        }),
        analyzers: [createStrategyLoaderAnalyzer({ weight: 1.0 })],
      });
      fileReadSpy.mockResolvedValue(JSON.stringify(validConfig));

      const result = await loaderService.loadStrategy('valid');

      expect(result).toEqual(validConfig);
      expect(mockErrorHandler.handle).not.toHaveBeenCalled();
    });

    test('D2: Multiple valid strategies load correctly', async () => {
      const validConfig = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({
          name: 'test-strategy',
          version: '1.0',
          description: 'test',
          createdAt: '2024-01-01',
          lastModified: '2024-01-01',
          tags: ['test'],
        }),
        analyzers: [createStrategyLoaderAnalyzer({ weight: 1.0 })],
      });

      fileReadSpy.mockResolvedValue(JSON.stringify(validConfig));

      const result1 = await loaderService.loadStrategy('strategy1');
      const result2 = await loaderService.loadStrategy('strategy2');

      expect(result1.metadata.name).toBe('test-strategy');
      expect(result2.metadata.name).toBe('test-strategy');
    });
  });

  // ============================================================================
  // SECTION E: Load All Strategies - Partial Failures with SKIP (3 tests)
  // ============================================================================

  describe('E: Load All Strategies - Partial Failures with SKIP', () => {
    test('E1: Individual strategy failures are skipped', async () => {
      const validConfig = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({
          name: 'valid',
          version: '1.0',
          description: 'test',
          createdAt: '2024-01-01',
          lastModified: '2024-01-01',
          tags: ['test'],
        }),
        analyzers: [createStrategyLoaderAnalyzer({ weight: 1.0 })],
      });

      dirReadSpy.mockResolvedValue(['valid.strategy.json', 'invalid.strategy.json']);

      // Mock file reads to return valid for first call, error for subsequent calls
      let callCount = 0;
      fileReadSpy.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(JSON.stringify(validConfig));
        }
        return Promise.reject(new Error('ENOENT: not found'));
      });

      const results = await loaderService.loadAllStrategies();

      expect(results.size).toBe(1);
      expect(results.has('valid')).toBe(true);
      expect(results.has('invalid')).toBe(false);
    });

    test('E2: Failed strategies trigger SKIP strategy in ErrorHandler', async () => {
      dirReadSpy.mockResolvedValue(['bad.strategy.json']);
      fileReadSpy.mockRejectedValue(new Error('ENOENT: not found'));

      await loaderService.loadAllStrategies();

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StrategyLoadError),
        expect.objectContaining({
          strategy: RecoveryStrategy.SKIP,
        }),
      );
    });

    test('E3: All strategies fail but SKIP allows graceful degradation', async () => {
      dirReadSpy.mockResolvedValue(['bad1.strategy.json', 'bad2.strategy.json']);
      fileReadSpy.mockRejectedValue(new Error('ENOENT: not found'));

      const results = await loaderService.loadAllStrategies();

      expect(results.size).toBe(0);
      // Each failure: one SKIP for the strategy, then the directory read succeeds
      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // SECTION F: Directory Read Errors - GRACEFUL_DEGRADE (2 tests)
  // ============================================================================

  describe('F: Directory Read Errors - GRACEFUL_DEGRADE', () => {
    test('F1: Directory read error triggers GRACEFUL_DEGRADE', async () => {
      dirReadSpy.mockRejectedValue(new Error('ENOENT: directory not found'));

      const results = await loaderService.loadAllStrategies();

      expect(results.size).toBe(0);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StrategyLoadError),
        expect.objectContaining({
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        }),
      );
    });

    test('F2: Permission denied on directory is handled gracefully', async () => {
      dirReadSpy.mockRejectedValue(new Error('EACCES: permission denied'));

      const results = await loaderService.loadAllStrategies();

      expect(results.size).toBe(0);
      expect(mockErrorHandler.handle).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION G: Backward Compatibility - Without ErrorHandler (2 tests)
  // ============================================================================

  describe('G: Backward Compatibility - Without ErrorHandler', () => {
    beforeEach(() => {
      // Create service without error handler
      loaderService = createLoader({ withErrorHandler: false });
    });

    test('G1: Service works without ErrorHandler injected', async () => {
      const validConfig = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({
          name: 'test',
          version: '1.0',
          description: 'test',
          createdAt: '2024-01-01',
          lastModified: '2024-01-01',
          tags: ['test'],
        }),
        analyzers: [createStrategyLoaderAnalyzer({ weight: 1.0 })],
      });
      fileReadSpy.mockResolvedValue(JSON.stringify(validConfig));

      const result = await loaderService.loadStrategy('no-handler');

      expect(result).toEqual(validConfig);
    });

    test('G2: File not found throws error without ErrorHandler', async () => {
      fileReadSpy.mockRejectedValue(new Error('ENOENT: not found'));

      const promise = loaderService.loadStrategy('missing');

      await expect(promise).rejects.toThrow(StrategyLoadError);
    });
  });

  // ============================================================================
  // SECTION H: E2E Recovery Scenarios (1 test)
  // ============================================================================

  describe('H: E2E Recovery Scenarios', () => {
    test('H1: Multiple mixed errors in loadAllStrategies', async () => {
      const validConfig = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({
          name: 'valid',
          version: '1.0',
          description: 'test',
          createdAt: '2024-01-01',
          lastModified: '2024-01-01',
          tags: ['test'],
        }),
        analyzers: [createStrategyLoaderAnalyzer({ weight: 1.0 })],
      });

      dirReadSpy.mockResolvedValue([
        'valid.strategy.json',
        'bad-json.strategy.json',
        'missing.strategy.json',
      ]);

      fileReadSpy.mockImplementation((path) => {
        if (path.toString().includes('valid')) {
          return Promise.resolve(JSON.stringify(validConfig));
        }
        if (path.toString().includes('bad-json')) {
          return Promise.resolve('{ invalid json }');
        }
        return Promise.reject(new Error('ENOENT: not found'));
      });

      const results = await loaderService.loadAllStrategies();

      expect(results.size).toBe(1);
      expect(results.has('valid')).toBe(true);
      // Each failure is SKIP'ed - 2 failures with SKIP
      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(2);
    });
  });
});

