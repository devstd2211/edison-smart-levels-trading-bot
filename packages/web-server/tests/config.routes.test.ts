describe('config routes transport boundary', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.API_PORT;
    delete process.env.WS_PORT;
  });

  test('loads dotenv lazily when the runtime server payload is requested', () => {
    const dotenvConfig = jest.fn(() => ({}));

    jest.doMock('dotenv', () => ({
      __esModule: true,
      config: dotenvConfig,
    }));

    jest.isolateModules(() => {
      require('../src/routes/config.routes');

      expect(dotenvConfig).not.toHaveBeenCalled();

      const { createConfigRouteHandlers } = require('../src/routes/config-route-contracts');
      const handlers = createConfigRouteHandlers({
        read: jest.fn(),
        write: jest.fn(),
        getStrategySummaries: jest.fn(),
        updateStrategyToggle: jest.fn(),
        updateRiskSettings: jest.fn(),
        preview: jest.fn(),
        validate: jest.fn(),
        getBackupCollection: jest.fn(),
        restore: jest.fn(),
        cleanupOldBackups: jest.fn(),
        getSchema: jest.fn(),
        getHistory: jest.fn(),
      });

      handlers.readServerRuntimeConfig();

      expect(dotenvConfig).toHaveBeenCalledTimes(1);
    });
  });
});
