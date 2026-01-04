/**
 * Whale Detection Registration Module
 * Registers: Whale Detector
 */

import { AnalyzerRegistry } from '../analyzer-registry.service';
import { LoggerService, StrategyMarketData } from '../../types';
import { AnalyzerRegistrationModule } from './analyzer-registry.interface';

export class WhaleDetectionRegistration implements AnalyzerRegistrationModule {
  register(analyzerRegistry: AnalyzerRegistry, logger: LoggerService, config: any): void {
    // Whale Detector (priority 9, weight 0.2)
    analyzerRegistry.register('WHALE_DETECTOR', {
      name: 'WHALE_DETECTOR',
      weight: 0.2,
      priority: 9,
      enabled: false,
      evaluate: async (data: StrategyMarketData) => {
        return null;
      },
    });

    logger.info('✅ Whale Detection registered (1 analyzer)');
  }
}
