import { TimeframeValidator } from '../../utils/timeframe-validator';

describe('TimeframeValidator functional behavior', () => {
  it('uses the last fully closed M30 candle when a lower timeframe closes at 10:00', () => {
    const currentTime = Date.parse('2025-01-13T10:00:00Z');
    const candles = [
      { timestamp: Date.parse('2025-01-13T09:00:00Z'), close: 98 },
      { timestamp: Date.parse('2025-01-13T09:30:00Z'), close: 99 },
      { timestamp: Date.parse('2025-01-13T10:00:00Z'), close: 100 },
    ];

    const closedCandles = TimeframeValidator.getClosedCandles(candles, currentTime, 30);

    expect(closedCandles).toEqual([
      { timestamp: Date.parse('2025-01-13T09:00:00Z'), close: 98 },
      { timestamp: Date.parse('2025-01-13T09:30:00Z'), close: 99 },
    ]);
    expect(
      TimeframeValidator.validateNoLookAhead(
        currentTime,
        Date.parse('2025-01-13T09:30:00Z'),
        30,
      ),
    ).toBe(true);
    expect(
      TimeframeValidator.validateNoLookAhead(
        currentTime,
        Date.parse('2025-01-13T10:00:00Z'),
        30,
      ),
    ).toBe(false);
  });
});
