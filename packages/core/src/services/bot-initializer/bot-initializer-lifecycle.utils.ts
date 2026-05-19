import type { IBotInitializerServices, ILifecycle } from '../../interfaces';
import type {
  LifecycleRegistrationSpec,
  LifecycleManager,
  LifecycleStage,
} from '../lifecycle-manager.service';
import { createLifecycleRegistrations } from '../lifecycle-manager.service';

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

const BOT_INITIALIZER_LIFECYCLE_REGISTRATION_SPECS: LifecycleRegistrationSpec<IBotInitializerServices>[] = [
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.privateWebSocket,
    label: 'private WebSocket',
    stage: 'websocket',
    selectService: (services) => services.marketDataServices.webSocketManager,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.publicWebSocket,
    label: 'public WebSocket',
    stage: 'websocket',
    selectService: (services) => services.marketDataServices.publicWebSocket,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.positionMonitor,
    label: 'position monitor',
    stage: 'position-monitor',
    selectService: (services) => services.executionServices.positionMonitor,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.monitoringServer,
    label: 'monitoring server',
    stage: 'monitoring-server',
    selectService: (services) => services.monitoringServices?.monitoringServer,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.metricsService,
    label: 'metrics service',
    stage: 'monitoring',
    selectService: (services) => services.monitoringServices?.metricsService,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.dashboard,
    label: 'dashboard',
    stage: 'monitoring',
    selectService: (services) => services.monitoringServices?.dashboard,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.rateLimiter,
    label: 'rate limiter',
    stage: 'resilience',
    selectService: (services) => services.resilienceServices?.rateLimiter,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.retryPolicy,
    label: 'retry policy',
    stage: 'resilience',
    selectService: (services) => services.resilienceServices?.retryPolicy,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.bulkhead,
    label: 'bulkhead',
    stage: 'resilience',
    selectService: (services) => services.resilienceServices?.bulkhead,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.tradingOrchestrator,
    label: 'trading orchestrator',
    stage: 'execution',
    selectService: (services) => services.executionServices.tradingOrchestrator,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.orderStateMachine,
    label: 'order state machine',
    stage: 'execution',
    selectService: (services) => services.executionServices.orderStateMachine,
  },
];

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
  lifecycleManager.registerAll(createLifecycleRegistrations(
    services,
    BOT_INITIALIZER_LIFECYCLE_REGISTRATION_SPECS,
    isLifecycleService,
  ));
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
