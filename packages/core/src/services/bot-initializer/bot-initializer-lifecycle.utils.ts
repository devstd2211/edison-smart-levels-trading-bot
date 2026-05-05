import type { IBotInitializerServices, ILifecycle } from '../../interfaces';
import type { LifecycleManager } from '../lifecycle-manager.service';

type ListenerCleanupTarget = {
  removeAllListeners(): void;
};

export type BotInitializerListenerCleanupTarget = {
  label: string;
  target: ListenerCleanupTarget;
};

export const BOT_INITIALIZER_LIFECYCLE_IDS = {
  bulkhead: 'bulkhead',
  dashboard: 'dashboard',
  metricsService: 'metrics-service',
  monitoringServer: 'monitoring-server',
  orderStateMachine: 'order-state-machine',
  positionMonitor: 'position-monitor',
  privateWebSocket: 'private-websocket',
  publicWebSocket: 'public-websocket',
  rateLimiter: 'rate-limiter',
  retryPolicy: 'retry-policy',
  tradingOrchestrator: 'trading-orchestrator',
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function isLifecycleService(value: unknown): value is ILifecycle {
  const candidate = asRecord(value);
  if (!candidate) {
    return false;
  }

  return typeof candidate.start === 'function' && typeof candidate.stop === 'function';
}

function hasListenerCleanup(value: unknown): value is ListenerCleanupTarget {
  const candidate = asRecord(value);
  return candidate !== null && typeof candidate.removeAllListeners === 'function';
}

export function registerBotInitializerLifecycleServices(
  lifecycleManager: LifecycleManager,
  services: IBotInitializerServices,
): void {
  const register = (
    value: unknown,
    id: string,
    label: string,
    stage: 'execution' | 'monitoring' | 'monitoring-server' | 'position-monitor' | 'resilience' | 'websocket',
  ): void => {
    if (isLifecycleService(value)) {
      lifecycleManager.register({
        id,
        label,
        service: value,
        stage,
      });
    }
  };

  register(
    services.marketDataServices.webSocketManager,
    BOT_INITIALIZER_LIFECYCLE_IDS.privateWebSocket,
    'private WebSocket',
    'websocket',
  );
  register(
    services.marketDataServices.publicWebSocket,
    BOT_INITIALIZER_LIFECYCLE_IDS.publicWebSocket,
    'public WebSocket',
    'websocket',
  );
  register(
    services.executionServices.positionMonitor,
    BOT_INITIALIZER_LIFECYCLE_IDS.positionMonitor,
    'position monitor',
    'position-monitor',
  );
  register(
    services.monitoringServices?.monitoringServer,
    BOT_INITIALIZER_LIFECYCLE_IDS.monitoringServer,
    'monitoring server',
    'monitoring-server',
  );
  register(
    services.monitoringServices?.metricsService,
    BOT_INITIALIZER_LIFECYCLE_IDS.metricsService,
    'metrics service',
    'monitoring',
  );
  register(
    services.monitoringServices?.dashboard,
    BOT_INITIALIZER_LIFECYCLE_IDS.dashboard,
    'dashboard',
    'monitoring',
  );
  register(
    services.resilienceServices?.rateLimiter,
    BOT_INITIALIZER_LIFECYCLE_IDS.rateLimiter,
    'rate limiter',
    'resilience',
  );
  register(
    services.resilienceServices?.retryPolicy,
    BOT_INITIALIZER_LIFECYCLE_IDS.retryPolicy,
    'retry policy',
    'resilience',
  );
  register(
    services.resilienceServices?.bulkhead,
    BOT_INITIALIZER_LIFECYCLE_IDS.bulkhead,
    'bulkhead',
    'resilience',
  );
  register(
    services.executionServices.tradingOrchestrator,
    BOT_INITIALIZER_LIFECYCLE_IDS.tradingOrchestrator,
    'trading orchestrator',
    'execution',
  );
  register(
    services.executionServices.orderStateMachine,
    BOT_INITIALIZER_LIFECYCLE_IDS.orderStateMachine,
    'order state machine',
    'execution',
  );
}

export function getBotInitializerListenerCleanupTargets(
  services: IBotInitializerServices,
): BotInitializerListenerCleanupTarget[] {
  const candidates: Array<BotInitializerListenerCleanupTarget | null> = [
    hasListenerCleanup(services.executionServices.positionMonitor)
      ? { label: 'Position monitor', target: services.executionServices.positionMonitor }
      : null,
    hasListenerCleanup(services.marketDataServices.webSocketManager)
      ? { label: 'Private WebSocket', target: services.marketDataServices.webSocketManager }
      : null,
    hasListenerCleanup(services.marketDataServices.publicWebSocket)
      ? { label: 'Public WebSocket', target: services.marketDataServices.publicWebSocket }
      : null,
  ];

  return candidates.filter((candidate): candidate is BotInitializerListenerCleanupTarget => candidate !== null);
}
