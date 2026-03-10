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
import { LoggerService } from './logger.service';
import { extractErrorMessage } from '../utils/error-helper';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { JournalWriteError } from '../errors/DomainErrors';
import {
  buildCsvLineForSchema,
  splitCsvLinePreservingQuotes,
  type TradeHistoryCsvRecord,
} from './trade-history/trade-history-csv.utils';
import { parseCsvTradeRecordLine } from './trade-history/trade-history-parse.utils';
import {
  calculateTradeStatistics,
  calculateTradeStatisticsByField,
  createDefaultTradeStatistics,
  TradeHistoryStatistics,
} from './trade-history/trade-history-stats.utils';

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

function toTradeHistoryCsvValue(value: unknown): string | number | boolean | null | undefined {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return String(value);
}

function toTradeHistoryCsvRecord(record: TradeRecord): TradeHistoryCsvRecord {
  const csvRecord: TradeHistoryCsvRecord = {};

  for (const [key, value] of Object.entries(record)) {
    const csvValue = toTradeHistoryCsvValue(value);
    if (csvValue !== undefined) {
      csvRecord[key] = csvValue;
    }
  }

  return csvRecord;
}

type TradeHistoryStatsRecord = TradeHistoryCsvRecord & {
  netPnl: number;
  strategy: string;
  sessionVersion: string;
};

