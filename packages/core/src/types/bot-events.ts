import type { Position, Signal } from './legacy';

export type BotLifecycleStatusEvent = boolean;

export type PositionOpenedEventPayload =
  | Position
  | {
    position: Position;
    strategyId?: string;
  };

export type PositionClosedEventPayload =
  | Position
  | {
    position?: Position;
    closedPosition?: Position;
    strategyId?: string;
    positionId?: string;
    pnl?: number;
    exitType?: string;
  };

export interface BotRuntimeEventMap {
  signal: Signal;
  'position-opened': PositionOpenedEventPayload;
  'position-closed': PositionClosedEventPayload;
  error: Error;
  'bot-started': BotLifecycleStatusEvent;
  'bot-stopped': BotLifecycleStatusEvent;
}

export type BotRuntimeEventName = keyof BotRuntimeEventMap;

export interface BotRuntimeEventBusLike {
  on<K extends BotRuntimeEventName>(event: K, listener: (data: BotRuntimeEventMap[K]) => void): void;
  on(event: string, listener: (data?: unknown) => void): void;
  off<K extends BotRuntimeEventName>(event: K, listener: (data: BotRuntimeEventMap[K]) => void): void;
  off(event: string, listener: (data?: unknown) => void): void;
  emit<K extends BotRuntimeEventName>(event: K, data: BotRuntimeEventMap[K]): void;
  emit(event: string, data?: unknown): void;
}
