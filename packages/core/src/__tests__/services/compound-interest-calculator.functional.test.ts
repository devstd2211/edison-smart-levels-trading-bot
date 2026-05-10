import { ICONS } from '../../cli/cli-runtime';
import { CompoundInterestCalculatorService } from '../../services/compound-interest-calculator.service';
import { createCompoundInterestConfig } from '../helpers/compound-interest-calculator-test.utils';

describe('CompoundInterestCalculatorService - Functional behavior', () => {
  it('applies protection and limit logs through shared icons', async () => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const getBalance = jest.fn<Promise<number>, []>()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(10000);
    const service = new CompoundInterestCalculatorService(
      createCompoundInterestConfig({ maxRiskPerTrade: 100 }),
      logger as unknown as ConstructorParameters<typeof CompoundInterestCalculatorService>[1],
      getBalance,
    );

    const protectedResult = await service.calculatePositionSize();
    const cappedResult = await service.calculatePositionSize();

    expect(protectedResult.protectionActive).toBe(true);
    expect(cappedResult.limitApplied).toBe('max');
    expect(logger.info).toHaveBeenCalledWith(
      `${ICONS.success} CompoundInterestCalculator initialized`,
      expect.objectContaining({
        enabled: true,
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      `${ICONS.warning} Deposit protection active`,
      expect.objectContaining({
        protectionActive: true,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      `${ICONS.warning} Position limit applied: max`,
      expect.objectContaining({
        limitApplied: 'max',
      }),
    );
  });
});
