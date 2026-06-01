import { ExchangeAPIError } from '../../errors/DomainErrors';
import {
  createBotInitializerPeriodicCollaborators,
  runBotInitializerPeriodicCycle,
} from '../../services/bot-initializer/bot-initializer-periodic.utils';
import {
  asBotInitializerMock,
  createBotInitializerMockServices,
} from '../helpers/bot-initializer-test.utils';

describe('bot-initializer periodic utils', () => {
  it('runs cleanup when there is no active or opening position', async () => {
    const services = createBotInitializerMockServices();
    const collaborators = createBotInitializerPeriodicCollaborators(services);

    await expect(runBotInitializerPeriodicCycle(collaborators)).resolves.toEqual({
      shouldStop: false,
    });

    expect(services.exchangeRuntime.current.resyncTime).toHaveBeenCalledTimes(1);
    expect(services.exchangeRuntime.current.cancelAllConditionalOrders).toHaveBeenCalledTimes(1);
  });

  it('skips cleanup when an active position exists', async () => {
    const services = createBotInitializerMockServices();
    const collaborators = createBotInitializerPeriodicCollaborators(services);
    asBotInitializerMock(services.executionServices.positionManager.getCurrentPosition).mockReturnValue({
      id: 'pos-1',
    });

    await runBotInitializerPeriodicCycle(collaborators);

    expect(services.exchangeRuntime.current.cancelAllConditionalOrders).not.toHaveBeenCalled();
  });

  it('skips cleanup while a position is opening', async () => {
    const services = createBotInitializerMockServices();
    const collaborators = createBotInitializerPeriodicCollaborators(services);
    asBotInitializerMock(services.executionServices.positionManager.isPositionOpening).mockReturnValue(true);

    await runBotInitializerPeriodicCycle(collaborators);

    expect(services.exchangeRuntime.current.cancelAllConditionalOrders).not.toHaveBeenCalled();
  });

  it('emits a critical error and asks the caller to stop periodic tasks', async () => {
    const services = createBotInitializerMockServices();
    const collaborators = createBotInitializerPeriodicCollaborators(services);
    const error = new ExchangeAPIError('Unauthorized API key', {
      exchangeName: 'bybit',
      endpoint: '/v5/order/realtime',
      statusCode: 401,
    });
    asBotInitializerMock(services.exchangeRuntime.current.resyncTime).mockRejectedValue(error);

    await expect(runBotInitializerPeriodicCycle(collaborators)).resolves.toEqual({
      shouldStop: true,
    });

    expect(services.coreServices.eventBus.emit).toHaveBeenCalledWith('critical-error', error);
    expect(services.exchangeRuntime.current.cancelAllConditionalOrders).not.toHaveBeenCalled();
  });

  it('logs and continues on non-critical errors', async () => {
    const services = createBotInitializerMockServices();
    const collaborators = createBotInitializerPeriodicCollaborators(services);
    asBotInitializerMock(services.exchangeRuntime.current.cancelAllConditionalOrders).mockRejectedValue(
      new Error('temporary cleanup failure'),
    );

    await expect(runBotInitializerPeriodicCycle(collaborators)).resolves.toEqual({
      shouldStop: false,
    });

    expect(services.coreServices.logger.error).toHaveBeenCalledWith('Error in periodic tasks', {
      error: 'temporary cleanup failure',
    });
    expect(services.coreServices.eventBus.emit).not.toHaveBeenCalled();
  });

  it('uses the latest exchange runtime when collaborators outlive an exchange swap', async () => {
    const services = createBotInitializerMockServices();
    const collaborators = createBotInitializerPeriodicCollaborators(services);
    const originalExchange = services.exchangeRuntime.current;
    const replacementExchange = {
      ...originalExchange,
      resyncTime: jest.fn().mockResolvedValue(undefined),
      cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
    };

    services.exchangeRuntime.setCurrent(replacementExchange);

    await expect(runBotInitializerPeriodicCycle(collaborators)).resolves.toEqual({
      shouldStop: false,
    });

    expect(replacementExchange.resyncTime).toHaveBeenCalledTimes(1);
    expect(replacementExchange.cancelAllConditionalOrders).toHaveBeenCalledTimes(1);
    expect(originalExchange.cancelAllConditionalOrders).not.toHaveBeenCalled();
  });
});
