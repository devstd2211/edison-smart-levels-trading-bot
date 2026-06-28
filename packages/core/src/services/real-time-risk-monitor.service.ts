import { BotEventBus } from './event-bus';
import { LoggerService } from '../types/legacy';
import { PositionLifecycleService } from './position-lifecycle.service';
import {
  RiskMonitoringConfig,
  HealthScore,
  HealthScoreComponents,
  HealthAnalysis,
  DangerLevel,
  RiskAlert,
  RiskAlertType,
  HealthReport,
  IRealTimeRiskMonitor,
  LiveTradingEventType,
  Position,
} from '../types/legacy';
import type { PositionClosedEventPayload } from '../types/bot-events';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  PositionNotFoundError,
  OrderValidationError,
  PositionSizingError,
} from '../errors/DomainErrors';
import { getErrorMessage } from '../utils/error.utils';
import {
  calculateOverallHealthScore,
  buildHealthAnalysis,
  buildHealthScoreComponents,
  createSafeDefaultHealthScore,
  determineDangerLevel,
} from './real-time-risk-monitor/real-time-risk-monitor-score.utils';
import { ICONS } from '../cli/cli-runtime';

export class RealTimeRiskMonitor implements IRealTimeRiskMonitor {
  private config: RiskMonitoringConfig;
  private positionLifecycleService: PositionLifecycleService;
  private logger: LoggerService;
  private eventBus: BotEventBus;
  private lastCheckTime: number = 0;
  private healthScoreCache: Map<string, HealthScore> = new Map();
  private generatedAlerts: Map<string, RiskAlert[]> = new Map();
  private isStarted = false;
  private unsubscribePositionClosed?: () => void;

  constructor(config: RiskMonitoringConfig, positionLifecycleService: PositionLifecycleService, logger: LoggerService, eventBus: BotEventBus) {
    this.config = config;
    this.positionLifecycleService = positionLifecycleService;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  public start(): void {
    if (this.isStarted) {
      return;
    }
    this.isStarted = true;

    if (this.eventBus && typeof this.eventBus.subscribe === 'function') {
      this.unsubscribePositionClosed = this.eventBus.subscribe('position-closed', (data: PositionClosedEventPayload) => {
        this.onPositionClosed(data);
      });
      this.logger.debug('[RealTimeRiskMonitor] Subscribed to position-closed events');
    }
  }

  public stop(): void {
    if (!this.isStarted) {
      return;
    }
    this.isStarted = false;
    if (this.unsubscribePositionClosed) {
      this.unsubscribePositionClosed();
      this.unsubscribePositionClosed = undefined;
    }
  }

  private ensureStarted(): void {
    if (!this.isStarted) {
      this.start();
    }
  }

  public async calculatePositionHealth(positionId: string, currentPrice: number): Promise<HealthScore> {
    this.ensureStarted();
    const now = Date.now();
    const position = this.positionLifecycleService.getCurrentPosition();

    if (!position || position.id !== positionId) {
      await ErrorHandler.handle(
        new PositionNotFoundError(`Position not found: ${positionId}`, {
          positionId,
          requestedId: positionId,
          actualId: position?.id || 'null',
        }),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          logger: this.logger,
          context: 'RealTimeRiskMonitor.calculatePositionHealth',
          onRecover: () => {
            this.logger.warn(`${ICONS.warning} Position not found, returning cached health score`, {
              positionId,
            });
          },
        }
      );

      const cached = this.getLatestHealthScore(positionId);
      if (cached) {
        return cached;
      }

      return createSafeDefaultHealthScore(positionId);
    }

    const cached = this.healthScoreCache.get(positionId);
    if (cached && now - cached.lastUpdate < 60000) {
      return cached;
    }

    const { price: validPrice } = await this.validateCurrentPrice(
      positionId,
      currentPrice,
      position.entryPrice
    );

    const denominator = position.quantity * position.entryPrice;
    if (denominator === 0) {
      await ErrorHandler.handle(
        new PositionSizingError('Zero quantity or entry price in PnL calculation', {
          requestedSize: position.quantity,
          entryPrice: position.entryPrice,
          reason: 'Cannot calculate PnL with zero denominator',
          positionId: position.id,
        }),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          logger: this.logger,
          context: 'RealTimeRiskMonitor.calculatePositionHealth',
          onRecover: () => {
            this.logger.warn(`${ICONS.warning} Zero denominator in PnL calc, returning safe default score`, {
              positionId: position.id,
              quantity: position.quantity,
              entryPrice: position.entryPrice,
            });
          },
        }
      );

      return createSafeDefaultHealthScore(positionId);
    }

