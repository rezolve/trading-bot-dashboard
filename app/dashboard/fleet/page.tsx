'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { Bot, BacktestRun } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { 
  Bot as BotIcon,
  Play,
  Pause,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { BacktestProgressPanel } from '@/components/backtest-progress-panel';

export default function FleetPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [runningBacktest, setRunningBacktest] = useState<BacktestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'paper' | 'stopped'>('all');

  useEffect(() => {
    if (!user) return;

    const botsQuery = query(
      collection(db, 'bots'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
    );

    const unsubscribe = onSnapshot(botsQuery, (snapshot) => {
      const botsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          botId: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Bot;
      });

      setBots(botsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for running backtests
  useEffect(() => {
    if (!user) return;

    const backtestQuery = query(
      collection(db, 'backtest-runs'),
      where('userId', '==', user.uid),
      where('status', 'in', ['queued', 'running']),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(backtestQuery, (snapshot) => {
      if (snapshot.empty) {
        setRunningBacktest(null);
        return;
      }

      const data = snapshot.docs[0].data();
      setRunningBacktest({
        ...data,
        backtestId: snapshot.docs[0].id,
        createdAt: data.createdAt?.toDate() || new Date(),
        startedAt: data.startedAt?.toDate(),
        completedAt: data.completedAt?.toDate(),
        startDate: data.startDate?.toDate() || new Date(),
        endDate: data.endDate?.toDate() || new Date(),
        progress: data.progress ? {
          ...data.progress,
          startedAt: data.progress.startedAt?.toDate() || new Date(),
        } : undefined,
      } as BacktestRun);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredBots = filter === 'all' 
    ? bots 
    : bots.filter(bot => bot.status === filter);

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      backtest: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      paper: 'bg-green-500/20 text-green-400 border-green-500/50 animate-pulse',
      stopped: 'bg-red-500/20 text-red-400 border-red-500/50',
    };

    const icons = {
      draft: <Clock className="w-3 h-3" />,
      backtest: <Activity className="w-3 h-3" />,
      paper: <Play className="w-3 h-3" />,
      stopped: <Pause className="w-3 h-3" />,
    };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${styles[status as keyof typeof styles]}`}>
        {icons[status as keyof typeof icons]}
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Bot Fleet</h1>
          <p className="text-gray-400">Monitor and control your trading bot fleet</p>
        </div>
      </div>

      {/* Running Backtest Progress */}
      {runningBacktest && (
        <BacktestProgressPanel 
          backtest={runningBacktest}
          botName={bots.find(b => b.botId === runningBacktest.botId)?.name}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Bots</span>
            <BotIcon className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{bots.length}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Paper Live</span>
            <Play className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-400">
            {bots.filter(b => b.status === 'paper').length}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Ready to Deploy</span>
            <CheckCircle className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {bots.filter(b => b.status === 'backtest').length}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Drafts</span>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-400">
            {bots.filter(b => b.status === 'draft').length}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-800">
        {['all', 'draft', 'backtest', 'paper', 'stopped'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === f
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-2 text-xs">
                ({bots.filter(b => b.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bots List */}
      {filteredBots.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
          <BotIcon className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {filter === 'all' ? 'No bots yet' : `No ${filter} bots`}
          </h3>
          <p className="text-gray-400">
            {filter === 'all'
              ? 'Bots are created and managed by the Trading Bot agent. Once created, they will appear here for monitoring and control.'
              : `You don't have any ${filter} bots at the moment.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredBots.map((bot) => (
            <div
              key={bot.botId}
              onClick={() => router.push(`/dashboard/fleet/${bot.botId}`)}
              className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-blue-500/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-white">{bot.name}</h3>
                    {getStatusBadge(bot.status)}
                    {bot.paperLive && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded border border-yellow-500/50">
                        PAPER
                      </span>
                    )}
                  </div>
                  {bot.description && (
                    <p className="text-gray-400 text-sm">{bot.description}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Strategy</p>
                  <p className="text-white font-medium">{bot.strategy.type}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Signals</p>
                  <p className="text-white font-medium">{bot.signals.length}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Triggers</p>
                  <p className="text-white font-medium">{bot.triggers.length}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Last Updated</p>
                  <p className="text-white font-medium">
                    {new Date(bot.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {bot.lastBacktestId && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>Last backtest: {bot.lastBacktestId}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Paper Trading Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-yellow-400 font-semibold mb-1">Paper Trading Only</h4>
            <p className="text-yellow-400/80 text-sm">
              All bots use Alpaca's paper trading environment. No real money is at risk.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
