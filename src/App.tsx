import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Navigation, NavTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { ToastContainer } from './components/ToastContainer';
import { NotificationPromptBanner } from './components/NotificationPromptBanner';
import { AppLockOverlay } from './components/AppLockModal';
import { SplashScreen } from './components/SplashScreen';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { MotionProvider, PageTransition, PageSkeleton, SheetSkeleton } from './ui';
import {
  LazyHistoryView,
  LazyChatRoom,
  LazyWalletSettings,
  LazyPublicStatementView,
  LazyAuthScreen,
  LazyQuickAddModal,
  LazySmartPasteModal,
  LazyProfileSetupModal,
  LazyClaimUsernameModal,
  LazyNudgeModal,
  scheduleIdlePreload,
} from './lib/preloadRoutes';

const MainContent: React.FC = () => {
  const {
    firebaseAuthUser,
    isAuthLoading,
    needsUsernameClaim,
    setNeedsUsernameClaim,
    nudgeTargetFriend,
    setActiveScreen,
  } = useApp();

  // Restore last active tab after reload
  const [currentTab, setCurrentTabState] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hisaab_last_tab');
        if (saved === 'home' || saved === 'history' || saved === 'chat') {
          return saved;
        }
      } catch (_) {}
    }
    return 'home';
  });

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState(false);
  const [isProfileSetupOpen, setIsProfileSetupOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Sync activeScreen with AppContext so Firebase listeners attach only for the viewed screen
  useEffect(() => {
    if (showSettings) {
      setActiveScreen('settings');
    } else {
      setActiveScreen(currentTab);
    }
  }, [currentTab, showSettings, setActiveScreen]);

  // Preload next likely screen on browser idle
  useEffect(() => {
    if (!firebaseAuthUser) return;
    return scheduleIdlePreload(currentTab);
  }, [currentTab, firebaseAuthUser]);

  // Save and restore scroll position per tab across reloads and navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `hisaab_scroll_${showSettings ? 'settings' : currentTab}`;
    try {
      const savedScroll = Number(sessionStorage.getItem(key) || 0);
      if (savedScroll > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: savedScroll, behavior: 'instant' as ScrollBehavior });
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    } catch (_) {}

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          try {
            sessionStorage.setItem(key, String(Math.round(window.scrollY)));
          } catch (_) {}
          ticking = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentTab, showSettings]);

  const setCurrentTab = useCallback((tab: NavTab) => {
    setCurrentTabState(tab);
    setShowSettings(false);
    try {
      localStorage.setItem('hisaab_last_tab', tab);
    } catch (_) {}
  }, []);

  // Check if URL has a public share statement token (?s=<token>)
  const [statementToken, setStatementToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('s');
    }
    return null;
  });

  // Listen for Service Worker NOTIFICATION_CLICK messages to jump to target tab
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        const data = event.data.data || {};
        if (data.tab === 'chat' || data.targetType === 'chat' || data.targetType === 'dm') {
          setCurrentTab('chat');
        } else if (data.targetType === 'expense') {
          setCurrentTab('history');
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [setCurrentTab]);

  // If viewing a public statement link (?s=<token>), render PublicStatementView without requiring sign-in
  if (statementToken) {
    return (
      <Suspense fallback={<PageSkeleton title="Opening statement..." />}>
        <LazyPublicStatementView
          statementToken={statementToken}
          onExit={() => {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('s');
              window.history.replaceState({}, '', url.toString());
            }
            setStatementToken(null);
          }}
        />
      </Suspense>
    );
  }

  // While checking initial Firebase Auth session, show skeleton screen (never a blank screen)
  if (isAuthLoading) {
    return (
      <div className="min-h-screen relative text-[var(--tx)]">
        <div className="bg" aria-hidden="true" />
        <main className="wrap">
          <PageSkeleton title="Loading Hisaab..." />
        </main>
      </div>
    );
  }

  // Require real authentication
  if (!firebaseAuthUser) {
    return (
      <>
        <Suspense fallback={<PageSkeleton title="Loading sign in..." />}>
          <LazyAuthScreen />
        </Suspense>
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen relative text-[var(--tx)]">
      {/* Static CSS-Only Gradient Background */}
      <div className="bg" aria-hidden="true" />

      {/* Top Glass Pill Bar */}
      <Navbar
        currentTab={currentTab}
        showSettings={showSettings}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onNavigateTab={(tab) => setCurrentTab(tab)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenSmartPaste={() => setIsSmartPasteOpen(true)}
        onOpenProfileSetup={() => setIsProfileSetupOpen(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenWalletSettings={() => setShowSettings(true)}
      />

      {/* Main Content Container */}
      <main className="wrap">
        <PageTransition pageKey={showSettings ? 'settings' : currentTab}>
          {showSettings ? (
            <Suspense fallback={<PageSkeleton title="Loading settings..." />}>
              <LazyWalletSettings onClose={() => setShowSettings(false)} />
            </Suspense>
          ) : (
            <>
              {currentTab === 'home' && (
                <Dashboard
                  onOpenQuickAdd={() => setIsQuickAddOpen(true)}
                  onOpenWalletSettings={() => setShowSettings(true)}
                  onSelectTab={(tab) => setCurrentTab(tab)}
                />
              )}
              {currentTab === 'history' && (
                <Suspense fallback={<PageSkeleton title="Loading history..." />}>
                  <LazyHistoryView />
                </Suspense>
              )}
              {currentTab === 'chat' && (
                <Suspense fallback={<PageSkeleton title="Loading chats..." />}>
                  <LazyChatRoom />
                </Suspense>
              )}
            </>
          )}
        </PageTransition>
      </main>

      {/* Mobile Floating Bottom Dock */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenProfileSetup={() => setIsProfileSetupOpen(true)}
        onOpenSmartPaste={() => setIsSmartPasteOpen(true)}
      />

      {/* Code-Split Modals (loaded only when opened) */}
      {isQuickAddOpen && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyQuickAddModal
            isOpen={isQuickAddOpen}
            onClose={() => setIsQuickAddOpen(false)}
          />
        </Suspense>
      )}
      {isSmartPasteOpen && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazySmartPasteModal
            isOpen={isSmartPasteOpen}
            onClose={() => setIsSmartPasteOpen(false)}
          />
        </Suspense>
      )}
      {isProfileSetupOpen && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyProfileSetupModal
            isOpen={isProfileSetupOpen}
            onClose={() => setIsProfileSetupOpen(false)}
          />
        </Suspense>
      )}
      {needsUsernameClaim && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyClaimUsernameModal
            isOpen={needsUsernameClaim}
            onClose={() => setNeedsUsernameClaim(false)}
          />
        </Suspense>
      )}
      {nudgeTargetFriend && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyNudgeModal />
        </Suspense>
      )}

      <NotificationPromptBanner />
      <PWAUpdateToast />
      <AppLockOverlay />
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <MotionProvider>
      <AppProvider>
        <SplashScreen />
        <MainContent />
      </AppProvider>
    </MotionProvider>
  );
}

export default App;
