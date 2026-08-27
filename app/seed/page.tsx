'use client';

import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SeedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState('');

  const seedData = async () => {
    if (!user) {
      setMessage('❌ Please sign in first');
      return;
    }

    setSeeding(true);
    setMessage('Seeding data...');

    try {
      // Bot Settings
      await setDoc(doc(db, 'bot-settings', user.uid), {
        userId: user.uid,
        killSwitch: false,
        confirmationMode: true,
        maxNotionalPerOrder: 10000,
        maxPositionPercent: 20,
        allowedAssetClasses: ['stock', 'option'],
        updatedAt: new Date(),
      });

      // Account - no dummy data, real account snapshot comes from Functions/agent
      // Removed: PA2J8KXXXX, equity: 103245.67 - never fabricate account numbers or balances

      // Positions
      const positions = [
        {
          userId: user.uid,
          symbol: 'AAPL',
          assetClass: 'stock' as const,
          qty: 100,
          avgEntryPrice: 175.50,
          currentPrice: 182.30,
          marketValue: 18230,
          costBasis: 17550,
          unrealizedPL: 680,
          unrealizedPLPercent: 3.87,
          side: 'long' as const,
          updatedAt: new Date(),
        },
        {
          userId: user.uid,
          symbol: 'TSLA',
          assetClass: 'stock' as const,
          qty: 50,
          avgEntryPrice: 245.80,
          currentPrice: 238.50,
          marketValue: 11925,
          costBasis: 12290,
          unrealizedPL: -365,
          unrealizedPLPercent: -2.97,
          side: 'long' as const,
          updatedAt: new Date(),
        },
        {
          userId: user.uid,
          symbol: 'SPY',
          assetClass: 'stock' as const,
          qty: 75,
          avgEntryPrice: 442.20,
          currentPrice: 448.75,
          marketValue: 33656.25,
          costBasis: 33165,
          unrealizedPL: 491.25,
          unrealizedPLPercent: 1.48,
          side: 'long' as const,
          updatedAt: new Date(),
        },
      ];

      for (const position of positions) {
        await addDoc(collection(db, 'positions'), position);
      }

      // Orders
      const orders = [
        {
          userId: user.uid,
          clientOrderId: 'order-001',
          symbol: 'AAPL',
          assetClass: 'stock' as const,
          side: 'buy' as const,
          orderType: 'limit' as const,
          timeInForce: 'day' as const,
          qty: 100,
          limitPrice: 175.50,
          status: 'filled' as const,
          filledQty: 100,
          filledAvgPrice: 175.48,
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          filledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
        },
        {
          userId: user.uid,
          clientOrderId: 'order-002',
          symbol: 'MSFT',
          assetClass: 'stock' as const,
          side: 'buy' as const,
          orderType: 'limit' as const,
          timeInForce: 'day' as const,
          qty: 50,
          limitPrice: 385.00,
          status: 'new' as const,
          filledQty: 0,
          submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ];

      for (const order of orders) {
        await addDoc(collection(db, 'orders'), order);
      }

      // Trade Intents
      const tradeIntents = [
        {
          userId: user.uid,
          symbol: 'GOOGL',
          assetClass: 'stock' as const,
          side: 'buy' as const,
          orderType: 'limit' as const,
          timeInForce: 'day' as const,
          qty: 30,
          limitPrice: 142.50,
          status: 'pending_approval' as const,
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
          updatedAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ];

      for (const intent of tradeIntents) {
        await addDoc(collection(db, 'trade-intents'), intent);
      }

      // Activity
      const activities = [
        {
          userId: user.uid,
          eventType: 'settings_updated' as const,
          message: 'Bot settings configured',
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          userId: user.uid,
          eventType: 'confirmation_mode_enabled' as const,
          message: 'Confirmation mode enabled - all trades require approval',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        },
        {
          userId: user.uid,
          eventType: 'trade_intent_created' as const,
          message: 'Trade intent created: BUY 30 GOOGL @ $142.50',
          metadata: { symbol: 'GOOGL', side: 'buy', qty: 30 },
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ];

      for (const activity of activities) {
        await addDoc(collection(db, 'activity'), activity);
      }

      setMessage('✅ Demo data seeded successfully! Redirecting to dashboard...');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (error) {
      console.error('Error seeding:', error);
      setMessage('❌ Error seeding data: ' + (error as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <p className="text-white text-xl">Please sign in first</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-8">
      <div className="max-w-2xl w-full bg-gray-900 border border-gray-800 rounded-lg p-8">
        <h1 className="text-3xl font-bold text-white mb-4">Seed Demo Data</h1>
        <p className="text-gray-400 mb-6">
          This will populate your dashboard with sample paper trading data including:
        </p>
        <ul className="text-gray-300 space-y-2 mb-8 list-disc list-inside">
          <li>Bot settings (confirmation mode ON, kill switch OFF)</li>
          <li>Account snapshot ($103,245.67 equity)</li>
          <li>3 open positions (AAPL, TSLA, SPY)</li>
          <li>2 orders (1 filled, 1 open)</li>
          <li>1 trade intent pending approval (GOOGL)</li>
          <li>Activity log events</li>
        </ul>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <p className="text-yellow-400 text-sm">
            <strong>User ID:</strong> {user.uid}
          </p>
          <p className="text-yellow-400 text-sm mt-1">
            <strong>Email:</strong> {user.email}
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.startsWith('✅') 
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : message.startsWith('❌')
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
          }`}>
            {message}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={seedData}
            disabled={seeding}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {seeding ? 'Seeding...' : 'Seed Demo Data'}
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
