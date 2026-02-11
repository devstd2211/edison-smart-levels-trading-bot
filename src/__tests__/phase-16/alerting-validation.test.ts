/**
 * Phase 16.3: Alerting Infrastructure Validation
 */

import { TelegramService } from '../../services/telegram.service';
import { LoggerService } from '../../services/logger.service';
import { TelegramNetworkError } from '../../errors/DomainErrors';
import { SignalDirection } from '../../types/enums';

describe('Phase 16.3: Alerting Infrastructure Validation', () => {
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService('info', './logs', false);
  });

  describe('TelegramService', () => {
    it('should initialize when disabled', () => {
      const service = new TelegramService({ enabled: false }, logger);
      expect(service).toBeDefined();
    });

    it('should handle disabled state', async () => {
      const service = new TelegramService({ enabled: false }, logger);
      await expect(service.sendTradeNotification({
        type: 'ENTRY',
        direction: SignalDirection.LONG,
        price: 50000
      })).resolves.not.toThrow();
    });
  });

  describe('TelegramNetworkError', () => {
    it('should create network error', () => {
      const error = new TelegramNetworkError(
        'Network timeout',
        { operation: 'sendMessage', reason: 'timeout', timeout: 5000 }
      );
      expect(error.message).toBe('Network timeout');
      expect(error.metadata.code).toBe('TELEGRAM_NETWORK_ERROR');
    });
  });
});
