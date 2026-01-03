/**
 * Tests for MarketDataCollector Service
 *
 * Tests data collection from multiple sources:
 * - Current price
 * - RSI data
 * - EMA data
 * - ZigZag swing points
 * - Market structure
 */

import { MarketDataCollector } from '../../services/market-data-collector.service';
import { MultiTimeframeRSIAnalyzer } from '../../analyzers/multi-timeframe-rsi.analyzer';
import { MultiTimeframeEMAAnalyzer } from '../../analyzers/multi-timeframe-ema.analyzer';
import { ZigZagIndicator } from '../../indicators/zigzag.indicator';
import { MarketStructureAnalyzer } from '../../analyzers/market-structure.analyzer';
import { CandleProvider } from '../../providers/candle.provider';
import { BybitService } from '../../services/bybit';
import {
  LoggerService,
  LogLevel,
  TimeframeRole,
  SwingPointType,
  Candle,
  TrendBias,
} from '../../types';

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

const createMockCandle = (price: number, timestamp: number): Candle => ({
  timestamp,
  open: price,
  high: price * 1.01,
  low: price * 0.99,
  close: price,
  volume: 10000,
});

const createMockSwingPoints = () => ({
  highs: [
    { price: 1.55, timestamp: 1000000, type: SwingPointType.HIGH },
    { price: 1.60, timestamp: 1000002, type: SwingPointType.HIGH },
  ],
  lows: [
    { price: 1.45, timestamp: 1000001, type: SwingPointType.LOW },
    { price: 1.50, timestamp: 1000003, type: SwingPointType.LOW },
  ],
});

const createMockRSIData = () => ({
  primary: 65.5,
  entry: 68.2,
  trend1: 62.3,
  trend2: 60.1,
});

const createMockEMAData = () => ({
  primary: { fast: 1.48, slow: 1.45 },
  entry: { fast: 1.49, slow: 1.46 },
  trend1: { fast: 1.47, slow: 1.44 },
});

// ============================================================================
// TESTS
// ============================================================================

