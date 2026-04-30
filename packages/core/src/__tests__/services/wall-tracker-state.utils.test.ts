import {
  appendWallEventWithLimit,
  applyWallSizeUpdate,
  calculateWallStrengthScore,
  createRemovedWallEvent,
  createTrackedWall,
  detectWallClusters,
  getWallTrackerKey,
  isValidWallInput,
} from '../../services/wall-tracker/wall-tracker-state.utils';
import { createWallTrackerConfig } from '../helpers/wall-tracker-test.utils';

describe('wall-tracker state utils', () => {
  it('validates wall input and stable keys', () => {
    expect(isValidWallInput(100, 1)).toBe(true);
    expect(isValidWallInput(Number.NaN, 1)).toBe(false);
    expect(getWallTrackerKey('BID', 100)).toBe('BID_100.0000');
  });

  it('updates tracked walls with absorption, refill, and bounded history', () => {
    const wall = createTrackedWall(100, 10, 'BID', 1000);
    applyWallSizeUpdate(wall, 5, 2000);
    applyWallSizeUpdate(wall, 10, 3000);

    expect(wall.absorbedVolume).toBe(5);
    expect(wall.events.map((event) => event.type)).toEqual(['ADDED', 'ABSORBED', 'REFILLED']);

    const history = [wall.events[0]];
    appendWallEventWithLimit(history, createRemovedWallEvent(wall, 4000), 1);
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('REMOVED');
  });

  it('detects clusters and calculates wall strength', () => {
    const walls = [
      createTrackedWall(100, 1000, 'BID', 1000),
      createTrackedWall(100.2, 900, 'BID', 1000),
      createTrackedWall(100.4, 800, 'BID', 1000),
    ];
    const clusters = detectWallClusters(walls, 'BID', 61_000);

    expect(clusters).toHaveLength(1);
    expect(calculateWallStrengthScore(walls[0], createWallTrackerConfig(), 61_000)).toBeGreaterThan(0);
  });
});
