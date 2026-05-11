import { SignalDirection } from '../../types/legacy';
import {
  attachLimitOrderRestClient,
  createLimitOrderExecutorConfig,
  createLimitOrderStatusRecord,
  createManagedLimitOrderExecutorContext,
} from '../helpers/limit-order-executor-test.utils';

describe('LimitOrderExecutorService functional behavior', () => {
  it('completes a maker-fill path and returns a filled limit result', async () => {
    const { service, bybitService, cleanup } = createManagedLimitOrderExecutorContext({
      config: createLimitOrderExecutorConfig({ maxRetries: 1 }),
      withErrorHandler: false,
    });
    const restClient = attachLimitOrderRestClient(bybitService);

    restClient.submitOrder.mockResolvedValue({
      retCode: 0,
      result: { orderId: 'limit-filled' },
    });
    restClient.getActiveOrders.mockResolvedValue({
      retCode: 0,
      result: { list: [] },
    });
    restClient.getHistoricOrders.mockResolvedValue({
      retCode: 0,
      result: {
        list: [createLimitOrderStatusRecord({ orderId: 'limit-filled', avgPrice: '99.98' })],
      },
    });

    const result = await service.executeEntry(SignalDirection.LONG, 10, 100, 5);

    expect(result).toEqual(
      expect.objectContaining({
        orderId: 'limit-filled',
        filled: true,
        fillPrice: 99.98,
      }),
    );
    expect('feePaid' in result ? result.feePaid : 0).toBeCloseTo(0.09998, 5);

    cleanup();
  });

  it('cancels a stale limit order and falls back to market execution when enabled', async () => {
    const { service, bybitService, createService, config, cleanup } = createManagedLimitOrderExecutorContext({
      config: createLimitOrderExecutorConfig({ maxRetries: 1 }),
      withErrorHandler: false,
    });
    const restClient = attachLimitOrderRestClient(bybitService);

    restClient.submitOrder.mockResolvedValue({
      retCode: 0,
      result: { orderId: 'limit-timeout' },
    });
    restClient.getActiveOrders.mockResolvedValue({
      retCode: 0,
      result: { list: [createLimitOrderStatusRecord({ orderId: 'limit-timeout', orderStatus: 'New' })] },
    });
    restClient.cancelOrder.mockResolvedValue({
      retCode: 0,
      result: {},
    });
    restClient.getHistoricOrders.mockResolvedValue({
      retCode: 0,
      result: {
        list: [createLimitOrderStatusRecord({ orderId: 'market-fallback', avgPrice: '100.05' })],
      },
    });
    (bybitService.openPosition as jest.Mock).mockResolvedValue('market-fallback');

    const timeoutService = createService({
      config: { ...config, timeoutMs: 500 },
    });

    const result = await timeoutService.executeEntry(SignalDirection.LONG, 10, 100, 5);

    expect(result).toEqual(
      expect.objectContaining({
        orderId: 'market-fallback',
        filled: true,
        fillPrice: 100.05,
      }),
    );
    expect(restClient.cancelOrder).toHaveBeenCalledWith({
      category: 'linear',
      symbol: 'APEXUSDT',
      orderId: 'limit-timeout',
    });

    cleanup();
  });
});
