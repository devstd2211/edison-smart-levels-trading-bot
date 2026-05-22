/**
 * File Watcher Service
 *
 * Monitors journal and session files for changes and notifies WebSocket clients
 */

import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  JournalPagePayload,
  JournalStatsPayload,
  SessionComparisonPayload,
  StrategyPerformancePayload,
} from '@edison/contracts/runtime-api';
import type {
  WebApiJournalEntry,
  WebApiSessionStats,
} from '@edison/contracts/web-api';

export type JournalEntry = WebApiJournalEntry;
export type SessionStats = WebApiSessionStats;

export const DEFAULT_JOURNAL_PATH = './data/trade-journal.json';
export const DEFAULT_SESSIONS_PATH = './data/session-stats.json';
export const DEFAULT_FILE_WATCHER_DEBOUNCE_DELAY_MS = 500;

export type FileWatcherAnalyticsReadApi = {
  getJournalPaginated(page?: number, limit?: number): Promise<JournalPagePayload>;
  getJournalFromLastHours(hours?: number): Promise<JournalEntry[]>;
  getJournalStats(): Promise<JournalStatsPayload>;
  readSessions(): Promise<SessionStats[]>;
  compareSessions(sessionId1: string, sessionId2: string): Promise<SessionComparisonPayload>;
  getStrategyPerformance(): Promise<StrategyPerformancePayload[]>;
  readJournal(): Promise<JournalEntry[]>;
};

export function createFileWatcherAnalyticsReadApi(
  readApi: FileWatcherAnalyticsReadApi,
): FileWatcherAnalyticsReadApi {
  return {
    getJournalPaginated: (page, limit) => readApi.getJournalPaginated(page, limit),
    getJournalFromLastHours: (hours) => readApi.getJournalFromLastHours(hours),
    getJournalStats: () => readApi.getJournalStats(),
    readSessions: () => readApi.readSessions(),
    compareSessions: (id1, id2) => readApi.compareSessions(id1, id2),
    getStrategyPerformance: () => readApi.getStrategyPerformance(),
    readJournal: () => readApi.readJournal(),
  };
}

