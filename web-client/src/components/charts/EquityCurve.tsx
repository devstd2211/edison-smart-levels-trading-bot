/**
 * Equity Curve Component
 *
 * Displays account equity growth over time using Recharts
 */

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useTradeStore, EquityCurvePoint } from '../../stores/tradeStore';

interface EquityCurveProps {
  data?: EquityCurvePoint[];
  height?: number;
  title?: string;
}

export function EquityCurve({
  data,
  height = 400,
  title = 'Account Equity Curve',
}: EquityCurveProps) {
  const { equityCurve } = useTradeStore();
  const displayData = data || equityCurve;

  // Generate sample data if none provided
  const getSampleData = (): EquityCurvePoint[] => {
    const now = Date.now();
    let equity = 1000;
    const data: EquityCurvePoint[] = [];

    for (let i = 0; i < 50; i++) {
      const randomChange = (Math.random() - 0.45) * 50; // Bias upward
      equity += randomChange;

      data.push({
        time: new Date(now - (50 - i) * 60000).toISOString(),
        timestamp: now - (50 - i) * 60000,
        equity: Math.max(500, Math.round(equity)),
        pnl: randomChange,
        tradeNumber: i + 1,
        drawdown: ((Math.max(1000, equity) - equity) / Math.max(1000, equity)) * 100,
      });
    }

    return data;
  };

  const chartData = displayData.length > 0 ? displayData : getSampleData();

  // Calculate statistics
  const initialEquity = chartData.length > 0 ? chartData[0].equity : 1000;
  const finalEquity = chartData.length > 0 ? chartData[chartData.length - 1].equity : 1000;
  const totalReturn = ((finalEquity - initialEquity) / initialEquity) * 100;
  const maxEquity = Math.max(...chartData.map((d) => d.equity));
  const minEquity = Math.min(...chartData.map((d) => d.equity));
  const maxDrawdown = Math.max(...chartData.map((d) => d.drawdown));

  const CustomTooltip: React.FC<any> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="text-sm text-gray-800 font-medium">Trade #{data.tradeNumber}</p>
          <p className="text-sm text-gray-700">
            Equity: ${data.equity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
          <p
            className={`text-sm font-semibold ${
              data.pnl >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            Drawdown: {data.drawdown.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">Account growth over time</p>
        </div>
        <TrendingUp className="w-6 h-6 text-green-600" />
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Starting</p>
          <p className="text-lg font-bold text-gray-900">
            ${initialEquity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Current</p>
          <p className="text-lg font-bold text-gray-900">
            ${finalEquity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Return</p>
          <p
            className={`text-lg font-bold ${
              totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Max Drawdown</p>
          <p className="text-lg font-bold text-red-600">-{maxDrawdown.toFixed(2)}%</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="tradeNumber"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            label={{ value: 'Equity ($)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorEquity)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Performance Info */}
      <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Peak Equity</p>
          <p className="text-sm font-semibold text-gray-900">
            ${maxEquity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Min Equity</p>
          <p className="text-sm font-semibold text-gray-900">
            ${minEquity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Total Trades</p>
          <p className="text-sm font-semibold text-gray-900">{chartData.length}</p>
        </div>
      </div>
    </div>
  );
}
