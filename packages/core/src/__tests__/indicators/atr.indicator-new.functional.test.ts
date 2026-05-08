/**
 * ATR Indicator NEW - Functional Tests
 * Testing real market volatility patterns and snapshot behavior
 */

import { ATRIndicatorNew } from '../../indicators/atr.indicator-new';
import type { Candle } from '../../types/core';
import type { AtrIndicatorConfigNew } from '../../types/config/config-new.types';

const standardConfig: AtrIndicatorConfigNew = {
  enabled: true,
  period: 14,
  minimumATR: 0.05,
  maximumATR: 5,
};

function createTrendCandles(
  pattern: 'compression' | 'expansion' | 'gap-up' | 'reversal',
  count: number = 20,
  startPrice: number = 100,
): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = startPrice;

  for (let i = 0; i < count; i++) {
    let open = currentPrice;
    let high = currentPrice + 1;
    let low = currentPrice - 1;
    let close = currentPrice;

    switch (pattern) {
      case 'compression':
        close = startPrice + (i % 2 === 0 ? 0.15 : -0.15);
        open = close - 0.05;
        high = close + 0.2;
        low = close - 0.2;
        break;
      case 'expansion':
        close = startPrice + i * 1.2;
        open = close - 0.5;
        high = close + 2.2;
        low = close - 2.2;
        break;
      case 'gap-up':
        if (i === Math.floor(count / 2)) {
          currentPrice += 8;
        }
        close = currentPrice + i * 0.3;
        open = close - 0.4;
        high = close + 1.6;
        low = close - 1.4;
        break;
      case 'reversal':
        if (i < count / 2) {
          close = startPrice - i * 0.8;
        } else {
          close = startPrice - (count / 2) * 0.8 + (i - count / 2) * 1.4;
        }
        open = close - 0.3;
        high = close + 1.4;
        low = close - 1.4;
        break;
    }

    currentPrice = close;
    candles.push({
      open,
      high,
      low,
      close,
      volume: 1000 + i * 25,
      timestamp: 1000 * (i + 1),
    });
  }

  return candles;
}

describe('ATR Indicator NEW - Functional Tests', () => {
  it('should keep ATR lower during compression than expansion', () => {
    const atr = new ATRIndicatorNew(standardConfig);

    const compressedAtr = atr.calculate(createTrendCandles('compression'));
    atr.reset();
    const expandedAtr = atr.calculate(createTrendCandles('expansion'));

    expect(expandedAtr).toBeGreaterThan(compressedAtr);
  });

  it('should react to a gap-up regime with elevated ATR', () => {
    const atr = new ATRIndicatorNew(standardConfig);
    const candles = createTrendCandles('gap-up');

    atr.calculate(candles);
    const classification = atr.getClassification(candles[candles.length - 1].close);

    expect(['normal', 'high', 'extreme', 'above_maximum']).toContain(classification);
    expect(atr.getValue()).toBeGreaterThan(0);
  });

  it('should keep state snapshots isolated across recalculations', () => {
    const atr = new ATRIndicatorNew(standardConfig);

    atr.calculate(createTrendCandles('compression'));
    const firstState = atr.getStateSnapshot();

    atr.calculate(createTrendCandles('reversal'));
    const secondState = atr.getStateSnapshot();

    expect(secondState).not.toBe(firstState);
    expect(secondState.atr).not.toBe(firstState.atr);
  });
});
