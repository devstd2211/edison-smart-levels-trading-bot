import { OrderExecutionPipeline } from '../../services/order-execution-pipeline.service';
import {
  createManagedOrderExecutionPipelineContext,
} from '../helpers/order-execution-pipeline-test.utils';

describe('OrderExecutionPipeline functional', () => {
  it('getMetrics() returns zeroed counters on construction', () => {
    const { pipeline, cleanup } = createManagedOrderExecutionPipelineContext();

    try {
      const metrics = pipeline.getMetrics();

      expect(metrics.totalOrders).toBe(0);
      expect(metrics.successfulOrders).toBe(0);
      expect(metrics.failedOrders).toBe(0);
      expect(metrics.totalRetries).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('resetMetrics() restores zeroed counters after use', async () => {
    const { pipeline, exchange, cleanup } = createManagedOrderExecutionPipelineContext();

    try {
      exchange.placeOrder.mockResolvedValue({ orderId: 'ord-1', price: 45000, filledQuantity: 0.01 });
      exchange.getOrderStatus.mockResolvedValue('FILLED');

      await pipeline.placeOrder({
        symbol: 'BTCUSDT',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 0.01,
        price: 45000,
        timeInForce: 'GTC',
        timestamp: Date.now(),
      });

      pipeline.resetMetrics();
      const metrics = pipeline.getMetrics();

      expect(metrics.totalOrders).toBe(0);
      expect(metrics.successfulOrders).toBe(0);
      expect(metrics.averageExecutionTime).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('calculateSlippage() returns correct percent for known prices', () => {
    const { pipeline, cleanup } = createManagedOrderExecutionPipelineContext();

    try {
      const result = pipeline.calculateSlippage(100, 101);

      expect(result.expectedPrice).toBe(100);
      expect(result.actualPrice).toBe(101);
      expect(result.slippageAmount).toBeCloseTo(1);
      expect(result.slippagePercent).toBeCloseTo(1);
    } finally {
      cleanup();
    }
  });

  it('validateSlippage() returns true when within limits', () => {
    const { pipeline, cleanup } = createManagedOrderExecutionPipelineContext();

    try {
      expect(pipeline.validateSlippage(0.3, { slippagePercent: 0.5 })).toBe(true);
      expect(pipeline.validateSlippage(0.5, { slippagePercent: 0.5 })).toBe(true);
      expect(pipeline.validateSlippage(0.6, { slippagePercent: 0.5 })).toBe(false);
    } finally {
      cleanup();
    }
  });

  describe('export boundary', () => {
    it('OrderExecutionPipeline is a constructible class', () => {
      expect(typeof OrderExecutionPipeline).toBe('function');
    });
  });
});
