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

  for (const tp of position.takeProfits) {
    if (!tp.hit) {
      return {
        tpLevel: tp.level,
        method: 'FIRST_UNHIT',
        fillPrice,
        qtyFilled,
      };
    }
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
  if (lastCloseReason === 'TP') {
    return tpHits.length > 0
      ? ExitType[`TAKE_PROFIT_${tpHits[tpHits.length - 1]}` as 'TAKE_PROFIT_1' | 'TAKE_PROFIT_2' | 'TAKE_PROFIT_3']
      : ExitType.STOP_LOSS;
  }

  if (lastCloseReason === 'TRAILING') {
    return ExitType.TRAILING_STOP;
  }

  if (lastCloseReason === 'SL') {
    return ExitType.STOP_LOSS;
  }

  return tpHits.length > 0
    ? ExitType[`TAKE_PROFIT_${tpHits[tpHits.length - 1]}` as 'TAKE_PROFIT_1' | 'TAKE_PROFIT_2' | 'TAKE_PROFIT_3']
    : (isTrailingStop ? ExitType.TRAILING_STOP : ExitType.STOP_LOSS);
}
