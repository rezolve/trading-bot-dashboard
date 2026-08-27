'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { 
  LayoutDashboard, 
  ListOrdered, 
  Receipt, 
  Settings, 
  Activity, 
  LogOut,
  TrendingUp,
  Bot,
  Menu,
  X
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Fleet', href: '/dashboard/fleet', icon: Bot },
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Positions', href: '/dashboard/positions', icon: TrendingUp },
  { name: 'Orders', href: '/dashboard/orders', icon: Receipt },
  { name: 'Trade Desk', href: '/dashboard/trade-desk', icon: ListOrdered },
  { name: 'Bot Settings', href: '/dashboard/settings', icon: Settings },
  { name: 'Activity Log', href: '/dashboard/activity', icon: Activity },
];

// Bottom tab bar shows these key pages on mobile
const mobileBottomTabs = [
  { name: 'Fleet', href: '/dashboard/fleet', icon: Bot },
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Positions', href: '/dashboard/positions', icon: TrendingUp },
  { name: 'Activity', href: '/dashboard/activity', icon: Activity },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  const isActive = (href: string) => {
    return href === '/dashboard' 
      ? pathname === '/dashboard'
      : pathname === href || pathname?.startsWith(href + '/');
  };

  const NavigationItems = ({ mobile = false, onClick }: { mobile?: boolean; onClick?: () => void }) => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group',
              mobile && 'min-h-[44px]', // Touch target
              active
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white hover:shadow-lg'
            )}
          >
            <Icon className={cn(
              'w-5 h-5 transition-transform group-hover:scale-110',
              active && 'drop-shadow-lg'
            )} />
            <span className="font-semibold">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:flex w-64 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-r border-gray-800 flex-col shadow-2xl">
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

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavigationItems />
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="text-sm text-white truncate">{user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors min-h-[44px]"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div className={cn(
        "md:hidden fixed left-0 top-0 bottom-0 w-64 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-r border-gray-800 flex flex-col shadow-2xl z-50 transition-transform duration-300",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-white">Alpaca Bot</h1>
            <p className="text-xs text-gray-500">Operations Dashboard</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavigationItems mobile onClick={() => setMobileMenuOpen(false)} />
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="text-sm text-white truncate">{user.email}</p>
          </div>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleSignOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors min-h-[44px]"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        {/* Mobile Top Bar */}
        <header className="bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 border-b border-gray-800 shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 md:px-8 md:py-5">
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 hover:bg-gray-800 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>
              
              <h2 className="text-lg md:text-3xl font-black text-white">
                {navigation.find((item) => item.href === pathname)?.name || 'Dashboard'}
              </h2>
            </div>
            
            {/* PAPER Badge */}
            <div className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/40 rounded-lg md:rounded-xl shadow-lg shadow-yellow-500/10">
              <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50"></div>
              <span className="text-yellow-400 font-black text-xs md:text-sm tracking-wide hidden sm:inline">PAPER</span>
              <span className="text-yellow-400 font-black text-xs md:text-sm tracking-wide sm:hidden">P</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-gray-950 p-4 md:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-30 safe-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {mobileBottomTabs.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-h-[56px] min-w-[64px]', // Touch target
                  active
                    ? 'text-blue-400'
                    : 'text-gray-400'
                )}
              >
                <Icon className={cn(
                  'w-6 h-6',
                  active && 'drop-shadow-lg'
                )} />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
