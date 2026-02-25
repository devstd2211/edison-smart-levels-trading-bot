/**
 * IRiskServices
 *
 * Grouped risk-related services.
 */

import type { RiskManager } from '../services/risk-manager.service';
import type { RealTimeRiskMonitor } from '../services/real-time-risk-monitor.service';
import type { RealityCheckService } from '../services/reality-check.service';

export interface IRiskServices {
  readonly riskManager: RiskManager;
  readonly realTimeRiskMonitor: RealTimeRiskMonitor;
  readonly realityCheck: RealityCheckService;
}
