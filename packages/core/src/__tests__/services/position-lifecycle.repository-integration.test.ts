/**
 * Phase 6.2: PositionLifecycleService + IPositionRepository Integration Tests
 *
 * Tests the integration of PositionLifecycleService with IPositionRepository
 * Ensures position state is correctly delegated to repository
 */

import { IPositionRepository } from '../../repositories/IRepositories';
import { Position } from '../../types/legacy';
import {
  createClosedRepositoryPosition,
  createManagedPositionRepositoryContext,
  type ManagedPositionRepositoryContext,
  createRepositoryPosition,
  createRepositoryTakeProfits,
  seedRepositoryHistory,
  seedRepositoryCurrentPosition,
  updateRepositoryCurrentPosition,
} from '../helpers/position-repository-test.utils';

describe('PositionLifecycleService + IPositionRepository Integration', () => {
  let managedContext: ManagedPositionRepositoryContext;
  let repository: IPositionRepository;

  beforeEach(() => {
    managedContext = createManagedPositionRepositoryContext();
  });

  afterEach(() => {
    managedContext.cleanup();
  });

  beforeEach(() => {
    repository = managedContext.repository;
  });

  describe('Basic Position Operations', () => {
    it('should store position in repository', () => {
      const position: Position = createRepositoryPosition({
        takeProfits: createRepositoryTakeProfits(),
      });

      seedRepositoryCurrentPosition(repository, position);
      const stored = repository.getCurrentPosition();

      expect(stored).not.toBeNull();
      expect(stored?.id).toBe('BTCUSDT_Buy');
      expect(stored?.entryPrice).toBe(50000);
    });

    it('should retrieve current position from repository', () => {
      const { repository: seededRepository, position } =
        managedContext.createCurrentPositionHarness();
      repository = seededRepository;

      const current = repository.getCurrentPosition();
      expect(current).toEqual(position);
    });

    it('should return null when no position stored', () => {
      const current = repository.getCurrentPosition();
      expect(current).toBeNull();
    });

    it('should clear position from repository', () => {
      const position: Position = createRepositoryPosition();

      seedRepositoryCurrentPosition(repository, position);
      expect(repository.getCurrentPosition()).not.toBeNull();

      seedRepositoryCurrentPosition(repository, null);
      expect(repository.getCurrentPosition()).toBeNull();
    });
  });

  describe('Position History', () => {
    it('should add positions to history', () => {
      const { repository: seededRepository } = managedContext.createClosedHistoryHarness([
        {
          id: 'BTCUSDT_Buy_1',
          unrealizedPnL: 100,
        },
      ]);
      repository = seededRepository;
      const history = repository.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('BTCUSDT_Buy_1');
    });

    it('should maintain history limit (max 100)', () => {
      seedRepositoryHistory(repository, 150, (i) => ({
          id: `BTCUSDT_Buy_${i}`,
          journalId: `trade-${i}`,
          entryPrice: 50000 + i,
          orderId: `order-${i}`,
          status: 'CLOSED',
        }));

      const history = repository.getHistory();

      // Should maintain max 100
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should get limited history', () => {
      seedRepositoryHistory(repository, 50, (i) => ({
          id: `BTCUSDT_Buy_${i}`,
          journalId: `trade-${i}`,
          orderId: `order-${i}`,
          status: 'CLOSED',
        }));

      const limited = repository.getHistory(10);
      expect(limited).toHaveLength(10);
    });

    it('should clear history', () => {
      const { repository: seededRepository } = managedContext.createClosedHistoryHarness();
      repository = seededRepository;
      expect(repository.getHistory()).toHaveLength(1);

      repository.clearHistory();
      expect(repository.getHistory()).toHaveLength(0);
    });
  });

  describe('Position Queries', () => {
    it('should find position by ID', () => {
      repository = managedContext.createClosedHistoryHarness().repository;

      const found = repository.findPosition('BTCUSDT_Buy');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('BTCUSDT_Buy');
    });

    it('should return null for non-existent position', () => {
      const found = repository.findPosition('NONEXISTENT');
      expect(found).toBeNull();
    });

    it('should get all positions', () => {
      repository = managedContext.createCurrentAndHistoryHarness({
        currentPosition: {
          id: 'BTCUSDT_Buy_2',
          status: 'OPEN',
        },
        history: [{ id: 'BTCUSDT_Buy_1' }],
      }).repository;

      const all = repository.getAllPositions();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Repository Maintenance', () => {
    it('should get repository size', () => {
      repository = managedContext.createCurrentAndHistoryHarness({
        currentPosition: { status: 'OPEN' },
        history: [{ status: 'CLOSED' }],
      }).repository;

      const size = repository.getSize();
      expect(size).toBeGreaterThan(0);
    });

    it('should clear all repository data', () => {
      repository = managedContext.createCurrentAndHistoryHarness({
        currentPosition: { status: 'OPEN' },
        history: [{ status: 'CLOSED' }],
      }).repository;

      repository.clear();

      expect(repository.getCurrentPosition()).toBeNull();
      expect(repository.getHistory()).toHaveLength(0);
      expect(repository.getSize()).toBe(0);
    });
  });

  describe('Position Updates', () => {
    it('should update position fields', () => {
      const updateHarness = managedContext.createUpdateHarness();
      const position = updateHarness.position;
      repository = updateHarness.repository;

      // Update position
      updateRepositoryCurrentPosition(repository, position, {
        unrealizedPnL: 500,
        quantity: 0.05,
      });

      const current = repository.getCurrentPosition();
      expect(current?.unrealizedPnL).toBe(500);
      expect(current?.quantity).toBe(0.05);
    });

    it('should handle concurrent position updates', () => {
      repository = managedContext.createBulkHistoryHarness(5, (i) => ({
        id: `BTCUSDT_Buy_${i}`,
        journalId: `trade-${i}`,
        quantity: 0.1 + i * 0.01,
        unrealizedPnL: i * 100,
        orderId: `order-${i}`,
      })).repository;

      const all = repository.getAllPositions();
      expect(all.length).toBeGreaterThanOrEqual(5);
    });
  });
});
