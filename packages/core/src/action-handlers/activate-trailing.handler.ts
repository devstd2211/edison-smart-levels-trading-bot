/**
 * Activate Trailing Stop Action Handler
 *
 * Executes the action to activate trailing stop for position
 */

import { IActionHandler, ActivateTrailingAction, ActionResult, ActionType, ActivateTrailingExitActionDTO } from '../types/architecture';
import { PositionExitingService } from '../services/position-exiting.service';
import { PositionLifecycleService } from '../services/position-lifecycle.service';
import { LoggerService } from '../services/logger.service';
import { ExitType, ExitAction } from '../types/enums';

export class ActivateTrailingHandler implements IActionHandler {
  readonly name = 'ActivateTrailingHandler';

  private isAction(value: unknown): value is { type?: unknown } {
    return typeof value === 'object' && value !== null && 'type' in value;
  }

  constructor(
    private positionExitingService: PositionExitingService,
    private positionLifecycleService: PositionLifecycleService,
    private logger: LoggerService,
  ) {}

  /**
   * Check if this handler can process the action
   */
  canHandle(action: unknown): action is ActivateTrailingAction {
    return this.isAction(action) && action.type === ActionType.ACTIVATE_TRAILING;
  }

  /**
   * Execute activate trailing action
   */
  async handle(action: ActivateTrailingAction): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(`[${this.name}] Processing action`, {
        actionId: action.id,
        positionId: action.positionId,
        trailingPercent: action.trailingPercent,
      });

      // Get current position
      const position = this.positionLifecycleService.getCurrentPosition();
      if (!position || position.id !== action.positionId) {
        throw new Error(`Position ${action.positionId} not found or not current`);
      }

      // Get current price from metadata or use entry price
      const currentPrice = action.metadata?.currentPrice || position.entryPrice;

      // Create exit action object with strict typing
      const exitAction: ActivateTrailingExitActionDTO = {
        action: ExitAction.ACTIVATE_TRAILING,
        trailingPercent: action.trailingPercent,
        reason: 'Action queue triggered trailing activation',
      };

      // Call position exiting service to execute exit action
      await this.positionExitingService.executeExitAction(
        position,
        exitAction,
        currentPrice,
        'Activate trailing',
        ExitType.MANUAL,
      );

      const processingTime = Date.now() - startTime;
      this.logger.info(`[${this.name}] Trailing stop activated successfully`, {
        actionId: action.id,
        positionId: action.positionId,
        trailingPercent: action.trailingPercent,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        actionId: action.id,
        metadata: {
          positionId: action.positionId,
          trailingPercent: action.trailingPercent,
          processingTimeMs: processingTime,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`[${this.name}] Failed to activate trailing stop`, {
        actionId: action.id,
        positionId: action.positionId,
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: processingTime,
      });

      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          processingTimeMs: processingTime,
        },
        timestamp: Date.now(),
      };
    }
  }
}

