'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db, callSwapInBot, callSwapOutBot } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { Bot, BacktestRun } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { 
  Bot as BotIcon,
  AlertCircle,
  Lock,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { BacktestProgressPanel } from '@/components/backtest-progress-panel';

export default function FleetPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [runningBacktest, setRunningBacktest] = useState<BacktestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggedBotId, setDraggedBotId] = useState<string | null>(null);
  const [paperMode, setPaperMode] = useState<'PAPER' | 'LIVE'>('PAPER');

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

  const benchBots = bots.filter(bot => !bot.paperLive && bot.status !== 'paper');
  const liveBots = bots.filter(bot => bot.paperLive || bot.status === 'paper');

  const handleSwapIn = async (botId: string) => {
    try {
      await callSwapInBot({ botId });
    } catch (error) {
      console.error('Error swapping in bot:', error);
      alert('Failed to swap in bot');
    }
  };

  const handleSwapOut = async (botId: string) => {
    try {
      await callSwapOutBot({ botId });
    } catch (error) {
      console.error('Error swapping out bot:', error);
      alert('Failed to swap out bot');
    }
  };

  // Desktop drag handlers
  const handleDragStart = (e: React.DragEvent, botId: string) => {
    setDraggedBotId(botId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedBotId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnLive = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedBotId) {
      handleSwapIn(draggedBotId);
    }
    setDraggedBotId(null);
  };

  const handleDropOnBench = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedBotId) {
      handleSwapOut(draggedBotId);
    }
    setDraggedBotId(null);
  };

  const BotCard = ({ bot, showMobileAction }: { bot: Bot; showMobileAction?: 'swapIn' | 'swapOut' }) => {
    const isLive = bot.paperLive || bot.status === 'paper';
    
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, bot.botId)}
        onDragEnd={handleDragEnd}
        className={`bg-gray-900 border rounded-lg p-4 cursor-move hover:border-blue-500/50 transition-colors ${
          draggedBotId === bot.botId ? 'opacity-50' : ''
        } ${isLive ? 'border-green-500/30' : 'border-gray-800'}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div 
            className="flex-1 cursor-pointer"
            onClick={() => router.push(`/dashboard/fleet/${bot.botId}/`)}
          >
            <h3 className="text-base md:text-lg font-semibold text-white mb-1">{bot.name}</h3>
            <p className="text-xs md:text-sm text-gray-400 line-clamp-2">{bot.description}</p>
          </div>
          {isLive && (
            <div className="ml-2 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded text-xs font-bold text-green-400 whitespace-nowrap">
              LIVE
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span>{bot.strategy.type}</span>
          <span className="capitalize">{bot.status}</span>
        </div>

        {/* Mobile tap control */}
        {showMobileAction && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (showMobileAction === 'swapIn') {
                handleSwapIn(bot.botId);
              } else {
                handleSwapOut(bot.botId);
              }
            }}
            className={`md:hidden w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px] ${
              showMobileAction === 'swapIn'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {showMobileAction === 'swapIn' ? (
              <>
                <ArrowRight className="w-4 h-4" />
                Send to Live
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Return to Bench
              </>
            )}
          </button>
        )}
      </div>
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
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Bot Fleet</h1>
        <p className="text-sm md:text-base text-gray-400">
          Drag bots to Live to start paper trading (desktop) or use tap controls (mobile)
        </p>
      </div>

      {/* Running Backtest Progress */}
      {runningBacktest && (
        <BacktestProgressPanel 
          backtest={runningBacktest}
          botName={bots.find(b => b.botId === runningBacktest.botId)?.name}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Bots</span>
            <BotIcon className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{bots.length}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">On Bench</span>
            <BotIcon className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-400">{benchBots.length}</p>
        </div>

        <div className="bg-gray-900 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Paper Live</span>
            <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          <p className="text-2xl font-bold text-green-400">{liveBots.length}</p>
        </div>
      </div>

      {/* Two-Column Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bench Column */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDropOnBench}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Bench</h2>
            <span className="text-sm text-gray-500">{benchBots.length} bots</span>
          </div>

          <div className="bg-gray-900/50 border-2 border-dashed border-gray-800 rounded-lg min-h-[400px] p-4">
            {benchBots.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <BotIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No bots on bench</p>
                  <p className="text-gray-600 text-sm mt-1">
                    All bots are paper-live or will appear here when returned to bench
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {benchBots.map((bot) => (
                  <BotCard key={bot.botId} bot={bot} showMobileAction="swapIn" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Column */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDropOnLive}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Live
              <div className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-xs font-bold text-yellow-400">
                PAPER
              </div>
            </h2>

            {/* Paper/Live Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setPaperMode('PAPER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors min-h-[44px] ${
                  paperMode === 'PAPER'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                    : 'bg-gray-800 text-gray-500 border border-gray-700'
                }`}
              >
                PAPER
              </button>
              <button
                disabled
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed flex items-center gap-1 min-h-[44px]"
                title="Real-money live trading is disabled"
              >
                <Lock className="w-3 h-3" />
                LIVE
              </button>
            </div>
          </div>

          {/* Live Mode Notice */}
          {paperMode === 'LIVE' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <Lock className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 text-sm font-semibold">Live Trading Disabled</p>
                <p className="text-red-400/80 text-xs mt-1">
                  Real-money live trading is off until explicitly enabled
                </p>
              </div>
            </div>
          )}

          <div className="bg-gray-900/50 border-2 border-dashed border-green-500/30 rounded-lg min-h-[400px] p-4">
            {liveBots.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No bots paper-live</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Drag bots here (desktop) or tap "Send to Live" (mobile)
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {liveBots.map((bot) => (
                  <BotCard key={bot.botId} bot={bot} showMobileAction="swapOut" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-blue-400 font-semibold mb-1">How It Works</h4>
            <ul className="text-blue-400/80 text-sm space-y-1">
              <li><strong>Desktop:</strong> Drag bots between columns to start/stop paper trading</li>
              <li><strong>Mobile:</strong> Use "Send to Live" / "Return to Bench" buttons on each card</li>
              <li><strong>Paper Only:</strong> All trading is Alpaca paper mode. Real-money live is disabled.</li>
              <li><strong>Backtests:</strong> Trading Bot agent runs backtests. View results in bot detail pages.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
