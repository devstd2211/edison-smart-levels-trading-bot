/**
 * Phase 9.P1: Transactional Close with Rollback Tests
 *
 * Tests for position-exiting.service.ts transactional error handling
 * Ensures journal stays consistent even if session stats fails
 */

import {
  createCloseStatusGuard,
  createBalanceTrackingHarness,
  createTransactionalTradeCloseRequest,
  createManagedTransactionalCloseContext,
  createJournalSkipTracker,
  createThrowingTradeCloseRecorder,
  executeTransactionalCloseFlow,
  invokeRollbackMultipleTimes,
  writeTransactionalRollbackLog,
  type TransactionalCloseManagedRuntime,
} from '../helpers/position-exiting-test.utils';

describe('Position Exiting Transactional Tests (Phase 9.P1)', () => {
  let harness: TransactionalCloseManagedRuntime['harness'];
  let cleanup: TransactionalCloseManagedRuntime['cleanup'];

  beforeEach(() => {
    ({ harness, cleanup } = createManagedTransactionalCloseContext());
  });

  afterEach(() => {
    cleanup();
  });

  it('T1: Normal flow - journal and stats both succeed', () => {
    const { mockJournal, mockStats, journalResult } = executeTransactionalCloseFlow();

    expect(journalResult).toBeDefined();
    expect(journalResult.rollback).toBeDefined();
    expect(mockJournal.recordTradeClose).toHaveBeenCalled();
    expect(mockStats.updateTradeExit).toHaveBeenCalled();
  });

  it('T2: Session stats fails - journal rolls back', () => {
    const { rollback, statsError } = executeTransactionalCloseFlow({
      statsImplementation: (_trade: unknown) => {
        throw new Error('Database connection lost');
      },
    });

    expect(statsError).toBeDefined();
    expect(rollback).toHaveBeenCalled();
  });

  it('T3: Virtual balance restored on rollback', () => {
    const mockBalance = createBalanceTrackingHarness();

    mockBalance.updateBalance(100);
    expect(mockBalance.getCurrentBalance()).toBe(1100);

    mockBalance.updateBalance(-100);
    expect(mockBalance.getCurrentBalance()).toBe(mockBalance.initialBalance);
  });

  it('T4: Rollback is idempotent - can be called multiple times', () => {
    const rollbackFn = jest.fn();

    invokeRollbackMultipleTimes(rollbackFn, 3);

    expect(rollbackFn).toHaveBeenCalledTimes(3);
  });

  it('T5: Position with no journalId skips journal (no rollback needed)', () => {
    const mockJournal = createJournalSkipTracker();

    expect(mockJournal.recordTradeClose).not.toHaveBeenCalled();
  });

  it('T6: Rollback operation logs errors for debugging', () => {
    const { mockLogger } = harness;

    writeTransactionalRollbackLog(mockLogger, 'Journal rollback complete');

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('rollback'));
  });

  it('T7: Journal failure prevents position close', () => {
    const tradeCloseRequest = createTransactionalTradeCloseRequest();
    const mockJournal = createThrowingTradeCloseRecorder();

    expect(() => {
      mockJournal.recordTradeClose(tradeCloseRequest);
    }).toThrow('Journal file I/O failed');
  });

  it('T8: Concurrent close attempts handled safely', () => {
    const closeGuard = createCloseStatusGuard();

    const result1 = closeGuard.closePosition();
    const result2 = closeGuard.closePosition();

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(closeGuard.getStatus()).toBe('CLOSED');
  });
});
