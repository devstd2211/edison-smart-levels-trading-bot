import { MarketConditions, SubOrder } from '../../types/legacy';

export function calculateSmartExpectedFill(orders: SubOrder[]): number {
  if (orders.length === 0) {
    return 0;
  }

  const avgProbability =
    orders.reduce((sum, order) => sum + order.fillProbability, 0) / orders.length;

  return Math.min(100, avgProbability);
}

export function calculateSmartExpectedSlippage(
  marketLevels: { price: number; volume: number }[],
  orders: SubOrder[],
): number {
  const marketPrice = marketLevels.length > 0 ? marketLevels[0].price : 0;
  if (marketPrice === 0 || orders.length === 0) {
    return 1000;
  }

  const totalSize = orders.reduce((sum, order) => sum + order.size, 0);
  let weightedSlippage = 0;

  for (const order of orders) {
    const slippageBps =
      (Math.abs(order.price - marketPrice) / marketPrice) * 10000;
    const weight = order.size / totalSize;
    weightedSlippage += slippageBps * weight;
  }

  return Number.isFinite(weightedSlippage) ? weightedSlippage : 1000;
}

export function assessSmartOrderRisk(
  slippage: number,
  fillProbability: number,
  conditions: MarketConditions,
  maxSlippageBps: number,
  minFillProbability: number,
  highRiskSlippageMultiplier: number,
  highRiskFillMultiplier: number,
): 'low' | 'medium' | 'high' {
  if (
    slippage > maxSlippageBps * highRiskSlippageMultiplier ||
    fillProbability < minFillProbability * highRiskFillMultiplier
  ) {
    return 'high';
  }

  if (
    slippage > maxSlippageBps ||
    fillProbability < minFillProbability ||
    conditions.volatility > 70
  ) {
    return 'medium';
  }

  return 'low';
}
