/**
 * LifecycleManager
 *
 * Orchestrates start/stop of services with explicit lifecycle.
 * Keeps ordering centralized and errors isolated.
 */

import type { ILifecycle } from '../interfaces/ILifecycle';
import type { LoggerService } from './logger.service';
import { getErrorMessage } from '../utils/error.utils';

export type LifecycleStage =
  | 'execution'
  | 'monitoring'
  | 'monitoring-server'
  | 'position-monitor'
  | 'resilience'
  | 'websocket';

export type LifecycleRegistration = {
  id: string;
  label: string;
  service: ILifecycle;
  stage: LifecycleStage;
};

export class LifecycleManager {
  private readonly registrations: LifecycleRegistration[] = [];

  constructor(private readonly logger?: LoggerService) {}

  register(registration: LifecycleRegistration): void {
    this.registrations.push(registration);
  }

  registerAll(registrations: Iterable<LifecycleRegistration>): void {
    for (const registration of registrations) {
      this.register(registration);
    }
  }

  async startService(id: string, options: { throwOnError?: boolean } = {}): Promise<void> {
    const registration = this.registrations.find((entry) => entry.id === id);
    if (!registration) {
      return;
    }

    await this.startRegistration(registration, options);
  }

  async startStage(stage: LifecycleStage, options: { throwOnError?: boolean } = {}): Promise<void> {
    for (const registration of this.registrations) {
      if (registration.stage !== stage) {
        continue;
      }

      await this.startRegistration(registration, options);
    }
  }

  async startAll(options: { throwOnError?: boolean } = {}): Promise<void> {
    for (const registration of this.registrations) {
      await this.startRegistration(registration, options);
    }
  }

  async stopAll(options: { throwOnError?: boolean } = {}): Promise<void> {
    for (let i = this.registrations.length - 1; i >= 0; i -= 1) {
      await this.stopRegistration(this.registrations[i], options);
    }
  }

  private async startRegistration(
    registration: LifecycleRegistration,
    options: { throwOnError?: boolean },
  ): Promise<void> {
    try {
      await registration.service.start();
    } catch (error) {
      if (this.logger) {
        this.logger.error(`LifecycleManager failed to start ${registration.label}`, {
          error: getErrorMessage(error),
        });
      }
      if (options.throwOnError) {
        throw error;
      }
    }
  }

  private async stopRegistration(
    registration: LifecycleRegistration,
    options: { throwOnError?: boolean },
  ): Promise<void> {
    try {
      await registration.service.stop();
    } catch (error) {
      if (this.logger) {
        this.logger.warn(`LifecycleManager failed to stop ${registration.label}`, {
          error: getErrorMessage(error),
        });
      }
      if (options.throwOnError) {
        throw error;
      }
    }
  }
}
