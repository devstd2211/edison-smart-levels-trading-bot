import * as fs from 'fs';
import * as path from 'path';
import { PositionEventStore } from '../../event-sourcing/position-event-store.service';
import { PositionStateProjection } from '../../event-sourcing/position-state-projection.service';
import { PositionEventType, type PositionOpenedEvent } from '../../event-sourcing/position.events';
import { PositionSide } from '../../types/enums';

describe('PositionStateProjection functional behavior', () => {
  const testStorePath = path.join(__dirname, 'test-projection-functional-events.jsonl');
  let store: PositionEventStore;
  let projection: PositionStateProjection;

  beforeEach(async () => {
    if (fs.existsSync(testStorePath)) {
      fs.unlinkSync(testStorePath);
    }

    store = new PositionEventStore(testStorePath);
    await store.initialize();
    projection = new PositionStateProjection(store);
  });

  afterEach(() => {
    if (fs.existsSync(testStorePath)) {
      fs.unlinkSync(testStorePath);
    }
  });

  it('rebuilds LONG and SHORT positions with the correct runtime side enum', async () => {
    const now = Date.now();
    const baseEvent = {
      type: PositionEventType.POSITION_OPENED,
      symbol: 'XRPUSD',
      source: 'system',
      entryPrice: 2.5,
      quantity: 100,
      leverage: 5,
      initialStopLoss: { price: 2.4, distance: 0.1, hit: false },
      takeProfits: [{ price: 2.6, percent: 100, hit: false }],
      confidence: 75,
      indicators: ['EMA'],
    } satisfies Omit<PositionOpenedEvent, 'positionId' | 'timestamp' | 'side'>;

    await store.appendEvent({
      ...baseEvent,
      positionId: 'long-pos',
      timestamp: now,
      side: 'LONG',
    });
    await store.appendEvent({
      ...baseEvent,
      positionId: 'short-pos',
      timestamp: now + 1,
      side: 'SHORT',
    });

    const [longPosition, shortPosition] = await Promise.all([
      projection.projectPosition('long-pos'),
      projection.projectPosition('short-pos'),
    ]);

    expect(longPosition?.side).toBe(PositionSide.LONG);
    expect(shortPosition?.side).toBe(PositionSide.SHORT);
  });
});
