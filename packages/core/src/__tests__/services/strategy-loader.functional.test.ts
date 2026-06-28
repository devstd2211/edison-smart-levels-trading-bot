import { StrategyLoaderService } from '../../services/strategy-loader.service';
import { StrategyLoadError } from '../../errors/DomainErrors';
import {
  createManagedStrategyLoaderContext,
  writeStrategyLoaderFile,
  createStrategyLoaderStrategy,
} from '../helpers/strategy-loader-test.utils';

describe('StrategyLoaderService functional', () => {
  it('getAvailableAnalyzers() returns a sorted non-empty array including known names', () => {
    const loader = new StrategyLoaderService('/nonexistent');

    const analyzers = loader.getAvailableAnalyzers();

    expect(analyzers.length).toBeGreaterThan(0);
    expect(analyzers).toContain('ATR_ANALYZER_NEW');
    expect(analyzers).toContain('EMA_ANALYZER_NEW');
    expect(analyzers).toEqual([...analyzers].sort());
  });

  it('loadStrategy() throws StrategyLoadError when the file does not exist', async () => {
    const ctx = await createManagedStrategyLoaderContext({ withErrorHandler: false });

    try {
      await expect(ctx.loader.loadStrategy('nonexistent')).rejects.toThrow(StrategyLoadError);
    } finally {
      await ctx.cleanup();
    }
  });

  it('loadStrategy() returns parsed strategy for a valid file', async () => {
    const ctx = await createManagedStrategyLoaderContext({ withErrorHandler: false });

    try {
      await writeStrategyLoaderFile(ctx.tempDir, 'my-test.strategy.json', createStrategyLoaderStrategy());

      const result = await ctx.loader.loadStrategy('my-test');

      expect(result).toMatchObject({ version: 1 });
      expect(Array.isArray(result.analyzers)).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  it('loadAllStrategies() returns empty Map when directory is empty', async () => {
    const ctx = await createManagedStrategyLoaderContext();

    try {
      const result = await ctx.loader.loadAllStrategies();

      expect(result.size).toBe(0);
    } finally {
      await ctx.cleanup();
    }
  });

  it('loadAllStrategies() skips invalid files and loads valid ones', async () => {
    const ctx = await createManagedStrategyLoaderContext();

    try {
      await writeStrategyLoaderFile(ctx.tempDir, 'valid.strategy.json', createStrategyLoaderStrategy());
      await writeStrategyLoaderFile(ctx.tempDir, 'broken.strategy.json', 'not-json{{{');

      const result = await ctx.loader.loadAllStrategies();

      expect(result.size).toBe(1);
      expect(result.has('valid')).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  describe('export boundary', () => {
    it('StrategyLoaderService is a constructible class', () => {
      expect(typeof StrategyLoaderService).toBe('function');
    });
  });
});
