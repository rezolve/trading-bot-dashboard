'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Position } from '@/lib/types';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';

export default function PositionsPage() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'positions'),
      where('userId', '==', user.uid),
      orderBy('unrealizedPL', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const positionsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Position;
      });
      setPositions(positionsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const totalUnrealizedPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0);
  const totalMarketValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <p className="text-gray-400 text-sm mb-1">Total Positions</p>
          <p className="text-3xl font-bold text-white">{positions.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <p className="text-gray-400 text-sm mb-1">Total Market Value</p>
          <p className="text-3xl font-bold text-white">{formatCurrency(totalMarketValue)}</p>
        </div>
        <div className={`bg-gray-900 border rounded-lg p-6 ${
          totalUnrealizedPL >= 0 ? 'border-green-800' : 'border-red-800'
        }`}>
          <p className="text-gray-400 text-sm mb-1">Total Unrealized P&L</p>
          <p className={`text-3xl font-bold ${
            totalUnrealizedPL >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatCurrency(totalUnrealizedPL)}
          </p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Open Positions</h2>
        </div>
        
        {positions.length === 0 ? (
          <div className="p-12 text-center">
            <MinusCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No open positions</p>
            <p className="text-gray-600 text-sm mt-2">
              Positions will appear here once the bot opens trades
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Side
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Avg Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Market Value
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Unrealized P&L
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    P&L %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {positions.map((position) => (
                  <tr key={position.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{position.symbol}</span>
                        <span className="text-xs text-gray-500 uppercase">
                          {position.assetClass}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        position.side === 'long' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {position.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                      {formatNumber(Math.abs(position.qty))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                      {formatCurrency(position.avgEntryPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                      {formatCurrency(position.currentPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-white font-medium">
                      {formatCurrency(position.marketValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {position.unrealizedPL >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`font-medium ${
                          position.unrealizedPL >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(position.unrealizedPL)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`font-medium ${
                        position.unrealizedPLPercent >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatPercent(position.unrealizedPLPercent)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
