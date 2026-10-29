import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  UserProfile,
  PublicProfile,
  FriendRequest,
  Friendship,
  DmMessage,
  DmThread,
  Expense,
  LedgerEntry,
  MonthData,
  PaymentClaim,
  ChatMessage,
  CommentItem,
  ReactionItem,
  AppNotification,
  QueuedEmail,
  AuditLogEntry,
  ShareLinkDoc,
  SquadGroupConfig,
  SquadInvitation,
  SettlementRecord,
  PaymentMethod,
  PaymentMethodDetail,
  ExpenseCategory,
  ExpenseActivityEntry,
  FixedExpense,
} from '../types';
import { auth, db, testConnection, removeUndefined } from '../lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

// Wrappers that guarantee no undefined values ever reach Firestore
const setDoc = (ref: any, data: any, options?: any) =>
  options ? fbSetDoc(ref, removeUndefined(data), options) : fbSetDoc(ref, removeUndefined(data));
const updateDoc = (ref: any, data: any) => fbUpdateDoc(ref, removeUndefined(data));
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  queueNotificationEmail,
  buildHisaabEmailHtml,
  formatPaymentMethodsText,
  processPendingMailQueue,
  sendNotificationEmailViaBackend,
} from '../lib/gmail';
import { calculateFriendBalance, formatPKR, formatShortDate, formatMonthDisplay } from '../lib/formatters';
import { sendWebNotification, playNudgeChime, triggerHaptic } from '../lib/webNotification';
import { requestFcmToken, listenToForegroundFcmMessages, sendPushNotificationToUser } from '../lib/fcmService';
import {
  getOrCreateShareLink,
  updateShareLinkSnapshot,
  revokeShareLink,
  regenerateShareLink,
} from '../lib/shareTokens';
import { SHARED_APP_URL, getStatementShareLink } from '../lib/constants';
import {
  claimUsername,
  sendFriendRequest,
  acceptFriendRequest,
  updateRequestStatus,
  removeFriendship,
  getSortedUidPair,
  notifyMentions,
  sendDmMessage,
} from '../lib/friendsService';

interface Toast {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  undoAction?: () => void;
  duration?: number;
}

interface AppContextType {
  currentUser: UserProfile;
  publicProfile: PublicProfile | null;
  firebaseAuthUser: User | null;
  isAuthLoading: boolean;
  setCurrentUser: (user: UserProfile) => void;
  allUsers: UserProfile[];
  friends: UserProfile[];
  claimMyUsername: (username: string) => Promise<{ success: boolean; error?: string }>;
  updatePaymentMethods: (methods: PaymentMethodDetail[]) => Promise<void>;
  needsUsernameClaim: boolean;
  setNeedsUsernameClaim: (val: boolean) => void;
  addCustomFriend: (data: {
    displayName: string;
    phone?: string;
    email?: string;
    initialBalance?: number;
    notes?: string;
  }) => Promise<string>;

