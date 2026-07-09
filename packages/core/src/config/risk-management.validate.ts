import type { RiskManagementConfig } from '../types/legacy';
import { ICONS } from '../cli/cli-runtime';

const BOUNDS = {
  breakevenOffsetPercent: { min: 0.01, max: 10, description: 'Offset % for breakeven SL' },
  stopLossPercent: { min: 0.1, max: 50, description: 'Stop loss %' },
  trailingStopPercent: { min: 0.01, max: 10, description: 'Trailing stop %' },
  positionSizeUsdt: { min: 1, max: 10000, description: 'Position size in USDT' },
} as const;

export function validateRiskManagementConfig(rm: RiskManagementConfig): void {
  const requiredFields: (keyof RiskManagementConfig)[] = [
    'stopLossPercent',
    'minStopLossPercent',
    'breakevenOffsetPercent',
    'trailingStopEnabled',
    'trailingStopPercent',
    'trailingStopActivationLevel',
    'positionSizeUsdt',
    'takeProfits',
  ];

  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (rm[field] === undefined || rm[field] === null) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new Error(
      `${ICONS.error} CRITICAL: RiskManagementConfig missing required fields: ${missingFields.join(', ')}
` +
      'These fields are mandatory to prevent NaN crashes during position exiting.',
    );
  }

  const numericValidations = (
    Object.entries(BOUNDS) as [keyof typeof BOUNDS, (typeof BOUNDS)[keyof typeof BOUNDS]][]
  ).map(([field, { min, max, description }]) => ({
    field,
    value: rm[field] as number,
    min,
    max,
    description,
  }));

  for (const validation of numericValidations) {
    if (typeof validation.value !== 'number' || isNaN(validation.value)) {
      throw new Error(
        `${ICONS.error} CRITICAL: ${validation.field} must be a valid number, got ${validation.value}`,
      );
    }

    if (validation.value < validation.min || validation.value > validation.max) {
      throw new Error(
        `${ICONS.error} CRITICAL: ${validation.field} (${validation.description}) must be between ` +
        `${validation.min} and ${validation.max}, got ${validation.value}`,
      );
    }
  }

  if (!Array.isArray(rm.takeProfits) || rm.takeProfits.length === 0) {
    throw new Error(`${ICONS.error} CRITICAL: takeProfits must be a non-empty array`);
  }

  console.log(`${ICONS.success} RiskManagementConfig validated successfully:`, {
    breakevenOffsetPercent: rm.breakevenOffsetPercent,
    stopLossPercent: rm.stopLossPercent,
    trailingStopPercent: rm.trailingStopPercent,
    takeProfitLevels: rm.takeProfits.length,
  });
}
