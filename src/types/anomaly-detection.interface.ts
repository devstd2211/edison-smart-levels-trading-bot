/**
 * Anomaly Detection Interface
 * Phase 10.2.3
 *
 * Provides detection of market anomalies:
 * - Volume anomalies (unusual trading volume)
 * - Volatility spikes (sudden price movements)
 * - Whale activity (large trades)
 * - Market manipulation patterns
 */

/**
 * Anomaly severity levels
 */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Anomaly types
 */
export type AnomalyType = 'volume' | 'volatility' | 'whale' | 'manipulation' | 'unknown';

/**
 * Trade direction
 */
export type TradeDirection = 'BUY' | 'SELL';

/**
 * Trade data for whale detection
 */
export interface Trade {
  /** Trade price */
  price: number;

  /** Trade size (quantity) */
  size: number;

  /** Trade direction */
  side: TradeDirection;

  /** Trade timestamp */
  timestamp: number;

  /** Trade ID (optional) */
  id?: string;
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  /** Whether anomaly was detected */
  detected: boolean;

  /** Anomaly type */
  type: AnomalyType;

  /** Severity level */
  severity: AnomalySeverity;

  /** Deviation from normal (e.g., 2.5x for 250% of average) */
  deviation: number;

  /** Confidence in detection (0-100) */
  confidence: number;

  /** Human-readable description */
  description: string;

  /** Timestamp of detection */
  timestamp: number;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Whale activity alert
 */
export interface WhaleAlert {
  /** Alert type */
  type: 'single_large_trade' | 'accumulation' | 'distribution' | 'spoofing';

  /** Severity level */
  severity: AnomalySeverity;

  /** Trade direction */
  direction: TradeDirection;

  /** Total volume involved (USDT) */
  volumeUSDT: number;

  /** Price level */
  price: number;

  /** Timestamp */
  timestamp: number;

  /** Number of trades (for accumulation/distribution) */
  tradeCount: number;

  /** Confidence (0-100) */
  confidence: number;

  /** Description */
  description: string;
}

/**
 * Volatility spike detection result
 */
export interface VolatilitySpike {
  /** Whether spike was detected */
  detected: boolean;

  /** Current volatility value (e.g., ATR) */
  currentVolatility: number;

  /** Average volatility */
  averageVolatility: number;

  /** Spike magnitude (e.g., 2.5x for 250% of average) */
  magnitude: number;

  /** Severity level */
  severity: AnomalySeverity;

  /** Timestamp */
  timestamp: number;
}

/**
 * Market manipulation flags
 */
export interface ManipulationFlags {
  /** Possible wash trading detected */
  washTrading: boolean;

  /** Possible spoofing detected */
  spoofing: boolean;

  /** Possible pump and dump detected */
  pumpAndDump: boolean;

  /** Overall manipulation likelihood (0-100) */
  likelihood: number;

  /** Severity if manipulation suspected */
  severity: AnomalySeverity;

  /** Evidence description */
  evidence: string[];

  /** Timestamp */
  timestamp: number;
}

/**
 * Volume statistics
 */
export interface VolumeStats {
  /** Current volume */
  current: number;

  /** Average volume */
  average: number;

  /** Standard deviation */
  stdDev: number;

  /** Minimum volume observed */
  min: number;

  /** Maximum volume observed */
  max: number;

  /** Sample count */
  sampleCount: number;
}

/**
 * Volatility statistics
 */
export interface VolatilityStats {
  /** Current volatility (ATR or similar) */
  current: number;

  /** Average volatility */
  average: number;

  /** Standard deviation */
  stdDev: number;

  /** Minimum volatility observed */
  min: number;

  /** Maximum volatility observed */
  max: number;

  /** Sample count */
  sampleCount: number;
}

/**
 * Configuration for AnomalyDetectionService
 */
export interface AnomalyDetectionConfig {
  /** Volume anomaly threshold (std devs from mean, default: 2.5) */
  volumeAnomalyThreshold: number;

  /** Volatility spike threshold (std devs from mean, default: 2.0) */
  volatilitySpikeThreshold: number;

  /** Whale trade size threshold (% of average volume, default: 5.0 = 500%) */
  whaleTradeThreshold: number;

  /** Minimum volume samples for analysis (default: 20) */
  minVolumeSamples: number;

  /** Minimum volatility samples for analysis (default: 20) */
  minVolatilitySamples: number;

  /** Volume window size (number of periods, default: 50) */
  volumeWindowSize: number;

  /** Volatility window size (number of periods, default: 50) */
  volatilityWindowSize: number;

  /** Manipulation detection window (ms, default: 5 minutes) */
  manipulationWindowMs: number;

  /** Wash trading price tolerance (%, default: 0.1 = 0.1%) */
  washTradingPriceTolerance: number;

  /** Spoofing order size threshold (default: 10x average) */
  spoofingOrderThreshold: number;

  /** Pump and dump price change threshold (%, default: 10%) */
  pumpDumpThreshold: number;

  /** Enable whale detection (default: true) */
  enableWhaleDetection: boolean;

  /** Enable manipulation detection (default: true) */
  enableManipulationDetection: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_ANOMALY_DETECTION_CONFIG: AnomalyDetectionConfig = {
  volumeAnomalyThreshold: 2.5,
  volatilitySpikeThreshold: 2.0,
  whaleTradeThreshold: 5.0, // 500% of average
  minVolumeSamples: 20,
  minVolatilitySamples: 20,
  volumeWindowSize: 50,
  volatilityWindowSize: 50,
  manipulationWindowMs: 5 * 60 * 1000, // 5 minutes
  washTradingPriceTolerance: 0.001, // 0.1%
  spoofingOrderThreshold: 10.0,
  pumpDumpThreshold: 0.1, // 10%
  enableWhaleDetection: true,
  enableManipulationDetection: true,
};

/**
 * Anomaly detection statistics
 */
export interface AnomalyStats {
  /** Total anomalies detected */
  totalDetected: number;

  /** Anomalies by type */
  byType: Record<AnomalyType, number>;

  /** Anomalies by severity */
  bySeverity: Record<AnomalySeverity, number>;

  /** Average confidence */
  avgConfidence: number;

  /** Last detection timestamp */
  lastDetection: number;
}
