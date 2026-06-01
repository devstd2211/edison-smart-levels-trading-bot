import {
  ExitType,
  Position,
  TakeProfitFilledEvent,
} from '../../types/legacy';

export type TpMatchMethod =
  | 'ORDER_ID'
  | 'PRICE'
  | 'QUANTITY'
  | 'FIRST_UNHIT'
  | 'NONE';

export interface TpLevelResolution {
  tpLevel: number;
  method: TpMatchMethod;
  fillPrice: number;
  qtyFilled: number;
  percentFilled?: number;
  expectedPercent?: number;
  expectedPrice?: number;
}

const TAKE_PROFIT_EXIT_TYPES = {
  1: ExitType.TAKE_PROFIT_1,
  2: ExitType.TAKE_PROFIT_2,
  3: ExitType.TAKE_PROFIT_3,
} as const;

export function getFirstUnhitTakeProfitLevel(position: Position): number | null {
  const nextTakeProfit = position.takeProfits.find((takeProfit) => !takeProfit.hit);
  return nextTakeProfit?.level ?? null;
}

export function getTakeProfitExitType(tpHits: number[]): ExitType | null {
  const lastHitLevel = tpHits[tpHits.length - 1] as keyof typeof TAKE_PROFIT_EXIT_TYPES | undefined;
  return lastHitLevel ? TAKE_PROFIT_EXIT_TYPES[lastHitLevel] ?? null : null;
}

export function resolveTakeProfitLevel(
  position: Position,
  event: TakeProfitFilledEvent,
  priceTolerance: number,
  percentMultiplier: number = 100,
  quantityTolerancePercent: number = 5,
): TpLevelResolution {
  const fillPrice =
    event.avgPrice !== undefined ? parseFloat(String(event.avgPrice)) : 0;
  const qtyFilled =
    event.cumExecQty !== undefined ? parseFloat(String(event.cumExecQty)) : 0;

  if (event.orderId && position.takeProfits.length > 0) {
    for (const tp of position.takeProfits) {
      if (tp.orderId === event.orderId) {
        return {
          tpLevel: tp.level,
          method: 'ORDER_ID',
          fillPrice,
          qtyFilled,
          expectedPrice: tp.price,
        };
      }
    }
  }

  if (fillPrice > 0) {
    for (const tp of position.takeProfits) {
      const priceDiff = Math.abs(fillPrice - tp.price) / tp.price;
      if (priceDiff <= priceTolerance) {
        return {
          tpLevel: tp.level,
          method: 'PRICE',
          fillPrice,
          qtyFilled,
          expectedPrice: tp.price,
        };
      }
    }
  }

  if (qtyFilled > 0) {
    const initialQuantity = position.quantity + qtyFilled;
    const percentFilled = (qtyFilled / initialQuantity) * percentMultiplier;

    for (const tp of position.takeProfits) {
      if (!tp.hit) {
        const expectedPercent = tp.sizePercent;
        if (Math.abs(percentFilled - expectedPercent) <= quantityTolerancePercent) {
          return {
            tpLevel: tp.level,
            method: 'QUANTITY',
            fillPrice,
            qtyFilled,
            percentFilled,
            expectedPercent,
          };
        }
      }
    }
  }

  const fallbackTakeProfitLevel = getFirstUnhitTakeProfitLevel(position);
  if (fallbackTakeProfitLevel !== null) {
    return {
      tpLevel: fallbackTakeProfitLevel,
      method: 'FIRST_UNHIT',
      fillPrice,
      qtyFilled,
    };
  }

  return {
    tpLevel: 0,
    method: 'NONE',
    fillPrice,
    qtyFilled,
  };
}

export function resolveExitTypeFromCloseReason(
  lastCloseReason: 'SL' | 'TP' | 'TRAILING' | null,
  tpHits: number[],
  isTrailingStop: boolean,
): ExitType {
  const takeProfitExitType = getTakeProfitExitType(tpHits);

  if (lastCloseReason === 'TP') {
    return takeProfitExitType ?? ExitType.STOP_LOSS;
  }

  if (lastCloseReason === 'TRAILING') {
    return ExitType.TRAILING_STOP;
  }

  if (lastCloseReason === 'SL') {
    return ExitType.STOP_LOSS;
  }

  return takeProfitExitType ?? (isTrailingStop ? ExitType.TRAILING_STOP : ExitType.STOP_LOSS);
}
