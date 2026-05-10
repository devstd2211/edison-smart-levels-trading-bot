import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { DeltaAnalyzerService } from '../../delta-analyzer.service';
import { ICONS } from '../../../cli/cli-runtime';

export const initializeDeltaAnalyzerService = (
  state: BotServiceState,
  config: Config,
): void => {
  if (!config.delta?.enabled) {
    return;
  }

  state.deltaAnalyzerService = new DeltaAnalyzerService(
    config.delta,
    state.logger,
  );
  state.logger.info(`${ICONS.success} Delta Analyzer initialized`, {
    windowMs: config.delta.windowSizeMs,
    threshold: config.delta.minDeltaThreshold,
  });
};
