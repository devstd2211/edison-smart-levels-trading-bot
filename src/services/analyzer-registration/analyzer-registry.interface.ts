/**
 * Interface for analyzer registration sub-services
 * Each sub-service handles registration of analyzers in its category
 */

import { AnalyzerRegistry } from '../analyzer-registry.service';
import { LoggerService } from '../../types';

export interface AnalyzerRegistrationModule {
  /**
   * Register all analyzers in this category
   */
  register(analyzerRegistry: AnalyzerRegistry, logger: LoggerService, config: any): void;
}
