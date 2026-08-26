'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { BotSettings } from '@/lib/types';
import { Power, Shield, AlertTriangle, DollarSign, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    killSwitch: false,
    confirmationMode: true,
    maxNotionalPerOrder: 10000,
    maxPositionPercent: 20,
    allowedAssetClasses: ['stock'] as ('stock' | 'option')[],
  });

  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      const docRef = doc(db, 'bot-settings', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as BotSettings;
        setSettings(data);
        setFormData({
          killSwitch: data.killSwitch,
          confirmationMode: data.confirmationMode,
          maxNotionalPerOrder: data.maxNotionalPerOrder,
          maxPositionPercent: data.maxPositionPercent,
          allowedAssetClasses: data.allowedAssetClasses,
        });
      }
      setLoading(false);
    };

    loadSettings();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    try {
      const updatedSettings: BotSettings = {
        userId: user.uid,
        killSwitch: formData.killSwitch,
        confirmationMode: formData.confirmationMode,
        maxNotionalPerOrder: formData.maxNotionalPerOrder,
        maxPositionPercent: formData.maxPositionPercent,
        allowedAssetClasses: formData.allowedAssetClasses,
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'bot-settings', user.uid), updatedSettings);
      
      // Log activity
      await addDoc(collection(db, 'activity'), {
        userId: user.uid,
        eventType: 'settings_updated',
        message: 'Bot settings updated',
        metadata: updatedSettings,
        createdAt: new Date(),
      });

      setSettings(updatedSettings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleKillSwitch = async () => {
    if (!user) return;
    
    const newValue = !formData.killSwitch;
    setFormData({ ...formData, killSwitch: newValue });
    
    try {
      await setDoc(doc(db, 'bot-settings', user.uid), {
        ...formData,
        userId: user.uid,
        killSwitch: newValue,
        updatedAt: new Date(),
      });

      await addDoc(collection(db, 'activity'), {
        userId: user.uid,
        eventType: newValue ? 'kill_switch_activated' : 'kill_switch_deactivated',
        message: newValue ? 'Kill switch activated - all new orders halted' : 'Kill switch deactivated - bot operational',
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error toggling kill switch:', error);
      alert('Failed to toggle kill switch');
    }
  };

  const handleAssetClassToggle = (assetClass: 'stock' | 'option') => {
    const current = formData.allowedAssetClasses;
    if (current.includes(assetClass)) {
      if (current.length > 1) {
        setFormData({
          ...formData,
          allowedAssetClasses: current.filter((c) => c !== assetClass),
        });
      }
    } else {
      setFormData({
        ...formData,
        allowedAssetClasses: [...current, assetClass],
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Kill Switch Control */}
      <div className={`bg-gray-900 border rounded-lg p-6 ${
        formData.killSwitch ? 'border-red-800' : 'border-gray-800'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Power className="w-6 h-6 text-white" />
            <div>
              <h3 className="text-lg font-semibold text-white">Emergency Kill Switch</h3>
              <p className="text-sm text-gray-400">Immediately halt all new order submissions</p>
            </div>
          </div>
          <button
            onClick={toggleKillSwitch}
            className={`relative inline-flex h-12 w-24 items-center rounded-full transition-colors ${
              formData.killSwitch ? 'bg-red-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-10 w-10 transform rounded-full bg-white transition-transform ${
                formData.killSwitch ? 'translate-x-12' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <div className={`p-3 rounded-lg ${
          formData.killSwitch 
            ? 'bg-red-500/10 border border-red-500/30' 
            : 'bg-green-500/10 border border-green-500/30'
        }`}>
          <p className={`text-sm font-medium ${
            formData.killSwitch ? 'text-red-400' : 'text-green-400'
          }`}>
            {formData.killSwitch 
              ? '⚠️ KILL SWITCH ACTIVE - No new orders will be submitted' 
              : '✓ Bot operational - can submit approved orders'}
          </p>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Confirmation Mode */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-white" />
              <div>
                <h3 className="text-lg font-semibold text-white">Confirmation Mode</h3>
                <p className="text-sm text-gray-400">Require manual approval for all trades</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, confirmationMode: !formData.confirmationMode })}
              className={`relative inline-flex h-12 w-24 items-center rounded-full transition-colors ${
                formData.confirmationMode ? 'bg-yellow-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-10 w-10 transform rounded-full bg-white transition-transform ${
                  formData.confirmationMode ? 'translate-x-12' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-sm text-gray-400">
            {formData.confirmationMode 
              ? 'Every trade must be manually approved in the Trade Desk before execution' 
              : 'Trades execute automatically based on bot logic (use with caution)'}
          </p>
        </div>

        {/* Risk Limits */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Risk Limits</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Notional Per Order ($)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={formData.maxNotionalPerOrder}
                  onChange={(e) => setFormData({ ...formData, maxNotionalPerOrder: parseFloat(e.target.value) })}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Maximum dollar value for a single order</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Position Size (% of Portfolio)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={formData.maxPositionPercent}
                onChange={(e) => setFormData({ ...formData, maxPositionPercent: parseFloat(e.target.value) })}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum percentage of portfolio for any single position</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Allowed Asset Classes
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowedAssetClasses.includes('stock')}
                    onChange={() => handleAssetClassToggle('stock')}
                    className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-white font-medium">Stocks</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowedAssetClasses.includes('option')}
                    onChange={() => handleAssetClassToggle('option')}
                    className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-white font-medium">Options</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">Bot can only trade selected asset classes</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {settings && (
            <p className="text-sm text-gray-500">
              Last updated: {new Date(settings.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </form>

      {/* Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-yellow-400 font-semibold mb-1">Paper Trading Environment</h4>
            <p className="text-yellow-400/80 text-sm">
              These settings control a paper trading bot using simulated funds. 
              Always test thoroughly before considering any live trading implementation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
