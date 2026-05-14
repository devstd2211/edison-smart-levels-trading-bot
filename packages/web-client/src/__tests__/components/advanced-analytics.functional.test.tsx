import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdvancedAnalytics } from '../../pages/AdvancedAnalytics';

jest.mock('../../services/api.service', () => ({
  dataApi: {
    getJournalPage: jest.fn(),
    getEquityCurve: jest.fn(),
  },
}));

const { dataApi } = jest.requireMock('../../services/api.service') as {
  dataApi: {
    getJournalPage: jest.Mock;
    getEquityCurve: jest.Mock;
  };
};

describe('AdvancedAnalytics functional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataApi.getJournalPage.mockResolvedValue({
      success: true,
      data: {
        entries: [],
      },
    });
    dataApi.getEquityCurve.mockResolvedValue({
      success: true,
      data: [],
    });
  });

  test('distinguishes zero-percent hourly win rate from missing heatmap data', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-loss-hour-5',
            timestamp: Date.parse('2026-05-13T05:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 99950,
            quantity: 0.1,
            pnl: -25,
            pnlPercent: -0.025,
            strategy: 'LondonOpen',
            exitReason: 'Stop loss',
          },
          {
            id: 'trade-flat-hour-7',
            timestamp: Date.parse('2026-05-13T07:00:00.000Z'),
            direction: 'SHORT',
            entryPrice: 99950,
            exitPrice: 99950,
            quantity: 0.1,
            pnl: 0,
            pnlPercent: 0,
            strategy: 'RangeFade',
            exitReason: 'Flat exit',
          },
        ],
      },
    });

    render(<AdvancedAnalytics />);

    expect(await screen.findByText('Advanced Analytics')).toBeInTheDocument();
    expect((await screen.findAllByText('0%')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  test('keeps drawdown analysis stable when a zero realized pnl trade appears inside the sequence', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-peak',
            timestamp: Date.parse('2026-05-10T09:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100100,
            quantity: 0.1,
            pnl: 100,
            pnlPercent: 0.1,
            strategy: 'TrendFollow',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-drawdown',
            timestamp: Date.parse('2026-05-11T09:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100100,
            exitPrice: 100000,
            quantity: 0.1,
            pnl: -100,
            pnlPercent: -0.1,
            strategy: 'TrendFollow',
            exitReason: 'Stop loss',
          },
          {
            id: 'trade-flat',
            timestamp: Date.parse('2026-05-12T09:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100000,
            quantity: 0.1,
            pnl: 0,
            pnlPercent: 0,
            strategy: 'TrendFollow',
            exitReason: 'Flat exit',
          },
          {
            id: 'trade-recovery',
            timestamp: Date.parse('2026-05-13T09:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100100,
            quantity: 0.1,
            pnl: 100,
            pnlPercent: 0.1,
            strategy: 'TrendFollow',
            exitReason: 'Recovery',
          },
        ],
      },
    });

    render(<AdvancedAnalytics />);

    expect(await screen.findByText('Drawdown Analysis')).toBeInTheDocument();
    expect(await screen.findByText('From: $100.00')).toBeInTheDocument();
    expect(screen.getByText('Low: $0.00')).toBeInTheDocument();
    expect(screen.getByText('Recovery: $100.00')).toBeInTheDocument();
  });

  test('keeps closed trades at timestamp zero in chronological analytics calculations', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-epoch-peak',
            timestamp: 0,
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100050,
            quantity: 0.1,
            pnl: 50,
            pnlPercent: 0.05,
            strategy: 'EpochPeak',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-epoch-drawdown',
            timestamp: 24 * 60 * 60 * 1000,
            direction: 'LONG',
            entryPrice: 100050,
            exitPrice: 100000,
            quantity: 0.1,
            pnl: -50,
            pnlPercent: -0.05,
            strategy: 'EpochPullback',
            exitReason: 'Stop loss',
          },
          {
            id: 'trade-epoch-recovery',
            timestamp: 2 * 24 * 60 * 60 * 1000,
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100050,
            quantity: 0.1,
            pnl: 50,
            pnlPercent: 0.05,
            strategy: 'EpochRecovery',
            exitReason: 'Recovery',
          },
        ],
      },
    });

    render(<AdvancedAnalytics />);

    expect(await screen.findByText('Drawdown Analysis')).toBeInTheDocument();
    expect(await screen.findByText('From: $50.00')).toBeInTheDocument();
    expect(screen.getByText('Low: $0.00')).toBeInTheDocument();
    expect(screen.getByText('Recovery: $50.00')).toBeInTheDocument();
    expect(screen.getByText('1970-01')).toBeInTheDocument();
  });

  test('renders a zero total return as a neutral equity-curve state', async () => {
    dataApi.getEquityCurve.mockResolvedValueOnce({
      success: true,
      data: [
        {
          timestamp: Date.parse('2026-05-12T00:00:00.000Z'),
          equity: 50,
          pnl: 50,
          tradeNumber: 1,
          drawdown: 0,
          time: '2026-05-12T00:00:00.000Z',
        },
        {
          timestamp: Date.parse('2026-05-13T00:00:00.000Z'),
          equity: 0,
          pnl: -50,
          tradeNumber: 2,
          drawdown: 100,
          time: '2026-05-13T00:00:00.000Z',
        },
      ],
    });

    render(<AdvancedAnalytics />);

    const totalReturnValue = (await screen.findAllByText('$0.00')).find((node) =>
      node.className.includes('text-2xl font-bold')
    );

    expect(totalReturnValue).toBeDefined();
    expect(totalReturnValue!.className).toContain('text-gray-600');
    expect(screen.queryByText('+$0.00')).not.toBeInTheDocument();

    const finalEquityBar = document.querySelector('[title$=": $0.00"]');
    expect(finalEquityBar).not.toBeNull();
    expect(finalEquityBar).toHaveStyle({ height: '0%' });
  });

  test('renders a flat monthly pnl with neutral panel, value, and progress colors', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-flat-may-a',
            timestamp: Date.parse('2026-05-10T09:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100050,
            quantity: 0.1,
            pnl: 50,
            pnlPercent: 0.05,
            strategy: 'FlatMonth',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-flat-may-b',
            timestamp: Date.parse('2026-05-11T09:00:00.000Z'),
            direction: 'SHORT',
            entryPrice: 100050,
            exitPrice: 100100,
            quantity: 0.1,
            pnl: -50,
            pnlPercent: -0.05,
            strategy: 'FlatMonth',
            exitReason: 'Stop loss',
          },
        ],
      },
    });

    const { container } = render(<AdvancedAnalytics />);

    expect(await screen.findByText('Monthly Returns')).toBeInTheDocument();

    const zeroMonthlyPnl = screen.getAllByText('$0.00').find((node) => node.className.includes('text-lg font-bold'));
    expect(zeroMonthlyPnl).toBeDefined();
    expect(zeroMonthlyPnl?.className).toContain('text-gray-600');

    const neutralMonthPanel = container.querySelector('.bg-gray-50.border-gray-200.rounded.border');
    expect(neutralMonthPanel).not.toBeNull();

    const neutralMonthBar = container.querySelector('.bg-gray-400.h-2.rounded-full');
    expect(neutralMonthBar).not.toBeNull();
    expect(neutralMonthBar).toHaveStyle({ width: '0%' });
  });

  test('keeps a recovered drawdown bar width finite after neutralized ratio extraction', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-drawdown-a',
            timestamp: Date.parse('2026-05-10T09:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100100,
            quantity: 0.1,
            pnl: 100,
            pnlPercent: 0.1,
            strategy: 'RecoveredDrawdown',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-drawdown-b',
            timestamp: Date.parse('2026-05-11T09:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100100,
            exitPrice: 100000,
            quantity: 0.1,
            pnl: -100,
            pnlPercent: -0.1,
            strategy: 'RecoveredDrawdown',
            exitReason: 'Stop loss',
          },
          {
            id: 'trade-drawdown-c',
            timestamp: Date.parse('2026-05-12T09:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100100,
            quantity: 0.1,
            pnl: 100,
            pnlPercent: 0.1,
            strategy: 'RecoveredDrawdown',
            exitReason: 'Recovery',
          },
        ],
      },
    });

    const { container } = render(<AdvancedAnalytics />);

    expect(await screen.findByText('Drawdown Analysis')).toBeInTheDocument();

    const drawdownBar = container.querySelector('.bg-red-500.h-2.rounded-full');
    expect(drawdownBar).not.toBeNull();
    expect(drawdownBar).not.toHaveStyle({ width: 'NaN%' });
    expect(drawdownBar).not.toHaveStyle({ width: 'Infinity%' });
  });
});
