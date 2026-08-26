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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Equity</span>
            <DollarSign className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {account ? formatCurrency(account.equity) : '---'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {account ? `Updated ${new Date(account.updatedAt).toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Cash Available</span>
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {account ? formatCurrency(account.cash) : '---'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Buying Power: {account ? formatCurrency(account.buyingPower) : '---'}
          </p>
        </div>

        <div className={`bg-gray-900 border rounded-lg p-6 ${
          todayPL >= 0 ? 'border-green-800' : 'border-red-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Today's P&L</span>
            {todayPL >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
          </div>
          <p className={`text-3xl font-bold ${
            todayPL >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatCurrency(todayPL)}
          </p>
          <p className={`text-xs mt-1 ${
            todayPLPercent >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatPercent(todayPLPercent)}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Market Status</span>
            <Clock className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className={`w-3 h-3 rounded-full ${
              marketOpen ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
            }`}></div>
            <span className="text-xl font-bold text-white">
              {marketOpen ? 'Open' : 'Closed'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Options Level: {account?.optionsLevel || 0}
          </p>
        </div>
      </div>

      {/* Bot Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`bg-gray-900 border rounded-lg p-6 ${
          settings?.killSwitch ? 'border-red-800' : 'border-gray-800'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Power className="w-5 h-5" />
              Kill Switch
            </h3>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
              settings?.killSwitch 
                ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
                : 'bg-green-500/20 text-green-400 border border-green-500/50'
            }`}>
              {settings?.killSwitch ? 'ACTIVE' : 'Inactive'}
            </div>
          </div>
          <p className="text-gray-400 text-sm">
            {settings?.killSwitch 
              ? 'All new orders are halted. Existing positions remain open.' 
              : 'Bot is operational and can execute approved trades.'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Confirmation Mode
            </h3>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
              settings?.confirmationMode 
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' 
                : 'bg-gray-700 text-gray-400 border border-gray-700'
            }`}>
              {settings?.confirmationMode ? 'ON' : 'OFF'}
            </div>
          </div>
          <p className="text-gray-400 text-sm">
            {settings?.confirmationMode 
              ? 'All trades require manual approval before execution.' 
              : 'Trades execute automatically based on bot logic.'}
          </p>
        </div>
      </div>

      {/* Risk Limits */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          Active Risk Limits
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Max Notional Per Order</p>
            <p className="text-2xl font-bold text-white">
              {settings ? formatCurrency(settings.maxNotionalPerOrder) : '---'}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Max Position Size</p>
            <p className="text-2xl font-bold text-white">
              {settings ? `${settings.maxPositionPercent}%` : '---'}
            </p>
            <p className="text-xs text-gray-500 mt-1">of portfolio</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Allowed Asset Classes</p>
            <div className="flex gap-2 mt-2">
              {settings?.allowedAssetClasses.map((assetClass) => (
                <span
                  key={assetClass}
                  className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded text-sm font-medium"
                >
                  {assetClass.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-yellow-400 font-semibold mb-1">Paper Trading Account</h4>
            <p className="text-yellow-400/80 text-sm">
              This dashboard shows SIMULATED data from Alpaca's paper trading environment. 
              All trades are virtual. Not investment advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
