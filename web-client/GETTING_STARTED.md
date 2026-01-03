# Getting Started with Trading Bot Web Interface

## Quick Start (5 minutes)

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### 1. Install Dependencies

**Backend (web-server):**
```bash
cd D:\src\Edison\web-server
npm install
```

**Frontend (web-client):**
```bash
cd D:\src\Edison\web-client
npm install
```

### 2. Start Development Servers

**Terminal 1: Start Backend + Bot**
```bash
cd D:\src\Edison\web-server
npm run dev
```

The web server will:
- Start Express API on `http://localhost:4000`
- Start WebSocket server on `ws://localhost:4001`
- Connect to the trading bot instance

**Terminal 2: Start Frontend**
```bash
cd D:\src\Edison\web-client
npm run dev
```

The React dev server will:
- Start on `http://localhost:3000`
- Auto-reload on changes
- Proxy API requests to `localhost:4000`

### 3. Open in Browser
Navigate to: **`http://localhost:3000`**

You should see the trading bot dashboard!

---

## What You'll See

The dashboard displays (in real-time):

### Row 1: Control & Status
- **Bot Status Card** - Start/stop bot with visual indicator
- **Position Card** - Current open trade (if any)
- **Balance Card** - Account balance and PnL

### Row 2: Market Data
- **Live Ticker** - Price, RSI, EMAs, ATR, trend, BTC correlation
- **Signals List** - Last 10 trading signals

### Row 3: Charts
- **Price Chart** - Candlestick chart with volume (1-minute candles)

### Row 4: Strategy Info
- **Strategy Status** - Enabled/disabled trading strategies
- **Coming Soon** - Notice for Phase 3 analytics

---

## Project Structure

```
D:\src\Edison\
├── web-server/                 # Backend (Express + WebSocket)
│   ├── src/
│   │   ├── index.ts           # Main server
│   │   ├── types/
│   │   │   └── api.types.ts   # Shared API types
│   │   ├── services/
│   │   │   └── bot-bridge.service.ts
│   │   ├── routes/
│   │   │   ├── bot.routes.ts
│   │   │   └── data.routes.ts
│   │   └── websocket/
│   │       └── ws-server.ts
│   ├── package.json
│   └── tsconfig.json
│
└── web-client/                 # Frontend (React + Vite)
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── pages/
    │   │   └── Dashboard.tsx   # Main page
    │   ├── components/
    │   │   ├── dashboard/
    │   │   │   ├── BotStatusCard.tsx
    │   │   │   ├── PositionCard.tsx
    │   │   │   ├── BalanceCard.tsx
    │   │   │   ├── LiveTicker.tsx
    │   │   │   ├── SignalsList.tsx
    │   │   │   └── StrategyStatus.tsx
    │   │   └── charts/
    │   │       └── PriceChart.tsx
    │   ├── stores/
    │   │   ├── botStore.ts
    │   │   └── marketStore.ts
    │   ├── services/
    │   │   ├── api.service.ts
    │   │   └── websocket.service.ts
    │   ├── types/
    │   │   └── api.types.ts
    │   ├── index.css
    │   └── ...
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── package.json
    └── index.html
```

---

## Development Commands

### Frontend (web-client/)

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend (web-server/)

```bash
# Start dev server
npm run dev

# Build TypeScript
npm run build
```

---

## API Endpoints

### Bot Control
```
GET  /api/bot/status        - Get bot status
POST /api/bot/start         - Start trading
POST /api/bot/stop          - Stop trading
```

### Data Endpoints
```
GET  /api/data/position     - Get current position
GET  /api/data/balance      - Get account balance
GET  /api/data/market       - Get market data
GET  /api/data/signals/recent - Get last 10 signals
```

### WebSocket Events

**Server → Client (Real-time updates):**
```
BOT_STATUS_CHANGE  - { isRunning, currentPosition, balance, unrealizedPnL }
POSITION_UPDATE    - { position, entryPrice, currentPrice, pnl, ...}
BALANCE_UPDATE     - { balance, unrealizedPnL }
SIGNAL_NEW         - { direction, confidence, price, stopLoss, takeProfits, ... }
ERROR              - { error: string }
```

**Client → Server (Manual requests):**
```
PING               - Heartbeat request
GET_STATUS         - Request bot status
GET_POSITION       - Request current position
```

