import type { OrderBookAnalysis } from '../../types/legacy';
import type { WhaleDetectorConfig } from '../whale-detection.service';

export function getWhaleConfigValidationError(
  config: WhaleDetectorConfig,
): string | null {
  if (!config || typeof config !== 'object') {
    return 'Config must be a valid object';
  }

  if (config.modes?.wallBreak) {
    const wb = config.modes.wallBreak;
    if (typeof wb.enabled !== 'boolean') {
      return 'wallBreak.enabled must be a boolean';
    }

    if (typeof wb.minWallSize !== 'number' || wb.minWallSize < 0) {
      return 'wallBreak.minWallSize must be non-negative number';
    }

    if (typeof wb.breakConfirmationMs !== 'number' || wb.breakConfirmationMs < 0) {
      return 'wallBreak.breakConfirmationMs must be non-negative number';
    }

    if (typeof wb.maxConfidence !== 'number' || wb.maxConfidence < 0 || wb.maxConfidence > 100) {
      return 'wallBreak.maxConfidence must be between 0 and 100';
    }
  }

  if (config.modes?.wallDisappearance) {
    const wd = config.modes.wallDisappearance;
    if (typeof wd.enabled !== 'boolean') {
      return 'wallDisappearance.enabled must be a boolean';
    }

    if (typeof wd.minWallSize !== 'number' || wd.minWallSize < 0) {
      return 'wallDisappearance.minWallSize must be non-negative number';
    }

    if (typeof wd.maxConfidence !== 'number' || wd.maxConfidence < 0 || wd.maxConfidence > 100) {
      return 'wallDisappearance.maxConfidence must be between 0 and 100';
    }
  }

  if (config.modes?.imbalanceSpike) {
    const is = config.modes.imbalanceSpike;
    if (typeof is.enabled !== 'boolean') {
      return 'imbalanceSpike.enabled must be a boolean';
    }

    if (typeof is.minRatioChange !== 'number' || is.minRatioChange <= 0) {
      return 'imbalanceSpike.minRatioChange must be positive number';
    }

    if (typeof is.maxConfidence !== 'number' || is.maxConfidence < 0 || is.maxConfidence > 100) {
      return 'imbalanceSpike.maxConfidence must be between 0 and 100';
    }
  }

  if (typeof config.maxImbalanceHistory !== 'number' || config.maxImbalanceHistory <= 0) {
    return 'maxImbalanceHistory must be positive number';
  }

  if (typeof config.wallExpiryMs !== 'number' || config.wallExpiryMs < 0) {
    return 'wallExpiryMs must be non-negative number';
  }

  if (typeof config.breakExpiryMs !== 'number' || config.breakExpiryMs < 0) {
    return 'breakExpiryMs must be non-negative number';
  }

  return null;
}

export function getWhaleDetectionInputValidationError(
  analysis: OrderBookAnalysis,
  currentPrice: number,
  btcMomentum?: number,
): string | null {
  if (!analysis || typeof analysis !== 'object') {
    return 'Analysis must be a valid object';
  }

  if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice)) {
    return 'Current price must be a finite number';
  }

  if (currentPrice < 0) {
    return 'Current price must be non-negative';
  }

  if (btcMomentum !== undefined) {
    if (typeof btcMomentum !== 'number' || !Number.isFinite(btcMomentum)) {
      return 'BTC momentum must be a finite number';
    }

    if (btcMomentum < 0 || btcMomentum > 1) {
      return 'BTC momentum must be between 0 and 1';
    }
  }

  return null;
}
