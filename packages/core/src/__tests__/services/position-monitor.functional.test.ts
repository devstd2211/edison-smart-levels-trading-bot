import { PositionSide } from '../../types/legacy';
import {
  attachCurrentPosition,
  attachPersistentExchangePosition,
  attachUnprotectedPosition,
  createManagedPositionMonitorContext,
  createMockMonitoredPosition,
  createTimeBasedExitRiskConfig,
  runPositionMonitorCycle,
  type ManagedPositionMonitorContext,
} from '../helpers/position-monitor-test.utils';

describe('PositionMonitorService - Functional behavior', () => {
  let context: ManagedPositionMonitorContext;

  beforeEach(() => {
    context = createManagedPositionMonitorContext();
  });

  afterEach(() => {
    context.cleanup();
  });

  it('verifies protection once and then emits a time-based exit without re-checking protection', async () => {
    const position = createMockMonitoredPosition(
      PositionSide.LONG,
      50000,
      49500,
      [],
      Date.now() - 35 * 60 * 1000,
    );
    position.protectionVerifiedOnce = false;

    context.rebuildMonitor(createTimeBasedExitRiskConfig());
    attachPersistentExchangePosition(context, position);
    context.mockBybit.getCurrentPrice.mockResolvedValue(50010);

    const exitSpy = jest.fn();
    context.monitor.on('timeBasedExit', exitSpy);

    await runPositionMonitorCycle(context.monitor);

    expect(context.mockBybit.verifyProtectionSet).toHaveBeenCalledTimes(1);
    expect(position.protectionVerifiedOnce).toBe(true);
    expect(exitSpy).toHaveBeenCalledTimes(1);

    context.mockBybit.verifyProtectionSet.mockClear();
    context.mockBybit.getPosition.mockClear();
    context.mockBybit.getCurrentPrice.mockClear();
    attachPersistentExchangePosition(context, position);
    context.mockBybit.getCurrentPrice.mockResolvedValue(50010);

    await runPositionMonitorCycle(context.monitor);

    expect(context.mockBybit.verifyProtectionSet).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledTimes(2);
  });

  it('closes an unprotected position, emits the emergency event, and clears lifecycle state', async () => {
    const position = attachUnprotectedPosition(context);
    const emergencySpy = jest.fn();
    context.monitor.on('positionClosedEmergency', emergencySpy);

    await runPositionMonitorCycle(context.monitor);

    expect(context.mockBybit.closePosition).toHaveBeenCalledWith({
      positionId: position.id,
      percentage: 100,
    });
    expect(context.mockTelegram.sendAlert).toHaveBeenCalledTimes(1);
    expect(context.mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    expect(emergencySpy).toHaveBeenCalledWith(position);
  });

  it('syncs an exchange-closed position instead of running price checks', async () => {
    const position = createMockMonitoredPosition();
    attachCurrentPosition(context.positionHarness, position);
    context.mockBybit.getPosition.mockResolvedValue({ ...position, quantity: 0 });

    await runPositionMonitorCycle(context.monitor);

    expect(context.mockPositionSync.syncClosedPosition).toHaveBeenCalledWith(position);
    expect(context.mockBybit.getCurrentPrice).not.toHaveBeenCalled();
  });

  it('skips stale price checks when the monitored position changes during protection verification', async () => {
    const initialPosition = createMockMonitoredPosition();
    const replacementPosition = createMockMonitoredPosition(undefined, undefined, undefined, undefined, undefined, {
      id: 'replacement-pos-456',
    });
    let activePosition = initialPosition;

    context.mockPositionManager.getCurrentPosition.mockImplementation(() => activePosition);
    context.mockBybit.getPosition.mockResolvedValue(initialPosition);
    context.mockBybit.verifyProtectionSet.mockImplementation(async () => {
      activePosition = replacementPosition;
      return {
        verified: true,
        hasStopLoss: true,
        hasTakeProfit: true,
        hasTrailingStop: false,
        activeOrders: 3,
      };
    });

    const stopLossSpy = jest.fn();
    context.monitor.on('stopLossHit', stopLossSpy);

    await runPositionMonitorCycle(context.monitor);

    expect(context.mockBybit.getCurrentPrice).not.toHaveBeenCalled();
    expect(stopLossSpy).not.toHaveBeenCalled();
  });
});
