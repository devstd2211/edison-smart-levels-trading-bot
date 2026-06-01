import {
  createMockWebSocketEventPosition,
  createWebSocketEventHandler,
} from './websocket-event-handler-test.utils';

describe('websocket event handler test utils', () => {
  test('creates a usable websocket handler without explicit overrides', async () => {
    const handler = createWebSocketEventHandler();

    await expect(
      handler.handlePositionUpdate(createMockWebSocketEventPosition()),
    ).resolves.toBeUndefined();
  });
});
