import { PERCENT_MULTIPLIER } from '../constants';
/**
 * Trade History Service with Dynamic Schema
 *
 * Manages permanent trade history in CSV format with automatic schema expansion.
 * - Append-only: never deletes data
 * - Dynamic schema: automatically adds new columns when new fields are detected
 * - Backward compatible: old records work with new schema (empty values for new fields)
 * - Auto-migration: expands CSV when new fields are added
 *
 * Usage:
 * ```typescript
 * const history = new TradeHistoryService(logger);
 * await history.appendTrade({
 *   ...coreFields,
 *   rsiEntry: 30.5,  // New field? Automatically added to schema!
 *   customIndicator: 'value'
 * });
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from '../types';
import { extractErrorMessage } from '../utils/error-helper';

// ============================================================================
// CONSTANTS
// ============================================================================

// Core fields (always present in every record)
const CORE_FIELDS = [
  'timestamp',
  'id',
  'symbol',
  'side',
  'strategy',
  'entryPrice',
  'exitPrice',
  'quantity',
  'leverage',
  'pnl',
  'fees',
  'netPnl',
  'duration',
  'exitType',
  'confidence',
  'virtualBalanceBefore',
  'virtualBalanceAfter',
  'sessionVersion',
  'notes',
];

// ============================================================================
// TYPES
// ============================================================================

export interface TradeRecord {
  // Core fields (required)
  timestamp: string;
  id: string;
  symbol: string;
  side: string;
  strategy: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  leverage: number;
  pnl: number;
  fees: number;
  netPnl: number;
  duration: string;
  exitType: string;
  confidence: number;
  virtualBalanceBefore: number;
  virtualBalanceAfter: number;
  sessionVersion: string;
  notes: string;

  // Dynamic fields (any additional indicators, conditions, etc)
  [key: string]: unknown;
}

// ============================================================================
// TRADE HISTORY SERVICE
// ============================================================================

export class TradeHistoryService {
  private csvPath: string;
  private schemaPath: string;
  private currentSchema: string[] = [];

  constructor(
    private logger: LoggerService,
    private dataDir: string = './data',
  ) {
    this.csvPath = path.join(this.dataDir, 'trade-history.csv');
    this.schemaPath = path.join(this.dataDir, 'csv-schema.json');
    this.initialize();
  }

  /**
   * Initialize CSV and schema
   */
  private initialize(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Load or create schema
    this.currentSchema = this.loadSchema();

    // Ensure CSV exists
    if (!fs.existsSync(this.csvPath)) {
      this.createCSV();
    } else {
      // Verify schema matches CSV header
      this.verifyAndMigrateSchema();
    }
  }

  /**
   * Load schema from file
   */
  private loadSchema(): string[] {
    try {
      if (fs.existsSync(this.schemaPath)) {
        const content = fs.readFileSync(this.schemaPath, 'utf-8');
        const schema = JSON.parse(content) as string[];

        this.logger.info('✅ CSV schema loaded', {
          fields: schema.length,
          coreFields: CORE_FIELDS.length,
          customFields: schema.length - CORE_FIELDS.length,
        });

        return schema;
      }
    } catch (error: unknown) {
      this.logger.error('❌ Failed to load schema', { error, errorMessage: extractErrorMessage(error) });
    }

    // Return core fields as default
    return [...CORE_FIELDS];
  }

  /**
   * Save schema to file
   */
  private saveSchema(schema: string[]): void {
    try {
      fs.writeFileSync(this.schemaPath, JSON.stringify(schema, null, 2), 'utf-8');

      this.logger.debug('📝 Schema saved', { fields: schema.length });
    } catch (error: unknown) {
      this.logger.error('❌ Failed to save schema', { error, errorMessage: extractErrorMessage(error) });
    }
  }

  /**
   * Create new CSV with current schema
   */
  private createCSV(): void {
    const header = this.currentSchema.join(',');
    fs.writeFileSync(this.csvPath, header + '\n', 'utf-8');

    this.logger.info('✅ Trade history CSV created', {
      path: this.csvPath,
      fields: this.currentSchema.length,
    });
  }

  /**
   * Verify CSV header matches schema, migrate if needed
   */
  private verifyAndMigrateSchema(): void {
    try {
      const content = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = content.split('\n');

      if (lines.length === 0) {
        this.createCSV();
        return;
      }

      const existingHeader = lines[0].split(',').map((h) => h.trim());

      // Check if schema has new fields
      const newFields = this.currentSchema.filter((field) => !existingHeader.includes(field));

      if (newFields.length > 0) {
        this.logger.warn('🔄 CSV schema migration needed', {
          newFields,
          oldColumns: existingHeader.length,
          newColumns: this.currentSchema.length,
        });

        this.migrateCSV(existingHeader, newFields);
      }
    } catch (error: unknown) {
      this.logger.error('❌ Failed to verify schema', { error, errorMessage: extractErrorMessage(error) });
    }
  }

  /**
   * Migrate CSV to new schema (add columns)
   */
  private migrateCSV(oldHeader: string[], newFields: string[]): void {
    try {
      const content = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      // Create backup
      const backupPath = this.csvPath + '.backup.' + Date.now();
      fs.writeFileSync(backupPath, content, 'utf-8');

      this.logger.info('💾 Backup created', { path: backupPath });

      // Build new header
      const newHeader = [...oldHeader, ...newFields];

      // Rebuild CSV
      const newLines: string[] = [newHeader.join(',')];

      // Migrate each data line (add empty values for new fields)
      for (let i = 1; i < lines.length; i++) {
        const values = this.splitCSVLine(lines[i]);

        // Add empty values for new fields
        for (let j = 0; j < newFields.length; j++) {
          values.push(''); // Empty value for new field
        }

        newLines.push(values.join(','));
      }

      // Write migrated CSV
      fs.writeFileSync(this.csvPath, newLines.join('\n') + '\n', 'utf-8');

      // Update schema
      this.currentSchema = newHeader;
      this.saveSchema(newHeader);

      this.logger.info('✅ CSV migrated successfully', {
        addedFields: newFields,
        totalRecords: lines.length - 1,
        newColumns: newHeader.length,
      });
    } catch (error: unknown) {
      this.logger.error('❌ CSV migration failed', { error, errorMessage: extractErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Append trade with dynamic fields
   */
  async appendTrade(record: TradeRecord): Promise<void> {
    try {
      // Detect new fields in this record
      const recordFields = Object.keys(record);
      const newFields = recordFields.filter((field) => !this.currentSchema.includes(field));

      if (newFields.length > 0) {
        this.logger.info('🆕 New fields detected', { fields: newFields });

        // Add to schema
        this.currentSchema.push(...newFields);
        this.saveSchema(this.currentSchema);

        // Migrate CSV to include new columns
        this.verifyAndMigrateSchema();
      }

      // Build CSV row according to current schema
      const values: string[] = [];

      for (const field of this.currentSchema) {
        const value = record[field];

        if (value === undefined || value === null) {
          values.push(''); // Empty for missing fields
        } else if (typeof value === 'string') {
          // Escape commas and quotes
          const escaped = value.replace(/"/g, '""');
          values.push(`"${escaped}"`);
        } else {
          values.push(String(value));
        }
      }

      const csvLine = values.join(',');

      // Append to CSV
      fs.appendFileSync(this.csvPath, csvLine + '\n', 'utf-8');

      this.logger.debug('📝 Trade appended to history', {
        id: record.id,
        netPnl: record.netPnl,
        fields: recordFields.length,
        newFields: newFields.length,
      });
    } catch (error: unknown) {
      this.logger.error('❌ Failed to append trade', {
        error,
        errorMessage: extractErrorMessage(error),
        id: record.id,
      });
      throw error;
    }
  }

  /**
   * Read all trades with dynamic schema
   */
  async readAllTrades(): Promise<TradeRecord[]> {
    try {
      const content = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      if (lines.length <= 1) {
        return [];
      }

      const header = lines[0].split(',').map((h) => h.trim());
      const trades: TradeRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCSVLine(lines[i], header);
        if (row) {
          trades.push(row);
        }
      }

      return trades;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to read trades', { error, errorMessage: extractErrorMessage(error) });
      return [];
    }
  }

  /**
   * Parse CSV line with dynamic schema
   */
  private parseCSVLine(line: string, header: string[]): TradeRecord | null {
    try {
      const values = this.splitCSVLine(line);

      const record: Record<string, unknown> = {};

      for (let i = 0; i < header.length; i++) {
        const field = header[i];
        const value = values[i] || '';

        // Type conversion for known numeric fields
        if (
          [
            'entryPrice',
            'exitPrice',
            'quantity',
            'pnl',
            'fees',
            'netPnl',
            'confidence',
            'virtualBalanceBefore',
            'virtualBalanceAfter',
          ].includes(field)
        ) {
          record[field] = parseFloat(value) || 0;
        } else if (field === 'leverage') {
          record[field] = parseInt(value) || 10;
        } else {
          // Keep as string or try to parse as number for custom fields
          const unquoted = value.replace(/^"|"$/g, '').replace(/""/g, '"');

          // Try to parse as number if it looks like a number
          if (!isNaN(Number(unquoted)) && unquoted !== '') {
            record[field] = parseFloat(unquoted);
          } else {
            record[field] = unquoted;
          }
        }
      }

      return record as TradeRecord;
    } catch (error: unknown) {
      this.logger.warn('⚠️ Failed to parse CSV line', { line });
      return null;
    }
  }

  /**
   * Split CSV line handling quoted values
   */
  private splitCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of value
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last value
    values.push(current);

    return values;
  }

  /**
   * Get current schema
   */
  getCurrentSchema(): string[] {
    return [...this.currentSchema];
  }

  /**
   * Get total number of trades
   */
  async getTotalTrades(): Promise<number> {
    try {
      const content = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      return Math.max(0, lines.length - 1); // Exclude header
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get statistics from CSV
   */
  async getStatistics(): Promise<{
    totalTrades: number;
    totalPnL: number;
    winRate: number;
    avgPnL: number;
    byStrategy: { [key: string]: number };
    bySession: { [key: string]: number };
  }> {
    const trades = await this.readAllTrades();

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        totalPnL: 0,
        winRate: 0,
        avgPnL: 0,
        byStrategy: {},
        bySession: {},
      };
    }

    const wins = trades.filter((t) => t.netPnl > 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + t.netPnl, 0);

    const byStrategy: { [key: string]: number } = {};
    const bySession: { [key: string]: number } = {};

    for (const trade of trades) {
      byStrategy[trade.strategy] = (byStrategy[trade.strategy] || 0) + trade.netPnl;
      bySession[trade.sessionVersion] = (bySession[trade.sessionVersion] || 0) + trade.netPnl;
    }

    return {
      totalTrades: trades.length,
      totalPnL,
      winRate: (wins / trades.length) * PERCENT_MULTIPLIER,
      avgPnL: totalPnL / trades.length,
      byStrategy,
      bySession,
    };
  }

  /**
   * Get statistics grouped by custom field
   */
  async getStatisticsByField(fieldName: string): Promise<{ [key: string]: number }> {
    const trades = await this.readAllTrades();
    const stats: { [key: string]: number } = {};

    for (const trade of trades) {
      const key = String(trade[fieldName] || 'unknown');
      stats[key] = (stats[key] || 0) + trade.netPnl;
    }

    return stats;
  }
}
