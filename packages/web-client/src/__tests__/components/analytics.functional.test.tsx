import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  test('applies an epoch-zero start date filter instead of treating it as unset', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-before-epoch',
            timestamp: -24 * 60 * 60 * 1000,
            direction: 'SHORT',
            entryPrice: 99950,
            exitPrice: 99955,
            quantity: 0.1,
            pnl: -5,
            pnlPercent: -0.005,
            strategy: 'PreEpoch',
            exitReason: 'Stop loss',
          },
          {
            id: 'trade-epoch',
            timestamp: 0,
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100025,
            quantity: 0.1,
            pnl: 25,
            pnlPercent: 0.025,
            strategy: 'EpochStart',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-next-day',
            timestamp: 24 * 60 * 60 * 1000,
            direction: 'SHORT',
            entryPrice: 100050,
            exitPrice: 100040,
            quantity: 0.1,
            pnl: 10,
            pnlPercent: 0.01,
            strategy: 'EpochEnd',
            exitReason: 'Take profit',
          },
        ],
      },
    });

    const { container } = render(<Analytics />);

    expect(await screen.findByText('Trade History (3)')).toBeInTheDocument();

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '1970-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Trade History (2)')).toBeInTheDocument();
    expect(screen.queryByText('PreEpoch')).not.toBeInTheDocument();
  });

  test('applies an epoch-zero end date filter instead of treating it as unset', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-epoch',
            timestamp: 0,
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100025,
            quantity: 0.1,
            pnl: 25,
            pnlPercent: 0.025,
            strategy: 'EpochStart',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-next-day',
            timestamp: 24 * 60 * 60 * 1000,
            direction: 'SHORT',
            entryPrice: 100050,
            exitPrice: 100040,
            quantity: 0.1,
            pnl: 10,
            pnlPercent: 0.01,
            strategy: 'EpochEnd',
            exitReason: 'Take profit',
          },
        ],
      },
    });

    const { container } = render(<Analytics />);

    expect(await screen.findByText('Trade History (2)')).toBeInTheDocument();

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: '1970-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Trade History (1)')).toBeInTheDocument();
    expect(screen.queryByText('EpochEnd')).not.toBeInTheDocument();
  });

  test('treats the end date as an inclusive day boundary instead of midnight cutoff', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-same-day-open',
            timestamp: new Date(2026, 4, 13, 10, 0, 0, 0).getTime(),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100020,
            quantity: 0.1,
            pnl: 20,
            pnlPercent: 0.02,
            strategy: 'SameDay',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-same-day-close',
            timestamp: new Date(2026, 4, 13, 22, 0, 0, 0).getTime(),
            direction: 'SHORT',
            entryPrice: 100050,
            exitPrice: 100030,
            quantity: 0.1,
            pnl: 20,
            pnlPercent: 0.02,
            strategy: 'SameDay',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-next-day',
            timestamp: new Date(2026, 4, 14, 2, 0, 0, 0).getTime(),
            direction: 'LONG',
            entryPrice: 100020,
            exitPrice: 100010,
            quantity: 0.1,
            pnl: -10,
            pnlPercent: -0.01,
            strategy: 'NextDay',
            exitReason: 'Stop loss',
          },
        ],
      },
    });

    const { container } = render(<Analytics />);

    expect(await screen.findByText('Trade History (3)')).toBeInTheDocument();

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: '2026-05-13' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Trade History (2)')).toBeInTheDocument();
    expect(screen.getByText('SameDay')).toBeInTheDocument();
    expect(screen.queryByText('NextDay')).not.toBeInTheDocument();
  });

  test('parses date inputs as local calendar boundaries instead of UTC date strings', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            id: 'trade-before-local-day',
            timestamp: new Date(2026, 4, 12, 23, 30, 0, 0).getTime(),
            direction: 'SHORT',
            entryPrice: 99950,
            exitPrice: 99920,
            quantity: 0.1,
            pnl: 30,
            pnlPercent: 0.03,
            strategy: 'PreviousLocalDay',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-at-local-day-start',
            timestamp: new Date(2026, 4, 13, 0, 30, 0, 0).getTime(),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100010,
            quantity: 0.1,
            pnl: 10,
            pnlPercent: 0.01,
            strategy: 'SelectedLocalDay',
            exitReason: 'Take profit',
          },
        ],
      },
    });

    const { container } = render(<Analytics />);

    expect(await screen.findByText('Trade History (2)')).toBeInTheDocument();

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-05-13' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Trade History (1)')).toBeInTheDocument();
    expect(screen.getByText('SelectedLocalDay')).toBeInTheDocument();
    expect(screen.queryByText('PreviousLocalDay')).not.toBeInTheDocument();
  });

  test('resets trade history pagination when filters shrink the result set', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: Array.from({ length: 16 }, (_, index) => ({
          id: `trade-${index}`,
          timestamp: Date.parse('2026-05-13T00:00:00.000Z') + index * 60_000,
          direction: index < 8 ? 'LONG' : 'SHORT',
          entryPrice: 100000 + index,
          exitPrice: 100010 + index,
          quantity: 0.1,
          pnl: index,
          pnlPercent: index / 100,
          strategy: 'Pagination',
          exitReason: 'Exit',
        })),
      },
    });

    const { container } = render(<Analytics />);

    expect(await screen.findByText('Page 1 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 / 2')).toBeInTheDocument();

    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'LONG' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Trade History (8)')).toBeInTheDocument();
    const historyTable = screen.getByRole('table');
    expect(screen.queryByText('Page 2 / 2')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(within(historyTable).getAllByText('LONG')).toHaveLength(8);
    expect(within(historyTable).queryByText('SHORT')).not.toBeInTheDocument();
  });

  test('rehydrates filter panel controls when the parent filter is reset programmatically', async () => {
    dataApi.getJournalPage.mockResolvedValueOnce({
      success: true,
      data: {
        entries: Array.from({ length: 2 }, (_, index) => ({
          id: `trade-${index}`,
          timestamp: Date.parse('2026-05-13T00:00:00.000Z') + index * 60_000,
          direction: index === 0 ? 'LONG' : 'SHORT',
          entryPrice: 100000 + index,
          exitPrice: 100010 + index,
          quantity: 0.1,
          pnl: index + 1,
          pnlPercent: (index + 1) / 100,
          strategy: 'Rehydrate',
          exitReason: 'Exit',
        })),
      },
    });

    const { container } = render(<Analytics />);

    expect(await screen.findByText('Trade History (2)')).toBeInTheDocument();

    const dateInputs = container.querySelectorAll('input[type="date"]');
    const selects = container.querySelectorAll('select');

    fireEvent.change(dateInputs[0], { target: { value: '2026-05-13' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-05-13' } });
    fireEvent.change(selects[0], { target: { value: 'SHORT' } });
    fireEvent.change(selects[1], { target: { value: 'OPEN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect((dateInputs[0] as HTMLInputElement).value).toBe('');
    expect((dateInputs[1] as HTMLInputElement).value).toBe('');
    expect((selects[0] as HTMLSelectElement).value).toBe('ALL');
    expect((selects[1] as HTMLSelectElement).value).toBe('CLOSED');
  });

  test('applies the latest filter when journal data resolves after the user changes filters', async () => {
    let resolveJournalPage: ((value: unknown) => void) | undefined;

    dataApi.getJournalPage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveJournalPage = resolve;
        }),
    );

    const { container } = render(<Analytics />);
    const selects = container.querySelectorAll('select');

    fireEvent.change(selects[0], { target: { value: 'SHORT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    actResolveJournalPage(resolveJournalPage, {
      success: true,
      data: {
        entries: [
          {
            id: 'trade-long',
            timestamp: Date.parse('2026-05-13T08:00:00.000Z'),
            direction: 'LONG',
            entryPrice: 100000,
            exitPrice: 100020,
            quantity: 0.1,
            pnl: 20,
            pnlPercent: 0.02,
            strategy: 'LongOnly',
            exitReason: 'Take profit',
          },
          {
            id: 'trade-short',
            timestamp: Date.parse('2026-05-13T09:00:00.000Z'),
            direction: 'SHORT',
            entryPrice: 100100,
            exitPrice: 100060,
            quantity: 0.1,
            pnl: 40,
            pnlPercent: 0.04,
            strategy: 'ShortOnly',
            exitReason: 'Take profit',
          },
        ],
      },
    });

    expect(await screen.findByText('Trade History (1)')).toBeInTheDocument();
    expect(screen.getByText('ShortOnly')).toBeInTheDocument();
    expect(screen.queryByText('LongOnly')).not.toBeInTheDocument();
  });
});

function actResolveJournalPage(
  resolver: ((value: unknown) => void) | undefined,
  value: unknown,
) {
  resolver?.(value);
}
