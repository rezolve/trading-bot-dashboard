'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Account, BotSettings } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Power,
  AlertTriangle,
  Shield
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const accountUnsubscribe = onSnapshot(
      doc(db, 'accounts', user.uid),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setAccount({
            ...data,
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Account);
        }
      }
    );

    const settingsUnsubscribe = onSnapshot(
      doc(db, 'bot-settings', user.uid),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setSettings({
            ...data,
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as BotSettings);
        }
      }
    );

    // Simple market hours check (9:30 AM - 4:00 PM ET on weekdays)
    const checkMarketHours = () => {
      const now = new Date();
      const day = now.getDay();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      // Weekday check (1 = Monday, 5 = Friday)
      const isWeekday = day >= 1 && day <= 5;
      // Market hours: 9:30 AM (570 min) to 4:00 PM (960 min) - simplified, doesn't account for holidays
      const inMarketHours = timeInMinutes >= 570 && timeInMinutes < 960;
      
      setMarketOpen(isWeekday && inMarketHours);
    };

    checkMarketHours();
    const interval = setInterval(checkMarketHours, 60000);

    return () => {
      accountUnsubscribe();
      settingsUnsubscribe();
      clearInterval(interval);
    };
  }, [user]);

  const todayPL = account ? (account.equity - 100000) : 0;
  const todayPLPercent = account ? ((account.equity - 100000) / 100000) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-medium">Total Equity</span>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {account ? formatCurrency(account.equity) : '---'}
          </p>
          <p className="text-xs text-gray-500">
            {account ? `Updated ${new Date(account.updatedAt).toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-medium">Cash Available</span>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {account ? formatCurrency(account.cash) : '---'}
          </p>
          <p className="text-xs text-gray-500">
            Buying Power: {account ? formatCurrency(account.buyingPower) : '---'}
          </p>
        </div>

        <div className={`bg-gradient-to-br from-gray-900 to-gray-800 border rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow ${
          todayPL >= 0 ? 'border-green-700 bg-green-900/5' : 'border-red-700 bg-red-900/5'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-medium">Today's P&L</span>
            <div className={`p-2 rounded-lg ${
              todayPL >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              {todayPL >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>
          <p className={`text-3xl font-bold mb-1 ${
            todayPL >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatCurrency(todayPL)}
          </p>
          <p className={`text-sm font-semibold ${
            todayPLPercent >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatPercent(todayPLPercent)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-medium">Market Status</span>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-3 h-3 rounded-full ${
              marketOpen ? 'bg-green-400 animate-pulse shadow-lg shadow-green-400/50' : 'bg-gray-600'
            }`}></div>
            <span className="text-2xl font-bold text-white">
              {marketOpen ? 'Open' : 'Closed'}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Options Level: {account?.optionsLevel || 0}
          </p>
        </div>
      </div>

      {/* Bot Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`bg-gradient-to-br from-gray-900 to-gray-800 border rounded-xl p-6 shadow-lg ${
          settings?.killSwitch ? 'border-red-700 bg-red-900/10' : 'border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${
                settings?.killSwitch ? 'bg-red-500/20' : 'bg-gray-800'
              }`}>
                <Power className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Kill Switch</h3>
                <p className="text-xs text-gray-500">Emergency halt control</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-bold ${
              settings?.killSwitch 
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50 animate-pulse' 
                : 'bg-green-500/20 text-green-400 border border-green-500/50'
            }`}>
              {settings?.killSwitch ? '🛑 ACTIVE' : '✓ Inactive'}
            </div>
          </div>
          <p className={`text-sm ${
            settings?.killSwitch ? 'text-red-400' : 'text-gray-400'
          }`}>
            {settings?.killSwitch 
              ? '⚠️ All new orders are halted. Existing positions remain open.' 
              : 'Bot is operational and can execute approved trades.'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${
                settings?.confirmationMode ? 'bg-yellow-500/20' : 'bg-gray-800'
              }`}>
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Confirmation Mode</h3>
                <p className="text-xs text-gray-500">Manual approval required</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-bold ${
              settings?.confirmationMode 
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' 
                : 'bg-gray-700 text-gray-400 border border-gray-700'
            }`}>
              {settings?.confirmationMode ? 'ON' : 'OFF'}
            </div>
          </div>
          <p className="text-sm text-gray-400">
            {settings?.confirmationMode 
              ? 'All trades require manual approval before execution.' 
              : 'Trades execute automatically based on bot logic.'}
          </p>
        </div>
      </div>

      {/* Risk Limits */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-yellow-500/20 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Active Risk Limits</h3>
            <p className="text-sm text-gray-500">Automated safeguards</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Max Notional Per Order</p>
            <p className="text-3xl font-bold text-white">
              {settings ? formatCurrency(settings.maxNotionalPerOrder) : '---'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Per single trade</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Max Position Size</p>
            <p className="text-3xl font-bold text-white">
              {settings ? `${settings.maxPositionPercent}%` : '---'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Of portfolio equity</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Allowed Asset Classes</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {settings?.allowedAssetClasses.map((assetClass) => (
                <span
                  key={assetClass}
                  className="px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-lg text-sm font-semibold"
                >
                  {assetClass.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-5 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h4 className="text-yellow-400 font-bold text-lg mb-2">Paper Trading Account</h4>
            <p className="text-yellow-400/90 text-sm leading-relaxed">
              This dashboard shows SIMULATED data from Alpaca's paper trading environment. 
              All trades are virtual and use fake money. No real capital is at risk. Not investment advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
