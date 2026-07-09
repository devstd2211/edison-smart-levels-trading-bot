import type { RiskManagementConfig } from '../../types/legacy';
import { validateRiskManagementConfig } from '../../config/risk-management.validate';

function validRm(overrides: Partial<RiskManagementConfig> = {}): RiskManagementConfig {
  return {
    stopLossPercent: 2,
    minStopLossPercent: 1,
    breakevenOffsetPercent: 0.3,
    trailingStopEnabled: true,
    trailingStopPercent: 0.5,
    trailingStopActivationLevel: 2,
    positionSizeUsdt: 100,
    takeProfits: [{ level: 1, percent: 1.5, sizePercent: 50 }],
    ...overrides,
  };
}

describe('validateRiskManagementConfig', () => {
  it('accepts a valid config without throwing', () => {
    expect(() => validateRiskManagementConfig(validRm())).not.toThrow();
  });

  it.each([
    'stopLossPercent',
    'minStopLossPercent',
    'breakevenOffsetPercent',
    'trailingStopEnabled',
    'trailingStopPercent',
    'trailingStopActivationLevel',
    'positionSizeUsdt',
    'takeProfits',
  ] as (keyof RiskManagementConfig)[])('throws when %s is missing', (field) => {
    const rm = { ...validRm(), [field]: undefined };
    expect(() => validateRiskManagementConfig(rm as RiskManagementConfig)).toThrow(
      'missing required fields',
    );
  });

  it('throws when breakevenOffsetPercent is below minimum bound', () => {
    expect(() => validateRiskManagementConfig(validRm({ breakevenOffsetPercent: 0 }))).toThrow(
      'breakevenOffsetPercent',
    );
  });

  it('throws when stopLossPercent is above maximum bound', () => {
    expect(() => validateRiskManagementConfig(validRm({ stopLossPercent: 99 }))).toThrow(
      'stopLossPercent',
    );
  });

  it('throws when positionSizeUsdt is NaN', () => {
    expect(() => validateRiskManagementConfig(validRm({ positionSizeUsdt: NaN }))).toThrow(
      'positionSizeUsdt',
    );
  });

  it('throws when takeProfits is an empty array', () => {
    expect(() => validateRiskManagementConfig(validRm({ takeProfits: [] }))).toThrow(
      'takeProfits must be a non-empty array',
    );
  });

  it('exports validateRiskManagementConfig as a named function', () => {
    expect(typeof validateRiskManagementConfig).toBe('function');
  });
});
