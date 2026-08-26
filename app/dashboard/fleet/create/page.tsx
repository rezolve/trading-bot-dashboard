'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Bot, CheckCircle, ArrowLeft } from 'lucide-react';

export default function CreateBotPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    strategyType: 'sma-crossover' | 'iron-condor-ai' | 'mean-reversion';
    symbol: string;
    fastPeriod: number;
    slowPeriod: number;
    maxNotionalPerOrder: number;
    maxPositionPercent: number;
    allowedAssetClasses: ('stock' | 'option')[];
  }>({
    name: '',
    description: '',
    strategyType: 'sma-crossover',
    symbol: 'SPY',
    fastPeriod: 10,
    slowPeriod: 30,
    maxNotionalPerOrder: 10000,
    maxPositionPercent: 20,
    allowedAssetClasses: ['stock'],
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const botId = `bot_${Date.now()}`;
      const botRef = doc(db, 'bots', botId);

      await setDoc(botRef, {
        botId,
        userId: user.uid,
        name: formData.name,
        description: formData.description,
        status: 'draft',
        strategy: {
          type: formData.strategyType,
          params: {
            symbol: formData.symbol,
            fast_period: formData.fastPeriod,
            slow_period: formData.slowPeriod,
            position_size_pct: 0.20,
          },
        },
        signals: [
          {
            type: 'indicator',
            config: { indicator: 'sma_crossover' },
          },
        ],
        triggers: [
          {
            type: 'scheduled',
            config: { frequency: '1 minute' },
          },
        ],
        riskLimits: {
          maxNotionalPerOrder: formData.maxNotionalPerOrder,
          maxPositionPercent: formData.maxPositionPercent,
          allowedAssetClasses: formData.allowedAssetClasses,
        },
        paperLive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Log activity
      await setDoc(doc(collection(db, 'bot-activity')), {
        botId,
        userId: user.uid,
        eventType: 'bot_created',
        message: `Bot created: ${formData.name}`,
        metadata: { botId, name: formData.name },
        createdAt: new Date(),
      });

      router.push(`/dashboard/fleet/${botId}`);
    } catch (error) {
      console.error('Error creating bot:', error);
      alert('Failed to create bot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Create New Bot</h1>
          <p className="text-gray-400">Configure your trading bot</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bot className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Basic Information</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bot Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="My SMA Bot"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Strategy Configuration */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Strategy Configuration</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Strategy Type *
              </label>
              <select
                value={formData.strategyType}
                onChange={(e) => setFormData({ ...formData, strategyType: e.target.value as any })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sma-crossover">SMA Crossover (Stocks)</option>
                <option value="iron-condor-ai">Iron Condor AI (Options) 🏆 HACKATHON</option>
                <option value="mean-reversion">Mean Reversion (stub)</option>
              </select>
              {formData.strategyType === 'iron-condor-ai' && (
                <p className="text-xs text-yellow-400 mt-2">
                  🏆 Competition strategy for Alpaca AI Hackathon - requires options level 2+
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Symbol *
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                required
                placeholder="SPY"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fast SMA Period *
                </label>
                <input
                  type="number"
                  value={formData.fastPeriod}
                  onChange={(e) => setFormData({ ...formData, fastPeriod: parseInt(e.target.value) })}
                  required
                  min="1"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Slow SMA Period *
                </label>
                <input
                  type="number"
                  value={formData.slowPeriod}
                  onChange={(e) => setFormData({ ...formData, slowPeriod: parseInt(e.target.value) })}
                  required
                  min="1"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Risk Limits */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Risk Limits</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Notional Per Order ($) *
              </label>
              <input
                type="number"
                value={formData.maxNotionalPerOrder}
                onChange={(e) => setFormData({ ...formData, maxNotionalPerOrder: parseInt(e.target.value) })}
                required
                min="0"
                step="100"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Position Size (% of Portfolio) *
              </label>
              <input
                type="number"
                value={formData.maxPositionPercent}
                onChange={(e) => setFormData({ ...formData, maxPositionPercent: parseInt(e.target.value) })}
                required
                min="0"
                max="100"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Allowed Asset Classes *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allowedAssetClasses.includes('stock')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          allowedAssetClasses: [...formData.allowedAssetClasses, 'stock'],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          allowedAssetClasses: formData.allowedAssetClasses.filter(c => c !== 'stock'),
                        });
                      }
                    }}
                    className="w-5 h-5"
                  />
                  <span className="text-white">Stocks</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allowedAssetClasses.includes('option')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          allowedAssetClasses: [...formData.allowedAssetClasses, 'option'],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          allowedAssetClasses: formData.allowedAssetClasses.filter(c => c !== 'option'),
                        });
                      }
                    }}
                    className="w-5 h-5"
                  />
                  <span className="text-white">Options</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {saving ? 'Creating...' : 'Create Bot'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
