import { ExchangeAPIError } from '../../errors/DomainErrors';
import { runBotInitializerPeriodicCycle } from '../../services/bot-initializer/bot-initializer-periodic.utils';
import {
  asBotInitializerMock,
  createBotInitializerMockServices,
} from '../helpers/bot-initializer-test.utils';

describe('bot-initializer periodic utils', () => {
  it('runs cleanup when there is no active or opening position', async () => {
    const services = createBotInitializerMockServices();

    await expect(runBotInitializerPeriodicCycle(services)).resolves.toEqual({
      shouldStop: false,
    });

    expect(services.marketDataServices.bybitService.resyncTime).toHaveBeenCalledTimes(1);
    expect(services.marketDataServices.bybitService.cancelAllConditionalOrders).toHaveBeenCalledTimes(1);
  });

  it('skips cleanup when an active position exists', async () => {
    const services = createBotInitializerMockServices();
    asBotInitializerMock(services.executionServices.positionManager.getCurrentPosition).mockReturnValue({
      id: 'pos-1',
    });

    await runBotInitializerPeriodicCycle(services);

    expect(services.marketDataServices.bybitService.cancelAllConditionalOrders).not.toHaveBeenCalled();
  });

  it('skips cleanup while a position is opening', async () => {
    const services = createBotInitializerMockServices();
    asBotInitializerMock(services.executionServices.positionManager.isPositionOpening).mockReturnValue(true);

    await runBotInitializerPeriodicCycle(services);

    expect(services.marketDataServices.bybitService.cancelAllConditionalOrders).not.toHaveBeenCalled();
  });

  it('emits a critical error and asks the caller to stop periodic tasks', async () => {
    const services = createBotInitializerMockServices();
    const error = new ExchangeAPIError('Unauthorized API key', {
      exchangeName: 'bybit',
      endpoint: '/v5/order/realtime',
      statusCode: 401,
    });
    asBotInitializerMock(services.marketDataServices.bybitService.resyncTime).mockRejectedValue(error);

    await expect(runBotInitializerPeriodicCycle(services)).resolves.toEqual({
      shouldStop: true,
    });

    expect(services.coreServices.eventBus.emit).toHaveBeenCalledWith('critical-error', error);
    expect(services.marketDataServices.bybitService.cancelAllConditionalOrders).not.toHaveBeenCalled();
  });

  it('logs and continues on non-critical errors', async () => {
    const services = createBotInitializerMockServices();
    asBotInitializerMock(services.marketDataServices.bybitService.cancelAllConditionalOrders).mockRejectedValue(
      new Error('temporary cleanup failure'),
    );

    await expect(runBotInitializerPeriodicCycle(services)).resolves.toEqual({
      shouldStop: false,
    });

    expect(services.coreServices.logger.error).toHaveBeenCalledWith('Error in periodic tasks', {
      error: 'temporary cleanup failure',
    });
    expect(services.coreServices.eventBus.emit).not.toHaveBeenCalled();
  });
});
