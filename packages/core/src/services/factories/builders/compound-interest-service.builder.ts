import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { CompoundInterestCalculatorService } from '../../compound-interest-calculator.service';

export const initializeCompoundInterestService = (
  state: BotServicesState,
  config: Config,
): void => {
  if (!config.compoundInterest?.enabled) {
    return;
  }

  state.compoundInterestCalculator = new CompoundInterestCalculatorService(
    config.compoundInterest,
    state.logger,
    async () => {
      if (config.compoundInterest?.useVirtualBalance) {
        return state.journal.getVirtualBalance();
      }

      const balance = await state.bybitService.getBalance();
      return balance.walletBalance;
    },
  );
};
