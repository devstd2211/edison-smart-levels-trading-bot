/**
 * API Types and Interfaces
 * Shared between backend and frontend
 */

import type {
  ApiResponse,
  BotStatus,
  ErrorPayload,
  Position,
  PositionClosedPayload,
  PositionOpenedPayload,
  Signal,
  SignalGeneratedPayload,
  WebSocketMessage,
  WebSocketRequestMessage,
  WebSocketRequestPayloadMap,
  WebSocketRequestType,
  WebSocketPayloadMap,
} from '@edison/contracts';
import type { WebApiJournalEntry, WebApiSessionStats } from '@edison/contracts';

export type {
  ApiResponse,
  BotStatus,
  ErrorPayload,
  Position,
  PositionClosedPayload,
  PositionOpenedPayload,
  Signal,
  SignalGeneratedPayload,
  WebSocketMessage,
  WebSocketRequestMessage,
  WebSocketRequestPayloadMap,
  WebSocketRequestType,
  WebSocketPayloadMap,
};

export type TradeRecord = WebApiJournalEntry;
export type SessionStats = WebApiSessionStats;

export type WebSocketEventType = keyof WebSocketPayloadMap;
