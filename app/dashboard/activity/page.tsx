'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { ActivityEvent, ActivityEventType } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { 
  Activity,
  Power,
  Shield,
  Settings,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send
} from 'lucide-react';

const eventIcons: Record<ActivityEventType, any> = {
  bot_started: Power,
  bot_stopped: Power,
  kill_switch_activated: AlertTriangle,
  kill_switch_deactivated: CheckCircle,
  confirmation_mode_enabled: Shield,
  confirmation_mode_disabled: Shield,
  settings_updated: Settings,
  trade_intent_created: Send,
  trade_intent_approved: CheckCircle,
  trade_intent_rejected: XCircle,
  trade_intent_submitted: Send,
  order_filled: CheckCircle,
  order_canceled: XCircle,
  position_opened: TrendingUp,
  position_closed: TrendingUp,
  error: AlertTriangle,
};

const eventColors: Record<ActivityEventType, string> = {
  bot_started: 'text-green-400',
  bot_stopped: 'text-red-400',
  kill_switch_activated: 'text-red-400',
  kill_switch_deactivated: 'text-green-400',
  confirmation_mode_enabled: 'text-yellow-400',
  confirmation_mode_disabled: 'text-gray-400',
  settings_updated: 'text-blue-400',
  trade_intent_created: 'text-blue-400',
  trade_intent_approved: 'text-green-400',
  trade_intent_rejected: 'text-red-400',
  trade_intent_submitted: 'text-blue-400',
  order_filled: 'text-green-400',
  order_canceled: 'text-gray-400',
  position_opened: 'text-green-400',
  position_closed: 'text-blue-400',
  error: 'text-red-400',
};

export default function ActivityPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'bot' | 'trades' | 'errors'>('all');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'activity'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as ActivityEvent;
      });
      setEvents(eventsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'bot') {
      return ['bot_started', 'bot_stopped', 'kill_switch_activated', 'kill_switch_deactivated', 
              'confirmation_mode_enabled', 'confirmation_mode_disabled', 'settings_updated'].includes(event.eventType);
    }
    if (filter === 'trades') {
      return ['trade_intent_created', 'trade_intent_approved', 'trade_intent_rejected', 
              'trade_intent_submitted', 'order_filled', 'order_canceled', 
              'position_opened', 'position_closed'].includes(event.eventType);
    }
    if (filter === 'errors') {
      return event.eventType === 'error';
    }
    return true;
  });

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
        {['all', 'bot', 'trades', 'errors'].map((f) => (
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

      {/* Activity Feed */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-800">
          <h2 className="text-base md:text-lg font-semibold text-white">Activity Log</h2>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-8 md:p-12 text-center">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No activity to display</p>
            <p className="text-gray-600 text-sm mt-2">
              Bot and trading events will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredEvents.map((event) => {
              const Icon = eventIcons[event.eventType] || Activity;
              const color = eventColors[event.eventType] || 'text-gray-400';
              
              return (
                <div key={event.id} className="px-4 md:px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className={`p-2 rounded-lg bg-gray-800 ${color} flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4 mb-1">
                        <p className="text-white font-medium text-sm md:text-base">{event.message}</p>
                        <span className="text-xs sm:text-sm text-gray-500 sm:whitespace-nowrap">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          event.eventType.includes('error') || event.eventType.includes('rejected') || 
                          event.eventType.includes('canceled') || event.eventType.includes('kill_switch_activated')
                            ? 'bg-red-500/20 text-red-400'
                            : event.eventType.includes('approved') || event.eventType.includes('filled') || 
                              event.eventType.includes('opened')
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {event.eventType.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                            View details
                          </summary>
                          <pre className="mt-2 text-xs text-gray-400 bg-gray-800 p-3 rounded overflow-x-auto">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
