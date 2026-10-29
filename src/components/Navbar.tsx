import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { googleSignIn, logout } from '../lib/auth';
import { Avatar, Button, Sheet } from '../ui';
import {
  Bell,
  Home,
  Clock,
  MessageCircle,
  Plus,
  User,
  LogOut,
  Settings,
  Check,
  Globe,
  Share2,
  Copy,
  ExternalLink,
  Trash2,
  Sun,
  Moon,
  Monitor,
  X,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { formatShortDate, formatMonthDisplay } from '../lib/formatters';
import { SHARED_APP_URL, getInviteDeepLink } from '../lib/constants';
import {
  isWebNotificationSupported,
  getWebNotificationPermission,
  requestWebNotificationPermission,
  sendWebNotification,
} from '../lib/webNotification';
import { BrandLogo, SwipeableRow } from '../ui';
import { preloadScreen } from '../lib/preloadRoutes';

export const Navbar: React.FC<{
  currentTab?: 'home' | 'history' | 'chat';
  showSettings?: boolean;
  onOpenQuickAdd?: () => void;
  onOpenSmartPaste?: () => void;
  onOpenSetupChecklist?: () => void;
  onOpenSettings?: () => void;
  onOpenWalletSettings?: () => void;
  onOpenProfileSetup?: () => void;
  onSelectTab?: (tab: 'home' | 'history' | 'chat') => void;
  onNavigateTab?: (tab: 'home' | 'history' | 'chat', directUser?: string | null) => void;
}> = ({
  currentTab = 'home',
  showSettings = false,
  onOpenQuickAdd,
  onOpenSettings,
  onOpenWalletSettings,
  onOpenProfileSetup,
  onSelectTab,
  onNavigateTab,
}) => {
  const handleTabNav = (tab: 'home' | 'history' | 'chat', directUser?: string | null) => {
    if (onNavigateTab) onNavigateTab(tab, directUser);
    else if (onSelectTab) onSelectTab(tab);
  };
  const handleSettingsNav = () => {
    if (onOpenSettings) onOpenSettings();
    else if (onOpenWalletSettings) onOpenWalletSettings();
  };

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
    incomingRequests,
    themeMode,
    setThemeMode,
    showToast,
    appLockPin,
    lockAppNow,
    hideAmounts,
    toggleHideAmounts,
  } = useApp();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'unread' | 'all'>('unread');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [autoDeleteOnRead, setAutoDeleteOnRead] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hisaab_auto_delete_notif') === 'true';
    } catch (_) {
      return false;
    }
  });

  const toggleAutoDelete = () => {
    const nextVal = !autoDeleteOnRead;
    setAutoDeleteOnRead(nextVal);
    try {
      localStorage.setItem('hisaab_auto_delete_notif', String(nextVal));
    } catch (_) {}
    showToast({
      type: 'info',
      message: nextVal
        ? 'Notifications will be deleted when opened.'
        : 'Notifications will stay marked as read.',
    });
  };

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const personalInviteLink = getInviteDeepLink(
    publicProfile?.username || currentUser.uid,
    currentUser.uid
  );

  const handleCopyPreviewLink = () => {
    navigator.clipboard.writeText(SHARED_APP_URL);
    setCopiedPreview(true);
    showToast({
      type: 'success',
      message: 'Universal public preview link copied to clipboard!',
    });
    setTimeout(() => setCopiedPreview(false), 2500);
  };

  const handleCopyPersonalReferral = () => {
    navigator.clipboard.writeText(personalInviteLink);
    setCopiedReferral(true);
    showToast({
      type: 'success',
      message: 'Personal referral invite link copied to clipboard!',
    });
    setTimeout(() => setCopiedReferral(false), 2500);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifMenu(false);
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const unreadNotifs = notifications.filter((n) => !n.read);
  const totalBadges = unreadNotifs.length + incomingRequests.length;

  const [webNotifStatus, setWebNotifStatus] = useState<NotificationPermission | 'unsupported'>(
    getWebNotificationPermission()
  );

  const handleRequestWebNotif = async () => {
    const res = await requestWebNotificationPermission();
    setWebNotifStatus(res);
    if (res === 'granted') {
      showToast({ type: 'success', message: 'Web notifications enabled for Hisaab!' });
      sendWebNotification('Hisaab', {
        body: 'Notifications are on. You will get alerts for new expenses and payments.',
      });
    } else if (res === 'denied') {
      showToast({ type: 'info', message: 'Notifications were blocked in your browser settings.' });
    }
  };

  const monthOptions = React.useMemo(() => {
    const list: { monthKey: string; displayName: string }[] = [];
    const seen = new Set<string>();

    if (Array.isArray(allMonths) && allMonths.length > 0) {
      allMonths.forEach((m) => {
        if (!seen.has(m.monthKey)) {
          seen.add(m.monthKey);
          list.push({
            monthKey: m.monthKey,
            displayName: formatMonthDisplay(m.monthName || m.monthKey),
          });
        }
      });
    }

    if (selectedMonthKey && !seen.has(selectedMonthKey)) {
      seen.add(selectedMonthKey);
      list.push({
        monthKey: selectedMonthKey,
        displayName: formatMonthDisplay(selectedMonthKey),
      });
    }

    list.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    return list;
  }, [allMonths, selectedMonthKey]);

  const handleGoogleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        showToast({
          type: 'success',
          message: `Signed in as ${res.user.displayName || res.user.email}!`,
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        message: err.message || 'Failed to sign in with Google.',
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    showToast({ type: 'info', message: 'Signed out.' });
    setShowUserMenu(false);
  };

  const handleNotificationClick = async (n: any) => {
    if (autoDeleteOnRead) {
      await deleteNotification(n.id);
    } else {
      await markNotificationRead(n.id);
    }
    setShowNotifMenu(false);

    if (onNavigateTab) {
      if (
        n.targetType === 'dm' ||
        n.link?.includes('dm=') ||
        n.title.toLowerCase().includes('message') ||
        n.title.toLowerCase().includes('chat')
      ) {
        let dmUser = n.targetId;
        if (!dmUser && n.link) {
          const match = n.link.match(/dm=([a-zA-Z0-9_-]+)/);
          if (match) dmUser = match[1];
        }
        onNavigateTab('chat', dmUser || null);
      } else if (
        n.targetType === 'chat' ||
        n.title.toLowerCase().includes('squad') ||
        n.title.toLowerCase().includes('group')
      ) {
        onNavigateTab('chat', null);
      } else if (
        n.targetType === 'expense' ||
        n.title.toLowerCase().includes('expense') ||
        n.title.toLowerCase().includes('reminder') ||
        n.title.toLowerCase().includes('nudge') ||
        n.title.toLowerCase().includes('balance')
      ) {
        onNavigateTab('history', null);
      } else {
        onNavigateTab('home', null);
      }
    }
  };

  const userInitial = (currentUser.displayName || 'Z').charAt(0).toUpperCase();

  return (
    <>
      {(showUserMenu || showNotifMenu) && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[3px] animate-in fade-in duration-150"
          onClick={() => {
            setShowUserMenu(false);
            setShowNotifMenu(false);
          }}
          aria-hidden="true"
        />
      )}

      <header className="top">
        {/* Left Brand: Logo on Light Rounded Tile */}
        <button
          type="button"
          onClick={() => handleTabNav('home')}
          className="brand cursor-pointer active-press"
        >
          <BrandLogo size="sm" />
          <span>Hisaab</span>
        </button>

        {/* Center Desktop Navigation Tabs */}
        <nav className="tabs" aria-label="Main">
          <button
            type="button"
            onClick={() => handleTabNav('home')}
            className={`tab ${currentTab === 'home' && !showSettings ? 'on' : ''}`}
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </button>
          <button
            type="button"
            onMouseEnter={() => preloadScreen('history')}
            onTouchStart={() => preloadScreen('history')}
            onFocus={() => preloadScreen('history')}
            onClick={() => handleTabNav('history')}
            className={`tab ${currentTab === 'history' && !showSettings ? 'on' : ''}`}
          >
            <Clock className="w-5 h-5" />
            <span>History</span>
          </button>
          <button
            type="button"
            onMouseEnter={() => preloadScreen('chat')}
            onTouchStart={() => preloadScreen('chat')}
            onFocus={() => preloadScreen('chat')}
            onClick={() => handleTabNav('chat')}
            className={`tab ${currentTab === 'chat' && !showSettings ? 'on' : ''}`}
          >
            <MessageCircle className="w-5 h-5" />
            <span>Chats &amp; Friends</span>
            {incomingRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-[#FF5C8A] text-white">
                {incomingRequests.length}
              </span>
            )}
          </button>
        </nav>

        {/* Right Actions */}
        <div className="act">
          {/* Month Selector Pill */}
          <div className="relative">
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="chip pm cursor-pointer appearance-none pr-6 bg-[var(--surface-2)] text-[var(--tx)] border border-[var(--line)] focus:outline-none text-[13px]"
              title="Select Month"
            >
              {monthOptions.map((m) => (
                <option key={m.monthKey} value={m.monthKey} className="bg-[var(--surface-solid)] text-[var(--tx)]">
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Notification Bell & Panel (Popover on desktop, Full Sheet on mobile) */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifMenu((prev) => !prev);
                setShowUserMenu(false);
              }}
              className="ib"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {totalBadges > 0 && <span className="dot" />}
            </button>

            {showNotifMenu && (
              <div
                role="dialog"
                aria-label="Notifications"
                className="fixed inset-x-0 bottom-0 sm:inset-auto sm:absolute sm:right-0 sm:top-full sm:mt-3 w-full sm:w-[400px] max-h-[88dvh] sm:max-h-[min(560px,calc(100dvh-5.5rem))] rounded-t-[28px] sm:rounded-[28px] bg-[var(--surface-solid)] backdrop-blur-2xl text-[var(--tx)] float-shadow z-50 border-t sm:border border-[var(--line)] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 cq-card"
              >
                {/* Mobile Drag Handle */}
                <div
                  className="sm:hidden flex justify-center pt-3 pb-1 cursor-pointer shrink-0"
                  onClick={() => setShowNotifMenu(false)}
                >
                  <div className="w-10 h-1.5 rounded-full bg-[var(--line)]" />
                </div>

                {/* Panel Header */}
                <div className="px-5 pt-3 sm:pt-4 pb-3 border-b border-[var(--line)] flex items-center justify-between gap-2 shrink-0">
                  <div>
                    <h3 className="text-base font-extrabold text-[var(--tx)] tracking-tight">
                      Notifications
                    </h3>
                    <p className="text-[11px] text-[var(--mu)]">
                      {unreadNotifs.length > 0
                        ? `${unreadNotifs.length} unread update${unreadNotifs.length === 1 ? '' : 's'}`
                        : 'Expenses, settlements & friend alerts'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadNotifs.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllNotifications}
                        className="chip !py-1.5 !px-3 !text-xs text-[var(--em)]"
                      >
                        Mark read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={deleteAllNotifications}
                        className="chip !py-1.5 !px-3 !text-xs text-[var(--ro)]"
                        title="Clear all notifications"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNotifMenu(false)}
                      className="ib sm:!hidden !w-9 !h-9"
                      aria-label="Close notifications"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filter Segmented & Auto-delete Bar */}
                <div className="px-5 py-2.5 border-b border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-between gap-3 shrink-0">
                  <div className="seg !p-1">
                    <button
                      type="button"
                      onClick={() => setNotifFilter('unread')}
                      className={`!py-1 !px-3 !text-xs ${notifFilter === 'unread' ? 'on' : ''}`}
                    >
                      Unread {unreadNotifs.length > 0 && `(${unreadNotifs.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifFilter('all')}
                      className={`!py-1 !px-3 !text-xs ${notifFilter === 'all' ? 'on' : ''}`}
                    >
                      All ({notifications.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={toggleAutoDelete}
                    className="flex items-center gap-2 text-[11px] font-bold text-[var(--mu)] cursor-pointer"
                    title="Delete notification automatically when tapped"
                  >
                    <span>Auto-clear</span>
                    <span className={`tg !w-9 !h-5 ${autoDeleteOnRead ? 'on' : ''}`} />
                  </button>
                </div>

                {/* Browser Notification Prompt Banner */}
                {webNotifStatus !== 'granted' && isWebNotificationSupported() && (
                  <div className="mx-4 mt-3 p-3 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-[10px] bg-[var(--em)]/15 text-[var(--em)] flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[var(--tx)] truncate">
                          Browser push alerts
                        </p>
                        <p className="text-[11px] text-[var(--mu)] truncate">
                          Instant alerts for splits &amp; settlements
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestWebNotif}
                      className="btn primary !py-1.5 !px-3 !text-xs shrink-0"
                    >
                      Allow
                    </button>
                  </div>
                )}

                {/* Notification List (every row >= 64px on mobile) */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {(notifFilter === 'unread' ? unreadNotifs : notifications).length === 0 &&
                  incomingRequests.length === 0 ? (
                    <div className="py-10 px-4 text-center flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center text-[var(--em)]">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-extrabold text-[var(--tx)]">
                        {notifFilter === 'unread' ? 'All caught up' : 'No notifications'}
                      </p>
                      <p className="text-xs text-[var(--mu)] max-w-[220px]">
                        {notifFilter === 'unread'
                          ? 'No unread notifications right now.'
                          : 'You have no notifications in your history.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      {incomingRequests.map((req) => (
                        <div
                          key={req.id}
                          onClick={() => {
                            setShowNotifMenu(false);
                            onNavigateTab?.('chat', req.fromUid || null);
                          }}
                          className="min-h-[64px] p-3.5 rounded-[18px] bg-[var(--em)]/12 border border-[var(--em)]/30 hover:bg-[var(--em)]/20 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-[var(--tx)] truncate">
                              Friend request from @{req.fromUsername}
                            </p>
                            <p className="text-[11px] text-[var(--em)] font-bold mt-0.5">
                              Tap to open Chats and respond →
                            </p>
                          </div>
                          <span className="w-2.5 h-2.5 rounded-full bg-[var(--em)] shrink-0" />
                        </div>
                      ))}

                      {(notifFilter === 'unread' ? unreadNotifs : notifications).map((n) => (
                        <SwipeableRow
                          key={n.id}
                          onSwipeLeft={() => deleteNotification(n.id)}
                          onSwipeRight={!n.read ? () => markNotificationRead(n.id) : undefined}
                          leftActionLabel="Delete"
                          rightActionLabel="Read"
                        >
                          <div
                            className={`group/notif relative min-h-[64px] p-3.5 rounded-[18px] border transition-colors flex items-center justify-between gap-3 ${
                              !n.read
                                ? 'bg-[var(--em)]/10 border-[var(--em)]/30'
                                : 'bg-[var(--surface-2)] border-[var(--line)] opacity-85'
                            }`}
                          >
                            <div
                              onClick={() => handleNotificationClick(n)}
                              className="cursor-pointer min-w-0 flex-1 pr-7"
                            >
                              <div className="flex items-center gap-2">
                                {!n.read && (
                                  <span className="w-2 h-2 rounded-full bg-[var(--em)] shrink-0" />
                                )}
                                <p className="text-xs font-extrabold text-[var(--tx)] truncate">
                                  {n.title}
                                </p>
                              </div>
                              <p className="text-xs text-[var(--mu)] line-clamp-2 mt-0.5 leading-snug">
                                {n.body}
                              </p>
                              <p className="text-[10px] font-bold text-[var(--mu)]/70 mt-1">
                                {formatShortDate(n.createdAt)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(n.id);
                              }}
                              className="ib !w-8 !h-8 shrink-0 text-[var(--mu)] hover:text-[var(--ro)]"
                              title="Delete notification"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </SwipeableRow>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Add Expense Button (Desktop) */}
          {onOpenQuickAdd && (
            <button
              type="button"
              onMouseEnter={() => preloadScreen('quickadd')}
              onTouchStart={() => preloadScreen('quickadd')}
              onClick={onOpenQuickAdd}
              className="btn add sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add expense</span>
            </button>
          )}

          {/* Profile Avatar & User Menu (with Light / Dark / System selector) */}
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowUserMenu((prev) => !prev);
                setShowNotifMenu(false);
              }}
              className="av"
              aria-label="Profile"
              title="Account & Settings"
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                userInitial
              )}
            </button>

            {showUserMenu && (
              <div
                role="dialog"
                aria-label="Account menu"
                className="fixed inset-x-0 bottom-0 sm:inset-auto sm:absolute sm:right-0 sm:top-full sm:mt-3 w-full sm:w-80 rounded-t-[28px] sm:rounded-[28px] bg-[var(--surface-solid)] backdrop-blur-2xl text-[var(--tx)] float-shadow z-50 p-5 space-y-4 border-t sm:border border-[var(--line)] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 cq-card pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              >
                {/* Mobile Drag Handle */}
                <div
                  className="sm:hidden flex justify-center -mt-2 pb-1 cursor-pointer"
                  onClick={() => setShowUserMenu(false)}
                >
                  <div className="w-10 h-1.5 rounded-full bg-[var(--line)]" />
                </div>

                {/* User Header */}
                <div className="flex items-center gap-3.5 pb-3.5 border-b border-[var(--line)]">
                  <Avatar
                    name={currentUser.displayName}
                    photoURL={currentUser.photoURL}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-extrabold truncate text-[var(--tx)]">
                      {currentUser.displayName}
                    </p>
                    <p className="text-xs text-[var(--mu)] truncate">
                      {publicProfile?.username
                        ? `@${publicProfile.username}`
                        : currentUser.email || 'Member'}
                    </p>
                  </div>
                </div>

                {/* Appearance: Light / Dark / System Selector */}
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mu)] block px-1">
                    Appearance
                  </span>
                  <div className="seg w-full grid grid-cols-3 !p-1">
                    <button
                      type="button"
                      onClick={() => setThemeMode('light')}
                      className={`flex items-center justify-center gap-1.5 !py-2 !px-2 !text-xs ${
                        themeMode === 'light' ? 'on' : ''
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setThemeMode('dark')}
                      className={`flex items-center justify-center gap-1.5 !py-2 !px-2 !text-xs ${
                        themeMode === 'dark' ? 'on' : ''
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setThemeMode('system')}
                      className={`flex items-center justify-center gap-1.5 !py-2 !px-2 !text-xs ${
                        themeMode === 'system' ? 'on' : ''
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>System</span>
                    </button>
                  </div>
                </div>

                {/* Menu Actions */}
                <div className="space-y-1.5">
                  {onOpenProfileSetup && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenProfileSetup();
                        setShowUserMenu(false);
                      }}
                      className="w-full min-h-[64px] sm:min-h-[48px] px-3.5 py-2.5 rounded-[16px] text-sm font-bold flex items-center gap-3 bg-[var(--surface-2)] hover:opacity-90 border border-[var(--line)] text-[var(--tx)] cursor-pointer transition-all"
                    >
                      <div className="w-9 h-9 rounded-[12px] bg-[var(--em)]/15 text-[var(--em)] flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-[var(--tx)] truncate">
                          Profile &amp; @username
                        </p>
                        <p className="text-[11px] text-[var(--mu)] truncate">
                          Photo, display name &amp; handle
                        </p>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onMouseEnter={() => preloadScreen('settings')}
                    onTouchStart={() => preloadScreen('settings')}
                    onClick={() => {
                      handleSettingsNav();
                      setShowUserMenu(false);
                    }}
                    className="w-full min-h-[64px] sm:min-h-[48px] px-3.5 py-2.5 rounded-[16px] text-sm font-bold flex items-center gap-3 bg-[var(--surface-2)] hover:opacity-90 border border-[var(--line)] text-[var(--tx)] cursor-pointer transition-all"
                  >
                    <div className="w-9 h-9 rounded-[12px] bg-[var(--su)]/15 text-[var(--su)] flex items-center justify-center shrink-0">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-[var(--tx)] truncate">
                        Wallet &amp; Settings
                      </p>
                      <p className="text-[11px] text-[var(--mu)] truncate">
                        Budget, Gmail reminders &amp; data
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowShareModal(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full min-h-[64px] sm:min-h-[48px] px-3.5 py-2.5 rounded-[16px] text-sm font-bold flex items-center gap-3 bg-[var(--surface-2)] hover:opacity-90 border border-[var(--line)] text-[var(--tx)] cursor-pointer transition-all"
                  >
                    <div className="w-9 h-9 rounded-[12px] bg-[var(--vi)]/15 text-[var(--vi)] flex items-center justify-center shrink-0">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-[var(--tx)] truncate">
                        Invite Link &amp; Share
                      </p>
                      <p className="text-[11px] text-[var(--mu)] truncate">
                        Share Hisaab or your @handle link
                      </p>
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleHideAmounts()}
                      className={`min-h-[48px] px-3 py-2 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 border cursor-pointer transition-all ${
                        hideAmounts
                          ? 'bg-[var(--em)]/15 border-[var(--em)]/40 text-[var(--em)]'
                          : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--tx)] hover:opacity-90'
                      }`}
                    >
                      {hideAmounts ? (
                        <EyeOff className="w-4 h-4 shrink-0" />
                      ) : (
                        <Eye className="w-4 h-4 shrink-0" />
                      )}
                      <span className="truncate">
                        {hideAmounts ? 'Show amounts' : 'Hide amounts'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        if (appLockPin) {
                          lockAppNow();
                        } else {
                          handleSettingsNav();
                        }
                      }}
                      className="min-h-[48px] px-3 py-2 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 bg-[var(--surface-2)] hover:opacity-90 border border-[var(--line)] text-[var(--tx)] cursor-pointer transition-all"
                    >
                      <Lock className="w-4 h-4 text-[var(--vi)] shrink-0" />
                      <span className="truncate">
                        {appLockPin ? 'Lock now' : 'Set PIN lock'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Auth Action */}
                <div className="pt-2 border-t border-[var(--line)]">
                  {firebaseAuthUser ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full min-h-[52px] sm:min-h-[44px] px-3.5 py-2.5 rounded-[16px] text-xs font-extrabold flex items-center justify-center gap-2 text-[var(--ro)] bg-[var(--ro)]/12 border border-[var(--ro)]/30 hover:bg-[var(--ro)]/20 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="btn primary w-full justify-center"
                    >
                      <span>Sign in with Google</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Public Preview & Universal Share Sheet */}
      <Sheet
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share & Invite Friends"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-[20px] bg-[var(--surface-2)] border border-[var(--line)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--tx)] flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[var(--em)]" />
                App URL
              </span>
              <span className="text-[10px] font-semibold text-[var(--em)] bg-[var(--em)]/20 px-2 py-0.5 rounded-full">
                Live
              </span>
            </div>

            <div className="p-2.5 rounded-[12px] bg-black/20 border border-[var(--line)] text-xs text-[var(--em)] break-all select-all">
              {SHARED_APP_URL}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={handleCopyPreviewLink}
                icon={copiedPreview ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copiedPreview ? 'Copied!' : 'Copy App Link'}
              </Button>
              <a
                href={SHARED_APP_URL}
                target="_blank"
                rel="noreferrer"
                className="ib"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="p-4 rounded-[20px] bg-[var(--surface-2)] border border-[var(--line)] space-y-2.5">
            <span className="text-xs font-bold text-[var(--tx)] flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-[var(--em)]" />
              Your Personal Referral Link
            </span>

            <div className="p-2.5 rounded-[12px] bg-black/20 border border-[var(--line)] text-xs text-[var(--tx)] break-all select-all">
              {personalInviteLink}
            </div>

            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={handleCopyPersonalReferral}
              icon={copiedReferral ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedReferral ? 'Copied Referral Link!' : 'Copy Personal Referral Link'}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
};