function toTradeHistoryStatsRecord(record: TradeRecord): TradeHistoryStatsRecord {
  return {
    ...toTradeHistoryCsvRecord(record),
    netPnl: record.netPnl,
    strategy: record.strategy,
    sessionVersion: record.sessionVersion,
  };
}

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
  private errorHandler?: ErrorHandler;
  private initialized = false;

  constructor(
    private logger: LoggerService,
    private dataDir: string = './data',
    errorHandler?: ErrorHandler,
  ) {
    this.csvPath = path.join(this.dataDir, 'trade-history.csv');
    this.schemaPath = path.join(this.dataDir, 'csv-schema.json');
    this.errorHandler = errorHandler;
  }

  /**
   * Start service initialization (explicit lifecycle)
   */
  start(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.initialize();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.start();
    }
  }

  /**
   * Initialize CSV and schema with SKIP strategy for errors
   */
  private initialize(): void {
    try {
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
    } catch (error: unknown) {
      // SKIP strategy: log and continue with default schema
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'TradeHistoryService.initialize',
        });
      } else {
        this.logger.warn('⚠️ Initialization failed, continuing with default schema', {
          error: extractErrorMessage(error),
        });
      }
      // Set default schema
      this.currentSchema = [...CORE_FIELDS];
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
   * Save schema to file with SKIP strategy for errors
   */
  private saveSchema(schema: string[]): void {
    try {
      fs.writeFileSync(this.schemaPath, JSON.stringify(schema, null, 2), 'utf-8');

      this.logger.debug('📝 Schema saved', { fields: schema.length });
    } catch (error: unknown) {
      // SKIP strategy: log and continue
      if (this.errorHandler) {
        this.errorHandler.handle(new Error('Failed to save schema'), {
          strategy: RecoveryStrategy.SKIP,
          context: 'TradeHistoryService.saveSchema',
        });
      } else {
        this.logger.error('❌ Failed to save schema', { error, errorMessage: extractErrorMessage(error) });
      }
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
   * Verify CSV header matches schema, migrate if needed with SKIP strategy
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
      // SKIP strategy: log error and continue
      if (this.errorHandler) {
        this.errorHandler.handle(new Error('Failed to verify schema'), {
          strategy: RecoveryStrategy.SKIP,
          context: 'TradeHistoryService.verifyAndMigrateSchema',
        });
      } else {
        this.logger.error('❌ Failed to verify schema', { error, errorMessage: extractErrorMessage(error) });
      }
    }
  }

  /**
   * Migrate CSV to new schema (add columns) with SKIP strategy
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
        const values = splitCsvLinePreservingQuotes(lines[i]);

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
      // SKIP strategy: log migration failure and continue
      if (this.errorHandler) {
        this.errorHandler.handle(new Error('CSV migration failed'), {
          strategy: RecoveryStrategy.SKIP,
          context: 'TradeHistoryService.migrateCSV',
        });
      } else {
        this.logger.error('❌ CSV migration failed', { error, errorMessage: extractErrorMessage(error) });
      }
    }
  }

  /**
   * Append trade with dynamic fields with RETRY strategy for write errors
   */
  async appendTrade(record: TradeRecord): Promise<void> {
    this.ensureInitialized();
    // Define the append operation
    const appendOperation = async () => {
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

      const csvLine = buildCsvLineForSchema(this.currentSchema, toTradeHistoryCsvRecord(record));

      // Append to CSV
      fs.appendFileSync(this.csvPath, csvLine + '\n', 'utf-8');

      this.logger.debug('📝 Trade appended to history', {
        id: record.id,
        netPnl: record.netPnl,
        fields: recordFields.length,
        newFields: newFields.length,
      });
    };

    // Use RETRY strategy for file write operations if ErrorHandler available
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(appendOperation, {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 100,
          backoffMultiplier: 2,
          maxDelayMs: 800,
        },
        context: `TradeHistoryService.appendTrade[${record.id}]`,
        onRetry: (attempt: number, error: unknown, delayMs: number) => {
          this.logger.warn('🔄 Retrying trade append', {
            attempt,
            tradeId: record.id,
            delayMs,
            error: extractErrorMessage(error),
          });
        },
        onFailure: (error: unknown, attempts: number) => {
          this.logger.error('❌ Failed to append trade after retries', {
            id: record.id,
            attempts,
            error: extractErrorMessage(error),
          });
        },
      });

      if (!result.success) {
        throw result.error || new JournalWriteError(`Failed to append trade ${record.id}`, {
          filePath: this.csvPath,
          operation: 'write',
          reason: 'appendTrade operation failed',
          tradeId: record.id,
        });
      }
    } else {
      // Fallback: no ErrorHandler, just try once
      try {
        await appendOperation();
      } catch (error: unknown) {
        this.logger.error('❌ Failed to append trade', {
          error,
          errorMessage: extractErrorMessage(error),
          id: record.id,
        });
        throw error;
      }
    }
  }

  /**
   * Read all trades with dynamic schema with GRACEFUL_DEGRADE strategy
   */
  async readAllTrades(): Promise<TradeRecord[]> {
    this.ensureInitialized();
    const readOperation = async (): Promise<TradeRecord[]> => {
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
    };

    // Use GRACEFUL_DEGRADE strategy for read operations
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(readOperation, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: 'TradeHistoryService.readAllTrades',
        onFailure: (error: unknown, attempts: number) => {
          this.logger.warn('⚠️ Failed to read trades, returning empty list', {
            attempts,
            error: extractErrorMessage(error),
          });
        },
      });

      // Always return value (never throws with GRACEFUL_DEGRADE)
      return result.value || [];
    } else {
      // Fallback: no ErrorHandler, try once
      try {
        return await readOperation();
      } catch (error: unknown) {
        this.logger.error('❌ Failed to read trades', { error, errorMessage: extractErrorMessage(error) });
        return [];
      }
    }
  }

  /**
   * Parse CSV line with dynamic schema
   */
  private parseCSVLine(line: string, header: string[]): TradeRecord | null {
    try {
      const record: TradeHistoryCsvRecord = parseCsvTradeRecordLine(line, header);
      return record as TradeRecord;
    } catch (error: unknown) {
      this.logger.warn('⚠️ Failed to parse CSV line', { line });
      return null;
    }
  }

  /**
   * Get current schema
   */
  getCurrentSchema(): string[] {
    this.ensureInitialized();
    return [...this.currentSchema];
  }

  /**
   * Get total number of trades
   */
  async getTotalTrades(): Promise<number> {
    this.ensureInitialized();
    try {
      const content = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      return Math.max(0, lines.length - 1); // Exclude header
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get statistics from CSV with GRACEFUL_DEGRADE strategy
   */
  async getStatistics(): Promise<TradeHistoryStatistics> {
    this.ensureInitialized();
    const defaultStats = createDefaultTradeStatistics();

    const statsOperation = async () => {
      const trades = await this.readAllTrades();
      return calculateTradeStatistics(trades.map(toTradeHistoryStatsRecord));
    };

    // Use GRACEFUL_DEGRADE strategy for statistics
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(statsOperation, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: 'TradeHistoryService.getStatistics',
        onFailure: (error: unknown, attempts: number) => {
          this.logger.warn('⚠️ Failed to calculate statistics, returning defaults', {
            attempts,
            error: extractErrorMessage(error),
          });
        },
      });

      return result.value || defaultStats;
    } else {
      try {
        return await statsOperation();
      } catch (error: unknown) {
        this.logger.error('❌ Failed to get statistics', { error, errorMessage: extractErrorMessage(error) });
        return defaultStats;
      }
    }
  }

  /**
   * Get statistics grouped by custom field with GRACEFUL_DEGRADE strategy
   */
  async getStatisticsByField(fieldName: string): Promise<{ [key: string]: number }> {
    this.ensureInitialized();
    const statsOperation = async () => {
      const trades = await this.readAllTrades();
      return calculateTradeStatisticsByField(trades.map(toTradeHistoryStatsRecord), fieldName);
    };

    // Use GRACEFUL_DEGRADE strategy for field statistics
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(statsOperation, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: `TradeHistoryService.getStatisticsByField[${fieldName}]`,
        onFailure: (error: unknown, attempts: number) => {
          this.logger.warn('⚠️ Failed to calculate field statistics, returning empty', {
            fieldName,
            attempts,
            error: extractErrorMessage(error),
          });
        },
      });

      return result.value || {};
    } else {
      try {
        return await statsOperation();
      } catch (error: unknown) {
        this.logger.error('❌ Failed to get statistics by field', {
          fieldName,
          error: extractErrorMessage(error),
        });
        return {};
      }
    }
  }
}

