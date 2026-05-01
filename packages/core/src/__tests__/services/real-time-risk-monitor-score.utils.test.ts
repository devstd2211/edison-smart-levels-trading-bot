import { PositionSide } from '../../types/legacy';
import {
  buildHealthAnalysis,
  buildHealthScoreComponents,
  calculateOverallHealthScore,
  createSafeDefaultHealthScore,
  determineDangerLevel,
} from '../../services/real-time-risk-monitor/real-time-risk-monitor-score.utils';
import { createRiskMonitorDetailedPosition } from '../helpers/real-time-risk-monitor-test.utils';

describe('real-time-risk-monitor-score.utils', () => {
  it('builds component scores and derived danger level', () => {
    const position = createRiskMonitorDetailedPosition({
      side: PositionSide.LONG,
      openedAt: Date.now() - 30 * 60 * 1000,
    });
    const components = buildHealthScoreComponents(position, 46000);
    const overall = calculateOverallHealthScore(components);

    expect(components.drawdownScore).toBe(100);
    expect(determineDangerLevel(overall)).toBe('SAFE');
  });

  it('builds analysis and safe fallback score', () => {
    const position = createRiskMonitorDetailedPosition();
    const analysis = buildHealthAnalysis(position, 43000);
    const fallback = createSafeDefaultHealthScore('pos-x');

    expect(analysis.currentDrawdown.maxThreshold).toBe(5);
    expect(fallback.positionId).toBe('pos-x');
    expect(fallback.overallScore).toBe(70);
  });
});
