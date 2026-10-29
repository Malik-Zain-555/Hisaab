export type UserRole = 'user' | 'owner' | 'friend';

export type SavedPaymentProvider =
  | 'JazzCash'
  | 'EasyPaisa'
  | 'SadaPay'
  | 'NayaPay'
  | 'Bank Account';

export interface PaymentMethodDetail {
  id: string;
  provider: SavedPaymentProvider;
  accountTitle: string;
  accountNumber: string;
  ibanOrNote?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  role: UserRole;
  notificationPref: 'instant' | 'daily' | 'off';
  paymentMethods?: PaymentMethodDetail[];
  createdAt: string;
  updatedAt?: string;
}

export type ExpenseCategory =
  | 'Food'
  | 'Snacks'
  | 'Rent'
  | 'Study'
  | 'Transport'
  | 'Personal'
  | 'Other';

export interface SplitDetail {
  userId: string;
  userName: string;
  share: number;
}

export interface ExpenseActivityEntry {
  id: string;
  type: 'added' | 'edited' | 'disputed' | 'resolved';
  actorUid: string;
  actorName: string;
  note?: string;
  createdAt: string;
}

export interface ExpenseDisputeInfo {
  isDisputed: boolean;
  disputedByUid: string;
  disputedByName: string;
  note: string;
  disputedAt: string;
  resolvedAt?: string;
  resolvedByUid?: string;
  resolvedByName?: string;
  resolutionNote?: string;
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD e.g. "2026-10-08"
  title: string;
  amount: number;
  category: ExpenseCategory;
  paidBy: string; // userId or 'me'
  paidByName: string;
  splitType: 'equal' | 'custom' | 'friend_full' | 'personal';
  splits: SplitDetail[];
  note?: string;
  status: 'approved' | 'pending' | 'rejected';
  createdBy: string;
  createdByName: string;
  whatEat?: string; // Item / what was eaten
  timeWhen?: string; // Date / Time of meal
  situation?: string; // Situation / occasion / context
  proofOfPayment?: string; // Base64 data URL proof receipt/screenshot
  dispute?: ExpenseDisputeInfo;
  activityLog?: ExpenseActivityEntry[];
  recurringBillId?: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  deleted?: boolean;
  deletedAt?: number;
}

export type PaymentMethod =
  | 'EasyPaisa'
  | 'JazzCash'
  | 'Nayapay / Sadapay'
  | 'Bank Transfer'
  | 'Cash'
  | 'Other';

export interface SettlementRecord {
  id: string;
  payerId: string;
  payerName: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  method: PaymentMethod;
  referenceId: string;
  note?: string;
  proofUrl?: string;
  status: 'settled';
  date: string; // YYYY-MM-DD
  settledAt: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

export interface LedgerEntry {
  id: string;
  friendId: string;
  friendName: string;
  date: string; // YYYY-MM-DD
  label: string;
  amount: number; // positive = friend owes, negative = friend paid or credit adjustment
  type: 'owes' | 'adjustment' | 'payment';
  refExpenseId?: string;
  settlementId?: string;
  settlementRef?: string;
  note?: string;
  whatEat?: string; // What was eaten
  timeWhen?: string; // Time/date
  situation?: string; // Situation / reason
  paymentDirection?: 'paid_to_friend' | 'received_from_friend';
  payerId?: string;
  payerName?: string;
  recipientId?: string;
  recipientName?: string;
  paymentMethod?: PaymentMethod | string;
  proofOfPayment?: string; // Image proof / receipt
  createdAt: string;
  createdBy: string;
  deleted?: boolean;
  deletedAt?: number;
}

export interface FixedExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid: boolean;
  dueDay?: number; // 1-31 day of month
  category?: ExpenseCategory;
  isShared?: boolean;
  splitFriendIds?: string[]; // Friend UIDs to split with
  lastAutoSplitMonth?: string; // e.g. "2026-10"
  autoCreatedExpenseId?: string;
}

