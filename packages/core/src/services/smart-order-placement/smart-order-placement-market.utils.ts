import { MarketConditions, OrderPriority, Orderbook, SmartOrderPlacementStrategicConfig } from '../../types/legacy';
import { estimateVolatility } from './smart-order-placement-math.utils';

export function analyzeSmartMarketConditions(
  orderbook: Orderbook,
  direction: 'buy' | 'sell',
): MarketConditions {
  const bestBid =
    orderbook.bids.length > 0 ? orderbook.bids[0].price : 0;
  const bestAsk =
    orderbook.asks.length > 0 ? orderbook.asks[0].price : 0;
  const midPrice = (bestBid + bestAsk) / 2;

  const spreadBps =
    midPrice > 0 ? ((bestAsk - bestBid) / midPrice) * 10000 : 10000;

  const totalBidVolume = orderbook.bids.reduce(
    (sum, bid) => sum + (Number.isFinite(bid.volume) ? bid.volume : 0),
    0,
  );
  const totalAskVolume = orderbook.asks.reduce(
    (sum, ask) => sum + (Number.isFinite(ask.volume) ? ask.volume : 0),
    0,
  );

  const totalVolume = totalBidVolume + totalAskVolume;
  const imbalanceRatio =
    totalVolume > 0 ? (totalBidVolume - totalAskVolume) / totalVolume : 0;

  const liquidityScore = Math.min(
    100,
    Math.log10(totalVolume + 1) * 20,
  );

  const volatility = estimateVolatility(orderbook);
  const isFavorable =
    direction === 'buy' ? imbalanceRatio > 0.1 : imbalanceRatio < -0.1;

  return {
    spreadBps: Number.isFinite(spreadBps) ? spreadBps : 10000,
    volatility: Number.isFinite(volatility) ? volatility : 50,
    liquidityScore: Number.isFinite(liquidityScore) ? liquidityScore : 0,
    imbalanceRatio: Number.isFinite(imbalanceRatio) ? imbalanceRatio : 0,
    isFavorable,
  };
}

export function determineSmartOrderPriority(
  conditions: MarketConditions,
  fillProbability: number,
  enableAdaptive: boolean,
  strategicConfig: SmartOrderPlacementStrategicConfig,
): OrderPriority {
  if (!enableAdaptive) {
    return 'immediate';
  }

  if (
    fillProbability > strategicConfig.patientThreshold &&
    conditions.isFavorable
  ) {
    return 'patient';
  }

  if (
    fillProbability < strategicConfig.immediateThreshold ||
    !conditions.isFavorable
  ) {
    return 'immediate';
  }

  return 'adaptive';
}
