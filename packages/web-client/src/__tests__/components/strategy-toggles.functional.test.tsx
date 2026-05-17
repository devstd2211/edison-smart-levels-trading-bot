import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrategyToggles } from '../../components/control/StrategyToggles';

jest.mock('../../services/api.service', () => ({
  configApi: {
    toggleStrategy: jest.fn(),
  },
}));

const { configApi } = jest.requireMock('../../services/api.service') as {
  configApi: {
    toggleStrategy: jest.Mock;
  };
};

describe('StrategyToggles functional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders plain active and inactive labels and keeps success copy ASCII-safe', async () => {
    configApi.toggleStrategy.mockResolvedValue({ success: true, data: {} });

    render(
      <StrategyToggles
        strategies={[
          { id: 'trendFollowing', name: 'Trend Following', enabled: false, description: 'Follow trend continuation' },
          { id: 'counterTrend', name: 'Counter Trend', enabled: true, description: 'Fade exhausted moves' },
        ]}
      />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByText(/✓|✗|âœ/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(configApi.toggleStrategy).toHaveBeenCalledWith('trendFollowing', true);
      expect(screen.getByText('Trend Following enabled successfully')).toBeInTheDocument();
    });
  });

  test('syncs rendered strategies from updated props instead of keeping local seed data', () => {
    const { rerender } = render(<StrategyToggles strategies={[]} />);

    expect(screen.queryByText('Level Based')).not.toBeInTheDocument();

    rerender(
      <StrategyToggles
        strategies={[
          { id: 'breakoutStrategy', name: 'Breakout Strategy', enabled: true },
        ]}
      />
    );

    expect(screen.getByText('Breakout Strategy')).toBeInTheDocument();
  });
});
