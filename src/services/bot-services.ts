/**
 * BotServices - Legacy container wrapper (thin adapter).
 *
 * Construction now lives in `buildBotServices`; this class is kept only
 * for legacy call sites that still instantiate `new BotServices(config)`.
 */

import type { Config } from '../types/legacy';
import { buildBotServices, type BotServicesState } from './bot-services.builder';

/**
 * Container for all bot services
 * Initialized in dependency order
 */
export class BotServices {
  constructor(config: Config) {
    Object.assign(this, buildBotServices(config));
  }
}

export type { BotServicesState };






