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
});