  // Friend Requests & Relationships
  friendRequests: FriendRequest[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  friendships: Friendship[];
  sendRequestToUser: (toUid: string, toUsername: string, toDisplayName: string, ledgerFriendId?: string) => Promise<void>;
  acceptIncomingRequest: (request: FriendRequest) => Promise<void>;
  declineIncomingRequest: (requestId: string) => Promise<void>;
  cancelOutgoingRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  unfriendUser: (pairIdOrUid: string) => Promise<void>;

  // DMs
  dmThreads: DmThread[];

  // Data
  currentMonth: MonthData;
  allMonths: MonthData[];
  selectedMonthKey: string;
  setSelectedMonthKey: (key: string) => void;
  updateMonthBudget: (budget: number, carryOver: number, openingBalance: number) => Promise<void>;
  addFixedExpense: (
    title: string,
    amount: number,
    date: string,
    options?: {
      dueDay?: number;
      isShared?: boolean;
      splitFriendIds?: string[];
      category?: ExpenseCategory;
    }
  ) => Promise<void>;
  deleteFixedExpense: (id: string) => Promise<void>;
  triggerFixedBillSplit: (billId: string) => Promise<void>;
  toggleFixedExpensePaid: (id: string) => Promise<void>;
  startNewMonth: (newMonthKey: string, budget: number) => Promise<void>;

  expenses: Expense[];
  activeExpenses: Expense[];
  trashExpenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'status'>) => Promise<string>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  disputeExpense: (expenseId: string, note: string) => Promise<void>;
  resolveExpenseDispute: (expenseId: string, resolutionNote?: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  undoDeleteExpense: (id: string) => Promise<void>;
  permanentlyDeleteExpense: (id: string) => Promise<void>;

  ledgerEntries: LedgerEntry[];
  activeLedgerEntries: LedgerEntry[];
  addLedgerEntry: (entry: Omit<LedgerEntry, 'id' | 'createdAt'>) => Promise<void>;
  updateLedgerEntry: (id: string, updates: Partial<LedgerEntry>) => Promise<void>;
  deleteLedgerEntry: (id: string) => Promise<void>;
  friendBalance: (friendId: string) => number;
  sendNudge: (friendId: string) => Promise<void>;

  // Share Links
  shareLinksMap: { [friendId: string]: ShareLinkDoc };
  getFriendShareUrl: (friendId: string) => string;
  regenerateLink: (friendId: string) => Promise<string>;
  revokeLink: (friendId: string) => Promise<void>;

  paymentClaims: PaymentClaim[];
  submitPaymentClaim: (amount: number, note?: string) => Promise<void>;
  resolvePaymentClaim: (claimId: string, confirmed: boolean) => Promise<void>;

  settlements: SettlementRecord[];
  logSettlement: (data: {
    recipientId: string;
    recipientName: string;
    amount: number;
    method: PaymentMethod;
    referenceId?: string;
    note?: string;
    proofUrl?: string;
    date?: string;
  }) => Promise<SettlementRecord>;

  chatMessages: ChatMessage[];
  sendChatMessage: (
    text: string,
    sharedCard?: {
      type: 'expense' | 'balance';
      title: string;
      amount: number;
      details?: string;
    },
    targetSquadId?: string,
    mediaOptions?: {
      mediaType?: 'text' | 'image' | 'audio' | 'nudge';
      imageUrl?: string;
      audioUrl?: string;
      audioDuration?: number;
    }
  ) => Promise<void>;
  editChatMessage: (id: string, text: string) => Promise<{ success: boolean; error?: string }>;
  deleteChatMessage: (id: string) => Promise<void>;
  deleteChatMessageForEveryone: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteChatMessageForMe: (id: string) => Promise<void>;
  clearEntireSquadChat: (squadId: string, deleteForEveryone?: boolean) => Promise<void>;
  toggleSquadMessageReaction: (messageId: string, emoji: string) => Promise<void>;
  chatMessageLimit: number;
  hasMoreChatMessages: boolean;
  loadMoreChatMessages: () => void;

  // Squad Groups (Multiple Private WhatsApp-style Groups)
  squadGroups: SquadGroupConfig[];
  squadGroup: SquadGroupConfig | null;
  activeSquadId: string | null;
  setActiveSquadId: (id: string | null) => void;
  squadInvitations: SquadInvitation[];
  createSquadGroup: (data: {
    name: string;
    description?: string;
    avatarIcon?: string;
    initialMemberUids?: string[];
  }) => Promise<string>;
  joinSquadByInviteCode: (
    code: string
  ) => Promise<{ success: boolean; squad?: SquadGroupConfig; error?: string }>;
  respondToSquadInvitation: (invitationId: string, accept: boolean) => Promise<void>;
  sendSquadInvitation: (squadId: string, recipientUid: string) => Promise<void>;
  leaveSquadGroup: (squadId: string) => Promise<void>;
  deleteSquadGroup: (squadId: string) => Promise<void>;

  updateSquadConfig: (updates: Partial<SquadGroupConfig>, targetSquadId?: string) => Promise<void>;
  addSquadMember: (uid: string, targetSquadId?: string) => Promise<void>;
  removeSquadMember: (uid: string, targetSquadId?: string) => Promise<void>;
  toggleSquadAdmin: (uid: string, targetSquadId?: string) => Promise<void>;
  transferSquadOwnership: (newOwnerUid: string, targetSquadId?: string) => Promise<void>;

  comments: CommentItem[];
  addComment: (targetType: 'expense' | 'ledger', targetId: string, text: string) => Promise<void>;

  reactions: ReactionItem[];
  toggleReaction: (targetType: 'expense' | 'message' | 'ledger', targetId: string, emoji: string) => Promise<void>;

  notifications: AppNotification[];
  markNotificationRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  clearNotificationsForTarget: (targetType: 'chat' | 'expense' | 'dm', targetId?: string) => Promise<void>;
  nudgeTargetFriend: { friend: UserProfile; balance: number; subject: string; textBody: string } | null;
  setNudgeTargetFriend: (val: { friend: UserProfile; balance: number; subject: string; textBody: string } | null) => void;

  queuedEmails: QueuedEmail[];
  triggerMailQueueProcess: () => Promise<{ sent: number; failed: number }>;

  auditLogs: AuditLogEntry[];

  // App UI State & Screen Lock
  darkMode: boolean;
  themeMode: 'light' | 'dark' | 'system';
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  toggleDarkMode: () => void;
  appLockPin: string | null;
  isAppLocked: boolean;
  hideAmounts: boolean;
  setAppLockPin: (pin: string | null) => void;
  unlockApp: (pin: string) => boolean;
  lockAppNow: () => void;
  toggleHideAmounts: () => void;
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Setup / Sample State
  isSampleLoaded: boolean;
  loadSampleData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  isOwnerMode: boolean;
  isOnline: boolean;
  activeScreen: 'home' | 'history' | 'chat' | 'settings' | 'ledger';
  setActiveScreen: (screen: 'home' | 'history' | 'chat' | 'settings' | 'ledger') => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state (Light / Dark / System)
  const [themeMode, setThemeModeState] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hisaab_theme_mode') || localStorage.getItem('hisaab_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    }
    return 'dark';
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const darkMode = themeMode === 'system' ? systemDark : themeMode === 'dark';

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body?.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body?.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('hisaab_theme', themeMode);
    localStorage.setItem('hisaab_theme_mode', themeMode);
  }, [darkMode, themeMode]);

  const setThemeMode = (mode: 'light' | 'dark' | 'system') => {
    setThemeModeState(mode);
  };

  const toggleDarkMode = () => {
    setThemeModeState((prev) => {
      const currentDark = prev === 'system' ? systemDark : prev === 'dark';
      return currentDark ? 'light' : 'dark';
    });
  };

  // App Lock (4-digit PIN screen lock on open & after 2 minutes in background) + Hide Amounts
  const [appLockPin, setAppLockPinState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hisaab_app_lock_pin');
        if (saved && /^\d{4}$/.test(saved)) return saved;
      } catch (_) {}
    }
    return null;
  });

  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hisaab_app_lock_pin');
        return Boolean(saved && /^\d{4}$/.test(saved));
      } catch (_) {}
    }
    return false;
  });

  const [hideAmounts, setHideAmounts] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hide') === '1';
        if (saved && typeof document !== 'undefined') {
          document.body.classList.add('hide');
        }
        return saved;
      } catch (_) {}
    }
    return false;
  });

  const toggleHideAmounts = useCallback(() => {
    setHideAmounts((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('hide', next);
      }
      try {
        localStorage.setItem('hide', next ? '1' : '0');
      } catch (_) {}
      return next;
    });
  }, []);

  const backgroundTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (!appLockPin || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        backgroundTimestampRef.current = Date.now();
      } else {
        if (
          backgroundTimestampRef.current &&
          Date.now() - backgroundTimestampRef.current >= 2 * 60 * 1000
        ) {
          setIsAppLocked(true);
        }
        backgroundTimestampRef.current = null;
      }
    };

    const handleWindowBlur = () => {
      if (!backgroundTimestampRef.current) {
        backgroundTimestampRef.current = Date.now();
      }
    };

    const handleWindowFocus = () => {
      if (
        backgroundTimestampRef.current &&
        Date.now() - backgroundTimestampRef.current >= 2 * 60 * 1000
      ) {
        setIsAppLocked(true);
      }
      backgroundTimestampRef.current = null;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [appLockPin]);

  const setAppLockPin = useCallback((pin: string | null) => {
    if (pin && /^\d{4}$/.test(pin)) {
      setAppLockPinState(pin);
      try {
        localStorage.setItem('hisaab_app_lock_pin', pin);
      } catch (_) {}
    } else {
      setAppLockPinState(null);
      setIsAppLocked(false);
      try {
        localStorage.removeItem('hisaab_app_lock_pin');
      } catch (_) {}
    }
  }, []);

  const unlockApp = useCallback(
    (enteredPin: string): boolean => {
      if (!appLockPin || enteredPin === appLockPin) {
        setIsAppLocked(false);
        backgroundTimestampRef.current = null;
        return true;
      }
      return false;
    },
    [appLockPin]
  );

  const lockAppNow = useCallback(() => {
    if (appLockPin) {
      setIsAppLocked(true);
    }
  }, [appLockPin]);

  // Connectivity & Background Sync
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine ?? true);
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      testConnection().then((connected) => {
        if (!connected) setIsOnline(false);
      });
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to Service Worker Background Sync triggers
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'TRIGGER_BACKGROUND_SYNC') {
        console.log('[BackgroundSync] Trigger received from Service Worker:', event.data.tag);
        testConnection().then((connected) => {
          if (connected) setIsOnline(true);
        });
      }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  const getStoredReadNotifIds = useCallback((): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('hisaab_read_notif_ids');
      if (raw) return new Set(JSON.parse(raw));
    } catch (_) {}
    return new Set();
  }, []);

  const saveStoredReadNotifId = useCallback((id: string) => {
    if (typeof window === 'undefined') return;
    try {
      const set = getStoredReadNotifIds();
      set.add(id);
      localStorage.setItem('hisaab_read_notif_ids', JSON.stringify(Array.from(set).slice(-300)));
    } catch (_) {}
  }, [getStoredReadNotifIds]);

  const saveStoredReadNotifIds = useCallback((ids: string[]) => {
    if (typeof window === 'undefined') return;
    try {
      const set = getStoredReadNotifIds();
      ids.forEach((i) => set.add(i));
      localStorage.setItem('hisaab_read_notif_ids', JSON.stringify(Array.from(set).slice(-300)));
    } catch (_) {}
  }, [getStoredReadNotifIds]);

  // Toasts with robust deduplication (ignores trailing punctuation & identical recent messages)
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastToastRef = React.useRef<{ message: string; timestamp: number } | null>(null);
  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const now = Date.now();
    const cleanMsg = toast.message.trim().toLowerCase().replace(/[.!?:;]+$/, '');
    // Ignore duplicate toast message within 3.0 seconds
    if (
      lastToastRef.current &&
      lastToastRef.current.message.toLowerCase().replace(/[.!?:;]+$/, '') === cleanMsg &&
      now - lastToastRef.current.timestamp < 3000
    ) {
      return;
    }
    lastToastRef.current = { message: toast.message.trim(), timestamp: now };
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      // Don't show if identical normalized toast is already active on screen
      if (prev.some((t) => t.message.trim().toLowerCase().replace(/[.!?:;]+$/, '') === cleanMsg)) {
        return prev;
      }
      return [...prev, { ...toast, id }];
    });
    const duration = toast.duration || 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auth & Profile
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    uid: '',
    email: '',
    displayName: 'User',
    role: 'user',
    notificationPref: 'instant',
    createdAt: new Date().toISOString(),
  });
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [needsUsernameClaim, setNeedsUsernameClaim] = useState<boolean>(false);
  const [customFriends, setCustomFriends] = useState<UserProfile[]>([]);
  const [friendshipProfiles, setFriendshipProfiles] = useState<UserProfile[]>([]);
  const isOwnerMode = true;

  // Social & Friends
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);

  // Share Links
  const [shareLinksMap, setShareLinksMap] = useState<{ [friendId: string]: ShareLinkDoc }>({});

  // Data Collections - CLEAN, NO DUMMY DATA
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2026-10');
  const [currentMonth, setCurrentMonth] = useState<MonthData>({
    id: '2026-10',
    monthKey: '2026-10',
    monthName: 'October 2026',
    budget: 0,
    carryOver: 0,
    openingBalance: 0,
    fixedExpenses: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [allMonths, setAllMonths] = useState<MonthData[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [paymentClaims, setPaymentClaims] = useState<PaymentClaim[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessageLimit, setChatMessageLimit] = useState<number>(50);
  const [hasMoreChatMessages, setHasMoreChatMessages] = useState<boolean>(false);
  const messageBatchTimeoutRef = useRef<any>(null);
  const pendingServerMessagesRef = useRef<ChatMessage[]>([]);

  const loadMoreChatMessages = () => {
    setChatMessageLimit((prev) => prev + 50);
  };

  const [squadGroups, setSquadGroups] = useState<SquadGroupConfig[]>([]);
  const [activeSquadId, setActiveSquadId] = useState<string | null>(null);
  const [squadInvitations, setSquadInvitations] = useState<SquadInvitation[]>([]);

  const squadGroup =
    squadGroups.find((s) => s.id === activeSquadId) ||
    (squadGroups.length > 0 ? squadGroups[0] : null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [nudgeTargetFriend, setNudgeTargetFriend] = useState<{
    friend: UserProfile;
    balance: number;
    subject: string;
    textBody: string;
  } | null>(null);
  const processedNotifIdsRef = useRef<Set<string>>(new Set());
  const isInitialNotifSnapshotRef = useRef<boolean>(true);
  const prevExpensesSigRef = useRef<string>('');
  const prevLedgerSigRef = useRef<string>('');
  const prevMonthsSigRef = useRef<string>('');
  const prevMessagesSigRef = useRef<string>('');
  const prevNotifsSigRef = useRef<string>('');
  const prevClaimsSigRef = useRef<string>('');
  const prevFriendReqSigRef = useRef<string>('');
  const prevSquadInvSigRef = useRef<string>('');
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const sessionStartTimeRef = useRef<string>(new Date(Date.now() - 10000).toISOString());
  const [queuedEmails, setQueuedEmails] = useState<QueuedEmail[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isSampleLoaded, setIsSampleLoaded] = useState<boolean>(false);
  const [activeScreen, setActiveScreen] = useState<'home' | 'history' | 'chat' | 'settings' | 'ledger'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hisaab_last_tab');
      if (saved === 'home' || saved === 'history' || saved === 'chat') return saved;
    }
    return 'home';
  });

  // Auth listener & Username resolution
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseAuthUser(user);
      if (user) {
        let cachedMethods: PaymentMethodDetail[] | undefined = undefined;
        try {
          const raw = localStorage.getItem(`hisaab_payment_methods_${user.uid}`);
          if (raw) cachedMethods = JSON.parse(raw);
        } catch (_) {}

        const profile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || undefined,
          role: 'user',
          notificationPref: 'instant',
          paymentMethods: cachedMethods,
          createdAt: new Date().toISOString(),
        };
        setCurrentUser(profile);

        // Load user document & paymentMethods from Firestore users/{uid}
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            if (Array.isArray(uData.paymentMethods)) {
              cachedMethods = uData.paymentMethods;
              try {
                localStorage.setItem(
                  `hisaab_payment_methods_${user.uid}`,
                  JSON.stringify(uData.paymentMethods)
                );
              } catch (_) {}
            }
            setCurrentUser((prev) => ({
              ...prev,
              displayName: uData.displayName || prev.displayName,
              photoURL: uData.photoURL || prev.photoURL,
              paymentMethods: Array.isArray(uData.paymentMethods)
                ? uData.paymentMethods
                : prev.paymentMethods,
            }));
          } else {
            await setDoc(doc(db, 'users', user.uid), profile, { merge: true }).catch(() => {});
          }
        } catch (_) {}

        // Auto-sync Web Push FCM token for background mobile push alerts
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          requestFcmToken(user.uid).catch((err) => console.debug('FCM token auto-sync:', err));
        }

        // Immediately scope budget to new user to prevent cross-account budget leakage
        setCurrentMonth({
          id: `${user.uid}_${selectedMonthKey}`,
          userId: user.uid,
          monthKey: selectedMonthKey,
          monthName: formatMonthDisplay(selectedMonthKey),
          budget: 0,
          carryOver: 0,
          openingBalance: 0,
          fixedExpenses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setAllMonths([]);

        // Check if username claimed in publicProfiles/{uid}
        try {
          const pubSnap = await getDoc(doc(db, 'publicProfiles', user.uid));
          if (pubSnap.exists()) {
            const pubData = pubSnap.data() as PublicProfile;
            setPublicProfile(pubData);
            if (Array.isArray(pubData.paymentMethods) && (!cachedMethods || cachedMethods.length === 0)) {
              setCurrentUser((prev) => ({
                ...prev,
                paymentMethods: pubData.paymentMethods,
              }));
            }
            setNeedsUsernameClaim(false);
          } else {
            setPublicProfile(null);
            setNeedsUsernameClaim(true);
          }
        } catch (e) {
          console.warn('Public profile check note:', e);
        }

        // Process invite link or pending email invite if present
        try {
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const inviterParam = params.get('from') || params.get('invite');
            if (inviterParam && inviterParam !== user.uid) {
              // Lookup inviter UID if username was passed
              let targetUid = inviterParam;
              if (!targetUid.startsWith('mock-') && targetUid.length < 24) {
                const uSnap = await getDoc(doc(db, 'usernames', targetUid.toLowerCase()));
                if (uSnap.exists()) {
                  targetUid = uSnap.data().uid;
                }
              }

              if (targetUid && targetUid !== user.uid) {
                // Check if friendship already exists
                const pairId = [user.uid, targetUid].sort().join('_');
                const shipSnap = await getDoc(doc(db, 'friendships', pairId));
                if (!shipSnap.exists()) {
                  // Create automatic friendship or pending request so they are connected!
                  await setDoc(doc(db, 'friendships', pairId), {
                    id: pairId,
                    members: [user.uid, targetUid],
                    createdAt: new Date().toISOString(),
                  }).catch(() => {});

                  await setDoc(
                    doc(db, 'dmThreads', pairId),
                    {
                      id: pairId,
                      members: [user.uid, targetUid],
                      createdAt: new Date().toISOString(),
                      lastMessageText: 'Connected via invite link',
                      lastMessageAt: new Date().toISOString(),
                      lastMessageBy: user.uid,
                    },
                    { merge: true }
                  ).catch(() => {});

                  // Notification for inviter
                  const notifId = `notif-${Date.now()}-${targetUid}`;
                  await setDoc(doc(db, 'notifications', notifId), {
                    id: notifId,
                    userId: targetUid,
                    title: 'Friend joined via your invite link!',
                    body: `${user.displayName || 'Your friend'} accepted your invite and connected with you!`,
                    read: false,
                    createdAt: new Date().toISOString(),
                  }).catch(() => {});

                  showToast({
                    type: 'success',
                    message: `Connected successfully with your friend!`,
                  });
                }
              }
            }

            // Also check pending emailInvites matching current user email
            if (user.email) {
              const cleanEmail = user.email.toLowerCase();
              const qInv = query(
                collection(db, 'emailInvites'),
                where('toEmail', '==', cleanEmail),
                where('status', '==', 'pending'),
                limit(3)
              );
              const invSnap = await getDocs(qInv).catch(() => null);
              if (invSnap && !invSnap.empty) {
                for (const d of invSnap.docs) {
                  const invData = d.data();
                  if (invData.senderUid && invData.senderUid !== user.uid) {
                    const pairId = [user.uid, invData.senderUid].sort().join('_');
                    await setDoc(doc(db, 'friendships', pairId), {
                      id: pairId,
                      members: [user.uid, invData.senderUid],
                      createdAt: new Date().toISOString(),
                    }).catch(() => {});

                    await setDoc(
                      doc(db, 'dmThreads', pairId),
                      {
                        id: pairId,
                        members: [user.uid, invData.senderUid],
                        createdAt: new Date().toISOString(),
                        lastMessageText: 'Connected via email invitation',
                        lastMessageAt: new Date().toISOString(),
                        lastMessageBy: user.uid,
                      },
                      { merge: true }
                    ).catch(() => {});

                    await updateDoc(d.ref, {
                      status: 'accepted',
                      acceptedUid: user.uid,
                      acceptedAt: new Date().toISOString(),
                    }).catch(() => {});

                    showToast({
                      type: 'success',
                      message: `Joined from ${invData.senderName}'s email invitation!`,
                    });
                  }
                }
              }
            }
          }
        } catch (inviteErr) {
          console.warn('Invite processing notice:', inviteErr);
        }
      } else {
        // User logged out: strictly purge all states to avoid leaking data across user accounts
        setCurrentUser({
          uid: '',
          email: '',
          displayName: 'User',
          role: 'user',
          notificationPref: 'instant',
          createdAt: new Date().toISOString(),
        });
        setPublicProfile(null);
        setNeedsUsernameClaim(false);
        setAllMonths([]);
        setCurrentMonth({
          id: '2026-10',
          monthKey: '2026-10',
          monthName: 'October 2026',
          budget: 0,
          carryOver: 0,
          openingBalance: 0,
          fixedExpenses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setExpenses([]);
        setLedgerEntries([]);
        setNotifications([]);
        setChatMessages([]);
        setFriendships([]);
        setFriendRequests([]);
        setCustomFriends([]);
      }
      setIsAuthLoading(false);
    });

    return () => unsubAuth();
  }, []);

  const claimMyUsername = async (username: string) => {
    if (!firebaseAuthUser) return { success: false, error: 'Sign in first.' };
    const res = await claimUsername(
      firebaseAuthUser.uid,
      username,
      currentUser.displayName,
      currentUser.photoURL
    );
    if (res.success) {
      setPublicProfile({
        uid: firebaseAuthUser.uid,
        username: username.toLowerCase().trim(),
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        createdAt: new Date().toISOString(),
      });
      setNeedsUsernameClaim(false);
      showToast({ type: 'success', message: `Username @${username} claimed!` });
    }
    return res;
  };

  const updatePaymentMethods = async (methods: PaymentMethodDetail[]) => {
    const cleanMethods = methods.map((m) => ({
      id: m.id || `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      provider: m.provider,
      accountTitle: m.accountTitle.trim(),
      accountNumber: m.accountNumber.trim(),
      ...(m.ibanOrNote?.trim() ? { ibanOrNote: m.ibanOrNote.trim() } : {}),
    }));

    setCurrentUser((prev) => ({
      ...prev,
      paymentMethods: cleanMethods,
    }));

    if (publicProfile) {
      setPublicProfile((prev) => (prev ? { ...prev, paymentMethods: cleanMethods } : null));
    }

    const activeUid = firebaseAuthUser?.uid || currentUser.uid;
    if (activeUid) {
      try {
        localStorage.setItem(
          `hisaab_payment_methods_${activeUid}`,
          JSON.stringify(cleanMethods)
        );
      } catch (_) {}

      try {
        await setDoc(
          doc(db, 'users', activeUid),
          {
            uid: activeUid,
            email: currentUser.email || '',
            displayName: currentUser.displayName,
            role: currentUser.role || 'user',
            paymentMethods: cleanMethods,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (_) {}

      try {
        await setDoc(
          doc(db, 'publicProfiles', activeUid),
          {
            paymentMethods: cleanMethods,
          },
          { merge: true }
        );
      } catch (_) {}
    }

    // Also sync active public statement snapshots so payment details show immediately
    friends.forEach((f) => {
      const link = shareLinksMap[f.uid];
      if (link && !link.revoked) {
        updateShareLinkSnapshot(
          link.id,
          f.displayName,
          f.uid,
          activeLedgerEntries,
          cleanMethods,
          currentUser.displayName
        ).catch(() => {});
      }
    });

    showToast({
      type: 'success',
      message: 'Payment details saved to your profile & statement links!',
    });
  };

  // Real-time Firestore Listeners - attach ONLY when user is authenticated
  useEffect(() => {
    if (!firebaseAuthUser) {
      return;
    }

    const unsubs: (() => void)[] = [];

    try {
      // Expenses listener - personal expenses AND expenses split with this user!
      unsubs.push(
        onSnapshot(
          collection(db, 'expenses'),
          (snap) => {
            if (!snap.empty) {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
              const myUid = firebaseAuthUser.uid;
              const myExpenses = list.filter((e) => {
                if (e.createdBy === myUid) return true;
                if (e.paidBy && e.paidBy === myUid) return true;
                if (Array.isArray(e.splits) && e.splits.some((s) => s.userId === myUid)) return true;
                if ((e as any).friendId === myUid) return true;
                return false;
              });

              // Prevent redundant UI state updates if expenses haven't changed
              const sig = myExpenses
                .map(
                  (e) =>
                    `${e.id}:${e.updatedAt || e.createdAt}:${e.amount}:${
                      e.dispute?.isDisputed ? 'D1' : 'D0'
                    }:${e.activityLog?.length || 0}:${e.deleted ? '1' : '0'}`
                )
                .join('|');
              if (sig !== prevExpensesSigRef.current) {
                prevExpensesSigRef.current = sig;
                setExpenses(myExpenses);
              }
            } else {
              if (prevExpensesSigRef.current !== '__empty__') {
                prevExpensesSigRef.current = '__empty__';
                setExpenses([]);
              }
            }
          },
          (err) => console.warn('Expenses listener:', err.message)
        )
      );

      // Ledger listener - debts and splits involving the current user
      unsubs.push(
        onSnapshot(
          collection(db, 'ledgerEntries'),
          (snap) => {
            if (snap.empty) {
              setLedgerEntries([]);
              prevLedgerSigRef.current = '';
              return;
            }
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntry));
            const myUid = firebaseAuthUser.uid;
            const relevant = list.filter(
              (e) => !e.createdBy || e.createdBy === myUid || e.friendId === myUid || (e as any).userId === myUid
            );

            // Prevent redundant UI state updates, tracking deleted state
            const sig = relevant.map((e) => `${e.id}:${e.type}:${e.amount}:${e.createdAt}:${e.deleted ? '1' : '0'}`).join('|');
            if (sig !== prevLedgerSigRef.current) {
              prevLedgerSigRef.current = sig;
              setLedgerEntries(relevant);
            }
          },
          (err) => console.warn('Ledger listener:', err.message)
        )
      );

      // Months listener - personal budget records per user with formatted month names
      unsubs.push(
        onSnapshot(
          collection(db, 'months'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as MonthData));
            const myMonths = list.filter((m) => {
              return (
                m.userId === firebaseAuthUser.uid ||
                m.id === `${firebaseAuthUser.uid}_${m.monthKey}` ||
                m.id.startsWith(`${firebaseAuthUser.uid}_`)
              );
            });

            // Ensure monthName is human-readable (e.g., "October 2026")
            const formattedMonths = myMonths.map((m) => ({
              ...m,
              monthName: m.monthName && !/^\d{4}-\d{2}$/.test(m.monthName)
                ? m.monthName
                : formatMonthDisplay(m.monthKey),
            }));

            // Prevent redundant UI state updates
            const sig = formattedMonths.map((m) => `${m.id}:${m.budget}:${m.updatedAt || m.createdAt}`).join('|');
            if (sig !== prevMonthsSigRef.current) {
              prevMonthsSigRef.current = sig;
              setAllMonths(formattedMonths);
            }
          },
          (err) => console.warn('Months listener:', err.message)
        )
      );

      // Friendships - strictly isolated to current user's friendships!
      unsubs.push(
        onSnapshot(
          collection(db, 'friendships'),
          (snap) => {
            if (!snap.empty) {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Friendship));
              const myFriendships = list.filter(
                (f) => Array.isArray(f.members) && f.members.includes(firebaseAuthUser.uid)
              );
              setFriendships(myFriendships);
            } else {
              setFriendships([]);
            }
          },
          (err) => console.warn('Friendships listener:', err.message)
        )
      );

      // Custom Friends - only friends created by current user
      unsubs.push(
        onSnapshot(
          collection(db, 'customFriends'),
          (snap) => {
            if (!snap.empty) {
              const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as (UserProfile & { ownerUid?: string })));
              const myCustom = list.filter((f) => !f.ownerUid || f.ownerUid === firebaseAuthUser.uid);
              setCustomFriends(myCustom);
            } else {
              setCustomFriends([]);
            }
          },
          (err) => console.warn('Custom friends listener:', err.message)
        )
      );

      // Notifications: scoped to current user with limit(50) for maximum concurrency scalability
      const activeUid = firebaseAuthUser.uid;
      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'notifications'),
            where('userId', '==', activeUid),
            limit(50)
          ),
          (snap) => {
            const readSet = getStoredReadNotifIds();
            const myNotifs = snap.docs.map((d) => ({ ...d.data(), id: d.id } as AppNotification));

            const notifMap = new Map<string, AppNotification>();
            myNotifs.forEach((n) => {
              const isRead = n.read || readSet.has(n.id);
              notifMap.set(n.id, {
                ...n,
                read: isRead,
                processed: n.processed || Boolean((n as any).processedAt) || processedNotifIdsRef.current.has(n.id),
              });
            });
            const uniqueNotifs = Array.from(notifMap.values());
            uniqueNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // Prevent redundant UI state updates
            const notifSig = uniqueNotifs.map((n) => `${n.id}:${n.read}:${n.processed}`).join('|');
            if (notifSig !== prevNotifsSigRef.current) {
              prevNotifsSigRef.current = notifSig;
              setNotifications(uniqueNotifs);
            }

            // Single Observer Processing: ensure each document snapshot is processed once
            snap.docs.forEach((d) => {
              const data = d.data() as AppNotification;
              if (data.userId === activeUid) {
                const alreadyProcessed =
                  Boolean(data.processed) ||
                  Boolean((data as any).processedAt) ||
                  processedNotifIdsRef.current.has(d.id);

                if (!alreadyProcessed) {
                  processedNotifIdsRef.current.add(d.id);
                  updateDoc(doc(db, 'notifications', d.id), {
                    processed: true,
                    processedAt: new Date().toISOString(),
                  }).catch(() => {});

                  sendWebNotification('Hisaab', {
                    body: data.body || 'Notifications are on. You will get alerts for new expenses and payments.',
                    tag: d.id,
                    data: {
                      targetType: data.targetType,
                      targetId: data.targetId,
                      link: data.link,
                    },
                  });

                  if (!data.read && !readSet.has(d.id) && !isInitialNotifSnapshotRef.current) {
                    if (data.title?.toLowerCase().includes('nudge') || data.title?.toLowerCase().includes('reminder')) {
                      playNudgeChime();
                    } else {
                      triggerHaptic([60, 40, 60]);
                    }
                    showToast({
                      type: 'info',
                      message: `${data.title}: ${data.body}`,
                    });
                  }
                }
              }
            });

            isInitialNotifSnapshotRef.current = false;
          },
          (err) => console.warn('Notifications listener:', err.message)
        )
      );
    } catch (err) {
      console.warn('Subscription error:', err);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseAuthUser?.uid]);

  // Screen-scoped Listeners: Chat & Social collections attach ONLY when viewing the 'chat' screen
  useEffect(() => {
    if (!firebaseAuthUser || activeScreen !== 'chat') {
      return;
    }

    const unsubs: (() => void)[] = [];
    try {
      // Squad Messages
      unsubs.push(
        onSnapshot(
          query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(chatMessageLimit)),
          (snap) => {
            const serverList = snap.docs.map((d) => ({ ...d.data(), id: d.id } as ChatMessage));
            setHasMoreChatMessages(snap.docs.length >= chatMessageLimit);

            serverList.forEach((msg) => {
              if (
                msg.userId !== firebaseAuthUser.uid &&
                msg.createdAt > sessionStartTimeRef.current &&
                !processedMessageIdsRef.current.has(msg.id)
              ) {
                processedMessageIdsRef.current.add(msg.id);
                sendWebNotification('Hisaab', {
                  body: `${msg.userName || 'Squad Member'}: ${msg.text || 'Sent a new message in chat.'}`,
                  tag: `chat-${msg.id}`,
                  data: { tab: 'chat' },
                });
              }
            });

            pendingServerMessagesRef.current = serverList;
            if (messageBatchTimeoutRef.current) {
              clearTimeout(messageBatchTimeoutRef.current);
            }
            messageBatchTimeoutRef.current = setTimeout(() => {
              const currentServerList = pendingServerMessagesRef.current;
              setChatMessages((prev) => {
                const serverIds = new Set(currentServerList.map((m) => m.id));
                const pending = prev.filter(
                  (m) => !serverIds.has(m.id) && m.userId === firebaseAuthUser.uid
                );
                const map = new Map<string, ChatMessage>();
                currentServerList.forEach((m) => map.set(m.id, m));
                pending.forEach((m) => {
                  if (!map.has(m.id)) map.set(m.id, m);
                });
                const unique = Array.from(map.values());
                unique.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                const sig = unique.map((u) => `${u.id}:${u.updatedAt || u.createdAt}`).join('|');
                if (sig === prevMessagesSigRef.current) {
                  return prev;
                }
                prevMessagesSigRef.current = sig;
                return unique;
              });
            }, 60);
          },
          (err) => console.warn('Messages listener:', err.message)
        )
      );

      // Squad Groups
      unsubs.push(
        onSnapshot(
          collection(db, 'squadGroup'),
          (snap) => {
            const allSquads = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SquadGroupConfig));
            const mySquads = allSquads.filter((s) => {
              if (s.ownerUid === firebaseAuthUser.uid) return true;
              return Array.isArray(s.members) && s.members.includes(firebaseAuthUser.uid);
            });

            mySquads.sort((a, b) => {
              const timeA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime();
              const timeB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime();
              return timeB - timeA;
            });

            setSquadGroups(mySquads);
            setActiveSquadId((prev) => {
              if (prev && mySquads.some((s) => s.id === prev)) return prev;
              return mySquads.length > 0 ? mySquads[0].id : null;
            });
          },
          (err) => console.warn('Squad groups listener:', err.message)
        )
      );

      // Squad Invitations
      unsubs.push(
        onSnapshot(
          collection(db, 'squadInvitations'),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SquadInvitation));
            const myPending = list.filter(
              (inv) => inv.recipientUid === firebaseAuthUser.uid && inv.status === 'pending'
            );
            myPending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const sig = myPending.map((p) => `${p.id}:${p.status}`).join('|');
            if (sig !== prevSquadInvSigRef.current) {
              prevSquadInvSigRef.current = sig;
              setSquadInvitations(myPending);
            }
          },
          (err) => console.warn('Squad invitations listener:', err.message)
        )
      );

      // Friend Requests
      unsubs.push(
        onSnapshot(
          collection(db, 'friendRequests'),
          (snap) => {
            if (!snap.empty) {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest));
              const sig = list.map((r) => `${r.id}:${r.status}`).join('|');
              if (sig !== prevFriendReqSigRef.current) {
                prevFriendReqSigRef.current = sig;
                setFriendRequests(list);
              }
            }
          },
          (err) => console.warn('Friend requests listener:', err.message)
        )
      );

      // DM Threads
      unsubs.push(
        onSnapshot(
          collection(db, 'dmThreads'),
          (snap) => {
            if (!snap.empty) {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DmThread));
              const myThreads = list.filter(
                (t) => Array.isArray(t.members) && t.members.includes(firebaseAuthUser.uid)
              );
              myThreads.sort(
                (a, b) =>
                  new Date(b.lastMessageAt || b.createdAt).getTime() -
                  new Date(a.lastMessageAt || a.createdAt).getTime()
              );
              setDmThreads(myThreads);
            } else {
              setDmThreads([]);
            }
          },
          (err) => console.warn('DM threads listener:', err.message)
        )
      );

      // Reactions
      unsubs.push(
        onSnapshot(
          collection(db, 'reactions'),
          (snap) => {
            if (!snap.empty) {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReactionItem));
              setReactions(list);
            }
          },
          (err) => console.warn('Reactions listener:', err.message)
        )
      );
    } catch (err) {
      console.warn('Chat screen subscription error:', err);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseAuthUser?.uid, activeScreen, chatMessageLimit]);

  // Screen-scoped Listeners: Secondary collections attach ONLY when viewing 'history', 'ledger', or 'settings'
  useEffect(() => {
    if (
      !firebaseAuthUser ||
      (activeScreen !== 'history' && activeScreen !== 'ledger' && activeScreen !== 'settings')
    ) {
      return;
    }

    const unsubs: (() => void)[] = [];
    try {
      // Share links
      unsubs.push(
        onSnapshot(
          collection(db, 'shareLinks'),
          (snap) => {
            if (!snap.empty) {
              const map: { [friendId: string]: ShareLinkDoc } = {};
              snap.docs.forEach((d) => {
                const data = { id: d.id, ...d.data() } as ShareLinkDoc;
                if (!data.revoked) {
                  map[data.friendId] = data;
                }
              });
              setShareLinksMap(map);
            }
          },
          (err) => console.warn('Share links listener:', err.message)
        )
      );

      // Comments
      unsubs.push(
        onSnapshot(
          collection(db, 'comments'),
          (snap) => {
            if (!snap.empty) {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommentItem));
              setComments(list);
            }
          },
          (err) => console.warn('Comments listener:', err.message)
        )
      );

      // Payment Claims
      unsubs.push(
        onSnapshot(
          collection(db, 'paymentClaims'),
          (snap) => {
            if (!snap.empty) {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentClaim));
              const sig = list.map((c) => `${c.id}:${c.status}:${c.amount}`).join('|');
              if (sig !== prevClaimsSigRef.current) {
                prevClaimsSigRef.current = sig;
                setPaymentClaims(list);
              }
            }
          },
          (err) => console.warn('Payment claims listener:', err.message)
        )
      );

      // MailQueue (only needed on settings screen)
      if (activeScreen === 'settings') {
        unsubs.push(
          onSnapshot(
            collection(db, 'mailQueue'),
            (snap) => {
              if (!snap.empty) {
                const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QueuedEmail));
                list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setQueuedEmails(list);
              }
            },
            (err) => console.warn('Mail queue listener:', err.message)
          )
        );
      }
    } catch (err) {
      console.warn('Secondary screen subscription error:', err);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseAuthUser?.uid, activeScreen]);

  // Derived current month state - smoothly updates when selectedMonthKey or allMonths changes
  useEffect(() => {
    if (!firebaseAuthUser) return;
    if (allMonths.length > 0) {
      const found = allMonths.find((m) => m.monthKey === selectedMonthKey);
      if (found) {
        setCurrentMonth(found);
      } else {
        setCurrentMonth({
          id: `${firebaseAuthUser.uid}_${selectedMonthKey}`,
          userId: firebaseAuthUser.uid,
          monthKey: selectedMonthKey,
          monthName: formatMonthDisplay(selectedMonthKey),
          budget: 0,
          carryOver: 0,
          openingBalance: 0,
          fixedExpenses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      setCurrentMonth({
        id: `${firebaseAuthUser.uid}_${selectedMonthKey}`,
        userId: firebaseAuthUser.uid,
        monthKey: selectedMonthKey,
        monthName: formatMonthDisplay(selectedMonthKey),
        budget: 0,
        carryOver: 0,
        openingBalance: 0,
        fixedExpenses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }, [allMonths, selectedMonthKey, firebaseAuthUser]);

  // Load public profiles for accepted friendships
  useEffect(() => {
    if (!currentUser.uid || friendships.length === 0) {
      setFriendshipProfiles([]);
      return;
    }

    const otherUids = friendships
      .filter((f) => f.members.includes(currentUser.uid))
      .map((f) => f.members.find((m) => m !== currentUser.uid))
      .filter((m): m is string => Boolean(m));

    if (otherUids.length === 0) {
      setFriendshipProfiles([]);
      return;
    }

    Promise.all(
      otherUids.map(async (uid): Promise<UserProfile | null> => {
        try {
          const snap = await getDoc(doc(db, 'publicProfiles', uid));
          if (snap.exists()) {
            const pub = snap.data() as PublicProfile;
            const profile: UserProfile = {
              uid: pub.uid,
              displayName: pub.displayName,
              email: '',
              photoURL: pub.photoURL || undefined,
              role: 'friend',
              notificationPref: 'instant',
              createdAt: pub.createdAt,
            };
            return profile;
          }
        } catch (e) {}
        return null;
      })
    ).then((profs) => {
      setFriendshipProfiles(profs.filter((p): p is UserProfile => p !== null));
    });
  }, [friendships, currentUser.uid]);

  // Derived lists
  const friends = React.useMemo(() => {
    const map = new Map<string, UserProfile>();
    customFriends.forEach((f) => map.set(f.uid, f));
    friendshipProfiles.forEach((f) => map.set(f.uid, f));
    return Array.from(map.values());
  }, [customFriends, friendshipProfiles]);

  const allUsers = React.useMemo(() => {
    return [currentUser, ...friends];
  }, [currentUser, friends]);

  const addCustomFriend = async (data: {
    displayName: string;
    phone?: string;
    email?: string;
    initialBalance?: number;
    notes?: string;
  }): Promise<string> => {
    const friendId = `friend-${Date.now()}`;
    const newFriend: UserProfile = {
      uid: friendId,
      displayName: data.displayName.trim(),
      email: data.email?.trim() || '',
      phone: data.phone?.trim() || undefined,
      role: 'friend',
      notificationPref: 'instant',
      createdAt: new Date().toISOString(),
    };

    setCustomFriends((prev) => [...prev, newFriend]);

    try {
      await setDoc(doc(db, 'customFriends', friendId), {
        ...newFriend,
        ownerUid: currentUser.uid,
        notes: data.notes || '',
      });
    } catch (e) {
      console.warn('Error saving custom friend to firestore:', e);
    }

    if (data.initialBalance && data.initialBalance !== 0) {
      const isOwed = data.initialBalance > 0;
      const entryId = `led-${Date.now()}`;
      const entry: LedgerEntry = {
        id: entryId,
        friendId: friendId,
        friendName: data.displayName.trim(),
        date: new Date().toISOString().split('T')[0],
        label: 'Opening Balance',
        amount: Math.abs(data.initialBalance),
        type: isOwed ? 'owes' : 'payment',
        note: data.notes || 'Starting balance',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
      };
      setLedgerEntries((prev) => [...prev, entry]);
      try {
        await setDoc(doc(db, 'ledgerEntries', entryId), entry);
      } catch (e) {}
    }

    showToast({
      type: 'success',
      message: `${data.displayName} added to your friends list!`,
    });

    return friendId;
  };
  const activeExpenses = expenses.filter((e) => !e.deleted);
  const trashExpenses = expenses.filter((e) => e.deleted);

  const deletedExpenseIds = useMemo(() => {
    return new Set(expenses.filter((e) => e.deleted).map((e) => e.id));
  }, [expenses]);

  const activeLedgerEntries = useMemo(() => {
    return ledgerEntries.filter(
      (e) => !e.deleted && (!e.refExpenseId || !deletedExpenseIds.has(e.refExpenseId))
    );
  }, [ledgerEntries, deletedExpenseIds]);

  const incomingRequests = friendRequests.filter(
    (r) => r.toUid === currentUser.uid && r.status === 'pending'
  );
  const outgoingRequests = friendRequests.filter(
    (r) => r.fromUid === currentUser.uid && r.status === 'pending'
  );

  const friendBalance = useCallback(
    (friendId: string) =>
      calculateFriendBalance(friendId, activeLedgerEntries, currentUser.uid || firebaseAuthUser?.uid),
    [activeLedgerEntries, currentUser.uid, firebaseAuthUser?.uid]
  );

  // Debounced snapshot sync for Owner's active shareLinks
  useEffect(() => {
    if (!isOwnerMode) return;
    const timer = setTimeout(() => {
      friends.forEach(async (f) => {
        const link = shareLinksMap[f.uid];
        if (link && !link.revoked) {
          await updateShareLinkSnapshot(
            link.id,
            f.displayName,
            f.uid,
            activeLedgerEntries,
            currentUser.paymentMethods,
            currentUser.displayName
          );
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [activeLedgerEntries, isOwnerMode, friends, shareLinksMap, currentUser.paymentMethods, currentUser.displayName]);

  // Share link helpers
  const getFriendShareUrl = (friendId: string) => {
    const link = shareLinksMap[friendId];
    if (link && !link.revoked) {
      return getStatementShareLink(link.id);
    }
    return '';
  };

  const regenerateLink = async (friendId: string): Promise<string> => {
    const f = friends.find((fr) => fr.uid === friendId);
    if (!f) return '';
    const oldLink = shareLinksMap[friendId];
    const newDoc = await regenerateShareLink(
      oldLink ? oldLink.id : null,
      friendId,
      f.displayName,
      ledgerEntries,
      currentUser.paymentMethods,
      currentUser.displayName
    );
    setShareLinksMap((prev) => ({ ...prev, [friendId]: newDoc }));
    showToast({ type: 'success', message: `Generated new secure statement link for ${f.displayName}!` });
    return getStatementShareLink(newDoc.id);
  };

  const revokeLink = async (friendId: string): Promise<void> => {
    const link = shareLinksMap[friendId];
    if (link) {
      await revokeShareLink(link.id);
      setShareLinksMap((prev) => {
        const next = { ...prev };
        delete next[friendId];
        return next;
      });
      showToast({ type: 'info', message: 'Statement link revoked. It will now fail closed.' });
    }
  };

  // Friend Request actions
  const sendRequestToUser = async (
    toUid: string,
    toUsername: string,
    toDisplayName: string,
    ledgerFriendId?: string
  ) => {
    const reqId = await sendFriendRequest({
      fromUid: currentUser.uid,
      fromUsername: publicProfile?.username || currentUser.displayName.toLowerCase().replace(/\s+/g, '_'),
      fromDisplayName: currentUser.displayName,
      fromPhotoURL: currentUser.photoURL,
      toUid,
      toUsername,
      toDisplayName,
      ledgerFriendId,
    });
    showToast({ type: 'success', message: `Friend request sent to @${toUsername}!` });
  };

  const acceptIncomingRequest = async (request: FriendRequest) => {
    await acceptFriendRequest(request, currentUser.displayName);

    // If request has ledgerFriendId linked, map it or update ledger friend
    if (request.ledgerFriendId && isOwnerMode) {
      // Linked to existing friend like Ehtisham or Aqeel
      showToast({
        type: 'success',
        message: `Accepted request and linked to ledger records for ${request.fromDisplayName}!`,
      });
    } else {
      showToast({
        type: 'success',
        message: `Accepted friend request from ${request.fromDisplayName}!`,
      });
    }
  };

  const declineIncomingRequest = async (requestId: string) => {
    await updateRequestStatus(requestId, 'declined');
    showToast({ type: 'info', message: 'Request declined.' });
  };

  const cancelOutgoingRequest = async (requestId: string) => {
    await updateRequestStatus(requestId, 'cancelled');
    showToast({ type: 'info', message: 'Request cancelled.' });
  };

  const removeFriend = async (friendUid: string) => {
    try {
      const isPair = friendUid.includes('_');
      const pairId = isPair ? friendUid : getSortedUidPair(currentUser.uid, friendUid);
      const targetUid = isPair
        ? friendUid.split('_').find((u) => u !== currentUser.uid) || friendUid
        : friendUid;

      // 1. Delete friendship record if connected
      await removeFriendship(pairId).catch(() => {});

      // 2. Delete custom friend record if custom
      await deleteDoc(doc(db, 'customFriends', targetUid)).catch(() => {});

      // 3. Immediately purge from local react states
      setCustomFriends((prev) => prev.filter((f) => f.uid !== targetUid));
      setFriendshipProfiles((prev) => prev.filter((f) => f.uid !== targetUid));
      setFriendships((prev) => prev.filter((f) => !f.members.includes(targetUid)));

      // 4. Revoke active share token
      await revokeLink(targetUid).catch(() => {});

      showToast({ type: 'info', message: 'Friend removed successfully.' });
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message || 'Failed to remove friend.' });
    }
  };

  const unfriendUser = removeFriend;

  // Month Switcher (User-scoped personal month)
  useEffect(() => {
    const activeUid = currentUser.uid || firebaseAuthUser?.uid;
    if (!activeUid) return;

    // 1. Check in allMonths state
    const found = allMonths.find(
      (m) =>
        m.monthKey === selectedMonthKey &&
        (m.userId === activeUid || m.id === `${activeUid}_${selectedMonthKey}`)
    );

    if (found) {
      setCurrentMonth(found);
      return;
    }

    // 2. Check local persistence
    try {
      const cached = localStorage.getItem(`hisaab_budget_${activeUid}_${selectedMonthKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.monthKey === selectedMonthKey && parsed.userId === activeUid) {
          setCurrentMonth(parsed);
          setAllMonths((prev) => [...prev.filter((m) => m.id !== parsed.id), parsed]);
          return;
        }
      }
    } catch (_) {}

    // 3. Fallback to clean user default (budget 0 until explicitly configured by this user)
    const newM: MonthData = {
      id: `${activeUid}_${selectedMonthKey}`,
      userId: activeUid,
      monthKey: selectedMonthKey,
      monthName: formatMonthDisplay(selectedMonthKey),
      budget: 0,
      fixedExpenses: [],
      carryOver: 0,
      openingBalance: 0,
      createdAt: new Date().toISOString(),
    };
    setCurrentMonth(newM);
  }, [selectedMonthKey, allMonths, currentUser.uid, firebaseAuthUser]);

  // ADD EXPENSE (Strictly personal to current user)
  const addExpense = async (
    expenseData: Omit<Expense, 'id' | 'createdAt' | 'status'>
  ): Promise<string> => {
    const id = `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const status = 'approved';
    const nowIso = new Date().toISOString();
    const initialLog: ExpenseActivityEntry = {
      id: `act-${Date.now()}-add`,
      type: 'added',
      actorUid: currentUser.uid,
      actorName: currentUser.displayName,
      note: `Created expense "${expenseData.title}" for ${formatPKR(expenseData.amount)}`,
      createdAt: nowIso,
    };
    const newExp: Expense = {
      ...expenseData,
      id,
      status,
      createdBy: currentUser.uid,
      createdByName: currentUser.displayName,
      activityLog: [initialLog, ...(expenseData.activityLog || [])],
      createdAt: nowIso,
    };

    setExpenses((prev) => [newExp, ...prev]);

    try {
      await setDoc(doc(db, 'expenses', id), newExp);
    } catch (e) {
      console.warn('Expense write note:', e);
    }

    if (expenseData.splits.length > 0) {
      const isPaidByMe = expenseData.paidBy === 'me' || expenseData.paidBy === currentUser.uid;
      const payerId = isPaidByMe ? currentUser.uid : expenseData.paidBy;
      const payerName = isPaidByMe ? currentUser.displayName : (expenseData.paidByName || 'Friend');

      if (isPaidByMe) {
        // Current user paid: friends owe current user their respective shares
        for (const split of expenseData.splits) {
          if (split.userId !== currentUser.uid && split.share > 0) {
            const entryId = `led-${Date.now()}-${split.userId}`;
            const newLedger: LedgerEntry = {
              id: entryId,
              friendId: split.userId,
              friendName: split.userName,
              date: expenseData.date,
              label: expenseData.title,
              amount: split.share,
              type: 'owes',
              payerId: currentUser.uid,
              payerName: currentUser.displayName,
              recipientId: split.userId,
              recipientName: split.userName,
              refExpenseId: id,
              note: expenseData.note,
              createdAt: new Date().toISOString(),
              createdBy: currentUser.uid,
            };

            setLedgerEntries((prev) => [...prev, newLedger]);
            try {
              await setDoc(doc(db, 'ledgerEntries', entryId), newLedger);
            } catch (e) {}

          const friendProfile = allUsers.find((u) => u.uid === split.userId);
          const friendEmail = friendProfile?.email || `${split.userName.toLowerCase()}@example.com`;
          const currentBal = calculateFriendBalance(split.userId, [
            ...ledgerEntries,
            newLedger,
          ]);

          const subject = `Hisaab: Rs ${split.share} added - ${expenseData.title} (${formatShortDate(expenseData.date)})`;
          const html = buildHisaabEmailHtml({
            friendName: split.userName,
            headline: `${currentUser.displayName} added an expense for "${expenseData.title}".`,
            subheadline: expenseData.title,
            amountText: formatPKR(expenseData.amount),
            shareText: formatPKR(split.share),
            newBalanceText: formatPKR(currentBal),
            details: expenseData.note,
            paymentMethods: currentUser.paymentMethods,
          });

          await queueNotificationEmail({
            to: friendEmail,
            friendName: split.userName,
            subject,
            htmlBody: html,
          });

          const notifId = `notif-${Date.now()}-${split.userId}`;
          const friendlyBody = `${currentUser.displayName || 'Friend'} added ${expenseData.title}. You owe ${formatPKR(split.share)}.`;
          const notif: AppNotification = {
            id: notifId,
            userId: split.userId,
            title: 'Hisaab',
            body: friendlyBody,
            read: false,
            createdAt: new Date().toISOString(),
          };
          try {
            await setDoc(doc(db, 'notifications', notifId), notif);
          } catch (e) {}

          // Background push notification to wake up recipient's phone/desktop even when app is closed
          sendPushNotificationToUser(split.userId, {
            title: 'Hisaab',
            body: friendlyBody,
            link: `/?tab=history`,
            tag: `expense-${id}`,
          }).catch(() => {});
        }
      }
    } else {
        // Friend paid the whole bill: current user owes payer their share
        const mySplit = expenseData.splits.find((s) => s.userId === currentUser.uid);
        const myShare = mySplit ? mySplit.share : 0;
        if (myShare > 0) {
          const entryId = `led-${Date.now()}-${payerId}-debt`;
          const newLedger: LedgerEntry = {
            id: entryId,
            friendId: payerId,
            friendName: payerName,
            date: expenseData.date,
            label: `${expenseData.title} (Paid by ${payerName})`,
            amount: -myShare, // Negative: current user owes the payer
            type: 'owes',
            payerId: payerId,
            payerName: payerName,
            recipientId: currentUser.uid,
            recipientName: currentUser.displayName,
            refExpenseId: id,
            note: expenseData.note,
            createdAt: new Date().toISOString(),
            createdBy: currentUser.uid,
          };
          setLedgerEntries((prev) => [...prev, newLedger]);
          try {
            await setDoc(doc(db, 'ledgerEntries', entryId), newLedger);
          } catch (e) {}
        }
      }
    }

    showToast({
      type: 'success',
      message: `Saved "${expenseData.title}" (${formatPKR(expenseData.amount)})`,
    });

    // Check for mentions in expense title or note, excluding already notified split friends
    const mentionText = `${expenseData.title} ${expenseData.note || ''}`;
    if (mentionText.includes('@')) {
      const splitUids = expenseData.splits.map((s) => s.userId);
      notifyMentions({
        text: mentionText,
        senderUser: currentUser,
        sourceType: 'expense',
        sourceLabel: `Expense: ${expenseData.title}`,
        excludeUids: [currentUser.uid, ...splitUids],
      });
    }

    return id;
  };

  // UPDATE EXPENSE (Permission check: creator, payer, split participants, or owner)
  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    const target = expenses.find((e) => e.id === id);
    if (!target) return;

    const isCreator = target.createdBy === currentUser.uid;
    const isPayer = target.paidBy === currentUser.uid || (target.paidBy === 'me' && isCreator);
    const isInSplit = target.splits?.some((s) => s.userId === currentUser.uid);

    if (!isOwnerMode && !isCreator && !isPayer && !isInSplit) {
      showToast({
        type: 'warning',
        message: 'Permission denied: Only the creator or participants in this split can edit this transaction.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const existingLog: ExpenseActivityEntry[] =
      target.activityLog && target.activityLog.length > 0
        ? target.activityLog
        : [
            {
              id: `act-init-${target.id}`,
              type: 'added',
              actorUid: target.createdBy || currentUser.uid,
              actorName: target.createdByName || currentUser.displayName,
              note: `Added "${target.title}" (${formatPKR(target.amount)})`,
              createdAt: target.createdAt || nowIso,
            },
          ];

    const editSummaryParts: string[] = [];
    if (updates.title && updates.title !== target.title) {
      editSummaryParts.push(`title to "${updates.title}"`);
    }
    if (updates.amount !== undefined && updates.amount !== target.amount) {
      editSummaryParts.push(`amount from ${formatPKR(target.amount)} to ${formatPKR(updates.amount)}`);
    }
    if (updates.splits) {
      editSummaryParts.push('split breakdown');
    }

    const editEntry: ExpenseActivityEntry = {
      id: `act-${Date.now()}-edit`,
      type: 'edited',
      actorUid: currentUser.uid,
      actorName: currentUser.displayName,
      note:
        editSummaryParts.length > 0
          ? `Updated ${editSummaryParts.join(', ')}`
          : 'Edited expense details',
      createdAt: nowIso,
    };

    const nextLog: ExpenseActivityEntry[] = [...existingLog, editEntry];
    let nextDispute = updates.dispute !== undefined ? updates.dispute : target.dispute;

    // If the expense was disputed and is now edited, automatically mark the dispute resolved!
    if (target.dispute?.isDisputed && updates.dispute === undefined) {
      nextDispute = {
        ...target.dispute,
        isDisputed: false,
        resolvedAt: nowIso,
        resolvedByUid: currentUser.uid,
        resolvedByName: currentUser.displayName,
        resolutionNote: 'Updated expense to resolve dispute',
      };
      nextLog.push({
        id: `act-${Date.now()}-resolve`,
        type: 'resolved',
        actorUid: currentUser.uid,
        actorName: currentUser.displayName,
        note: 'Dispute resolved after editing expense',
        createdAt: nowIso,
      });
    }

    const updatedWithTime: Partial<Expense> = {
      ...updates,
      dispute: nextDispute,
      activityLog: nextLog,
      updatedAt: nowIso,
      updatedBy: currentUser.uid,
      updatedByName: currentUser.displayName,
    };
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updatedWithTime } : e))
    );
    try {
      await updateDoc(doc(db, 'expenses', id), updatedWithTime);

      // Keep linked ledger entries in sync if title, date, note, or splits changed!
      const linked = ledgerEntries.filter((l) => l.refExpenseId === id);
      if (linked.length > 0) {
        for (const l of linked) {
          const lUpdates: Partial<LedgerEntry> = {};
          if (updates.title) lUpdates.label = updates.title;
          if (updates.date) lUpdates.date = updates.date;
          if (updates.note !== undefined) lUpdates.note = updates.note;
          if (updates.splits) {
            const splitMatch = updates.splits.find((s) => s.userId === l.friendId);
            if (splitMatch) {
              lUpdates.amount = splitMatch.share;
            }
          }
          if (Object.keys(lUpdates).length > 0) {
            setLedgerEntries((prev) =>
              prev.map((item) => (item.id === l.id ? { ...item, ...lUpdates } : item))
            );
            await updateDoc(doc(db, 'ledgerEntries', l.id), lUpdates);
          }
        }
      }
    } catch (e) {}
    showToast({
      type: 'success',
      message: target.dispute?.isDisputed
        ? 'Expense updated and dispute marked resolved!'
        : 'Expense updated.',
    });
  };

  // DISPUTE AN EXPENSE & RESOLVE DISPUTE
  const disputeExpense = async (expenseId: string, note: string) => {
    const target = expenses.find((e) => e.id === expenseId);
    if (!target || !note.trim()) return;

    const nowIso = new Date().toISOString();
    const existingLog: ExpenseActivityEntry[] =
      target.activityLog && target.activityLog.length > 0
        ? target.activityLog
        : [
            {
              id: `act-init-${target.id}`,
              type: 'added',
              actorUid: target.createdBy || currentUser.uid,
              actorName: target.createdByName || 'Creator',
              note: `Added "${target.title}" (${formatPKR(target.amount)})`,
              createdAt: target.createdAt || nowIso,
            },
          ];

    const disputeEntry: ExpenseActivityEntry = {
      id: `act-${Date.now()}-dispute`,
      type: 'disputed',
      actorUid: currentUser.uid,
      actorName: currentUser.displayName,
      note: note.trim(),
      createdAt: nowIso,
    };

    const disputeInfo = {
      isDisputed: true,
      disputedByUid: currentUser.uid,
      disputedByName: currentUser.displayName,
      note: note.trim(),
      disputedAt: nowIso,
    };

    const nextLog = [...existingLog, disputeEntry];

    setExpenses((prev) =>
      prev.map((e) =>
        e.id === expenseId
          ? { ...e, dispute: disputeInfo, activityLog: nextLog, updatedAt: nowIso }
          : e
      )
    );

    try {
      await updateDoc(doc(db, 'expenses', expenseId), {
        dispute: disputeInfo,
        activityLog: nextLog,
        updatedAt: nowIso,
      });
    } catch (_) {}

    // Notify expense creator & participants
    const notifyTargets = new Set<string>();
    if (target.createdBy) notifyTargets.add(target.createdBy);
    if (target.paidBy && target.paidBy !== 'me') notifyTargets.add(target.paidBy);
    (target.splits || []).forEach((s) => notifyTargets.add(s.userId));
    // Also notify currentUser if flagging in demo/testing so user sees the notification immediately
    notifyTargets.add(currentUser.uid);

    for (const uid of Array.from(notifyTargets)) {
      const notifId = `notif-disp-${Date.now()}-${uid}`;
      const notif: AppNotification = {
        id: notifId,
        userId: uid,
        title: `Expense Disputed: ${target.title}`,
        body: `${currentUser.displayName} flagged "${target.title}" (${formatPKR(
          target.amount
        )}): "${note.trim()}"`,
        read: false,
        targetType: 'expense',
        targetId: expenseId,
        link: `/?tab=history`,
        createdAt: nowIso,
      };
      if (uid === currentUser.uid) {
        setNotifications((prev) => [notif, ...prev]);
      }
      setDoc(doc(db, 'notifications', notifId), notif).catch(() => {});
    }

    showToast({
      type: 'warning',
      message: `Flagged "${target.title}" as disputed. Notification sent!`,
    });
  };

  const resolveExpenseDispute = async (expenseId: string, resolutionNote?: string) => {
    const target = expenses.find((e) => e.id === expenseId);
    if (!target || !target.dispute) return;

    const nowIso = new Date().toISOString();
    const existingLog: ExpenseActivityEntry[] = target.activityLog || [];
    const resolvedEntry: ExpenseActivityEntry = {
      id: `act-${Date.now()}-resolve`,
      type: 'resolved',
      actorUid: currentUser.uid,
      actorName: currentUser.displayName,
      note: resolutionNote?.trim() || 'Marked dispute as resolved',
      createdAt: nowIso,
    };

    const updatedDispute = {
      ...target.dispute,
      isDisputed: false,
      resolvedAt: nowIso,
      resolvedByUid: currentUser.uid,
      resolvedByName: currentUser.displayName,
      resolutionNote: resolutionNote?.trim() || 'Resolved',
    };

    const nextLog = [...existingLog, resolvedEntry];

    setExpenses((prev) =>
      prev.map((e) =>
        e.id === expenseId
          ? { ...e, dispute: updatedDispute, activityLog: nextLog, updatedAt: nowIso }
          : e
      )
    );

    try {
      await updateDoc(doc(db, 'expenses', expenseId), {
        dispute: updatedDispute,
        activityLog: nextLog,
        updatedAt: nowIso,
      });
    } catch (_) {}

    if (target.dispute.disputedByUid && target.dispute.disputedByUid !== currentUser.uid) {
      const notifId = `notif-res-${Date.now()}-${target.dispute.disputedByUid}`;
      setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: target.dispute.disputedByUid,
        title: `Dispute Resolved: ${target.title}`,
        body: `${currentUser.displayName} resolved the dispute on "${target.title}".`,
        read: false,
        targetType: 'expense',
        targetId: expenseId,
        link: `/?tab=history`,
        createdAt: nowIso,
      }).catch(() => {});
    }

    showToast({
      type: 'success',
      message: `Resolved dispute on "${target.title}".`,
    });
  };

  // SOFT DELETE & UNDO (Only the creator of a split bill can delete it to prevent erasing debts)
  const deleteExpense = async (id: string) => {
    const target = expenses.find((e) => e.id === id);
    if (!target) return;

    const isSplitBill = Boolean(target.splits && target.splits.length > 0 && target.splits.some((s) => s.userId !== currentUser.uid));
    const isCreator = target.createdBy === currentUser.uid;

    if (isSplitBill && !isOwnerMode && !isCreator) {
      showToast({
        type: 'warning',
        message: 'Only the creator of this split bill can delete it to prevent erasing owed balances.',
      });
      return;
    }

    if (!isOwnerMode && !isCreator && target.paidBy !== currentUser.uid) {
      showToast({
        type: 'warning',
        message: 'Permission denied: Only the creator can delete this transaction.',
      });
      return;
    }

    const now = Date.now();
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, deleted: true, deletedAt: now } : e
      )
    );

    // Also soft-delete all ledger entries generated by this split bill!
    setLedgerEntries((prev) =>
      prev.map((l) =>
        l.refExpenseId === id ? { ...l, deleted: true, deletedAt: now } : l
      )
    );

    try {
      await updateDoc(doc(db, 'expenses', id), {
        deleted: true,
        deletedAt: now,
      });

      // Update linked ledger docs in firestore
      const linkedEntries = ledgerEntries.filter((l) => l.refExpenseId === id);
      await Promise.allSettled(
        linkedEntries.map((l) =>
          updateDoc(doc(db, 'ledgerEntries', l.id), {
            deleted: true,
            deletedAt: now,
          })
        )
      );
    } catch (e) {}

    showToast({
      type: 'info',
      message: `Deleted "${target.title}".`,
      duration: 10000,
      undoAction: () => undoDeleteExpense(id),
    });
  };

  const undoDeleteExpense = async (id: string) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, deleted: false, deletedAt: undefined } : e))
    );
    setLedgerEntries((prev) =>
      prev.map((l) =>
        l.refExpenseId === id ? { ...l, deleted: false, deletedAt: undefined } : l
      )
    );
    try {
      await updateDoc(doc(db, 'expenses', id), {
        deleted: false,
        deletedAt: null,
      });
      const linkedEntries = ledgerEntries.filter((l) => l.refExpenseId === id);
      await Promise.allSettled(
        linkedEntries.map((l) =>
          updateDoc(doc(db, 'ledgerEntries', l.id), {
            deleted: false,
            deletedAt: null,
          })
        )
      );
    } catch (e) {}
    showToast({ type: 'success', message: 'Expense restored.' });
  };

  const permanentlyDeleteExpense = async (id: string) => {
    const target = expenses.find((e) => e.id === id);
    if (!target) return;

    const isSplitBill = Boolean(target.splits && target.splits.length > 0 && target.splits.some((s) => s.userId !== currentUser.uid));
    const isCreator = target.createdBy === currentUser.uid;

    if (isSplitBill && !isOwnerMode && !isCreator) {
      showToast({
        type: 'warning',
        message: 'Only the creator of this split bill can permanently delete it.',
      });
      return;
    }

    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setLedgerEntries((prev) => prev.filter((l) => l.refExpenseId !== id));
    try {
      await deleteDoc(doc(db, 'expenses', id));
      const linkedEntries = ledgerEntries.filter((l) => l.refExpenseId === id);
      await Promise.allSettled(
        linkedEntries.map((l) => deleteDoc(doc(db, 'ledgerEntries', l.id)))
      );
    } catch (e) {}
    showToast({ type: 'info', message: 'Permanently removed from trash.' });
  };

  // LEDGER MANAGEMENT
  const deleteLedgerEntry = async (id: string) => {
    const target = ledgerEntries.find((l) => l.id === id);
    if (!target) return;
    const now = Date.now();
    setLedgerEntries((prev) =>
      prev.map((l) => (l.id === id ? { ...l, deleted: true, deletedAt: now } : l))
    );
    try {
      await updateDoc(doc(db, 'ledgerEntries', id), {
        deleted: true,
        deletedAt: now,
      });
    } catch (e) {}
    showToast({ type: 'info', message: `Entry "${target.label}" removed.` });
  };

  const updateLedgerEntry = async (id: string, updates: Partial<LedgerEntry>) => {
    setLedgerEntries((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
    try {
      await updateDoc(doc(db, 'ledgerEntries', id), updates);
    } catch (e) {}
    showToast({ type: 'success', message: 'Entry updated.' });
  };

  // LEDGER
  const addLedgerEntry = async (entry: Omit<LedgerEntry, 'id' | 'createdAt'>) => {
    const id = `led-${Date.now()}`;
    const newEntry: LedgerEntry = {
      ...entry,
      id,
      createdAt: new Date().toISOString(),
    };
    setLedgerEntries((prev) => [...prev, newEntry]);
    try {
      await setDoc(doc(db, 'ledgerEntries', id), newEntry);
    } catch (e) {}

    const currentBal = calculateFriendBalance(entry.friendId, [
      ...ledgerEntries,
      newEntry,
    ]);
    const friend = allUsers.find((u) => u.uid === entry.friendId);
    const friendEmail = friend?.email || `${entry.friendName.toLowerCase()}@example.com`;

    const subject = `Hisaab: Ledger adjustment - ${entry.label}`;
    const html = buildHisaabEmailHtml({
      friendName: entry.friendName,
      headline: `A ledger entry was recorded for "${entry.label}".`,
      subheadline: entry.label,
      amountText: formatPKR(entry.amount),
      newBalanceText: formatPKR(currentBal),
      details: entry.note,
    });
    await queueNotificationEmail({
      to: friendEmail,
      friendName: entry.friendName,
      subject,
      htmlBody: html,
    });

    const notifId = `notif-${Date.now()}-${entry.friendId}`;
    const friendlyLedgerBody =
      entry.type === 'payment'
        ? `${currentUser.displayName} recorded a payment of ${formatPKR(entry.amount)} for ${entry.label}.`
        : `${currentUser.displayName} added ${entry.label}. You owe ${formatPKR(entry.amount)}.`;
    const notif: AppNotification = {
      id: notifId,
      userId: entry.friendId,
      title: 'Hisaab',
      body: friendlyLedgerBody,
      read: false,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'notifications', notifId), notif);
    } catch (_) {}

    sendPushNotificationToUser(entry.friendId, {
      title: 'Hisaab',
      body: friendlyLedgerBody,
      link: `/?tab=history`,
      tag: `ledger-${id}`,
    }).catch(() => {});

    showToast({
      type: 'success',
      message: `Ledger entry recorded for ${entry.friendName}.`,
    });
  };

  // NUDGE
  const sendNudge = async (friendId: string) => {
    let friend =
      allUsers.find((u) => u.uid === friendId) ||
      friends.find((f) => f.uid === friendId) ||
      friendshipProfiles.find((f) => f.uid === friendId);

    if (!friend) {
      try {
        const pSnap = await getDoc(doc(db, 'publicProfiles', friendId));
        if (pSnap.exists()) {
          const pd = pSnap.data();
          friend = {
            uid: friendId,
            displayName: pd.displayName || pd.username || 'Friend',
            email: '',
            role: 'friend',
            notificationPref: 'instant',
            createdAt: new Date().toISOString(),
          };
        }
      } catch (_) {}
    }

    if (!friend) {
      showToast({ type: 'warning', message: 'Unable to locate friend details to send nudge.' });
      return;
    }

    const balance = friendBalance(friendId);
    triggerHaptic([80, 50, 100]);

    const subject = `Hisaab Nudge: Outstanding balance of ${formatPKR(balance)}`;
    const paymentTextBlock = formatPaymentMethodsText(currentUser.paymentMethods);
    const shareUrl = getFriendShareUrl(friendId) || `${SHARED_APP_URL}/?tab=history`;
    const reminderTextBody = `Salam ${friend.displayName}! Gentle reminder from ${currentUser.displayName} on Hisaab: You have an outstanding balance of ${formatPKR(balance)}.${paymentTextBlock}\n\nStatement Link: ${shareUrl}`;

    const html = buildHisaabEmailHtml({
      friendName: friend.displayName,
      headline: `A gentle reminder from ${currentUser.displayName} about your pending balance on Hisaab.`,
      subheadline: 'Current Outstanding Balance',
      amountText: formatPKR(balance),
      newBalanceText: formatPKR(balance),
      details: 'Please review your statement or use the payment details below to settle up.',
      actionUrl: shareUrl,
      paymentMethods: currentUser.paymentMethods,
    });

    const notifId = `notif-${Date.now()}-${friendId}`;
    const friendlyNudgeBody = `${currentUser.displayName} sent a reminder. You owe ${formatPKR(Math.abs(balance))}.`;
    const notif: AppNotification = {
      id: notifId,
      userId: friendId,
      title: 'Hisaab',
      body: friendlyNudgeBody,
      read: false,
      targetType: 'expense',
      targetId: currentUser.uid,
      link: `/?tab=history&friend=${currentUser.uid}`,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'notifications', notifId), notif);
    } catch (_) {}

    // Post real-time nudge card into DM thread if available
    try {
      const pairId = [currentUser.uid, friendId].sort().join('_');
      await sendDmMessage(pairId, {
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        text: `🔔 Sent a Nudge: Friendly reminder regarding outstanding balance of ${formatPKR(balance)}!${paymentTextBlock}`,
        mediaType: 'nudge',
      });
    } catch (dmErr) {
      console.debug('DM nudge message note:', dmErr);
    }

    // Dispatch background push alert to friend's phone/desktop
    sendPushNotificationToUser(friendId, {
      title: 'Hisaab',
      body: friendlyNudgeBody,
      link: `/?tab=history&friend=${currentUser.uid}`,
      tag: `nudge-${currentUser.uid}`,
    }).catch(() => {});

    await queueNotificationEmail({
      to: friend.email,
      friendName: friend.displayName,
      subject,
      htmlBody: html,
      textBody: reminderTextBody,
    }).catch(() => {});

    // Also attempt backend dispatch
    if (friend.email) {
      sendNotificationEmailViaBackend({
        toEmail: friend.email,
        subject,
        htmlBody: html,
        textBody: reminderTextBody,
      }).catch(() => {});
    }

    setNudgeTargetFriend({
      friend,
      balance,
      subject,
      textBody: reminderTextBody,
    });

    showToast({
      type: 'success',
      message: `In-app reminder sent to ${friend.displayName}!`,
    });
  };

  // PAYMENT CLAIMS
  const submitPaymentClaim = async (amount: number, note?: string) => {
    const id = `claim-${Date.now()}`;
    const newClaim: PaymentClaim = {
      id,
      friendId: currentUser.uid,
      friendName: currentUser.displayName,
      amount,
      note,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setPaymentClaims((prev) => [newClaim, ...prev]);
    try {
      await setDoc(doc(db, 'paymentClaims', id), newClaim);
    } catch (e) {}

    const notifId = `notif-${Date.now()}-${currentUser.uid}`;
    const notif: AppNotification = {
      id: notifId,
      userId: currentUser.uid,
      title: `Payment Claim Submitted`,
      body: `You recorded a payment claim of ${formatPKR(amount)}.`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [notif, ...prev]);

    showToast({
      type: 'success',
      message: `Payment claim of ${formatPKR(amount)} submitted.`,
    });
  };

  const resolvePaymentClaim = async (claimId: string, confirmed: boolean) => {
    const claim = paymentClaims.find((c) => c.id === claimId);
    if (!claim) return;

    const newStatus = confirmed ? 'confirmed' : 'rejected';
    setPaymentClaims((prev) =>
      prev.map((c) =>
        c.id === claimId
          ? {
              ...c,
              status: newStatus,
              resolvedAt: new Date().toISOString(),
              resolvedBy: currentUser.displayName,
            }
          : c
      )
    );
    try {
      await updateDoc(doc(db, 'paymentClaims', claimId), {
        status: newStatus,
        resolvedAt: new Date().toISOString(),
        resolvedBy: currentUser.displayName,
      });
    } catch (e) {}

    if (confirmed) {
      const ledId = `led-${Date.now()}`;
      const entry: LedgerEntry = {
        id: ledId,
        friendId: claim.friendId,
        friendName: claim.friendName,
        date: new Date().toISOString().split('T')[0],
        label: `Payment Confirmed: ${claim.note || 'Settlement'}`,
        amount: claim.amount,
        type: 'payment',
        note: claim.note,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
      };
      setLedgerEntries((prev) => [...prev, entry]);
      try {
        await setDoc(doc(db, 'ledgerEntries', ledId), entry);
      } catch (e) {}

      const newBal = calculateFriendBalance(claim.friendId, [
        ...ledgerEntries,
        entry,
      ]);
      const friend = allUsers.find((u) => u.uid === claim.friendId);
      const friendEmail = friend?.email || `${claim.friendName.toLowerCase()}@example.com`;

      const subject = `Hisaab: Payment of ${formatPKR(claim.amount)} Confirmed!`;
      const html = buildHisaabEmailHtml({
        friendName: claim.friendName,
        headline: `Zain confirmed your payment of ${formatPKR(claim.amount)}.`,
        subheadline: 'Payment Received',
        amountText: formatPKR(claim.amount),
        newBalanceText: formatPKR(newBal),
        details: claim.note || 'Ledger updated successfully',
      });
      await queueNotificationEmail({
        to: friendEmail,
        friendName: claim.friendName,
        subject,
        htmlBody: html,
      });

      showToast({
        type: 'success',
        message: `Confirmed ${formatPKR(claim.amount)} payment from ${claim.friendName}.`,
      });
    } else {
      showToast({
        type: 'info',
        message: `Declined payment claim from ${claim.friendName}.`,
      });
    }
  };

  // FORMAL SETTLEMENT & DEBT CLEARING
  const logSettlement = async (data: {
    recipientId: string;
    recipientName: string;
    amount: number;
    method: PaymentMethod;
    referenceId?: string;
    note?: string;
    proofUrl?: string;
    date?: string;
  }): Promise<SettlementRecord> => {
    const id = `stl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const dateStr = data.date || nowIso.split('T')[0];
    const newRecord: SettlementRecord = {
      id,
      payerId: currentUser.uid,
      payerName: currentUser.displayName,
      recipientId: data.recipientId,
      recipientName: data.recipientName,
      amount: data.amount,
      method: data.method,
      referenceId: data.referenceId || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      note: data.note,
      proofUrl: data.proofUrl,
      status: 'settled',
      date: dateStr,
      settledAt: nowIso,
      createdAt: nowIso,
      createdBy: currentUser.uid,
      createdByName: currentUser.displayName,
    };

    setSettlements((prev) => [newRecord, ...prev]);

    // Automatically record corresponding ledger entry with paymentDirection: 'paid_to_friend'
    // This immediately zeroes out or reduces the debt in Khata balances!
    const ledgerId = `led-stl-${Date.now()}-${data.recipientId}`;
    const newLedger: LedgerEntry = {
      id: ledgerId,
      friendId: data.recipientId,
      friendName: data.recipientName,
      date: dateStr,
      label: `Settled debt to ${data.recipientName} via ${data.method}`,
      amount: data.amount,
      type: 'payment',
      paymentDirection: 'paid_to_friend',
      payerId: currentUser.uid,
      payerName: currentUser.displayName,
      recipientId: data.recipientId,
      recipientName: data.recipientName,
      paymentMethod: data.method,
      settlementId: id,
      settlementRef: newRecord.referenceId,
      note: data.note,
      proofOfPayment: data.proofUrl,
      createdAt: nowIso,
      createdBy: currentUser.uid,
    };

    setLedgerEntries((prev) => [...prev, newLedger]);

    try {
      await setDoc(doc(db, 'settlements', id), newRecord);
      await setDoc(doc(db, 'ledgerEntries', ledgerId), newLedger);
    } catch (_) {}

    triggerHaptic([70, 50, 90]);
    showToast({
      type: 'success',
      message: `Settled ${formatPKR(data.amount)} with ${data.recipientName} via ${data.method}!`,
    });

    return newRecord;
  };

  // CHAT (SQUAD)
  const sendChatMessage = async (
    text: string,
    sharedCard?: {
      type: 'expense' | 'balance';
      title: string;
      amount: number;
      details?: string;
    },
    targetSquadId?: string,
    mediaOptions?: {
      mediaType?: 'text' | 'image' | 'audio' | 'nudge';
      imageUrl?: string;
      audioUrl?: string;
      audioDuration?: number;
    }
  ) => {
    if (!text.trim() && !mediaOptions?.imageUrl && !mediaOptions?.audioUrl) return;
    const sId = targetSquadId || activeSquadId || squadGroup?.id || 'default';
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newMsg: ChatMessage = {
      id,
      squadId: sId,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      userPhoto: currentUser.photoURL,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      ...(sharedCard ? { sharedCard } : {}),
      ...(mediaOptions?.mediaType ? { mediaType: mediaOptions.mediaType } : {}),
      ...(mediaOptions?.imageUrl ? { imageUrl: mediaOptions.imageUrl } : {}),
      ...(mediaOptions?.audioUrl ? { audioUrl: mediaOptions.audioUrl } : {}),
      ...(mediaOptions?.audioDuration !== undefined ? { audioDuration: mediaOptions.audioDuration } : {}),
    };

    // 1. Instant optimistic state update - 0ms UI delay
    setChatMessages((prev) => [...prev, newMsg]);

    // 2. Parallel background write to Firestore
    setDoc(doc(db, 'messages', id), newMsg).catch((e) => {
      console.warn('Squad message write note:', e);
    });

    // 3. Update preview in squad group doc asynchronously
    fbUpdateDoc(doc(db, 'squadGroup', sId), {
      lastMessageText: text.trim().slice(0, 80),
      lastMessageAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    // 4. Fire-and-forget background notifications without blocking
    setTimeout(() => {
      const notifiedUids = new Set<string>();
      notifiedUids.add(currentUser.uid); // Never notify self

      // 1. If text has @mentions, dispatch mention notifications
      if (text.includes('@')) {
        notifyMentions({
          text: text.trim(),
          senderUser: currentUser,
          sourceType: 'chat',
          sourceLabel: squadGroup?.name || 'Squad Chat',
          actionUrl: `${SHARED_APP_URL}/?tab=chat`,
        });

        // Collect all mentioned handles
        const matches = text.match(/@([a-zA-Z0-9_]+)/g) || [];
        matches.forEach((m) => {
          const handle = m.slice(1).toLowerCase();
          const target = allUsers.find(
            (u) =>
              (u.displayName && u.displayName.toLowerCase().replace(/\s+/g, '_') === handle) ||
              u.uid.toLowerCase() === handle
          );
          if (target) notifiedUids.add(target.uid);
        });
      }

      // 2. Only notify members of this specific squad group who haven't been notified yet
      const groupToNotify = squadGroups.find((s) => s.id === sId) || squadGroup;
      const memberUids = groupToNotify?.members || [];
      memberUids.forEach((mUid) => {
        if (!notifiedUids.has(mUid) && mUid !== currentUser.uid) {
          notifiedUids.add(mUid);
          const notifId = `notif-${Date.now()}-${mUid}`;
          setDoc(doc(db, 'notifications', notifId), {
            id: notifId,
            userId: mUid,
            title: `${currentUser.displayName} in ${groupToNotify?.name || 'Squad Chat'}`,
            body: text.trim().length > 80 ? text.trim().slice(0, 80) + '...' : text.trim(),
            read: false,
            createdAt: new Date().toISOString(),
          }).catch(() => {});
        }
      });
    }, 0);
  };

  const editChatMessage = async (
    id: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> => {
    const clean = text.trim();
    if (!clean) return { success: false, error: 'Message cannot be empty.' };

    const target = chatMessages.find((m) => m.id === id);
    if (!target) return { success: false, error: 'Message not found.' };

    const elapsed = Date.now() - new Date(target.createdAt).getTime();
    if (elapsed > 15 * 60 * 1000) {
      showToast({
        type: 'error',
        message: 'Editing is only allowed within 15 minutes of sending.',
      });
      return { success: false, error: 'Editing is only allowed within 15 minutes of sending.' };
    }

    const now = new Date().toISOString();
    setChatMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, text: clean, isEdited: true, updatedAt: now } : m
      )
    );
    try {
      await updateDoc(doc(db, 'messages', id), {
        text: clean,
        isEdited: true,
        updatedAt: now,
      });
      showToast({ type: 'success', message: 'Message updated.' });
      return { success: true };
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to edit message.' });
      return { success: false, error: e.message };
    }
  };

  const deleteChatMessageForEveryone = async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    const target = chatMessages.find((m) => m.id === id);
    if (!target) return { success: false, error: 'Message not found.' };

    const isMe = target.userId === currentUser.uid;
    const isSquadAdmin =
      squadGroup?.ownerUid === currentUser.uid ||
      (squadGroup?.admins || []).includes(currentUser.uid);

    if (!isMe && !isSquadAdmin) {
      showToast({
        type: 'error',
        message: 'You can only delete your own messages for everyone.',
      });
      return { success: false, error: 'Unauthorized' };
    }

    // Time limit: 15 minutes for non-admins
    const elapsed = Date.now() - new Date(target.createdAt).getTime();
    if (!isSquadAdmin && elapsed > 15 * 60 * 1000) {
      showToast({
        type: 'error',
        message: 'Delete for everyone is only allowed within 15 minutes of sending.',
      });
      return { success: false, error: 'Time limit exceeded' };
    }

    const now = new Date().toISOString();
    setChatMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              isDeleted: true,
              deletedForEveryone: true,
              text: 'This message was deleted',
              deletedAt: now,
            }
          : m
      )
    );

    try {
      await updateDoc(doc(db, 'messages', id), {
        isDeleted: true,
        deletedForEveryone: true,
        text: 'This message was deleted',
        deletedAt: now,
      });
      showToast({ type: 'info', message: 'Message deleted for everyone.' });
      return { success: true };
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to delete message for everyone.' });
      return { success: false, error: e.message };
    }
  };

  const deleteChatMessageForMe = async (id: string): Promise<void> => {
    const target = chatMessages.find((m) => m.id === id);
    const existing = target?.deletedFor || [];
    const updated = Array.from(new Set([...existing, currentUser.uid]));

    setChatMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, deletedFor: updated } : m))
    );

    try {
      await updateDoc(doc(db, 'messages', id), {
        deletedFor: updated,
      });
      showToast({ type: 'info', message: 'Message deleted for you.' });
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to remove message for you.' });
    }
  };

  const deleteChatMessage = async (id: string) => {
    await deleteChatMessageForEveryone(id);
  };

  const clearEntireSquadChat = async (squadId: string, deleteForEveryone = false): Promise<void> => {
    try {
      const q = squadId
        ? query(collection(db, 'messages'), where('squadId', '==', squadId))
        : collection(db, 'messages');
      const snap = await getDocs(q);
      if (snap.empty) {
        showToast({ type: 'info', message: 'Chat is already empty.' });
        return;
      }
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        const data = d.data();
        const existingDeletedFor = (data.deletedFor as string[]) || [];
        if (!existingDeletedFor.includes(currentUser.uid)) {
          batch.update(d.ref, { deletedFor: [...existingDeletedFor, currentUser.uid] });
        }
      });
      await batch.commit();

      // Update local state immediately
      setChatMessages((prev) =>
        prev.map((m) =>
          (!squadId || m.squadId === squadId)
            ? { ...m, deletedFor: Array.from(new Set([...(m.deletedFor || []), currentUser.uid])) }
            : m
        )
      );

      showToast({ type: 'success', message: 'Chat history cleared for you!' });
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to clear squad chat: ' + e.message });
    }
  };

  const toggleSquadMessageReaction = async (messageId: string, emoji: string) => {
    const target = chatMessages.find((m) => m.id === messageId);
    if (!target) return;

    const currentReactions = target.reactions || {};
    const currentList = currentReactions[emoji] || [];
    let nextList: string[];
    if (currentList.includes(currentUser.uid)) {
      nextList = currentList.filter((uid) => uid !== currentUser.uid);
    } else {
      nextList = [...currentList, currentUser.uid];
    }

    const nextReactions = { ...currentReactions, [emoji]: nextList };
    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions: nextReactions } : m))
    );

    try {
      await updateDoc(doc(db, 'messages', messageId), {
        reactions: nextReactions,
      });
    } catch (e) {}
  };

  // SQUAD GROUPS (WHATSAPP-STYLE MULTI-GROUP SYSTEM)
  const createSquadGroup = async ({
    name,
    description,
    avatarIcon,
    initialMemberUids = [],
  }: {
    name: string;
    description?: string;
    avatarIcon?: string;
    initialMemberUids?: string[];
  }): Promise<string> => {
    const squadId = `squad-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const inviteCode = `SQD-${randomCode}`;

    const newSquad: SquadGroupConfig = {
      id: squadId,
      name: name.trim(),
      description: description?.trim() || '',
      avatarIcon: avatarIcon || '👥',
      inviteCode,
      ownerUid: currentUser.uid,
      admins: [currentUser.uid],
      members: [currentUser.uid],
      whoCanAdd: 'all_members',
      whoCanRemove: 'admins',
      whoCanPost: 'all_members',
      whoCanEditInfo: 'admins',
      whoCanShareCards: 'all_members',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSquadGroups((prev) => [newSquad, ...prev]);
    setActiveSquadId(squadId);

    try {
      await fbSetDoc(doc(db, 'squadGroup', squadId), newSquad);

      // Send invitations to initial selected members
      if (initialMemberUids.length > 0) {
        for (const recipientUid of initialMemberUids) {
          if (recipientUid !== currentUser.uid) {
            const inviteId = `sinv-${Date.now()}-${recipientUid}`;
            const invite: SquadInvitation = {
              id: inviteId,
              squadId,
              squadName: newSquad.name,
              squadAvatar: newSquad.avatarIcon,
              squadDescription: newSquad.description,
              invitedByUid: currentUser.uid,
              invitedByName: currentUser.displayName,
              invitedByPhoto: currentUser.photoURL,
              recipientUid,
              status: 'pending',
              createdAt: new Date().toISOString(),
            };
            fbSetDoc(doc(db, 'squadInvitations', inviteId), invite).catch(() => {});
          }
        }
      }

      showToast({ type: 'success', message: `Group "${newSquad.name}" created!` });
      return squadId;
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to create group.' });
      return squadId;
    }
  };

  const joinSquadByInviteCode = async (
    code: string
  ): Promise<{ success: boolean; squad?: SquadGroupConfig; error?: string }> => {
    const clean = code.trim().toUpperCase();
    if (!clean) return { success: false, error: 'Please enter a valid invite code.' };

    try {
      const q = query(collection(db, 'squadGroup'), where('inviteCode', '==', clean));
      const snap = await getDocs(q);
      if (snap.empty) {
        return { success: false, error: 'No group found with this invite code.' };
      }

      const docData = snap.docs[0];
      const targetSquad = { id: docData.id, ...docData.data() } as SquadGroupConfig;

      if (targetSquad.members?.includes(currentUser.uid)) {
        setActiveSquadId(targetSquad.id);
        showToast({ type: 'info', message: `You are already a member of ${targetSquad.name}.` });
        return { success: true, squad: targetSquad };
      }

      const updatedMembers = [...(targetSquad.members || []), currentUser.uid];
      await fbUpdateDoc(doc(db, 'squadGroup', targetSquad.id), {
        members: updatedMembers,
        updatedAt: new Date().toISOString(),
      });

      const joinedSquad = { ...targetSquad, members: updatedMembers };
      setSquadGroups((prev) => {
        const exists = prev.some((s) => s.id === joinedSquad.id);
        return exists ? prev.map((s) => (s.id === joinedSquad.id ? joinedSquad : s)) : [joinedSquad, ...prev];
      });
      setActiveSquadId(joinedSquad.id);
      showToast({ type: 'success', message: `Joined group "${joinedSquad.name}"!` });
      return { success: true, squad: joinedSquad };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to join group.' };
    }
  };

  const sendSquadInvitation = async (squadId: string, recipientUid: string) => {
    const target = squadGroups.find((s) => s.id === squadId);
    if (!target) return;
    const inviteId = `sinv-${Date.now()}-${recipientUid}`;
    const invite: SquadInvitation = {
      id: inviteId,
      squadId,
      squadName: target.name,
      squadAvatar: target.avatarIcon,
      squadDescription: target.description,
      invitedByUid: currentUser.uid,
      invitedByName: currentUser.displayName,
      invitedByPhoto: currentUser.photoURL,
      recipientUid,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    try {
      await fbSetDoc(doc(db, 'squadInvitations', inviteId), invite);
      // In-app alert
      const notifId = `notif-${Date.now()}-${recipientUid}`;
      fbSetDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: recipientUid,
        title: `Group Invite: ${target.name}`,
        body: `${currentUser.displayName} invited you to join "${target.name}".`,
        read: false,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
      showToast({ type: 'success', message: 'Group invitation sent!' });
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to send group invitation.' });
    }
  };

  const respondToSquadInvitation = async (invitationId: string, accept: boolean) => {
    const invite = squadInvitations.find((i) => i.id === invitationId);
    if (!invite) return;

    try {
      if (accept) {
        const squadRef = doc(db, 'squadGroup', invite.squadId);
        const snap = await getDoc(squadRef);
        if (snap.exists()) {
          const data = snap.data() as SquadGroupConfig;
          const members = Array.from(new Set([...(data.members || []), currentUser.uid]));
          await fbUpdateDoc(squadRef, { members, updatedAt: new Date().toISOString() });
          setActiveSquadId(invite.squadId);
          showToast({ type: 'success', message: `Joined "${invite.squadName}"!` });
        }
      } else {
        showToast({ type: 'info', message: 'Invitation declined.' });
      }

      await fbUpdateDoc(doc(db, 'squadInvitations', invitationId), {
        status: accept ? 'accepted' : 'declined',
      });
      setSquadInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to update invitation.' });
    }
  };

  const leaveSquadGroup = async (squadId: string) => {
    const target = squadGroups.find((s) => s.id === squadId);
    if (!target) return;
    if (target.ownerUid === currentUser.uid && (target.members?.length || 0) > 1) {
      showToast({ type: 'error', message: 'Please transfer ownership before leaving the group.' });
      return;
    }

    const members = (target.members || []).filter((uid) => uid !== currentUser.uid);
    const admins = (target.admins || []).filter((uid) => uid !== currentUser.uid);

    try {
      if (members.length === 0) {
        await deleteDoc(doc(db, 'squadGroup', squadId));
      } else {
        await fbUpdateDoc(doc(db, 'squadGroup', squadId), {
          members,
          admins,
          updatedAt: new Date().toISOString(),
        });
      }
      setSquadGroups((prev) => prev.filter((s) => s.id !== squadId));
      setActiveSquadId(null);
      showToast({ type: 'info', message: `Left "${target.name}".` });
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to leave group.' });
    }
  };

  const deleteSquadGroup = async (squadId: string) => {
    const target = squadGroups.find((s) => s.id === squadId);
    if (!target) return;
    if (target.ownerUid !== currentUser.uid) {
      showToast({ type: 'error', message: 'Only the squad owner can delete this group.' });
      return;
    }
    try {
      await deleteDoc(doc(db, 'squadGroup', squadId));
      setSquadGroups((prev) => prev.filter((s) => s.id !== squadId));
      setActiveSquadId(null);
      showToast({ type: 'info', message: `Group "${target.name}" deleted.` });
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to delete group.' });
    }
  };

  const updateSquadConfig = async (
    updates: Partial<SquadGroupConfig>,
    targetSquadId?: string
  ) => {
    const sId = targetSquadId || activeSquadId || squadGroup?.id || 'default';
    const current = squadGroups.find((s) => s.id === sId) || squadGroup;
    if (!current) return;
    const updated: SquadGroupConfig = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setSquadGroups((prev) => prev.map((s) => (s.id === sId ? updated : s)));
    try {
      await fbSetDoc(doc(db, 'squadGroup', sId), updated, { merge: true });
      showToast({ type: 'success', message: 'Group configuration updated.' });
    } catch (e: any) {
      showToast({ type: 'error', message: 'Failed to update squad configuration.' });
    }
  };

  const addSquadMember = async (uid: string, targetSquadId?: string) => {
    const sId = targetSquadId || activeSquadId || squadGroup?.id || 'default';
    const current = squadGroups.find((s) => s.id === sId) || squadGroup;
    if (!current) return;
    if ((current.members || []).includes(uid)) return;
    const members = [...(current.members || []), uid];
    await updateSquadConfig({ members }, sId);
    showToast({ type: 'success', message: 'Member added to group!' });
  };

  const removeSquadMember = async (uid: string, targetSquadId?: string) => {
    const sId = targetSquadId || activeSquadId || squadGroup?.id || 'default';
    const current = squadGroups.find((s) => s.id === sId) || squadGroup;
    if (!current) return;
    if (uid === current.ownerUid) {
      showToast({ type: 'error', message: 'Cannot remove the group owner.' });
      return;
    }
    const members = (current.members || []).filter((m) => m !== uid);
    const admins = (current.admins || []).filter((m) => m !== uid);
    await updateSquadConfig({ members, admins }, sId);
    showToast({ type: 'info', message: 'Member removed from group.' });
  };

  const toggleSquadAdmin = async (uid: string, targetSquadId?: string) => {
    const sId = targetSquadId || activeSquadId || squadGroup?.id || 'default';
    const current = squadGroups.find((s) => s.id === sId) || squadGroup;
    if (!current) return;
    if (uid === current.ownerUid) return;
    const isAdmin = (current.admins || []).includes(uid);
    const admins = isAdmin
      ? (current.admins || []).filter((m) => m !== uid)
      : [...(current.admins || []), uid];
    await updateSquadConfig({ admins }, sId);
    showToast({
      type: 'success',
      message: isAdmin ? 'Admin role revoked.' : 'Promoted to Group Admin!',
    });
  };

  const transferSquadOwnership = async (newOwnerUid: string, targetSquadId?: string) => {
    const sId = targetSquadId || activeSquadId || squadGroup?.id || 'default';
    const current = squadGroups.find((s) => s.id === sId) || squadGroup;
    if (!current) return;
    if (current.ownerUid !== currentUser.uid) {
      showToast({ type: 'error', message: 'Only current group owner can transfer ownership.' });
      return;
    }
    const admins = Array.from(new Set([...(current.admins || []), newOwnerUid, currentUser.uid]));
    const members = Array.from(new Set([...(current.members || []), newOwnerUid]));
    await updateSquadConfig({ ownerUid: newOwnerUid, admins, members }, sId);
    showToast({ type: 'success', message: 'Group ownership transferred!' });
  };

  // COMMENTS
  const addComment = async (
    targetType: 'expense' | 'ledger',
    targetId: string,
    text: string
  ) => {
    if (!text.trim()) return;
    const id = `com-${Date.now()}`;
    const newCom: CommentItem = {
      id,
      targetType,
      targetId,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, newCom]);
    try {
      await setDoc(doc(db, 'comments', id), newCom);
    } catch (e) {}

    // Process mentions in comment
    notifyMentions({
      text: text.trim(),
      senderUser: currentUser,
      sourceType: 'comment',
      sourceLabel: targetType === 'expense' ? 'Expense Comment' : 'Ledger Comment',
    });
  };

  // REACTIONS
  const toggleReaction = async (
    targetType: 'expense' | 'message' | 'ledger',
    targetId: string,
    emoji: string
  ) => {
    const existing = reactions.find(
      (r) =>
        r.targetId === targetId &&
        r.emoji === emoji &&
        r.userId === currentUser.uid
    );

    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      try {
        await deleteDoc(doc(db, 'reactions', existing.id));
      } catch (e) {}
    } else {
      const id = `react-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      const newReact: ReactionItem = {
        id,
        targetType,
        targetId,
        emoji,
        userId: currentUser.uid,
        userName: currentUser.displayName,
        createdAt: new Date().toISOString(),
      };
      setReactions((prev) => [...prev, newReact]);
      try {
        await setDoc(doc(db, 'reactions', id), newReact);
      } catch (e) {}
    }
  };

  // NOTIFICATIONS
  const markNotificationRead = async (id: string) => {
    saveStoredReadNotifId(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, processed: true } : n))
    );
    try {
      await updateDoc(doc(db, 'notifications', id), {
        read: true,
        processed: true,
        processedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('markNotificationRead note:', e);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (e) {
      console.warn('deleteNotification error:', e);
    }
  };

  const deleteAllNotifications = async () => {
    const list = [...notifications];
    setNotifications([]);
    for (const n of list) {
      try {
        await deleteDoc(doc(db, 'notifications', n.id));
      } catch (e) {}
    }
    showToast({ type: 'info', message: 'All notifications cleared.' });
  };

  const clearAllNotifications = async () => {
    const unread = notifications.filter((n) => !n.read);
    const unreadIds = unread.map((n) => n.id);
    saveStoredReadNotifIds(unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true, processed: true })));

    for (const n of unread) {
      try {
        await updateDoc(doc(db, 'notifications', n.id), {
          read: true,
          processed: true,
          processedAt: new Date().toISOString(),
        });
      } catch (e) {}
    }
  };

  const clearNotificationsForTarget = useCallback(
    async (targetType: 'chat' | 'expense' | 'dm', targetId?: string) => {
      const activeUid = firebaseAuthUser?.uid || currentUser.uid;
      if (!activeUid) return;

      const toClear = notifications.filter((n) => {
        if (n.read) return false;
        if (targetType === 'dm') {
          if (n.targetType === 'dm' && targetId && n.targetId === targetId) return true;
          if (targetId && (n.link?.includes(`dm=${targetId}`) || n.link?.includes(`friend=${targetId}`))) return true;
          return false;
        }
        if (targetType === 'chat') {
          return (
            n.targetType === 'chat' ||
            n.link?.includes('tab=chat') ||
            n.title.toLowerCase().includes('squad') ||
            n.title.toLowerCase().includes('group') ||
            n.title.toLowerCase().includes('message')
          );
        }
        if (targetType === 'expense') {
          return (
            n.targetType === 'expense' ||
            n.link?.includes('tab=history') ||
            n.title.toLowerCase().includes('nudge') ||
            n.title.toLowerCase().includes('reminder') ||
            n.title.toLowerCase().includes('balance') ||
            n.title.toLowerCase().includes('expense')
          );
        }
        return false;
      });

      if (toClear.length === 0) return;

      const clearedIds = toClear.map((n) => n.id);
      saveStoredReadNotifIds(clearedIds);
      const clearedSet = new Set(clearedIds);

      setNotifications((prev) =>
        prev.map((n) => (clearedSet.has(n.id) ? { ...n, read: true, processed: true } : n))
      );

      for (const n of toClear) {
        try {
          await updateDoc(doc(db, 'notifications', n.id), {
            read: true,
            processed: true,
            processedAt: new Date().toISOString(),
          });
        } catch (_) {}
      }
    },
    [notifications, firebaseAuthUser, currentUser.uid, saveStoredReadNotifIds]
  );

  // MAIL QUEUE
  const triggerMailQueueProcess = async () => {
    const res = await processPendingMailQueue();
    if (res.sent > 0) {
      showToast({
        type: 'success',
        message: `Dispatched ${res.sent} email(s) via Gmail!`,
      });
    } else if (res.failed > 0) {
      showToast({
        type: 'warning',
        message: `${res.failed} email(s) failed. Check delivery logs.`,
      });
    } else {
      showToast({ type: 'info', message: 'Mail queue is up to date.' });
    }
    return res;
  };

  // BUDGET (User-scoped personal budget)
  const updateMonthBudget = async (
    budget: number,
    carryOver: number,
    openingBalance: number
  ) => {
    const activeUid = currentUser.uid || firebaseAuthUser?.uid;
    if (!activeUid) return;

    const docId = `${activeUid}_${currentMonth.monthKey}`;
    const updated: MonthData = {
      ...currentMonth,
      id: docId,
      userId: activeUid,
      budget,
      carryOver,
      openingBalance,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`hisaab_budget_${activeUid}_${currentMonth.monthKey}`, JSON.stringify(updated));
    } catch (_) {}

    setCurrentMonth(updated);
    setAllMonths((prev) => {
      const remaining = prev.filter((m) => m.id !== docId && m.monthKey !== currentMonth.monthKey);
      return [...remaining, updated];
    });

    try {
      await setDoc(doc(db, 'months', docId), updated);
    } catch (e) {
      console.warn('Budget save note:', e);
    }
    showToast({ type: 'success', message: 'Budget parameters saved.' });
  };

  const createSplitExpenseFromFixedBill = async (
    bill: FixedExpense,
    monthKey: string
  ): Promise<string | null> => {
    if (!bill.isShared || !bill.splitFriendIds || bill.splitFriendIds.length === 0) {
      return null;
    }

    const participantFriends = bill.splitFriendIds
      .map((fId) => friends.find((f) => f.uid === fId) || allUsers.find((u) => u.uid === fId))
      .filter((f): f is UserProfile => Boolean(f));

    if (participantFriends.length === 0) return null;

    const totalParticipants = participantFriends.length + 1; // +1 for currentUser
    const perPersonShare = Math.round(bill.amount / totalParticipants);
    const remainder = bill.amount - perPersonShare * totalParticipants;

    const splits = [
      {
        userId: currentUser.uid,
        userName: currentUser.displayName,
        share: perPersonShare + remainder,
      },
      ...participantFriends.map((fr) => ({
        userId: fr.uid,
        userName: fr.displayName,
        share: perPersonShare,
      })),
    ];

    const dueDayPadded = String(bill.dueDay || 1).padStart(2, '0');
    const expDate = bill.date?.startsWith(monthKey)
      ? bill.date
      : `${monthKey}-${dueDayPadded}`;

    const createdId = await addExpense({
      date: expDate,
      title: `${bill.title} (${formatMonthDisplay(monthKey)})`,
      amount: bill.amount,
      category: bill.category || 'Rent',
      paidBy: currentUser.uid,
      paidByName: currentUser.displayName,
      splitType: 'equal',
      splits,
      note: `Auto-created recurring shared bill (Due day ${bill.dueDay || 1})`,
      recurringBillId: bill.id,
      createdBy: currentUser.uid,
      createdByName: currentUser.displayName,
    });

    return createdId;
  };

  const addFixedExpense = async (
    title: string,
    amount: number,
    date: string,
    options?: {
      dueDay?: number;
      isShared?: boolean;
      splitFriendIds?: string[];
      category?: ExpenseCategory;
    }
  ) => {
    const activeUid = currentUser.uid || firebaseAuthUser?.uid;
    if (!activeUid) return;

    const dueDay =
      options?.dueDay ||
      parseInt((date || '').split('-')[2] || '1', 10) ||
      1;
    const isShared = Boolean(options?.isShared && options?.splitFriendIds && options.splitFriendIds.length > 0);
    const splitFriendIds = isShared ? options?.splitFriendIds : undefined;

    const newFixed: FixedExpense = {
      id: `fix-${Date.now()}`,
      title,
      amount,
      date,
      paid: true,
      dueDay,
      category: options?.category || 'Rent',
      isShared,
      splitFriendIds,
    };

    // Check if due date is today or already reached in this month to auto-create split immediately
    const today = new Date();
    const todayDay = today.getDate();
    if (isShared && todayDay >= dueDay) {
      const expId = await createSplitExpenseFromFixedBill(newFixed, currentMonth.monthKey);
      if (expId) {
        newFixed.lastAutoSplitMonth = currentMonth.monthKey;
        newFixed.autoCreatedExpenseId = expId;
      }
    }

    const docId = `${activeUid}_${currentMonth.monthKey}`;
    const updated: MonthData = {
      ...currentMonth,
      id: docId,
      userId: activeUid,
      fixedExpenses: [...(currentMonth.fixedExpenses || []), newFixed],
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`hisaab_budget_${activeUid}_${currentMonth.monthKey}`, JSON.stringify(updated));
    } catch (_) {}

    setCurrentMonth(updated);
    setAllMonths((prev) => {
      const remaining = prev.filter((m) => m.id !== docId && m.monthKey !== currentMonth.monthKey);
      return [...remaining, updated];
    });

    try {
      await setDoc(doc(db, 'months', docId), updated);
    } catch (e) {}
    showToast({
      type: 'success',
      message: isShared
        ? `Added recurring shared bill "${title}"${
            newFixed.lastAutoSplitMonth ? ' & created this month’s split!' : ` (auto-splits on day ${dueDay})`
          }`
        : `Added fixed expense: ${title}`,
    });
  };

  const deleteFixedExpense = async (id: string) => {
    const activeUid = currentUser.uid || firebaseAuthUser?.uid;
    if (!activeUid) return;

    const updatedFixed = (currentMonth.fixedExpenses || []).filter((f) => f.id !== id);
    const docId = `${activeUid}_${currentMonth.monthKey}`;
    const updated: MonthData = {
      ...currentMonth,
      id: docId,
      userId: activeUid,
      fixedExpenses: updatedFixed,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`hisaab_budget_${activeUid}_${currentMonth.monthKey}`, JSON.stringify(updated));
    } catch (_) {}

    setCurrentMonth(updated);
    setAllMonths((prev) => {
      const remaining = prev.filter((m) => m.id !== docId && m.monthKey !== currentMonth.monthKey);
      return [...remaining, updated];
    });

    try {
      await setDoc(doc(db, 'months', docId), updated);
    } catch (_) {}
    showToast({ type: 'info', message: 'Recurring bill removed.' });
  };

  const triggerFixedBillSplit = async (billId: string) => {
    const activeUid = currentUser.uid || firebaseAuthUser?.uid;
    if (!activeUid) return;

    const targetBill = (currentMonth.fixedExpenses || []).find((f) => f.id === billId);
    if (!targetBill || !targetBill.isShared || !targetBill.splitFriendIds?.length) return;

    if (targetBill.lastAutoSplitMonth === currentMonth.monthKey) {
      showToast({
        type: 'info',
        message: `${targetBill.title} was already split for ${formatMonthDisplay(currentMonth.monthKey)}.`,
      });
      return;
    }

    const expId = await createSplitExpenseFromFixedBill(targetBill, currentMonth.monthKey);
    if (!expId) return;

    const updatedFixed = currentMonth.fixedExpenses.map((f) =>
      f.id === billId
        ? {
            ...f,
            paid: true,
            lastAutoSplitMonth: currentMonth.monthKey,
            autoCreatedExpenseId: expId,
          }
        : f
    );

    const docId = `${activeUid}_${currentMonth.monthKey}`;
    const updated: MonthData = {
      ...currentMonth,
      id: docId,
      userId: activeUid,
      fixedExpenses: updatedFixed,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`hisaab_budget_${activeUid}_${currentMonth.monthKey}`, JSON.stringify(updated));
    } catch (_) {}

    setCurrentMonth(updated);
    setAllMonths((prev) => {
      const remaining = prev.filter((m) => m.id !== docId && m.monthKey !== currentMonth.monthKey);
      return [...remaining, updated];
    });

    try {
      await setDoc(doc(db, 'months', docId), updated);
    } catch (_) {}
  };

  // Auto-check recurring shared bills on the due date each month
  const autoSplitRunningRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const activeUid = currentUser.uid || firebaseAuthUser?.uid;
    if (!activeUid || !currentMonth.fixedExpenses?.length || friends.length === 0) return;

    const todayDay = new Date().getDate();
    const dueSharedBills = currentMonth.fixedExpenses.filter((b) => {
      if (!b.isShared || !b.splitFriendIds?.length) return false;
      if (b.lastAutoSplitMonth === currentMonth.monthKey) return false;
      const dueDay = b.dueDay || parseInt((b.date || '').split('-')[2] || '1', 10) || 1;
      const lockKey = `${b.id}_${currentMonth.monthKey}`;
      if (autoSplitRunningRef.current.has(lockKey)) return false;
      return todayDay >= dueDay;
    });

    if (dueSharedBills.length === 0) return;

    dueSharedBills.forEach((b) => {
      autoSplitRunningRef.current.add(`${b.id}_${currentMonth.monthKey}`);
    });

    (async () => {
      let modified = false;
      const nextFixed = [...currentMonth.fixedExpenses];
      for (let i = 0; i < nextFixed.length; i++) {
        const bill = nextFixed[i];
        const dueDay = bill.dueDay || parseInt((bill.date || '').split('-')[2] || '1', 10) || 1;
        if (
          bill.isShared &&
          bill.splitFriendIds?.length &&
          bill.lastAutoSplitMonth !== currentMonth.monthKey &&
          todayDay >= dueDay
        ) {
          const expId = await createSplitExpenseFromFixedBill(bill, currentMonth.monthKey);
          if (expId) {
            nextFixed[i] = {
              ...bill,
              paid: true,
              lastAutoSplitMonth: currentMonth.monthKey,
              autoCreatedExpenseId: expId,
            };
            modified = true;
          }
        }
      }

      if (modified) {
        const docId = `${activeUid}_${currentMonth.monthKey}`;
        const updated: MonthData = {
          ...currentMonth,
          id: docId,
          userId: activeUid,
          fixedExpenses: nextFixed,
          updatedAt: new Date().toISOString(),
        };
        setCurrentMonth(updated);
        setAllMonths((prev) => [
          ...prev.filter((m) => m.id !== docId && m.monthKey !== currentMonth.monthKey),
          updated,
        ]);
        try {
          localStorage.setItem(
            `hisaab_budget_${activeUid}_${currentMonth.monthKey}`,
            JSON.stringify(updated)
          );
          await setDoc(doc(db, 'months', docId), updated);
        } catch (_) {}
      }
    })();
  }, [currentMonth.fixedExpenses, currentMonth.monthKey, friends.length, currentUser.uid, firebaseAuthUser?.uid]);

  const toggleFixedExpensePaid = async (id: string) => {
    const activeUid = currentUser.uid || firebaseAuthUser?.uid;
    if (!activeUid) return;

    const updatedFixed = currentMonth.fixedExpenses.map((f) =>
      f.id === id ? { ...f, paid: !f.paid } : f
    );
    const docId = `${activeUid}_${currentMonth.monthKey}`;
    const updated: MonthData = {
      ...currentMonth,
      id: docId,
      userId: activeUid,
      fixedExpenses: updatedFixed,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`hisaab_budget_${activeUid}_${currentMonth.monthKey}`, JSON.stringify(updated));
    } catch (_) {}

    setCurrentMonth(updated);
    setAllMonths((prev) => {
      const remaining = prev.filter((m) => m.id !== docId && m.monthKey !== currentMonth.monthKey);
      return [...remaining, updated];
    });

    try {
      await setDoc(doc(db, 'months', docId), updated);
    } catch (e) {}
  };

  const startNewMonth = async (newMonthKey: string, budget: number) => {
    const activeUid = currentUser.uid || firebaseAuthUser?.uid;
    if (!activeUid) return;

    const currentMonthExpenses = expenses.filter(
      (e) => !e.deleted && e.date.startsWith(selectedMonthKey)
    );
    const totalSpent = currentMonthExpenses.reduce((s, e) => s + e.amount, 0);
    const fixedTotal = currentMonth.fixedExpenses
      .filter((f) => f.paid)
      .reduce((s, f) => s + f.amount, 0);
    const calculatedCarryOver = Math.max(
      0,
      currentMonth.budget + currentMonth.carryOver - (totalSpent + fixedTotal)
    );

    // Carry over recurring fixed expenses into the new month with updated dates
    const recurringFixed: FixedExpense[] = (currentMonth.fixedExpenses || []).map((f) => {
      const dayNum = f.dueDay || parseInt((f.date || '').split('-')[2] || '1', 10) || 1;
      const dayStr = String(dayNum).padStart(2, '0');
      return {
        ...f,
        date: `${newMonthKey}-${dayStr}`,
        dueDay: dayNum,
        paid: false,
      };
    });

    const docId = `${activeUid}_${newMonthKey}`;
    const newM: MonthData = {
      id: docId,
      userId: activeUid,
      monthKey: newMonthKey,
      monthName: formatMonthDisplay(newMonthKey),
      budget,
      carryOver: calculatedCarryOver,
      openingBalance: calculatedCarryOver,
      fixedExpenses: recurringFixed,
      createdAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`hisaab_budget_${activeUid}_${newMonthKey}`, JSON.stringify(newM));
    } catch (_) {}

    setAllMonths((prev) => [...prev.filter((m) => m.id !== docId && m.monthKey !== newMonthKey), newM]);
    setSelectedMonthKey(newMonthKey);
    setCurrentMonth(newM);
    try {
      await setDoc(doc(db, 'months', docId), newM);
    } catch (e) {}
    showToast({
      type: 'success',
      message: `Started ${newMonthKey} with Rs ${calculatedCarryOver} carryover!`,
    });
  };

  // Reset / Clear Data
  const loadSampleData = async () => {
    showToast({ type: 'info', message: 'Ready to track your own real expenses and friends!' });
  };

  const clearAllData = async () => {
    // Safety check: Never delete shared split bills or Khata debts!
    // Friends' owed balances and split bills are strictly preserved.
    const preservedSplitBills = expenses.filter(
      (e) => e.splits && e.splits.length > 0 && e.splits.some((s) => s.userId !== e.createdBy)
    );
    const preservedSplitBillIds = new Set(preservedSplitBills.map((e) => e.id));

    // Keep all ledger entries belonging to preserved split bills or active friend balances
    const preservedLedgers = ledgerEntries.filter(
      (l) => (l.refExpenseId && preservedSplitBillIds.has(l.refExpenseId)) || l.type === 'owes' || l.type === 'payment'
    );

    // Only clear personal solo expenses created by currentUser
    const personalExpensesToRemove = expenses.filter(
      (e) =>
        (!e.splits || e.splits.length === 0 || !e.splits.some((s) => s.userId !== e.createdBy)) &&
        e.createdBy === currentUser.uid
    );

    setExpenses(preservedSplitBills);
    setLedgerEntries(preservedLedgers);
    setPaymentClaims([]);
    setIsSampleLoaded(false);

    try {
      await Promise.allSettled(
        personalExpensesToRemove.map((e) => deleteDoc(doc(db, 'expenses', e.id)))
      );
    } catch (_) {}

    showToast({
      type: 'success',
      message: 'Personal expenses cleared. All shared split bills and Khata debts were safely preserved!',
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        publicProfile,
        firebaseAuthUser,
        isAuthLoading,
        setCurrentUser,
        allUsers,
        friends,
        claimMyUsername,
        updatePaymentMethods,
        needsUsernameClaim,
        setNeedsUsernameClaim,
        addCustomFriend,
        friendRequests,
        incomingRequests,
        outgoingRequests,
        friendships,
        sendRequestToUser,
        acceptIncomingRequest,
        declineIncomingRequest,
        cancelOutgoingRequest,
        removeFriend,
        unfriendUser,
        dmThreads,
        currentMonth,
        allMonths,
        selectedMonthKey,
        setSelectedMonthKey,
        updateMonthBudget,
        addFixedExpense,
        deleteFixedExpense,
        triggerFixedBillSplit,
        toggleFixedExpensePaid,
        startNewMonth,
        expenses,
        activeExpenses,
        trashExpenses,
        addExpense,
        updateExpense,
        disputeExpense,
        resolveExpenseDispute,
        deleteExpense,
        undoDeleteExpense,
        permanentlyDeleteExpense,
        ledgerEntries,
        activeLedgerEntries,
        addLedgerEntry,
        updateLedgerEntry,
        deleteLedgerEntry,
        friendBalance,
        sendNudge,
        shareLinksMap,
        getFriendShareUrl,
        regenerateLink,
        revokeLink,
        paymentClaims,
        submitPaymentClaim,
        resolvePaymentClaim,
        settlements,
        logSettlement,
        chatMessages,
        sendChatMessage,
        editChatMessage,
        deleteChatMessage,
        deleteChatMessageForEveryone,
        deleteChatMessageForMe,
        clearEntireSquadChat,
        toggleSquadMessageReaction,
        chatMessageLimit,
        hasMoreChatMessages,
        loadMoreChatMessages,
        squadGroups,
        squadGroup,
        activeSquadId,
        setActiveSquadId,
        squadInvitations,
        createSquadGroup,
        joinSquadByInviteCode,
        respondToSquadInvitation,
        sendSquadInvitation,
        leaveSquadGroup,
        deleteSquadGroup,
        updateSquadConfig,
        addSquadMember,
        removeSquadMember,
        toggleSquadAdmin,
        transferSquadOwnership,
        comments,
        addComment,
        reactions,
        toggleReaction,
        notifications,
        markNotificationRead,
        deleteNotification,
        deleteAllNotifications,
        clearAllNotifications,
        clearNotificationsForTarget,
        nudgeTargetFriend,
        setNudgeTargetFriend,
        queuedEmails,
        triggerMailQueueProcess,
        auditLogs,
        darkMode,
        themeMode,
        setThemeMode,
        toggleDarkMode,
        appLockPin,
        isAppLocked,
        hideAmounts,
        setAppLockPin,
        unlockApp,
        lockAppNow,
        toggleHideAmounts,
        toasts,
        showToast,
        removeToast,
        isSampleLoaded,
        loadSampleData,
        clearAllData,
        isOwnerMode,
        isOnline,
        activeScreen,
        setActiveScreen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
