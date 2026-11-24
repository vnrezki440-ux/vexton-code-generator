import React from 'react';
import { Home, KeyRound, LogOut, Plus, RefreshCw, Settings, Shield, Wifi } from 'lucide-react';
import type { Translations } from '../i18n/translations';
import type { SyncConnectionStatus } from '../services/syncClient';
import type { AppScreen } from '../types/vpn';

interface AppShellProps {
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onStartCreate: () => void;
  onLogout: () => void;
  isSecurityUnlocked: boolean;
  syncStatus: SyncConnectionStatus;
  connectedDevices: number;
  adminUsername: string;
  t: Translations;
  children: React.ReactNode;
}

export function AppShell({
  activeScreen,
  onNavigate,
  onStartCreate,
  onLogout,
  isSecurityUnlocked,
  syncStatus,
  connectedDevices,
  adminUsername,
  t,
  children,
}: AppShellProps) {
  const navItems: Array<{
    id: AppScreen;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    action: () => void;
  }> = [
    {
      id: 'dashboard',
      label: t.nav.mainPanel,
      mobileLabel: t.nav.mobileHome,
      icon: Home,
      action: () => onNavigate('dashboard'),
    },
    {
      id: 'create',
      label: t.nav.createCode,
      mobileLabel: t.nav.mobileAdd,
      icon: Plus,
      action: onStartCreate,
    },
    {
      id: 'settings',
      label: t.nav.settings,
      mobileLabel: t.nav.mobileSettings,
      icon: Settings,
      action: () => onNavigate('settings'),
    },
    {
      id: 'security_block',
      label: t.nav.securityKey,
      mobileLabel: t.nav.mobileKey,
      icon: KeyRound,
      action: () => onNavigate('security_block'),
    },
  ];

  const syncLabel =
    syncStatus === 'connected'
      ? t.sync.connectedLive
      : syncStatus === 'reconnecting'
        ? t.sync.reconnecting
        : t.sync.offline;

  return (
    <div className="min-h-screen text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-violet-500/15 bg-[#0A0614]/95 backdrop-blur-md">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-violet-500/15">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-500 shadow-md shadow-violet-900/50 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            VEXTON VPN
          </span>
        </div>

        <nav aria-label={t.nav.mainNavLabel} className="flex-1 p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeScreen === item.id ||
              (activeScreen === 'result' && item.id === 'dashboard');
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-violet-600/20 text-violet-200 border border-violet-500/40 shadow-sm shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-violet-950/40 hover:text-white border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-violet-300' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3.5 border-t border-violet-500/15 space-y-2.5">
          <div className="rounded-xl bg-[#110A22] border border-violet-500/20 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-violet-200 whitespace-nowrap">
                {t.nav.localStorageTitle}
              </p>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                  syncStatus === 'connected'
                    ? 'text-emerald-400'
                    : syncStatus === 'reconnecting'
                      ? 'text-amber-300'
                      : 'text-slate-400'
                }`}
              >
                {syncStatus === 'reconnecting' ? (
                  <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Wifi className="w-3 h-3" aria-hidden="true" />
                )}
                <span>
                  {syncStatus === 'connected'
                    ? 'Live'
                    : syncStatus === 'reconnecting'
                      ? '...'
                      : 'Off'}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-400 tabular-nums">
              {t.sync.devicesOnline(Math.max(1, connectedDevices))}
            </p>
            <p className="text-[11px] text-slate-500 leading-snug">
              {isSecurityUnlocked
                ? t.nav.blockUnlockedNote
                : t.nav.blockLockedNote}
            </p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#07040F] hover:bg-violet-950/50 border border-violet-500/20 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <span className="truncate">{adminUsername}</span>
            <span className="inline-flex items-center gap-1.5 text-violet-300 shrink-0">
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.auth.logoutBtn}</span>
            </span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Desktop 64px, Mobile 52px) */}
        <header className="sticky top-0 z-30 h-[52px] lg:h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 border-b border-violet-500/15 bg-[#07040F]/85 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="lg:hidden w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-500 shadow-sm shadow-violet-900/50 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            </div>
            <span className="lg:hidden text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              VEXTON VPN
            </span>
            <span className="hidden lg:inline text-sm font-medium text-slate-300 truncate">
              {t.screens[activeScreen]}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span
              data-testid="sync-status-indicator"
              className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                syncStatus === 'connected'
                  ? 'text-emerald-400'
                  : syncStatus === 'reconnecting'
                    ? 'text-amber-300'
                    : 'text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'connected'
                    ? 'bg-emerald-400'
                    : syncStatus === 'reconnecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-500'
                }`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{syncLabel}</span>
            </span>

            {activeScreen !== 'dashboard' && activeScreen !== 'create' && (
              <button
                type="button"
                onClick={onStartCreate}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 lg:px-4 lg:py-2 min-h-[40px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-md shadow-violet-950/60 transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t.nav.addButton}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              aria-label={t.auth.logoutBtn}
              className="lg:hidden inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#110A22] hover:bg-violet-950/60 border border-violet-500/25 text-xs font-medium text-violet-200 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <LogOut className="w-3.5 h-3.5 text-violet-300 shrink-0" aria-hidden="true" />
              <span>{t.auth.logoutBtn}</span>
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Content with Smooth Screen Transitions */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-24 lg:py-8">
          <div key={activeScreen} className="animate-view-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Thumb-Zone Navigation (64px height + safe area) */}
      <nav
        aria-label={t.nav.mobileNavLabel}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-violet-500/20 bg-[#0A0614]/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-4 h-16 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeScreen === item.id ||
              (activeScreen === 'result' && item.id === 'dashboard');
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center min-h-[44px] px-1 transition-colors ${
                  isActive
                    ? 'text-violet-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[11px] font-medium mt-1 whitespace-nowrap">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
