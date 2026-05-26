import { EventEmitter } from 'events';
import type { IWebApiAdapter } from '@edison/contracts/web-api';
import * as webEntrypointModule from '../../web';
import { createWebServerRuntime } from '../../web';
import { WEB_ENTRYPOINT_EXPORT_NAMES } from '../../web';
import { startWebServerRuntime } from '../../web/web-entrypoint-runtime';
import {
  createManagedTrackedServicesRuntimeFactory,
  type TrackedServicesRuntimeFactory,
} from '../helpers/service-lifecycle-test.utils';

const mockWebServer = jest.fn();
const mockWebServerStart = jest.fn();

class WebServerMock {
  close = jest.fn();
  start = mockWebServerStart;

  constructor(...args: unknown[]) {
    mockWebServer(...args);
  }
}

describe('web entrypoint runtime factory adoption', () => {
  let createRuntimeFactoryHarness!: TrackedServicesRuntimeFactory['createRuntimeFactoryHarness'];
  let cleanup!: TrackedServicesRuntimeFactory['cleanup'];

  beforeEach(() => {
    ({
      createRuntimeFactoryHarness,
      cleanup,
    } = createManagedTrackedServicesRuntimeFactory());
    mockWebServer.mockReset();
    mockWebServerStart.mockReset();
    mockWebServerStart.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  test('keeps the web entrypoint export surface focused on explicit runtime handoff helpers', () => {
    expect(Object.keys(webEntrypointModule).sort()).toEqual(
      [...WEB_ENTRYPOINT_EXPORT_NAMES].sort(),
    );
    expect([...WEB_ENTRYPOINT_EXPORT_NAMES]).toEqual([
      'WEB_ENTRYPOINT_EXPORT_NAMES',
      'createWebServerBotInstance',
      'createWebServerRuntime',
      'startWebServer',
    ]);
  });

  test('startWebServer uses the explicit runtime adapter without reaching back into bot internals', async () => {
    const { runtime } = createRuntimeFactoryHarness();
    const getWebApiAdapterSpy = jest.spyOn(runtime.bot, 'getWebApiAdapter');

    const webRuntime = createWebServerRuntime(runtime.bot, runtime.webApiAdapter);

    await startWebServerRuntime(webRuntime, {
      apiPort: 4200,
      wsPort: 4201,
    }, WebServerMock);

    expect(getWebApiAdapterSpy).not.toHaveBeenCalled();
    expect(mockWebServer).toHaveBeenCalledTimes(1);
    expect(mockWebServer.mock.calls[0][0]).toBe(webRuntime.botAdapter);
    expect(mockWebServerStart).toHaveBeenCalledTimes(1);
  });

  test('createWebServerRuntime keeps the web-server bot adapter and web adapter as an explicit pair', () => {
    const webApiAdapter: jest.Mocked<IWebApiAdapter> = {
      getMarketData: jest.fn(),
      getCandles: jest.fn(),
      getPositionHistory: jest.fn(),
      getOrderBook: jest.fn(),
      getWalls: jest.fn(),
      getFundingRate: jest.fn(),
      getVolumeProfile: jest.fn(),
    };
    const bot = {
      eventBus: new EventEmitter(),
      isRunning: false,
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      getStatus: jest.fn().mockReturnValue({
        isRunning: false,
        hasPosition: false,
        position: null,
      }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };

    const runtime = createWebServerRuntime(bot, webApiAdapter);

    expect(runtime.botAdapter).toBeDefined();
    expect(runtime.webApiAdapter).toBe(webApiAdapter);
  });
});
