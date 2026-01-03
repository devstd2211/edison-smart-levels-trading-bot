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

// ============================================================================
// EQUITY CURVE COMPONENT
// ============================================================================

function EquityCurvePanel({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const equityPoints = useMemo(() => {
    if (trades.length === 0) return [];

    const sorted = [...trades].sort((a, b) => (a.openedAt || 0) - (b.openedAt || 0));
    const points: EquityPoint[] = [];
    let runningEquity = 0; // Starting from 0

    for (const trade of sorted) {
      if (trade.status === 'CLOSED' && trade.realizedPnL !== undefined && trade.closedAt) {
        runningEquity += trade.realizedPnL;
        points.push({
          timestamp: trade.closedAt,
          equity: runningEquity,
          date: new Date(trade.closedAt).toLocaleDateString(),
        });
      }
    }

    return points;
  }, [trades]);

  const maxEquity = useMemo(() => {
    if (equityPoints.length === 0) return 0;
    return Math.max(...equityPoints.map((p) => p.equity), 0);
  }, [equityPoints]);

  const totalReturn = equityPoints.length > 0 ? equityPoints[equityPoints.length - 1].equity : 0;
  const color = totalReturn >= 0 ? 'text-green-600' : 'text-red-600';

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
                    height: `${(point.equity / Math.max(maxEquity, 1)) * 100}%`,
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
      .filter((t) => t.status === 'CLOSED' && t.realizedPnL !== undefined && t.closedAt)
      .sort((a, b) => (a.closedAt || 0) - (b.closedAt || 0));

    if (sorted.length === 0) return [];

    const periods: DrawdownPeriod[] = [];
    let runningEquity = 0;
    let peakEquity = 0;
    let drawdownStart = { time: 0, equity: 0 };

    for (const trade of sorted) {
      runningEquity += trade.realizedPnL || 0;

      if (runningEquity > peakEquity) {
        peakEquity = runningEquity;
      }

      const currentDrawdown = peakEquity - runningEquity;
      if (currentDrawdown > 0) {
        if (drawdownStart.time === 0) {
          drawdownStart = { time: trade.closedAt!, equity: peakEquity };
        }

        // Check if drawdown is ending
        if (runningEquity >= peakEquity - (peakEquity * 0.01)) {
          // Within 1% of peak = recovery
          if (drawdownStart.time > 0) {
            periods.push({
              startTime: drawdownStart.time,
              endTime: trade.closedAt!,
              startEquity: drawdownStart.equity,
              lowEquity: runningEquity,
              recoveryEquity: runningEquity,
              maxDrawdown: currentDrawdown,
              durationDays: (trade.closedAt! - drawdownStart.time) / (1000 * 60 * 60 * 24),
            });
            drawdownStart = { time: 0, equity: 0 };
          }
        }
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
      if (trade.status === 'CLOSED' && trade.closedAt) {
        const date = new Date(trade.closedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, []);
        }
        monthMap.get(monthKey)!.push(trade);
      }
    }

    const stats: MonthlyReturn[] = [];
    for (const [month, monthTrades] of monthMap) {
      const pnl = monthTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
      const wins = monthTrades.filter((t) => (t.realizedPnL || 0) > 0).length;

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
          {monthlyStats.map((month, idx) => (
            <div
              key={idx}
              className={`p-3 rounded border ${
                month.pnl >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
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
                  <p className={`text-lg font-bold ${month.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${month.pnl.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-600">{month.trades} trades</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${month.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{
                    width: `${Math.min((Math.abs(month.pnl) / 100) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
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
    if (trades.length === 0) return {};

    const hourMap = new Map<number, { wins: number; total: number }>();

    for (const trade of trades) {
      if (trade.status === 'CLOSED' && trade.closedAt) {
        const hour = new Date(trade.closedAt).getHours();
        if (!hourMap.has(hour)) {
          hourMap.set(hour, { wins: 0, total: 0 });
        }

        const data = hourMap.get(hour)!;
        data.total++;
        if ((trade.realizedPnL || 0) > 0) {
          data.wins++;
        }
      }
    }

    const result: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      const data = hourMap.get(i);
      result[i] = data ? (data.wins / data.total) * 100 : 0;
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

  const getHeatColor = (winRate: number) => {
    if (winRate === 0) return 'bg-gray-200';
    if (winRate < 30) return 'bg-red-200';
    if (winRate < 50) return 'bg-yellow-200';
    if (winRate < 70) return 'bg-lime-200';
    return 'bg-green-200';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-orange-600" />
        <h2 className="text-lg font-semibold text-gray-900">Win Rate by Hour (UTC)</h2>
      </div>

      <div className="grid grid-cols-12 gap-1">
        {Array.from({ length: 24 }).map((_, hour) => (
          <div key={hour} className="text-center">
            <div
              className={`h-10 rounded ${getHeatColor(heatmapData[hour] || 0)} flex items-center justify-center cursor-pointer`}
              title={`Hour ${hour}: ${(heatmapData[hour] || 0).toFixed(1)}% win rate`}
            >
              <span className="text-xs font-semibold text-gray-700">
                {(heatmapData[hour] || 0).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">{hour}h</p>
          </div>
        ))}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await dataApi.getPositionHistory(1000) as any; // Get last 1000 trades
        if (response?.success && response?.data?.positions) {
          // Map API response to Trade interface
          const mappedTrades = (response.data?.positions as any[]).map((pos: any) => ({
            id: pos.id || `${pos.openedAt}-${Math.random()}`,
            symbol: pos.symbol || 'UNKNOWN',
            side: pos.side || 'LONG',
            entryPrice: pos.entryPrice || 0,
            exitPrice: pos.exitPrice,
            quantity: pos.quantity || 0,
            leverage: pos.leverage || 1,
            openedAt: pos.openedAt || 0,
            closedAt: pos.closedAt,
            realizedPnL: pos.realizedPnL,
            unrealizedPnL: pos.unrealizedPnL,
            status: pos.status || 'CLOSED',
            entryCondition: pos.entryCondition,
            exitCondition: pos.exitCondition,
          }));
          setTrades(mappedTrades);
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
        <EquityCurvePanel trades={trades} loading={loading} />
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
