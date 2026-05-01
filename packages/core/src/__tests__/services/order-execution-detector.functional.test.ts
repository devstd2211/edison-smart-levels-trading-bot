import {
  createManagedOrderExecutionDetectorContext,
  createOrderExecutionDetectorExecutionBatch,
} from '../helpers/order-execution-detector-test.utils';

describe('OrderExecutionDetectorService functional behavior', () => {
  it('tracks take-profit sequencing and recovery through trailing-stop and entry flows', () => {
    const { service, cleanup } = createManagedOrderExecutionDetectorContext({
      withErrorHandler: true,
    });

    const [tp1, tp2, trailingStop, entry] = createOrderExecutionDetectorExecutionBatch([
      { orderId: 'tp-1', closedSize: '5' },
      { orderId: 'tp-2', closedSize: '2.5' },
      { orderId: 'trail-1', stopOrderType: 'TrailingStop' },
      { orderId: 'entry-1', closedSize: '0' },
    ]);

    const tp1Result = service.detectExecution(tp1);
    const tp2Result = service.detectExecution(tp2);
    const trailingResult = service.detectExecution(trailingStop);
    const entryResult = service.detectExecution(entry);

    expect(tp1Result.type).toBe('TAKE_PROFIT');
    expect(tp1Result.tpLevel).toBe(1);
    expect(tp2Result.type).toBe('TAKE_PROFIT');
    expect(tp2Result.tpLevel).toBe(2);
    expect(trailingResult.type).toBe('TRAILING_STOP');
    expect(service.getLastCloseReason()).toBe('TRAILING');

    expect(entryResult.type).toBe('ENTRY');
    expect(service.getTpCounter()).toBe(0);
    expect(service.getLastCloseReason()).toBe('TRAILING');

    cleanup();
  });
});
