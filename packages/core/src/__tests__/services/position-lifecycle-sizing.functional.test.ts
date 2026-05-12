import { buildPositionSizingCompletedLogPayload } from '../../services/position-lifecycle/position-lifecycle-sizing.utils';

describe('position-lifecycle sizing functional behavior', () => {
  it('formats sizing chains with a readable delimiter for logs', () => {
    const payload = buildPositionSizingCompletedLogPayload(
      {
        quantity: 0.25,
        marginUsed: 125,
        notionalValue: 500,
        sizingChain: ['KELLY_CRITERION', 'CONF_75%', 'ATR_1.20x'],
      },
      2,
    );

    expect(payload.sizingChain).toBe('KELLY_CRITERION, CONF_75%, ATR_1.20x');
    expect(payload.sizingChain).not.toContain('->');
  });
});
