import { Orderbook, SmartOrderPlacementConfig } from '../../types/legacy';

export function validateSmartOrderPlacementConfig(
  config: SmartOrderPlacementConfig,
): void {
  if (!config) {
    throw new Error('SmartOrderPlacementConfig cannot be null or undefined');
  }

  if (!Number.isFinite(config.maxOrderSize) || config.maxOrderSize <= 0) {
    throw new Error(
      `Invalid maxOrderSize: ${config.maxOrderSize} (must be positive)`,
    );
  }

  if (!Number.isFinite(config.maxSlippageBps) || config.maxSlippageBps < 0) {
    throw new Error(
      `Invalid maxSlippageBps: ${config.maxSlippageBps} (must be >= 0)`,
    );
  }

  if (
    !Number.isFinite(config.minFillProbability) ||
    config.minFillProbability < 0 ||
    config.minFillProbability > 100
  ) {
    throw new Error(
      `Invalid minFillProbability: ${config.minFillProbability} (must be 0-100)`,
    );
  }

  if (!Number.isFinite(config.analyzeLevels) || config.analyzeLevels <= 0) {
    throw new Error(
      `Invalid analyzeLevels: ${config.analyzeLevels} (must be positive)`,
    );
  }

  if (
    !Number.isFinite(config.executionTimeHorizon) ||
    config.executionTimeHorizon <= 0
  ) {
    throw new Error(
      `Invalid executionTimeHorizon: ${config.executionTimeHorizon} (must be positive)`,
    );
  }
}

export function validateSmartOrderbook(orderbook: Orderbook): void {
  if (!orderbook) {
    throw new Error('Orderbook cannot be null or undefined');
  }

  if (!Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
    throw new Error('Orderbook must have bids and asks arrays');
  }
}

export function validateSmartOrderParams(
  size: number,
  direction: 'buy' | 'sell',
  targetPrice?: number,
): void {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`Invalid order size: ${size} (must be positive)`);
  }

  if (direction !== 'buy' && direction !== 'sell') {
    throw new Error(
      `Invalid direction: ${direction} (must be 'buy' or 'sell')`,
    );
  }

  if (targetPrice !== undefined && targetPrice !== null) {
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      throw new Error(
        `Invalid targetPrice: ${targetPrice} (must be positive or null)`,
      );
    }
  }
}
