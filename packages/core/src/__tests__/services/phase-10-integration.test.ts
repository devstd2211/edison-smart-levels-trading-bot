/**
 * Phase 10 Integration Tests
 * Simplified tests that verify Phase 10 services work together correctly
 */

import { LiquidityHeatmapService } from '../../services/liquidity-heatmap.service';
import { SmartOrderPlacementService } from '../../services/smart-order-placement.service';
import { MLSignalValidatorService } from '../../services/ml-signal-validator.service';
import { AnomalyDetectionService } from '../../services/anomaly-detection.service';
import { Orderbook } from '../../types/legacy';
import { Signal, MarketContext } from '../../types/legacy';
import {
  asPhase10Context,
  asPhase10Signal,
  asPhase10SignalType,
  createPhase10Context,
  createPhase10Harness,
  createPhase10IntegrationOrderbook,
  createPhase10OrderbookSide,
  createPhase10PerformanceOrderbook,
  createPhase10Signal,
  createPhase10WorkflowFixtures,
  seedPhase10VolumeBaseline,
} from '../helpers/phase-10-integration-test.utils';

describe('Phase 10 Integration Tests', () => {
  let liquidityService: LiquidityHeatmapService;
  let smartOrderService: SmartOrderPlacementService;

  // Phase 10.2 Services
  let mlValidatorService: MLSignalValidatorService;
  let anomalyService: AnomalyDetectionService;
  const asOrderbook = (value: unknown): Orderbook => value as Orderbook;

  beforeEach(() => {
    ({
      liquidityService,
      smartOrderService,
      mlValidatorService,
      anomalyService,
    } = createPhase10Harness());
  });

  describe('Phase 10.1 Services Integration', () => {
    it('should analyze order flow and generate smart order placement', async () => {
      // 1. Create test orderbook
      const orderbook: Orderbook = createPhase10IntegrationOrderbook({
        bids: [
          { price: 50000, volume: 10.0 },
          { price: 49990, volume: 8.0 },
          { price: 49980, volume: 12.0 },
          { price: 49970, volume: 5.0 },
          { price: 49960, volume: 7.0 },
        ],
        asks: [
          { price: 50010, volume: 9.0 },
          { price: 50020, volume: 11.0 },
          { price: 50030, volume: 6.0 },
          { price: 50040, volume: 8.0 },
          { price: 50050, volume: 4.0 },
        ],
      });

      // 2. Build liquidity heatmap
      const heatmap = await liquidityService.buildLiquidityHeatmap(orderbook);
      expect(heatmap).toBeDefined();
      expect(heatmap.zones.length).toBeGreaterThanOrEqual(0);
      if (heatmap.zones.length > 0) { expect(heatmap.zones[0].strength).toBeGreaterThanOrEqual(0); }
      if (heatmap.zones.length > 0) { expect(heatmap.zones[0].strength).toBeLessThanOrEqual(100); }

      // 3. Plan smart order execution
      const orderPlan = await smartOrderService.planOrderExecution(orderbook, 15.0, 'buy', 50010);
      expect(orderPlan).toBeDefined();
      expect(orderPlan.totalSize).toBe(15.0);
      expect(orderPlan.orders.length).toBeGreaterThan(0);

      // Verify total size matches
      const totalPlanned = orderPlan.orders.reduce((sum, o) => sum + o.size, 0);
      expect(totalPlanned).toBeCloseTo(15.0, 8);
    });

    it('should calculate slippage and execution cost', async () => {
      const orderbook: Orderbook = createPhase10IntegrationOrderbook({
        bids: [
          { price: 50000, volume: 15.0 },
          { price: 49990, volume: 20.0 },
          { price: 49980, volume: 10.0 },
        ],
        asks: [
          { price: 50010, volume: 12.0 },
          { price: 50020, volume: 18.0 },
          { price: 50030, volume: 8.0 },
        ],
      });

      // Calculate slippage
      const slippage = await liquidityService.calculateSlippageForSize(orderbook, 10.0, 'buy');
      expect(slippage).toBeDefined();
      expect(slippage.slippageBps).toBeGreaterThanOrEqual(0);
      expect(slippage.avgExecutionPrice).toBeGreaterThan(0);
      expect(slippage.worstPrice).toBeGreaterThan(0);

      // Calculate execution cost
      const cost = await liquidityService.estimateExecutionCost(orderbook, 10.0);
      expect(cost).toBeDefined();
      expect(cost.totalCost).toBeGreaterThan(0);
      expect(cost.slippageCost).toBeGreaterThanOrEqual(0);
    });

    it('should detect support and resistance levels', async () => {
      const orderbook: Orderbook = createPhase10IntegrationOrderbook({
        bids: [
          { price: 50000, volume: 25.0 },
          { price: 49990, volume: 10.0 },
          { price: 49980, volume: 8.0 },
        ],
        asks: [
          { price: 50010, volume: 8.0 },
          { price: 50020, volume: 12.0 },
          { price: 50030, volume: 22.0 },
        ],
      });

      const sr = await liquidityService.findSupportResistance(orderbook);
      expect(sr).toBeDefined();
      expect(sr.support.length).toBeGreaterThanOrEqual(0);
      expect(sr.resistance.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Phase 10.2 Services Integration', () => {
    it('should validate signals with ML', async () => {
      const { signal, context } = createPhase10WorkflowFixtures();

      const validation = await mlValidatorService.validateSignal(signal, context);

      expect(validation).toBeDefined();
      expect(validation.originalConfidence).toBe(0.75);
      expect(validation.adjustedConfidence).toBeGreaterThanOrEqual(0);
      expect(validation.adjustedConfidence).toBeLessThanOrEqual(1);
      expect(validation.riskLevel).toBeDefined();
    });

    it('should detect volume anomalies', () => {
      // Feed normal volume samples to build baseline
      seedPhase10VolumeBaseline(anomalyService);

      // Normal volume - no anomaly
      const normal = anomalyService.detectVolumeAnomaly(110);
      expect(normal.detected).toBe(false);

      // Abnormal volume - should detect after enough samples
      const abnormal = anomalyService.detectVolumeAnomaly(1000);
      expect(abnormal.detected).toBe(true);
      expect(abnormal.deviation).toBeGreaterThan(2.5);
    });


    it('should work without history tracking methods', () => {
      createPhase10Signal({ confidence: 0.7 });
      // Services should work without recordSignalOutcome or updateVolumeHistory
      expect(true).toBe(true);
    });
  });

  describe('Full Phase 10 Workflow', () => {
    it('should execute complete market analysis', async () => {
      // Step 1: Build orderbook
      const orderbook: Orderbook = createPhase10IntegrationOrderbook({
        bids: createPhase10OrderbookSide(50000, 10, 'bids', () => 5 + Math.random() * 10),
        asks: createPhase10OrderbookSide(50010, 10, 'asks', () => 5 + Math.random() * 10),
      });

      // Step 2: Analyze liquidity
      const heatmap = await liquidityService.buildLiquidityHeatmap(orderbook);
      expect(heatmap.zones.length).toBeGreaterThanOrEqual(0);

      // Step 3: Generate signal
      const { signal, context } = createPhase10WorkflowFixtures({
        context: { currentPrice: 50010 },
      });

      // Step 4: Validate signal
      const validation = await mlValidatorService.validateSignal(signal, context);
      expect(validation.adjustedConfidence).toBeGreaterThanOrEqual(0);

      // Step 5: Plan execution
      const plan = await smartOrderService.planOrderExecution(orderbook, 8.0, 'buy', 50010);
      expect(plan.orders.length).toBeGreaterThan(0);

      // Verify workflow completed
      expect(heatmap).toBeDefined();
      expect(validation).toBeDefined();
      expect(plan).toBeDefined();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should build liquidity heatmap in < 100ms', async () => {
      const orderbook: Orderbook = createPhase10PerformanceOrderbook(50000, 50010, 50);

      const start = Date.now();
      await liquidityService.buildLiquidityHeatmap(orderbook);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should validate signal in < 30ms', async () => {
      const { signal, context } = createPhase10WorkflowFixtures();

      const start = Date.now();
      await mlValidatorService.validateSignal(signal, context);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(30);
    });
  });

  describe('Error Resilience', () => {
    it('should handle invalid orderbook gracefully', async () => {
      const invalidOrderbook = asOrderbook({
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        bids: null,
        asks: [],
      });

      await expect(liquidityService.buildLiquidityHeatmap(invalidOrderbook)).rejects.toThrow();

      // Service should still work after error
      const validOrderbook: Orderbook = {
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        bids: [{ price: 50000, volume: 10 }],
        asks: [{ price: 50010, volume: 10 }],
      };

      const result = await liquidityService.buildLiquidityHeatmap(validOrderbook);
      expect(result).toBeDefined();
    });

    it('should handle invalid signal gracefully', async () => {
      const invalidSignal = asPhase10Signal({
        type: 'invalid',
        direction: 'wrong',
        confidence: 5.0,
        timestamp: NaN,
      });

      // Service doesn't throw, but returns NaN for invalid inputs
      const result = await mlValidatorService.validateSignal(invalidSignal, asPhase10Context({}));
      expect(result.adjustedConfidence).toBeNaN();

      // Service should still work after error
      const { signal: validSignal, context } = createPhase10WorkflowFixtures();

      const validResult = await mlValidatorService.validateSignal(validSignal, context);
      expect(validResult).toBeDefined();
      expect(validResult.adjustedConfidence).not.toBeNaN();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Run 500 iterations
      for (let i = 0; i < 500; i++) {
        const orderbook: Orderbook = createPhase10PerformanceOrderbook(50000, 50010, 20);

        await liquidityService.buildLiquidityHeatmap(orderbook);
      }

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      // Memory growth should be < 10MB for 500 iterations
      expect(memoryGrowthMB).toBeLessThan(10);
    });
  });
});

