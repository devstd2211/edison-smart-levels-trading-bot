import { PositionState } from '../../types/enums';
import {
  createInitializedLegacyPositionStateMachineService,
  createManagedPositionStateMachineContext,
  createPositionStateMachinePositionId,
  transitionPositionState,
  type PositionStateMachineServiceSuiteState,
} from '../helpers/position-state-machine-test.utils';

describe('PositionStateMachineService functional', () => {
  let logger: PositionStateMachineServiceSuiteState['logger'];
  let cleanup: PositionStateMachineServiceSuiteState['cleanup'];

  beforeEach(() => {
    ({ logger, cleanup } = createManagedPositionStateMachineContext());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('keeps detached state snapshots stable across observational reads', async () => {
    const service = await createInitializedLegacyPositionStateMachineService({ logger });
    const positionId = createPositionStateMachinePositionId();

    transitionPositionState(service, {
      positionId,
      targetState: PositionState.TP1_HIT,
      reason: 'Functional snapshot read',
      metadata: {
        preBEMode: {
          activatedAt: Date.now(),
          candlesWaited: 1,
          candleCount: 5,
        },
      },
    });

    const firstSnapshot = service.getStateSnapshot('BTCUSDT', positionId)!;
    firstSnapshot.preBEMode!.candlesWaited = 99;

    const secondSnapshot = service.getStateSnapshot('BTCUSDT', positionId)!;
    expect(secondSnapshot.currentState).toBe(PositionState.TP1_HIT);
    expect(secondSnapshot.preBEMode?.candlesWaited).toBe(1);
  });
});
