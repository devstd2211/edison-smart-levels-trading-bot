import { PositionEventHandler, createPositionEventHandlerDependencies } from '../../services/handlers/position.handler';
import type { IExchange } from '../../interfaces/IExchange';
import type { PositionLifecycleService } from '../../services/position-lifecycle.service';
import type { PositionExitingService } from '../../services/position-exiting.service';
import type { TelegramService } from '../../services/telegram.service';
import type { LoggerService } from '../../types/legacy';

describe('PositionEventHandler dependency boundary', () => {
  test('creates a named dependency bundle for the position handler runtime boundary', () => {
    const dependencies = createPositionEventHandlerDependencies({
      positionManager: {} as PositionLifecycleService,
      positionExitingService: {} as PositionExitingService,
      bybitService: {} as IExchange,
      telegram: {} as TelegramService,
      logger: {} as LoggerService,
    });

    expect(Object.keys(dependencies).sort()).toEqual([
      'bybitService',
      'logger',
      'positionExitingService',
      'positionManager',
      'telegram',
    ]);
  });

  test('constructs the handler from the named dependency bundle', () => {
    const handler = new PositionEventHandler(
      createPositionEventHandlerDependencies({
        positionManager: {} as PositionLifecycleService,
        positionExitingService: {} as PositionExitingService,
        bybitService: {} as IExchange,
        telegram: {} as TelegramService,
        logger: {} as LoggerService,
      }),
    );

    expect(handler).toBeInstanceOf(PositionEventHandler);
  });
});
