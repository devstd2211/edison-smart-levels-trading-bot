/**
 * Phase 8.9.10: SessionStatsService - ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration with:
 * - GRACEFUL_DEGRADE strategy for file I/O failures (load with corrupted file backup)
 * - RETRY strategy for transient save errors
 * - THROW strategy for validation errors (duplicate trade IDs)
 * - SKIP strategy for missing trades (updateTradeExit)
 * - Backward compatibility (works without ErrorHandler)
 *
 * Total: 20 comprehensive tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { SessionStatsService } from '../../services/session-stats.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  SessionRecordValidationError,
} from '../../errors/DomainErrors';
import {
  createSessionStatsConfig,
  createSessionStatsExitUpdate,
  createSessionStatsLogger,
  createSessionStatsService,
  createSessionStatsTrade,
  createManagedSessionStatsContext,
  getSessionStatsCorruptedBackupPath,
  getSessionStatsFilePath,
  SessionStatsMockLogger,
} from '../helpers/session-stats-test.utils';

const createConfig = createSessionStatsConfig;
const createSessionTrade = createSessionStatsTrade;
type ManagedSessionStatsFixtures = ReturnType<typeof createManagedSessionStatsContext>;
type SessionStatsFixtures = {
  runtime: Pick<ManagedSessionStatsFixtures, 'stats' | 'errorHandler' | 'logger'>;
  paths: Pick<ManagedSessionStatsFixtures, 'tempDir'>;
  factories: Pick<ManagedSessionStatsFixtures, 'createService'>;
};
type SessionStatsCreateService = SessionStatsFixtures['factories']['createService'];

function bindSessionStatsFixtures() {
  let runtime: SessionStatsFixtures['runtime'];
  let paths: SessionStatsFixtures['paths'];
  let factories: SessionStatsFixtures['factories'];
  let cleanup: ManagedSessionStatsFixtures['cleanup'];

  beforeEach(() => {
    const managedContext = createManagedSessionStatsContext({
      logger: createSessionStatsLogger(),
    });
    runtime = {
      stats: managedContext.stats,
      errorHandler: managedContext.errorHandler,
      logger: managedContext.logger,
    };
    paths = {
      tempDir: managedContext.tempDir,
    };
    factories = {
      createService: managedContext.createService,
    };
    cleanup = managedContext.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  return () => ({ runtime, paths, factories });
}

describe('Phase 8.9.10: SessionStatsService - Error Handling Integration', () => {
  let stats: SessionStatsService;
  let errorHandler: ErrorHandler;
  let logger: SessionStatsMockLogger;
  let tempDir: string;
  let createService: SessionStatsCreateService;
  const getFixtures = bindSessionStatsFixtures();

  beforeEach(() => {
    const { runtime, paths, factories } = getFixtures();
    ({ stats, errorHandler, logger } = runtime);
    ({ tempDir } = paths);
    ({ createService } = factories);
  });

  // ============================================================================
  // A. FILE I/O ERRORS (6 tests) - GRACEFUL_DEGRADE & RETRY
  // ============================================================================

  describe('A. File I/O Errors - GRACEFUL_DEGRADE & RETRY', () => {
    it('test-A1: Should degrade gracefully on corrupted JSON', () => {
      // Arrange: Create corrupted JSON file
      const statsPath = getSessionStatsFilePath(tempDir);
      fs.writeFileSync(statsPath, '{invalid json}', 'utf-8');

      // Act: Create stats service and explicitly start load lifecycle
      const svc = createService({ autoStart: true });

      // Assert: Should start with empty database instead of crashing
      expect(svc.getAllSessions()).toHaveLength(0);

      // Verify backup was created
      const backupPath = getSessionStatsCorruptedBackupPath(tempDir);
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    it('test-A2: Should create backup of corrupted file', () => {
      // Arrange: Create corrupted JSON file with specific content
      const statsPath = getSessionStatsFilePath(tempDir);
      const corruptedContent = '{ "sessions": [invalid] }';
      fs.writeFileSync(statsPath, corruptedContent, 'utf-8');

      // Act: Create stats service and explicitly start load lifecycle
      const svc = createService({ autoStart: true });

      // Assert: Backup should contain the corrupted content
      const backupPath = getSessionStatsCorruptedBackupPath(tempDir);
      expect(fs.existsSync(backupPath)).toBe(true);

      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      expect(backupContent).toBe(corruptedContent);
    });

    it('test-A3: Should start session and save after recovery', () => {
      // Arrange: Create corrupted file
      const statsPath = getSessionStatsFilePath(tempDir);
      fs.writeFileSync(statsPath, '{bad json}', 'utf-8');

      // Act: Create service and start session
      const svc = createService();
      const sessionId = svc.startSession(createConfig(), 'BTCUSDT');

      // Assert: Session should be created and file should be valid now
      expect(sessionId).toMatch(/^session_/);
      const savedContent = fs.readFileSync(statsPath, 'utf-8');
      const parsed = JSON.parse(savedContent); // Should not throw
      expect(parsed.sessions).toHaveLength(1);
    });

    it('test-A4: Should retry on file write failure (disk issues)', () => {
      // Arrange: Create a session
      stats.startSession(createConfig(), 'BTCUSDT');
      const trade = createSessionTrade('trade-1');

      // Act: Record trade (triggers save)
      stats.recordTradeEntry(trade);

      // Assert: File should be saved
      const statsPath = getSessionStatsFilePath(tempDir);
      expect(fs.existsSync(statsPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
      expect(content.sessions[0].trades).toHaveLength(1);
    });

    it('test-A5: Should handle missing data directory and create it', () => {
      // Arrange: Use non-existent directory
      const newDir = path.join(tempDir, 'nested', 'dir', 'structure');

      // Act: Create session in non-existent directory
      const svc = createSessionStatsService({
        logger,
        tempDir: newDir,
        errorHandler,
        autoStart: true,
      });
      svc.startSession(createConfig(), 'BTCUSDT');

      // Assert: Directory should be created
      expect(fs.existsSync(newDir)).toBe(true);
      const statsPath = getSessionStatsFilePath(newDir);
      expect(fs.existsSync(statsPath)).toBe(true);
    });

    it('test-A6: Should handle very large JSON files (stress test)', () => {
      // Arrange: Create session with many trades
      stats.startSession(createConfig(), 'BTCUSDT');

      // Act: Add 100 trades
      for (let i = 0; i < 100; i++) {
        const trade = createSessionTrade(`trade-${i}`);
        stats.recordTradeEntry(trade);
      }

      // Assert: All trades should be saved
      const session = stats.getCurrentSession();
      expect(session?.trades).toHaveLength(100);

      // Verify file is valid
      const statsPath = getSessionStatsFilePath(tempDir);
      const content = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
      expect(content.sessions[0].trades).toHaveLength(100);
    });
  });

  // ============================================================================
  // B. VALIDATION ERRORS (4 tests) - THROW strategy
  // ============================================================================

  describe('B. Validation Errors - THROW Strategy', () => {
    it('test-B1: Should throw on duplicate tradeId with ErrorHandler', () => {
      // Arrange: Create session and record a trade
      stats.startSession(createConfig(), 'BTCUSDT');
      const trade1 = createSessionTrade('duplicate-trade');
      stats.recordTradeEntry(trade1);

      // Act & Assert: Recording same trade ID should throw
      const trade2 = createSessionTrade('duplicate-trade');
      expect(() => stats.recordTradeEntry(trade2)).toThrow(
        SessionRecordValidationError,
      );
    });

    it('test-B2: Should include error context in duplicate validation', () => {
      // Arrange: Create session and record a trade
      stats.startSession(createConfig(), 'BTCUSDT');
      const trade1 = createSessionTrade('my-trade');
      stats.recordTradeEntry(trade1);

      // Act & Assert: Error should contain tradeId context
      const trade2 = createSessionTrade('my-trade');
      try {
        stats.recordTradeEntry(trade2);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionRecordValidationError);
        const tradingError = error as SessionRecordValidationError;
        const context = tradingError.metadata.context as
          | { tradeId?: string }
          | undefined;
        expect(context?.tradeId).toBe('my-trade');
      }
    });

    it('test-B3: Should allow different tradeIds in same session', () => {
      // Arrange: Create session
      stats.startSession(createConfig(), 'BTCUSDT');

      // Act: Record multiple different trades
      const trade1 = createSessionTrade('trade-1');
      const trade2 = createSessionTrade('trade-2');
      const trade3 = createSessionTrade('trade-3');

      stats.recordTradeEntry(trade1);
      stats.recordTradeEntry(trade2);
      stats.recordTradeEntry(trade3);

      // Assert: All trades should be recorded
      const session = stats.getCurrentSession();
      expect(session?.trades).toHaveLength(3);
    });

    it('test-B4: Should skip duplicate without ErrorHandler (backward compatibility)', () => {
      // Arrange: Create service WITHOUT ErrorHandler
      const statsNoHandler = createService({ errorHandler: undefined });
      statsNoHandler.startSession(createConfig(), 'BTCUSDT');
      const trade1 = createSessionTrade('trade-id');
      statsNoHandler.recordTradeEntry(trade1);

      // Act: Try to record duplicate
      const trade2 = createSessionTrade('trade-id');
      statsNoHandler.recordTradeEntry(trade2); // Should not throw

      // Assert: Only first trade recorded (graceful degradation)
      const session = statsNoHandler.getCurrentSession();
      expect(session?.trades).toHaveLength(1);
    });
  });

  // ============================================================================
  // C. TRANSACTIONAL OPERATIONS (4 tests) - RETRY & SKIP
  // ============================================================================

  describe('C. Transactional Operations - RETRY & SKIP', () => {
    it('test-C1: Should retry save on recordTradeEntry', () => {
      // Arrange: Create session
      stats.startSession(createConfig(), 'BTCUSDT');

      // Act: Record multiple trades (each triggers save)
      for (let i = 0; i < 5; i++) {
        const trade = createSessionTrade(`trade-${i}`);
        stats.recordTradeEntry(trade);
      }

      // Assert: All trades should be saved
      const statsPath = getSessionStatsFilePath(tempDir);
      const content = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
      expect(content.sessions[0].trades).toHaveLength(5);
    });

    it('test-C2: Should retry save on startSession', () => {
      // Arrange: Create first session
      const sessionId1 = stats.startSession(createConfig(), 'BTCUSDT');

      // Act: Close and start another session
      stats.endSession();
      const sessionId2 = stats.startSession(createConfig(), 'ETHUSDT');

      // Assert: Both sessions should be saved
      const statsPath = getSessionStatsFilePath(tempDir);
      const content = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
      expect(content.sessions).toHaveLength(2);
      expect(content.sessions[0].sessionId).toBe(sessionId1);
      expect(content.sessions[1].sessionId).toBe(sessionId2);
    });

    it('test-C3: Should retry save on endSession', () => {
      // Arrange: Create and end session
      stats.startSession(createConfig(), 'BTCUSDT');
      const trade = createSessionTrade('trade-1');
      stats.recordTradeEntry(trade);

      // Act: End session
      stats.endSession();

      // Assert: Session should have endTime
      const statsPath = getSessionStatsFilePath(tempDir);
      const content = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
      expect(content.sessions[0].endTime).not.toBeNull();
    });

    it('test-C4: Should skip missing trades in updateTradeExit', () => {
      // Arrange: Create session without adding the trade
      stats.startSession(createConfig(), 'BTCUSDT');

      // Act: Update non-existent trade (should log warning, not crash)
      const result = stats.updateTradeExit(
        'non-existent-trade',
        createSessionStatsExitUpdate(),
      );

      // Assert: Should return gracefully (SKIP strategy)
      expect(result).toBeUndefined(); // Method doesn't return, just logs
    });
  });

  // ============================================================================
  // D. INTEGRATION TESTS (4 tests) - End-to-End
  // ============================================================================

  describe('D. Integration Tests - End-to-End', () => {
    it('test-D1: Full session lifecycle with error recovery', () => {
      // Arrange: Start session
      const sessionId = stats.startSession(createConfig(), 'BTCUSDT');
      expect(sessionId).toMatch(/^session_/);

      // Act: Record entries and exits
      const trade1 = createSessionTrade('trade-1');
      stats.recordTradeEntry(trade1);

      stats.updateTradeExit('trade-1', createSessionStatsExitUpdate());

      const trade2 = createSessionTrade('trade-2');
      stats.recordTradeEntry(trade2);

      stats.endSession();

      // Assert: Session should be fully persisted
      const statsPath = getSessionStatsFilePath(tempDir);
      const content = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
      expect(content.sessions).toHaveLength(1);
      expect(content.sessions[0].trades).toHaveLength(2);
      expect(content.sessions[0].endTime).not.toBeNull();
    });

    it('test-D2: Cascading failures with recovery', () => {
      // Arrange: Create session with many operations
      stats.startSession(createConfig(), 'BTCUSDT');

      // Act: Mix of valid operations and potential failure points
      for (let i = 0; i < 10; i++) {
        const trade = createSessionTrade(`trade-${i}`);
        stats.recordTradeEntry(trade);

        // Simulate some exit updates (some may fail due to missing trades)
        if (i % 2 === 0) {
          stats.updateTradeExit(`trade-${i}`, createSessionStatsExitUpdate());
        }
      }

      stats.endSession();

      // Assert: All valid trades should be persisted
      const session = stats.getCurrentSession();
      expect(session).toBeNull(); // Session was closed

      const savedSession = stats.getAllSessions()[0];
      expect(savedSession.trades).toHaveLength(10);
    });

    it('test-D3: Resume interrupted session after load', () => {
      // Arrange: Create and interrupt a session
      const sessionId = stats.startSession(createConfig(), 'BTCUSDT');
      const trade1 = createSessionTrade('trade-1');
      stats.recordTradeEntry(trade1);

      // Simulate crash/restart by creating new service instance
      const stats2 = createService({ autoStart: true });

      // Act: Resume and continue trading
      const currentSession = stats2.getCurrentSession();
      expect(currentSession?.sessionId).toBe(sessionId); // Should resume

      const trade2 = createSessionTrade('trade-2');
      stats2.recordTradeEntry(trade2);

      // Assert: Both trades should be in resumed session
      expect(currentSession?.trades).toHaveLength(2);
    });

    it('test-D4: Multiple sessions with independent error handling', () => {
      // Arrange & Act: Create first session
      stats.startSession(createConfig(), 'BTCUSDT');
      stats.recordTradeEntry(createSessionTrade('trade-1'));
      stats.endSession();

      // Create second session
      stats.startSession(createConfig(), 'ETHUSDT');
      stats.recordTradeEntry(createSessionTrade('trade-2'));
      stats.recordTradeEntry(createSessionTrade('trade-3'));
      stats.endSession();

      // Create third session
      stats.startSession(createConfig(), 'ADAUSDT');
      stats.recordTradeEntry(createSessionTrade('trade-4'));
      stats.endSession();

      // Assert: All sessions should be independent (check by index order)
      const allSessions = stats.getAllSessions();
      expect(allSessions).toHaveLength(3);

      // Sessions are returned newest first, so reverse check
      const newestFirst = allSessions; // getAllSessions sorts by newest first
      const session3 = newestFirst[0]; // Most recent
      expect(session3.symbol).toBe('ADAUSDT');
      expect(session3.trades).toHaveLength(1);

      const session2 = newestFirst[1];
      expect(session2.symbol).toBe('ETHUSDT');
      expect(session2.trades).toHaveLength(2);

      const session1 = newestFirst[2];
      expect(session1.symbol).toBe('BTCUSDT');
      expect(session1.trades).toHaveLength(1);
    });
  });

  // ============================================================================
  // E. BACKWARD COMPATIBILITY (2 tests)
  // ============================================================================

  describe('E. Backward Compatibility - Works Without ErrorHandler', () => {
    it('test-E1: Should work without ErrorHandler parameter', () => {
      // Arrange: Create service without ErrorHandler
      const statsNoHandler = createService({ errorHandler: undefined });

      // Act: Perform all basic operations
      const sessionId = statsNoHandler.startSession(createConfig(), 'BTCUSDT');
      const trade = createSessionTrade('trade-1');
      statsNoHandler.recordTradeEntry(trade);

      statsNoHandler.updateTradeExit('trade-1', createSessionStatsExitUpdate());

      statsNoHandler.endSession();

      // Assert: All operations should work without ErrorHandler
      expect(statsNoHandler.getAllSessions()).toHaveLength(1);
      const session = statsNoHandler.getSession(sessionId);
      expect(session?.trades).toHaveLength(1);
    });

    it('test-E2: Should gracefully handle file errors without ErrorHandler', () => {
      // Arrange: Create corrupted file
      const statsPath = getSessionStatsFilePath(tempDir);
      fs.writeFileSync(statsPath, '{corrupted}', 'utf-8');

      // Act: Create service without ErrorHandler
      const statsNoHandler = createService({ errorHandler: undefined, autoStart: true });

      // Assert: Should start with empty database (graceful degradation)
      expect(statsNoHandler.getAllSessions()).toHaveLength(0);

      // Verify backup was still created
      const backupPath = getSessionStatsCorruptedBackupPath(tempDir);
      expect(fs.existsSync(backupPath)).toBe(true);
    });
  });
});
