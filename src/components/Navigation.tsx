import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Clock, Plus, MessageCircle } from 'lucide-react';
import { preloadScreen } from '../lib/preloadRoutes';

export type NavTab = 'home' | 'history' | 'chat';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  onOpenSettings?: () => void;
  onOpenProfileSetup?: () => void;
  onOpenSmartPaste?: () => void;
}

export const Navigation: React.FC<NavigationProps> = React.memo(({
  currentTab,
  onSelectTab,
  onOpenQuickAdd,
}) => {
  const { incomingRequests } = useApp();

  return (
    <nav className="dock" aria-label="Main">
      <button
        type="button"
        onClick={() => onSelectTab('home')}
        className={`tab ${currentTab === 'home' ? 'on' : ''}`}
      >
        <Home className="w-5 h-5" />
        <span>Home</span>
      </button>

      <button
        type="button"
        onMouseEnter={() => preloadScreen('history')}
        onTouchStart={() => preloadScreen('history')}
        onFocus={() => preloadScreen('history')}
        onClick={() => onSelectTab('history')}
        className={`tab ${currentTab === 'history' ? 'on' : ''}`}
      >
        <Clock className="w-5 h-5" />
        <span>History</span>
      </button>

      <button
        type="button"
        onMouseEnter={() => preloadScreen('quickadd')}
        onTouchStart={() => preloadScreen('quickadd')}
        onFocus={() => preloadScreen('quickadd')}
        onClick={onOpenQuickAdd}
        className="fab active-press"
        aria-label="Add expense"
        title="Add expense"
      >
        <Plus className="w-7 h-7 stroke-[2.6]" />
      </button>

      <button
        type="button"
        onMouseEnter={() => preloadScreen('chat')}
        onTouchStart={() => preloadScreen('chat')}
        onFocus={() => preloadScreen('chat')}
        onClick={() => onSelectTab('chat')}
        className={`tab relative ${currentTab === 'chat' ? 'on' : ''}`}
      >
        <MessageCircle className="w-5 h-5" />
        <span>Chats</span>
        {incomingRequests.length > 0 && (
          <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full bg-[#FF5C8A]" />
        )}
      </button>
    </nav>
  );
});
Navigation.displayName = 'Navigation';