describe('MarketDataCollector', () => {
  let collector: MarketDataCollector;
  let mockRSIAnalyzer: jest.Mocked<MultiTimeframeRSIAnalyzer>;
  let mockEMAAnalyzer: jest.Mocked<MultiTimeframeEMAAnalyzer>;
  let mockZigZagIndicator: jest.Mocked<ZigZagIndicator>;
  let mockStructureAnalyzer: jest.Mocked<MarketStructureAnalyzer>;
  let mockCandleProvider: jest.Mocked<CandleProvider>;
  let mockBybitService: jest.Mocked<BybitService>;
  let logger: LoggerService;

  beforeEach(() => {
    // Create logger
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    // Create mocks
    mockRSIAnalyzer = {
      calculateAll: jest.fn(),
    } as any;

    mockEMAAnalyzer = {
      calculateAll: jest.fn(),
    } as any;

    mockZigZagIndicator = {
      findSwingHighs: jest.fn(),
      findSwingLows: jest.fn(),
    } as any;

    mockStructureAnalyzer = {
      getLastPattern: jest.fn(),
      getTrendBias: jest.fn(),
    } as any;

    mockCandleProvider = {
      getCandles: jest.fn(),
    } as any;

    mockBybitService = {
      getCurrentPrice: jest.fn(),
    } as any;

    // Create mock config
    const mockConfig = {
      indicators: {
        rsiPeriod: 14,
        fastEmaPeriod: 20,
        slowEmaPeriod: 50,
        atrPeriod: 14,
        stochastic: {
          enabled: false, // Disabled for existing tests
        },
        bollingerBands: {
          enabled: false, // Disabled for existing tests
        },
      },
    } as any;

    // Create collector
    collector = new MarketDataCollector(
      mockRSIAnalyzer,
      mockEMAAnalyzer,
      mockZigZagIndicator,
      mockStructureAnalyzer,
      mockCandleProvider,
      mockBybitService,
      logger,
      mockConfig,
    );
  });

  // ==========================================================================
  // GROUP 1: collect() - Happy Path
  // ==========================================================================

  describe('collect()', () => {
    it('should collect all market data successfully', async () => {
      // Arrange
      const mockPrice = 1.50;
      const mockRSI = createMockRSIData();
      const mockEMA = createMockEMAData();
      const mockCandles = [
        createMockCandle(1.48, 1000),
        createMockCandle(1.50, 2000),
        createMockCandle(1.52, 3000),
      ];
      const mockSwings = createMockSwingPoints();

      mockBybitService.getCurrentPrice.mockResolvedValue(mockPrice);
      mockRSIAnalyzer.calculateAll.mockResolvedValue(mockRSI);
      mockEMAAnalyzer.calculateAll.mockResolvedValue(mockEMA);
      mockCandleProvider.getCandles.mockResolvedValue(mockCandles);
      mockZigZagIndicator.findSwingHighs.mockReturnValue(mockSwings.highs);
      mockZigZagIndicator.findSwingLows.mockReturnValue(mockSwings.lows);
      mockStructureAnalyzer.getLastPattern.mockReturnValue('HH_HL');
      mockStructureAnalyzer.getTrendBias.mockReturnValue(TrendBias.BULLISH);

      // Act
      const result = await collector.collect();

      // Assert
      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        currentPrice: mockPrice,
        rsi: mockRSI,
        ema: mockEMA,
        zigzagHighs: mockSwings.highs,
        zigzagLows: mockSwings.lows,
        candles: mockCandles,
        pattern: 'HH_HL',
        bias: TrendBias.BULLISH,
      });

      // Verify all services called
      expect(mockBybitService.getCurrentPrice).toHaveBeenCalledTimes(1);
      expect(mockRSIAnalyzer.calculateAll).toHaveBeenCalledTimes(1);
      expect(mockEMAAnalyzer.calculateAll).toHaveBeenCalledTimes(1);
      expect(mockCandleProvider.getCandles).toHaveBeenCalledWith(TimeframeRole.PRIMARY);
      expect(mockZigZagIndicator.findSwingHighs).toHaveBeenCalledWith(mockCandles);
      expect(mockZigZagIndicator.findSwingLows).toHaveBeenCalledWith(mockCandles);
      expect(mockStructureAnalyzer.getLastPattern).toHaveBeenCalledWith(
        mockSwings.highs,
        mockSwings.lows,
      );
      expect(mockStructureAnalyzer.getTrendBias).toHaveBeenCalledWith(
        mockSwings.highs,
        mockSwings.lows,
      );
    });

    it('should return null when no PRIMARY candles available', async () => {
      // Arrange
      mockBybitService.getCurrentPrice.mockResolvedValue(1.50);
      mockRSIAnalyzer.calculateAll.mockResolvedValue(createMockRSIData());
      mockEMAAnalyzer.calculateAll.mockResolvedValue(createMockEMAData());
      mockCandleProvider.getCandles.mockResolvedValue([] as Candle[]); // No candles

      // Act
      const result = await collector.collect();

      // Assert
      expect(result).toBeNull();
      expect(mockCandleProvider.getCandles).toHaveBeenCalledWith(TimeframeRole.PRIMARY);
      // ZigZag should not be called if no candles
      expect(mockZigZagIndicator.findSwingHighs).not.toHaveBeenCalled();
      expect(mockZigZagIndicator.findSwingLows).not.toHaveBeenCalled();
    });

    it('should return null when PRIMARY candles array is empty', async () => {
      // Arrange
      mockBybitService.getCurrentPrice.mockResolvedValue(1.50);
      mockRSIAnalyzer.calculateAll.mockResolvedValue(createMockRSIData());
      mockEMAAnalyzer.calculateAll.mockResolvedValue(createMockEMAData());
      mockCandleProvider.getCandles.mockResolvedValue([]); // Empty array

      // Act
      const result = await collector.collect();

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when getCurrentPrice throws', async () => {
      // Arrange
      mockBybitService.getCurrentPrice.mockRejectedValue(new Error('Network error'));

      // Act
      const result = await collector.collect();

      // Assert
      expect(result).toBeNull();
      expect(mockBybitService.getCurrentPrice).toHaveBeenCalledTimes(1);
    });

    it('should continue if rsiAnalyzer returns null', async () => {
      // Arrange
      const mockPrice = 1.50;
      const mockEMA = createMockEMAData();
      const mockCandles = [createMockCandle(1.50, 1000)];
      const mockSwings = createMockSwingPoints();

      mockBybitService.getCurrentPrice.mockResolvedValue(mockPrice);
      mockRSIAnalyzer.calculateAll.mockResolvedValue({} as any); // RSI returns empty
      mockEMAAnalyzer.calculateAll.mockResolvedValue(mockEMA);
      mockCandleProvider.getCandles.mockResolvedValue(mockCandles);
      mockZigZagIndicator.findSwingHighs.mockReturnValue(mockSwings.highs);
      mockZigZagIndicator.findSwingLows.mockReturnValue(mockSwings.lows);
      mockStructureAnalyzer.getLastPattern.mockReturnValue('LH_LL');
      mockStructureAnalyzer.getTrendBias.mockReturnValue(TrendBias.BEARISH);

      // Act
      const result = await collector.collect();

      // Assert
      expect(result).not.toBeNull();
      expect(result!.rsi).toEqual({});
      expect(result!.ema).toEqual(mockEMA);
    });

    it('should continue if emaAnalyzer returns null', async () => {
      // Arrange
      const mockPrice = 1.50;
      const mockRSI = createMockRSIData();
      const mockCandles = [createMockCandle(1.50, 1000)];
      const mockSwings = createMockSwingPoints();

      mockBybitService.getCurrentPrice.mockResolvedValue(mockPrice);
      mockRSIAnalyzer.calculateAll.mockResolvedValue(mockRSI);
      mockEMAAnalyzer.calculateAll.mockResolvedValue({} as any); // EMA returns empty
      mockCandleProvider.getCandles.mockResolvedValue(mockCandles);
      mockZigZagIndicator.findSwingHighs.mockReturnValue(mockSwings.highs);
      mockZigZagIndicator.findSwingLows.mockReturnValue(mockSwings.lows);
      mockStructureAnalyzer.getLastPattern.mockReturnValue('FLAT');
      mockStructureAnalyzer.getTrendBias.mockReturnValue(TrendBias.NEUTRAL);

      // Act
      const result = await collector.collect();

      // Assert
      expect(result).not.toBeNull();
      expect(result!.rsi).toEqual(mockRSI);
      expect(result!.ema).toEqual({});
    });
  });

  // ==========================================================================
  // GROUP 2: getCurrentPrice()
  // ==========================================================================

  describe('getCurrentPrice()', () => {
    it('should return current price from bybit service', async () => {
      // Arrange
      const expectedPrice = 1.5678;
      mockBybitService.getCurrentPrice.mockResolvedValue(expectedPrice);

      // Act
      const result = await collector.getCurrentPrice();

      // Assert
      expect(result).toBe(expectedPrice);
      expect(mockBybitService.getCurrentPrice).toHaveBeenCalledTimes(1);
    });

    it('should throw when bybit service throws', async () => {
      // Arrange
      const error = new Error('Connection timeout');
      mockBybitService.getCurrentPrice.mockRejectedValue(error);

      // Act & Assert
      await expect(collector.getCurrentPrice()).rejects.toThrow('Connection timeout');
    });
  });

  // ==========================================================================
  // GROUP 3: getRSIData()
  // ==========================================================================

  describe('getRSIData()', () => {
    it('should return RSI data from analyzer', async () => {
      // Arrange
      const mockRSI = createMockRSIData();
      mockRSIAnalyzer.calculateAll.mockResolvedValue(mockRSI);

      // Act
      const result = await collector.getRSIData();

      // Assert
      expect(result).toEqual(mockRSI);
      expect(mockRSIAnalyzer.calculateAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty object when RSI analyzer has issues', async () => {
      // Arrange
      mockRSIAnalyzer.calculateAll.mockResolvedValue({} as any);

      // Act
      const result = await collector.getRSIData();

      // Assert
      expect(result).toEqual({});
    });
  });

  // ==========================================================================
  // GROUP 4: getEMAData()
  // ==========================================================================

  describe('getEMAData()', () => {
    it('should return EMA data from analyzer', async () => {
      // Arrange
      const mockEMA = createMockEMAData();
      mockEMAAnalyzer.calculateAll.mockResolvedValue(mockEMA);

      // Act
      const result = await collector.getEMAData();

      // Assert
      expect(result).toEqual(mockEMA);
      expect(mockEMAAnalyzer.calculateAll).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // GROUP 5: getZigZagData()
  // ==========================================================================

  describe('getZigZagData()', () => {
    it('should return highs and lows from zigzag indicator', () => {
      // Arrange
      const mockCandles = [
        createMockCandle(1.48, 1000),
        createMockCandle(1.50, 2000),
        createMockCandle(1.52, 3000),
      ];
      const mockSwings = createMockSwingPoints();
      mockZigZagIndicator.findSwingHighs.mockReturnValue(mockSwings.highs);
      mockZigZagIndicator.findSwingLows.mockReturnValue(mockSwings.lows);

      // Act
      const result = collector.getZigZagData(mockCandles);

      // Assert
      expect(result).toEqual({
        highs: mockSwings.highs,
        lows: mockSwings.lows,
      });
      expect(mockZigZagIndicator.findSwingHighs).toHaveBeenCalledWith(mockCandles);
      expect(mockZigZagIndicator.findSwingLows).toHaveBeenCalledWith(mockCandles);
    });

    it('should return empty arrays when zigzag finds no swings', () => {
      // Arrange
      const mockCandles = [createMockCandle(1.50, 1000)];
      mockZigZagIndicator.findSwingHighs.mockReturnValue([]);
      mockZigZagIndicator.findSwingLows.mockReturnValue([]);

      // Act
      const result = collector.getZigZagData(mockCandles);

      // Assert
      expect(result).toEqual({
        highs: [],
        lows: [],
      });
    });
  });
});
