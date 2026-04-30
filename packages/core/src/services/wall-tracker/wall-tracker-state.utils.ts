import { DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER, TIME_UNITS, INTEGER_MULTIPLIERS } from '../../constants';
import {
  CLUSTER_MIN_WALLS,
  MIN_REFILLS_FOR_ICEBERG,
  RATIO_MULTIPLIERS,
  WALL_ICEBERG_BONUS_SCORE,
  WALL_LIFETIME_SCORE_MAX,
  WALL_SIZE_STABILITY_SCORE_MAX,
} from '../../constants/technical.constants';
import { WallCluster, WallEvent, WallLifetime, WallTrackingConfig } from '../../types/legacy';

const CLUSTER_PRICE_THRESHOLD_PERCENT = MULTIPLIERS.HALF;

export function isValidWallInput(price: number, size: number): boolean {
  return !Number.isNaN(price) && !Number.isNaN(size) && price > 0 && size >= 0;
}

export function getWallTrackerKey(side: 'BID' | 'ASK', price: number): string {
  return `${side}_${price.toFixed(DECIMAL_PLACES.PRICE)}`;
}

export function createTrackedWall(
  price: number,
  size: number,
  side: 'BID' | 'ASK',
  now: number = Date.now(),
): WallLifetime {
  return {
    firstSeen: now,
    lastSeen: now,
    price,
    side,
    maxSize: size,
    currentSize: size,
    events: [
      {
        timestamp: now,
        type: 'ADDED',
        price,
        size,
        side,
      },
    ],
    isSpoofing: false,
    isIceberg: false,
    absorbedVolume: 0,
  };
}

export function applyWallSizeUpdate(
  wall: WallLifetime,
  newSize: number,
  now: number = Date.now(),
): void {
  wall.lastSeen = now;

  if (newSize < wall.currentSize) {
    const absorbed = wall.currentSize - newSize;
    wall.absorbedVolume += absorbed;
    wall.events.push({
      timestamp: now,
      type: 'ABSORBED',
      price: wall.price,
      size: absorbed,
      side: wall.side,
    });
  }

  if (newSize > wall.currentSize) {
    const refilled = newSize - wall.currentSize;
    wall.events.push({
      timestamp: now,
      type: 'REFILLED',
      price: wall.price,
      size: refilled,
      side: wall.side,
    });

    const refillCount = wall.events.filter((event) => event.type === 'REFILLED').length;
    if (refillCount >= MIN_REFILLS_FOR_ICEBERG && !wall.isIceberg) {
      wall.isIceberg = true;
    }
  }

  wall.currentSize = newSize;
  wall.maxSize = Math.max(wall.maxSize, newSize);
}

export function shouldMarkWallSpoofing(lifetimeMs: number, spoofingThresholdMs: number): boolean {
  return lifetimeMs < spoofingThresholdMs;
}

export function createRemovedWallEvent(
  wall: WallLifetime,
  now: number = Date.now(),
): WallEvent {
  return {
    timestamp: now,
    type: 'REMOVED',
    price: wall.price,
    size: wall.currentSize,
    side: wall.side,
    reason: wall.isSpoofing ? 'spoofing' : 'filled_or_cancelled',
  };
}

export function appendWallEventWithLimit(
  history: WallEvent[],
  event: WallEvent,
  limit: number,
): void {
  history.push(event);
  if (history.length > limit) {
    history.shift();
  }
}

export function createWallCluster(
  walls: WallLifetime[],
  side: 'BID' | 'ASK',
  now: number = Date.now(),
): WallCluster {
  const prices = walls.map((wall) => wall.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const totalSize = walls.reduce((sum, wall) => sum + wall.currentSize, 0);
  const totalLifetime = walls.reduce((sum, wall) => sum + (now - wall.firstSeen), 0);
  const averageLifetime = totalLifetime / walls.length;
  const avgSize = totalSize / walls.length;
  const sizeStrength = Math.min(avgSize / INTEGER_MULTIPLIERS.ONE_THOUSAND, 1) * 50;
  const lifetimeStrength = Math.min(averageLifetime / TIME_UNITS.FIVE_MINUTES, 1) * 50;

  return {
    priceRange: [minPrice, maxPrice],
    side,
    wallCount: walls.length,
    totalSize,
    averageLifetime,
    strength: Math.round(sizeStrength + lifetimeStrength),
  };
}

export function detectWallClusters(
  walls: WallLifetime[],
  side: 'BID' | 'ASK',
  now: number = Date.now(),
): WallCluster[] {
  if (walls.length < CLUSTER_MIN_WALLS) {
    return [];
  }

  const sortedWalls = [...walls].sort((left, right) => left.price - right.price);
  const clusters: WallCluster[] = [];
  let currentCluster: WallLifetime[] = [sortedWalls[0]];

  for (let index = 1; index < sortedWalls.length; index++) {
    const wall = sortedWalls[index];
    const previousWall = sortedWalls[index - 1];
    const priceDiff = Math.abs(wall.price - previousWall.price);
    const threshold = previousWall.price * (CLUSTER_PRICE_THRESHOLD_PERCENT / PERCENT_MULTIPLIER);

    if (priceDiff <= threshold) {
      currentCluster.push(wall);
      continue;
    }

    if (currentCluster.length >= CLUSTER_MIN_WALLS) {
      clusters.push(createWallCluster(currentCluster, side, now));
    }
    currentCluster = [wall];
  }

  if (currentCluster.length >= CLUSTER_MIN_WALLS) {
    clusters.push(createWallCluster(currentCluster, side, now));
  }

  return clusters;
}

export function calculateWallStrengthScore(
  wall: WallLifetime,
  config: WallTrackingConfig,
  now: number = Date.now(),
): number | null {
  if (wall.isSpoofing) {
    return 0;
  }

  const lifetime = now - wall.firstSeen;
  if (Number.isNaN(lifetime) || !Number.isFinite(lifetime)) {
    return null;
  }

  if (wall.maxSize <= 0) {
    return null;
  }

  const sizeRatio = wall.currentSize / wall.maxSize;
  if (Number.isNaN(sizeRatio) || !Number.isFinite(sizeRatio)) {
    return null;
  }

  let strength =
    Math.min(lifetime / config.minLifetimeMs, RATIO_MULTIPLIERS.FULL) * WALL_LIFETIME_SCORE_MAX;
  strength += sizeRatio * WALL_SIZE_STABILITY_SCORE_MAX;

  if (wall.isIceberg) {
    strength += WALL_ICEBERG_BONUS_SCORE;
  }

  const finalScore = Math.min(strength, RATIO_MULTIPLIERS.FULL);
  return Number.isFinite(finalScore) ? finalScore : null;
}
