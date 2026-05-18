import {
  buildRuntimeBootstrapStatus,
  loadControlRuntimeBootstrap,
} from '../../services/control-config-bootstrap';

jest.mock('../../services/api.service', () => ({
  configApi: {
    getServerConfig: jest.fn(),
  },
}));

const { configApi } = jest.requireMock('../../services/api.service') as {
  configApi: {
    getServerConfig: jest.Mock;
  };
};

describe('control-config-bootstrap runtime bootstrap status', () => {
  beforeEach(() => {
    window.__SERVER_CONFIG__ = undefined;
    jest.clearAllMocks();
  });

  test('reuses the cached runtime config without refetching and exposes cached bootstrap status', async () => {
    window.__SERVER_CONFIG__ = {
      api: { port: 4200, url: 'http://localhost:4200' },
      websocket: { port: 4201, url: 'ws://localhost:4201' },
    };

    await expect(loadControlRuntimeBootstrap()).resolves.toEqual({
      runtime: {
        api: { port: 4200, url: 'http://localhost:4200' },
        websocket: { port: 4201, url: 'ws://localhost:4201' },
      },
      runtimeStatus: {
        source: 'cached',
        tone: 'info',
        title: 'Using cached runtime endpoints',
        description: 'The control panel reused runtime endpoints cached earlier in this browser session.',
      },
    });
    expect(configApi.getServerConfig).not.toHaveBeenCalled();
  });

  test('falls back to protocol-aware runtime defaults when discovery fails', async () => {
    configApi.getServerConfig.mockResolvedValue({
      success: false,
      error: 'offline',
      timestamp: 123,
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        hostname: 'edison.dev',
        origin: 'https://edison.dev',
        protocol: 'https:',
      },
    });

    const result = await loadControlRuntimeBootstrap();

    expect(result.runtime).toEqual({
      api: { port: 4000, url: 'http://edison.dev:4000' },
      websocket: { port: 4001, url: 'wss://edison.dev:4001' },
    });
    expect(result.runtimeStatus).toEqual({
      source: 'fallback',
      tone: 'warning',
      title: 'Using fallback runtime endpoints',
      description: 'Runtime discovery failed (offline). The control panel fell back to protocol-aware browser defaults.',
    });
  });

  test('builds a discovered status message for server-loaded runtime endpoints', () => {
    expect(buildRuntimeBootstrapStatus('discovered')).toEqual({
      source: 'discovered',
      tone: 'success',
      title: 'Loaded runtime endpoints from the server',
      description: 'The control panel refreshed runtime endpoints from `/api/config/server`.',
    });
  });
});
