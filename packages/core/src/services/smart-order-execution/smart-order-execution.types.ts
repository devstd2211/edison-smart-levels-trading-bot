export type ExecutionStrategy =
  | 'aggressive'
  | 'passive'
  | 'adaptive'
  | 'twap'
  | 'vwap';

export type OrderSide = 'Buy' | 'Sell';

export type OrderStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'partial'
  | 'failed';

export type AdjustmentReason =
  | 'market_moved'
  | 'low_fill_probability'
  | 'timeout'
  | 'partial_fill';

export interface SmartOrderConfig {
  maxSlippagePercent: number;
  maxOrderSplits: number;
  minFillProbability: number;
  adaptiveExecution: boolean;
  executionStrategy: ExecutionStrategy;
  twapInterval: number;
  vwapLookback: number;
  executionTimeout: number;
}

export interface SmartOrderRequest {
  symbol: string;
  side: OrderSide;
  size: number;
  price: number;
  strategy?: ExecutionStrategy;
  maxSlippage?: number;
}

export interface SubOrder {
  id: string;
  size: number;
  price: number;
  status: 'pending' | 'submitted' | 'filled' | 'cancelled';
  fillPrice?: number;
  timestamp: number;
}

export interface PriceAdjustment {
  timestamp: number;
  oldPrice: number;
  newPrice: number;
  reason: AdjustmentReason;
}

export interface ExecutionReport {
  orderId: string;
  status: OrderStatus;
  symbol: string;
  side: OrderSide;
  requestedSize: number;
  filledSize: number;
  remainingSize: number;
  requestedPrice: number;
  averageFillPrice: number;
  slippage: number;
  executionTime: number;
  numberOfSplits: number;
  marketImpact: number;
  subOrders: SubOrder[];
  adjustments: PriceAdjustment[];
  reasoning: string;
}
