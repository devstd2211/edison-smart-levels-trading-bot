import React from 'react';
import { render, screen } from '@testing-library/react';
import { EquityCurve } from '../../components/charts/EquityCurve';
import { useTradeStore } from '../../stores/tradeStore';

jest.mock('recharts', () => {
  const React = require('react');

  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer: passthrough,
    AreaChart: () => null,
    Area: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    LineChart: passthrough,
    Line: () => null,
  };
});

describe('EquityCurve functional coverage', () => {
  beforeEach(() => {
    useTradeStore.getState().reset();
    jest.restoreAllMocks();
  });

  test('uses a deterministic sample curve when no runtime equity data is available', () => {
    const randomSpy = jest.spyOn(Math, 'random');

    render(<EquityCurve />);

    expect(screen.getByText('$1,018')).toBeInTheDocument();
    expect(screen.getAllByText('$1,191')).toHaveLength(2);
    expect(screen.getByText('+16.99%')).toBeInTheDocument();
    expect(screen.getByText('-0.84%')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(randomSpy).not.toHaveBeenCalled();
  });

  test('renders a neutral zero total return without a leading plus sign', () => {
    render(
      <EquityCurve
        data={[
          {
            time: '2026-05-14T00:00:00.000Z',
            timestamp: Date.parse('2026-05-14T00:00:00.000Z'),
            equity: 1000,
            pnl: 0,
            tradeNumber: 1,
            drawdown: 0,
          },
          {
            time: '2026-05-14T01:00:00.000Z',
            timestamp: Date.parse('2026-05-14T01:00:00.000Z'),
            equity: 1000,
            pnl: 0,
            tradeNumber: 2,
            drawdown: 0,
          },
        ]}
      />
    );

    const returnValue = screen.getByText('0.00%');

    expect(returnValue.className).toContain('text-gray-600');
    expect(screen.queryByText('+0.00%')).not.toBeInTheDocument();
  });
});
