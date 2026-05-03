import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { RetestEntryService } from '../../retest-entry.service';

export const initializeRetestEntryService = (
  state: BotServicesState,
  config: Config,
): void => {
  if (!config.retestEntry?.enabled) {
    return;
  }

  state.retestEntryService = new RetestEntryService(
    config.retestEntry,
    state.logger,
  );
};
