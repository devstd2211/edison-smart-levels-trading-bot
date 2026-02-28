import type { Config } from '../types/legacy';

/**
 * Validate RiskManagementConfig has all required fields with valid values
 * Prevents NaN errors at runtime from missing config fields
 *
 * Session 29.4c: Prevents breakevenOffsetPercent undefined → NaN crash
 */
export function validateRiskManagementConfig(config: Config): void {
  const rm = config.riskManagement;

  // Check for required fields
  const requiredFields: (keyof typeof rm)[] = [
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
      `❌ CRITICAL: RiskManagementConfig missing required fields: ${missingFields.join(', ')}\n` +
      'These fields are mandatory to prevent NaN crashes during position exiting.',
    );
  }

  // Validate numeric ranges
  const numericValidations = [
    {
      field: 'breakevenOffsetPercent',
      value: rm.breakevenOffsetPercent,
      min: 0.01,
      max: 10,
      description: 'Offset % for breakeven SL',
    },
    {
      field: 'stopLossPercent',
      value: rm.stopLossPercent,
      min: 0.1,
      max: 50,
      description: 'Stop loss %',
    },
    {
      field: 'trailingStopPercent',
      value: rm.trailingStopPercent,
      min: 0.01,
      max: 10,
      description: 'Trailing stop %',
    },
    {
      field: 'positionSizeUsdt',
      value: rm.positionSizeUsdt,
      min: 1,
      max: 10000,
      description: 'Position size in USDT',
    },
  ];

  for (const validation of numericValidations) {
    if (typeof validation.value !== 'number' || isNaN(validation.value)) {
      throw new Error(
        `❌ CRITICAL: ${validation.field} must be a valid number, got ${validation.value}`,
      );
    }

    if (validation.value < validation.min || validation.value > validation.max) {
      throw new Error(
        `❌ CRITICAL: ${validation.field} (${validation.description}) must be between ` +
        `${validation.min} and ${validation.max}, got ${validation.value}`,
      );
    }
  }

  // Validate takeProfits array
  if (!Array.isArray(rm.takeProfits) || rm.takeProfits.length === 0) {
    throw new Error('❌ CRITICAL: takeProfits must be a non-empty array');
  }

  console.log('✅ RiskManagementConfig validated successfully:', {
    breakevenOffsetPercent: rm.breakevenOffsetPercent,
    stopLossPercent: rm.stopLossPercent,
    trailingStopPercent: rm.trailingStopPercent,
    takeProfitLevels: rm.takeProfits.length,
  });
}
