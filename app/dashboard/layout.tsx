'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  ListOrdered, 
  Receipt, 
  Settings, 
  Activity, 
  LogOut,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Positions', href: '/dashboard/positions', icon: TrendingUp },
  { name: 'Orders', href: '/dashboard/orders', icon: Receipt },
  { name: 'Trade Desk', href: '/dashboard/trade-desk', icon: ListOrdered },
  { name: 'Bot Settings', href: '/dashboard/settings', icon: Settings },
  { name: 'Activity Log', href: '/dashboard/activity', icon: Activity },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-r border-gray-800 flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="px-4 py-2 bg-yellow-500/20 border-2 border-yellow-500/50 rounded-lg shadow-lg shadow-yellow-500/20">
              <span className="text-yellow-400 font-black text-sm tracking-wider">⚠️ PAPER</span>
            </div>
          </div>
          <h1 className="text-2xl font-black text-white text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Alpaca Bot
          </h1>
          <p className="text-xs text-gray-500 text-center mt-2 font-medium">
            Operations Dashboard
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group',
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white hover:shadow-lg'
                )}
              >
                <Icon className={cn(
                  'w-5 h-5 transition-transform group-hover:scale-110',
                  isActive && 'drop-shadow-lg'
                )} />
                <span className="font-semibold">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="text-sm text-white truncate">{user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 border-b border-gray-800 px-8 py-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-black text-white">
                {navigation.find((item) => item.href === pathname)?.name || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/40 rounded-xl shadow-lg shadow-yellow-500/10">
              <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50"></div>
              <span className="text-yellow-400 font-black text-sm tracking-wide">PAPER TRADING MODE</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gray-950 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
