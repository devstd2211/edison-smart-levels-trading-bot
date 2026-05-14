import React from 'react';
import { render, screen } from '@testing-library/react';
import { Analytics } from '../../pages/Analytics';

jest.mock('../../services/api.service', () => ({
  dataApi: {
    getJournalPage: jest.fn(),
  },
}));

const { dataApi } = jest.requireMock('../../services/api.service') as {
  dataApi: {
    getJournalPage: jest.Mock;
  };
};

describe('Analytics functional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataApi.getJournalPage.mockResolvedValue({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-open',
            timestamp: Date.parse('2026-05-13T10:30:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: undefined,
            quantity: 0.1,
            pnl: undefined,
            pnlPercent: 0,
            strategy: 'TrendFollow',
            exitReason: 'Still open',
          },
        ],
      },
    });
  });

  test('renders plain N/A fallbacks for missing exit price and realized PnL', async () => {
    render(<Analytics />);

    expect(await screen.findByText('Trading Analytics')).toBeInTheDocument();
    expect(screen.getByText('Trade History (1)')).toBeInTheDocument();
    expect(screen.getAllByText('N/A')).toHaveLength(2);
    expect(screen.getByText('0.00').className).toContain('text-gray-600');
    expect(screen.queryByText(/â€”|Ã¢â‚¬â€|Ã¢â€šÂ¬/)).not.toBeInTheDocument();
  });

  test('preserves zero-valued analytics aggregates without treating them as missing', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-win',
            timestamp: Date.parse('2026-05-13T08:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100050,
            quantity: 0.1,
            pnl: 50,
            pnlPercent: 0.05,
            strategy: 'MeanReversion',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-flat',
            timestamp: Date.parse('2026-05-13T09:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100050,
            exitPrice: 100050,
            quantity: 0.1,
            pnl: 0,
            pnlPercent: 0,
            strategy: 'MeanReversion',
            exitReason: 'Flat exit',
          },
          {
            id: 'trade-loss',
            timestamp: Date.parse('2026-05-13T10:00:00.000Z'),
            direction: 'SHORT',
            entryPrice: 100050,
            exitPrice: 100100,
            quantity: 0.1,
            pnl: -50,
            pnlPercent: -0.05,
            strategy: 'MeanReversion',
            exitReason: 'Stop loss',
          },
        ],
      },
    });

    render(<Analytics />);

    expect(await screen.findByText('Trading Analytics')).toBeInTheDocument();
    expect(screen.getByText('Trade History (3)')).toBeInTheDocument();
    const zeroPnlCells = screen.getAllByText('$0.00');

    expect(zeroPnlCells.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(screen.getByText('1.00')).toBeInTheDocument();
    expect(zeroPnlCells.some((node) => node.className.includes('text-gray-600'))).toBe(true);
  });
});
