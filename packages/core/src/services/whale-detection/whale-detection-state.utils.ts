const DEFAULT_RECENT_BREAKS_MAX_SIZE = 100;

interface ImbalanceLike {
  ratio: number;
  bidVolume: number;
  askVolume: number;
}

interface ImbalanceSnapshotLike {
  ratio: number;
  timestamp: number;
  bidVolume: number;
  askVolume: number;
}

interface TrackedWallLike {
  lastSeenAt: number;
}

export function updateWhaleImbalanceHistory<T extends ImbalanceSnapshotLike>(
  history: T[],
  imbalance: ImbalanceLike,
  maxHistory: number,
  now: number,
): void {
  history.push({
    ratio: imbalance.ratio,
    timestamp: now,
    bidVolume: imbalance.bidVolume,
    askVolume: imbalance.askVolume,
  } as T);

  if (history.length > maxHistory) {
    history.shift();
  }
}

export function cleanupWhaleTrackedWalls(
  trackedWalls: Map<number, TrackedWallLike>,
  now: number,
  wallExpiryMs: number,
): void {
  for (const [price, wall] of trackedWalls.entries()) {
    if (now - wall.lastSeenAt > wallExpiryMs) {
      trackedWalls.delete(price);
    }
  }
}

export function cleanupWhaleRecentBreaks(
  recentlyBrokenWalls: Set<string>,
  maxSize = DEFAULT_RECENT_BREAKS_MAX_SIZE,
): void {
  if (recentlyBrokenWalls.size > maxSize) {
    recentlyBrokenWalls.clear();
  }
}
