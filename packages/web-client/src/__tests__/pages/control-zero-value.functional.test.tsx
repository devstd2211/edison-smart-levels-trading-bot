import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Control } from '../../pages/Control';

jest.mock('../../components/control/ConfigEditor', () => ({
  ConfigEditor: () => <div>ConfigEditor</div>,
}));

jest.mock('../../components/control/StrategyToggles', () => ({
  StrategyToggles: () => <div>StrategyToggles</div>,
}));

jest.mock('../../components/control/RiskSettings', () => ({
  RiskSettings: ({ onSave }: { onSave?: (risk: {
    maxLeverage: number;
    maxPositionSize: number;
    dailyLossLimit: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  }) => Promise<void> }) => (
    <button
      type="button"
      onClick={() => {
        void onSave?.({
          maxLeverage: 5,
          maxPositionSize: 0,
          dailyLossLimit: 100,
          stopLossPercent: 1.5,
          takeProfitPercent: 3,
        });
      }}
    >
      Save Zero Risk
    </button>
  ),
}));

describe('Control zero-value functional behavior', () => {
  test('keeps a zero maxPositionSize in the current settings summary', () => {
    render(<Control />);

    fireEvent.click(screen.getByRole('button', { name: 'Risk Management' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Zero Risk' }));

    expect(screen.getByText('Position Size:')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
});
