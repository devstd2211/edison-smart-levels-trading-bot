import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { LoggerService } from '../../logger.service';
import { ConsoleDashboardService } from '../../console-dashboard.service';
import { ErrorHandler } from '../../../errors';
import { BotEventBus } from '../../index';
import { BotMetricsService } from '../../bot-metrics.service';
import { PositionMemoryRepository } from '../../../repositories/position.memory-repository';
import { JournalFileRepository } from '../../../repositories/journal.file-repository';
import { MarketDataCacheRepository } from '../../../repositories/market-data.cache-repository';
import type {
  AnalyzerConfig,
  DashboardConfig,
  IndicatorConfigParams,
  StrategyMeta,
} from './bot-services.types';

export const initializeCoreInfrastructure = (
  state: BotServicesState,
  config: Config,
): void => {
  // 0. Initialize dashboard FIRST to capture early logs
  const dashboardConfig = (config as Partial<{ dashboard: DashboardConfig }>).dashboard || {};
  const dashboardEnabled = dashboardConfig.enabled === true;

  const dashboardTheme: 'dark' | 'light' = dashboardConfig.theme === 'light' ? 'light' : 'dark';
  state.dashboard = new ConsoleDashboardService({
    enabled: dashboardEnabled,
    updateInterval: dashboardConfig.updateInterval || 1000,
    theme: dashboardTheme,
  });
  if (dashboardEnabled) {
    console.log('🎨 Console Dashboard ENABLED');
  }

  // 1. Initialize logger
  state.logger = new LoggerService(
    config.logging.level,
    config.logging.logDir,
    true,
  );

  const logFilePath = state.logger.getLogFilePath();
  if (logFilePath) {
    state.logger.info('📝 Log file', { path: logFilePath });
  }

  // Log loaded strategy file
  const meta = (config as Partial<{ meta: StrategyMeta }>).meta;
  if (meta?.strategy) {
    const strategyFile = meta.strategyFile || `strategies/json/${meta.strategy}.strategy.json`;
    state.logger.info('📋 Strategy loaded', {
      strategy: meta.strategy,
      file: strategyFile,
      notes: meta.notes,
    });
  }

  // CRITICAL: Disable console output when dashboard is enabled
  if (dashboardEnabled) {
    state.logger.setConsoleOutputEnabled(false);
    state.logger.info('📊 Console output disabled - logs to file only (dashboard mode active)');
  }

  // Log strategy analyzer information
  const analyzerList = Array.isArray(config.analyzers)
    ? (config.analyzers as AnalyzerConfig[])
    : [];
  if (analyzerList.length > 0) {
    const enabledAnalyzers = analyzerList.filter((a) => a.enabled);
    state.logger.info(`📊 Strategy Analyzers loaded: ${enabledAnalyzers.length}/${analyzerList.length} enabled`, {
      enabled: enabledAnalyzers.length,
      disabled: analyzerList.length - enabledAnalyzers.length,
      total: analyzerList.length,
    });

    const byWeight = enabledAnalyzers.reduce(
      (acc: Record<string, string[]>, a) => {
        const weightValue = a.weight ?? 0;
        const key = `${(weightValue * 100).toFixed(1)}%`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(a.name ?? 'unknown');
        return acc;
      },
      {} as Record<string, string[]>,
    );

    Object.entries(byWeight)
      .sort(([w1], [w2]) => parseFloat(w2) - parseFloat(w1))
      .forEach(([weight, names]) => {
        const nameList = names as string[];
        state.logger.info(`   ${weight}: ${nameList.length} analyzers`);
      });

    const topAnalyzers = [...enabledAnalyzers]
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, 5);
    if (topAnalyzers.length > 0) {
      state.logger.info('   Top 5 analyzers:');
      topAnalyzers.forEach((a) => {
        const weight = a.weight ?? 0;
        const name = a.name ?? 'unknown';
        state.logger.info(`     • ${name}: ${(weight * 100).toFixed(2)}% weight, priority=${a.priority ?? 0}`);
      });
    }
  }

  // Log indicator configuration
  if (config.indicators) {
    const indicatorNames = Object.keys(config.indicators);
    state.logger.info(`📈 Indicators configured: ${indicatorNames.length}`, {
      indicators: indicatorNames.join(', '),
    });

    Object.entries(config.indicators).forEach(([name, cfg]) => {
      const details: string[] = [];
      const indCfg = cfg as IndicatorConfigParams;
      if (indCfg.period) details.push(`period=${indCfg.period}`);
      if (indCfg.fastPeriod) details.push(`fast=${indCfg.fastPeriod}, slow=${indCfg.slowPeriod}`);
      if (indCfg.kPeriod) details.push(`k=${indCfg.kPeriod}, d=${indCfg.dPeriod}`);
      if (indCfg.stdDev) details.push(`stdDev=${indCfg.stdDev}`);
      if (details.length > 0) {
        state.logger.info(`   ${name}: ${details.join(', ')}`);
      }
    });
  }

  // 1.5 Initialize ErrorHandler
  state.errorHandler = new ErrorHandler(state.logger);
  state.logger.info('⚡ ErrorHandler initialized (singleton instance)');

  // 1.6 Initialize event bus
  state.eventBus = new BotEventBus(state.logger);

  // 1.7 Initialize metrics service
  state.metrics = new BotMetricsService(state.logger, state.errorHandler);

  // 1.8 Initialize repositories
  state.positionRepository = new PositionMemoryRepository();
  state.journalRepository = new JournalFileRepository(state.logger);
  state.marketDataRepository = new MarketDataCacheRepository();
  state.logger.info('📦 Repositories initialized', {
    position: 'PositionMemoryRepository',
    journal: 'JournalFileRepository',
    marketData: 'MarketDataCacheRepository',
  });
};