export class FileWatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private journalPath: string;
  private sessionsPath: string;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceDelay = DEFAULT_FILE_WATCHER_DEBOUNCE_DELAY_MS;

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private getErrorCode(error: unknown): string | undefined {
    if (!this.isRecord(error)) {
      return undefined;
    }
    const code = error.code;
    return typeof code === 'string' ? code : undefined;
  }

  constructor(
    journalPath: string = DEFAULT_JOURNAL_PATH,
    sessionsPath: string = DEFAULT_SESSIONS_PATH,
  ) {
    super();
    this.journalPath = journalPath;
    this.sessionsPath = sessionsPath;
  }

  private readJsonArrayFile<TItem>(
    filePath: string,
    invalidShapeMessage: string,
    selectArray?: (value: unknown) => unknown,
  ): Promise<TItem[]> {
    return fs.readFile(filePath, 'utf-8')
      .then((data) => {
        const parsed = JSON.parse(data) as unknown;
        const selectedValue = selectArray ? selectArray(parsed) : parsed;

        if (!Array.isArray(selectedValue)) {
          throw new Error(invalidShapeMessage);
        }

        return selectedValue as TItem[];
      })
      .catch((error: unknown) => {
        if (this.getErrorCode(error) === 'ENOENT') {
          return [];
        }

        throw error;
      });
  }

  /**
   * Start watching for file changes
   */
  start() {
    try {
      this.watcher = watch([this.journalPath, this.sessionsPath], {
        ignored: /(^|[\/\\])\../, // Ignore dotfiles
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100,
        },
      });

      this.watcher.on('change', (filePath) => {
        this.handleFileChange(filePath);
      });

      this.watcher.on('error', (error) => {
        console.error('File watcher error:', error);
        this.emit('error', error);
      });

      this.emit('ready');
      console.log('File watcher started');
    } catch (error) {
      console.error('Failed to start file watcher:', error);
      this.emit('error', error);
    }
  }

  /**
   * Stop watching for file changes
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    console.log('File watcher stopped');
  }

  /**
   * Handle file change with debounce
   */
  private handleFileChange(filePath: string) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        if (filePath.includes('trade-journal')) {
          await this.handleJournalChange();
        } else if (filePath.includes('session-stats')) {
          await this.handleSessionChange();
        }
      } catch (error) {
        console.error('Error handling file change:', error);
        this.emit('error', error);
      }
    }, this.debounceDelay);
  }

  /**
   * Handle trade journal file change
   */
  private async handleJournalChange() {
    try {
      const journal = await this.readJournal();
      this.emit('journal:updated', journal);
      console.log(`Journal updated: ${journal.length} trades`);
    } catch (error) {
      console.error('Error reading journal:', error);
    }
  }

  /**
   * Handle session stats file change
   */
  private async handleSessionChange() {
    try {
      const sessions = await this.readSessions();
      this.emit('session:updated', sessions);
      console.log(`Sessions updated: ${sessions?.length ?? 0} sessions`);
    } catch (error) {
      console.error('Error reading sessions:', error);
    }
  }

  /**
   * Read trade journal from file
   */
  async readJournal(): Promise<JournalEntry[]> {
    return this.readJsonArrayFile<JournalEntry>(
      this.journalPath,
      'Trade journal file must contain an array of journal entries',
    );
  }

  /**
   * Read sessions from file
   */
  async readSessions(): Promise<SessionStats[]> {
    return this.readJsonArrayFile<SessionStats>(
      this.sessionsPath,
      'Session stats file must contain an array or an object with a sessions array',
      (parsed) => {
        if (Array.isArray(parsed)) {
          return parsed;
        }

        if (this.isRecord(parsed)) {
          return parsed.sessions;
        }

        return parsed;
      },
    );
  }

  /**
   * Get paginated journal entries
   */
  async getJournalPaginated(page: number = 1, limit: number = 50): Promise<JournalPagePayload> {
    const journal = await this.readJournal();
    const total = journal.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      entries: journal.slice(start, end),
      total,
      page,
      pages,
    };
  }

  /**
   * Get journal entries from last N hours
   */
  async getJournalFromLastHours(hours: number = 24): Promise<JournalEntry[]> {
    const journal = await this.readJournal();
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

    return journal.filter((entry) => entry.timestamp > cutoffTime);
  }

  /**
   * Calculate journal statistics
   */
  async getJournalStats(): Promise<JournalStatsPayload> {
    const journal = await this.readJournal();

    if (journal.length === 0) {
      return {
        totalTrades: 0,
        totalPnL: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        winLossRatio: 0,
        longWinRate: 0,
        shortWinRate: 0,
      };
    }

    const wins = journal.filter((e) => e.pnl > 0);
    const losses = journal.filter((e) => e.pnl < 0);
    const longs = journal.filter((e) => e.direction === 'LONG');
    const longWins = longs.filter((e) => e.pnl > 0);
    const shorts = journal.filter((e) => e.direction === 'SHORT');
    const shortWins = shorts.filter((e) => e.pnl > 0);

    const totalPnL = journal.reduce((sum, e) => sum + e.pnl, 0);
    const avgWin = wins.length > 0 ? wins.reduce((sum, e) => sum + e.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, e) => sum + e.pnl, 0) / losses.length : 0;

    return {
      totalTrades: journal.length,
      totalPnL,
      winRate: (wins.length / journal.length) * 100,
      avgWin,
      avgLoss: Math.abs(avgLoss),
      winLossRatio: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
      longWinRate: longs.length > 0 ? (longWins.length / longs.length) * 100 : 0,
      shortWinRate: shorts.length > 0 ? (shortWins.length / shorts.length) * 100 : 0,
    };
  }

  /**
   * Get strategy performance breakdown
   */
  async getStrategyPerformance(): Promise<StrategyPerformancePayload[]> {
    const journal = await this.readJournal();
    const strategies = new Map<
      string,
      {
        trades: number;
        wins: number;
        totalPnL: number;
      }
    >();

    journal.forEach((entry) => {
      const strategy = entry.strategy || 'Unknown';
      const existing = strategies.get(strategy) || { trades: 0, wins: 0, totalPnL: 0 };

      strategies.set(strategy, {
        trades: existing.trades + 1,
        wins: existing.wins + (entry.pnl > 0 ? 1 : 0),
        totalPnL: existing.totalPnL + entry.pnl,
      });
    });

    return Array.from(strategies.entries()).map(([strategy, stats]) => ({
      strategy,
      trades: stats.trades,
      winRate: (stats.wins / stats.trades) * 100,
      totalPnL: stats.totalPnL,
      avgPnL: stats.totalPnL / stats.trades,
      wins: stats.wins,
      losses: stats.trades - stats.wins,
    }));
  }

  /**
   * Compare two sessions
   */
  async compareSessions(
    sessionId1: string,
    sessionId2: string,
  ): Promise<SessionComparisonPayload> {
    const sessions = await this.readSessions();
    const session1 = sessions.find((s) => s.sessionId === sessionId1);
    const session2 = sessions.find((s) => s.sessionId === sessionId2);

    return {
      session1: session1 || null,
      session2: session2 || null,
      comparison: {
        tradesDiff: (session2?.totalTrades || 0) - (session1?.totalTrades || 0),
        pnlDiff: (session2?.totalPnL || 0) - (session1?.totalPnL || 0),
        winRateDiff: (session2?.winRate || 0) - (session1?.winRate || 0),
      },
    };
  }

  async comparesessions(
    sessionId1: string,
    sessionId2: string,
  ): Promise<SessionComparisonPayload> {
    return this.compareSessions(sessionId1, sessionId2);
  }
}
