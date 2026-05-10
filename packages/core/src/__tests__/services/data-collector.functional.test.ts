import { ICONS } from '../../cli/cli-runtime';
import { DataCollectorService } from '../../services/data-collector.service';
import { createManagedDataCollectorContext } from '../helpers/data-collector-test.utils';

describe('DataCollectorService - Functional behavior', () => {
  it('routes subscription, candle, and unhandled messages through shared icon logs', () => {
    const { service, logger, cleanup } = createManagedDataCollectorContext();
    const runtime = service as unknown as {
      handleWebSocketMessage: (data: string) => void;
    };

    try {
      runtime.handleWebSocketMessage(JSON.stringify({
        op: 'subscribe',
        success: true,
        conn_id: 'abc-123',
      }));
      runtime.handleWebSocketMessage(JSON.stringify({
        topic: 'kline.1.BTCUSDT',
        type: 'snapshot',
        data: [{
          start: 0,
          end: 1710000000000,
          interval: '1',
          open: '100',
          close: '110',
          high: '115',
          low: '95',
          volume: '10',
          turnover: '1000',
          confirm: true,
          timestamp: 1710000000000,
        }],
        ts: 1710000000000,
      }));
      runtime.handleWebSocketMessage(JSON.stringify({
        foo: 'bar',
      }));

      expect(service.getQueueSizes().candles).toBe(1);
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.success} Subscription confirmed`,
        expect.objectContaining({
          conn_id: 'abc-123',
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.chart} 1m candle received`,
        expect.objectContaining({
          symbol: 'BTCUSDT',
        }),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        `${ICONS.warning} Unhandled message`,
        expect.objectContaining({
          keys: 'foo',
        }),
      );
    } finally {
      cleanup();
    }
  });
});
