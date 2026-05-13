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
});
