'use client';

import { BacktestRun, BacktestStep } from '@/lib/types';
import { Loader2, CheckCircle, XCircle, Clock, Database, PlayCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BacktestProgressPanelProps {
  backtest: BacktestRun | null;
  botName?: string;
}

const STEP_ICONS: Record<BacktestStep, any> = {
  queued: Clock,
  fetching_bars: Database,
  simulating: PlayCircle,
  writing_artifacts: FileText,
  completed: CheckCircle,
  failed: XCircle,
};

const STEP_LABELS: Record<BacktestStep, string> = {
  queued: 'Queued',
  fetching_bars: 'Fetching Bars',
  simulating: 'Running Simulation',
  writing_artifacts: 'Writing Results',
  completed: 'Completed',
  failed: 'Failed',
};

export function BacktestProgressPanel({ backtest, botName }: BacktestProgressPanelProps) {
  if (!backtest || backtest.status === 'completed' || backtest.status === 'failed') {
    return null; // Don't show panel when not running
  }

  const currentStep = backtest.progress?.step || 'queued';
  const StepIcon = STEP_ICONS[currentStep];
  const isActive = backtest.status === 'running';

  return (
    <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-2 border-blue-500/30 rounded-xl p-6 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {isActive ? (
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          ) : (
            <StepIcon className={cn(
              'w-6 h-6',
              currentStep === 'failed' ? 'text-red-400' : 'text-blue-400'
            )} />
          )}
          <div>
            <h3 className="text-lg font-bold text-white">
              {botName ? `${botName} - Backtest Running` : 'Backtest Running'}
            </h3>
            <p className="text-sm text-gray-400">
              {backtest.progress?.message || STEP_LABELS[currentStep]}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-xs text-gray-500">Started</div>
          <div className="text-sm text-gray-300">
            {backtest.startedAt 
              ? new Date(backtest.startedAt).toLocaleTimeString()
              : 'Just now'}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-4">
        {(['queued', 'fetching_bars', 'simulating', 'writing_artifacts', 'completed'] as BacktestStep[]).map((step, idx) => {
          const Icon = STEP_ICONS[step];
          const isCurrent = step === currentStep;
          const isPast = ['queued', 'fetching_bars', 'simulating', 'writing_artifacts', 'completed'].indexOf(currentStep) > idx;
          
          return (
            <div key={step} className="flex items-center gap-2">
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full border-2',
                isCurrent && 'border-blue-400 bg-blue-400/20',
                isPast && 'border-green-400 bg-green-400/20',
                !isCurrent && !isPast && 'border-gray-600 bg-gray-800/50'
              )}>
                <Icon className={cn(
                  'w-4 h-4',
                  isCurrent && 'text-blue-400',
                  isPast && 'text-green-400',
                  !isCurrent && !isPast && 'text-gray-600'
                )} />
              </div>
              
              {idx < 4 && (
                <div className={cn(
                  'w-8 h-0.5',
                  isPast ? 'bg-green-400' : 'bg-gray-700'
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Logs */}
      {backtest.progress?.logs && backtest.progress.logs.length > 0 && (
        <div className="bg-black/40 rounded-lg p-3 border border-gray-700">
          <div className="text-xs text-gray-400 mb-2 font-mono">Recent Activity:</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {backtest.progress.logs.map((log, idx) => (
              <div key={idx} className="text-xs text-gray-300 font-mono">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
