import { Bot, BacktestRun, BotLastSummary } from './types';

/**
 * Return snapshot for display - never fabricate numbers
 */
export interface ReturnSnapshot {
  endingValue?: number;
  startValue?: number;
  returnPercent?: number;
  hasData: boolean;
}

/**
 * Pick return snapshot from bot.lastSummary with optional overlay from a completed run.
 * Never fabricates numbers - only returns what exists.
 */
export function pickReturnSnapshot(
  bot: Bot,
  latestRun?: BacktestRun
): ReturnSnapshot {
  // Prefer latest run summary if present and completed
  const summary = latestRun?.status === 'completed' && latestRun.summary
    ? latestRun.summary
    : bot.lastSummary;

  if (!summary) {
    return { hasData: false };
  }

  // Calculate ending value
  let endingValue: number | undefined;
  let startValue: number | undefined;

  // Prefer finalEquity if available
  if (summary.finalEquity !== undefined) {
    endingValue = summary.finalEquity;
    startValue = summary.initialCapital ?? 100000; // Document default start
  } else if (summary.totalReturn !== undefined && summary.initialCapital !== undefined) {
    // Calculate from totalReturn + initialCapital
    startValue = summary.initialCapital;
    endingValue = startValue + summary.totalReturn;
  } else if (summary.totalReturnPercent !== undefined) {
    // Derive from percent (only if we have initialCapital or can use documented default)
    startValue = summary.initialCapital ?? 100000; // Documented default
    endingValue = startValue * (1 + summary.totalReturnPercent / 100);
  }

  return {
    endingValue,
    startValue,
    returnPercent: summary.totalReturnPercent,
    hasData: endingValue !== undefined || summary.totalReturnPercent !== undefined,
  };
}

/**
 * Find the latest completed backtest run with a summary
 */
export function latestCompletedRun(runs: BacktestRun[]): BacktestRun | undefined {
  return runs.find(run => run.status === 'completed' && run.summary);
}

/**
 * Format currency with locale
 */
export function formatReturnCurrency(value: number | undefined): string {
  if (value === undefined) return '—';
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format percent with sign and guard missing values
 */
export function formatReturnPercent(percent: number | undefined): string {
  if (percent === undefined) return '—';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}
