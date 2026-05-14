/**
 * Advanced Analytics Page
 *
 * Detailed performance analysis: equity curve, drawdown, monthly returns, correlations
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Activity,
  Calendar,
  Zap,
} from 'lucide-react';
import { dataApi } from '../services/api.service';
import type { EquityCurvePoint, WebApiJournalEntry } from '@edison/contracts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  openedAt: number;
  closedAt?: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  status: 'OPEN' | 'CLOSED';
  entryCondition?: string;
  exitCondition?: string;
}

interface EquityPoint {
  timestamp: number;
  equity: number;
  date: string;
}

interface DrawdownPeriod {
  startTime: number;
  endTime: number;
  startEquity: number;
  lowEquity: number;
  recoveryEquity: number;
  maxDrawdown: number;
  durationDays: number;
}

interface MonthlyReturn {
  month: string;
  pnl: number;
  trades: number;
  winRate: number;
  returnPercent: number;
}

interface ActiveDrawdownState {
  startTime: number;
  startEquity: number;
  lowEquity: number;
  maxDrawdown: number;
}

const PERCENT_SCALE = 100;
const MONTHLY_PNL_PROGRESS_FULL_WIDTH = 100;

const getRealizedPnlValue = (trade: Pick<Trade, 'realizedPnL'>): number => trade.realizedPnL ?? 0;
const getPnlDirection = (value: number): 'profit' | 'loss' | 'flat' =>
  value > 0 ? 'profit' : value < 0 ? 'loss' : 'flat';
const hasClosedAt = (trade: Pick<Trade, 'closedAt'>): trade is Pick<Trade, 'closedAt'> & { closedAt: number } =>
  trade.closedAt !== undefined;
const getClosedAtValue = (trade: Pick<Trade, 'closedAt'>): number => trade.closedAt ?? 0;
const getPercentageBarHeight = (value: number, maxValue: number) => {
  if (value <= 0 || maxValue <= 0) {
    return 0;
  }

  return (value / maxValue) * PERCENT_SCALE;
};
const getMonthlyPnlBarWidth = (pnl: number) => {
  if (pnl === 0) {
    return 0;
  }

  return Math.min((Math.abs(pnl) / MONTHLY_PNL_PROGRESS_FULL_WIDTH) * PERCENT_SCALE, PERCENT_SCALE);
};

// ============================================================================
// EQUITY CURVE COMPONENT
// ============================================================================

function EquityCurvePanel({ equityCurve, loading }: { equityCurve: EquityCurvePoint[]; loading: boolean }) {
  const equityPoints = useMemo(
    () =>
      equityCurve.map((point) => ({
        timestamp: point.timestamp,
        equity: point.equity,
        date: new Date(point.timestamp).toLocaleDateString(),
      })),
    [equityCurve],
  );

  const maxEquity = useMemo(() => {
    if (equityPoints.length === 0) return 0;
    return Math.max(...equityPoints.map((p) => p.equity), 0);
  }, [equityPoints]);

  const totalReturn = equityPoints.length > 0 ? equityPoints[equityPoints.length - 1].equity : 0;
  const totalReturnDirection = getPnlDirection(totalReturn);
  const color =
    totalReturnDirection === 'profit'
      ? 'text-green-600'
      : totalReturnDirection === 'loss'
        ? 'text-red-600'
        : 'text-gray-600';

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
        <p className="text-center text-gray-500">Loading equity data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Equity Curve</h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Return</p>
          <p className={`text-2xl font-bold ${color}`}>
            ${totalReturn.toFixed(2)}
          </p>
        </div>
      </div>

      {equityPoints.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No closed trades yet</p>
      ) : (
        <div>
          {/* Simple ASCII chart */}
          <div className="bg-gray-50 rounded p-4 mb-4 font-mono text-xs">
            <div className="h-32 relative">
              {equityPoints.map((point, idx) => (
                <div
                  key={idx}
                  className="absolute bottom-0 w-1 bg-blue-500 transition-all"
                  style={{
                    left: `${(idx / Math.max(equityPoints.length - 1, 1)) * 100}%`,
                    height: `${getPercentageBarHeight(point.equity, maxEquity)}%`,
                  }}
                  title={`${point.date}: $${point.equity.toFixed(2)}`}
                />
              ))}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Max Equity</p>
              <p className="font-semibold text-gray-900">${maxEquity.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">Final Equity</p>
              <p className={`font-semibold ${color}`}>${totalReturn.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">Data Points</p>
              <p className="font-semibold text-gray-900">{equityPoints.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DRAWDOWN ANALYSIS COMPONENT
// ============================================================================

function DrawdownPanel({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const drawdowns = useMemo(() => {
    if (trades.length === 0) return [];

    const sorted = [...trades]
      .filter((t) => t.status === 'CLOSED' && t.realizedPnL !== undefined && hasClosedAt(t))
      .sort((a, b) => getClosedAtValue(a) - getClosedAtValue(b));

    if (sorted.length === 0) return [];

    const periods: DrawdownPeriod[] = [];
    let runningEquity = 0;
    let peakEquity = 0;
    let activeDrawdown: ActiveDrawdownState | null = null;

    for (const trade of sorted) {
      const closedAt = getClosedAtValue(trade);
      runningEquity += getRealizedPnlValue(trade);

      if (runningEquity > peakEquity) {
        peakEquity = runningEquity;
      }

      const currentDrawdown = peakEquity - runningEquity;
      if (currentDrawdown > 0) {
        if (activeDrawdown === null) {
          activeDrawdown = {
            startTime: closedAt,
            startEquity: peakEquity,
            lowEquity: runningEquity,
            maxDrawdown: currentDrawdown,
          };
        } else {
          activeDrawdown.lowEquity = Math.min(activeDrawdown.lowEquity, runningEquity);
          activeDrawdown.maxDrawdown = Math.max(activeDrawdown.maxDrawdown, currentDrawdown);
        }
      }

      if (activeDrawdown !== null && runningEquity >= activeDrawdown.startEquity - (activeDrawdown.startEquity * 0.01)) {
        periods.push({
          startTime: activeDrawdown.startTime,
          endTime: closedAt,
          startEquity: activeDrawdown.startEquity,
          lowEquity: activeDrawdown.lowEquity,
          recoveryEquity: runningEquity,
          maxDrawdown: activeDrawdown.maxDrawdown,
          durationDays: (closedAt - activeDrawdown.startTime) / (1000 * 60 * 60 * 24),
        });
        activeDrawdown = null;
      }
    }

    return periods.sort((a, b) => b.maxDrawdown - a.maxDrawdown).slice(0, 10);
  }, [trades]);

  const maxDrawdown = useMemo(() => {
    if (drawdowns.length === 0) return 0;
    return Math.max(...drawdowns.map((d) => d.maxDrawdown));
  }, [drawdowns]);

  const avgRecoveryDays = useMemo(() => {
    if (drawdowns.length === 0) return 0;
    const total = drawdowns.reduce((sum, d) => sum + d.durationDays, 0);
    return (total / drawdowns.length).toFixed(1);
  }, [drawdowns]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
        <p className="text-center text-gray-500">Loading drawdown data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h2 className="text-lg font-semibold text-gray-900">Drawdown Analysis</h2>
      </div>

      {drawdowns.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No drawdown periods detected</p>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 bg-red-50 p-4 rounded">
            <div>
              <p className="text-sm text-gray-600">Max Drawdown</p>
              <p className="text-xl font-bold text-red-600">
                ${Math.max(...drawdowns.map((d) => d.maxDrawdown)).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Periods</p>
              <p className="text-xl font-bold text-gray-900">{drawdowns.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Recovery (days)</p>
              <p className="text-xl font-bold text-gray-900">{avgRecoveryDays}</p>
            </div>
          </div>

          {/* Detailed drawdowns */}
          <div className="space-y-2">
            {drawdowns.map((dd, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded border border-red-200">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold text-gray-900">
                    ${dd.maxDrawdown.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-600">
                    {dd.durationDays.toFixed(1)} days
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${(dd.maxDrawdown / maxDrawdown) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>From: ${dd.startEquity.toFixed(2)}</span>
                  <span>Low: ${dd.lowEquity.toFixed(2)}</span>
                  <span>Recovery: ${dd.recoveryEquity.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MONTHLY RETURNS COMPONENT
// ============================================================================

function MonthlyReturnsPanel({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const monthlyStats = useMemo(() => {
    if (trades.length === 0) return [];

    const monthMap = new Map<string, Trade[]>();

    for (const trade of trades) {
      if (trade.status === 'CLOSED' && hasClosedAt(trade)) {
        const date = new Date(getClosedAtValue(trade));
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, []);
        }
        monthMap.get(monthKey)!.push(trade);
      }
    }

    const stats: MonthlyReturn[] = [];
    for (const [month, monthTrades] of monthMap) {
      const pnl = monthTrades.reduce((sum, trade) => sum + getRealizedPnlValue(trade), 0);
      const wins = monthTrades.filter((trade) => getRealizedPnlValue(trade) > 0).length;

      stats.push({
        month,
        pnl,
        trades: monthTrades.length,
        winRate: monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0,
        returnPercent: 0, // Would need initial balance to calculate
      });
    }

    return stats.sort((a, b) => a.month.localeCompare(b.month));
  }, [trades]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
        <p className="text-center text-gray-500">Loading monthly data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-gray-900">Monthly Returns</h2>
      </div>

      {monthlyStats.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No monthly data available</p>
      ) : (
        <div className="space-y-2">
          {monthlyStats.map((month, idx) => {
            const pnlDirection = getPnlDirection(month.pnl);

            return (
            <div
              key={idx}
              className={`p-3 rounded border ${
                pnlDirection === 'profit'
                  ? 'bg-green-50 border-green-200'
                  : pnlDirection === 'loss'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">{month.month}</p>
                  <p className="text-xs text-gray-600">
                    {month.trades} trades | Win rate: {month.winRate.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-lg font-bold ${
                      pnlDirection === 'profit'
                        ? 'text-green-600'
                        : pnlDirection === 'loss'
                          ? 'text-red-600'
                          : 'text-gray-600'
                    }`}
                  >
                    ${month.pnl.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-600">{month.trades} trades</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${
                    pnlDirection === 'profit'
                      ? 'bg-green-500'
                      : pnlDirection === 'loss'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                  }`}
                  style={{
                    width: `${getMonthlyPnlBarWidth(month.pnl)}%`,
                  }}
                />
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WIN RATE HEATMAP COMPONENT
// ============================================================================

function WinRateHeatmapPanel({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const heatmapData = useMemo(() => {
    if (trades.length === 0) return {} as Record<number, number | null>;

    const hourMap = new Map<number, { wins: number; total: number }>();

    for (const trade of trades) {
      if (trade.status === 'CLOSED' && hasClosedAt(trade)) {
        const hour = new Date(getClosedAtValue(trade)).getHours();
        if (!hourMap.has(hour)) {
          hourMap.set(hour, { wins: 0, total: 0 });
        }

        const data = hourMap.get(hour)!;
        data.total++;
        if (getRealizedPnlValue(trade) > 0) {
          data.wins++;
        }
      }
    }

    const result: Record<number, number | null> = {};
    for (let i = 0; i < 24; i++) {
      const data = hourMap.get(i);
      result[i] = data ? (data.wins / data.total) * 100 : null;
    }
    return result;
  }, [trades]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
        <p className="text-center text-gray-500">Loading hourly data...</p>
      </div>
    );
  }

  const getHeatColor = (winRate: number | null) => {
    if (winRate === null) return 'bg-gray-200';
    if (winRate === 0) return 'bg-red-200';
    if (winRate < 30) return 'bg-red-200';
    if (winRate < 50) return 'bg-yellow-200';
    if (winRate < 70) return 'bg-lime-200';
    return 'bg-green-200';
  };

  const getHeatmapTitle = (hour: number, winRate: number | null) =>
    winRate === null ? `Hour ${hour}: No data` : `Hour ${hour}: ${winRate.toFixed(1)}% win rate`;

  const getHeatmapLabel = (winRate: number | null) => (winRate === null ? '--' : `${winRate.toFixed(0)}%`);

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-orange-600" />
        <h2 className="text-lg font-semibold text-gray-900">Win Rate by Hour (UTC)</h2>
      </div>

      <div className="grid grid-cols-12 gap-1">
        {Array.from({ length: 24 }).map((_, hour) => {
          const winRate = heatmapData[hour] ?? null;

          return (
            <div key={hour} className="text-center">
              <div
                className={`h-10 rounded ${getHeatColor(winRate)} flex items-center justify-center cursor-pointer`}
                title={getHeatmapTitle(hour, winRate)}
              >
                <span className="text-xs font-semibold text-gray-700">{getHeatmapLabel(winRate)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{hour}h</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-600">
        <p>Green = High win rate | Red = Low win rate | Gray = No data</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN ADVANCED ANALYTICS PAGE
// ============================================================================

export function AdvancedAnalytics() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const mapJournalEntryToTrade = (entry: WebApiJournalEntry): Trade => ({
    id: entry.id,
    symbol: 'UNKNOWN',
    side: entry.direction,
    entryPrice: entry.entryPrice,
    exitPrice: entry.exitPrice,
    quantity: entry.quantity,
    leverage: 1,
    openedAt: entry.timestamp,
    closedAt: entry.timestamp,
    realizedPnL: entry.pnl,
    status: 'CLOSED',
    entryCondition: entry.strategy,
    exitCondition: entry.exitReason,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [journalResponse, equityCurveResponse] = await Promise.all([
          dataApi.getJournalPage(1, 1000),
          dataApi.getEquityCurve(),
        ]);

        if (journalResponse.success && journalResponse.data?.entries) {
          setTrades(journalResponse.data.entries.map(mapJournalEntryToTrade));
        }

        if (equityCurveResponse.success && equityCurveResponse.data) {
          setEquityCurve(equityCurveResponse.data);
        }
      } catch (error) {
        console.error('Failed to fetch trade data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
        <p className="text-gray-600 mt-1">Detailed performance analysis and metrics</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EquityCurvePanel equityCurve={equityCurve} loading={loading} />
        <DrawdownPanel trades={trades} loading={loading} />
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyReturnsPanel trades={trades} loading={loading} />
        <WinRateHeatmapPanel trades={trades} loading={loading} />
      </div>

      {/* Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Equity Curve</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>Shows cumulative profit/loss over time</li>
            <li>Green upward = profitability increasing</li>
            <li>Red downward = losses accumulating</li>
            <li>Steepness indicates trade consistency</li>
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Drawdown</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>Largest drop from peak to trough</li>
            <li>Indicates risk and resilience</li>
            <li>Lower drawdown = better risk management</li>
            <li>Recovery time shows strategy recovery speed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
