/**
 * Download XRP data for last month
 */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const BYBIT_API = 'https://api.bybit.com/v5/market/kline';
const SYMBOL = 'XRPUSDT';
const INTERVAL = '1'; // 1 minute

// Last month: Dec 8 - Jan 8
const endDate = new Date();
const startDate = new Date(endDate);
startDate.setDate(startDate.getDate() - 31);

console.log(`📥 Downloading ${SYMBOL} data`);
console.log(`Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

const allCandles: any[] = [];
let currentTime = startDate.getTime();
const endTime = endDate.getTime();
let requestCount = 0;

async function downloadChunk() {
  const limit = 1000;

  while (currentTime < endTime) {
    requestCount++;

    try {
      const params = {
        category: 'linear',
        symbol: SYMBOL,
        interval: INTERVAL,
        start: Math.floor(currentTime / 1000), // seconds
        limit: limit
      };

      const response = await axios.get(BYBIT_API, { params });

      if (!response.data.result || !response.data.result.list || response.data.result.list.length === 0) {
        console.log(`✅ Fetched ${allCandles.length} candles total`);
        break;
      }

      const candles = response.data.result.list.map((k: string[]) => ({
        timestamp: parseInt(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        turnover: parseFloat(k[6])
      }));

      allCandles.push(...candles);

      // Move to next period
      const lastCandle = candles[candles.length - 1];
      currentTime = lastCandle.timestamp + 60000; // Next minute

      const totalCandles = allCandles.length;
      const nextTime = new Date(currentTime).toISOString();
      console.log(`⏳ Request #${requestCount}: Fetched ${candles.length} candles (Total: ${totalCandles})`);
      console.log(`   Next: ${nextTime}`);

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Error:`, error instanceof Error ? error.message : error);
      break;
    }
  }
}

downloadChunk().then(() => {
  if (allCandles.length === 0) {
    console.log('❌ No data downloaded');
    process.exit(1);
  }

  // Sort by timestamp ascending
  allCandles.sort((a, b) => a.timestamp - b.timestamp);

  const dir = path.join(__dirname, '../data/historical');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const jsonFile = path.join(dir, `${SYMBOL}_1m_${startStr}_${endStr}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(allCandles, null, 2));

  console.log(`\n🎉 Download complete! Total: ${allCandles.length} candles`);
  console.log(`💾 Saved: ${jsonFile}`);
});
