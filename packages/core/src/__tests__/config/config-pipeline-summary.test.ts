import fs from 'fs';
import path from 'path';
import {
  buildStrategyAnalyzerSummaryLines,
  buildStrategyIndicatorSummaryLines,
  buildStrategyMergeSummaryLines,
  buildStrategyMetadataSummaryLines,
} from '../../config/config-pipeline-summary';

describe('config pipeline summary helpers', () => {
  test('metadata and merge summary helpers keep strategy selection output explicit', () => {
    expect(
      buildStrategyMetadataSummaryLines('momentum', 'strategies/json/momentum.strategy.json', {
        metadata: {
          name: 'Momentum',
          version: '1.0.0',
          description: 'Trend following',
          createdAt: '2026-05-22T00:00:00.000Z',
          lastModified: '2026-05-22T00:00:00.000Z',
          tags: ['trend'],
        },
      }),
    ).toEqual([
      expect.stringContaining('Loading strategy: momentum'),
      expect.stringContaining('File: strategies/json/momentum.strategy.json'),
      expect.stringContaining('Name: Momentum v1.0.0'),
      expect.stringContaining('Description: Trend following'),
    ]);

    expect(buildStrategyMergeSummaryLines(2)).toEqual([
      expect.stringContaining('2 config overrides applied'),
    ]);
  });

  test('metadata helper omits description line when strategy has no description', () => {
    const lines = buildStrategyMetadataSummaryLines('raw', 'strategies/json/raw.strategy.json', {});

    expect(lines).toEqual([
      expect.stringContaining('Loading strategy: raw'),
      expect.stringContaining('File: strategies/json/raw.strategy.json'),
    ]);
    expect(lines.some((l) => l.includes('Description'))).toBe(false);
  });

  test('analyzer summary helper groups enabled analyzers and prints the top weights', () => {
    const lines = buildStrategyAnalyzerSummaryLines([
      { name: 'ema', enabled: true, weight: 0.6, priority: 1 },
      { name: 'rsi', enabled: true, weight: 0.2, priority: 2 },
      { name: 'volume', enabled: false, weight: 0.1, priority: 3 },
    ]);

    expect(lines).toEqual(
      expect.arrayContaining([
        expect.stringContaining('STRATEGY ANALYZERS (3 total):'),
        expect.stringContaining('Enabled: 2'),
        expect.stringContaining('60.0%: 1 analyzers'),
        expect.stringContaining('20.0%: 1 analyzers'),
        expect.stringContaining('ema: 60.00% weight (priority=1)'),
      ]),
    );
  });

  test('analyzer summary helper returns empty array for empty or undefined input', () => {
    expect(buildStrategyAnalyzerSummaryLines([])).toEqual([]);
    expect(buildStrategyAnalyzerSummaryLines()).toEqual([]);
  });

  test('indicator summary helper formats concise indicator details without arrow delimiters', () => {
    const lines = buildStrategyIndicatorSummaryLines({
      ema: { period: 20 },
      macd: { fastPeriod: 12, slowPeriod: 26 },
    });

    expect(lines).toEqual(
      expect.arrayContaining(['   - ema: period=20', '   - macd: fast=12, slow=26']),
    );
    expect(lines.join(' ')).not.toContain(' -> ');
  });

  test('indicator summary helper formats stochastic and bollinger detail paths', () => {
    const lines = buildStrategyIndicatorSummaryLines({
      stochastic: { kPeriod: 14, dPeriod: 3 },
      bollinger: { stdDev: 2 },
    });

    expect(lines).toEqual(
      expect.arrayContaining([
        '   - stochastic: k=14, d=3',
        '   - bollinger: stdDev=2',
      ]),
    );
  });

  test('indicator summary helper returns empty array for empty or undefined input', () => {
    expect(buildStrategyIndicatorSummaryLines({})).toEqual([]);
    expect(buildStrategyIndicatorSummaryLines(undefined)).toEqual([]);
  });

  test('StrategyIndicatorConfig is exported from the summary module boundary', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../config/config-pipeline-summary.ts'),
      'utf8',
    );

    expect(source).toContain('export type StrategyIndicatorConfig');
  });
});
