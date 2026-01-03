import { PositionOpeningService } from '../../services/position-opening.service';
import { Signal, PositionSide, SignalDirection, SignalType, TakeProfit } from '../../types';

// ============================================================================
// MOCK SETUP
// ============================================================================

const createMockBybitService = () => ({
  cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
  openPosition: jest.fn().mockResolvedValue('ORDER_ID_123'),
  placeTakeProfitLevels: jest.fn().mockResolvedValue(['TP1_ORDER_ID', 'TP2_ORDER_ID', 'TP3_ORDER_ID']),
  getCurrentPrice: jest.fn().mockResolvedValue(100),
  updateStopLoss: jest.fn().mockResolvedValue(undefined),
  verifyProtectionSet: jest.fn().mockResolvedValue({
    verified: true,
    hasStopLoss: true,
    hasTakeProfit: true,
    stopLossPrice: 95,
    takeProfitPrices: [105, 110, 115],
    activeOrders: 4,
    hasTrailingStop: false,
  }),
  closePosition: jest.fn().mockResolvedValue(undefined),
  ['symbol']: 'APEXUSDT',
});

const createMockTelegramService = () => ({
  notifyPositionOpened: jest.fn().mockResolvedValue(undefined),
  sendAlert: jest.fn().mockResolvedValue(undefined),
  notifyError: jest.fn().mockResolvedValue(undefined),
});

const createMockJournalService = () => ({
  recordTradeOpen: jest.fn(),
});

const createMockPositionSizingService = () => ({
  calculatePositionSize: jest.fn().mockResolvedValue({
    positionSizeUsdt: 10,
    quantity: 8.33,
    roundedQuantity: '8.330',
    marginUsed: 10,
    notionalValue: 833,
    sizingChain: ['FIXED'],
  }),
});

const createMockLoggerService = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
});

const createMockTradingConfig = () => ({
  leverage: 10,
  symbol: 'APEXUSDT',
  timeframe: '1m',
  entryTimeframe: '5m',
});

const createMockRiskConfig = () => ({
  positionSizeUsdt: 10,
  maxLossPerTrade: 50,
  maxDrawdown: 1000,
  maxConcurrentPositions: 1,
});

const createMockConfig = () => ({
  tradingEnabled: true,
  positionSizeUsdt: 10,
});

// Note: PositionOpeningService is agnostic about signal metadata
// It only cares about: direction, price, stopLoss, takeProfits
// It ignores: type, confidence, reason, timestamp, marketData, btcData
const createMockSignal = (overrides?: Partial<Signal>): Signal => ({
  type: SignalType.LEVEL_BASED,
  direction: SignalDirection.LONG,
  price: 100,
  stopLoss: 95,
  takeProfits: [
    { level: 1, percent: 5, sizePercent: 33, price: 105, hit: false } as TakeProfit,
    { level: 2, percent: 10, sizePercent: 33, price: 110, hit: false } as TakeProfit,
    { level: 3, percent: 15, sizePercent: 34, price: 115, hit: false } as TakeProfit,
  ],
  confidence: 85,
  reason: 'Test signal',
  timestamp: Date.now(),
  ...overrides,
});

// ============================================================================
// TESTS
// ============================================================================

