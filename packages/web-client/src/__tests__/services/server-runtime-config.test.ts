import {
  createFallbackServerConfig,
  getServerConfigCandidateApiBaseUrls,
  preloadServerConfig,
  resolveServerConfigApiBaseUrl,
} from '../../services/server-runtime-config';

describe('server-runtime-config', () => {
  beforeEach(() => {
    window.__SERVER_CONFIG__ = undefined;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('resolves the default api base URL from the shared runtime defaults when no origin port is available', () => {
    expect(resolveServerConfigApiBaseUrl()).toBe('http://localhost:4000/api');
  });

  test('builds server config discovery candidates with the legacy compatibility port last', () => {
    expect(getServerConfigCandidateApiBaseUrls()).toEqual([
      'http://localhost:4000/api',
      'http://localhost:4002/api',
    ]);
  });

  test('preloadServerConfig returns the cached runtime config without refetching', async () => {
    window.__SERVER_CONFIG__ = createFallbackServerConfig();

    const response = await preloadServerConfig();

    expect(response.success).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('preloadServerConfig retries the legacy compatibility endpoint after the default runtime port fails', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            api: { port: 4200, url: 'http://localhost:4200' },
            websocket: { port: 4201, url: 'ws://localhost:4201' },
          },
          timestamp: 456,
        }),
      } as Response);

    const response = await preloadServerConfig();

    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://localhost:4000/api/config/server', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://localhost:4002/api/config/server', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response).toEqual({
      success: true,
      data: {
        api: { port: 4200, url: 'http://localhost:4200' },
        websocket: { port: 4201, url: 'ws://localhost:4201' },
      },
      timestamp: 456,
    });
    expect(window.__SERVER_CONFIG__).toEqual({
      api: { port: 4200, url: 'http://localhost:4200' },
      websocket: { port: 4201, url: 'ws://localhost:4201' },
    });
  });
});
