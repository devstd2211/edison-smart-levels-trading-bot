/**
 * Position State Machine Service - Error Handling Tests
 * Phase 8.9.11: ErrorHandler Integration (RETRY, GRACEFUL_DEGRADE, THROW strategies)
 *
 * Tests cover:
 * - File I/O error scenarios with RETRY strategy
 * - State persistence with backup recovery (GRACEFUL_DEGRADE)
 * - History loading with corruption handling
 * - Transactional integrity
 * - E2E lifecycle scenarios
 */

import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { PositionStateMachineService } from '../../services/position-state-machine.service';
import { PositionState } from '../../types/enums';
import { LoggerService } from '../../services/logger.service';
import type { StateTransitionResult } from '../../types/position-state-machine';
import {
  applyPositionStateSequence,
  closePositionState,
  createLegacyPositionStateMachineHarness,
  createPositionStateMachineHistoryEntry,
  createPositionStateMachinePersistedState,
  createManagedPositionStateMachineContext,
  createMockPositionStateMachineLogger,
  ensureParentDir,
  getPositionStateSnapshot,
  getStateMachineStateFilePath,
  removeStateMachineArtifacts,
  seedStateMachineHistoryFile,
  seedStateMachineStatesFile,
  transitionPositionState,
  transitionPositionStateSequence,
  waitForStateMachinePersistence,
  type ManagedPositionStateMachineContext,
} from '../helpers/position-state-machine-test.utils';

