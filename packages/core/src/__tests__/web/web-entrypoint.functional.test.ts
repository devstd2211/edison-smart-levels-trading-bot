import { EventEmitter } from 'events';
import * as fs from 'fs';
import type { IWebApiAdapter } from '@edison/contracts/web-api';
import * as path from 'path';
import * as webEntrypointModule from '../../web';
import { createWebServerRuntime } from '../../web';
import { WEB_ENTRYPOINT_EXPORT_NAMES } from '../../web';
import {
  createWebServerInstance,
  startWebServerRuntime,
} from '../../web/web-entrypoint-runtime';
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

  test('documents the build-runtime-first starter wording on the web entrypoint source', () => {
    const webEntrypointSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'web', 'index.ts'),
      'utf8',
    );

    expect(webEntrypointSource).toContain(
      'Build the runtime pair first, then hand that pair to `startWebServer(runtime, ports)`.',
    );
    expect(webEntrypointSource).toContain(
      'at the boundary instead of rediscovering adapters through bot internals.',
    );
    expect(webEntrypointSource).toContain(
      'The workspace WebServer receives the already-materialized runtime pair.',
    );
  });

  test('createWebServerInstance uses the explicit runtime adapter without reaching back into bot internals', () => {
    const { runtime } = createRuntimeFactoryHarness();
    const getWebApiAdapterSpy = jest.spyOn(runtime.bot, 'getWebApiAdapter');

    const webRuntime = createWebServerRuntime(runtime.bot, runtime.webApiAdapter);

    const server = createWebServerInstance(webRuntime, {
      apiPort: 4200,
      wsPort: 4201,
    }, WebServerMock);

    expect(getWebApiAdapterSpy).not.toHaveBeenCalled();
    expect(mockWebServer).toHaveBeenCalledTimes(1);
    expect(mockWebServer.mock.calls[0][0]).toBe(webRuntime.botAdapter);
    expect(server).toBeInstanceOf(WebServerMock);
    expect(mockWebServerStart).not.toHaveBeenCalled();
  });

  test('startWebServer starts the explicit runtime pair after the constructor handoff', async () => {
    const { runtime } = createRuntimeFactoryHarness();
    const webRuntime = createWebServerRuntime(runtime.bot, runtime.webApiAdapter);

    await startWebServerRuntime(webRuntime, {
      apiPort: 4200,
      wsPort: 4201,
    }, WebServerMock);

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
