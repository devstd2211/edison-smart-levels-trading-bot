import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RiskSettings } from '../../components/control/RiskSettings';

function getInputForLabel(labelText: string): HTMLInputElement {
  return screen.getByText(labelText).closest('div')?.querySelector('input') as HTMLInputElement;
}

describe('RiskSettings functional coverage', () => {
  test('preserves zero-valued current risk fields instead of replacing them with defaults', () => {
    render(
      <RiskSettings
        currentRisk={{
          maxLeverage: 0,
          maxPositionSize: 0,
          dailyLossLimit: 0,
          stopLossPercent: 0,
          takeProfitPercent: 0,
        }}
      />
    );

    expect(getInputForLabel('Max Leverage')).toHaveValue(0);
    expect(getInputForLabel('Max Position Size')).toHaveValue(0);
    expect(getInputForLabel('Daily Loss Limit')).toHaveValue(0);
    expect(getInputForLabel('Stop Loss %')).toHaveValue(0);
    expect(getInputForLabel('Take Profit %')).toHaveValue(0);
    expect(screen.getByText('0.0% of account balance per trade')).toBeInTheDocument();
    expect(screen.getByText('1:N/A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Risk Settings' }));

    expect(screen.getByText('Max Leverage must be between 1 and 100')).toBeInTheDocument();
    expect(screen.getByText('Max Position Size must be between 0 and 1 (0-100%)')).toBeInTheDocument();
    expect(screen.getByText('Daily Loss Limit must be greater than 0')).toBeInTheDocument();
    expect(screen.getByText('Stop Loss % must be between 0 and 10')).toBeInTheDocument();
    expect(screen.getByText('Take Profit % must be greater than 0')).toBeInTheDocument();
  });

  test('keeps defaults only for missing fields', () => {
    render(<RiskSettings currentRisk={{ maxLeverage: 7 }} />);

    expect(getInputForLabel('Max Leverage')).toHaveValue(7);
    expect(getInputForLabel('Max Position Size')).toHaveValue(0.1);
    expect(getInputForLabel('Daily Loss Limit')).toHaveValue(100);
    expect(getInputForLabel('Stop Loss %')).toHaveValue(1.5);
    expect(getInputForLabel('Take Profit %')).toHaveValue(3);
  });
});
