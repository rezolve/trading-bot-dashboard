import { Bot, BacktestRun } from '@/lib/types';
import { pickReturnSnapshot, formatReturnCurrency, formatReturnPercent } from '@/lib/backtest-display';
import { cn } from '@/lib/utils';

interface TotalReturnBlockProps {
  bot: Bot;
  latestRun?: BacktestRun;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Always renders a Total Return slot.
 * Shows ending dollar value + percent if data exists, otherwise em dash.
 * Never fabricates numbers.
 */
export function TotalReturnBlock({ bot, latestRun, size = 'medium' }: TotalReturnBlockProps) {
  const snapshot = pickReturnSnapshot(bot, latestRun);

  const sizeClasses = {
    small: {
      label: 'text-xs',
      value: 'text-base',
      caption: 'text-xs',
      percent: 'text-xs',
    },
    medium: {
      label: 'text-xs',
      value: 'text-lg',
      caption: 'text-xs',
      percent: 'text-sm',
    },
    large: {
      label: 'text-sm',
      value: 'text-3xl',
      caption: 'text-xs',
      percent: 'text-lg',
    },
  };

  const classes = sizeClasses[size];

  return (
    <div>
      <p className={`text-gray-500 mb-1 ${classes.label}`}>Total Return</p>
      {snapshot.hasData ? (
        <div>
          <div className={`font-bold text-white ${classes.value}`}>
            {formatReturnCurrency(snapshot.endingValue)}
          </div>
          {snapshot.startValue !== undefined && (
            <div className={`text-gray-500 ${classes.caption}`}>
              from {formatReturnCurrency(snapshot.startValue)} start
            </div>
          )}
          {snapshot.returnPercent !== undefined && (
            <div className={cn(
              `font-semibold mt-1 ${classes.percent}`,
              snapshot.returnPercent >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {formatReturnPercent(snapshot.returnPercent)}
            </div>
          )}
        </div>
      ) : (
        <div className={`text-gray-600 ${classes.value}`}>—</div>
      )}
    </div>
  );
}
