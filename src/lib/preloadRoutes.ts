import React from 'react';

// Screen importers
export const loadHistoryView = () =>
  import('../components/HistoryView').then((m) => ({ default: m.HistoryView }));
export const loadChatRoom = () =>
  import('../components/ChatRoom').then((m) => ({ default: m.ChatRoom }));
export const loadWalletSettings = () =>
  import('../components/WalletSettings').then((m) => ({ default: m.WalletSettings }));
export const loadFriendLedgerSheet = () =>
  import('../components/FriendLedgerSheet').then((m) => ({ default: m.FriendLedgerSheet }));
export const loadPublicStatementView = () =>
  import('../components/PublicStatementView').then((m) => ({ default: m.PublicStatementView }));
export const loadAuthScreen = () =>
  import('../components/AuthScreen').then((m) => ({ default: m.AuthScreen }));

// Modal importers
export const loadQuickAddModal = () =>
  import('../components/QuickAddModal').then((m) => ({ default: m.QuickAddModal }));
export const loadEditExpenseModal = () =>
  import('../components/QuickAddModal').then((m) => ({ default: m.EditExpenseModal }));
export const loadSmartPasteModal = () =>
  import('../components/SmartPasteModal').then((m) => ({ default: m.SmartPasteModal }));
export const loadProfileSetupModal = () =>
  import('../components/ProfileSetupModal').then((m) => ({ default: m.ProfileSetupModal }));
export const loadClaimUsernameModal = () =>
  import('../components/ClaimUsernameModal').then((m) => ({ default: m.ClaimUsernameModal }));
export const loadNudgeModal = () =>
  import('../components/NudgeModal').then((m) => ({ default: m.NudgeModal }));
export const loadKhataSettlementModal = () =>
  import('../components/KhataSettlementModal').then((m) => ({ default: m.KhataSettlementModal }));
export const loadTransactionDetailModal = () =>
  import('../components/TransactionDetailModal').then((m) => ({ default: m.TransactionDetailModal }));
export const loadAddFriendModal = () =>
  import('../components/AddFriendModal').then((m) => ({ default: m.AddFriendModal }));
export const loadManageSquadModal = () =>
  import('../components/ManageSquadModal').then((m) => ({ default: m.ManageSquadModal }));

// Lazy components
export const LazyHistoryView = React.lazy(loadHistoryView);
export const LazyChatRoom = React.lazy(loadChatRoom);
export const LazyWalletSettings = React.lazy(loadWalletSettings);
export const LazyFriendLedgerSheet = React.lazy(loadFriendLedgerSheet);
export const LazyPublicStatementView = React.lazy(loadPublicStatementView);
export const LazyAuthScreen = React.lazy(loadAuthScreen);

export const LazyQuickAddModal = React.lazy(loadQuickAddModal);
export const LazyEditExpenseModal = React.lazy(loadEditExpenseModal);
export const LazySmartPasteModal = React.lazy(loadSmartPasteModal);
export const LazyProfileSetupModal = React.lazy(loadProfileSetupModal);
export const LazyClaimUsernameModal = React.lazy(loadClaimUsernameModal);
export const LazyNudgeModal = React.lazy(loadNudgeModal);
export const LazyKhataSettlementModal = React.lazy(loadKhataSettlementModal);
export const LazyTransactionDetailModal = React.lazy(loadTransactionDetailModal);
export const LazyAddFriendModal = React.lazy(loadAddFriendModal);
export const LazyManageSquadModal = React.lazy(loadManageSquadModal);

export function preloadScreen(screen: 'home' | 'history' | 'chat' | 'settings' | 'ledger' | 'quickadd') {
  switch (screen) {
    case 'history':
      loadHistoryView();
      break;
    case 'chat':
      loadChatRoom();
      break;
    case 'settings':
      loadWalletSettings();
      break;
    case 'ledger':
      loadFriendLedgerSheet();
      break;
    case 'quickadd':
      loadQuickAddModal();
      break;
    default:
      break;
  }
}

export function scheduleIdlePreload(currentTab: 'home' | 'history' | 'chat') {
  if (typeof window === 'undefined') return;
  const run = () => {
    if (currentTab === 'home') {
      loadHistoryView();
      loadFriendLedgerSheet();
      loadQuickAddModal();
    } else if (currentTab === 'history') {
      loadChatRoom();
      loadTransactionDetailModal();
    } else if (currentTab === 'chat') {
      loadFriendLedgerSheet();
      loadManageSquadModal();
    }
  };

  if ('requestIdleCallback' in window) {
    const id = (window as any).requestIdleCallback(run, { timeout: 2500 });
    return () => (window as any).cancelIdleCallback(id);
  } else {
    const timer = setTimeout(run, 1200);
    return () => clearTimeout(timer);
  }
}
