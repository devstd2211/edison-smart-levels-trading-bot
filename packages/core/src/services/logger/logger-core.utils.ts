import { LogEntry, LogLevel } from '../../types/legacy';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && Object.values(LogLevel).includes(value as LogLevel);
}

export function validateLogLevel(level: unknown): void {
  const validLevels = Object.values(LogLevel);
  if (isLogLevel(level)) {
    return;
  }

  if (typeof level === 'string') {
    const upperLevel = level.toUpperCase();
    if (isLogLevel(upperLevel)) {
      return;
    }
  }

  throw new Error(`Invalid log level: ${level}. Must be one of: ${validLevels.join(', ')}`);
}

export function normalizeLogLevel(level: LogLevel | string): LogLevel {
  return isLogLevel(level) ? level : level.toUpperCase() as LogLevel;
}

export function shouldLogLevel(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

export function getTodayString(): string {
  const today = new Date().toISOString().split('T')[0];
  if (!today) {
    throw new Error('Failed to get date string');
  }
  return today;
}

export function formatLogEntry(entry: LogEntry): string {
  const timestamp = new Date(entry.timestamp).toISOString();
  const contextStr = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
  return `[${timestamp}] [${entry.level}] ${entry.message}${contextStr}`;
}
