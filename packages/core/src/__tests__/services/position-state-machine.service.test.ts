/**
 * Position State Machine Service Tests
 * PHASE 4.5: Tests for unified position state management
 *
 * Focused tests for core functionality:
 * - State transitions (valid and invalid)
 * - Exit mode tracking
 * - Position lifecycle
 */

import type { PositionStateMachineService } from '../../services/position-state-machine.service';
import { PositionState } from '../../types/enums';
import {
  closePositionState,
  createInitializedLegacyPositionStateMachineService,
  createLegacyPositionStateMachineHarness,
  createManagedPositionStateMachineContext,
  createPositionStateMachinePositionId,
  getPositionStateSnapshot,
  transitionPositionState,
  transitionPositionStateSequence,
} from '../helpers/position-state-machine-test.utils';

describe('PositionStateMachineService', () => {
  type ManagedContext = ReturnType<typeof createManagedPositionStateMachineContext>;
  type LegacyHarnessFactory = typeof createLegacyPositionStateMachineHarness;

  let logger: ManagedContext['logger'];
  let testDataDir: ManagedContext['testDataDir'];
  let cleanup: ManagedContext['cleanup'];
  let createLegacyService: ManagedContext['createLegacyService'];
  let createLegacyHarness: LegacyHarnessFactory;

  beforeEach(() => {
    ({ logger, testDataDir, cleanup, createLegacyService } =
      createManagedPositionStateMachineContext());
    createLegacyHarness = (options = {}) =>
      createLegacyPositionStateMachineHarness({
        logger: options.logger ?? logger,
        baseDir: options.baseDir ?? testDataDir,
      });
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('State Transitions', () => {
    let service: PositionStateMachineService;

    beforeEach(async () => {
      service = await createInitializedLegacyPositionStateMachineService({ logger });
    });

    it('should allow OPEN -> TP1_HIT transition', () => {
      const posId = createPositionStateMachinePositionId();
      const result = transitionPositionState(service, {
        targetState: PositionState.TP1_HIT,
        positionId: posId,
        reason: 'TP1 hit',
      });

      expect(result.allowed).toBe(true);
      expect(result.currentState).toBe(PositionState.TP1_HIT);
    });

    it('should allow OPEN -> CLOSED transition', () => {
      const posId = createPositionStateMachinePositionId();
      const result = transitionPositionState(service, {
        targetState: PositionState.CLOSED,
        positionId: posId,
        reason: 'SL hit',
      });

      expect(result.allowed).toBe(true);
      expect(result.currentState).toBe(PositionState.CLOSED);
    });

    it('should allow TP1_HIT -> TP2_HIT transition', () => {
      const posId = createPositionStateMachinePositionId();
      const [, result] = transitionPositionStateSequence(service, {
        positionId: posId,
        states: [PositionState.TP1_HIT, PositionState.TP2_HIT],
        reasonPrefix: 'TP hit',
      });

      expect(result.allowed).toBe(true);
      expect(result.currentState).toBe(PositionState.TP2_HIT);
    });

    it('should allow full lifecycle: OPEN -> TP1_HIT -> TP2_HIT -> TP3_HIT -> CLOSED', () => {
      const posId = createPositionStateMachinePositionId();
      const transitionResults = transitionPositionStateSequence(service, {
        positionId: posId,
        states: [PositionState.TP1_HIT, PositionState.TP2_HIT, PositionState.TP3_HIT],
        reasonPrefix: 'TP hit',
      });
      transitionResults.forEach((result) => {
        expect(result.allowed).toBe(true);
      });

      const result = closePositionState(service, {
        positionId: posId,
        reason: 'SL hit',
      });
      expect(result.allowed).toBe(true);
      expect(result.currentState).toBe(PositionState.CLOSED);
    });
  });

  describe('Invalid Transitions', () => {
    let service: PositionStateMachineService;

    beforeEach(async () => {
      service = await createInitializedLegacyPositionStateMachineService({ logger });
    });

    it('should prevent backward transitions', () => {
      const posId = createPositionStateMachinePositionId();
      transitionPositionStateSequence(service, {
        positionId: posId,
        states: [PositionState.TP1_HIT, PositionState.TP2_HIT],
        reasonPrefix: 'Invalid',
      });

      const result = transitionPositionState(service, {
        targetState: PositionState.OPEN,
        positionId: posId,
        reason: 'Try to go back',
      });

      expect(result.allowed).toBe(false);
    });

    it('should prevent skipping TP levels', () => {
      const posId = createPositionStateMachinePositionId();

      const result = transitionPositionState(service, {
        targetState: PositionState.TP2_HIT,
        positionId: posId,
        reason: 'Skip TP1',
      });

      expect(result.allowed).toBe(false);
    });

    it('should prevent transitions from CLOSED', () => {
      const posId = createPositionStateMachinePositionId();

      transitionPositionState(service, {
        targetState: PositionState.CLOSED,
        positionId: posId,
        reason: 'Close',
      });

      const result = transitionPositionState(service, {
        targetState: PositionState.OPEN,
        positionId: posId,
        reason: 'Try to reopen',
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe('Exit Modes', () => {
    let service: PositionStateMachineService;

    beforeEach(async () => {
      service = await createInitializedLegacyPositionStateMachineService({ logger });
    });

    it('should track pre-BE mode', () => {
      const posId = createPositionStateMachinePositionId();

      transitionPositionState(service, {
        targetState: PositionState.TP1_HIT,
        positionId: posId,
        reason: 'TP1 hit',
      });

      const now = Date.now();
      service.updateExitMode('BTCUSDT', posId, {
        preBEMode: {
          activatedAt: now,
          candlesWaited: 2,
          candleCount: 5,
        },
      });

      const state = getPositionStateSnapshot(service, posId);
      expect(state?.preBEMode?.candlesWaited).toBe(2);
      expect(state?.preBEMode?.candleCount).toBe(5);
    });

    it('should track trailing mode', () => {
      const posId = createPositionStateMachinePositionId();
      transitionPositionStateSequence(service, {
        positionId: posId,
        states: [PositionState.TP1_HIT, PositionState.TP2_HIT],
        reasonPrefix: 'TP hit',
      });

      service.updateExitMode('BTCUSDT', posId, {
        trailingMode: {
          isTrailing: true,
          currentTrailingPrice: 50000,
          lastUpdatePrice: 51000,
        },
      });

      const state = getPositionStateSnapshot(service, posId);
      expect(state?.trailingMode?.isTrailing).toBe(true);
      expect(state?.trailingMode?.currentTrailingPrice).toBe(50000);
    });
  });

  describe('State Queries', () => {
    let service: PositionStateMachineService;

    beforeEach(async () => {
      service = await createInitializedLegacyPositionStateMachineService({ logger });
    });

    it('should get current state', () => {
      const posId = createPositionStateMachinePositionId();

      transitionPositionState(service, {
        targetState: PositionState.TP1_HIT,
        positionId: posId,
        reason: 'Test',
      });

      const state = service.getState('BTCUSDT', posId);
      expect(state).toBe(PositionState.TP1_HIT);
    });

    it('should get full state with metadata', () => {
      const posId = createPositionStateMachinePositionId();

      transitionPositionState(service, {
        targetState: PositionState.TP1_HIT,
        positionId: posId,
        reason: 'Test',
        metadata: {
          preBEMode: {
            activatedAt: Date.now(),
            candlesWaited: 1,
            candleCount: 5,
          },
        },
      });

      const fullState = getPositionStateSnapshot(service, posId);
      expect(fullState?.currentState).toBe(PositionState.TP1_HIT);
      expect(fullState?.preBEMode?.candleCount).toBe(5);
    });

    it('should return null for non-existent position', () => {
      const state = service.getState('BTCUSDT', 'non-existent-pos-id');
      expect(state).toBeNull();
    });
  });

  describe('Position Lifecycle', () => {
    let service: PositionStateMachineService;

    beforeEach(async () => {
      service = await createInitializedLegacyPositionStateMachineService({ logger });
    });

    it('should close position', () => {
      const posId = createPositionStateMachinePositionId();
      transitionPositionStateSequence(service, {
        positionId: posId,
        states: [PositionState.TP1_HIT, PositionState.TP2_HIT],
        reasonPrefix: 'TP hit',
      });

      const result = closePositionState(service, {
        positionId: posId,
        reason: 'SL hit',
      });
      expect(result.allowed).toBe(true);
      expect(result.currentState).toBe(PositionState.CLOSED);
    });

    it('should set closedAt on close', () => {
      const posId = createPositionStateMachinePositionId();

      transitionPositionState(service, {
        targetState: PositionState.TP1_HIT,
        positionId: posId,
        reason: 'TP1 hit',
      });

      closePositionState(service, {
        positionId: posId,
        reason: 'Manual close',
      });

      const state = getPositionStateSnapshot(service, posId);
      expect(state?.closedAt).toBeDefined();
      expect(state?.reason).toBe('Manual close');
    });

    it('should track closure reason (SL_HIT)', () => {
      const posId = createPositionStateMachinePositionId();

      transitionPositionState(service, {
        targetState: PositionState.TP2_HIT,
        positionId: posId,
        reason: 'TP2 hit',
      });

      closePositionState(service, {
        positionId: posId,
        reason: 'Stop loss triggered',
        closureReason: 'SL_HIT',
        closurePrice: 45000,
        closurePnL: -100,
      });

      const state = getPositionStateSnapshot(service, posId);
      expect(state?.closureReason).toBe('SL_HIT');
      expect(state?.closurePrice).toBe(45000);
      expect(state?.closurePnL).toBe(-100);
    });

    it('should track closure reason (TRAILING_STOP)', () => {
      const posId = createPositionStateMachinePositionId();

      transitionPositionState(service, {
        targetState: PositionState.TP3_HIT,
        positionId: posId,
        reason: 'TP3 hit',
      });

      closePositionState(service, {
        positionId: posId,
        reason: 'Trailing stop triggered',
        closureReason: 'TRAILING_STOP',
        closurePrice: 52000,
        closurePnL: 500,
      });

      const state = getPositionStateSnapshot(service, posId);
      expect(state?.closureReason).toBe('TRAILING_STOP');
      expect(state?.closurePrice).toBe(52000);
      expect(state?.closurePnL).toBe(500);
    });

    it('should track multiple positions', () => {
      const pos1 = createPositionStateMachinePositionId('pos-1');
      const pos2 = createPositionStateMachinePositionId('pos-2');

      transitionPositionState(service, {
        positionId: pos1,
        targetState: PositionState.TP1_HIT,
        reason: 'Test 1',
      });

      transitionPositionState(service, {
        positionId: pos2,
        targetState: PositionState.TP1_HIT,
        reason: 'Test 2 - TP1',
      });

      transitionPositionState(service, {
        positionId: pos2,
        targetState: PositionState.TP2_HIT,
        reason: 'Test 2 - TP2',
      });

      const states = service.getStatesBySymbol('BTCUSDT');
      const pos1State = states.get(pos1);
      const pos2State = states.get(pos2);

      expect(pos1State?.currentState).toBe(PositionState.TP1_HIT);
      expect(pos2State?.currentState).toBe(PositionState.TP2_HIT);
    });
  });

  describe('Statistics', () => {
    let service: PositionStateMachineService;

    beforeEach(async () => {
      service = await createInitializedLegacyPositionStateMachineService({ logger });
    });

    it('should return statistics', () => {
      const posId = createPositionStateMachinePositionId();

      transitionPositionState(service, {
        targetState: PositionState.TP1_HIT,
        positionId: posId,
        reason: 'Test',
      });

      const stats = service.getStatistics();

      expect(stats.totalPositions).toBeGreaterThan(0);
      expect(stats.byState).toBeDefined();
      expect(stats.averageStateHoldTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Clear State', () => {
    let service: PositionStateMachineService;

    beforeEach(async () => {
      service = await createInitializedLegacyPositionStateMachineService({ logger });
    });

    it('should clear position state', () => {
      const posId = createPositionStateMachinePositionId();

      transitionPositionState(service, {
        targetState: PositionState.TP1_HIT,
        positionId: posId,
        reason: 'Test',
      });

      expect(service.getState('BTCUSDT', posId)).toBe(PositionState.TP1_HIT);

      service.clearState('BTCUSDT', posId);

      expect(service.getState('BTCUSDT', posId)).toBeNull();
    });
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      const service = createLegacyService({ logger });
      await expect(service.initialize()).resolves.not.toThrow();
      expect(service.isInitialized()).toBe(true);
    });

    it('should initialize without errors via shared service builder', async () => {
      const { service } = createLegacyHarness({ logger });
      await expect(service.initialize()).resolves.not.toThrow();
      expect(service.isInitialized()).toBe(true);
    });
  });
});