describe('PositionOpeningService', () => {
  let service: PositionOpeningService;
  let mockBybit: any;
  let mockTelegram: any;
  let mockJournal: any;
  let mockSizing: any;
  let mockLogger: any;
  let mockTradingConfig: any;
  let mockRiskConfig: any;
  let mockFullConfig: any;

  beforeEach(() => {
    mockBybit = createMockBybitService();
    mockTelegram = createMockTelegramService();
    mockJournal = createMockJournalService();
    mockSizing = createMockPositionSizingService();
    mockLogger = createMockLoggerService();
    mockTradingConfig = createMockTradingConfig();
    mockRiskConfig = createMockRiskConfig();
    mockFullConfig = createMockConfig();

    service = new PositionOpeningService(
      mockBybit,
      mockTradingConfig,
      mockRiskConfig,
      mockTelegram,
      mockLogger,
      mockJournal,
      mockSizing,
      mockFullConfig,
      undefined,
      undefined,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('openPosition', () => {
    it('should open LONG position successfully', async () => {
      const signal = createMockSignal({ direction: SignalDirection.LONG });

      const position = await service.openPosition(signal);

      expect(position).toBeDefined();
      expect(position.side).toBe(PositionSide.LONG);
      expect(position.entryPrice).toBe(100);
      expect(position.quantity).toBe(8.33);
      expect(position.status).toBe('OPEN');
      expect(mockBybit.openPosition).toHaveBeenCalled();
    });

    it('should open SHORT position successfully', async () => {
      const signal = createMockSignal({ direction: SignalDirection.SHORT });

      const position = await service.openPosition(signal);

      expect(position).toBeDefined();
      expect(position.side).toBe(PositionSide.SHORT);
      expect(position.entryPrice).toBe(100);
      expect(position.status).toBe('OPEN');
    });

    it('should integrate PositionSizingService correctly', async () => {
      const signal = createMockSignal();

      await service.openPosition(signal);

      expect(mockSizing.calculatePositionSize).toHaveBeenCalledWith(signal);
      expect(mockBybit.openPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          side: PositionSide.LONG,
          quantity: 8.33,
          leverage: 10,
        }),
      );
    });

    it('should place take-profit levels', async () => {
      const signal = createMockSignal();

      await service.openPosition(signal);

      expect(mockBybit.placeTakeProfitLevels).toHaveBeenCalledWith(
        expect.objectContaining({
          side: PositionSide.LONG,
          entryPrice: 100,
          totalQuantity: 8.33,
          levels: signal.takeProfits,
        }),
      );
    });

    it('should set stop-loss correctly', async () => {
      const signal = createMockSignal();

      await service.openPosition(signal);

      expect(mockBybit.updateStopLoss).toHaveBeenCalled();
      const slCall = mockBybit.updateStopLoss.mock.calls[0][0];
      expect(slCall).toBeCloseTo(95, 1); // SL should be ~95
    });

    it('should recalculate SL based on current price', async () => {
      const signal = createMockSignal({ price: 100, stopLoss: 95 });
      mockBybit.getCurrentPrice.mockResolvedValue(102); // Price moved up

      await service.openPosition(signal);

      const slCall = mockBybit.updateStopLoss.mock.calls[0][0];
      // SL should be: currentPrice (102) - distance (5) = 97
      expect(slCall).toBeCloseTo(97, 1);
    });

    it('should recalculate SHORT SL correctly (add distance)', async () => {
      const signal = createMockSignal({
        direction: SignalDirection.SHORT,
        price: 100,
        stopLoss: 105,
      });
      mockBybit.getCurrentPrice.mockResolvedValue(102);

      await service.openPosition(signal);

      const slCall = mockBybit.updateStopLoss.mock.calls[0][0];
      // SL should be: currentPrice (102) + distance (5) = 107
      expect(slCall).toBeCloseTo(107, 1);
    });

    it('should verify protection after opening', async () => {
      const signal = createMockSignal();

      await service.openPosition(signal);

      expect(mockBybit.verifyProtectionSet).toHaveBeenCalled();
    });

    it('should cancel hanging orders before opening', async () => {
      const signal = createMockSignal();

      await service.openPosition(signal);

      expect(mockBybit.cancelAllConditionalOrders).toHaveBeenCalled();
    });

    it('should create proper Position object with core fields', async () => {
      const signal = createMockSignal();

      const position = await service.openPosition(signal);

      expect(position).toEqual(
        expect.objectContaining({
          symbol: 'APEXUSDT',
          side: PositionSide.LONG,
          quantity: 8.33,
          entryPrice: 100,
          leverage: 10,
          marginUsed: 10,
          reason: 'Position opened', // Generic, not from signal
          protectionVerifiedOnce: true,
          status: 'OPEN',
        }),
      );

      // Verify service doesn't store signal metadata
      expect(position.reason).toBe('Position opened'); // Generic reason, not from signal.reason
      expect(position.confidence).toBeUndefined(); // Not from signal.confidence
      expect(position.strategy).toBeUndefined(); // Not from signal.type
    });

    it('should create unique journal IDs for each position', async () => {
      const signal1 = createMockSignal();
      const signal2 = createMockSignal();

      const position1 = await service.openPosition(signal1);
      const position2 = await service.openPosition(signal2);

      expect(position1.journalId).not.toBe(position2.journalId);
    });
  });

  describe('Protection verification', () => {
    it('should succeed on first verification attempt', async () => {
      const signal = createMockSignal();
      mockBybit.verifyProtectionSet.mockResolvedValue({
        verified: true,
        hasStopLoss: true,
        hasTakeProfit: true,
        stopLossPrice: 95,
        takeProfitPrices: [105, 110, 115],
        activeOrders: 4,
      });

      const position = await service.openPosition(signal);

      expect(mockBybit.verifyProtectionSet).toHaveBeenCalledTimes(1);
      expect(position.protectionVerifiedOnce).toBe(true);
    });

    it('should retry verification up to 3 times on failure', async () => {
      const signal = createMockSignal();
      mockBybit.verifyProtectionSet
        .mockResolvedValueOnce({
          verified: false,
          hasStopLoss: false,
          hasTakeProfit: true,
          activeOrders: 1,
        })
        .mockResolvedValueOnce({
          verified: false,
          hasStopLoss: false,
          hasTakeProfit: true,
          activeOrders: 1,
        })
        .mockResolvedValueOnce({
          verified: true,
          hasStopLoss: true,
          hasTakeProfit: true,
          stopLossPrice: 95,
          takeProfitPrices: [105, 110, 115],
          activeOrders: 4,
        });

      const position = await service.openPosition(signal);

      expect(mockBybit.verifyProtectionSet).toHaveBeenCalledTimes(3);
      expect(position.status).toBe('OPEN');
    });

    it('should retry SL placement when verification fails', async () => {
      const signal = createMockSignal();
      mockBybit.verifyProtectionSet
        .mockResolvedValueOnce({
          verified: false,
          hasStopLoss: false, // Missing
          hasTakeProfit: true,
          activeOrders: 1,
        })
        .mockResolvedValueOnce({
          verified: true,
          hasStopLoss: true,
          hasTakeProfit: true,
          stopLossPrice: 95,
          takeProfitPrices: [105, 110, 115],
          activeOrders: 4,
        });

      await service.openPosition(signal);

      // updateStopLoss should be called twice: once initially, once during retry
      expect(mockBybit.updateStopLoss).toHaveBeenCalledTimes(2);
    });

    it('should fail position opening if protection cannot be verified', async () => {
      const signal = createMockSignal();
      mockBybit.verifyProtectionSet.mockResolvedValue({
        verified: false,
        hasStopLoss: false,
        hasTakeProfit: false,
        activeOrders: 0,
      });

      await expect(service.openPosition(signal)).rejects.toThrow(
        'Failed to set protection',
      );
    });

    it('should emergency close position if protection fails', async () => {
      const signal = createMockSignal();
      mockBybit.verifyProtectionSet.mockResolvedValue({
        verified: false,
        hasStopLoss: false,
        hasTakeProfit: false,
        activeOrders: 0,
      });

      await expect(service.openPosition(signal)).rejects.toThrow();

      expect(mockBybit.closePosition).toHaveBeenCalled();
      expect(mockTelegram.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('EMERGENCY'),
      );
    });

    it('should send critical alert if emergency close fails', async () => {
      const signal = createMockSignal();
      mockBybit.verifyProtectionSet.mockResolvedValue({
        verified: false,
        hasStopLoss: false,
        hasTakeProfit: false,
        activeOrders: 0,
      });
      mockBybit.closePosition.mockRejectedValue(new Error('Close failed'));

      await expect(service.openPosition(signal)).rejects.toThrow();

      expect(mockTelegram.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('MANUAL INTERVENTION'),
      );
    });
  });

  describe('Error handling', () => {
    it('should handle PositionSizingService errors', async () => {
      const signal = createMockSignal();
      mockSizing.calculatePositionSize.mockRejectedValue(
        new Error('Sizing failed'),
      );

      await expect(service.openPosition(signal)).rejects.toThrow('Sizing failed');
    });

    it('should handle openPosition errors gracefully', async () => {
      const signal = createMockSignal();
      mockBybit.openPosition.mockRejectedValue(
        new Error('Exchange error'),
      );

      await expect(service.openPosition(signal)).rejects.toThrow('Exchange error');
    });

    it('should handle cancelAllConditionalOrders errors gracefully', async () => {
      const signal = createMockSignal();
      mockBybit.cancelAllConditionalOrders.mockRejectedValue(
        new Error('Cancel failed'),
      );

      // Should continue despite cancellation failure
      const position = await service.openPosition(signal);
      expect(position).toBeDefined();
    });

    it('should handle TakeProfit placement errors', async () => {
      const signal = createMockSignal();
      mockBybit.placeTakeProfitLevels.mockRejectedValue(
        new Error('TP placement failed'),
      );

      await expect(service.openPosition(signal)).rejects.toThrow('TP placement failed');
    });

    it('should handle updateStopLoss errors', async () => {
      const signal = createMockSignal();
      mockBybit.updateStopLoss.mockRejectedValue(
        new Error('SL update failed'),
      );

      await expect(service.openPosition(signal)).rejects.toThrow('SL update failed');
    });
  });

  describe('Notification and recording', () => {
    it('should send Telegram notification on successful opening', async () => {
      const signal = createMockSignal();

      await service.openPosition(signal);

      expect(mockTelegram.notifyPositionOpened).toHaveBeenCalled();
      const notifyCall = mockTelegram.notifyPositionOpened.mock.calls[0][0];
      expect(notifyCall.side).toBe(PositionSide.LONG);
      expect(notifyCall.entryPrice).toBe(100);
    });

    it('should record trade in journal', async () => {
      const signal = createMockSignal();

      await service.openPosition(signal);

      expect(mockJournal.recordTradeOpen).toHaveBeenCalled();
      const recordCall = mockJournal.recordTradeOpen.mock.calls[0][0];
      expect(recordCall).toEqual(
        expect.objectContaining({
          symbol: 'APEXUSDT',
          side: PositionSide.LONG,
          entryPrice: 100,
          quantity: 8.33,
          leverage: 10,
        }),
      );
    });

    it('should handle Telegram notification errors gracefully', async () => {
      const signal = createMockSignal();
      mockTelegram.notifyPositionOpened.mockRejectedValue(
        new Error('Telegram error'),
      );

      // Should not fail position opening if notification fails
      const position = await service.openPosition(signal);
      expect(position).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Telegram'),
        expect.any(Object),
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle very small position sizes', async () => {
      const signal = createMockSignal();
      mockSizing.calculatePositionSize.mockResolvedValue({
        positionSizeUsdt: 1,
        quantity: 0.01,
        roundedQuantity: '0.010',
        marginUsed: 1,
        notionalValue: 1,
        sizingChain: ['FIXED'],
      });

      const position = await service.openPosition(signal);

      expect(position.quantity).toBe(0.01);
    });

    it('should handle very high leverage', async () => {
      mockTradingConfig.leverage = 100;
      const signal = createMockSignal();

      const position = await service.openPosition(signal);

      expect(position.leverage).toBe(100);
    });

    it('should handle multiple TP levels', async () => {
      const signal = createMockSignal({
        takeProfits: [
          { level: 1, percent: 2, sizePercent: 20, price: 102, hit: false } as TakeProfit,
          { level: 2, percent: 5, sizePercent: 30, price: 105, hit: false } as TakeProfit,
          { level: 3, percent: 10, sizePercent: 30, price: 110, hit: false } as TakeProfit,
          { level: 4, percent: 15, sizePercent: 20, price: 115, hit: false } as TakeProfit,
        ],
      });

      await service.openPosition(signal);

      expect(mockBybit.placeTakeProfitLevels).toHaveBeenCalledWith(
        expect.objectContaining({
          levels: signal.takeProfits,
        }),
      );
    });

    it('should handle price with many decimal places', async () => {
      const signal = createMockSignal({
        price: 123.456789,
        stopLoss: 120.123456,
      });

      const position = await service.openPosition(signal);

      expect(position.entryPrice).toBe(123.456789);
    });
  });

  describe('Multiple positions sequential opening', () => {
    it('should handle opening multiple positions in sequence', async () => {
      const signal1 = createMockSignal({ direction: SignalDirection.LONG });
      const signal2 = createMockSignal({ direction: SignalDirection.SHORT });

      const position1 = await service.openPosition(signal1);
      const position2 = await service.openPosition(signal2);

      expect(position1.journalId).not.toBe(position2.journalId);
      expect(position1.side).toBe(PositionSide.LONG);
      expect(position2.side).toBe(PositionSide.SHORT);
      expect(mockBybit.openPosition).toHaveBeenCalledTimes(2);
    });
  });
});
