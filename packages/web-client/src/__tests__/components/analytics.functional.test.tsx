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
    expect(screen.queryByText(/â€”|Ã¢â‚¬â€|Ã¢â€šÂ¬/)).not.toBeInTheDocument();
  });
});
