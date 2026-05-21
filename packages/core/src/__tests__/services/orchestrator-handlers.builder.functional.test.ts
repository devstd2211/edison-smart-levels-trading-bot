import { createTradingOrchestratorConfig } from '../../services/factories/builders/orchestrator-config.builder';
import { TradingOrchestrator } from '../../services/trading-orchestrator.service';
import { PublicWebSocketService } from '../../services/public-websocket.service';
import { ContextFilteringMode } from '../../types/legacy';
import {
  createOrchestratorHandlersBuilderCandleEnabledConfig,
  createTrackedBotFactoryRuntimeSource,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Orchestrator builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates orchestrator config from runtime config without inlining builder concerns', () => {
    const config = createOrchestratorHandlersBuilderCandleEnabledConfig();

    const orchestratorConfig = createTradingOrchestratorConfig(config);

    expect(orchestratorConfig.contextConfig).toEqual(
      expect.objectContaining({
        minimumATR: 0.2,
        maximumATR: 2.5,
        maxEmaDistance: 0.25,
        filteringMode: ContextFilteringMode.WEIGHT_BASED,
        atrFilterEnabled: true,
      }),
    );
    expect(orchestratorConfig.entryConfig).toEqual(
      expect.objectContaining({
        fastEmaPeriod: 9,
        slowEmaPeriod: 50,
        zigzagDepth: 12,
        rsiOversold: 25,
        rsiOverbought: 75,
        priceAction: {
          enabled: true,
        },
      }),
    );
    expect(orchestratorConfig.btcConfirmation).toBe(config.btcConfirmation);
  });

  test('factory path links btc stores and event handlers when btc confirmation is enabled', () => {
    const config = createOrchestratorHandlersBuilderCandleEnabledConfig();
    const orchestratorBtcSpy = jest.spyOn(TradingOrchestrator.prototype, 'setBtcCandlesStore');
    const publicWebSocketBtcSpy = jest.spyOn(PublicWebSocketService.prototype, 'setBtcCandlesStore');

    try {
      const services = createTrackedBotFactoryRuntimeSource(trackedServices, config);
      const state = services as typeof services & {
        btcCandles1m: unknown[];
        positionEventHandler: unknown;
        webSocketEventHandler: unknown;
      };

      expect(state.positionEventHandler).toBeDefined();
      expect(state.webSocketEventHandler).toBeDefined();
      expect(orchestratorBtcSpy).toHaveBeenCalledWith(state);
      expect(publicWebSocketBtcSpy).toHaveBeenCalledWith(state);
      expect(state.btcCandles1m).toEqual([]);
    } finally {
      orchestratorBtcSpy.mockRestore();
      publicWebSocketBtcSpy.mockRestore();
    }
  });
});
