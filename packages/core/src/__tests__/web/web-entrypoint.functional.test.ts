import { EventEmitter } from 'events';
import type { IWebApiAdapter } from '@edison/contracts/web-api';
import { createWebServerRuntime, startWebServer } from '../../web';
import {
  createManagedTrackedServicesRuntimeFactory,
  type TrackedServicesRuntimeFactory,
} from '../helpers/service-lifecycle-test.utils';

const mockWebServer = jest.fn();
const mockWebServerStart = jest.fn();

jest.mock('trading-bot-web-server', () => ({
  WebServer: class WebServerMock {
    close = jest.fn();
    start = mockWebServerStart;

    constructor(...args: unknown[]) {
      mockWebServer(...args);
    }
  },
}), { virtual: true });

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

  test('startWebServer uses the explicit runtime adapter without reaching back into bot internals', async () => {
    const { runtime } = createRuntimeFactoryHarness();
    const getWebApiAdapterSpy = jest.spyOn(runtime.bot, 'getWebApiAdapter');

    await startWebServer(createWebServerRuntime(runtime.bot, runtime.webApiAdapter), {
      apiPort: 4200,
      wsPort: 4201,
    });

    expect(getWebApiAdapterSpy).not.toHaveBeenCalled();
    expect(mockWebServer).toHaveBeenCalledTimes(1);
    expect(mockWebServerStart).toHaveBeenCalledTimes(1);
  });

  test('createWebServerRuntime keeps the bot bridge and web adapter as an explicit pair', () => {
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

    expect(runtime.bot).toBe(bot);
    expect(runtime.webApiAdapter).toBe(webApiAdapter);
  });
});