export interface MonthData {
  id: string; // "2026-10" or "${userId}_2026-10"
  monthKey: string; // "2026-10"
  monthName: string; // "October 2026"
  userId?: string;
  budget: number;
  fixedExpenses: FixedExpense[];
  carryOver: number;
  openingBalance: number;
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentClaim {
  id: string;
  friendId: string;
  friendName: string;
  amount: number;
  note?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ChatMessage {
  id: string;
  squadId?: string; // Group ID to support multiple private groups
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  mediaType?: 'text' | 'image' | 'audio' | 'nudge';
  imageUrl?: string;
  audioUrl?: string; // base64 Data URL or audio link
  audioDuration?: number; // duration in seconds
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
  deletedFor?: string[]; // UIDs who chose "delete for me"
  deletedAt?: string;
  reactions?: { [emoji: string]: string[] };
  sharedCard?: {
    type: 'expense' | 'balance';
    title: string;
    amount: number;
    details?: string;
  };
}

export interface SquadGroupConfig {
  id: string; // unique group ID
  name: string;
  description?: string;
  avatarIcon?: string; // emoji icon e.g. 👥, ⚡, 🚀, 💰
  inviteCode?: string; // unique invite code e.g. SQD-9K2M4P
  ownerUid: string;
  admins: string[];
  members: string[]; // member UIDs allowed in squad
  whoCanAdd: 'owner_only' | 'admins' | 'all_members';
  whoCanRemove: 'owner_only' | 'admins';
  whoCanPost: 'all_members' | 'admins_only';
  whoCanEditInfo: 'admins' | 'all_members';
  whoCanShareCards: 'all_members' | 'admins';
  createdAt: string;
  updatedAt: string;
  lastMessageText?: string;
  lastMessageAt?: string;
}

export interface SquadInvitation {
  id: string;
  squadId: string;
  squadName: string;
  squadAvatar?: string;
  squadDescription?: string;
  invitedByUid: string;
  invitedByName: string;
  invitedByPhoto?: string;
  recipientUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface CommentItem {
  id: string;
  targetType: 'expense' | 'ledger';
  targetId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface ReactionItem {
  id: string;
  targetType: 'expense' | 'message' | 'ledger';
  targetId: string;
  emoji: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  link?: string;
  targetType?: 'chat' | 'expense' | 'dm' | 'history' | 'friend';
  targetId?: string;
  processed?: boolean;
  processedAt?: string;
  createdAt: string;
  date?: string;
}

export interface QueuedEmail {
  id: string;
  to: string;
  friendName?: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  error?: string;
  createdAt: string;
  sentAt?: string;
}

export interface ShareLinkSnapshotEntry {
  date: string;
  label: string;
  amount: number;
  type: 'owes' | 'adjustment' | 'payment';
}

export interface ShareLinkDoc {
  id: string; // 43 random characters from crypto.getRandomValues (base64url)
  friendId: string;
  createdAt: string;
  revoked: boolean;
  updatedAt: string;
  snapshot: {
    displayName: string;
    ownerName?: string;
    entries: ShareLinkSnapshotEntry[];
    runningBalance: number;
    paymentMethods?: PaymentMethodDetail[];
  };
}

export interface PublicProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  paymentMethods?: PaymentMethodDetail[];
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  fromPhotoURL?: string;
  toUid: string;
  toUsername?: string;
  toDisplayName?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  ledgerFriendId?: string; // option to link to existing ledger friend
}

export interface Friendship {
  id: string; // sortedUidPair: [uidA, uidB].sort().join('_')
  members: [string, string];
  requestId: string;
  createdAt: string;
  mutedBy?: string[];
}

export interface DmMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  mediaType?: 'text' | 'image' | 'audio' | 'nudge';
  imageUrl?: string;
  audioUrl?: string; // base64 Data URL or audio link
  audioDuration?: number; // duration in seconds
  createdAt: string;
  seen: boolean;
  seenAt?: string;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  sharedCard?: {
    type: 'expense' | 'balance';
    title: string;
    amount: number;
  };
  reactions?: { [emoji: string]: string[] };
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  deletedAt?: string;
  updatedAt?: string;
}

export interface DmThread {
  id: string; // sortedUidPair
  members: [string, string];
  otherUser?: PublicProfile;
  lastMessageText?: string;
  lastMessageAt?: string;
  lastMessageBy?: string;
  unreadCount?: { [uid: string]: number };
  typing?: { [uid: string]: boolean };
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: 'expense' | 'ledger' | 'month' | 'payment';
  entityId: string;
  performedBy: string;
  performedByName: string;
  details: string;
  createdAt: string;
}
