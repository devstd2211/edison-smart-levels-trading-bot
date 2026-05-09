/**
 * Phase 9.1: Real-Time Risk Monitor Service Tests
 *
 * Comprehensive unit tests for RealTimeRiskMonitor service
 * Tests health score calculation, danger detection, and alert triggering
 *
 * Coverage:
 * - Health score calculation (overall + components)
 * - Danger level detection (SAFE/WARNING/CRITICAL)
 * - Risk alert triggering
 * - Position monitoring
 * - Cache management
 */

import { PositionSide } from '../../types/legacy';
import {
  DangerLevel,
  RiskAlertType,
  LiveTradingEventType,
} from '../../types/legacy';
import {
  attachRiskMonitorCurrentPosition,
  createManagedRealTimeRiskMonitorContext,
  createRiskMonitorOpenedAtHoursAgo,
  createRiskMonitorOpenedAtMinutesAgo,
  seedRiskMonitorCachedHealthScore,
  type RealTimeRiskMonitorSuiteState,
} from '../helpers/real-time-risk-monitor-test.utils';
import { ICONS } from '../../cli/cli-runtime';

// ============================================================================
// MOCKS & FIXTURES
// ============================================================================

describe('RealTimeRiskMonitor Service Tests', () => {
  let cleanup: RealTimeRiskMonitorSuiteState['cleanup'];
  let monitor: RealTimeRiskMonitorSuiteState['monitor'];
  let mockPositionService: RealTimeRiskMonitorSuiteState['mockPositionService'];
  let mockEventBus: RealTimeRiskMonitorSuiteState['mockEventBus'];
  let mockLogger: RealTimeRiskMonitorSuiteState['mockLogger'];

  beforeEach(() => {
    ({
      monitor,
      mockPositionService,
      mockEventBus,
      mockLogger,
      cleanup,
    } = createManagedRealTimeRiskMonitorContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================================================
  // HEALTH SCORE CALCULATION TESTS
  // ========================================================================

  describe('calculatePositionHealth - Overall Score', () => {
    it('should calculate health score for profitable position', async () => {
      // For profit: entry=45000, current=46000 means $1000 profit
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: 1000,
      });

      const score = await monitor.calculatePositionHealth(position.id, 46000);

      expect(score).toBeDefined();
      expect(score.positionId).toBe('POS-123');
      expect(score.symbol).toBe('BTCUSDT');
      expect(score.overallScore).toBeGreaterThan(70);
      expect(score.status).toBe(DangerLevel.SAFE);
      expect(score.components).toBeDefined();
      expect(score.lastUpdate).toBeDefined();
    });

    it('should calculate health score for losing position', async () => {
      // For loss: entry=45000, current=43000 means $2000 loss (4.4%)
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: -2000,
      });

      const score = await monitor.calculatePositionHealth(position.id, 43000);

      // Score is weighted: profitability down, but other factors buffer it
      // Score around 83 (still SAFE) due to averaging with 5 components
      expect(score.overallScore).toBeGreaterThan(75);
      expect(score.status).toBe(DangerLevel.SAFE);
    });

    it('should return safe default if position not found', async () => {
      mockPositionService.getCurrentPosition.mockReturnValue(null);

      const score = await monitor.calculatePositionHealth('NONEXISTENT', 45000);
      // Phase 8.5: GRACEFUL_DEGRADE returns safe default (70) instead of throwing
      expect(score.overallScore).toBe(70);
      expect(score.status).toBe(DangerLevel.SAFE);
    });

    it('should return safe default if position ID mismatch', async () => {
      attachRiskMonitorCurrentPosition({ mockPositionService }, { id: 'POS-111' });

      const score = await monitor.calculatePositionHealth('POS-999', 45000);
      // Phase 8.5: GRACEFUL_DEGRADE returns safe default (70) instead of throwing
      expect(score.overallScore).toBe(70);
      expect(score.status).toBe(DangerLevel.SAFE);
    });
  });

  // ========================================================================
  // HEALTH SCORE COMPONENTS TESTS
  // ========================================================================

  describe('Health Score Components', () => {
    it('should calculate time at risk score (newly opened)', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        openedAt: createRiskMonitorOpenedAtMinutesAgo(10),
      });

      const score = await monitor.calculatePositionHealth(position.id, 45000);

      // 10 minutes of 240 max = 4% of max, score should be ~96
      expect(score.components.timeAtRiskScore).toBeGreaterThan(90);
    });

    it('should calculate time at risk score (old position)', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        openedAt: createRiskMonitorOpenedAtHoursAgo(4),
      });

      const score = await monitor.calculatePositionHealth(position.id, 45000);

      // 4 hours = 100% of max, score should be ~0
      expect(score.components.timeAtRiskScore).toBeLessThan(10);
    });

    it('should calculate drawdown score (profitable)', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: 1000, // $1000 profit
      });

      const score = await monitor.calculatePositionHealth(position.id, 46000);

      // Profitable = 100 score
      expect(score.components.drawdownScore).toBe(100);
    });

    it('should calculate drawdown score (5% loss)', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: -2250, // 5% loss on 45k entry
      });

      const score = await monitor.calculatePositionHealth(position.id, 42750);

      // -5% loss = 100 - (5 * 2) = 90
      expect(score.components.drawdownScore).toBe(90);
    });

    it('should calculate profitability score', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: 1350, // 3% profit on 45k entry
      });

      const score = await monitor.calculatePositionHealth(position.id, 46350);

      // 3% profit = 100 + (3 * 2) = 106, capped at 100
      expect(score.components.profitabilityScore).toBe(100);
    });

    it('should provide default high scores for liquidity and volatility', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService });

      const score = await monitor.calculatePositionHealth(position.id, 45000);

      expect(score.components.volumeLiquidityScore).toBe(80);
      expect(score.components.volatilityScore).toBe(75);
    });
  });

  // ========================================================================
  // DANGER LEVEL DETECTION TESTS
  // ========================================================================

  describe('Danger Level Detection', () => {
    it('should detect SAFE status (score >= 70)', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: 1000, // Profitable
      });

      const score = await monitor.calculatePositionHealth(position.id, 46000);

      expect(score.status).toBe(DangerLevel.SAFE);
    });

    it('should detect WARNING status (30 <= score < 70)', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: -9000, // 20% loss - trigger WARNING
        openedAt: createRiskMonitorOpenedAtHoursAgo(2),
      });

      const score = await monitor.calculatePositionHealth(position.id, 36000);

      expect(score.status).toBe(DangerLevel.WARNING);
    });

    it('should detect CRITICAL status (score < 30)', async () => {
      // To get truly CRITICAL (score <30), need very severe loss + old position
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: -30000, // 66% loss (very severe)
        openedAt: createRiskMonitorOpenedAtHoursAgo(4),
      });

      const score = await monitor.calculatePositionHealth(position.id, 15000);

      // With both severe loss AND maximum time at risk, should hit CRITICAL
      expect(score.status).toBe(DangerLevel.CRITICAL);
    });

    it('should check position danger level', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: 900, // 2% profit
      });

      const danger = await monitor.checkPositionDanger(position.id, 45900);

      expect(danger).toBe(DangerLevel.SAFE);
    });
  });

  // ========================================================================
  // RISK ALERT TRIGGERING TESTS
  // ========================================================================

  describe('Risk Alert Triggering', () => {
    it('should trigger EXCESSIVE_DRAWDOWN alert on >5% loss', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: -13500, // 30% loss (triggers drawdown + health alerts)
      });

      const alert = await monitor.shouldTriggerAlert(position.id, 31500);

      expect(alert).not.toBeNull();
      // First check is for drawdown which triggers before health score check
      expect(alert?.alertType).toBe(RiskAlertType.EXCESSIVE_DRAWDOWN);
    });

    it('should trigger EXCESSIVE_DRAWDOWN alert on >5% loss', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: -2700, // 6% loss (exceeds 5% threshold)
      });

      const alert = await monitor.shouldTriggerAlert(position.id, 42300);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe(RiskAlertType.EXCESSIVE_DRAWDOWN);
      expect(alert?.severity).toBe('WARNING');
    });

    it('should not trigger alert when position is healthy', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: 1000,
      });

      const alert = await monitor.shouldTriggerAlert(position.id, 46000);

      expect(alert).toBeNull();
    });

    it('should return null if position not found', async () => {
      mockPositionService.getCurrentPosition.mockReturnValue(null);

      const alert = await monitor.shouldTriggerAlert('NONEXISTENT', 45000);

      expect(alert).toBeNull();
    });

    it('should not trigger alert if position ID mismatch', async () => {
      attachRiskMonitorCurrentPosition({ mockPositionService }, { id: 'POS-111' });

      const alert = await monitor.shouldTriggerAlert('POS-999', 45000);

      expect(alert).toBeNull();
    });
  });

  // ========================================================================
  // POSITION MONITORING TESTS
  // ========================================================================

  describe('Position Monitoring', () => {
    it('should generate health report for single position', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: 1000,
      });

      const report = await monitor.monitorAllPositions(46000);

      expect(report.timestamp).toBeDefined();
      expect(report.totalPositions).toBe(1);
      expect(report.scores.length).toBe(1);
      expect(report.scores[0].positionId).toBe('POS-123');
      expect(report.averageScore).toBeGreaterThan(0);
    });

    it('should report no positions when none exist', async () => {
      mockPositionService.getCurrentPosition.mockReturnValue(null);

      const report = await monitor.monitorAllPositions(45000);

      expect(report.totalPositions).toBe(0);
      expect(report.scores.length).toBe(0);
      expect(report.safePositions).toBe(0);
      expect(report.warningPositions).toBe(0);
      expect(report.criticalPositions).toBe(0);
      expect(report.averageScore).toBe(0);
    });

    it('should emit HEALTH_SCORE_UPDATED event', async () => {
      attachRiskMonitorCurrentPosition({ mockPositionService });

      await monitor.monitorAllPositions(45000);

      expect(mockEventBus.publishSync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LiveTradingEventType.HEALTH_SCORE_UPDATED,
          data: expect.objectContaining({
            positionId: 'POS-123',
            symbol: 'BTCUSDT',
          }),
        })
      );
    });

    it('should emit RISK_ALERT_TRIGGERED event when alert occurs', async () => {
      attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: -13500, // 30% loss triggers EXCESSIVE_DRAWDOWN alert
      });

      await monitor.monitorAllPositions(31500);

      expect(mockEventBus.publishSync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LiveTradingEventType.RISK_ALERT_TRIGGERED,
        })
      );
    });

    it('should warn when current price not provided', async () => {
      attachRiskMonitorCurrentPosition({ mockPositionService });

      await monitor.monitorAllPositions(); // No currentPrice

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`${ICONS.warning} No current price provided`)
      );
    });
  });

  // ========================================================================
  // CACHE MANAGEMENT TESTS
  // ========================================================================

  describe('Cache Management', () => {
    it('should cache health score for 1 minute', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService });

      // First call - calculates
      const score1 = await monitor.calculatePositionHealth(position.id, 45000);

      // Second call within 60s - should return cached
      const score2 = await monitor.calculatePositionHealth(position.id, 45000);

      expect(score1).toEqual(score2);
    });

    it('should return cached health score with getLatestHealthScore', async () => {
      const { position, cachedScore: cached } = await seedRiskMonitorCachedHealthScore(
        { monitor, mockPositionService, mockEventBus, mockLogger },
        {},
        45000,
      );

      expect(cached).toBeDefined();
      expect(cached?.positionId).toBe('POS-123');
    });

    it('should clear health score cache', async () => {
      const { position, cachedScore: initialCachedScore } = await seedRiskMonitorCachedHealthScore(
        { monitor, mockPositionService, mockEventBus, mockLogger },
        {},
        45000,
      );
      let cached = initialCachedScore;
      expect(cached).toBeDefined();

      // Clear cache
      monitor.clearHealthScoreCache();
      cached = monitor.getLatestHealthScore(position.id);
      expect(cached).toBeUndefined();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cleared health score cache')
      );
    });

    it('should return undefined for non-cached position', async () => {
      const cached = monitor.getLatestHealthScore('NONEXISTENT');
      expect(cached).toBeUndefined();
    });
  });

  // ========================================================================
  // SHORT POSITION TESTS (SELL DIRECTION)
  // ========================================================================

  describe('Short Position (SELL) Handling', () => {
    it('should calculate health score for short position (profitable)', async () => {
      // For short: entry=45000, current=44000 means $1000 profit
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        side: PositionSide.SHORT,
        unrealizedPnL: 1000,
      });

      const score = await monitor.calculatePositionHealth(position.id, 44000);

      expect(score.status).toBe(DangerLevel.SAFE);
    });

    it('should calculate health score for short position (loss)', async () => {
      // For short: entry=45000, current=46000 means $1000 loss (2.2%)
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        side: PositionSide.SHORT,
        unrealizedPnL: -1000, // 2.2% loss
      });

      const score = await monitor.calculatePositionHealth(position.id, 46000);

      // Small loss doesn't trigger WARNING threshold
      // Overall score would be around 74 (safe) due to averaging 5 components
      expect(score.status).toBe(DangerLevel.SAFE);
    });
  });

  // ========================================================================
  // EDGE CASES & BOUNDARY TESTS
  // ========================================================================

  describe('Edge Cases & Boundaries', () => {
    it('should handle zero quantity position', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        quantity: 0,
      });

      const score = await monitor.calculatePositionHealth(position.id, 45000);
      expect(score).toBeDefined();
    });

    it('should handle extremely old position (> 4 hours)', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        openedAt: createRiskMonitorOpenedAtHoursAgo(24),
      });

      const score = await monitor.calculatePositionHealth(position.id, 45000);

      expect(score.components.timeAtRiskScore).toBe(0);
    });

    it('should handle massive profit (100%)', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: 45000, // 100% profit on 45k
      });

      const score = await monitor.calculatePositionHealth(position.id, 90000);

      // Score calculation: profitability 100, drawdown 100, volatility 75, liquidity 80, time_at_risk ~80
      // Average weighted: (100*0.2 + 100*0.3 + 80*0.2 + 75*0.15 + 100*0.15) = 20+30+16+11.25+15 = 92.25
      // But time factor brings it down
      expect(score.overallScore).toBeGreaterThan(85);
      expect(score.status).toBe(DangerLevel.SAFE);
    });

    it('should handle massive loss (50%)', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: -22500, // 50% loss on 45k
      });

      const score = await monitor.calculatePositionHealth(position.id, 22500);

      // Even with 50% loss, other components buffer the score
      // drawdown score at -50%: 100 - (50*2) = 0
      // But averaged with other 4 components still gives WARNING not CRITICAL
      expect(score.status).toBe(DangerLevel.WARNING);
    });

    it('should handle break-even position', async () => {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService }, {
        unrealizedPnL: 0,
      });

      const score = await monitor.calculatePositionHealth(position.id, 45000);

      expect(score.status).toBe(DangerLevel.SAFE);
    });
  });
});

