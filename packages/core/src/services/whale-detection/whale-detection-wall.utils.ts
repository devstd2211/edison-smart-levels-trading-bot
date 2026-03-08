export type TrackableWhaleWall = {
  side: 'BID' | 'ASK';
  price: number;
  quantity: number;
  percentOfTotal: number;
  distance: number;
};

export type StoredWhaleWall = TrackableWhaleWall & {
  detectedAt: number;
  lastSeenAt: number;
};

export function upsertTrackedWhaleWall(
  trackedWalls: Map<number, StoredWhaleWall>,
  wall: TrackableWhaleWall,
  now: number,
): void {
  const existing = trackedWalls.get(wall.price);
  if (existing) {
    existing.lastSeenAt = now;
    existing.quantity = wall.quantity;
    existing.percentOfTotal = wall.percentOfTotal;
    existing.distance = wall.distance;
    return;
  }

  trackedWalls.set(wall.price, {
    side: wall.side,
    price: wall.price,
    quantity: wall.quantity,
    percentOfTotal: wall.percentOfTotal,
    distance: wall.distance,
    detectedAt: now,
    lastSeenAt: now,
  });
}
