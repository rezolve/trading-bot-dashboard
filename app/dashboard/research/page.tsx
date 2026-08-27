'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { ResearchFamily, BacktestRun } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { FlaskConical, TrendingUp } from 'lucide-react';
import { formatReturnCurrency } from '@/lib/backtest-display';

export default function ResearchPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [families, setFamilies] = useState<ResearchFamily[]>([]);
  const [championBacktests, setChampionBacktests] = useState<Record<string, BacktestRun>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const familiesQuery = query(
      collection(db, 'research-families'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(familiesQuery, (snapshot) => {
      const familiesData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          familyId: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ResearchFamily;
      });

      setFamilies(familiesData);
      setLoading(false);

      // Fetch champion backtests for families with championBotId
      familiesData.forEach(async (family) => {
        if (family.championBotId) {
          const backtestsQuery = query(
            collection(db, 'backtest-runs'),
            where('userId', '==', user.uid),
            where('botId', '==', family.championBotId),
            where('status', '==', 'completed'),
            where('split', '==', 'holdout'),
            orderBy('createdAt', 'desc')
          );

          onSnapshot(backtestsQuery, (snapshot) => {
            if (!snapshot.empty) {
              const data = snapshot.docs[0].data();
              setChampionBacktests((prev) => ({
                ...prev,
                [family.familyId]: {
                  ...data,
                  backtestId: snapshot.docs[0].id,
                  createdAt: data.createdAt?.toDate() || new Date(),
                  startDate: data.startDate?.toDate() || new Date(),
                  endDate: data.endDate?.toDate() || new Date(),
                } as BacktestRun,
              }));
            }
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  // Group families by book
  const familiesByBook = families.reduce((acc, family) => {
    const book = family.book;
    if (!acc[book]) acc[book] = [];
    acc[book].push(family);
    return acc;
  }, {} as Record<string, ResearchFamily[]>);

  const bookLabels: Record<string, string> = {
    'orb': 'ORB',
    'day-trade': 'Day Trade',
    'swing': 'Swing',
    'position': 'Position',
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
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Research</h1>
        <p className="text-sm md:text-base text-gray-400">
          Strategy families, experiments, and performance evolution
        </p>
      </div>

      {families.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
          <FlaskConical className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Research Families</h3>
          <p className="text-gray-400">
            Research families are created by the Trading Bot agent.
          </p>
        </div>
      ) : (
        Object.entries(familiesByBook).map(([book, bookFamilies]) => (
          <div key={book}>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              {bookLabels[book] || book}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bookFamilies.map((family) => {
                const championBacktest = championBacktests[family.familyId];
                const holdoutReturn = championBacktest?.summary?.finalEquity ||
                  (championBacktest?.initialCapital || 100000) + (championBacktest?.summary?.totalReturn || 0);

                return (
                  <div
                    key={family.familyId}
                    onClick={() => router.push(`/dashboard/research/${family.familyId}/`)}
                    className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-blue-500/50 transition-colors cursor-pointer"
                  >
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-white mb-1">{family.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="capitalize">{family.assetClass}</span>
                        <span>•</span>
                        <span className="capitalize">{family.side}</span>
                        {!family.holdsOvernight && (
                          <>
                            <span>•</span>
                            <span>Intraday</span>
                          </>
                        )}
                      </div>
                    </div>

                    {family.championBotId && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Champion</p>
                        <p className="text-sm text-blue-400 font-medium truncate">
                          {family.championBotId}
                        </p>
                      </div>
                    )}

                    {championBacktest && championBacktest.summary && (
                      <div className="border-t border-gray-800 pt-3">
                        <p className="text-xs text-gray-500 mb-1">Last Holdout Return</p>
                        <p className="text-xl font-bold text-white">
                          {formatReturnCurrency(holdoutReturn)}
                        </p>
                        <p className="text-xs text-gray-400">
                          from {formatReturnCurrency(championBacktest.initialCapital || 100000)} start
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
