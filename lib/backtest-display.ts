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

/**
 * Coerce Firestore Timestamp/Date/string to Date
 */
function coerceToDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
  if (typeof value === 'string') return new Date(value);
  return null;
}

/**
 * Format backtest duration label with start/end dates (ET) and calendar length
 * Example: "Jun 2, 2026 to Aug 26, 2026 (85 days)"
 * Do not invent dates - returns null if missing
 */
export function backtestDurationLabel(
  startDate: any,
  endDate: any
): string | null {
  const start = coerceToDate(startDate);
  const end = coerceToDate(endDate);

  if (!start || !end) return null;

  // Format dates with ET timezone
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  const startStr = start.toLocaleDateString('en-US', formatOptions);
  const endStr = end.toLocaleDateString('en-US', formatOptions);

  // Calculate calendar length in days
  const durationMs = end.getTime() - start.getTime();
  const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));

  return `${startStr} to ${endStr} (${durationDays} days)`;
}
