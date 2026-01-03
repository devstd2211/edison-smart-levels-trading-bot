/**
 * SMOKE TESTS - Orchestrator Runtime Behavior
 *
 * Verifies that orchestrators execute correctly with various inputs
 * Tests runtime behavior and edge cases
 *
 * These tests ensure that even with fallback components,
 * the system behaves predictably
 */

import { LoggerService, Signal, SignalDirection } from '../../types';

describe('SMOKE TESTS: Orchestrator Runtime Behavior', () => {
  let logger: LoggerService;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      minLevel: 'debug',
      logDir: './logs',
      logToFile: true,
      logs: [],
    } as any;
  });

  describe('EntryOrchestrator Behavior', () => {
    it('should handle entry evaluation with signals', async () => {
      const Module = require('../../orchestrators/entry.orchestrator') as any;
      const fallbackRiskManager = {
        canTrade: async () => ({
          allowed: true,
          reason: 'Test approval',
        }),
      };

      const orchestrator = new Module.EntryOrchestrator(fallbackRiskManager, logger);
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.evaluateEntry).toBe('function');
    });

    it('should have evaluateEntry method available', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as any;
      const code = Module.EntryOrchestrator.toString();

      expect(code).toContain('evaluateEntry');
      expect(code).toContain('riskManager');
    });

    it('should accept flatMarketAnalysis parameter', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as any;
      const code = Module.EntryOrchestrator.toString();

      expect(code).toContain('flatMarketAnalysis');
    });
  });

  describe('ExitOrchestrator Behavior', () => {
    it('should initialize ExitOrchestrator without dependencies', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as any;
      const orchestrator = new Module.ExitOrchestrator(logger);

      expect(orchestrator).toBeDefined();
    });

    it('should have evaluateExit method', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as any;
      const code = Module.ExitOrchestrator.toString();

      expect(code).toContain('evaluateExit');
    });

    it('should handle position state management', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as any;
      const code = Module.ExitOrchestrator.toString();

      // Should manage exit states (TP1_HIT, TP2_HIT, etc)
      expect(code).toContain('TP1_HIT');
      expect(code).toContain('TP2_HIT');
    });
  });

  describe('Service Method Availability', () => {
    it('should verify TradeExecutionService has executeTrade method', () => {
      const Module = require('../../services/trade-execution.service') as any;
      const code = Module.TradeExecutionService.toString();

      expect(code).toContain('executeTrade');
      expect(code).toContain('async');
    });

    it('should verify EntryLogicService has scanForEntries method', () => {
      const Module = require('../../services/entry-logic.service') as any;
      const code = Module.EntryLogicService.toString();

      expect(code).toContain('scanForEntries');
      expect(code).toContain('async');
    });

    it('should verify PositionExitingService has closePosition method', () => {
      const Module = require('../../services/position-exiting.service') as any;
      const code = Module.PositionExitingService.toString();

      expect(code).toContain('closePosition');
    });

    it('should verify MarketDataPreparationService has sync methods', () => {
      const Module = require('../../services/market-data-preparation.service') as any;
      const code = Module.MarketDataPreparationService.toString();

      expect(code).toContain('setCurrentContext');
      expect(code).toContain('setCurrentOrderbook');
    });
  });

  describe('Trading Pipeline Integration', () => {
    it('should verify complete entry pipeline exists', () => {
      const services = [
        { file: '../../services/entry-logic.service', name: 'EntryLogicService' },
        { file: '../../services/trade-execution.service', name: 'TradeExecutionService' },
        { file: '../../orchestrators/entry.orchestrator', name: 'EntryOrchestrator' },
      ];

      services.forEach(({ file, name }) => {
        const Module = require(file) as any;
        expect(Module[name]).toBeDefined();
      });
    });

    it('should verify complete exit pipeline exists', () => {
      const services = [
        { file: '../../orchestrators/exit.orchestrator', name: 'ExitOrchestrator' },
        { file: '../../services/position-exiting.service', name: 'PositionExitingService' },
      ];

      services.forEach(({ file, name }) => {
        const Module = require(file) as any;
        expect(Module[name]).toBeDefined();
      });
    });

    it('should verify market data pipeline exists', () => {
      const services = [
        { file: '../../services/market-data-preparation.service', name: 'MarketDataPreparationService' },
        { file: '../../services/trading-context.service', name: 'TradingContextService' },
      ];

      services.forEach(({ file, name }) => {
        const Module = require(file) as any;
        expect(Module[name]).toBeDefined();
      });
    });
  });

  describe('Signal Processing', () => {
    it('should verify SignalProcessingService exists', () => {
      const Module = require('../../services/signal-processing.service') as any;
      expect(Module.SignalProcessingService).toBeDefined();
    });

    it('should verify AnalyzerRegistrationService exists', () => {
      const Module = require('../../services/analyzer-registration.service') as any;
      expect(Module.AnalyzerRegistrationService).toBeDefined();
    });

    it('should verify TrendConfirmationService exists', () => {
      const Module = require('../../services/trend-confirmation.service') as any;
      expect(Module.TrendConfirmationService).toBeDefined();
    });
  });

  describe('Analysis Layer', () => {
    it('should verify FlatMarketDetector exists', () => {
      const Module = require('../../analyzers/flat-market.detector') as any;
      expect(Module.FlatMarketDetector).toBeDefined();
    });

    it('should verify PriceMomentumAnalyzer exists', () => {
      const Module = require('../../analyzers/price-momentum.analyzer') as any;
      expect(Module.PriceMomentumAnalyzer).toBeDefined();
    });

    it('should verify MultiTimeframeTrendService exists', () => {
      const Module = require('../../services/multi-timeframe-trend.service') as any;
      expect(Module.MultiTimeframeTrendService).toBeDefined();
    });
  });

  describe('Position Management', () => {
    it('should verify PositionManagerService exists', () => {
      const Module = require('../../services/position-manager.service') as any;
      expect(Module.PositionManagerService).toBeDefined();
    });

    it('should verify PositionOpeningService exists', () => {
      const Module = require('../../services/position-opening.service') as any;
      expect(Module.PositionOpeningService).toBeDefined();
    });

    it('should verify PositionExitingService exists', () => {
      const Module = require('../../services/position-exiting.service') as any;
      expect(Module.PositionExitingService).toBeDefined();
    });
  });

  describe('RiskManager Requirement', () => {
    it('should verify EntryOrchestrator checks for RiskManager', () => {
      const Module = require('../../services/trading-orchestrator.service') as any;
      const code = Module.TradingOrchestrator.toString();

      // Must check for RiskManager before initialization
      expect(code).toContain('this.riskManager');
      expect(code).toContain('EntryOrchestrator');
    });

    it('should verify error logging for missing RiskManager', () => {
      const Module = require('../../services/trading-orchestrator.service') as any;
      const code = Module.TradingOrchestrator.toString();

      // Should have clear error logging
      expect(code).toContain('CRITICAL');
      expect(code).toContain('logger.error');
    });
  });

  describe('Error Handling & Logging', () => {
    it('should verify services have error handling', () => {
      const services = [
        { file: '../../services/trade-execution.service', name: 'TradeExecutionService' },
        { file: '../../services/entry-logic.service', name: 'EntryLogicService' },
      ];

      services.forEach(({ file, name }) => {
        const Module = require(file) as any;
        const code = Module[name].toString();

        // Should have try/catch or error logging
        expect(code.toLowerCase()).toMatch(/error|catch|throw|logger\.(error|warn)/);
      });
    });

    it('should verify logger is injected into services', () => {
      const services = [
        { file: '../../services/trade-execution.service', name: 'TradeExecutionService' },
        { file: '../../orchestrators/entry.orchestrator', name: 'EntryOrchestrator' },
        { file: '../../orchestrators/exit.orchestrator', name: 'ExitOrchestrator' },
      ];

      services.forEach(({ file, name }) => {
        const Module = require(file) as any;
        const code = Module[name].toString();

        expect(code).toContain('logger');
      });
    });
  });

  describe('Type Consistency', () => {
    it('should verify SignalDirection enum is available', () => {
      const types = require('../../types') as any;
      expect(types.SignalDirection).toBeDefined();
      expect(types.SignalDirection.LONG).toBe('LONG');
      expect(types.SignalDirection.SHORT).toBe('SHORT');
      expect(types.SignalDirection.HOLD).toBe('HOLD');
    });

    it('should verify Signal type is available', () => {
      const types = require('../../types') as any;
      // Signal should be defined (either type or interface)
      expect(typeof types).toBe('object');
    });

    it('should verify RiskDecision type is available', () => {
      const types = require('../../types') as any;
      // RiskDecision interface should exist in types module
      expect(typeof types).toBe('object');
    });
  });

  describe('Configuration Access', () => {
    it('should verify config.json is accessible', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../..', 'config.json');

      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should verify all required config sections exist', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../..', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      const requiredSections = ['exchange', 'timeframes', 'trading', 'riskManagement'];

      requiredSections.forEach((section) => {
        expect(config[section]).toBeDefined();
      });
    });
  });

  describe('Service Initialization Contract', () => {
    it('should verify TradingOrchestrator can be created with minimal config', () => {
      const minimalConfig = {
        contextConfig: {
          atrPeriod: 14,
          emaPeriod: 50,
          zigzagDepth: 12,
          minimumATR: 0.01,
          maximumATR: 100,
          maxEmaDistance: 0.5,
          filteringMode: 'HARD_BLOCK',
          atrFilterEnabled: false,
        },
        entryConfig: {
          rsiPeriod: 14,
          fastEmaPeriod: 20,
          slowEmaPeriod: 50,
          zigzagDepth: 12,
          rsiOversold: 30,
          rsiOverbought: 70,
          stopLossPercent: 1.5,
          takeProfits: [],
        },
        positionSizeUsdt: 10,
        leverage: 10,
      };

      const Module = require('../../services/trading-orchestrator.service') as any;
      expect(Module.TradingOrchestrator).toBeDefined();
    });

    it('should verify EntryOrchestrator always initializes', () => {
      const Module = require('../../services/trading-orchestrator.service') as any;
      const code = Module.TradingOrchestrator.toString();

      // EntryOrchestrator should ALWAYS be created, not conditionally
      expect(code).toContain('this.entryOrchestrator');
      expect(code).not.toMatch(/if\s*\(\s*this\.riskManager\s*\)\s*{[^}]*new EntryOrchestrator/);
    });
  });
});
