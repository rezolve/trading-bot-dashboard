// Firestore Data Types

export interface BotSettings {
  userId: string;
  killSwitch: boolean;
  confirmationMode: boolean;
  maxNotionalPerOrder: number;
  maxPositionPercent: number;
  allowedAssetClasses: ('stock' | 'option')[];
  updatedAt: Date;
}

export interface Account {
  userId: string;
  accountNumber: string;
  equity: number;
  cash: number;
  buyingPower: number;
  optionsLevel: number;
  daytradeCount: number;
  patternDayTrader: boolean;
  updatedAt: Date;
}

export interface Position {
  id: string;
  userId: string;
  botId?: string; // Optional for backward compatibility
  symbol: string;
  assetClass: 'stock' | 'option';
  qty: number;
  avgEntryPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  currentPrice: number;
  side: 'long' | 'short';
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  botId?: string; // Optional for backward compatibility
  clientOrderId: string;
  symbol: string;
  assetClass: 'stock' | 'option';
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  qty?: number;
  notional?: number;
  limitPrice?: number;
  stopPrice?: number;
  status: 'pending_new' | 'accepted' | 'new' | 'partially_filled' | 'filled' | 'canceled' | 'expired' | 'rejected';
  filledQty: number;
  filledAvgPrice?: number;
  submittedAt?: Date;
  filledAt?: Date;
  canceledAt?: Date;
  updatedAt: Date;
  createdAt: Date;
}

export type TradeIntentStatus = 
  | 'draft' 
  | 'pending_approval' 
  | 'approved' 
  | 'rejected' 
  | 'submitted' 
  | 'filled' 
  | 'canceled' 
  | 'error';

export interface TradeIntent {
  id: string;
  userId: string;
  symbol: string;
  assetClass: 'stock' | 'option';
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  qty?: number;
  notional?: number;
  limitPrice?: number;
  stopPrice?: number;
  status: TradeIntentStatus;
  rejectionReason?: string;
  alpacaOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  submittedAt?: Date;
}

export type ActivityEventType = 
  | 'bot_started' 
  | 'bot_stopped' 
  | 'kill_switch_activated' 
  | 'kill_switch_deactivated'
  | 'confirmation_mode_enabled'
  | 'confirmation_mode_disabled'
  | 'settings_updated'
  | 'trade_intent_created'
  | 'trade_intent_approved'
  | 'trade_intent_rejected'
  | 'trade_intent_submitted'
  | 'order_filled'
  | 'order_canceled'
  | 'position_opened'
  | 'position_closed'
  | 'error';

export interface ActivityEvent {
  id: string;
  userId: string;
  eventType: ActivityEventType;
  message: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen?: string;
  nextClose?: string;
}

// Fleet Management Types

export type BotStatus = 'draft' | 'backtest' | 'paper' | 'stopped';

export type StrategyType = 'sma-crossover' | 'mean-reversion' | 'custom';

export type SignalType = 'indicator' | 'ml-model' | 'webhook' | 'manual';

export type TriggerType = 'scheduled' | 'price-alert' | 'webhook' | 'manual';

export interface Bot {
  botId: string;
  userId: string;
  name: string;
  description?: string;
  status: BotStatus;
  
  // Strategy configuration
  strategy: {
    type: StrategyType;
    params: Record<string, any>;
  };
  
  // Signals & Triggers
  signals: {
    type: SignalType;
    config: Record<string, any>;
  }[];
  
  triggers: {
    type: TriggerType;
    config: Record<string, any>;
  }[];
  
  // Risk limits
  riskLimits: {
    maxNotionalPerOrder: number;
    maxPositionPercent: number;
    allowedAssetClasses: ('stock' | 'option')[];
    maxDailyDrawdown?: number;
  };
  
  // Runtime state
  paperLive: boolean;
  containerId?: string;
  lastBacktestId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export type BacktestStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface BacktestRun {
  backtestId: string;
  botId: string;
  userId: string;
  
  // Parameters
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  
  // Status
  status: BacktestStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  
  // Results summary
  summary?: {
    totalReturn: number;
    totalReturnPercent: number;
    sharpeRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    winRate: number;
    totalTrades: number;
    profitableTrades: number;
    losingTrades: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  };
  
  // Storage references
  reportUrl?: string;
  equityCurveUrl?: string;
  tradesUrl?: string;
  logsUrl?: string;
  
  createdAt: Date;
}

export type BotActivityEventType = 
  | 'bot_created'
  | 'bot_updated'
  | 'bot_deleted'
  | 'backtest_started'
  | 'backtest_completed'
  | 'backtest_failed'
  | 'swapped_in'
  | 'swapped_out'
  | 'trade_executed'
  | 'position_opened'
  | 'position_closed'
  | 'error'
  | 'warning';

export interface BotActivityEvent {
  eventId: string;
  botId: string;
  userId: string;
  eventType: BotActivityEventType;
  message: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
