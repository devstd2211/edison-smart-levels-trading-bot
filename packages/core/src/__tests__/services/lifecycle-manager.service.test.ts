import {
  cleanupListenerTargets,
  createListenerCleanupTargets,
  createLifecycleRegistrations,
  LifecycleManager,
} from '../../services/lifecycle-manager.service';

describe('LifecycleManager', () => {
  test('starts a named stage in registration order and stops all in reverse order', async () => {
    const calls: string[] = [];
    const manager = new LifecycleManager();

    manager.registerAll([
      {
        id: 'private-websocket',
        label: 'private WebSocket',
        service: {
          start: async () => {
            calls.push('private.start');
          },
          stop: async () => {
            calls.push('private.stop');
          },
        },
        stage: 'websocket',
      },
      {
        id: 'public-websocket',
        label: 'public WebSocket',
        service: {
          start: async () => {
            calls.push('public.start');
          },
          stop: async () => {
            calls.push('public.stop');
          },
        },
        stage: 'websocket',
      },
      {
        id: 'position-monitor',
        label: 'position monitor',
        service: {
          start: async () => {
            calls.push('monitor.start');
          },
          stop: async () => {
            calls.push('monitor.stop');
          },
        },
        stage: 'position-monitor',
      },
    ]);

    await manager.startStage('websocket');
    await manager.startService('position-monitor');
    await manager.stopAll();

    expect(calls).toEqual([
      'private.start',
      'public.start',
      'monitor.start',
      'monitor.stop',
      'public.stop',
      'private.stop',
    ]);
  });

  test('propagates start and stop failures only when throwOnError is enabled', async () => {
    const manager = new LifecycleManager();
    const failure = new Error('boom');

    manager.registerAll([{
      id: 'fragile',
      label: 'fragile service',
      service: {
        start: async () => {
          throw failure;
        },
        stop: async () => {
          throw failure;
        },
      },
      stage: 'execution',
    }]);

    await expect(manager.startService('fragile')).resolves.toBeUndefined();
    await expect(manager.stopAll()).resolves.toBeUndefined();
    await expect(manager.startService('fragile', { throwOnError: true })).rejects.toThrow('boom');
    await expect(manager.stopAll({ throwOnError: true })).rejects.toThrow('boom');
  });

  test('materializes lifecycle registrations from descriptor specs without widening non-lifecycle values', () => {
    const websocket = { start: jest.fn(), stop: jest.fn() };
    const registrations = createLifecycleRegistrations(
      {
        websocket,
        note: 'not-a-service',
      },
      [
        {
          id: 'websocket',
          label: 'websocket',
          stage: 'websocket',
          selectService: (source) => source.websocket,
        },
        {
          id: 'note',
          label: 'note',
          stage: 'monitoring',
          selectService: (source) => source.note,
        },
      ],
      (value): value is typeof websocket =>
        typeof value === 'object'
        && value !== null
        && typeof (value as { start?: unknown }).start === 'function'
        && typeof (value as { stop?: unknown }).stop === 'function',
    );

    expect(registrations).toEqual([
      {
        id: 'websocket',
        label: 'websocket',
        service: websocket,
        stage: 'websocket',
      },
    ]);
  });

  test('materializes listener cleanup targets from descriptor specs without widening non-listener values', () => {
    const websocket = { removeAllListeners: jest.fn() };
    const cleanupTargets = createListenerCleanupTargets(
      {
        websocket,
        note: 'not-a-listener',
      },
      [
        {
          label: 'websocket',
          selectTarget: (source) => source.websocket,
        },
        {
          label: 'note',
          selectTarget: (source) => source.note,
        },
      ],
      (value): value is typeof websocket =>
        typeof value === 'object'
        && value !== null
        && typeof (value as { removeAllListeners?: unknown }).removeAllListeners === 'function',
    );

    expect(cleanupTargets).toEqual([
      {
        label: 'websocket',
        target: websocket,
      },
    ]);
  });

  test('cleans up listener targets in registration order and preserves labels for follow-up logging', () => {
    const calls: string[] = [];
    const cleanupTargets = [
      {
        label: 'private websocket',
        target: {
          removeAllListeners: () => {
            calls.push('private');
          },
        },
      },
      {
        label: 'public websocket',
        target: {
          removeAllListeners: () => {
            calls.push('public');
          },
        },
      },
    ];
    const labels: string[] = [];

    cleanupListenerTargets(cleanupTargets, (cleanupTarget) => {
      labels.push(cleanupTarget.label);
    });

    expect(calls).toEqual(['private', 'public']);
    expect(labels).toEqual(['private websocket', 'public websocket']);
  });
});
