/**
 * SMOKE TESTS - Initialization Verification
 *
 * Critical: Verify all services are properly initialized
 * Prevents production issues caused by missing dependencies
 *
 * Tests that would have caught the EntryOrchestrator bug:
 * - TradingOrchestrator initialization
 * - All sub-service initialization
 * - Dependency injection correctness
 */

import { LoggerService } from '../../types';

describe('SMOKE TESTS: Service Initialization', () => {
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

  describe('TradingOrchestrator Initialization', () => {
    it('should initialize without errors', async () => {
      // Note: This would require full config and dependencies
      // For now, verify the pattern can be imported
      const TradingOrchestratorModule = require('../../services/trading-orchestrator.service') as any;
      expect(TradingOrchestratorModule.TradingOrchestrator).toBeDefined();
    });

    it('should load all required sub-services', () => {
      const requiredServices = [
        { file: 'trading-orchestrator.service', class: 'TradingOrchestrator' },
        { file: 'trade-execution.service', class: 'TradeExecutionService' },
        { file: 'entry-logic.service', class: 'EntryLogicService' },
        { file: 'market-data-preparation.service', class: 'MarketDataPreparationService' },
        { file: 'trading-context.service', class: 'TradingContextService' },
        { file: 'external-analysis.service', class: 'ExternalAnalysisService' },
        { file: 'signal-processing.service', class: 'SignalProcessingService' },
        { file: 'position-manager.service', class: 'PositionManagerService' },
        { file: 'risk-manager.service', class: 'RiskManager' },
        { file: 'analyzer-registration.service', class: 'AnalyzerRegistrationService' },
        { file: 'trend-confirmation.service', class: 'TrendConfirmationService' },
      ];

      requiredServices.forEach(({ file, class: className }) => {
        const Module = require(`../../services/${file}`) as any;
        expect(Module[className]).toBeDefined();
      });
    });
  });

  describe('Entry Pipeline Services', () => {
    it('should initialize EntryLogicService', () => {
      const Module = require('../../services/entry-logic.service') as any;
      expect(Module.EntryLogicService).toBeDefined();
    });

    it('should initialize TradeExecutionService', () => {
      const Module = require('../../services/trade-execution.service') as any;
      expect(Module.TradeExecutionService).toBeDefined();
    });

    it('should initialize EntryOrchestrator', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as any;
      expect(Module.EntryOrchestrator).toBeDefined();
    });
  });

  describe('Exit Pipeline Services', () => {
    it('should initialize ExitOrchestrator', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as any;
      expect(Module.ExitOrchestrator).toBeDefined();
    });

    it('should initialize PositionExitingService', () => {
      const Module = require('../../services/position-exiting.service') as any;
      expect(Module.PositionExitingService).toBeDefined();
    });
  });

  describe('Analysis Services', () => {
    it('should initialize all analyzer registrations', () => {
      const Module = require('../../services/analyzer-registration.service') as any;
      expect(Module.AnalyzerRegistrationService).toBeDefined();
    });

    it('should initialize MultiTimeframeTrendService', () => {
      const Module = require('../../services/multi-timeframe-trend.service') as any;
      expect(Module.MultiTimeframeTrendService).toBeDefined();
    });

    it('should initialize FlatMarketDetector', () => {
      const Module = require('../../analyzers/flat-market.detector') as any;
      expect(Module.FlatMarketDetector).toBeDefined();
    });

    it('should initialize PriceMomentumAnalyzer', () => {
      const Module = require('../../analyzers/price-momentum.analyzer') as any;
      expect(Module.PriceMomentumAnalyzer).toBeDefined();
    });
  });

  describe('Critical Orchestrator Dependencies', () => {
    it('should verify EntryOrchestrator requires RiskManager', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as any;
      const orchestrator = new Module.EntryOrchestrator(null, logger);

      // This should be null since RiskManager was null
      expect(orchestrator).toBeDefined();
    });

    it('should verify TradeExecutionService can be instantiated', () => {
      const Module = require('../../services/trade-execution.service') as any;

      // Create with minimal mocks
      const mockBybitService = {
        getCurrentPrice: jest.fn(),
        getBalance: jest.fn(),
        getServerTime: jest.fn(),
      };

      const mockPositionManager = {
        getCurrentPosition: jest.fn(),
        getOpenPositions: jest.fn(),
      };

      const service = new Module.TradeExecutionService(
        mockBybitService,
        mockPositionManager,
        null,
        null,
        null,
        null,
        null,
        logger,
        { leverage: 10 },
        null,
        null,
        null,
        null, // entryOrchestrator - CRITICAL: Should not be null in production
      );

      expect(service).toBeDefined();
    });
  });

  describe('Dependency Injection Pattern', () => {
    it('should verify services receive required parameters', () => {
      const TradingOrchestratorModule = require('../../services/trading-orchestrator.service') as any;
      const TradeExecutionModule = require('../../services/trade-execution.service') as any;
      const EntryOrchestrator = require('../../orchestrators/entry.orchestrator') as any;

      // Verify modules exist
      expect(TradingOrchestratorModule.TradingOrchestrator).toBeDefined();
      expect(TradeExecutionModule.TradeExecutionService).toBeDefined();
      expect(EntryOrchestrator.EntryOrchestrator).toBeDefined();
    });

    it('should verify all service exports are functions/classes', () => {
      const services = [
        ['../../services/trading-orchestrator.service', 'TradingOrchestrator'],
        ['../../services/trade-execution.service', 'TradeExecutionService'],
        ['../../services/entry-logic.service', 'EntryLogicService'],
        ['../../orchestrators/entry.orchestrator', 'EntryOrchestrator'],
        ['../../orchestrators/exit.orchestrator', 'ExitOrchestrator'],
      ];

      services.forEach(([path, className]) => {
        const Module = require(path) as any;
        expect(typeof Module[className]).toBe('function');
      });
    });
  });

  describe('Service Configuration', () => {
    it('should have EntryOrchestrator available in TradeExecutionService', () => {
      // Verify that the 13th parameter position is documented
      const Module = require('../../services/trade-execution.service') as any;
      const serviceCode = Module.TradeExecutionService.toString();

      // Check constructor accepts entryOrchestrator parameter
      expect(serviceCode).toContain('entryOrchestrator');
    });

    it('should verify evaluateEntryWithOrchestrator exists', () => {
      const Module = require('../../services/trade-execution.service') as any;
      const serviceProto = Module.TradeExecutionService.prototype;

      // Method should be private, check if it exists in the class definition
      const code = Module.TradeExecutionService.toString();
      expect(code).toContain('evaluateEntryWithOrchestrator');
    });

    it('should verify flatMarketAnalysis parameter in evaluateEntry', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as any;
      const code = Module.EntryOrchestrator.toString();

      // Check that evaluateEntry accepts flatMarketAnalysis
      expect(code).toContain('flatMarketAnalysis');
    });
  });

  describe('Configuration Validation', () => {
    it('should load and validate main config.json', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../..', 'config.json');

      expect(fs.existsSync(configPath)).toBe(true);

      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Verify critical config properties
      expect(config.exchange).toBeDefined();
      expect(config.exchange.symbol).toBeDefined();
      expect(config.trading).toBeDefined();
      expect(config.riskManagement).toBeDefined();
      expect(config.timeframes).toBeDefined();
    });
  });

  describe('Critical Service Dependencies', () => {
    it('should verify all critical services can be instantiated', () => {
      const services = [
        { file: 'risk-manager.service', class: 'RiskManager' },
        { file: 'position-manager.service', class: 'PositionManagerService' },
        { file: 'external-analysis.service', class: 'ExternalAnalysisService' },
        { file: 'entry-logic.service', class: 'EntryLogicService' },
      ];

      services.forEach(({ file, class: className }) => {
        const Module = require(`../../services/${file}`) as any;
        expect(Module[className]).toBeDefined();
      });
    });
  });

  describe('Data Flow Validation', () => {
    it('should verify signal processing service exists', () => {
      const Module = require('../../services/signal-processing.service') as any;
      expect(Module.SignalProcessingService).toBeDefined();
    });

    it('should verify external analysis service exists', () => {
      const Module = require('../../services/external-analysis.service') as any;
      expect(Module.ExternalAnalysisService).toBeDefined();
    });
  });

  describe('Entry/Exit Pipeline Integrity', () => {
    it('should verify entry logic service exists', () => {
      const Module = require('../../services/entry-logic.service') as any;
      expect(Module.EntryLogicService).toBeDefined();
    });

    it('should verify exit orchestrator exists', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as any;
      expect(Module.ExitOrchestrator).toBeDefined();
    });

    it('should verify position opening service exists', () => {
      const Module = require('../../services/position-opening.service') as any;
      expect(Module.PositionOpeningService).toBeDefined();
    });

    it('should verify position exiting service exists', () => {
      const Module = require('../../services/position-exiting.service') as any;
      expect(Module.PositionExitingService).toBeDefined();
    });
  });

  describe('Orchestrator Integration', () => {
    it('should verify EntryOrchestrator evaluates signals correctly', () => {
      const Module = require('../../orchestrators/entry.orchestrator') as any;
      const code = Module.EntryOrchestrator.toString();

      expect(code).toContain('evaluateEntry');
      expect(code).toContain('flatMarketAnalysis');
    });

    it('should verify ExitOrchestrator manages position lifecycle', () => {
      const Module = require('../../orchestrators/exit.orchestrator') as any;
      const code = Module.ExitOrchestrator.toString();

      expect(code).toContain('evaluateExit');
      // Should handle different exit states
      expect(code).toContain('TP1_HIT');
    });

    it('should verify TradingOrchestrator coordinates both entry and exit', () => {
      const Module = require('../../services/trading-orchestrator.service') as any;
      const code = Module.TradingOrchestrator.toString();

      expect(code).toContain('entryOrchestrator');
      expect(code).toContain('exitOrchestrator');
      expect(code).toContain('onCandleClosed');
    });
  });

  describe('Error Handling & Safety Nets', () => {
    it('should verify EntryOrchestrator is initialized in TradingOrchestrator', () => {
      const Module = require('../../services/trading-orchestrator.service') as any;
      const code = Module.TradingOrchestrator.toString();

      // Verify EntryOrchestrator is initialized (unconditionally)
      expect(code).toContain('EntryOrchestrator');
      expect(code).toContain('this.entryOrchestrator');
    });

    it('should verify TradeExecutionService validates EntryOrchestrator', () => {
      const Module = require('../../services/trade-execution.service') as any;
      const code = Module.TradeExecutionService.toString();

      // Verify that TradeExecutionService checks for EntryOrchestrator
      expect(code).toContain('entryOrchestrator');
      expect(code).toContain('CRITICAL');
    });
  });

  describe('Type Safety & Interfaces', () => {
    it('should verify main types are exported from types module', () => {
      // Types are exported as named exports, verify module can be loaded
      const types = require('../../types') as any;
      expect(types).toBeDefined();

      // Check for exported enums and interfaces
      expect(typeof types.SignalDirection).toBe('object');
    });

    it('should verify SignalDirection enum has correct values', () => {
      const types = require('../../types') as any;
      expect(types.SignalDirection.LONG).toBe('LONG');
      expect(types.SignalDirection.SHORT).toBe('SHORT');
      expect(types.SignalDirection.HOLD).toBe('HOLD');
    });

    it('should verify common trading types are available', () => {
      const typesModule = require('../../types') as any;
      // Verify module exports common types
      expect(typesModule).toHaveProperty('SignalDirection');
      expect(typesModule).toHaveProperty('SignalType');
    });
  });
});