    const components: HealthScoreComponents = buildHealthScoreComponents(
      position,
      validPrice,
    );
    const overallScore = calculateOverallHealthScore(components);
    const status = determineDangerLevel(overallScore);
    const analysis = buildHealthAnalysis(position, validPrice);

    const healthScore: HealthScore = {
      positionId,
      symbol: position.symbol,
      overallScore,
      components,
      status,
      lastUpdate: now,
      analysis,
    };

    this.healthScoreCache.set(positionId, healthScore);

    return healthScore;
  }

  public async checkPositionDanger(positionId: string, currentPrice?: number): Promise<DangerLevel> {
    this.ensureStarted();
    const position = this.positionLifecycleService.getCurrentPosition();
    if (!position || position.id !== positionId) {
      throw new Error(`Position not found: ${positionId}`);
    }

    const price = currentPrice || position.entryPrice;
    const healthScore = await this.calculatePositionHealth(positionId, price);
    return healthScore.status;
  }

  public async monitorAllPositions(currentPrice?: number): Promise<HealthReport> {
    this.ensureStarted();
    const now = Date.now();
    const position = this.positionLifecycleService.getCurrentPosition();
    const scores: HealthScore[] = [];
    const alerts: RiskAlert[] = [];

    if (position) {
      try {
        const priceToUse = currentPrice ?? position.entryPrice;
        if (!currentPrice) {
          this.logger.warn(
            `${ICONS.warning} No current price provided for ${position.symbol}, using entry price as fallback`
          );
        }
        const healthScore = await this.calculatePositionHealth(position.id, priceToUse);
        scores.push(healthScore);

        const alert = await this.shouldTriggerAlert(position.id, priceToUse);
        if (alert) {
          alerts.push(alert);

          try {
            this.eventBus.publishSync({
              type: LiveTradingEventType.RISK_ALERT_TRIGGERED,
              data: {
                alert,
                shouldEmergencyClose: alert.shouldEmergencyClose,
              },
              timestamp: now,
            });
          } catch (error) {
            await ErrorHandler.handle(error, {
              strategy: RecoveryStrategy.SKIP,
              logger: this.logger,
              context: 'RealTimeRiskMonitor.publishRiskAlertEvent',
              onRecover: () => {
                this.logger.warn(`${ICONS.warning} Failed to publish RISK_ALERT_TRIGGERED event, skipping`, {
                  positionId: position.id,
                  alert: alert.alertType,
                  error: getErrorMessage(error),
                });
              },
            });
          }
        }

        try {
          this.eventBus.publishSync({
            type: LiveTradingEventType.HEALTH_SCORE_UPDATED,
            data: {
              positionId: position.id,
              symbol: position.symbol,
              newScore: healthScore.overallScore,
              oldScore: 100, // Would track previous score
              newStatus: healthScore.status,
              oldStatus: DangerLevel.SAFE,
            },
            timestamp: now,
          });
        } catch (error) {
          await ErrorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
            logger: this.logger,
            context: 'RealTimeRiskMonitor.publishHealthScoreEvent',
            onRecover: () => {
              this.logger.warn(`${ICONS.warning} Failed to publish HEALTH_SCORE_UPDATED event, skipping`, {
                positionId: position.id,
                newScore: healthScore.overallScore,
                error: getErrorMessage(error),
              });
            },
          });
        }
      } catch (error) {
        await ErrorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          logger: this.logger,
          context: 'RealTimeRiskMonitor.monitorAllPositions',
          onRecover: () => {
            this.logger.warn(`${ICONS.warning} Position monitoring failed, skipping to next position`, {
              positionId: position.id,
              symbol: position.symbol,
              error: getErrorMessage(error),
            });
          },
        });
      }
    }

    const safePositions = scores.filter((s) => s.status === DangerLevel.SAFE).length;
    const warningPositions = scores.filter((s) => s.status === DangerLevel.WARNING).length;
    const criticalPositions = scores.filter((s) => s.status === DangerLevel.CRITICAL).length;
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.overallScore, 0) / scores.length) : 0;

    return {
      timestamp: now,
      totalPositions: scores.length,
      safePositions,
      warningPositions,
      criticalPositions,
      scores,
      alerts,
      averageScore,
    };
  }

  public async shouldTriggerAlert(positionId: string, currentPrice: number): Promise<RiskAlert | null> {
    this.ensureStarted();
    const position = this.positionLifecycleService.getCurrentPosition();
    if (!position || position.id !== positionId) {
      return null;
    }

    const healthScore = await this.calculatePositionHealth(positionId, currentPrice);

    // Check for critical danger
    if (healthScore.status === DangerLevel.CRITICAL) {
      const alert: RiskAlert = {
        positionId,
        symbol: position.symbol,
        alertType: RiskAlertType.HEALTH_SCORE_LOW,
        severity: 'CRITICAL',
        message: `Position health critically low (score: ${healthScore.overallScore})`,
        data: {
          healthScore: healthScore.overallScore,
          status: healthScore.status,
          components: healthScore.components,
        },
        timestamp: Date.now(),
        shouldEmergencyClose: this.config.emergencyCloseOnCritical,
      };

      return alert;
    }

    // Check for excessive drawdown
    const analysis = healthScore.analysis;
    if (analysis.currentDrawdown.percent > analysis.currentDrawdown.maxThreshold) {
      const alert: RiskAlert = {
        positionId,
        symbol: position.symbol,
        alertType: RiskAlertType.EXCESSIVE_DRAWDOWN,
        severity: 'WARNING',
        message: `Drawdown (${analysis.currentDrawdown.percent.toFixed(2)}%) exceeds threshold (${analysis.currentDrawdown.maxThreshold}%)`,
        data: {
          currentDrawdown: analysis.currentDrawdown.percent,
          maxThreshold: analysis.currentDrawdown.maxThreshold,
        },
        timestamp: Date.now(),
        shouldEmergencyClose: false,
      };

      return alert;
    }

    return null;
  }

  public getLatestHealthScore(positionId: string): HealthScore | undefined {
    return this.healthScoreCache.get(positionId);
  }

  public clearHealthScoreCache(): void {
    this.healthScoreCache.clear();
    this.logger.debug('[RealTimeRiskMonitor] Cleared health score cache');
  }

  private onPositionClosed(data: PositionClosedEventPayload): void {
    const positionId = this.extractPositionIdFromClosedEvent(data);

    if (!positionId) {
      this.logger.warn('[RealTimeRiskMonitor] position-closed event missing ID');
      return;
    }

    this.healthScoreCache.delete(positionId);
    this.generatedAlerts.delete(positionId);

    this.logger.debug('[RealTimeRiskMonitor] Cache invalidated', { positionId });
  }

  private extractPositionIdFromClosedEvent(data: PositionClosedEventPayload): string | undefined {
    if (this.isPosition(data)) {
      return data.id;
    }
    if (typeof data.positionId === 'string') {
      return data.positionId;
    }
    if (this.isPosition(data.position)) {
      return data.position.id;
    }
    if (this.isPosition(data.closedPosition)) {
      return data.closedPosition.id;
    }
    return undefined;
  }

  private isPosition(value: unknown): value is Position {
    return typeof value === 'object'
      && value !== null
      && typeof (value as Position).id === 'string'
      && typeof (value as Position).symbol === 'string';
  }

  public getStatistics(): {
    positionsMonitored: number;
    lastCheckTime: number;
    cachedScores: number;
    generatedAlerts: number;
  } {
    return {
      positionsMonitored: this.healthScoreCache.size,
      lastCheckTime: this.lastCheckTime,
      cachedScores: this.healthScoreCache.size,
      generatedAlerts: Array.from(this.generatedAlerts.values()).reduce((a, b) => a + b.length, 0),
    };
  }

  private async validateCurrentPrice(
    positionId: string,
    currentPrice: number | undefined,
    fallbackPrice: number
  ): Promise<{ price: number; usedCache: boolean }> {
    if (currentPrice !== undefined && (isNaN(currentPrice) || currentPrice <= 0)) {
      await ErrorHandler.handle(
        new OrderValidationError('Invalid current price for health calculation', {
          field: 'currentPrice',
          value: currentPrice,
          reason: 'Price must be a positive number',
          positionId,
        }),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          logger: this.logger,
          context: 'RealTimeRiskMonitor.validateCurrentPrice',
          onRecover: () => {
            this.logger.warn(`${ICONS.warning} Invalid currentPrice, falling back to entry price`, {
              positionId,
              invalidPrice: currentPrice,
              fallback: fallbackPrice,
            });
          },
        }
      );

      return { price: fallbackPrice, usedCache: false };
    }

    return { price: currentPrice ?? fallbackPrice, usedCache: false };
  }
}

