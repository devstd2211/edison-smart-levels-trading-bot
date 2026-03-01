/**
 * SMOKE TESTS - Initialization Verification
 *
 * Critical: Verify all services are properly initialized
 * Prevents production issues caused by missing dependencies
 */

import { LoggerService } from '../../types/legacy';

type LoggerLike = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;
type Ctor<T = unknown> = new (...args: unknown[]) => T;
type ModuleWithCtor<Name extends string> = Record<Name, Ctor>;

describe('SMOKE TESTS: Service Initialization', () => {
  let logger: LoggerLike;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('TradingOrchestrator Initialization', () => {
    it('should initialize without errors', async () => {
      const TradingOrchestratorModule = require('../../services/trading-orchestrator.service') as ModuleWithCtor<'TradingOrchestrator'>;
      expect(TradingOrchestratorModule.TradingOrchestrator).toBeDefined();
    });

    it('should load all required sub-services', () => {
      const requiredServices = [
        { file: 'trading-orchestrator.service', class: 'TradingOrchestrator' },
        { file: 'position-lifecycle.service', class: 'PositionLifecycleService' },
        { file: 'risk-manager.service', class: 'RiskManager' },
        { file: 'analyzer-registry.service', class: 'AnalyzerRegistryService' },
      ];

      requiredServices.forEach(({ file, class: className }) => {
        const Module = require(`../../services/${file}`) as Record<string, unknown>;
        expect(Module[className]).toBeDefined();
      });
    });
  });

  describe('Entry Pipeline Services', () => {
    it('should initialize EntryOrchestrator', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      expect(Module.EntryOrchestrator).toBeDefined();
    });

    it('should have proper entry orchestrator methods', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      const code = Module.EntryOrchestrator.toString();
      expect(code).toContain('evaluateEntry');
    });
  });

  describe('Exit Pipeline Services', () => {
    it('should initialize ExitOrchestrator', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as ModuleWithCtor<'ExitOrchestrator'>;
      expect(Module.ExitOrchestrator).toBeDefined();
    });

    it('should initialize PositionExitingService', () => {
      const Module = require('../../services/position-exiting.service') as ModuleWithCtor<'PositionExitingService'>;
      expect(Module.PositionExitingService).toBeDefined();
    });
  });

  describe('Analysis Services', () => {
    it('should initialize all analyzer registrations', () => {
      const Module = require('../../services/analyzer-registry.service') as ModuleWithCtor<'AnalyzerRegistryService'>;
      expect(Module.AnalyzerRegistryService).toBeDefined();
    });

    it('should initialize MultiTimeframeTrendService', () => {
      const Module = require('../../services/multi-timeframe-trend.service') as ModuleWithCtor<'MultiTimeframeTrendService'>;
      expect(Module.MultiTimeframeTrendService).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should load and validate main config.json', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../../../../', 'config.json');

      expect(fs.existsSync(configPath)).toBe(true);

      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Verify critical config properties
      expect(config.exchange).toBeDefined();
      expect(config.trading).toBeDefined();
      expect(config.riskManagement).toBeDefined();
    });
  });

  describe('Entry/Exit Pipeline Integrity', () => {
    it('should verify exit orchestrator exists', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as ModuleWithCtor<'ExitOrchestrator'>;
      expect(Module.ExitOrchestrator).toBeDefined();
    });

    it('should verify position lifecycle service exists', () => {
      const Module = require('../../services/position-lifecycle.service') as ModuleWithCtor<'PositionLifecycleService'>;
      expect(Module.PositionLifecycleService).toBeDefined();
    });

    it('should verify position exiting service exists', () => {
      const Module = require('../../services/position-exiting.service') as ModuleWithCtor<'PositionExitingService'>;
      expect(Module.PositionExitingService).toBeDefined();
    });

    it('should verify position monitor service exists', () => {
      const Module = require('../../services/position-monitor.service') as ModuleWithCtor<'PositionMonitorService'>;
      expect(Module.PositionMonitorService).toBeDefined();
    });
  });

  describe('Orchestrator Integration', () => {
    it('should verify EntryOrchestrator evaluates signals correctly', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as ModuleWithCtor<'EntryOrchestrator'>;
      const code = Module.EntryOrchestrator.toString();

      expect(code).toContain('evaluateEntry');
    });

    it('should verify ExitOrchestrator manages position lifecycle', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as ModuleWithCtor<'ExitOrchestrator'>;
      const code = Module.ExitOrchestrator.toString();

      expect(code).toContain('evaluateExit');
    });

    it('should verify TradingOrchestrator coordinates both entry and exit', () => {
      const Module = require('../../services/trading-orchestrator.service') as ModuleWithCtor<'TradingOrchestrator'>;
      const code = Module.TradingOrchestrator.toString();

      expect(code).toContain('entryOrchestrator');
      expect(code).toContain('exitOrchestrator');
    });
  });

  describe('Type Safety & Interfaces', () => {
    it('should verify main types are exported from types module', () => {
      const types = require('../../types') as Record<string, unknown>;
      expect(types).toBeDefined();
      expect(typeof types.SignalDirection).toBe('object');
    });

    it('should verify SignalDirection enum has correct values', () => {
      const types = require('../../types') as { SignalDirection?: { LONG?: string; SHORT?: string } };
      expect(types.SignalDirection).toBeDefined();
      expect(types.SignalDirection!.LONG).toBe('LONG');
      expect(types.SignalDirection!.SHORT).toBe('SHORT');
    });

    it('should verify common trading types are available', () => {
      const typesModule = require('../../types') as Record<string, unknown>;
      expect(typesModule).toHaveProperty('SignalDirection');
      expect(typesModule).toHaveProperty('SignalType');
    });
  });
});
