import {
  EntryValidationError,
  StrategyExecutionError,
} from '../../errors';

export const TRADING_ORCHESTRATOR_ANALYSIS_CONTEXT =
  'TradingOrchestrator.runStrategyAnalysis';

export const TRADING_ORCHESTRATOR_ENTRY_CONTEXT =
  'TradingOrchestrator.entryOrchestrator.evaluateEntry';

export type TradingOrchestratorMockLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
};

export function createTradingOrchestratorMockLogger(): TradingOrchestratorMockLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

export function createTradingOrchestratorErrorHandlingHarness(): {
  logger: TradingOrchestratorMockLogger;
} {
  return {
    logger: createTradingOrchestratorMockLogger(),
  };
}

export function createStrategyExecutionTestError(
  message: string,
  reason: string,
): StrategyExecutionError {
  return new StrategyExecutionError(message, {
    strategyId: 'STRAT1',
    phase: 'AnalyzerExecution',
    reason,
  });
}

export function createEntryValidationTestError(
  message: string,
  reason: string,
  confidence: number = 0,
): EntryValidationError {
  return new EntryValidationError(message, {
    reason,
    confidence,
  });
}
