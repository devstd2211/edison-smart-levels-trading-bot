import {
  bootstrapServerConfig,
  createFallbackServerConfig,
  createWebSocketUrl,
  getSameOriginServerConfigApiBaseUrl,
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

  test('resolves the default api base URL from the shared runtime defaults when no browser origin is available', () => {
    expect(resolveServerConfigApiBaseUrl(undefined, {
      hostname: '',
      origin: 'null',
      protocol: 'file:',
    })).toBe('http://localhost:4000/api');
  });

  test('prefers the same-origin api base URL even when the browser origin uses an implicit default port', () => {
    const browserLocation = {
      hostname: 'edison.dev',
      origin: 'https://edison.dev',
      protocol: 'https:',
    } as const;

    expect(getSameOriginServerConfigApiBaseUrl(browserLocation)).toBe('https://edison.dev/api');
    expect(resolveServerConfigApiBaseUrl(undefined, browserLocation)).toBe('https://edison.dev/api');
  });

  test('builds server config discovery candidates with the legacy compatibility port last', () => {
    expect(getServerConfigCandidateApiBaseUrls(undefined, {
      hostname: 'edison.dev',
      origin: 'https://edison.dev',
      protocol: 'https:',
    })).toEqual([
      'https://edison.dev/api',
      'http://edison.dev:4000/api',
      'http://edison.dev:4002/api',
    ]);
  });

  test('builds protocol-aware fallback websocket URLs for secure browser pages', () => {
    expect(createWebSocketUrl('edison.dev', 4001, {
      hostname: 'edison.dev',
      origin: 'https://edison.dev',
      protocol: 'https:',
    })).toBe('wss://edison.dev:4001');
    expect(createFallbackServerConfig(undefined, {
      hostname: 'edison.dev',
      origin: 'https://edison.dev',
      protocol: 'https:',
    })).toEqual({
      api: { port: 4000, url: 'http://edison.dev:4000' },
      websocket: { port: 4001, url: 'wss://edison.dev:4001' },
    });
  });

  test('keeps the default runtime port first when same-origin discovery is unavailable', () => {
    expect(getServerConfigCandidateApiBaseUrls(undefined, {
      hostname: '',
      origin: 'null',
      protocol: 'file:',
    })).toEqual([
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

  test('preloadServerConfig retries the default and legacy compatibility endpoints after same-origin discovery fails', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
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

    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://localhost/api/config/server', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://localhost:4000/api/config/server', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(3, 'http://localhost:4002/api/config/server', {
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

  test('bootstrapServerConfig caches fallback endpoints when preload fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(bootstrapServerConfig()).resolves.toEqual({
      config: {
        api: { port: 4000, url: 'http://localhost:4000' },
        websocket: { port: 4001, url: 'ws://localhost:4001' },
      },
      source: 'fallback',
      error: 'offline',
    });
    expect(window.__SERVER_CONFIG__).toEqual({
      api: { port: 4000, url: 'http://localhost:4000' },
      websocket: { port: 4001, url: 'ws://localhost:4001' },
    });
  });
});
