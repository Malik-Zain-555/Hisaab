import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { logout } from '../lib/auth';
import { Avatar, Badge, IconButton, Segmented, Card } from '../ui';
import {
  Home,
  Clock3,
  MessageSquareText,
  Plus,
  Bell,
  Sun,
  Moon,
  Laptop,
  LogOut,
  ChevronDown,
  Settings,
  User,
  Check,
  CheckCircle2,
  Trash2,
  CreditCard,
  Receipt,
  UserPlus,
  X,
  Share2,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { formatShortDate } from '../lib/formatters';

export type NavTab = 'home' | 'history' | 'chat';

interface AppShellProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  onOpenSettings: () => void;
  onOpenProfileSetup: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickAdd,
  onOpenSettings,
  onOpenProfileSetup,
  children,
}) => {
  const {
    currentUser,
    publicProfile,
    firebaseAuthUser,
    selectedMonthKey,
    setSelectedMonthKey,
    allMonths,
    notifications,
    markNotificationRead,
    deleteNotification,
    deleteAllNotifications,
    clearAllNotifications,
    darkMode,
    toggleDarkMode,
    incomingRequests,
    showToast,
  } = useApp();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'unread' | 'all'>('unread');
  const [themeMode, setThemeMode] = useState<'system' | 'dark' | 'light'>(() => {
    try {
      const stored = localStorage.getItem('hisaab_theme_preference');
      return (stored as any) || (darkMode ? 'dark' : 'light');
    } catch (_) {
      return darkMode ? 'dark' : 'light';
    }
  });

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click or Esc
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(t)) {
        setShowNotifMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(t)) {
        setShowUserMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifMenu(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleThemeChange = (mode: 'system' | 'dark' | 'light') => {
    setThemeMode(mode);
    try {
      localStorage.setItem('hisaab_theme_preference', mode);
    } catch (_) {}
    if (mode === 'system') {
      const isSysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isSysDark !== darkMode) toggleDarkMode();
    } else if (mode === 'dark' && !darkMode) {
      toggleDarkMode();
    } else if (mode === 'light' && darkMode) {
      toggleDarkMode();
    }
  };

  const unreadNotifs = notifications.filter((n) => !n.read);
  const displayedNotifs =
    notifFilter === 'unread' ? unreadNotifs : notifications;
  const totalBadges = unreadNotifs.length + incomingRequests.length;

  // Month selector options
  const monthOptions = allMonths.map((m) => {
    const [year, month] = m.monthKey.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const displayName = date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    return { monthKey: m.monthKey, displayName };
  });

  const getPageTitle = () => {
    switch (currentTab) {
      case 'home':
        return 'Overview';
      case 'history':
        return 'History & Activity';
      case 'chat':
        return 'Chats & Squads';
      default:
        return 'Hisaab';
    }
  };

  const navItems = [
    { id: 'home' as NavTab, label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'history' as NavTab, label: 'History', icon: <Clock3 className="w-5 h-5" /> },
    {
      id: 'chat' as NavTab,
      label: 'Chats & Friends',
      icon: <MessageSquareText className="w-5 h-5" />,
      badge: incomingRequests.length > 0 ? incomingRequests.length : undefined,
    },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[var(--bg)] text-[var(--text)] flex flex-col antialiased">
      <div className="flex-1 flex w-full max-w-[1200px] mx-auto">
        {/* ============================================================== */}
        {/* DESKTOP (≥1024px: 240px) & TABLET (640-1023px: 72px) SIDEBAR */}
        {/* ============================================================== */}
        <aside className="hidden sm:flex flex-col shrink-0 sm:w-[72px] lg:w-[240px] sticky top-0 h-screen h-[100dvh] p-3 lg:p-4 border-r border-[var(--border)] bg-[var(--surface)] z-30 justify-between select-none">
          {/* Top: Logo & Add Expense */}
          <div className="space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="relative shrink-0">
                <img
                  src="/icon.svg"
                  alt="Hisaab Logo"
                  className="w-10 h-10 rounded-[12px] shadow-sm object-contain"
                />
                {/* Live green dot indicator in header only */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--positive)] ring-2 ring-[var(--surface)]" />
              </div>
              <div className="hidden lg:block">
                <h1 className="font-heading font-extrabold text-lg tracking-tight text-[var(--text)] leading-none">
                  Hisaab
                </h1>
                <p className="text-[11px] font-medium text-[var(--text-muted)] mt-1">
                  Shared Ledger
                </p>
              </div>
            </div>

            {/* Primary Add Expense CTA */}
            <button
              onClick={onOpenQuickAdd}
              className="w-full flex items-center justify-center gap-2 h-11 lg:h-11 rounded-[14px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-slate-950 font-semibold text-sm transition-all shadow-xs active-press cursor-pointer"
              title="Add expense"
            >
              <Plus className="w-4.5 h-4.5 stroke-[2.5] shrink-0" />
              <span className="hidden lg:inline">Add expense</span>
            </button>

            {/* Navigation Links */}
            <nav className="space-y-1 pt-1">
              {navItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center gap-3 h-11 px-3 rounded-[12px] text-sm font-medium transition-all cursor-pointer relative active-press ${
                      isActive
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    title={item.label}
                  >
                    {/* 3px Accent bar on left edge for desktop */}
                    {isActive && (
                      <span className="hidden lg:block absolute left-0 inset-y-2 w-[3px] bg-[var(--accent)] rounded-r-full" />
                    )}
                    <span className="shrink-0">{item.icon}</span>
                    <span className="hidden lg:inline truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-auto hidden lg:inline">
                        <Badge variant="warning">{item.badge}</Badge>
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom: User Card & Menu Anchor */}
          <div className="relative pt-3 border-t border-[var(--border)]" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2.5 p-1.5 rounded-[14px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left active-press"
              title="Account Menu"
            >
              <Avatar
                name={currentUser.displayName || 'You'}
                photoURL={currentUser.photoURL}
                size="md"
              />
              <div className="hidden lg:block min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--text)] truncate">
                  {currentUser.displayName || 'My Account'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">
                  @{publicProfile?.username || 'user'}
                </p>
              </div>
            </button>

            {/* Desktop User Menu Popover */}
            {showUserMenu && (
              <div className="absolute left-0 bottom-full mb-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-[20px] float-shadow p-2 z-50 animate-in fade-in duration-150">
                <div className="p-2.5 border-b border-[var(--border)] mb-1">
                  <p className="text-xs font-bold text-[var(--text)]">
                    {currentUser.displayName}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    @{publicProfile?.username || 'user'}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenProfileSetup();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-2)] transition"
                  >
                    <User className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>Edit profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-2)] transition"
                  >
                    <Settings className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>Wallet & Settings</span>
                  </button>
                </div>

                {/* Appearance Switcher */}
                <div className="p-2 border-t border-[var(--border)] mt-1.5 space-y-1.5">
                  <span className="text-[10px] uppercase font-semibold text-[var(--text-faint)] tracking-wider block">
                    Appearance
                  </span>
                  <div className="grid grid-cols-3 gap-1 bg-[var(--surface-2)] p-0.5 rounded-full text-xs">
                    <button
                      onClick={() => handleThemeChange('light')}
                      className={`py-1 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        themeMode === 'light'
                          ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      <Sun className="w-3 h-3" /> Light
                    </button>
                    <button
                      onClick={() => handleThemeChange('dark')}
                      className={`py-1 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        themeMode === 'dark'
                          ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      <Moon className="w-3 h-3" /> Dark
                    </button>
                    <button
                      onClick={() => handleThemeChange('system')}
                      className={`py-1 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        themeMode === 'system'
                          ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      <Laptop className="w-3 h-3" /> Auto
                    </button>
                  </div>
                </div>

                {/* Sign Out */}
                <div className="pt-1.5 border-t border-[var(--border)] mt-1">
                  <button
                    onClick={async () => {
                      setShowUserMenu(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-semibold text-[var(--negative)] hover:bg-rose-500/10 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ============================================================== */}
        {/* MAIN VIEWPORT CONTAINER */}
        {/* ============================================================== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar for Desktop & Tablet (Inside content area) */}
          <header className="hidden sm:flex items-center justify-between h-16 px-6 border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-20">
            <h2 className="text-xl font-bold font-heading text-[var(--text)]">
              {getPageTitle()}
            </h2>

            <div className="flex items-center gap-3">
              {/* PWA Install pill (only if installable) */}
              <PWAInstallButton variant="pill" />

              {/* Month Switcher Pill Dropdown */}
              <div className="relative">
                <select
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="bg-[var(--surface)] text-xs font-semibold text-[var(--text)] border border-[var(--border)] rounded-full pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer appearance-none shadow-xs"
                >
                  {monthOptions.map((m) => (
                    <option key={m.monthKey} value={m.monthKey}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {/* Notifications Bell */}
              <div className="relative" ref={notifRef}>
                <IconButton
                  variant="surface"
                  icon={
                    <div className="relative">
                      <Bell className="w-4.5 h-4.5" />
                      {totalBadges > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" />
                      )}
                    </div>
                  }
                  aria-label="Notifications"
                  onClick={() => setShowNotifMenu(!showNotifMenu)}
                />

                {/* Desktop Notifications Popover */}
                {showNotifMenu && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-[20px] float-shadow p-3 z-50 animate-in fade-in duration-150 max-h-[460px] flex flex-col">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1 bg-[var(--surface-2)] p-0.5 rounded-full text-xs">
                        <button
                          onClick={() => setNotifFilter('unread')}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
                            notifFilter === 'unread'
                              ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          Unread ({unreadNotifs.length})
                        </button>
                        <button
                          onClick={() => setNotifFilter('all')}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
                            notifFilter === 'all'
                              ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          All ({notifications.length})
                        </button>
                      </div>

                      <button
                        onClick={clearAllNotifications}
                        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] font-medium cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Notifs list */}
                    <div className="overflow-y-auto flex-1 divide-y divide-[var(--border)] py-1">
                      {displayedNotifs.length === 0 ? (
                        <div className="py-8 text-center space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-[var(--positive)] mx-auto opacity-70" />
                          <p className="text-xs font-semibold text-[var(--text)]">
                            You're all caught up
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            No notifications right now.
                          </p>
                        </div>
                      ) : (
                        displayedNotifs.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => markNotificationRead(n.id)}
                            className={`p-2.5 rounded-[12px] transition cursor-pointer text-xs space-y-0.5 ${
                              n.read
                                ? 'opacity-70 hover:opacity-100 hover:bg-[var(--surface-2)]'
                                : 'bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[var(--text)] truncate">
                                {n.title}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                                {formatShortDate(n.createdAt || n.date || '')}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">
                              {n.body}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Top Bar for Mobile (<640px: Compact 56px) */}
          <header className="sm:hidden flex items-center justify-between h-14 px-4 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20 select-none">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img
                src="/icon.svg"
                alt="Hisaab Logo"
                className="w-7 h-7 rounded-[8px]"
              />
              <span className="font-heading font-extrabold text-base text-[var(--text)]">
                Hisaab
              </span>
            </div>

            {/* Center Month Pill */}
            <div className="relative">
              <select
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
                className="bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)] border border-[var(--border)] rounded-full pl-2.5 pr-6 py-1 focus:outline-none appearance-none"
              >
                {monthOptions.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    {m.displayName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)] absolute right-2 top-2 pointer-events-none" />
            </div>

            {/* Right: Bell & Avatar */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNotifMenu(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] relative active-press"
                aria-label="Notifications"
              >
                <Bell className="w-4.5 h-4.5" />
                {totalBadges > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent)]" />
                )}
              </button>

              <button
                onClick={() => setShowUserMenu(true)}
                className="w-8 h-8 rounded-full overflow-hidden active-press"
                aria-label="Profile"
              >
                <Avatar
                  name={currentUser.displayName || 'You'}
                  photoURL={currentUser.photoURL}
                  size="sm"
                />
              </button>
            </div>
          </header>

          {/* Main Children Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 sm:pb-8 max-w-full overflow-x-hidden animate-page-in">
            {children}
          </main>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MOBILE FLOATING BOTTOM DOCK (<640px) */}
      {/* ============================================================== */}
      <div className="sm:hidden fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
        <div className="max-w-[320px] mx-auto pointer-events-auto bg-[var(--surface)]/95 backdrop-blur-xl border border-[var(--border)] rounded-[24px] p-1.5 float-shadow flex items-center justify-around relative">
          {/* Home */}
          <button
            onClick={() => onSelectTab('home')}
            className={`flex flex-col items-center justify-center p-2 rounded-[16px] cursor-pointer active-press transition-colors ${
              currentTab === 'home'
                ? 'text-[var(--accent)] font-semibold'
                : 'text-[var(--text-muted)]'
            }`}
            title="Home"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Home</span>
          </button>

          {/* History */}
          <button
            onClick={() => onSelectTab('history')}
            className={`flex flex-col items-center justify-center p-2 rounded-[16px] cursor-pointer active-press transition-colors ${
              currentTab === 'history'
                ? 'text-[var(--accent)] font-semibold'
                : 'text-[var(--text-muted)]'
            }`}
            title="History"
          >
            <Clock3 className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">History</span>
          </button>

          {/* Center Raised "+" Action Button */}
          <div className="relative -top-4">
            <button
              onClick={onOpenQuickAdd}
              className="w-12 h-12 rounded-[16px] bg-[var(--accent)] text-slate-950 flex items-center justify-center float-shadow active-press cursor-pointer hover:scale-105 transition-transform"
              aria-label="Add expense"
            >
              <Plus className="w-6 h-6 stroke-[3]" />
            </button>
          </div>

          {/* Chats */}
          <button
            onClick={() => onSelectTab('chat')}
            className={`flex flex-col items-center justify-center p-2 rounded-[16px] cursor-pointer active-press transition-colors relative ${
              currentTab === 'chat'
                ? 'text-[var(--accent)] font-semibold'
                : 'text-[var(--text-muted)]'
            }`}
            title="Chats & Friends"
          >
            <MessageSquareText className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Chats</span>
            {incomingRequests.length > 0 && (
              <span className="absolute top-1 right-2">
                <Badge variant="warning" dot />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MOBILE USER MENU BOTTOM SHEET (<640px) */}
      {/* ============================================================== */}
      {showUserMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowUserMenu(false)}
          />
          <div className="relative w-full bg-[var(--surface)] rounded-t-[24px] p-5 space-y-4 border-t border-[var(--border)] z-10 animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 bg-[var(--text-faint)]/40 rounded-full mx-auto" />
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
              <Avatar
                name={currentUser.displayName || 'You'}
                photoURL={currentUser.photoURL}
                size="lg"
              />
              <div>
                <p className="font-heading font-bold text-base text-[var(--text)]">
                  {currentUser.displayName}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  @{publicProfile?.username || 'user'}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenProfileSetup();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-[14px] bg-[var(--surface-2)] text-sm font-medium text-[var(--text)]"
              >
                <User className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-[14px] bg-[var(--surface-2)] text-sm font-medium text-[var(--text)]"
              >
                <Settings className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Wallet & Settings</span>
              </button>
            </div>

            {/* Appearance Segmented */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs text-[var(--text-muted)] font-medium">Appearance</span>
              <div className="grid grid-cols-3 gap-1 bg-[var(--surface-2)] p-1 rounded-full text-xs">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`py-2 rounded-full font-semibold flex items-center justify-center gap-1.5 ${
                    themeMode === 'light'
                      ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" /> Light
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`py-2 rounded-full font-semibold flex items-center justify-center gap-1.5 ${
                    themeMode === 'dark'
                      ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" /> Dark
                </button>
                <button
                  onClick={() => handleThemeChange('system')}
                  className={`py-2 rounded-full font-semibold flex items-center justify-center gap-1.5 ${
                    themeMode === 'system'
                      ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" /> Auto
                </button>
              </div>
            </div>

            <button
              onClick={async () => {
                setShowUserMenu(false);
                await logout();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] bg-rose-500/10 text-[var(--negative)] text-sm font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MOBILE NOTIFICATIONS BOTTOM SHEET (<640px) */}
      {/* ============================================================== */}
      {showNotifMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNotifMenu(false)}
          />
          <div className="relative w-full bg-[var(--surface)] rounded-t-[24px] p-5 max-h-[85vh] flex flex-col space-y-3 border-t border-[var(--border)] z-10 animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 bg-[var(--text-faint)]/40 rounded-full mx-auto" />
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h3 className="font-heading font-bold text-base text-[var(--text)]">
                Notifications
              </h3>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<X className="w-4 h-4" />}
                aria-label="Close"
                onClick={() => setShowNotifMenu(false)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-[var(--surface-2)] p-0.5 rounded-full text-xs">
                <button
                  onClick={() => setNotifFilter('unread')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    notifFilter === 'unread'
                      ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  Unread ({unreadNotifs.length})
                </button>
                <button
                  onClick={() => setNotifFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    notifFilter === 'all'
                      ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  All ({notifications.length})
                </button>
              </div>

              <button
                onClick={clearAllNotifications}
                className="text-xs text-[var(--text-muted)] font-medium"
              >
                Clear all
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-[var(--border)] py-1">
              {displayedNotifs.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-[var(--positive)] mx-auto opacity-70" />
                  <p className="text-sm font-semibold text-[var(--text)]">
                    You're all caught up
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    No new alerts or reminders.
                  </p>
                </div>
              ) : (
                displayedNotifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      markNotificationRead(n.id);
                    }}
                    className={`py-3 px-2 rounded-[12px] space-y-1 ${
                      n.read ? 'opacity-70' : 'bg-[var(--accent-soft)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text)]">{n.title}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {formatShortDate(n.createdAt || n.date || '')}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