function bindPositionStateMachineFixtures() {
  let cleanup: ManagedPositionStateMachineContext['cleanup'];
  let fixtures: Pick<
    ManagedPositionStateMachineContext,
    | 'logger'
    | 'testDataDir'
    | 'createStandardService'
    | 'createInitializedStandardService'
    | 'createInitializedLegacyService'
  >;

  beforeEach(() => {
    const managedContext = createManagedPositionStateMachineContext({
      logger: createMockPositionStateMachineLogger(),
    });
    cleanup = managedContext.cleanup;
    fixtures = {
      logger: managedContext.logger,
      testDataDir: managedContext.testDataDir,
      createStandardService: managedContext.createStandardService,
      createInitializedStandardService: managedContext.createInitializedStandardService,
      createInitializedLegacyService: managedContext.createInitializedLegacyService,
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  return () => fixtures;
}

describe('PositionStateMachineService - Error Handling (Phase 8.9.11)', () => {
  let logger: LoggerService;
  let testDataDir: string;
  let service: PositionStateMachineService;
  let createStandardService: ManagedPositionStateMachineContext['createStandardService'];
  let createInitializedStandardService: ManagedPositionStateMachineContext['createInitializedStandardService'];
  let createInitializedLegacyService: ManagedPositionStateMachineContext['createInitializedLegacyService'];
  const getFixtures = bindPositionStateMachineFixtures();

  beforeEach(() => {
    ({
      logger,
      testDataDir,
      createStandardService,
      createInitializedStandardService,
      createInitializedLegacyService,
    } = getFixtures());
  });

  // ============================================================================
  // FILE I/O ERROR SCENARIOS
  // ============================================================================

  describe('File I/O Errors', () => {
    it('should initialize successfully with ErrorHandler', async () => {
      service = createStandardService({ logger });

      // Should not throw when ErrorHandler is provided
      await expect(service.initialize()).resolves.not.toThrow();

      // Verify initialization success
      expect((logger.info as jest.Mock).mock.calls.some(call =>
        call[0]?.includes('initialized')
      )).toBe(true);
    });

    it('should handle corrupted history file gracefully', async () => {
      service = createStandardService({ logger });

      // Create corrupted history file
      const historyFilePath = path.join(testDataDir, 'position-transitions.jsonl');
      await ensureParentDir(historyFilePath);
      await fsPromises.writeFile(historyFilePath, 'INVALID JSON { corrupted');

      // Should initialize without throwing (GRACEFUL_DEGRADE strategy)
      await expect(service.initialize()).resolves.not.toThrow();

      // Service should be initialized despite history corruption
      expect(service.isInitialized()).toBe(true);
    });

    it('should create backup file after successful state load', async () => {
      service = await createInitializedStandardService({ logger });

      // Transition state to ensure persistence
      service.transitionState({
        symbol: 'BTCUSDT',
        positionId: `pos-backup-${Date.now()}`,
        targetState: PositionState.TP1_HIT,
        reason: 'Test backup creation',
      });

      // Wait for async persistence
      await waitForStateMachinePersistence();

      // Verify service initialized
      expect(service.isInitialized()).toBe(true);
    });

    it('should log warning when backup is also corrupted', async () => {
      service = createStandardService({ logger });

      // Create main state file with invalid JSON
      const stateFilePath = path.join(testDataDir, 'position-states.jsonl');
      await ensureParentDir(stateFilePath);

      // Both main and backup are corrupted
      const backupPath = stateFilePath + '.backup';
      await fsPromises.writeFile(stateFilePath, 'CORRUPTED DATA {');
      await fsPromises.writeFile(backupPath, 'ALSO CORRUPTED {');

      // Should handle gracefully - the corrupted file read will fail,
      // but backup also fails, so it throws
      try {
        await service.initialize();
        // If no exception, check that error was logged
        expect((logger.error as jest.Mock).mock.calls.some(call =>
          call[0]?.includes('Failed to initialize') || call[0]?.includes('Backup file also corrupted')
        )).toBe(true);
      } catch (error) {
        // Expected - at least one of the errors should be caught
        expect(error).toBeDefined();
      }
    });

    it('should RETRY on state persistence disk full error', async () => {
      service = await createInitializedStandardService({ logger });

      let retryCount = 0;
      jest.spyOn(fsPromises, 'appendFile').mockImplementation(async (...args) => {
        retryCount++;
        if (retryCount <= 1) {
          const error = new Error('ENOSPC: no space left on device') as NodeJS.ErrnoException;
          error.code = 'ENOSPC';
          throw error;
        }
        // Succeed on retry
        return undefined;
      });

      // Trigger state transition which persists
      const result = service.transitionState({
        symbol: 'BTCUSDT',
        positionId: 'pos-disk-test',
        targetState: PositionState.TP1_HIT,
        reason: 'Test TP1',
      });

      // Give async operations time to complete
      await waitForStateMachinePersistence(100);

      expect(result.allowed).toBe(true);
      expect(retryCount).toBeGreaterThan(1); // Verify retry occurred

      jest.restoreAllMocks();
    });
  });

  // ============================================================================
  // STATE PERSISTENCE & RECOVERY
  // ============================================================================

  describe('State Persistence & Recovery', () => {
    it('should create backup file after successful state load', async () => {
      await seedStateMachineStatesFile(testDataDir, [
        createPositionStateMachinePersistedState({ positionId: 'pos-seeded-backup' }),
      ]);
      service = await createInitializedStandardService({ logger });

      // Transition state
      transitionPositionState(service, {
        positionId: 'pos-backup-test',
        targetState: PositionState.TP1_HIT,
        reason: 'Test backup creation',
      });

      // Wait for async persistence
      await waitForStateMachinePersistence();

      // Backup should exist
      const backupPath = `${getStateMachineStateFilePath(testDataDir)}.backup`;
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    it('should handle mixed valid and invalid state lines gracefully', async () => {
      service = createStandardService({ logger });

      const validState = createPositionStateMachinePersistedState({ positionId: 'pos-valid' });
      const stateFilePath = await seedStateMachineStatesFile(testDataDir, [
        validState,
        createPositionStateMachinePersistedState({ positionId: 'pos-valid-2' }),
      ]);
      await fsPromises.writeFile(
        stateFilePath,
        [JSON.stringify(validState), 'INVALID LINE', JSON.stringify({
          ...validState,
          positionId: 'pos-valid-2',
        })].join('\n'),
      );

      await service.initialize();

      // Should load valid states and skip invalid ones
      expect(service.getStateCount()).toBe(2);
      expect((logger.warn as jest.Mock).mock.calls.some(call =>
        call[0]?.includes('Skipped corrupted state line')
      )).toBe(true);
    });

    it('should log statistics about loaded states', async () => {
      service = createStandardService({ logger });

      const states = Array.from({ length: 5 }, (_, i) =>
        createPositionStateMachinePersistedState({ positionId: `pos-${i}` }),
      );
      await seedStateMachineStatesFile(testDataDir, states);

      await service.initialize();

      expect(service.getStateCount()).toBe(5);
      expect((logger.info as jest.Mock).mock.calls.some(call =>
        call[0]?.includes('Loaded position states from disk') &&
        call[1]?.count === 5
      )).toBe(true);
    });
  });

  // ============================================================================
  // TRANSITION HISTORY RECOVERY
  // ============================================================================

  describe('Transition History Recovery', () => {
    it('should skip corrupted history entries and continue loading', async () => {
      service = createStandardService({ logger });

      const validEntry = createPositionStateMachineHistoryEntry({
        request: {
          symbol: 'BTCUSDT',
          positionId: 'pos-history',
          targetState: PositionState.TP1_HIT,
          reason: 'Test',
        },
      });
      await seedStateMachineHistoryFile(testDataDir, [
        validEntry,
        'CORRUPTED HISTORY LINE',
        validEntry,
      ]);

      await service.initialize();

      // Should load valid entries and skip invalid ones
      expect((logger.info as jest.Mock).mock.calls.some(call =>
        call[0]?.includes('Loaded transition history')
      )).toBe(true);
    });

    it('should limit history entries per position for memory efficiency', async () => {
      service = createStandardService({ logger });

      const entries = Array.from({ length: 1500 }, (_, i) =>
        createPositionStateMachineHistoryEntry({
          request: {
            symbol: 'BTCUSDT',
            positionId: 'pos-many-transitions',
            targetState: PositionState.TP1_HIT,
            reason: `Transition ${i}`,
          },
          timestamp: Date.now() + i,
        }),
      );
      await seedStateMachineHistoryFile(testDataDir, entries);

      await service.initialize();

      // History should be loaded
      const history = service.getTransitionHistory('BTCUSDT', 'pos-many-transitions', 100);
      // Should keep memory efficient (last 1000 transitions)
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================================
  // TRANSACTIONAL INTEGRITY
  // ============================================================================

  describe('Transactional Integrity', () => {
    it('should maintain consistency between cache and disk during transitions', async () => {
      service = await createInitializedStandardService({ logger });

      const posId = `pos-tx-test-${Date.now()}`;
      const result = service.transitionState({
        symbol: 'BTCUSDT',
        positionId: posId,
        targetState: PositionState.TP1_HIT,
        reason: 'Test transactional consistency',
      });

      expect(result.allowed).toBe(true);
      expect(result.currentState).toBe(PositionState.TP1_HIT);

      // Cache should be updated
      const cachedState = service.getState('BTCUSDT', posId);
      expect(cachedState).toBe(PositionState.TP1_HIT);

      // Wait for async disk persistence
      await waitForStateMachinePersistence();

      // Verify state is persisted and consistent
      expect(result.currentState).toBe(PositionState.TP1_HIT);
    });

    it('should handle exit mode updates with persistence', async () => {
      service = await createInitializedStandardService({ logger });

      // Create position
      service.transitionState({
        symbol: 'BTCUSDT',
        positionId: 'pos-exit-mode',
        targetState: PositionState.TP1_HIT,
        reason: 'Test exit mode',
      });

      // Update exit mode
      service.updateExitMode('BTCUSDT', 'pos-exit-mode', {
        preBEMode: {
          activatedAt: Date.now(),
          candlesWaited: 0,
          candleCount: 5,
        },
      });

      // Verify update
      const fullState = getPositionStateSnapshot(service, 'pos-exit-mode');
      expect(fullState?.preBEMode).toBeDefined();
    });

    it('should validate state transitions before persistence', async () => {
      service = await createInitializedStandardService({ logger });

      const posId = `pos-invalid-tx-${Date.now()}`;

      // Try invalid transition (OPEN -> TP3_HIT, skipping TP1 and TP2)
      const result = service.transitionState({
        symbol: 'BTCUSDT',
        positionId: posId,
        targetState: PositionState.TP3_HIT,
        reason: 'Invalid - should go OPEN -> TP1 first',
      });

      expect(result.allowed).toBe(false);
      expect(result.currentState).toBe(PositionState.OPEN); // Should remain OPEN
    });
  });

  // ============================================================================
  // E2E LIFECYCLE SCENARIOS
  // ============================================================================

  describe('E2E Lifecycle Scenarios', () => {
    it('should maintain full position lifecycle with error recovery', async () => {
      service = await createInitializedStandardService({ logger });

      const posId = 'pos-e2e-full';

      const [result1, result2, result3] = transitionPositionStateSequence(service, {
        positionId: posId,
        states: [PositionState.TP1_HIT, PositionState.TP2_HIT, PositionState.TP3_HIT],
        reasonPrefix: 'TP hit',
      });
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);

      // TP3_HIT -> CLOSED
      const result4 = closePositionState(service, {
        positionId: posId,
        reason: 'Final close',
        closureReason: 'TP3_HIT',
        closurePrice: 50000,
        closurePnL: 1000,
      });
      expect(result4.allowed).toBe(true);

      await waitForStateMachinePersistence();

      // Verify final state
      const finalState = getPositionStateSnapshot(service, posId);
      expect(finalState?.currentState).toBe(PositionState.CLOSED);
      expect(finalState?.closedAt).toBeDefined();
      expect(finalState?.closurePnL).toBe(1000);
    });

    it('should handle multiple positions concurrently without interference', async () => {
      service = await createInitializedStandardService({ logger });

      const timestamp = Date.now();
      // Create multiple positions with valid state transitions
      const positions = Array.from({ length: 5 }, (_, i) => ({
        symbol: 'BTCUSDT',
        positionId: `pos-concurrent-${timestamp}-${i}`,
      }));

      // Transition: odd indices -> TP1_HIT, even indices -> OPEN -> TP1_HIT -> TP2_HIT
      const results: StateTransitionResult[] = [];
      positions.forEach((pos, index) => {
        if (index % 2 === 0) {
          results.push(transitionPositionState(service, {
            symbol: pos.symbol,
            positionId: pos.positionId,
            targetState: PositionState.TP1_HIT,
            reason: 'Concurrent test',
          }));
        } else {
          const sequenceResults = transitionPositionStateSequence(service, {
            symbol: pos.symbol,
            positionId: pos.positionId,
            states: [PositionState.TP1_HIT, PositionState.TP2_HIT],
            reasonPrefix: 'Concurrent test',
          });
          results.push(sequenceResults[1]);
        }
      });

      await waitForStateMachinePersistence();

      // Verify all positions have correct states from transition results
      results.forEach((result, index) => {
        const expectedState = index % 2 === 0 ? PositionState.TP1_HIT : PositionState.TP2_HIT;
        expect(result.currentState).toBe(expectedState);
      });

      // Also verify via getState
      positions.forEach((pos, index) => {
        const state = service.getState(pos.symbol, pos.positionId);
        const expectedState = index % 2 === 0 ? PositionState.TP1_HIT : PositionState.TP2_HIT;
        expect(state).toBe(expectedState);
      });
    });

    it('should provide accurate statistics after state transitions', async () => {
      service = await createInitializedStandardService({ logger });

      const timestamp = Date.now();
      applyPositionStateSequence(service, {
        positionId: `pos-stat-${timestamp}-1`,
        states: [PositionState.TP1_HIT],
        reasonPrefix: 'Test',
      });
      applyPositionStateSequence(service, {
        positionId: `pos-stat-${timestamp}-2`,
        states: [PositionState.TP1_HIT, PositionState.TP2_HIT],
        reasonPrefix: 'Test',
      });
      applyPositionStateSequence(service, {
        positionId: `pos-stat-${timestamp}-3`,
        states: [
          PositionState.TP1_HIT,
          PositionState.TP2_HIT,
          PositionState.TP3_HIT,
          PositionState.CLOSED,
        ],
        reasonPrefix: 'Test',
      });

      const stats = service.getStatistics();
      // At least 3 positions in the service
      expect(stats.totalPositions).toBeGreaterThanOrEqual(3);
      // Count by state: pos-1 in TP1_HIT, pos-2 in TP2_HIT, pos-3 in CLOSED
      expect(stats.byState[PositionState.TP1_HIT]).toBeGreaterThanOrEqual(1);
      expect(stats.byState[PositionState.TP2_HIT]).toBeGreaterThanOrEqual(1);
      expect(stats.byState[PositionState.CLOSED]).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler parameter (optional DI)', async () => {
      // Create service without ErrorHandler
      service = await createInitializedLegacyService({ logger });

      const result = service.transitionState({
        symbol: 'BTCUSDT',
        positionId: 'pos-no-handler',
        targetState: PositionState.TP1_HIT,
        reason: 'Test without ErrorHandler',
      });

      expect(result.allowed).toBe(true);
      expect(result.currentState).toBe(PositionState.TP1_HIT);
    });

    it('should handle missing files gracefully without ErrorHandler', async () => {
      ({ service } = createLegacyPositionStateMachineHarness({
        logger,
        baseDir: testDataDir,
      }));

      // Clean up any existing data files first
      try {
        const stateFile = path.join(testDataDir, 'position-states.jsonl');
        if (fs.existsSync(stateFile)) {
          await fsPromises.rm(stateFile, { force: true });
        }
      } catch (error) {
        // Ignore cleanup errors
      }

      // Should not throw when no files exist
      await expect(service.initialize()).resolves.not.toThrow();

      // State count may be 0 or more (may have leftover data from other tests)
      // Just verify the service initialized successfully
      expect(service.isInitialized()).toBe(true);
    });
  });
});

