/**
 * Analytics Page
 *
 * Detailed trading statistics, trade history, performance by strategy
 * Supports filtering by date range, strategy, and other parameters
 */

import React, { useEffect, useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Filter, ChevronUp, ChevronDown, Target } from 'lucide-react';
import { dataApi } from '../services/api.service';

export interface Trade {
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

export interface AnalyticsFilter {
  startDate?: number;
  endDate?: number;
  strategy?: string;
  side?: 'LONG' | 'SHORT' | 'ALL';
  status?: 'OPEN' | 'CLOSED' | 'ALL';
}

// Inline component: Filter Panel
function FilterPanel({ filter, onFilterChange }: { filter: AnalyticsFilter; onFilterChange: (f: AnalyticsFilter) => void }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [side, setSide] = useState(filter.side || 'ALL');
  const [status, setStatus] = useState(filter.status || 'CLOSED');

  const handleApply = () => {
    onFilterChange({
      startDate: startDate ? new Date(startDate).getTime() : undefined,
      endDate: endDate ? new Date(endDate).getTime() : undefined,
      side: side as any,
      status: status as any,
    });
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setSide('ALL');
    setStatus('CLOSED');
    onFilterChange({ side: 'ALL', status: 'CLOSED' });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Side</label>
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All</option>
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All</option>
            <option value="CLOSED">Closed</option>
            <option value="OPEN">Open</option>
          </select>
        </div>
        <div className="flex gap-2 items-end">
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Apply
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline component: Performance Stats
function PerformanceStatsPanel({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const stats = useMemo(() => {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        maxDrawdown: 0,
        grossProfit: 0,
        grossLoss: 0,
      };
    }

    const closed = trades.filter((t) => t.status === 'CLOSED' && t.realizedPnL !== undefined);
    const wins = closed.filter((t) => t.realizedPnL! > 0);
    const losses = closed.filter((t) => t.realizedPnL! < 0);

    const totalPnL = closed.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const grossProfit = wins.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnL || 0), 0));

    return {
      totalTrades: closed.length,
      winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
      totalPnL,
      avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
      avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
      maxDrawdown: 0,
      grossProfit,
      grossLoss,
    };
  }, [trades]);

  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
        <p className="text-sm text-gray-600 mb-1">Total PnL</p>
        <p className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          ${stats.totalPnL.toFixed(2)}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
        <p className="text-sm text-gray-600 mb-1">Win Rate</p>
        <p className="text-2xl font-bold text-blue-600">{stats.winRate.toFixed(1)}%</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
        <p className="text-sm text-gray-600 mb-1">Profit Factor</p>
        <p className={`text-2xl font-bold ${stats.profitFactor > 1.5 ? 'text-green-600' : 'text-red-600'}`}>
          {stats.profitFactor.toFixed(2)}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
        <p className="text-sm text-gray-600 mb-1">Trades</p>
        <p className="text-2xl font-bold text-gray-900">{stats.totalTrades}</p>
      </div>
    </div>
  );
}

