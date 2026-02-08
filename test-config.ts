import { Config } from './src/types';

const testConfig: Config = {
  version: 2,
  meta: { description: '', lastUpdated: '', activeAnalyzers: [] },
  exchange: { name: '', symbol: '', demo: true, testnet: false, apiKey: '', apiSecret: '' },
  trading: { leverage: 1, positionSizeUsdt: 1, maxPositions: 1, orderType: 'MARKET', tradingCycleIntervalMs: 1, favorableMovementThresholdPercent: 1 },
  riskManagement: {} as any,
  timeframes: {} as any,
  indicators: {} as any,
  analyzers: {} as any,
  filters: {} as any,
  confidence: {} as any,
  orchestration: {} as any,
  trendAnalysis: {} as any,
  analyzerParameters: {} as any,
  strategies: {} as any,
  services: {} as any,
  monitoring: {} as any,
  advancedOrderFlow: { enabled: true, tickWindowMs: 5000, orderbookLevels: 10, imbalanceThreshold: 0.65, spoofingThreshold: 3.0, minVolumeUSDT: 1000, maxConfidence: 100, enableSpoofingDetection: true, enableMomentum: true }
};

console.log(testConfig.advancedOrderFlow);
