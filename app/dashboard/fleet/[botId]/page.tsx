'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db, callTriggerBacktest, callSwapInBot, callSwapOutBot } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Bot, BacktestRun, BotActivityEvent } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Play, Pause, Activity, TrendingUp, Settings,
  AlertCircle, Clock, Loader2
} from 'lucide-react';
import { BacktestProgressPanel } from '@/components/backtest-progress-panel';
import { BacktestResultsSummary } from '@/components/backtest-results-summary';

export default function BotDetailPage({ params }: { params: { botId: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [bot, setBot] = useState<Bot | null>(null);
  const [backtests, setBacktests] = useState<BacktestRun[]>([]);
  const [activity, setActivity] = useState<BotActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadBot = async () => {
      const botDoc = await getDoc(doc(db, 'bots', params.botId));
      if (botDoc.exists()) {
        const data = botDoc.data();
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
      where('botId', '==', params.botId),
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
      where('botId', '==', params.botId),
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
  }, [user, params.botId]);

  const handleRunBacktest = async () => {
    if (!bot) return;
    
    setBacktestLoading(true);
    try {
      // Default to last 60 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 60);
      
      const result = await callTriggerBacktest({
        botId: bot.botId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        initialCapital: 100000,
      });
      
      console.log('Backtest started:', result.data);
      // Backtest will appear in the list via onSnapshot
    } catch (error: any) {
      console.error('Error starting backtest:', error);
      alert(`Failed to start backtest: ${error.message || 'Unknown error'}`);
    } finally {
      setBacktestLoading(false);
    }
  };

  const handleSwapIn = async () => {
    if (!bot) return;
    
    setSwapLoading(true);
    try {
      const result = await callSwapInBot({ botId: bot.botId });
      console.log('Bot swapped in:', result.data);
      // Status will update via onSnapshot
    } catch (error: any) {
      console.error('Error swapping in bot:', error);
      alert(`Failed to swap in bot: ${error.message || 'Unknown error'}`);
    } finally {
      setSwapLoading(false);
    }
  };

  const handleSwapOut = async () => {
    if (!bot) return;
    
    setSwapLoading(true);
    try {
      const result = await callSwapOutBot({ botId: bot.botId });
      console.log('Bot swapped out:', result.data);
      // Status will update via onSnapshot
    } catch (error: any) {
      console.error('Error swapping out bot:', error);
      alert(`Failed to swap out bot: ${error.message || 'Unknown error'}`);
    } finally {
      setSwapLoading(false);
    }
  };

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
        <div className="flex gap-2">
          <button
            onClick={handleRunBacktest}
            disabled={backtestLoading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2"
          >
            {backtestLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5" />
                Run Backtest
              </>
            )}
          </button>
          
          {bot.status === 'paper' ? (
            <button
              onClick={handleSwapOut}
              disabled={swapLoading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2"
            >
              {swapLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Swapping...
                </>
              ) : (
                <>
                  <Pause className="w-5 h-5" />
                  Swap Out
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSwapIn}
              disabled={bot.status === 'draft' || swapLoading}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2"
            >
              {swapLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Swapping...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Swap In
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Running Backtest Progress */}
      {backtests.length > 0 && (backtests[0].status === 'running' || backtests[0].status === 'queued') && (
        <BacktestProgressPanel backtest={backtests[0]} botName={bot.name} />
      )}

      {/* Latest Backtest Results */}
      {backtests.length > 0 && backtests[0].status === 'completed' && (
        <BacktestResultsSummary backtest={backtests[0]} />
      )}

      {/* Status Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-gray-400 text-sm mb-2">Status</p>
            <p className="text-white font-bold text-lg">{bot.status.toUpperCase()}</p>
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
            {backtests.map((bt) => (
              <div key={bt.backtestId} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{bt.backtestId}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
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
                        {bt.summary.totalReturnPercent.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Sharpe</p>
                      <p className="text-white font-medium">
                        {bt.summary.sharpeRatio.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Win Rate</p>
                      <p className="text-white font-medium">
                        {(bt.summary.winRate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Trades</p>
                      <p className="text-white font-medium">{bt.summary.totalTrades}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
