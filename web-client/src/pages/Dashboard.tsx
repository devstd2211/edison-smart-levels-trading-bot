/**
 * Dashboard Page
 *
 * Main page showing bot status and control
 */

import React, { useEffect } from 'react';
import { BotStatusCard } from '../components/dashboard/BotStatusCard';
import { PositionCard } from '../components/dashboard/PositionCard';
import { BalanceCard } from '../components/dashboard/BalanceCard';
import { LiveTicker } from '../components/dashboard/LiveTicker';
import { SignalsList } from '../components/dashboard/SignalsList';
import { StrategyStatus } from '../components/dashboard/StrategyStatus';
import { TrendSlider } from '../components/dashboard/TrendSlider';
import { LogConsole } from '../components/dashboard/LogConsole';
import { PriceChart } from '../components/charts/PriceChart';
import { useBotStore } from '../stores/botStore';
import { useMarketStore } from '../stores/marketStore';
import { useConfigStore } from '../stores/configStore';
import { api, dataApi } from '../services/api.service';
import { wsClient } from '../services/websocket.service';

export function Dashboard() {
  const { setRunning, setPosition, setBalance, setUnrealizedPnL, setError, addSignal } = useBotStore();
  const { setPrice, setIndicators, setTrend } = useMarketStore();
  const { symbol, timeframe } = useConfigStore();

  useEffect(() => {
    // Fetch initial status
    fetchStatus();
    fetchMarketData();

    // Setup WebSocket listeners
    wsClient.on('BOT_STATUS_CHANGE', handleBotStatusChange);
    wsClient.on('POSITION_UPDATE', handlePositionUpdate);
    wsClient.on('BALANCE_UPDATE', handleBalanceUpdate);
    wsClient.on('SIGNAL_NEW', handleNewSignal);
    wsClient.on('TREND_UPDATE', (data: any) => {
      if (data?.trend) {
        setTrend(data.trend);
      }
    });
    wsClient.on('ERROR', handleError);

    // Poll market data every 5 seconds for trend updates
    const marketDataInterval = setInterval(() => {
      fetchMarketData();
    }, 5000);

    // Cleanup
    return () => {
      clearInterval(marketDataInterval);
      wsClient.off('BOT_STATUS_CHANGE', handleBotStatusChange);
      wsClient.off('POSITION_UPDATE', handlePositionUpdate);
      wsClient.off('BALANCE_UPDATE', handleBalanceUpdate);
      wsClient.off('SIGNAL_NEW', handleNewSignal);
      wsClient.off('TREND_UPDATE', () => {});
      wsClient.off('ERROR', handleError);
    };
  }, []);

  const fetchStatus = async () => {
    const response = await api.getStatus() as any;
    if (response?.success && response?.data) {
      setRunning(response.data.isRunning);
      setPosition(response.data.currentPosition);
      setBalance(response.data.balance);
      setUnrealizedPnL(response.data.unrealizedPnL);
    }
  };

  const fetchMarketData = async () => {
    try {
      // Fetch bot status
      const statusResponse = await api.getStatus() as any;
      if (statusResponse?.success && statusResponse?.data) {
        setRunning(statusResponse.data.isRunning);
        setPosition(statusResponse.data.currentPosition);
        setBalance(statusResponse.data.balance);
        setUnrealizedPnL(statusResponse.data.unrealizedPnL);
      }

      // Fetch market data (price, indicators, trend)
      const marketResponse = await dataApi.getMarketData() as any;
      console.log('[Dashboard] Market response:', marketResponse);
      if (marketResponse?.success && marketResponse?.data) {
        const { currentPrice, priceChangePercent, trend, rsi, ema20, ema50, atr, btcCorrelation } = marketResponse.data;
        setPrice(currentPrice || 0, 0, priceChangePercent || 0);
        // Set trend - accept any string value including "NEUTRAL"
        if (trend !== undefined && trend !== null) {
          console.log('[Dashboard] Setting trend to:', trend);
          setTrend(trend as 'BULLISH' | 'BEARISH' | 'NEUTRAL');
        }
        if (rsi !== undefined || ema20 !== undefined || ema50 !== undefined || atr !== undefined) {
          setIndicators({
            rsi,
            ema20,
            ema50,
            atr,
            btcCorrelation,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    }
  };

  const handleBotStatusChange = (data: any) => {
    setRunning(data.isRunning);
    setPosition(data.currentPosition);
    setBalance(data.balance);
    setUnrealizedPnL(data.unrealizedPnL);
  };

  const handlePositionUpdate = (data: any) => {
    setPosition(data.position);
  };

  const handleBalanceUpdate = (data: any) => {
    setBalance(data.balance);
    setUnrealizedPnL(data.unrealizedPnL);
  };

  const handleNewSignal = (data: any) => {
    addSignal(data);
  };

  const handleError = (data: any) => {
    setError(data.error || 'Unknown error');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Real-time trading bot monitoring</p>
      </div>

      {/* Row 1: Bot Control + Position + Balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BotStatusCard />
        <PositionCard />
        <BalanceCard />
      </div>

      {/* Row 2: Live Market Data + Signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LiveTicker />
        <SignalsList />
      </div>

      {/* Row 3: Price Chart (Full Width) */}
      <div>
        <PriceChart title={`${symbol} (${timeframe})`} symbol={symbol} timeframe={timeframe} />
      </div>

      {/* Row 4: Strategy Status + Trend Slider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StrategyStatus />
        <TrendSlider />
      </div>

      {/* Row 5: Live Log Console (Full Width) */}
      <div>
        <LogConsole />
      </div>
    </div>
  );
}
