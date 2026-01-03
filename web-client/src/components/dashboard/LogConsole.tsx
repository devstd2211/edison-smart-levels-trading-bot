/**
 * Log Console Component
 *
 * Displays real-time event log with position entries, exits, and signals
 * Minimalist terminal-style display with syntax highlighting
 */

import React, { useEffect, useState } from 'react';
import { Terminal, X } from 'lucide-react';
import { wsClient } from '../../services/websocket.service';

interface LogEntry {
  time: number;
  level: 'INFO' | 'ERROR' | 'WARN' | 'SUCCESS';
  message: string;
  source?: string;
}

export function LogConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [maxLogs, setMaxLogs] = useState(20);

  useEffect(() => {
    const addLog = (level: LogEntry['level'], message: string, source?: string) => {
      setLogs((prev) => [
        { time: Date.now(), level, message, source },
        ...prev.slice(0, maxLogs - 1),
      ]);
    };

    // Listen for position events
    wsClient.on('POSITION_OPENED', (data: any) => {
      const side = data.position?.side || 'UNKNOWN';
      const price = data.position?.entryPrice || 0;
      const strategy = data.signal?.strategy || 'Unknown Strategy';
      const reason = data.signal?.reasoning || data.signal?.entryConditions || 'No reason provided';

      addLog(
        'SUCCESS',
        `POSITION OPENED [${side}] @ ${price.toFixed(4)} - ${strategy} - ${reason}`,
        'POSITION'
      );
    });

    wsClient.on('POSITION_CLOSED', (data: any) => {
      const pnl = data.pnl || 0;
      const exitType = data.exitType || 'UNKNOWN';
      const level = pnl >= 0 ? 'SUCCESS' : 'WARN';
      const sign = pnl >= 0 ? '+' : '';

      addLog(
        level,
        `POSITION CLOSED [${exitType}] ${sign}${pnl.toFixed(2)} USDT (${pnl >= 0 ? 'PROFIT' : 'LOSS'})`,
        'POSITION'
      );
    });

    wsClient.on('SIGNAL_GENERATED', (data: any) => {
      const strategy = data.strategy || 'Unknown';
      const direction = data.direction || 'UNKNOWN';
      const confidence = data.confidence || 0;

      addLog(
        'INFO',
        `SIGNAL DETECTED [${strategy}] ${direction} @ ${confidence.toFixed(1)}% confidence`,
        'SIGNAL'
      );
    });

    wsClient.on('ERROR', (data: any) => {
      const error = data.error || 'Unknown error';
      addLog('ERROR', `ERROR: ${error}`, 'SYSTEM');
    });

    wsClient.on('BOT_STATUS_CHANGE', (data: any) => {
      const status = data.isRunning ? 'STARTED' : 'STOPPED';
      addLog('INFO', `BOT ${status}`, 'BOT');
    });

    return () => {
      wsClient.off('POSITION_OPENED', () => {});
      wsClient.off('POSITION_CLOSED', () => {});
      wsClient.off('SIGNAL_GENERATED', () => {});
      wsClient.off('ERROR', () => {});
      wsClient.off('BOT_STATUS_CHANGE', () => {});
    };
  }, [maxLogs]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogColor = (level: LogEntry['level']): string => {
    switch (level) {
      case 'SUCCESS':
        return '#22c55e'; // green-500
      case 'ERROR':
        return '#ef4444'; // red-500
      case 'WARN':
        return '#f59e0b'; // amber-500
      case 'INFO':
      default:
        return '#10b981'; // emerald-500
    }
  };

  const getLogBgColor = (level: LogEntry['level']): string => {
    switch (level) {
      case 'SUCCESS':
        return 'rgba(34, 197, 94, 0.1)';
      case 'ERROR':
        return 'rgba(239, 68, 68, 0.1)';
      case 'WARN':
        return 'rgba(245, 158, 11, 0.1)';
      case 'INFO':
      default:
        return 'rgba(16, 185, 129, 0.1)';
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow border border-gray-800 overflow-hidden flex flex-col h-96">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium text-green-500">LIVE LOG</span>
          <span className="text-xs text-gray-600 ml-2">({logs.length} events)</span>
        </div>
        <button
          onClick={clearLogs}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          title="Clear logs"
        >
          <X className="w-4 h-4 text-gray-600 hover:text-gray-400" />
        </button>
      </div>

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 p-4">
            <p className="text-center">Waiting for bot events...</p>
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              className="px-4 py-2 border-b border-gray-800 transition-colors hover:bg-gray-800/50"
              style={{ backgroundColor: getLogBgColor(log.level) }}
            >
              <div className="flex gap-2">
                {/* Timestamp */}
                <span className="text-gray-600 flex-shrink-0">[{formatTime(log.time)}]</span>

                {/* Source Badge */}
                {log.source && (
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0"
                    style={{
                      backgroundColor: `${getLogColor(log.level)}20`,
                      color: getLogColor(log.level),
                    }}
                  >
                    {log.source}
                  </span>
                )}

                {/* Message */}
                <span
                  className="flex-1 break-words"
                  style={{ color: getLogColor(log.level) }}
                >
                  {log.message}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-950 border-t border-gray-800 text-xs text-gray-600 flex items-center justify-between">
        <span>Events shown: {Math.min(logs.length, maxLogs)}</span>
        <span className="animate-pulse">● Connected</span>
      </div>
    </div>
  );
}
