import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { RetestEntryService } from '../../retest-entry.service';

export const initializeRetestEntryService = (
  state: BotServiceState,
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
