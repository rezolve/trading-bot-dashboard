'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { TradeIntent, TradeIntentStatus } from '@/lib/types';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/utils';
import { ListOrdered, Check, X, Send, AlertCircle } from 'lucide-react';

export default function TradeDeskPage() {
  const { user } = useAuth();
  const [intents, setIntents] = useState<TradeIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    symbol: '',
    assetClass: 'stock' as 'stock' | 'option',
    side: 'buy' as 'buy' | 'sell',
    orderType: 'market' as 'market' | 'limit' | 'stop' | 'stop_limit',
    timeInForce: 'day' as 'day' | 'gtc' | 'ioc' | 'fok',
    qty: '',
    notional: '',
    limitPrice: '',
    stopPrice: '',
  });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'trade-intents'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const intentsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          approvedAt: data.approvedAt?.toDate(),
          rejectedAt: data.rejectedAt?.toDate(),
          submittedAt: data.submittedAt?.toDate(),
        } as TradeIntent;
      });
      setIntents(intentsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const intent: Omit<TradeIntent, 'id'> = {
        userId: user.uid,
        symbol: formData.symbol.toUpperCase(),
        assetClass: formData.assetClass,
        side: formData.side,
        orderType: formData.orderType,
        timeInForce: formData.timeInForce,
        qty: formData.qty ? parseFloat(formData.qty) : undefined,
        notional: formData.notional ? parseFloat(formData.notional) : undefined,
        limitPrice: formData.limitPrice ? parseFloat(formData.limitPrice) : undefined,
        stopPrice: formData.stopPrice ? parseFloat(formData.stopPrice) : undefined,
        status: 'pending_approval',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'trade-intents'), intent);
      
      // Reset form
      setFormData({
        symbol: '',
        assetClass: 'stock',
        side: 'buy',
        orderType: 'market',
        timeInForce: 'day',
        qty: '',
        notional: '',
        limitPrice: '',
        stopPrice: '',
      });
      setShowForm(false);
    } catch (error) {
      console.error('Error creating trade intent:', error);
      alert('Failed to create trade intent');
    }
  };

  const handleApprove = async (intentId: string) => {
    try {
      await updateDoc(doc(db, 'trade-intents', intentId), {
        status: 'approved',
        approvedAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error approving intent:', error);
      alert('Failed to approve intent');
    }
  };

  const handleReject = async (intentId: string) => {
    const reason = prompt('Rejection reason (optional):');
    
    try {
      await updateDoc(doc(db, 'trade-intents', intentId), {
        status: 'rejected',
        rejectionReason: reason || 'Rejected by operator',
        rejectedAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error rejecting intent:', error);
      alert('Failed to reject intent');
    }
  };

  const getStatusColor = (status: TradeIntentStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      case 'pending_approval':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'submitted':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'filled':
        return 'bg-green-600/20 text-green-300 border-green-600/50';
      case 'canceled':
        return 'bg-gray-600/20 text-gray-300 border-gray-600/50';
      case 'error':
        return 'bg-red-600/20 text-red-300 border-red-600/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const pendingIntents = intents.filter((i) => i.status === 'pending_approval');

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
          <h2 className="text-2xl font-bold text-white">Trade Desk</h2>
          <p className="text-gray-400 text-sm mt-1">
            Create and manage paper trade intents for bot execution
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          New Trade Intent
        </button>
      </div>

      {/* Pending Approvals Alert */}
      {pendingIntents.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-yellow-400 font-semibold mb-1">
                {pendingIntents.length} {pendingIntents.length === 1 ? 'Intent' : 'Intents'} Pending Approval
              </h4>
              <p className="text-yellow-400/80 text-sm">
                Review and approve trade intents below to allow bot execution
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Trade Intent Form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create Trade Intent</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Symbol <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  required
                  placeholder="AAPL"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Asset Class
                </label>
                <select
                  value={formData.assetClass}
                  onChange={(e) => setFormData({ ...formData, assetClass: e.target.value as 'stock' | 'option' })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="stock">Stock</option>
                  <option value="option">Option</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Side
                </label>
                <select
                  value={formData.side}
                  onChange={(e) => setFormData({ ...formData, side: e.target.value as 'buy' | 'sell' })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Order Type
                </label>
                <select
                  value={formData.orderType}
                  onChange={(e) => setFormData({ ...formData, orderType: e.target.value as any })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                  <option value="stop_limit">Stop Limit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                  placeholder="100"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notional ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.notional}
                  onChange={(e) => setFormData({ ...formData, notional: e.target.value })}
                  placeholder="10000"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {(formData.orderType === 'limit' || formData.orderType === 'stop_limit') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Limit Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.limitPrice}
                    onChange={(e) => setFormData({ ...formData, limitPrice: e.target.value })}
                    placeholder="150.00"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {(formData.orderType === 'stop' || formData.orderType === 'stop_limit') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Stop Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stopPrice}
                    onChange={(e) => setFormData({ ...formData, stopPrice: e.target.value })}
                    placeholder="145.00"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Time in Force
                </label>
                <select
                  value={formData.timeInForce}
                  onChange={(e) => setFormData({ ...formData, timeInForce: e.target.value as any })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="day">Day</option>
                  <option value="gtc">Good Till Canceled</option>
                  <option value="ioc">Immediate or Cancel</option>
                  <option value="fok">Fill or Kill</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Submit for Approval
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trade Intents List */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Trade Intents</h3>
        </div>

        {intents.length === 0 ? (
          <div className="p-12 text-center">
            <ListOrdered className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No trade intents</p>
            <p className="text-gray-600 text-sm mt-2">
              Create a trade intent to submit for approval
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Side
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Qty / Notional
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {intents.map((intent) => (
                  <tr key={intent.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDateTime(intent.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{intent.symbol}</span>
                        <span className="text-xs text-gray-500 uppercase">
                          {intent.assetClass}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        intent.side === 'buy' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {intent.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {intent.orderType.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                      {intent.qty 
                        ? formatNumber(intent.qty) 
                        : formatCurrency(intent.notional || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                      {intent.limitPrice ? formatCurrency(intent.limitPrice) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded border text-xs font-medium ${
                        getStatusColor(intent.status)
                      }`}>
                        {intent.status.replace(/_/g, ' ').toUpperCase()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {intent.status === 'pending_approval' && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprove(intent.id)}
                            className="text-green-400 hover:text-green-300 transition-colors"
                            title="Approve"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleReject(intent.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Reject"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}
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
