import { ICONS } from '../../cli/cli-runtime';
import { SignalDirection } from '../../types/legacy';
import { createEntryConfirmationConfig } from '../helpers/entry-confirmation-test.utils';
import { EntryConfirmationManager } from '../../services/entry-confirmation.service';

describe('EntryConfirmationManager - Functional behavior', () => {
  it('confirms and cancels entries with shared icon logs', () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const manager = new EntryConfirmationManager(
      createEntryConfirmationConfig(),
      logger as unknown as ConstructorParameters<typeof EntryConfirmationManager>[1],
    );

    const confirmId = manager.addPending({
      symbol: 'APEXUSDT',
      direction: SignalDirection.LONG,
      keyLevel: 1.5,
      detectedAt: Date.now(),
      signalData: { type: 'LEVEL_BASED' },
    });
    const confirmResult = manager.checkConfirmation(confirmId, 1.501);

    const cancelId = manager.addPending({
      symbol: 'BTCUSDT',
      direction: SignalDirection.SHORT,
      keyLevel: 50000,
      detectedAt: Date.now(),
      signalData: { type: 'LEVEL_BASED' },
    });
    const cancelled = manager.cancel(cancelId);

    expect(confirmResult.confirmed).toBe(true);
    expect(cancelled).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      `${ICONS.note} LONG entry pending confirmation`,
      expect.objectContaining({
        symbol: 'APEXUSDT',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      `${ICONS.success} LONG entry confirmed`,
      expect.objectContaining({
        symbol: 'APEXUSDT',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      `${ICONS.warning} SHORT entry cancelled`,
      expect.objectContaining({
        symbol: 'BTCUSDT',
      }),
    );
  });
});
