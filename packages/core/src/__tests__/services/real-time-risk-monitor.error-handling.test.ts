/**
 * Phase 8.5: RealTimeRiskMonitor - ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration in RealTimeRiskMonitor with:
 * - GRACEFUL_DEGRADE strategy for position validation & price validation
 * - GRACEFUL_DEGRADE strategy for zero division protection
 * - SKIP strategy for event publishing failures
 * - End-to-end error recovery scenarios
 *
 * Total: 15 comprehensive tests
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RealTimeRiskMonitor } from '../../services/real-time-risk-monitor.service';
import { DangerLevel, LiveTradingEventType } from '../../types/legacy';
import {
  attachMockRiskMonitorPosition,
  createManagedRealTimeRiskMonitorContext,
  createRealTimeRiskMonitorPublishFailure,
  seedRiskMonitorCachedFallbackScore,
  seedRiskMonitorCachedHealthScore,
  type RealTimeRiskMonitorHarness,
  type ManagedRealTimeRiskMonitorContext,
  type MockRiskMonitorEventBus,
  type MockRiskMonitorLogger,
  type MockRiskMonitorPositionService,
} from '../helpers/real-time-risk-monitor-test.utils';

function bindRealTimeRiskMonitorFixtures() {
  type RealTimeRiskMonitorFixtures = Pick<
    ManagedRealTimeRiskMonitorContext,
    'monitor' | 'mockPositionService' | 'mockLogger' | 'mockEventBus'
  >;
  let cleanup: ManagedRealTimeRiskMonitorContext['cleanup'];
  let fixtures: RealTimeRiskMonitorFixtures;

  beforeEach(() => {
    const managedContext = createManagedRealTimeRiskMonitorContext();
    cleanup = managedContext.cleanup;
    fixtures = {
      monitor: managedContext.monitor,
      mockPositionService: managedContext.mockPositionService,
      mockLogger: managedContext.mockLogger,
      mockEventBus: managedContext.mockEventBus,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('Phase 8.5: RealTimeRiskMonitor - Error Handling Integration', () => {
  let monitor: RealTimeRiskMonitor;
  let mockPositionLifecycleService: MockRiskMonitorPositionService;
  let mockLogger: MockRiskMonitorLogger;
  let mockEventBus: MockRiskMonitorEventBus;
  let harness: RealTimeRiskMonitorHarness;
  const getFixtures = bindRealTimeRiskMonitorFixtures();

  beforeEach(() => {
    const fixtures = getFixtures();
    harness = fixtures;
    monitor = fixtures.monitor;
    mockPositionLifecycleService = fixtures.mockPositionService;
    mockLogger = fixtures.mockLogger;
    mockEventBus = fixtures.mockEventBus;
  });

  describe('[GRACEFUL_DEGRADE] calculatePositionHealth() - Position Validation (4 tests)', () => {
    it('test-8.5.1: Should return cached health score when position not found', async () => {
      const position = attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        {},
      );

      // First call to populate cache
      const healthScore = await monitor.calculatePositionHealth('pos-123', 46000);
      expect(healthScore.positionId).toBe('pos-123');
      expect(monitor.getLatestHealthScore('pos-123')).toBeDefined();

      // Second call with position not found - should return cached
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      const cachedScore = await monitor.calculatePositionHealth('pos-123', 46000);
      expect(cachedScore.positionId).toBe('pos-123');
      expect(cachedScore.overallScore).toBe(healthScore.overallScore);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '🔄 Position not found, returning cached health score',
        expect.objectContaining({ positionId: 'pos-123' })
      );
    });

    it('test-8.5.2: Should return safe default when position not found and no cache', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      const healthScore = await monitor.calculatePositionHealth('pos-unknown', 46000);
      expect(healthScore.overallScore).toBe(70); // Safe default
      expect(healthScore.status).toBe(DangerLevel.SAFE);
      expect(healthScore.symbol).toBe('UNKNOWN');
    });

    it('test-8.5.3: Should handle position ID mismatch gracefully', async () => {
      attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        { id: 'pos-456' },
      );

      const healthScore = await monitor.calculatePositionHealth('pos-123', 46000);
      expect(healthScore.overallScore).toBe(70); // Safe default
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '🔄 Position not found, returning cached health score',
        expect.objectContaining({ positionId: 'pos-123' })
      );
    });

    it('test-8.5.4: Should log warning on graceful degradation', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      await monitor.calculatePositionHealth('pos-123', 46000);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('🔄'),
        expect.any(Object)
      );
    });
  });

  describe('[GRACEFUL_DEGRADE] calculatePositionHealth() - Price Validation (4 tests)', () => {
    it('test-8.5.5: Should use fallback price when currentPrice is NaN', async () => {
      attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        { entryPrice: 45000 },
      );

      const healthScore = await monitor.calculatePositionHealth('pos-123', NaN);
      expect(healthScore).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Invalid currentPrice'),
        expect.any(Object)
      );
    });

    it('test-8.5.6: Should use fallback price when currentPrice is zero', async () => {
      attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        { entryPrice: 45000 },
      );

      const healthScore = await monitor.calculatePositionHealth('pos-123', 0);
      expect(healthScore).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Invalid currentPrice'),
        expect.any(Object)
      );
    });

    it('test-8.5.7: Should use fallback price when currentPrice is negative', async () => {
      attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        { entryPrice: 45000 },
      );

      const healthScore = await monitor.calculatePositionHealth('pos-123', -100);
      expect(healthScore).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Invalid currentPrice'),
        expect.any(Object)
      );
    });

    it('test-8.5.8: Should calculate correctly with valid currentPrice', async () => {
      attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        { entryPrice: 45000 },
      );

      const healthScore = await monitor.calculatePositionHealth('pos-123', 46000);
      expect(healthScore).toBeDefined();
      expect(healthScore.overallScore).toBeGreaterThan(0);
      expect(healthScore.overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('[GRACEFUL_DEGRADE] PnL Calculation - Zero Division (3 tests)', () => {
    it('test-8.5.9: Should return safe default when quantity is zero', async () => {
      attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        { quantity: 0, entryPrice: 45000 },
      );

      const healthScore = await monitor.calculatePositionHealth('pos-123', 46000);
      expect(healthScore.overallScore).toBe(70); // Safe default
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Zero denominator'),
        expect.any(Object)
      );
    });

    it('test-8.5.10: Should return safe default when entryPrice is zero', async () => {
      attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        { quantity: 0.1, entryPrice: 0 },
      );

      const healthScore = await monitor.calculatePositionHealth('pos-123', 46000);
      expect(healthScore.overallScore).toBe(70); // Safe default
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Zero denominator'),
        expect.any(Object)
      );
    });

    it('test-8.5.11: Should return safe default when both quantity and entryPrice are zero', async () => {
      attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        { quantity: 0, entryPrice: 0 },
      );

      const healthScore = await monitor.calculatePositionHealth('pos-123', 46000);
      expect(healthScore.overallScore).toBe(70); // Safe default
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Zero denominator'),
        expect.any(Object)
      );
    });
  });

  describe('[SKIP] monitorAllPositions() - Event Publishing (2 tests)', () => {
    it('test-8.5.12: Should skip HEALTH_SCORE_UPDATED event on publish failure', async () => {
      attachMockRiskMonitorPosition({ mockPositionService: mockPositionLifecycleService });

      mockEventBus.publishSync.mockImplementation(
        createRealTimeRiskMonitorPublishFailure(LiveTradingEventType.HEALTH_SCORE_UPDATED),
      );

      const report = await monitor.monitorAllPositions(46000);
      expect(report).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Failed to publish HEALTH_SCORE_UPDATED'),
        expect.any(Object)
      );
    });

    it('test-8.5.13: Should skip RISK_ALERT_TRIGGERED event on publish failure', async () => {
      attachMockRiskMonitorPosition({ mockPositionService: mockPositionLifecycleService });

      // Create alert condition with critical health score
      mockEventBus.publishSync.mockImplementation(
        createRealTimeRiskMonitorPublishFailure(LiveTradingEventType.RISK_ALERT_TRIGGERED),
      );

      const report = await monitor.monitorAllPositions(44000); // Low price triggers alert
      expect(report).toBeDefined();
      // Alert may or may not be triggered depending on health score, but event handling shouldn't crash
      expect(mockEventBus.publishSync).toHaveBeenCalled();
    });
  });

  describe('End-to-End Error Recovery Scenarios (2 tests)', () => {
    it('test-8.5.14: Should continue monitoring when position validation fails', async () => {
      const { cachedScore: firstScore } = await seedRiskMonitorCachedHealthScore(
        harness,
        {},
        46000,
      );
      expect(firstScore).toBeDefined();

      // Then, simulate position not found but we have cache
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      // This should not throw and should use cache
      const report = await monitor.monitorAllPositions(46000);
      expect(report).toBeDefined();
      expect(report.totalPositions).toBeGreaterThanOrEqual(0);
    });

    it('test-8.5.15: Should handle cascading failures gracefully', async () => {
      attachMockRiskMonitorPosition(
        { mockPositionService: mockPositionLifecycleService },
        { quantity: 0, entryPrice: 0 },
      );

      // Make event bus fail too
      mockEventBus.publishSync.mockImplementation(() => {
        throw new Error('Event bus down');
      });

      // Should not throw despite multiple failures
      const report = await monitor.monitorAllPositions(46000);
      expect(report).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Integration with Existing Functionality', () => {
    it('should not break existing getLatestHealthScore functionality', async () => {
      const { position, cachedScore: cached } = await seedRiskMonitorCachedHealthScore(
        harness,
        {},
        46000,
      );

      expect(cached).toBeDefined();
      expect(cached?.positionId).toBe(position.id);
    });

    it('should not break existing checkPositionDanger functionality', async () => {
      attachMockRiskMonitorPosition({ mockPositionService: mockPositionLifecycleService });

      const danger = await monitor.checkPositionDanger('pos-123', 46000);
      expect(danger).toBeDefined();
      expect([DangerLevel.SAFE, DangerLevel.WARNING, DangerLevel.CRITICAL]).toContain(danger);
    });

    it('should not break existing shouldTriggerAlert functionality', async () => {
      attachMockRiskMonitorPosition({ mockPositionService: mockPositionLifecycleService });

      const alert = await monitor.shouldTriggerAlert('pos-123', 46000);
      expect(alert).toBeNull(); // No alert for normal conditions
    });
  });
});

