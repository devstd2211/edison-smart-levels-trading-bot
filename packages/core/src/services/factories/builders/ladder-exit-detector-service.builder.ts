import type { BotServiceState } from '../../bot-services.builder';
import { LadderExitDetectorService } from '../../ladder-exit-detector.service';
import { ICONS } from '../../../cli/cli-runtime';

export const initializeLadderExitDetectorService = (
  state: BotServiceState,
): void => {
  state.ladderExitDetector = new LadderExitDetectorService(
    state.logger,
    state.bybitService,
    state.errorHandler,
  );
  state.logger.debug(`${ICONS.success} Ladder Exit Detector initialized (Phase 8.9.27)`, {
    hasErrorHandler: !!state.errorHandler,
  });
};
