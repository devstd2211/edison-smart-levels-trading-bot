import type { BotServicesState } from '../../bot-services.builder';
import { LadderExitDetectorService } from '../../ladder-exit-detector.service';

export const initializeLadderExitDetectorService = (
  state: BotServicesState,
): void => {
  state.ladderExitDetector = new LadderExitDetectorService(
    state.logger,
    state.bybitService,
    state.errorHandler,
  );
  state.logger.debug('\u2705 Ladder Exit Detector initialized (Phase 8.9.27)', {
    hasErrorHandler: !!state.errorHandler,
  });
};
