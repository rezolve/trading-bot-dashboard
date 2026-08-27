'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { Order } from '@/lib/types';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/utils';
import { Receipt, X, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'filled' | 'canceled'>('all');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          submittedAt: data.submittedAt?.toDate(),
          filledAt: data.filledAt?.toDate(),
          canceledAt: data.canceledAt?.toDate(),
        } as Order;
      });
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Cancel this order?')) return;
    
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error canceling order:', error);
      alert('Failed to cancel order');
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'open') return ['pending_new', 'accepted', 'new', 'partially_filled'].includes(order.status);
    if (filter === 'filled') return order.status === 'filled';
    if (filter === 'canceled') return ['canceled', 'expired', 'rejected'].includes(order.status);
    return true;
  });

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'filled':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'canceled':
      case 'expired':
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'pending_new':
      case 'accepted':
      case 'new':
      case 'partially_filled':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'filled':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'canceled':
      case 'expired':
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'pending_new':
      case 'accepted':
      case 'new':
      case 'partially_filled':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
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
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
        {['all', 'open', 'filled', 'canceled'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors min-h-[44px] ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-800">
          <h2 className="text-base md:text-lg font-semibold text-white">Orders</h2>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-8 md:p-12 text-center">
            <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No orders found</p>
            <p className="text-gray-600 text-sm mt-2">
              Orders will appear here once submitted
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-800">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white text-lg">{order.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          order.side === 'buy' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {order.side.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${
                        getStatusColor(order.status)
                      }`}>
                        {getStatusIcon(order.status)}
                        <span className="hidden sm:inline">{order.status.replace(/_/g, ' ').toUpperCase()}</span>
                      </div>
                      {['pending_new', 'accepted', 'new', 'partially_filled'].includes(order.status) && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="text-red-400 hover:text-red-300 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Cancel Order"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Type</p>
                      <p className="text-gray-300">{order.orderType.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Quantity</p>
                      <p className="text-white font-medium">
                        {order.qty ? formatNumber(order.qty) : formatCurrency(order.notional || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Limit Price</p>
                      <p className="text-gray-300">{order.limitPrice ? formatCurrency(order.limitPrice) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Filled</p>
                      <p className="text-white font-medium">
                        {formatNumber(order.filledQty)}
                        {order.filledAvgPrice && (
                          <span className="text-xs text-gray-500 ml-1">
                            @ {formatCurrency(order.filledAvgPrice)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[1000px]">
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
                    Qty
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Limit Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Filled
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
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{order.symbol}</span>
                        <span className="text-xs text-gray-500 uppercase">
                          {order.assetClass}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.side === 'buy' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {order.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {order.orderType.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                      {order.qty ? formatNumber(order.qty) : formatCurrency(order.notional || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                      {order.limitPrice ? formatCurrency(order.limitPrice) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                      {formatNumber(order.filledQty)}
                      {order.filledAvgPrice && (
                        <span className="text-xs text-gray-500 ml-2">
                          @ {formatCurrency(order.filledAvgPrice)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded border text-xs font-medium ${
                        getStatusColor(order.status)
                      }`}>
                        {getStatusIcon(order.status)}
                        {order.status.replace(/_/g, ' ').toUpperCase()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {['pending_new', 'accepted', 'new', 'partially_filled'].includes(order.status) && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Cancel Order"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
