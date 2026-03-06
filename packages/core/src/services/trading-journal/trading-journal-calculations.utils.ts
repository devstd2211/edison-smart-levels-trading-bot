import { EXCHANGE_FEES } from '../../constants';
import { TradeRecord } from '../../types/legacy';

export interface JournalStatistics {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  averagePnL: number;
  winRate: number;
  averageHoldingTimeMinutes: number;
}

export interface TradeFeeSummary {
  entryFee: number;
  exitFee: number;
  totalFees: number;
  netPnL: number;
}

export function calculateTradeFeeSummary(
  entryPrice: number,
  quantity: number,
  realizedPnL: number,
): TradeFeeSummary {
  const positionValue = quantity * entryPrice;
  const entryFee = positionValue * EXCHANGE_FEES.BYBIT_TAKER_FEE_PERCENT;
  const exitFee = positionValue * EXCHANGE_FEES.BYBIT_TAKER_FEE_PERCENT;
  const totalFees = entryFee + exitFee;

  return {
    entryFee,
    exitFee,
    totalFees,
    netPnL: realizedPnL - totalFees,
  };
}

export function aggregateJournalStatistics(trades: TradeRecord[]): JournalStatistics {
  const closedTrades = trades.filter((t) => t.status === 'CLOSED');
  const openTrades = trades.filter((t) => t.status === 'OPEN');
  const winningTrades = closedTrades.filter((t) => t.realizedPnL && t.realizedPnL > 0);
  const losingTrades = closedTrades.filter((t) => t.realizedPnL && t.realizedPnL <= 0);

  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
  const averageHoldingTimeMinutes =
    closedTrades.reduce((sum, t) => sum + (t.exitCondition?.holdingTimeMinutes || 0), 0) /
    (closedTrades.length > 0 ? closedTrades.length : 1);

  return {
    totalTrades: trades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    totalPnL,
    averagePnL: closedTrades.length > 0 ? totalPnL / closedTrades.length : 0,
    winRate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0,
    averageHoldingTimeMinutes,
  };
}
