import {
  splitCsvLinePreservingQuotes,
  type TradeHistoryCsvRecord,
} from './trade-history-csv.utils';

const NUMERIC_FIELDS = new Set([
  'entryPrice',
  'exitPrice',
  'quantity',
  'pnl',
  'fees',
  'netPnl',
  'confidence',
  'virtualBalanceBefore',
  'virtualBalanceAfter',
]);

export function parseCsvTradeRecordLine(
  line: string,
  header: string[],
): TradeHistoryCsvRecord {
  const values = splitCsvLinePreservingQuotes(line);
  const record: TradeHistoryCsvRecord = {};

  for (let i = 0; i < header.length; i++) {
    const field = header[i];
    const value = values[i] || '';

    if (NUMERIC_FIELDS.has(field)) {
      record[field] = parseFloat(value) || 0;
      continue;
    }

    if (field === 'leverage') {
      record[field] = parseInt(value) || 10;
      continue;
    }

    const unquoted = value.replace(/^"|"$/g, '').replace(/""/g, '"');
    if (!isNaN(Number(unquoted)) && unquoted !== '') {
      record[field] = parseFloat(unquoted);
    } else {
      record[field] = unquoted;
    }
  }

  return record;
}
