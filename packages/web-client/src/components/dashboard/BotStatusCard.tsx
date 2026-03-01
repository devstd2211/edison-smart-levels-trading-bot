/**
 * Bot Status Card Component
 *
 * Displays current bot status and control buttons
 */

import React, { useState } from 'react';
import { useBotStore } from '../../stores/botStore';
import { api } from '../../services/api.service';
import { Play, Square, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export function BotStatusCard() {
  const { isRunning, isLoading, error, setLoading, setRunning, setError } = useBotStore();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setLocalError(null);
    const response = await api.start();
    if (response.success) {
      setRunning(true);
    } else {
      const msg = response.error || 'Failed to start bot';
      setLocalError(msg);
      setError(msg);
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    setLocalError(null);
    const response = await api.stop();
    if (response.success) {
      setRunning(false);
    } else {
      const msg = response.error || 'Failed to stop bot';
      setLocalError(msg);
      setError(msg);
    }
    setLoading(false);
  };

  const displayError = localError || error;

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Bot Status</h2>
          <p className="text-sm text-gray-500">Trading bot control panel</p>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">Running</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
              <Clock className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Stopped</span>
            </div>
          )}
        </div>
      </div>

      {displayError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{displayError}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleStart}
          disabled={isRunning || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Play className="w-4 h-4" />
          <span>Start</span>
        </button>

        <button
          onClick={handleStop}
          disabled={!isRunning || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Square className="w-4 h-4" />
          <span>Stop</span>
        </button>
      </div>

      {isLoading && (
        <div className="mt-3 text-center">
          <p className="text-sm text-gray-500">Processing...</p>
        </div>
      )}
    </div>
  );
}
