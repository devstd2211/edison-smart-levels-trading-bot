/**
 * OrderBook Page
 *
 * Real-time orderbook monitoring, wall detection, volume profile, and funding rates
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Zap,
  Volume2,
  EyeOff,
} from 'lucide-react';
import { wsClient } from '../services/websocket.service';
import { dataApi } from '../services/api.service';
import type {
  WebApiFundingRateView,
  WebApiOrderBookView,
  WebApiVolumeProfileView,
  WebApiWallView,
} from '@edison/contracts/web-api';
import { useConfigStore } from '../stores/configStore';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type OrderBook = WebApiOrderBookView;
type DetectedWall = WebApiWallView;
type FundingRate = WebApiFundingRateView;
type VolumeProfile = WebApiVolumeProfileView;
type FundingDirection = 'positive' | 'negative' | 'neutral';

const ORDERBOOK_BAR_MAX_WIDTH = 60;
const EMPTY_PRICE_RANGE_LABEL = 'N/A';

function getScaledWidth(value: number, maxValue: number, scale: number) {
  if (maxValue <= 0) {
    return 0;
  }

  return (value / maxValue) * scale;
}

function getSpreadPercentage(topAskPrice: number | undefined, topBidPrice: number | undefined) {
  if (topAskPrice === undefined || topBidPrice === undefined || topBidPrice <= 0) {
    return 0;
  }

  return ((topAskPrice - topBidPrice) / topBidPrice) * 100;
}

function getPredictedFundingDirectionCopy(predictedRate: number) {
  if (predictedRate > 0) {
    return 'LONG pressure continues';
  }

  if (predictedRate < 0) {
    return 'SHORT pressure continues';
  }

  return 'Funding pressure balanced';
}

function getCurrentFundingDirection(currentRate: number): FundingDirection {
  if (currentRate > 0) {
    return 'positive';
  }

  if (currentRate < 0) {
    return 'negative';
  }

  return 'neutral';
}

function getFundingRateValueClass(direction: FundingDirection) {
  if (direction === 'positive') {
    return 'text-red-600';
  }

  if (direction === 'negative') {
    return 'text-green-600';
  }

  return 'text-gray-600';
}

function getFundingRateSign(direction: FundingDirection) {
  if (direction === 'positive') {
    return '+';
  }

  if (direction === 'negative') {
    return '-';
  }

  return '';
}

function isHighFundingRate(rate: number) {
  return getCurrentFundingDirection(rate) !== 'neutral' && Math.abs(rate) > 0.01;
}

function buildVolumeProfile(orderBook: OrderBook, symbol: string, visibleLevels: number): VolumeProfile {
  const bidLevels = orderBook.bids.slice(0, Math.floor(visibleLevels / 2)).reverse();
  const askLevels = orderBook.asks.slice(0, Math.ceil(visibleLevels / 2));
  const combinedLevels = [...bidLevels, ...askLevels]
    .map((level) => ({
      price: level.price.toFixed(2),
      volume: level.quantity,
    }));

  const maxVolume = combinedLevels.reduce(
    (highestVolume, level) => Math.max(highestVolume, level.volume),
    0
  );

  return {
    symbol,
    levels: combinedLevels.map((level) => level.price),
    volumes: combinedLevels.map((level) => level.volume),
    maxVolume,
  };
}

// ============================================================================
// ORDERBOOK DISPLAY COMPONENT
// ============================================================================

function OrderBookPanel({ orderBook, maxVolume }: { orderBook: OrderBook; maxVolume: number }) {
  const [highlight, setHighlight] = useState<number | null>(null);

  if (!orderBook) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
        <p className="text-center text-gray-500">Loading orderbook...</p>
      </div>
    );
  }

  const asks = orderBook.asks.slice(0, 10).reverse();
  const bids = orderBook.bids.slice(0, 10);
  const spreadPercentage = getSpreadPercentage(asks[0]?.price, bids[0]?.price);

  const formatNumber = (num: number, decimals: number = 2) => num.toFixed(decimals);

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Order Book</h2>
          <p className="text-sm text-gray-600">{orderBook.symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-600">Spread</p>
          <p className="text-lg font-semibold text-blue-600">
            {formatNumber(spreadPercentage, 3)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* ASKS (Sell Orders) */}
        <div>
          <h3 className="text-sm font-semibold text-red-600 mb-3">ASK (Sell)</h3>
          <div className="space-y-1 text-xs">
            {asks.map((ask, idx) => (
              <div
                key={idx}
                className={`flex justify-between p-2 rounded transition ${
                  highlight === ask.price ? 'bg-red-100' : 'hover:bg-gray-50'
                }`}
                onMouseEnter={() => setHighlight(ask.price)}
                onMouseLeave={() => setHighlight(null)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="h-4 bg-red-200 rounded"
                    style={{
                      width: `${getScaledWidth(ask.quantity, maxVolume, ORDERBOOK_BAR_MAX_WIDTH)}px`,
                    }}
                  />
                  <span className="text-red-600 font-medium">${formatNumber(ask.price)}</span>
                </div>
                <span className="text-gray-600">{formatNumber(ask.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* BIDS (Buy Orders) */}
        <div>
          <h3 className="text-sm font-semibold text-green-600 mb-3">BID (Buy)</h3>
          <div className="space-y-1 text-xs">
            {bids.map((bid, idx) => (
              <div
                key={idx}
                className={`flex justify-between p-2 rounded transition ${
                  highlight === bid.price ? 'bg-green-100' : 'hover:bg-gray-50'
                }`}
                onMouseEnter={() => setHighlight(bid.price)}
                onMouseLeave={() => setHighlight(null)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="h-4 bg-green-200 rounded"
                    style={{
                      width: `${getScaledWidth(bid.quantity, maxVolume, ORDERBOOK_BAR_MAX_WIDTH)}px`,
                    }}
                  />
                  <span className="text-green-600 font-medium">${formatNumber(bid.price)}</span>
                </div>
                <span className="text-gray-600">{formatNumber(bid.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spread Info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Top Bid</p>
            <p className="font-semibold text-gray-900">
              ${formatNumber(bids[0]?.price ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Spread</p>
            <p className="font-semibold text-blue-600">{formatNumber(spreadPercentage, 3)}%</p>
          </div>
          <div>
            <p className="text-gray-600">Top Ask</p>
            <p className="font-semibold text-gray-900">
              ${formatNumber(asks[0]?.price ?? 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// WALL DETECTION COMPONENT
// ============================================================================

function WallDetectionPanel({ walls }: { walls: DetectedWall[] }) {
  const buyWalls = walls.filter((w) => w.side === 'BUY' && w.detected);
  const sellWalls = walls.filter((w) => w.side === 'SELL' && w.detected);

  const getStrengthColor = (strength: number) => {
    if (strength >= 0.8) return 'bg-red-100 text-red-800';
    if (strength >= 0.6) return 'bg-orange-100 text-orange-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
        <h2 className="text-lg font-semibold text-gray-900">Wall Detection</h2>
      </div>

      {buyWalls.length === 0 && sellWalls.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No walls detected</p>
      ) : (
        <div className="space-y-4">
          {/* Buy Walls */}
          {buyWalls.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-600 mb-3">Buy Walls</h3>
              <div className="space-y-2">
                {buyWalls.map((wall, idx) => (
                  <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          ${wall.price.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-600">{wall.quantity.toFixed(2)} BTC</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStrengthColor(wall.strength)}`}>
                        Strength: {(wall.strength * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${wall.strength * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sell Walls */}
          {sellWalls.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-600 mb-3">Sell Walls</h3>
              <div className="space-y-2">
                {sellWalls.map((wall, idx) => (
                  <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          ${wall.price.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-600">{wall.quantity.toFixed(2)} BTC</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStrengthColor(wall.strength)}`}>
                        Strength: {(wall.strength * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all"
                        style={{ width: `${wall.strength * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600">
        <p>
          Large walls near support or resistance can indicate institutional interest. Strong buy
          walls suggest defense, while strong sell walls suggest overhead pressure.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// VOLUME PROFILE COMPONENT
// ============================================================================

function VolumeProfilePanel({ profile }: { profile: VolumeProfile | null }) {
  if (!profile) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
        <p className="text-center text-gray-500">Loading profile...</p>
      </div>
    );
  }

  const hasLevels = profile.levels.length > 0;
  const priceRangeLabel = hasLevels
    ? `$${profile.levels[0]} - $${profile.levels[profile.levels.length - 1]}`
    : EMPTY_PRICE_RANGE_LABEL;

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
      <div className="flex items-center gap-2 mb-6">
        <Volume2 className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-gray-900">Volume Profile</h2>
      </div>

      <div className="space-y-2">
        {profile.levels.map((price, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-16">${price}</span>
            <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-400 to-purple-600 h-6 rounded transition-all"
                style={{
                  width: `${getScaledWidth(profile.volumes[idx] ?? 0, profile.maxVolume, 100)}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-600 w-16 text-right">
              {(profile.volumes[idx] ?? 0).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Max Volume</p>
            <p className="font-semibold text-gray-900">{profile.maxVolume.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-600">Price Range</p>
            <p className="font-semibold text-gray-900">{priceRangeLabel}</p>
          </div>
          <div>
            <p className="text-gray-600">Levels</p>
            <p className="font-semibold text-gray-900">{profile.levels.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FUNDING RATE COMPONENT
// ============================================================================

function FundingRatePanel({ fundingRate }: { fundingRate: FundingRate | null }) {
  if (!fundingRate) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
        <p className="text-center text-gray-500">Loading funding rates...</p>
      </div>
    );
  }

  const timeToNextFunding = Math.max(0, fundingRate.nextFundingTime - Date.now());
  const hoursRemaining = Math.floor(timeToNextFunding / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeToNextFunding % (1000 * 60 * 60)) / (1000 * 60));

  const currentDirection = getCurrentFundingDirection(fundingRate.current);
  const predictedDirection = getCurrentFundingDirection(fundingRate.predicted);
  const isPositive = currentDirection === 'positive';
  const isNegative = currentDirection === 'negative';
  const isHighRate = isHighFundingRate(fundingRate.current); // > 0.01% is considered high

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Funding Rates</h2>
        </div>
        {isHighRate && (
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPositive ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            {isPositive ? 'High long funding' : 'High short funding'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Current Funding Rate */}
        <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Current Funding Rate</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${
              getFundingRateValueClass(currentDirection)
            }`}>
              {getFundingRateSign(currentDirection)}
              {Math.abs(fundingRate.current * 100).toFixed(4)}%
            </span>
            <span className="text-sm text-gray-600">
              {isPositive
                ? 'Longs pay shorts'
                : isNegative
                  ? 'Shorts pay longs'
                  : 'Funding balanced'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {new Date(fundingRate.lastFundingTime).toLocaleTimeString()}
          </p>
        </div>

        {/* Predicted Funding Rate */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Predicted Next Rate</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${
              getFundingRateValueClass(predictedDirection)
            }`}>
              {getFundingRateSign(predictedDirection)}
              {Math.abs(fundingRate.predicted * 100).toFixed(4)}%
            </span>
            <span className="text-sm text-gray-600">
              Next in {hoursRemaining}h {minutesRemaining}m
            </span>
          </div>
        </div>
      </div>

      {/* Funding Impact Analysis */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <div className="font-semibold flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4" />
          Funding Impact
        </div>
        <ul className="space-y-1 ml-6 list-disc text-blue-700">
          <li>
            {isPositive
              ? 'High positive rates favor SHORT positions'
              : isNegative
                ? 'Negative rates favor LONG positions'
                : 'Neutral rates keep LONG and SHORT funding balanced'}
          </li>
          <li>
            Rate changes every 8 hours
          </li>
          <li>
            Predicted rate: {getPredictedFundingDirectionCopy(fundingRate.predicted)}
          </li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN ORDERBOOK PAGE COMPONENT
// ============================================================================

export function OrderBook() {
  const { symbol } = useConfigStore();
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [walls, setWalls] = useState<DetectedWall[]>([]);
  const [fundingRate, setFundingRate] = useState<FundingRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Calculate max volume for scaling
  const maxVolume = useMemo(() => {
    if (!orderBook) return 0;
    const allVolumes = [...orderBook.asks, ...orderBook.bids].map((l) => l.quantity);
    return allVolumes.reduce((highestVolume, quantity) => Math.max(highestVolume, quantity), 0);
  }, [orderBook]);

  // Mock volume profile (in real app, would come from API)
  const volumeProfile: VolumeProfile | null = useMemo(() => {
    if (!orderBook) return null;
    return buildVolumeProfile(orderBook, symbol, 15);
  }, [orderBook, symbol]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch orderbook
        const obResponse = await dataApi.getOrderBook(symbol);
        if (obResponse.success && obResponse.data) {
          setOrderBook(obResponse.data as OrderBook);
        }

        // Fetch detected walls
        const wallsResponse = await dataApi.getWalls(symbol);
        if (wallsResponse.success && wallsResponse.data) {
          setWalls(wallsResponse.data.walls);
        } else {
          setWalls([]);
        }

        // Fetch funding rate
        const frResponse = await dataApi.getFundingRate(symbol);
        if (frResponse.success && frResponse.data) {
          setFundingRate(frResponse.data as FundingRate);
        }
      } catch (error) {
        console.error('Failed to fetch orderbook data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Setup WebSocket listeners for real-time updates
    const handleOrderbookUpdate = (data: WebApiOrderBookView) => {
      if (autoRefresh && data?.symbol === symbol) {
        setOrderBook(data);
      }
    };

    const handleWallsUpdate = (data: { symbol: string; walls: WebApiWallView[] }) => {
      if (autoRefresh && data?.symbol === symbol) {
        setWalls(data.walls);
      }
    };

    const handleFundingRateUpdate = (data: WebApiFundingRateView) => {
      if (autoRefresh && data?.symbol === symbol) {
        setFundingRate(data);
      }
    };

    wsClient.on('ORDERBOOK_UPDATE', handleOrderbookUpdate);
    wsClient.on('WALLS_UPDATE', handleWallsUpdate);
    wsClient.on('FUNDING_RATE_UPDATE', handleFundingRateUpdate);

    return () => {
      // Cleanup WebSocket listeners
      wsClient.off('ORDERBOOK_UPDATE', handleOrderbookUpdate);
      wsClient.off('WALLS_UPDATE', handleWallsUpdate);
      wsClient.off('FUNDING_RATE_UPDATE', handleFundingRateUpdate);
    };
  }, [symbol]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order Book Monitor</h1>
            <p className="text-gray-600 mt-1">Real-time orderbook visualization and wall detection</p>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              autoRefresh
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {autoRefresh ? <Activity className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="mt-2">Loading orderbook data...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Main Grid: OrderBook + Walls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {orderBook && <OrderBookPanel orderBook={orderBook} maxVolume={maxVolume} />}
            <WallDetectionPanel walls={walls} />
          </div>

          {/* Secondary Grid: Volume Profile + Funding Rates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VolumeProfilePanel profile={volumeProfile} />
            <FundingRatePanel fundingRate={fundingRate} />
          </div>

          {/* Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">How to Read</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>Green = Buy orders (bid)</li>
                <li>Red = Sell orders (ask)</li>
                <li>Wider bars = Higher volume</li>
                <li>Spread = Distance between best bid and ask</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Wall Detection</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>Buy walls = Support building</li>
                <li>Sell walls = Resistance forming</li>
                <li>Strength = Share of the visible order book</li>
                <li>Updates arrive in real time via WebSocket</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Funding Rates</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>Positive rates = Longs pay shorts</li>
                <li>Negative rates = Shorts pay longs</li>
                <li>Changes every 8 hours</li>
                <li>High rates can signal crowded positioning</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
