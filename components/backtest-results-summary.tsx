'use client';

import { BacktestRun } from '@/lib/types';
import { TrendingUp, TrendingDown, Target, Award, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BacktestResultsSummaryProps {
  backtest: BacktestRun;
}

export function BacktestResultsSummary({ backtest }: BacktestResultsSummaryProps) {
  if (!backtest.summary || backtest.status !== 'completed') {
    return null;
  }

  const { summary } = backtest;
  const outperformed = (summary.excessReturn || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Disclosure */}
      <div className="bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-r-lg">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold text-yellow-400 mb-1">Hypothetical Performance Disclosure</p>
            <p className="text-xs leading-relaxed">
              These results are based on historical backtesting and do not represent actual trading performance. 
              Past performance is not indicative of future results. Backtesting has inherent limitations including 
              look-ahead bias, survivorship bias, and perfect execution assumptions. Real-world trading involves 
              slippage, commissions, and market impact not fully captured in simulations. 
              <span className="font-semibold text-white"> This is not investment advice.</span>
            </p>
          </div>
        </div>
      </div>

      {/* The Teaching Five */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-blue-400" />
              Performance Summary
            </h3>
            {backtest.startDate && backtest.endDate && (
              <p className="text-gray-400 text-sm mt-1">
                Sample Window: {backtest.startDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' })} → {backtest.endDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' })} (ET)
              </p>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Total Return vs Benchmark */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className={cn(
                'w-5 h-5',
                summary.totalReturnPercent >= 0 ? 'text-green-400' : 'text-red-400'
              )} />
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Total Return
              </h4>
            </div>
            <div className="space-y-2">
              <div>
                {(() => {
                  const start = backtest.initialCapital || 100000;
                  const ended = start + (summary.totalReturn || 0);
                  return (
                    <>
                      <div className="text-3xl font-black text-white">
                        ${ended.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">
                        from ${start.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} start
                      </div>
                      <div className={cn(
                        'text-sm font-semibold mt-1',
                        summary.totalReturnPercent >= 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        {summary.totalReturnPercent >= 0 ? '+' : ''}{summary.totalReturnPercent.toFixed(2)}%
                      </div>
                    </>
                  );
                })()}
              </div>
              
              {summary.benchmarkReturnPercent !== undefined && summary.benchmarkReturn !== undefined && (
                <div className="pt-2 border-t border-gray-700">
                  {(() => {
                    const start = backtest.initialCapital || 100000;
                    const spyEnded = start + (summary.benchmarkReturn || 0);
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">SPY would be:</span>
                          <span className="text-sm font-semibold text-gray-300">
                            ${spyEnded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500">Excess Return:</span>
                          <span className={cn(
                            'text-sm font-bold',
                            outperformed ? 'text-green-400' : 'text-red-400'
                          )}>
                            {outperformed ? '+' : ''}{summary.excessReturn?.toFixed(2)}%
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* 2. Max Drawdown */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-orange-400" />
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Max Drawdown
              </h4>
            </div>
            <div>
              <div className="text-3xl font-black text-orange-400">
                {summary.maxDrawdownPercent.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Largest peak-to-trough decline
              </div>
              <div className="text-sm text-gray-400 mt-2">
                ${Math.abs(summary.maxDrawdown).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* 3. Number of Trades */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-purple-400" />
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Total Trades
              </h4>
            </div>
            <div>
              <div className="text-3xl font-black text-white">
                {summary.totalTrades}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Executed over test period
              </div>
              <div className="flex gap-3 mt-2 text-sm">
                <div>
                  <span className="text-green-400 font-semibold">{summary.profitableTrades}</span>
                  <span className="text-gray-500 ml-1">wins</span>
                </div>
                <div>
                  <span className="text-red-400 font-semibold">{summary.losingTrades}</span>
                  <span className="text-gray-500 ml-1">losses</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Win Rate */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-blue-400" />
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Win Rate
              </h4>
            </div>
            <div>
              <div className="text-3xl font-black text-white">
                {(summary.winRate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Percentage of profitable trades
              </div>
              <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${summary.winRate * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 5. Sharpe Ratio vs Benchmark */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5 text-yellow-400" />
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Sharpe Ratio
              </h4>
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-3xl font-black text-white">
                  {summary.sharpeRatio.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">Risk-adjusted return</div>
              </div>
              
              {summary.benchmarkSharpe !== undefined && (
                <div className="pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">SPY Benchmark:</span>
                    <span className="text-sm font-semibold text-gray-300">
                      {summary.benchmarkSharpe.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {summary.sharpeRatio > summary.benchmarkSharpe 
                      ? '✓ Better risk-adjusted returns' 
                      : '⚠ Lower risk-adjusted returns'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Additional Metrics
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Profit Factor:</span>
                <span className="text-white font-semibold">{summary.profitFactor.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Win:</span>
                <span className="text-green-400 font-semibold">
                  ${summary.avgWin.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Loss:</span>
                <span className="text-red-400 font-semibold">
                  ${Math.abs(summary.avgLoss).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
