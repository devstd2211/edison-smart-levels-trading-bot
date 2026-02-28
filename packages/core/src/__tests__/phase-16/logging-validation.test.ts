/**
 * Phase 16.3: Logging Infrastructure Validation
 */

import { LoggerService } from '../../services/logger.service';

describe('Phase 16.3: Logging Infrastructure Validation', () => {
  describe('LoggerService', () => {
    it('should initialize', () => {
      const logger = new LoggerService('debug', './logs', false);
      expect(logger).toBeDefined();
    });

    it('should log info messages', () => {
      const logger = new LoggerService('info', './logs', false);
      const spy = jest.spyOn(logger, 'info');
      logger.info('Test message', { key: 'value' });
      expect(spy).toHaveBeenCalledWith('Test message', { key: 'value' });
    });

    it('should support all log levels', () => {
      const logger = new LoggerService('debug', './logs', false);
      const debugSpy = jest.spyOn(logger, 'debug');
      const infoSpy = jest.spyOn(logger, 'info');
      const warnSpy = jest.spyOn(logger, 'warn');
      const errorSpy = jest.spyOn(logger, 'error');

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(debugSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
