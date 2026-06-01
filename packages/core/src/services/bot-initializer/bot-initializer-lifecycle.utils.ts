import type { IBotInitializerServices, ILifecycle } from '../../interfaces';
import type {
  LifecycleRegistrationSpec,
  LifecycleManager,
  ListenerCleanupTarget,
  ListenerCleanupTargetSpec,
} from '../lifecycle-manager.service';
import {
  createLifecycleRegistrations,
  createListenerCleanupTargets,
} from '../lifecycle-manager.service';

type BotInitializerMonitoringServices = NonNullable<IBotInitializerServices['monitoringServices']>;
type BotInitializerResilienceServices = NonNullable<IBotInitializerServices['resilienceServices']>;

export type BotInitializerListenerCleanupTarget = {
  label: string;
  target: ListenerCleanupTarget;
};

export type BotInitializerLifecycleCollaborators = {
  execution: Pick<
    IBotInitializerServices['executionServices'],
    'orderStateMachine' | 'positionMonitor' | 'tradingOrchestrator'
  >;
  marketData: Pick<
    IBotInitializerServices['marketDataServices'],
    'publicWebSocket' | 'webSocketManager'
  >;
  monitoring: BotInitializerMonitoringServices;
  resilience: BotInitializerResilienceServices;
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

const BOT_INITIALIZER_LIFECYCLE_REGISTRATION_SPECS: LifecycleRegistrationSpec<BotInitializerLifecycleCollaborators>[] = [
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.privateWebSocket,
    label: 'private WebSocket',
    stage: 'websocket',
    selectService: (collaborators) => collaborators.marketData.webSocketManager,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.publicWebSocket,
    label: 'public WebSocket',
    stage: 'websocket',
    selectService: (collaborators) => collaborators.marketData.publicWebSocket,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.positionMonitor,
    label: 'position monitor',
    stage: 'position-monitor',
    selectService: (collaborators) => collaborators.execution.positionMonitor,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.monitoringServer,
    label: 'monitoring server',
    stage: 'monitoring-server',
    selectService: (collaborators) => collaborators.monitoring.monitoringServer,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.metricsService,
    label: 'metrics service',
    stage: 'monitoring',
    selectService: (collaborators) => collaborators.monitoring.metricsService,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.dashboard,
    label: 'dashboard',
    stage: 'monitoring',
    selectService: (collaborators) => collaborators.monitoring.dashboard,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.rateLimiter,
    label: 'rate limiter',
    stage: 'resilience',
    selectService: (collaborators) => collaborators.resilience.rateLimiter,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.retryPolicy,
    label: 'retry policy',
    stage: 'resilience',
    selectService: (collaborators) => collaborators.resilience.retryPolicy,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.bulkhead,
    label: 'bulkhead',
    stage: 'resilience',
    selectService: (collaborators) => collaborators.resilience.bulkhead,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.tradingOrchestrator,
    label: 'trading orchestrator',
    stage: 'execution',
    selectService: (collaborators) => collaborators.execution.tradingOrchestrator,
  },
  {
    id: BOT_INITIALIZER_LIFECYCLE_IDS.orderStateMachine,
    label: 'order state machine',
    stage: 'execution',
    selectService: (collaborators) => collaborators.execution.orderStateMachine,
  },
];

const BOT_INITIALIZER_LISTENER_CLEANUP_SPECS: ListenerCleanupTargetSpec<BotInitializerLifecycleCollaborators>[] = [
  {
    label: 'Position monitor',
    selectTarget: (collaborators) => collaborators.execution.positionMonitor,
  },
  {
    label: 'Private WebSocket',
    selectTarget: (collaborators) => collaborators.marketData.webSocketManager,
  },
  {
    label: 'Public WebSocket',
    selectTarget: (collaborators) => collaborators.marketData.publicWebSocket,
  },
];

type BotInitializerOptionalLifecycleStage = 'monitoring' | 'resilience';

const BOT_INITIALIZER_OPTIONAL_STAGE_SELECTORS: Record<
  BotInitializerOptionalLifecycleStage,
  Array<(collaborators: BotInitializerLifecycleCollaborators) => unknown>
> = {
  monitoring: [
    (collaborators) => collaborators.monitoring.dashboard,
    (collaborators) => collaborators.monitoring.metricsService,
  ],
  resilience: [
    (collaborators) => collaborators.resilience.rateLimiter,
    (collaborators) => collaborators.resilience.retryPolicy,
    (collaborators) => collaborators.resilience.bulkhead,
  ],
};

export function createBotInitializerLifecycleCollaborators(
  services: IBotInitializerServices,
): BotInitializerLifecycleCollaborators {
  return {
    execution: services.executionServices,
    marketData: services.marketDataServices,
    monitoring: (services.monitoringServices ?? {}) as BotInitializerMonitoringServices,
    resilience: (services.resilienceServices ?? {}) as BotInitializerResilienceServices,
  };
}

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
  collaborators: BotInitializerLifecycleCollaborators,
): void {
  lifecycleManager.registerAll(createLifecycleRegistrations(
    collaborators,
    BOT_INITIALIZER_LIFECYCLE_REGISTRATION_SPECS,
    isLifecycleService,
  ));
}

export function getBotInitializerListenerCleanupTargets(
  collaborators: BotInitializerLifecycleCollaborators,
): BotInitializerListenerCleanupTarget[] {
  return createListenerCleanupTargets(
    collaborators,
    BOT_INITIALIZER_LISTENER_CLEANUP_SPECS,
    hasListenerCleanup,
  );
}

export function hasBotInitializerLifecycleStageServices(
  collaborators: BotInitializerLifecycleCollaborators,
  stage: BotInitializerOptionalLifecycleStage,
): boolean {
  return BOT_INITIALIZER_OPTIONAL_STAGE_SELECTORS[stage].some((selectService) => (
    isLifecycleService(selectService(collaborators))
  ));
}

export function getBotInitializerMonitoringServer(
  collaborators: BotInitializerLifecycleCollaborators,
): ILifecycle | null {
  const monitoringServer = collaborators.monitoring.monitoringServer;
  return isLifecycleService(monitoringServer) ? monitoringServer : null;
}
