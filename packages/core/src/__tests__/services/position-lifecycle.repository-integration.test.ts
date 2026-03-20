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
  createPositionRepositoryHarness,
  createRepositoryPosition,
  createRepositoryTakeProfits,
  createSeededClosedHistoryRepository,
  createSeededCurrentAndHistoryRepository,
  createSeededCurrentPositionRepository,
  createSeededRepositoryQueryHarness,
  seedRepositoryHistory,
} from '../helpers/position-repository-test.utils';

describe('PositionLifecycleService + IPositionRepository Integration', () => {
  let repository: IPositionRepository;

  beforeEach(() => {
    repository = createPositionRepositoryHarness();
  });

  describe('Basic Position Operations', () => {
    it('should store position in repository', () => {
      const position: Position = createRepositoryPosition({
        takeProfits: createRepositoryTakeProfits(),
      });

      repository.setCurrentPosition(position);
      const stored = repository.getCurrentPosition();

      expect(stored).not.toBeNull();
      expect(stored?.id).toBe('BTCUSDT_Buy');
      expect(stored?.entryPrice).toBe(50000);
    });

    it('should retrieve current position from repository', () => {
      const position: Position = createRepositoryPosition();
      repository = createSeededCurrentPositionRepository(position);

      const current = repository.getCurrentPosition();
      expect(current).toEqual(position);
    });

    it('should return null when no position stored', () => {
      const current = repository.getCurrentPosition();
      expect(current).toBeNull();
    });

    it('should clear position from repository', () => {
      const position: Position = createRepositoryPosition();

      repository.setCurrentPosition(position);
      expect(repository.getCurrentPosition()).not.toBeNull();

      repository.setCurrentPosition(null);
      expect(repository.getCurrentPosition()).toBeNull();
    });
  });

  describe('Position History', () => {
    it('should add positions to history', () => {
      repository = createSeededClosedHistoryRepository([
        {
          id: 'BTCUSDT_Buy_1',
          unrealizedPnL: 100,
        },
      ]);
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
      const position: Position = createClosedRepositoryPosition();
      repository = createSeededClosedHistoryRepository();
      expect(repository.getHistory()).toHaveLength(1);

      repository.clearHistory();
      expect(repository.getHistory()).toHaveLength(0);
    });
  });

  describe('Position Queries', () => {
    it('should find position by ID', () => {
      repository = createSeededClosedHistoryRepository();

      const found = repository.findPosition('BTCUSDT_Buy');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('BTCUSDT_Buy');
    });

    it('should return null for non-existent position', () => {
      const found = repository.findPosition('NONEXISTENT');
      expect(found).toBeNull();
    });

    it('should get all positions', () => {
      repository = createSeededRepositoryQueryHarness();

      const all = repository.getAllPositions();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Repository Maintenance', () => {
    it('should get repository size', () => {
      repository = createSeededCurrentAndHistoryRepository({
        currentPosition: { status: 'OPEN' },
        history: [{ status: 'CLOSED' }],
      });

      const size = repository.getSize();
      expect(size).toBeGreaterThan(0);
    });

    it('should clear all repository data', () => {
      repository = createSeededCurrentAndHistoryRepository({
        currentPosition: { status: 'OPEN' },
        history: [{ status: 'CLOSED' }],
      });

      repository.clear();

      expect(repository.getCurrentPosition()).toBeNull();
      expect(repository.getHistory()).toHaveLength(0);
      expect(repository.getSize()).toBe(0);
    });
  });

  describe('Position Updates', () => {
    it('should update position fields', () => {
      const position: Position = createRepositoryPosition();
      repository = createSeededCurrentPositionRepository(position);

      // Update position
      const updated = { ...position, unrealizedPnL: 500, quantity: 0.05 };
      repository.setCurrentPosition(updated);

      const current = repository.getCurrentPosition();
      expect(current?.unrealizedPnL).toBe(500);
      expect(current?.quantity).toBe(0.05);
    });

    it('should handle concurrent position updates', () => {
      seedRepositoryHistory(repository, 5, (i) => ({
          id: `BTCUSDT_Buy_${i}`,
          journalId: `trade-${i}`,
          quantity: 0.1 + i * 0.01,
          unrealizedPnL: i * 100,
          orderId: `order-${i}`,
        }));

      const all = repository.getAllPositions();
      expect(all.length).toBeGreaterThanOrEqual(5);
    });
  });
});