// Inline component: Strategy Stats
function StrategyStatsPanel({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const strategyStats = useMemo(() => {
    if (trades.length === 0) return [];
    const map = new Map<string, Trade[]>();
    for (const trade of trades) {
      const strategy = trade.entryCondition || 'Unknown';
      if (!map.has(strategy)) map.set(strategy, []);
      map.get(strategy)!.push(trade);
    }
    return Array.from(map).map(([name, strats]) => {
      const closed = strats.filter((t) => t.status === 'CLOSED' && t.realizedPnL !== undefined);
      const wins = closed.filter((t) => t.realizedPnL! > 0).length;
      const totalPnL = closed.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
      return {
        name,
        count: closed.length,
        wins,
        losses: closed.length - wins,
        winRate: closed.length > 0 ? (wins / closed.length) * 100 : 0,
        totalPnL,
        avgPnL: closed.length > 0 ? totalPnL / closed.length : 0,
      };
    });
  }, [trades]);

  if (loading) return <div className="bg-white rounded-lg shadow p-6">Loading...</div>;
  if (strategyStats.length === 0) return <div className="bg-white rounded-lg shadow p-6">No data</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">By Strategy</h2>
      <div className="space-y-3">
        {strategyStats.map((stat, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{stat.name.substring(0, 30)}</p>
                <p className="text-xs text-gray-600">{stat.count} trades | {stat.wins} wins | {stat.winRate.toFixed(1)}% WR</p>
              </div>
              <p className={`font-bold text-lg ${stat.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stat.totalPnL.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Inline component: Trade History Table
function TradeHistoryPanel({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const [sortBy, setSortBy] = useState<'openedAt' | 'realizedPnL'>('openedAt');
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  const sorted = useMemo(() => {
    return [...trades].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return typeof aVal === 'number' && typeof bVal === 'number' ? bVal - aVal : 0;
    });
  }, [trades, sortBy]);

  const paginated = sorted.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  if (loading) return <div className="bg-white rounded-lg shadow p-6">Loading...</div>;
  if (trades.length === 0) return <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No trades</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Trade History ({trades.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-2 px-3 font-semibold cursor-pointer" onClick={() => setSortBy('openedAt')}>Entry {sortBy === 'openedAt' && <ChevronDown className="inline w-4 h-4" />}</th>
              <th className="text-center py-2 px-3 font-semibold">Side</th>
              <th className="text-right py-2 px-3 font-semibold">Entry</th>
              <th className="text-right py-2 px-3 font-semibold">Exit</th>
              <th className="text-right py-2 px-3 font-semibold cursor-pointer" onClick={() => setSortBy('realizedPnL')}>PnL {sortBy === 'realizedPnL' && <ChevronDown className="inline w-4 h-4" />}</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((t) => (
              <tr key={t.id} className={t.realizedPnL && t.realizedPnL > 0 ? 'bg-green-50 border-b border-gray-100' : 'bg-red-50 border-b border-gray-100'}>
                <td className="py-2 px-3 text-gray-600 text-xs">{new Date(t.openedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="text-center py-2 px-3"><span className={t.side === 'LONG' ? 'px-2 py-1 text-xs font-semibold bg-blue-200 text-blue-800 rounded' : 'px-2 py-1 text-xs font-semibold bg-red-200 text-red-800 rounded'}>{t.side}</span></td>
                <td className="text-right py-2 px-3 font-mono">${t.entryPrice.toFixed(4)}</td>
                <td className="text-right py-2 px-3 font-mono">{t.exitPrice ? `$${t.exitPrice.toFixed(4)}` : '—'}</td>
                <td className={`text-right py-2 px-3 font-bold ${!t.realizedPnL ? 'text-gray-600' : t.realizedPnL > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {t.realizedPnL === undefined ? '—' : `$${t.realizedPnL.toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Math.ceil(trades.length / itemsPerPage) > 1 && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-600">Page {page} / {Math.ceil(trades.length / itemsPerPage)}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <button onClick={() => setPage(p => Math.min(Math.ceil(trades.length / itemsPerPage), p + 1))} disabled={page === Math.ceil(trades.length / itemsPerPage)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Analytics() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AnalyticsFilter>({
    side: 'ALL',
    status: 'CLOSED',
  });

  // Load trades from API
  useEffect(() => {
    const loadTrades = async () => {
      try {
        setLoading(true);
        const response = await dataApi.getPositionHistory(500) as any;
        if (response?.success && response?.data?.positions) {
          const tradesData = (response.data?.positions as any[]).map((pos: any) => ({
            id: pos.id || `${pos.entryTime}-${pos.side}`,
            symbol: pos.symbol || 'UNKNOWN',
            side: pos.side,
            entryPrice: pos.entryPrice,
            exitPrice: pos.exitPrice,
            quantity: pos.quantity || 1,
            leverage: pos.leverage || 1,
            openedAt: pos.entryTime,
            closedAt: pos.exitTime,
            realizedPnL: pos.pnl,
            status: pos.exitTime ? 'CLOSED' : 'OPEN',
            entryCondition: pos.entryCondition,
            exitCondition: pos.exitCondition,
          }));
          setTrades(tradesData as any);
          applyFilters(tradesData as any, filter);
        }
      } catch (error) {
        console.error('Failed to load trades:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadTrades();
  }, []);

  // Apply filters to trades
  const applyFilters = (tradesToFilter: Trade[], appliedFilter: AnalyticsFilter) => {
    let result = tradesToFilter;

    // Filter by date range
    if (appliedFilter.startDate) {
      result = result.filter((t) => t.openedAt >= appliedFilter.startDate!);
    }
    if (appliedFilter.endDate) {
      result = result.filter((t) => t.openedAt <= appliedFilter.endDate!);
    }

    // Filter by side
    if (appliedFilter.side && appliedFilter.side !== 'ALL') {
      result = result.filter((t) => t.side === appliedFilter.side);
    }

    // Filter by status
    if (appliedFilter.status && appliedFilter.status !== 'ALL') {
      result = result.filter((t) => t.status === appliedFilter.status);
    }

    // Filter by strategy
    if (appliedFilter.strategy) {
      result = result.filter((t) => t.entryCondition?.includes(appliedFilter.strategy!));
    }

    setFilteredTrades(result);
  };

  const handleFilterChange = (newFilter: AnalyticsFilter) => {
    setFilter(newFilter);
    applyFilters(trades, newFilter);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trading Analytics</h1>
          <p className="text-gray-600 mt-1">Detailed performance analysis and trade history</p>
        </div>
        <BarChart3 className="w-8 h-8 text-blue-600" />
      </div>

      <FilterPanel filter={filter} onFilterChange={handleFilterChange} />
      <PerformanceStatsPanel trades={filteredTrades} loading={loading} />
      <StrategyStatsPanel trades={filteredTrades} loading={loading} />
      <TradeHistoryPanel trades={filteredTrades} loading={loading} />
    </div>
  );
}
