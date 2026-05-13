import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { LogConsole } from '../../components/dashboard/LogConsole';

jest.mock('../../services/websocket.service', () => ({
  wsClient: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

const { wsClient } = jest.requireMock('../../services/websocket.service') as {
  wsClient: {
    on: jest.Mock;
    off: jest.Mock;
  };
};

describe('LogConsole functional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('preserves zero signal confidence in the rendered event log', () => {
    render(<LogConsole />);

    const signalHandler = wsClient.on.mock.calls.find(
      ([eventName]: [string]) => eventName === 'SIGNAL_GENERATED'
    )?.[1] as ((payload: {
      strategy?: string;
      direction?: string;
      confidence?: number;
    }) => void) | undefined;

    expect(signalHandler).toBeDefined();

    act(() => {
      signalHandler?.({
        strategy: 'Level Based',
        direction: 'LONG',
        confidence: 0,
      });
    });

    expect(
      screen.getByText('SIGNAL DETECTED [Level Based] LONG @ 0.0% confidence')
    ).toBeInTheDocument();
  });

  test('preserves zero entry price in the opened-position event log', () => {
    render(<LogConsole />);

    const positionOpenedHandler = wsClient.on.mock.calls.find(
      ([eventName]: [string]) => eventName === 'POSITION_OPENED'
    )?.[1] as ((payload: {
      position?: { side?: string; entryPrice?: number };
      signal?: { strategy?: string; reasoning?: string };
    }) => void) | undefined;

    expect(positionOpenedHandler).toBeDefined();

    act(() => {
      positionOpenedHandler?.({
        position: {
          side: 'LONG',
          entryPrice: 0,
        },
        signal: {
          strategy: 'ZeroOpen',
          reasoning: 'Break-even bootstrap',
        },
      });
    });

    expect(
      screen.getByText('POSITION OPENED [LONG] @ 0.0000 - ZeroOpen - Break-even bootstrap')
    ).toBeInTheDocument();
  });

  test('preserves zero realized pnl in the closed-position event log', () => {
    render(<LogConsole />);

    const positionClosedHandler = wsClient.on.mock.calls.find(
      ([eventName]: [string]) => eventName === 'POSITION_CLOSED'
    )?.[1] as ((payload: {
      pnl?: number;
      exitType?: string;
    }) => void) | undefined;

    expect(positionClosedHandler).toBeDefined();

    act(() => {
      positionClosedHandler?.({
        pnl: 0,
        exitType: 'BREAKEVEN',
      });
    });

    expect(
      screen.getByText('POSITION CLOSED [BREAKEVEN] +0.00 USDT (PROFIT)')
    ).toBeInTheDocument();
  });
});
