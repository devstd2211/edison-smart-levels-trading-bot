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
});
