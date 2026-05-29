import * as fs from 'fs';
import * as path from 'path';

function readInterfaceSource(fileName: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'interfaces', fileName),
    'utf8',
  );
}

describe('runtime contract interface guardrails', () => {
  test('trading bot services file defines a canonical execution slice', () => {
    const tradingBotServicesSource = readInterfaceSource('ITradingBotServices.ts');

    expect(tradingBotServicesSource).toContain('export type ITradingBotExecutionServices = Pick<');
    expect(tradingBotServicesSource).toContain(
      "'positionManager' | 'positionMonitor' | 'tradingOrchestrator'",
    );
    expect(tradingBotServicesSource).toContain(
      'executionServices: ITradingBotExecutionServices;',
    );
  });

  test('bot initializer services file defines reusable runtime slices', () => {
    const initializerServicesSource = readInterfaceSource('IBotInitializerServices.ts');

    expect(initializerServicesSource).toContain(
      'export type IBotInitializerMarketDataServices = Pick<',
    );
    expect(initializerServicesSource).toContain(
      'export type IBotInitializerExecutionServices = Pick<',
    );
    expect(initializerServicesSource).toContain('export interface IBotInitializerJournal');
    expect(initializerServicesSource).toContain('export interface IBotInitializerSessionStats');
    expect(initializerServicesSource).toContain('export interface IBotInitializerExchangeFactory');
    expect(initializerServicesSource).toContain(
      'export interface IBotInitializerResilienceServices',
    );
    expect(initializerServicesSource).toContain(
      'marketDataServices: IBotInitializerMarketDataServices;',
    );
    expect(initializerServicesSource).toContain(
      'executionServices: IBotInitializerExecutionServices;',
    );
    expect(initializerServicesSource).toContain('journal: IBotInitializerJournal;');
    expect(initializerServicesSource).toContain(
      'sessionStats: IBotInitializerSessionStats;',
    );
    expect(initializerServicesSource).toContain(
      'exchangeFactory?: IBotInitializerExchangeFactory;',
    );
    expect(initializerServicesSource).toContain(
      'resilienceServices?: IBotInitializerResilienceServices;',
    );
  });

  test('runtime sources reuse the consumer service slices instead of duplicating inline picks', () => {
    const runtimeSourcesSource = readInterfaceSource('IRuntimeSources.ts');

    expect(runtimeSourcesSource).toContain('ITradingBotExecutionServices');
    expect(runtimeSourcesSource).toContain(
      'IBotInitializerExecutionServices',
    );
    expect(runtimeSourcesSource).toContain(
      'IBotInitializerMarketDataServices',
    );
    expect(runtimeSourcesSource).toContain(
      'IBotInitializerJournal',
    );
    expect(runtimeSourcesSource).toContain(
      'IBotInitializerSessionStats',
    );
    expect(runtimeSourcesSource).toContain(
      'IBotInitializerExchangeFactory',
    );
    expect(runtimeSourcesSource).toContain(
      'IBotInitializerResilienceServices',
    );
    expect(runtimeSourcesSource).toContain(
      'IWebSocketEventHandlerExecutionServices',
    );
    expect(runtimeSourcesSource).toContain(
      'IWebSocketEventHandlerMarketDataServices',
    );
    expect(runtimeSourcesSource).toContain(
      'executionServices: ITradingBotExecutionServices;',
    );
    expect(runtimeSourcesSource).toContain(
      'marketDataServices: IBotInitializerMarketDataServices;',
    );
    expect(runtimeSourcesSource).toContain(
      'bybitService: BotInitializerExchangeService;',
    );
    expect(runtimeSourcesSource).toContain(
      'executionServices: IBotInitializerExecutionServices;',
    );
    expect(runtimeSourcesSource).toContain('journal: IBotInitializerJournal;');
    expect(runtimeSourcesSource).toContain(
      'sessionStats: IBotInitializerSessionStats;',
    );
    expect(runtimeSourcesSource).toContain(
      'exchangeFactory?: IBotInitializerExchangeFactory;',
    );
    expect(runtimeSourcesSource).toContain(
      'resilienceServices?: IBotInitializerResilienceServices;',
    );
    expect(runtimeSourcesSource).toContain(
      'executionServices: IWebSocketEventHandlerExecutionServices;',
    );
    expect(runtimeSourcesSource).toContain(
      'marketDataServices: IWebSocketEventHandlerMarketDataServices;',
    );
  });

  test('trading bot runtime dependencies define grouped lifecycle and read adapters', () => {
    const runtimeDependenciesSource = readInterfaceSource('ITradingBotRuntimeDependencies.ts');

    expect(runtimeDependenciesSource).toContain(
      'export interface ITradingBotLifecycleDependencies',
    );
    expect(runtimeDependenciesSource).toContain(
      'initializerServices: IBotInitializerServices;',
    );
    expect(runtimeDependenciesSource).toContain(
      'eventHandlerServices: IWebSocketEventHandlerServices;',
    );
    expect(runtimeDependenciesSource).toContain(
      'export interface ITradingBotReadAdapters',
    );
    expect(runtimeDependenciesSource).toContain(
      "balanceReader: Pick<IExchangeAccount, 'getBalance'>;",
    );
    expect(runtimeDependenciesSource).toContain(
      'webApiAdapter: IWebApiAdapter;',
    );
    expect(runtimeDependenciesSource).toContain(
      'lifecycleDependencies: ITradingBotLifecycleDependencies;',
    );
    expect(runtimeDependenciesSource).toContain(
      'readAdapters: ITradingBotReadAdapters;',
    );
  });

  test('runtime contract interfaces define explicit factory and bot handoff shells', () => {
    const runtimeContractsSource = readInterfaceSource('IRuntimeContracts.ts');
    const interfaceIndexSource = readInterfaceSource('index.ts');

    expect(runtimeContractsSource).toContain('export interface IBotRuntimeBundle');
    expect(runtimeContractsSource).toContain(
      'runtimeDependencies: ITradingBotRuntimeDependencies;',
    );
    expect(runtimeContractsSource).toContain('webApiAdapter: IWebApiAdapter;');
    expect(runtimeContractsSource).toContain('export interface ITradingBotFactoryRuntime');
    expect(runtimeContractsSource).toContain(
      'runtimeSource: IBotFactoryRuntimeSource;',
    );
    expect(runtimeContractsSource).toContain('runtimeBundle: IBotRuntimeBundle;');
    expect(runtimeContractsSource).toContain('export interface ITradingBotRuntime');
    expect(runtimeContractsSource).toContain('bot: TradingBot;');
    expect(interfaceIndexSource).toContain('IBotRuntimeBundle');
    expect(interfaceIndexSource).toContain('ITradingBotFactoryRuntime');
    expect(interfaceIndexSource).toContain('ITradingBotRuntime');
  });
});
