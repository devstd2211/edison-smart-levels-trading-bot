/**
 * Analytics Page
 *
 * Detailed trading statistics, trade history, performance by strategy
 * Supports filtering by date range, strategy, and other parameters
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Filter, ChevronDown } from 'lucide-react';
import type { WebApiJournalEntry } from '@edison/contracts';
import { dataApi } from '../services/api.service';

const FALLBACK_LABEL = 'N/A';

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

type SideFilterValue = 'LONG' | 'SHORT' | 'ALL';
type StatusFilterValue = 'OPEN' | 'CLOSED' | 'ALL';

export interface AnalyticsFilter {
  startDate?: number;
  endDate?: number;
  strategy?: string;
  side?: SideFilterValue;
  status?: StatusFilterValue;
}

const getRealizedPnlValue = (trade: Pick<Trade, 'realizedPnL'>): number => trade.realizedPnL ?? 0;
const hasNumericFilterValue = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const parseDateInputValue = (
  value: string,
  boundary: 'start' | 'end',
): number | undefined => {
  if (!value) {
    return undefined;
  }

  const [yearString, monthString, dayString] = value.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return undefined;
  }

  return boundary === 'start'
    ? new Date(year, month - 1, day, 0, 0, 0, 0).getTime()
    : new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
};
const getPnlDirection = (value: number): 'profit' | 'loss' | 'flat' =>
  value > 0 ? 'profit' : value < 0 ? 'loss' : 'flat';
const getProfitFactorTone = (value: number): 'profit' | 'loss' | 'flat' =>
  value > 1.5 ? 'profit' : value > 0 ? 'loss' : 'flat';

const isSideFilter = (value: string): value is SideFilterValue =>
  value === 'LONG' || value === 'SHORT' || value === 'ALL';

const isStatusFilter = (value: string): value is StatusFilterValue =>
  value === 'OPEN' || value === 'CLOSED' || value === 'ALL';

function FilterPanel({
  filter,
  onFilterChange,
}: {
  filter: AnalyticsFilter;
  onFilterChange: (f: AnalyticsFilter) => void;
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [side, setSide] = useState(filter.side || 'ALL');
  const [status, setStatus] = useState(filter.status || 'CLOSED');

  const handleApply = () => {
    onFilterChange({
      startDate: parseDateInputValue(startDate, 'start'),
      endDate: parseDateInputValue(endDate, 'end'),
      side,
      status,
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
            onChange={(e) => {
              const next = e.target.value;
              if (isSideFilter(next)) {
                setSide(next);
              }
            }}
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
            onChange={(e) => {
              const next = e.target.value;
              if (isStatusFilter(next)) {
                setStatus(next);
              }
            }}
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

    const totalPnL = closed.reduce((sum, trade) => sum + getRealizedPnlValue(trade), 0);
    const grossProfit = wins.reduce((sum, trade) => sum + getRealizedPnlValue(trade), 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + getRealizedPnlValue(trade), 0));

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

  const totalPnlDirection = getPnlDirection(stats.totalPnL);
  const profitFactorTone = getProfitFactorTone(stats.profitFactor);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
        <p className="text-sm text-gray-600 mb-1">Total PnL</p>
        <p
          className={`text-2xl font-bold ${
            totalPnlDirection === 'profit'
              ? 'text-green-600'
              : totalPnlDirection === 'loss'
                ? 'text-red-600'
                : 'text-gray-600'
          }`}
        >
          ${stats.totalPnL.toFixed(2)}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
        <p className="text-sm text-gray-600 mb-1">Win Rate</p>
        <p className="text-2xl font-bold text-blue-600">{stats.winRate.toFixed(1)}%</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
        <p className="text-sm text-gray-600 mb-1">Profit Factor</p>
        <p
          className={`text-2xl font-bold ${
            profitFactorTone === 'profit'
              ? 'text-green-600'
              : profitFactorTone === 'loss'
                ? 'text-red-600'
                : 'text-gray-600'
          }`}
        >
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

function StrategyStatsPanel({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const strategyStats = useMemo(() => {
    if (trades.length === 0) {
      return [];
    }

    const map = new Map<string, Trade[]>();
    for (const trade of trades) {
      const strategy = trade.entryCondition || 'Unknown';
      if (!map.has(strategy)) {
        map.set(strategy, []);
      }
      map.get(strategy)!.push(trade);
    }

    return Array.from(map).map(([name, strats]) => {
      const closed = strats.filter((t) => t.status === 'CLOSED' && t.realizedPnL !== undefined);
      const wins = closed.filter((t) => t.realizedPnL! > 0).length;
      const totalPnL = closed.reduce((sum, trade) => sum + getRealizedPnlValue(trade), 0);

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

  if (loading) {
    return <div className="bg-white rounded-lg shadow p-6">Loading...</div>;
  }
  if (strategyStats.length === 0) {
    return <div className="bg-white rounded-lg shadow p-6">No data</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">By Strategy</h2>
      <div className="space-y-3">
        {strategyStats.map((stat, idx) => {
          const totalPnlDirection = getPnlDirection(stat.totalPnL);

          return (
          <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{stat.name.substring(0, 30)}</p>
                <p className="text-xs text-gray-600">
                  {stat.count} trades | {stat.wins} wins | {stat.winRate.toFixed(1)}% WR
                </p>
              </div>
              <p
                className={`font-bold text-lg ${
                  totalPnlDirection === 'profit'
                    ? 'text-green-600'
                    : totalPnlDirection === 'loss'
                      ? 'text-red-600'
                      : 'text-gray-600'
                }`}
              >
                ${stat.totalPnL.toFixed(2)}
              </p>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeHistoryPanel({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const [sortBy, setSortBy] = useState<'openedAt' | 'realizedPnL'>('openedAt');
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;
  const totalPages = Math.max(1, Math.ceil(trades.length / itemsPerPage));

  const formatExitPrice = (value: number | undefined) => {
    if (value === undefined) {
      return FALLBACK_LABEL;
    }

    return `$${value.toFixed(4)}`;
  };

  const formatRealizedPnl = (value: number | undefined) => {
    if (value === undefined) {
      return FALLBACK_LABEL;
    }

    return `$${value.toFixed(2)}`;
  };

  const sorted = useMemo(() => {
    return [...trades].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return typeof aVal === 'number' && typeof bVal === 'number' ? bVal - aVal : 0;
    });
  }, [trades, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [trades]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  const paginated = sorted.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  if (loading) {
    return <div className="bg-white rounded-lg shadow p-6">Loading...</div>;
  }
  if (trades.length === 0) {
    return <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No trades</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Trade History ({trades.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="text-left py-2 px-3 font-semibold cursor-pointer"
                onClick={() => setSortBy('openedAt')}
              >
                Entry {sortBy === 'openedAt' && <ChevronDown className="inline w-4 h-4" />}
              </th>
              <th className="text-center py-2 px-3 font-semibold">Side</th>
              <th className="text-right py-2 px-3 font-semibold">Entry</th>
              <th className="text-right py-2 px-3 font-semibold">Exit</th>
              <th
                className="text-right py-2 px-3 font-semibold cursor-pointer"
                onClick={() => setSortBy('realizedPnL')}
              >
                PnL {sortBy === 'realizedPnL' && <ChevronDown className="inline w-4 h-4" />}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((t) => {
              const pnlDirection =
                t.realizedPnL === undefined ? undefined : getPnlDirection(t.realizedPnL);

              return (
              <tr
                key={t.id}
                className={
                  pnlDirection === 'profit'
                    ? 'bg-green-50 border-b border-gray-100'
                    : pnlDirection === 'loss'
                      ? 'bg-red-50 border-b border-gray-100'
                      : 'bg-gray-50 border-b border-gray-100'
                }
              >
                <td className="py-2 px-3 text-gray-600 text-xs">
                  {new Date(t.openedAt).toLocaleString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="text-center py-2 px-3">
                  <span
                    className={
                      t.side === 'LONG'
                        ? 'px-2 py-1 text-xs font-semibold bg-blue-200 text-blue-800 rounded'
                        : 'px-2 py-1 text-xs font-semibold bg-red-200 text-red-800 rounded'
                    }
                  >
                    {t.side}
                  </span>
                </td>
                <td className="text-right py-2 px-3 font-mono">${t.entryPrice.toFixed(4)}</td>
                <td className="text-right py-2 px-3 font-mono">{formatExitPrice(t.exitPrice)}</td>
                <td
                  className={`text-right py-2 px-3 font-bold ${
                    pnlDirection === undefined
                      ? 'text-gray-600'
                      : pnlDirection === 'profit'
                        ? 'text-green-600'
                        : pnlDirection === 'loss'
                          ? 'text-red-600'
                          : 'text-gray-600'
                  }`}
                >
                  {formatRealizedPnl(t.realizedPnL)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {Math.ceil(trades.length / itemsPerPage) > 1 && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function mapJournalEntryToTrade(entry: WebApiJournalEntry): Trade {
  return {
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
  };
}

export function Analytics() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AnalyticsFilter>({
    side: 'ALL',
    status: 'CLOSED',
  });

  const applyFilters = (tradesToFilter: Trade[], appliedFilter: AnalyticsFilter) => {
    let result = tradesToFilter;

    if (hasNumericFilterValue(appliedFilter.startDate)) {
      const startDate = appliedFilter.startDate;
      result = result.filter((t) => t.openedAt >= startDate);
    }
    if (hasNumericFilterValue(appliedFilter.endDate)) {
      const endDate = appliedFilter.endDate;
      result = result.filter((t) => t.openedAt <= endDate);
    }
    if (appliedFilter.side && appliedFilter.side !== 'ALL') {
      result = result.filter((t) => t.side === appliedFilter.side);
    }
    if (appliedFilter.status && appliedFilter.status !== 'ALL') {
      result = result.filter((t) => t.status === appliedFilter.status);
    }
    if (appliedFilter.strategy) {
      const strategy = appliedFilter.strategy;
      result = result.filter((t) => t.entryCondition?.includes(strategy));
    }

    setFilteredTrades(result);
  };

  useEffect(() => {
    const loadTrades = async () => {
      try {
        setLoading(true);
        const response = await dataApi.getJournalPage(1, 500);
        if (response.success && response.data?.entries) {
          const tradesData = response.data.entries.map(mapJournalEntryToTrade);
          setTrades(tradesData);
          applyFilters(tradesData, filter);
        }
      } catch (error) {
        console.error('Failed to load trades:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadTrades();
  }, []);

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
