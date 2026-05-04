import type { IBotInitializerServices, ILifecycle } from '../../interfaces';
import type { LifecycleManager } from '../lifecycle-manager.service';

type ListenerCleanupTarget = {
  removeAllListeners(): void;
};

export type BotInitializerListenerCleanupTarget = {
  label: string;
  target: ListenerCleanupTarget;
};

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
  const register = (value: unknown): void => {
    if (isLifecycleService(value)) {
      lifecycleManager.register(value);
    }
  };

  register(services.marketDataServices.webSocketManager);
  register(services.marketDataServices.publicWebSocket);
  register(services.executionServices.positionMonitor);
  register(services.monitoringServices?.monitoringServer);
  register(services.monitoringServices?.metricsService);
  register(services.monitoringServices?.dashboard);
  register(services.resilienceServices?.rateLimiter);
  register(services.resilienceServices?.retryPolicy);
  register(services.resilienceServices?.bulkhead);
  register(services.executionServices.tradingOrchestrator);
  register(services.executionServices.orderStateMachine);
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
