import { LifecycleManager } from '../../services/lifecycle-manager.service';

describe('LifecycleManager', () => {
  test('starts a named stage in registration order and stops all in reverse order', async () => {
    const calls: string[] = [];
    const manager = new LifecycleManager();

    manager.register({
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
    });
    manager.register({
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
    });
    manager.register({
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
    });

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
});