---

## State Management (Zustand)

### Bot Store
```typescript
import { useBotStore } from './stores/botStore';

const {
  isRunning,
  currentPosition,
  balance,
  unrealizedPnL,
  recentSignals,
  setRunning,
  setPosition,
  setBalance,
  addSignal
} = useBotStore();
```

### Market Store
```typescript
import { useMarketStore } from './stores/marketStore';

const {
  currentPrice,
  rsi,
  ema20,
  ema50,
  atr,
  trend,
  btcCorrelation,
  setPrice,
  setIndicators,
  setTrend
} = useMarketStore();
```

---

## Customization

### Change API Server Port
**In `web-server/src/index.ts`:**
```typescript
const PORT = 4000; // Change this
```

**In `web-client/vite.config.ts`:**
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:4000', // And this
    changeOrigin: true,
  },
}
```

### Change WebSocket Port
**In `web-server/src/websocket/ws-server.ts`:**
```typescript
const WS_PORT = 4001; // Change this
```

**In `web-client/src/services/websocket.service.ts`:**
```typescript
const WS_URL = 'ws://localhost:4001'; // And this
```

### Change Dashboard Layout
Edit `web-client/src/pages/Dashboard.tsx` grid classes:
```tsx
// Modify grid-cols-1 md:grid-cols-2 or md:grid-cols-3 for different layouts
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
```

### Customize Chart
Edit `web-client/src/components/charts/PriceChart.tsx`:
```tsx
// Change timeframe, colors, height, etc.
<PriceChart
  title="BTCUSDT (5m)"  // Different symbol/timeframe
  height={500}          // Taller chart
/>
```

---

## Connecting to Real Bot

To connect the web interface to the actual trading bot, you need to:

1. **Export bot instance in `src/bot.ts`:**
```typescript
export const bot = new TradingBot(config, logger);

// Expose public methods
bot.getCurrentPosition = function() { /* ... */ }
bot.getBalance = function() { /* ... */ }
bot.getMarketData = function() { /* ... */ }
bot.isRunning = true/false;
```

2. **Import in `web-server/src/index.ts`:**
```typescript
import { bot } from '../../src/bot';

const botBridge = new BotBridgeService(bot);
```

3. **The bot EventEmitter will automatically forward events to WebSocket clients**

---

## Troubleshooting

### WebSocket Connection Failed
- Check that backend is running on port 4001
- Verify firewall isn't blocking localhost:4001
- Check console for error messages

### API Requests Getting 404
- Ensure backend is running on port 4000
- Check that routes are registered in `web-server/src/index.ts`
- Verify proxy configuration in `vite.config.ts`

### Styling Issues (Tailwind not working)
- Run `npm install` in web-client directory
- Restart dev server after package.json changes
- Clear node_modules and reinstall if still broken

### Chart Not Rendering
- Ensure lightweight-charts is installed: `npm list lightweight-charts`
- Check browser console for errors
- Make sure container has proper height set

### Hot Reload Not Working (Vite)
- Restart dev server
- Check file save worked
- Clear Vite cache: delete `.vite/` folder

---

## Next Steps

1. **Integrate with Real Bot:**
   - Modify bot.ts to expose required methods
   - Ensure bot EventEmitter emits update events

2. **PHASE 3 - Analytics:**
   - Build trade history table
   - Add session comparison
   - Create performance charts

3. **PHASE 4 - Control Panel:**
   - Config editor with JSON validation
   - Strategy toggles
   - Risk management controls

4. **Deployment:**
   - Build frontend: `npm run build`
   - Serve static files from Express
   - Run in production mode

---

## Performance Tips

- Chart updates throttled to 1s intervals
- WebSocket messages debounced to prevent flooding
- Zustand stores are lightweight (minimal re-renders)
- Use React DevTools to check component render counts
- Lighthouse score should be 90+

---

## Support & Documentation

- **React:** https://react.dev
- **TypeScript:** https://www.typescriptlang.org
- **Vite:** https://vitejs.dev
- **Zustand:** https://github.com/pmndrs/zustand
- **Tailwind:** https://tailwindcss.com
- **Lightweight Charts:** https://tradingview.github.io/lightweight-charts/

---

**Last Updated:** 2025-12-05
**Version:** PHASE 2 Complete
**Status:** Ready for Development

