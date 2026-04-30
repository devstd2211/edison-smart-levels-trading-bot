import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { IPositionRepository } from '../../repositories/IRepositories';
import { Position, Signal } from '../../types/legacy';
import {
  createLifecycleWebSocketPosition,
  createManagedPositionLifecycleRepositoryContext,
  createMockLifecycleSignal,
  readLifecycleRepositoryPosition,
  type PositionLifecycleRepositorySuiteState,
} from '../helpers/position-lifecycle-test.utils';

type FunctionalLifecycleContext = Pick<
  PositionLifecycleRepositorySuiteState,
  'service' | 'mockExchange' | 'mockTelegram' | 'mockJournal' | 'mockEventBus' | 'mockRepository' | 'cleanup'
>;

describe('PositionLifecycleService - Functional behavior', () => {
  let service: PositionLifecycleService;
  let mockExchange: FunctionalLifecycleContext['mockExchange'];
  let mockTelegram: FunctionalLifecycleContext['mockTelegram'];
  let mockJournal: FunctionalLifecycleContext['mockJournal'];
  let mockEventBus: FunctionalLifecycleContext['mockEventBus'];
  let mockRepository: jest.Mocked<IPositionRepository>;
  let cleanup: FunctionalLifecycleContext['cleanup'];

  beforeEach(() => {
    const context = createManagedPositionLifecycleRepositoryContext();
    service = context.service;
    mockExchange = context.mockExchange;
    mockTelegram = context.mockTelegram;
    mockJournal = context.mockJournal;
    mockEventBus = context.mockEventBus;
    mockRepository = context.mockRepository as jest.Mocked<IPositionRepository>;
    cleanup = context.cleanup;

    mockRepository.setCurrentPosition(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('opens, syncs, and clears a repository-backed position through the lifecycle facade', async () => {
    const signal: Signal = createMockLifecycleSignal({
      price: 40100,
      stopLoss: 39200,
    });

    const openedPosition = await service.openPosition(signal);
    const storedAfterOpen = readLifecycleRepositoryPosition(mockRepository);

    expect(storedAfterOpen).toEqual(openedPosition);
    expect(service.getCurrentPosition()).toEqual(openedPosition);
    expect(service.getTakeProfitManager()).not.toBeNull();
    expect(mockJournal.recordTradeOpen).toHaveBeenCalledTimes(1);
    expect(mockTelegram.notifyPositionOpened).toHaveBeenCalledWith(openedPosition);
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'position-opened',
      expect.objectContaining({
        position: expect.objectContaining({ id: openedPosition.id }),
      }),
    );

    const wsPosition: Position = createLifecycleWebSocketPosition(openedPosition, {
      quantity: 0.5,
      unrealizedPnL: 725,
    });
    service.syncWithWebSocket(wsPosition);

    const storedAfterSync = readLifecycleRepositoryPosition(mockRepository);
    expect(storedAfterSync?.quantity).toBe(0.5);
    expect(storedAfterSync?.unrealizedPnL).toBe(725);
    expect(service.getCurrentPosition()?.quantity).toBe(0.5);

    await service.clearPosition();

    expect(readLifecycleRepositoryPosition(mockRepository)).toBeNull();
    expect(service.getCurrentPosition()).toBeNull();
    expect(service.getTakeProfitManager()).toBeNull();
    expect(mockExchange.cancelAllConditionalOrders).toHaveBeenCalled();
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'position-closed',
      expect.objectContaining({
        position: expect.objectContaining({ id: openedPosition.id }),
      }),
    );
  });
});
