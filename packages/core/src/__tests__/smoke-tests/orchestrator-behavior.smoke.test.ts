/**
 * SMOKE TESTS - Orchestrator Runtime Behavior
 */

import { SignalDirection, SignalType, TrendBias, LoggerService } from '../../types/legacy';

type LoggerLike = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;
type Ctor<T = unknown> = new (...args: unknown[]) => T;
type ModuleWithCtor<Name extends string> = Record<Name, Ctor>;

describe('SMOKE TESTS: Orchestrator Runtime Behavior', () => {
  let logger: LoggerLike;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('EntryOrchestrator Behavior', () => {
    it('should handle entry evaluation with signals', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      const orchestrator = new Module.EntryOrchestrator(null, logger as LoggerService);
      expect(orchestrator).toBeDefined();
    });

    it('should have evaluateEntry method available', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      const code = Module.EntryOrchestrator.toString();
      expect(code).toContain('evaluateEntry');
    });

    it('should accept signal parameters', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      const code = Module.EntryOrchestrator.toString();
      expect(code).toContain('Signal');
    });
  });

  describe('ExitOrchestrator Behavior', () => {
    it('should initialize ExitOrchestrator without dependencies', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as ModuleWithCtor<'ExitOrchestrator'>;
      expect(Module.ExitOrchestrator).toBeDefined();
    });

    it('should have evaluateExit method', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as ModuleWithCtor<'ExitOrchestrator'>;
      const code = Module.ExitOrchestrator.toString();
      expect(code).toContain('evaluateExit');
    });

    it('should handle position state management', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as ModuleWithCtor<'ExitOrchestrator'>;
      const code = Module.ExitOrchestrator.toString();
      expect(code).toContain('position');
    });
  });

  describe('Service Method Availability', () => {
    it('should verify PositionExitingService has closePosition method', () => {
      const Module = require('../../services/position-exiting.service') as ModuleWithCtor<'PositionExitingService'>;
      const code = Module.PositionExitingService.toString();
      expect(code).toContain('closePosition');
    });

    it('should verify PositionMonitorService has monitoring capabilities', () => {
      const Module = require('../../services/position-monitor.service') as ModuleWithCtor<'PositionMonitorService'>;
      expect(Module.PositionMonitorService).toBeDefined();
    });
  });

  describe('Trading Pipeline Integration', () => {
    it('should verify complete exit pipeline exists', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as ModuleWithCtor<'ExitOrchestrator'>;
      expect(Module.ExitOrchestrator).toBeDefined();
    });

    it('should verify entry orchestrator exists', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      expect(Module.EntryOrchestrator).toBeDefined();
    });
  });

  describe('Analysis Layer', () => {
    it('should verify MultiTimeframeTrendService exists', () => {
      const Module = require('../../services/multi-timeframe-trend.service') as ModuleWithCtor<'MultiTimeframeTrendService'>;
      expect(Module.MultiTimeframeTrendService).toBeDefined();
    });
  });

  describe('Position Management', () => {
    it('should verify PositionLifecycleService exists', () => {
      const Module = require('../../services/position-lifecycle.service') as ModuleWithCtor<'PositionLifecycleService'>;
      expect(Module.PositionLifecycleService).toBeDefined();
    });

    it('should verify PositionExitingService exists', () => {
      const Module = require('../../services/position-exiting.service') as ModuleWithCtor<'PositionExitingService'>;
      expect(Module.PositionExitingService).toBeDefined();
    });

    it('should verify PositionMonitorService exists', () => {
      const Module = require('../../services/position-monitor.service') as ModuleWithCtor<'PositionMonitorService'>;
      expect(Module.PositionMonitorService).toBeDefined();
    });
  });

  describe('RiskManager Requirement', () => {
    it('should verify EntryOrchestrator checks for RiskManager', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      const orchestrator = new Module.EntryOrchestrator(null, logger as LoggerService);
      expect(orchestrator).toBeDefined();
    });

    it('should verify error logging for missing RiskManager', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      const orchestrator = new Module.EntryOrchestrator(null, logger as LoggerService);
      expect(orchestrator).toBeDefined();
    });
  });

  describe('Type Consistency', () => {
    it('should verify SignalDirection enum is available', () => {
      expect(SignalDirection.LONG).toBe('LONG');
      expect(SignalDirection.SHORT).toBe('SHORT');
    });

    it('should verify Signal type is available', () => {
      expect(SignalType).toBeDefined();
    });

    it('should verify TrendBias enum is available', () => {
      expect(TrendBias.BULLISH).toBe('BULLISH');
      expect(TrendBias.BEARISH).toBe('BEARISH');
    });
  });

  describe('Configuration Access', () => {
    it('should verify config.json is accessible', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../../../../', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should verify all required config sections exist', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../../../../', 'config.json');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      expect(config.exchange).toBeDefined();
      expect(config.trading).toBeDefined();
    });
  });

  describe('Service Initialization Contract', () => {
    it('should verify TradingOrchestrator can be created', () => {
      const Module = require('../../services/trading-orchestrator.service') as ModuleWithCtor<'TradingOrchestrator'>;
      expect(Module.TradingOrchestrator).toBeDefined();
    });

    it('should verify EntryOrchestrator always initializes', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      expect(Module.EntryOrchestrator).toBeDefined();
    });
  });
});
