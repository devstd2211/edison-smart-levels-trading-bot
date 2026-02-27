/**
 * LifecycleManager
 *
 * Orchestrates start/stop of services with explicit lifecycle.
 * Keeps ordering centralized and errors isolated.
 */

import type { ILifecycle } from '../interfaces/ILifecycle';
import type { LoggerService } from './logger.service';

export class LifecycleManager {
  private readonly services: ILifecycle[] = [];

  constructor(private readonly logger?: LoggerService) {}

  register(service: ILifecycle): void {
    this.services.push(service);
  }

  async startAll(): Promise<void> {
    for (const service of this.services) {
      try {
        await service.start();
      } catch (error) {
        if (this.logger) {
          this.logger.error('LifecycleManager failed to start service', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    }
  }

  async stopAll(): Promise<void> {
    for (let i = this.services.length - 1; i >= 0; i -= 1) {
      const service = this.services[i];
      try {
        await service.stop();
      } catch (error) {
        if (this.logger) {
          this.logger.warn('LifecycleManager failed to stop service', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }
}
