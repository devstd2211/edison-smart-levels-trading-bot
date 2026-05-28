/**
 * RiskServices
 *
 * Grouped container for risk-related dependencies.
 * This is a thin wrapper and does not own lifecycle.
 */

import type {
  IRiskServiceContainerDeps,
  IRiskServices,
} from '../../interfaces/IRiskServices';

export class RiskServices implements IRiskServices {
  readonly riskManager: IRiskServices['riskManager'];
  readonly realTimeRiskMonitor: IRiskServices['realTimeRiskMonitor'];
  readonly realityCheck: IRiskServices['realityCheck'];

  constructor(deps: IRiskServiceContainerDeps) {
    this.riskManager = deps.riskManager;
    this.realTimeRiskMonitor = deps.realTimeRiskMonitor;
    this.realityCheck = deps.realityCheck;
  }
}

export const createRiskServices = (
  deps: IRiskServiceContainerDeps,
): IRiskServices => new RiskServices(deps);
