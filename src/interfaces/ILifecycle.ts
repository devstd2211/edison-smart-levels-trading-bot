/**
 * ILifecycle
 *
 * Minimal lifecycle contract for services that need explicit start/stop.
 */
export interface ILifecycle {
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
}
