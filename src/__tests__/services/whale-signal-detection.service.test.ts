/**
 * Tests for WhaleSignalDetectionService
 * Week 13 Phase 5e: Extracted from trading-orchestrator.service.ts checkWhaleSignalRealtime method
 */

import { WhaleSignalDetectionService } from '../../services/whale-signal-detection.service';
import { SignalDirection } from '../../types';

describe('WhaleSignalDetectionService', () => {
  let service: WhaleSignalDetectionService;
  let mockStrategyCoordinator: any;
  let mockPositionManager: any;
  let mockMarketDataPreparationService: any;
  let mockTradeExecutionService: any;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockStrategyCoordinator = {
      getStrategies: jest.fn().mockReturnValue([]),
    };

    mockPositionManager = {
      getCurrentPosition: jest.fn().mockReturnValue(null),
    };

    mockMarketDataPreparationService = {
      setCurrentContext: jest.fn(),
      setCurrentOrderbook: jest.fn(),
      prepareMarketDataForWhale: jest.fn().mockResolvedValue({
        bid: 100,
        ask: 101,
        spread: 1,
      }),
    };

    mockTradeExecutionService = {
      executeTrade: jest.fn().mockResolvedValue(undefined),
    };

    service = new WhaleSignalDetectionService(
      mockStrategyCoordinator,
      mockPositionManager,
      mockMarketDataPreparationService,
      mockTradeExecutionService,
      mockLogger,
    );
  });

  const mockOrderbook = {
    symbol: 'APEXUSDT',
    timestamp: Date.now(),
    updateId: 123456,
    bids: [
      { price: 100, size: 10 },
      { price: 99, size: 20 },
    ],
    asks: [
      { price: 101, size: 10 },
      { price: 102, size: 20 },
    ],
  };

  const mockContext: any = {
    bias: 'UP',
    restrictedDirections: [],
    timestamp: Date.now(),
    trend: 'UP',
  };

  describe('checkWhaleSignalRealtime', () => {
    it('should return early if no whale strategy found', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        { name: 'TREND_FOLLOWING', evaluate: jest.fn() },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockTradeExecutionService.executeTrade).not.toHaveBeenCalled();
    });

    it('should return early if already in position', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockResolvedValue({
            valid: true,
            signal: { direction: SignalDirection.LONG },
          }),
        },
      ]);
      mockPositionManager.getCurrentPosition.mockReturnValue({
        id: 'pos-1',
        symbol: 'APEXUSDT',
      });

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockTradeExecutionService.executeTrade).not.toHaveBeenCalled();
    });

    it('should return early if context not ready', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockResolvedValue({
            valid: true,
            signal: { direction: SignalDirection.LONG },
          }),
        },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, null);

      expect(mockTradeExecutionService.executeTrade).not.toHaveBeenCalled();
    });

    it('should prepare whale market data when conditions met', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockResolvedValue({
            valid: false,
            signal: null,
          }),
        },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockMarketDataPreparationService.setCurrentContext).toHaveBeenCalledWith(
        mockContext,
      );
      expect(mockMarketDataPreparationService.setCurrentOrderbook).toHaveBeenCalledWith(
        mockOrderbook,
      );
      expect(
        mockMarketDataPreparationService.prepareMarketDataForWhale,
      ).toHaveBeenCalled();
    });

    it('should return early if market data preparation fails', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn(),
        },
      ]);
      mockMarketDataPreparationService.prepareMarketDataForWhale.mockResolvedValue(null);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockTradeExecutionService.executeTrade).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled(); // warn is only for errors
    });

    it('should evaluate whale strategy with prepared market data', async () => {
      const mockWhaleStrategy = {
        name: 'WHALE_HUNTER',
        evaluate: jest.fn().mockResolvedValue({
          valid: false,
          signal: null,
        }),
      };
      mockStrategyCoordinator.getStrategies.mockReturnValue([mockWhaleStrategy]);

      const marketData = { bid: 100, ask: 101 };
      mockMarketDataPreparationService.prepareMarketDataForWhale.mockResolvedValue(
        marketData,
      );

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockWhaleStrategy.evaluate).toHaveBeenCalledWith(marketData);
    });

    it('should detect valid whale signal', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockResolvedValue({
            valid: true,
            signal: {
              direction: SignalDirection.LONG,
              confidence: 0.85,
              price: 100,
              stopLoss: 95,
              takeProfits: [105, 110, 115],
              timestamp: Date.now(),
            },
            strategyName: 'WHALE_HUNTER',
            reason: 'Whale accumulation detected',
          }),
        },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('WHALE SIGNAL DETECTED'),
        expect.objectContaining({
          strategy: 'WHALE_HUNTER',
          direction: SignalDirection.LONG,
        }),
      );
    });

    it('should execute trade on valid whale signal', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockResolvedValue({
            valid: true,
            signal: {
              direction: SignalDirection.LONG,
              confidence: 0.85,
              price: 100,
              stopLoss: 95,
              takeProfits: [105, 110, 115],
              timestamp: Date.now(),
            },
            strategyName: 'WHALE_HUNTER',
            reason: 'Whale accumulation',
          }),
        },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockTradeExecutionService.executeTrade).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldEnter: true,
          direction: SignalDirection.LONG,
          confidence: 0.85,
        }),
        expect.any(Object),
      );
    });

    it('should not execute if signal invalid', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockResolvedValue({
            valid: false,
            signal: null,
          }),
        },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockTradeExecutionService.executeTrade).not.toHaveBeenCalled();
    });

    it('should support WHALE_HUNTER_FOLLOW strategy', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER_FOLLOW',
          evaluate: jest.fn().mockResolvedValue({
            valid: true,
            signal: {
              direction: SignalDirection.SHORT,
              confidence: 0.75,
              price: 100,
              stopLoss: 105,
              takeProfits: [95, 90, 85],
              timestamp: Date.now(),
            },
            strategyName: 'WHALE_HUNTER_FOLLOW',
            reason: 'Following whale short',
          }),
        },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockTradeExecutionService.executeTrade).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: SignalDirection.SHORT,
        }),
        expect.any(Object),
      );
    });

    it('should use strategy reason in entry signal', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockResolvedValue({
            valid: true,
            signal: {
              direction: SignalDirection.LONG,
              confidence: 0.8,
              price: 100,
              stopLoss: 95,
              takeProfits: [105, 110],
              timestamp: Date.now(),
            },
            strategyName: 'WHALE_HUNTER',
            reason: 'Large bid wall accumulation',
          }),
        },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockTradeExecutionService.executeTrade).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'Large bid wall accumulation',
        }),
        expect.any(Object),
      );
    });

    it('should handle market data preparation errors gracefully', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn(),
        },
      ]);
      mockMarketDataPreparationService.prepareMarketDataForWhale.mockRejectedValue(
        new Error('Data prep failed'),
      );

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to prepare whale market data'),
        expect.any(Object),
      );
      expect(mockTradeExecutionService.executeTrade).not.toHaveBeenCalled();
    });

    it('should handle strategy evaluation errors gracefully', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockRejectedValue(new Error('Evaluation failed')),
        },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in real-time whale signal check'),
        expect.any(Object),
      );
    });

    it('should handle trade execution errors gracefully', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockResolvedValue({
            valid: true,
            signal: {
              direction: SignalDirection.LONG,
              confidence: 0.8,
              price: 100,
              stopLoss: 95,
              takeProfits: [105, 110],
              timestamp: Date.now(),
            },
            strategyName: 'WHALE_HUNTER',
            reason: 'Test signal',
          }),
        },
      ]);
      mockTradeExecutionService.executeTrade.mockRejectedValue(
        new Error('Execution failed'),
      );

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      // Error is caught inside executeWhaleSignal, not in the main catch block
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to execute whale signal'),
        expect.any(Object),
      );
    });

    it('should log whale signal with proper confidence formatting', async () => {
      mockStrategyCoordinator.getStrategies.mockReturnValue([
        {
          name: 'WHALE_HUNTER',
          evaluate: jest.fn().mockResolvedValue({
            valid: true,
            signal: {
              direction: SignalDirection.LONG,
              confidence: 0.8234,
              price: 100,
              stopLoss: 95,
              takeProfits: [105, 110],
              timestamp: Date.now(),
            },
            strategyName: 'WHALE_HUNTER',
            reason: 'Whale detected',
          }),
        },
      ]);

      await service.checkWhaleSignalRealtime(mockOrderbook, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('WHALE SIGNAL DETECTED'),
        expect.objectContaining({
          confidence: expect.stringMatching(/^\d+\.\d+$/), // Matches "0.82" format
        }),
      );
    });
  });
});
