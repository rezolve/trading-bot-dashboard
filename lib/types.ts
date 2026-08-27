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

export type BotCategory = 'day-trade' | 'swing' | 'position' | 'orb';

export type BotRole = 'alpha' | 'risk-sleeve' | 'benchmark';

export type PlaybookWindow = 'open' | 'midday' | 'close' | 'any' | 'open+midday';

export type StrategyType = 'sma-crossover' | 'mean-reversion' | 'custom';

export type SignalType = 'indicator' | 'ml-model' | 'webhook' | 'manual';

export type TriggerType = 'scheduled' | 'price-alert' | 'webhook' | 'manual';

export interface BotLastSummary {
  totalReturn?: number;
  totalReturnPercent?: number;
  finalEquity?: number;
  sharpeRatio?: number;
  maxDrawdownPercent?: number;
  winRate?: number;
  totalTrades?: number;
  initialCapital?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface Bot {
  botId: string;
  userId: string;
  name: string;
  description?: string;
  status: BotStatus;
  
  // Category & Role
  category: BotCategory;
  role?: BotRole;
  holdsOvernight?: boolean;
  playbookWindow?: PlaybookWindow;
  
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
  lastSummary?: BotLastSummary;
  
  createdAt: Date;
  updatedAt: Date;
}

export type BacktestStatus = 'queued' | 'running' | 'completed' | 'failed';

export type BacktestStep = 
  | 'queued'
  | 'fetching_bars'
  | 'simulating'
  | 'writing_artifacts'
  | 'completed'
  | 'failed';

export interface BacktestProgress {
  step: BacktestStep;
  message: string;
  startedAt: Date;
  logs: string[]; // Last ~8 log lines
}

export interface BacktestRun {
  backtestId: string;
  botId: string;
  userId: string;
  
  // Parameters
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  
  // Research fields (optional)
  familyId?: string;
  experimentId?: string;
  generation?: number;
  split?: BacktestSplit;
  
  // Status
  status: BacktestStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  
  // Progress tracking
  progress?: BacktestProgress;
  
  // Results summary (Teaching Five + more)
  summary?: {
    totalReturn: number;
    totalReturnPercent: number;
    finalEquity?: number;
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
    // Benchmark comparison (SPY buy-and-hold)
    benchmarkReturn?: number;
    benchmarkReturnPercent?: number;
    benchmarkSharpe?: number;
    excessReturn?: number; // Strategy return - benchmark return
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

// Research Module Types

export type ResearchBook = 'day-trade' | 'swing' | 'position' | 'orb';
export type ResearchAssetClass = 'stock' | 'option';
export type ResearchSide = 'long' | 'short' | 'both';
export type ExperimentStatus = 'queued' | 'scored' | 'kept' | 'killed';
export type IdeaCritic = 'keep' | 'kill' | 'rewrite' | null;
export type IdeaStatus = 'new' | 'queued_experiment' | 'rejected';
export type BacktestSplit = 'in_sample' | 'holdout' | 'full';

export interface ResearchFamily {
  familyId: string;
  userId: string;
  name: string;
  book: ResearchBook;
  assetClass: ResearchAssetClass;
  side: ResearchSide;
  holdsOvernight: boolean;
  championBotId?: string;
  benchmark?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchExperiment {
  experimentId: string;
  familyId: string;
  userId: string;
  parentBotId?: string;
  hypothesis: string;
  tweak: Record<string, any>;
  killRule?: string;
  inSampleStart?: Date;
  inSampleEnd?: Date;
  holdoutStart?: Date;
  holdoutEnd?: Date;
  status: ExperimentStatus;
  generation?: number;
  inSampleReturn?: number;
  inSampleReturnPercent?: number;
  holdoutReturn?: number;
  holdoutReturnPercent?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ResearchIdea {
  ideaId: string;
  familyId: string;
  userId: string;
  sourceUrl?: string;
  paramDiff?: Record<string, any>;
  killRule?: string;
  critic: IdeaCritic;
  status: IdeaStatus;
  createdAt: Date;
}
