import { ICONS } from '../../cli/cli-runtime';
import {
  createManagedOrderFlowAnalyzerContext,
  createOrderFlowUpdateSeries,
} from '../helpers/order-flow-analyzer-test.utils';

describe('OrderFlowAnalyzerService - Functional behavior', () => {
  it('records aggressive buy flow and logs through shared icons', () => {
    const { service, logger, cleanup } = createManagedOrderFlowAnalyzerContext();

    try {
      const [before, after] = createOrderFlowUpdateSeries([
        [1.0, 100, 1.001, 100],
        [1.001, 100, 1.002, 50],
      ]);

      service.processOrderbookUpdate(before);
      service.processOrderbookUpdate(after);

      expect(service.getFlowHistory()).toHaveLength(1);
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.success} OrderFlowAnalyzerService initialized`,
        expect.objectContaining({
          aggressiveBuyThreshold: 3,
        }),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        `${ICONS.chart} Aggressive BUY detected`,
        expect.objectContaining({
          volumeUSDT: expect.any(String),
        }),
      );
    } finally {
      cleanup();
    }
  });
});
