'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Bot, BacktestRun, BotActivityEvent } from '@/lib/types';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, Activity, TrendingUp, Settings,
  AlertCircle, Clock
} from 'lucide-react';
import { BacktestProgressPanel } from '@/components/backtest-progress-panel';
import { BacktestResultsSummary } from '@/components/backtest-results-summary';
import { TotalReturnBlock } from '@/components/total-return-block';
import { latestCompletedRun, formatReturnCurrency, formatReturnPercent, backtestDurationLabel } from '@/lib/backtest-display';

// For static export: generateStaticParams emits '_', so resolve real botId from URL
function getRealBotId(): string | null {
  if (typeof window === 'undefined') return null;
  const segments = window.location.pathname.split('/').filter(Boolean);
  const fleetIndex = segments.indexOf('fleet');
  if (fleetIndex >= 0 && segments.length > fleetIndex + 1) {
    const id = segments[fleetIndex + 1];
    return id === '_' ? null : id;
  }
  return null;
}

export default function BotDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [botId, setBotId] = useState<string | null>(null);
  const [bot, setBot] = useState<Bot | null>(null);
  const [backtests, setBacktests] = useState<BacktestRun[]>([]);
  const [activity, setActivity] = useState<BotActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve real botId from URL path (ignore '_' from generateStaticParams)
  useEffect(() => {
    const realBotId = getRealBotId();
    if (realBotId) {
      setBotId(realBotId);
    } else {
      // Fallback to params if we're not in browser yet
      const paramBotId = params.botId as string;
      if (paramBotId && paramBotId !== '_') {
        setBotId(paramBotId);
      }
    }
  }, [params.botId]);

  useEffect(() => {
    if (!user || !botId || botId === '_') return;

    const loadBot = async () => {
      const botDoc = await getDoc(doc(db, 'bots', botId));
      if (botDoc.exists()) {
        const data = botDoc.data();
        if (data.userId !== user.uid) {
          setBot(null);
          setLoading(false);
          return;
        }
        setBot({
          ...data,
          botId: botDoc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Bot);
      }
      setLoading(false);
    };

    loadBot();

    // Subscribe to backtests
    const backtestsQuery = query(
      collection(db, 'backtest-runs'),
      where('userId', '==', user.uid),
      where('botId', '==', botId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsubBacktests = onSnapshot(backtestsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        backtestId: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
      } as BacktestRun));
      setBacktests(data);
    });

    // Subscribe to activity
    const activityQuery = query(
      collection(db, 'bot-activity'),
      where('userId', '==', user.uid),
      where('botId', '==', botId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubActivity = onSnapshot(activityQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        eventId: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      } as BotActivityEvent));
      setActivity(data);
    });

    return () => {
      unsubBacktests();
      unsubActivity();
    };
  }, [user, botId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Bot Not Found</h2>
        <button
          onClick={() => router.push('/dashboard/fleet')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Back to Fleet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{bot.name}</h1>
            <p className="text-gray-400">{bot.description || 'No description'}</p>
          </div>
        </div>
      </div>

      {/* Running Backtest Progress */}
      {(() => {
        const runningBacktest = backtests.find(bt => bt.status === 'running' || bt.status === 'queued');
        return runningBacktest ? <BacktestProgressPanel backtest={runningBacktest} botName={bot.name} /> : null;
      })()}

      {/* Latest Completed Backtest Results */}
      {(() => {
        const completedBacktest = latestCompletedRun(backtests);
        return completedBacktest ? <BacktestResultsSummary backtest={completedBacktest} /> : null;
      })()}

      {/* Total Return - always show even if no completed backtest */}
      {!latestCompletedRun(backtests) && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <TotalReturnBlock bot={bot} size="large" />
        </div>
      )}

      {/* Status Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div>
            <p className="text-gray-400 text-sm mb-2">Status</p>
            <p className="text-white font-bold text-lg">{bot.status.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-2">Category</p>
            <div className="flex flex-col gap-1">
              <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-xs font-medium text-blue-400 inline-block w-fit">
                {bot.category === 'day-trade' ? 'Day trade' : bot.category === 'swing' ? 'Swing' : 'Position'}
              </span>
              {bot.role && (
                <span className="px-2 py-1 bg-gray-700/50 border border-gray-600/50 rounded text-xs text-gray-400 inline-block w-fit">
                  {bot.role === 'alpha' ? 'Alpha' : bot.role === 'risk-sleeve' ? 'Sleeve' : 'Benchmark'}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-2">Strategy</p>
            <p className="text-white font-medium">{bot.strategy.type}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-2">Paper Live</p>
            <p className={`font-bold text-lg ${bot.paperLive ? 'text-green-400' : 'text-gray-400'}`}>
              {bot.paperLive ? 'YES' : 'NO'}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-2">Backtests</p>
            <p className="text-white font-medium">{backtests.length}</p>
          </div>
        </div>
      </div>

      {/* Backtests */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Backtest History</h3>
        </div>

        {backtests.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No backtests yet</p>
        ) : (
          <div className="space-y-3">
            {backtests.map((bt) => {
              const durationLabel = backtestDurationLabel(bt.startDate, bt.endDate);
              
              return (
                <div key={bt.backtestId} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-white font-medium mb-1">{bt.backtestId}</div>
                      {durationLabel && (
                        <div className="text-gray-400 text-xs">
                          {durationLabel}
                        </div>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                      bt.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      bt.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {bt.status}
                    </span>
                  </div>
                  {bt.summary && (
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Return</p>
                        <p className="text-white font-medium">
                          {formatReturnCurrency(
                            bt.summary.finalEquity || 
                            ((bt.initialCapital || 100000) + (bt.summary.totalReturn || 0))
                          )}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {formatReturnPercent(bt.summary.totalReturnPercent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Sharpe</p>
                        <p className="text-white font-medium">
                          {bt.summary.sharpeRatio?.toFixed(2) ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Win Rate</p>
                        <p className="text-white font-medium">
                          {bt.summary.winRate != null ? `${(bt.summary.winRate * 100).toFixed(1)}%` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Trades</p>
                        <p className="text-white font-medium">{bt.summary.totalTrades ?? 0}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-purple-400" />
          <h3 className="text-xl font-semibold text-white">Activity Log</h3>
        </div>

        {activity.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No activity yet</p>
        ) : (
          <div className="space-y-2">
            {activity.map((event) => (
              <div key={event.eventId} className="flex items-start gap-3 py-2">
                <Clock className="w-4 h-4 text-gray-500 mt-1" />
                <div className="flex-1">
                  <p className="text-white text-sm">{event.message}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paper Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-yellow-400/80 text-sm">
            This bot uses Alpaca's paper trading API. No real money is at risk.
          </p>
        </div>
      </div>
    </div>
  );
}
