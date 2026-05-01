import { createManagedPositionScalingContext } from '../helpers/position-scaling-test.utils';

describe('PositionScalingService functional behavior', () => {
  it('scales into profit and then protects the position at breakeven', async () => {
    const { service, position, cleanup } = createManagedPositionScalingContext();

    const scale = await service.shouldScale(position);
    expect(scale.action).toBe('add');
    expect(scale.size).toBeGreaterThan(0);

    const riskReduction = await service.reduceRiskOnProfit(position);
    expect(riskReduction.newStopLoss).toBe(position.entryPrice);
    expect(riskReduction.reasoning).toContain('breakeven');

    cleanup();
  });
});
