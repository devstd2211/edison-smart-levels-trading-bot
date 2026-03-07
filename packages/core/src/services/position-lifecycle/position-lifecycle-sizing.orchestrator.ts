import type { IExchange } from '../../interfaces/IExchange';
import { CompoundInterestCalculatorService } from '../compound-interest-calculator.service';
import type { DynamicPositionSizerService } from '../dynamic-position-sizer.service';
import { Config, LoggerService, RiskManagementConfig, Signal } from '../../types/legacy';
import {
  buildCompoundSizingSuccessLogPayload,
  buildKellySizingChainEntries,
  buildKellySizingSuccessLogPayload,
  buildSizingFallbackLogPayload,
  calculatePositionExposure,
  calculateRiskRewardRatio,
  resolveFirstTakeProfitPrice,
  resolveSignalConfidence,
} from './position-lifecycle-sizing.utils';
import { toErrorMessage } from './position-lifecycle-error.utils';

type DynamicPositionSizingConfigView = {
  dynamicPositionSizing?: {
    enabled?: boolean;
  };
};

type CalculatePositionSizeParams = {
  signal: Signal;
  bybitService: IExchange;
  riskConfig: RiskManagementConfig;
  leverage: number;
  fullConfig: Config;
  logger: LoggerService;
  compoundInterestCalculator?: CompoundInterestCalculatorService;
  dynamicPositionSizer?: DynamicPositionSizerService;
};

export async function calculatePositionSizeOrchestrated(
  params: CalculatePositionSizeParams,
): Promise<{
  quantity: number;
  marginUsed: number;
  notionalValue: number;
  sizingChain: string[];
}> {
  const {
    signal,
    bybitService,
    riskConfig,
    leverage,
    fullConfig,
    logger,
    compoundInterestCalculator,
    dynamicPositionSizer,
  } = params;

  const sizingChain: string[] = [];
  let positionSizeUsdt: number;

  if (compoundInterestCalculator?.isEnabled?.()) {
    try {
      const compoundResult = await compoundInterestCalculator.calculatePositionSize();
      positionSizeUsdt = compoundResult.positionSize;
      sizingChain.push('COMPOUND_INTEREST');

      const payload = buildCompoundSizingSuccessLogPayload(
        compoundResult.currentBalance,
        compoundResult.totalProfit,
        positionSizeUsdt,
      );
      logger.info('Position sizing: Compound interest', payload);
    } catch (error) {
      const payload = buildSizingFallbackLogPayload(toErrorMessage(error));
      logger.warn('Compound interest calculation failed, falling back to fixed size', payload);
      positionSizeUsdt = riskConfig.positionSizeUsdt;
      sizingChain.push('COMPOUND_INTEREST_FAILED');
      sizingChain.push('FALLBACK_FIXED');
    }
  } else if (dynamicPositionSizer && isDynamicPositionSizingEnabled(fullConfig)) {
    try {
      const balanceInfo = await bybitService.getBalance();
      const accountBalance = balanceInfo.walletBalance || 10000;

      const firstTP = resolveFirstTakeProfitPrice(signal);
      const rrRatio = calculateRiskRewardRatio(signal.price, signal.stopLoss, firstTP);

      const currentATR = extractSignalNumber(signal, ['atr']) ?? signal.marketData?.atr;
      const averageATR = extractSignalNumber(signal, ['averageATR', 'averageAtr']);
      const signalConfidence = resolveSignalConfidence(signal.confidence);

      const sizingResult = await dynamicPositionSizer.calculateOptimalSize(
        signal.price,
        signal.stopLoss,
        accountBalance,
        signalConfidence,
        currentATR,
        averageATR,
        rrRatio
      );

      positionSizeUsdt = sizingResult.adjustedSize;
      sizingChain.push(
        ...buildKellySizingChainEntries(
          signalConfidence,
          sizingResult.riskPercent,
          currentATR,
          averageATR,
          sizingResult.volatilityAdjustment,
        )
      );

      const payload = buildKellySizingSuccessLogPayload({
        baseSize: sizingResult.baseSize,
        adjustedSize: sizingResult.adjustedSize,
        riskPercent: sizingResult.riskPercent,
        confidence: signalConfidence,
        volatilityAdj: sizingResult.volatilityAdjustment,
        recommendation: sizingResult.recommendation,
      });
      logger.info('Position sizing: Kelly Criterion', payload);
    } catch (error) {
      const payload = buildSizingFallbackLogPayload(toErrorMessage(error));
      logger.warn('Kelly Criterion calculation failed, falling back to fixed size', payload);
      positionSizeUsdt = riskConfig.positionSizeUsdt;
      sizingChain.push('KELLY_FAILED');
      sizingChain.push('FALLBACK_FIXED');
    }
  } else {
    positionSizeUsdt = riskConfig.positionSizeUsdt;
    sizingChain.push('FIXED');
  }

  const exposure = calculatePositionExposure(positionSizeUsdt, leverage, signal.price);
  return { ...exposure, sizingChain };
}

function extractSignalNumber(signal: Signal, keys: string[]): number | undefined {
  const raw = signal as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function isDynamicPositionSizingEnabled(fullConfig: Config): boolean {
  const config = fullConfig as Config & DynamicPositionSizingConfigView;
  return config.dynamicPositionSizing?.enabled === true;
}
