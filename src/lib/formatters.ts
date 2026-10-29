import { LedgerEntry, Expense, UserProfile } from '../types';

export interface SimplifiedDebtPayment {
  id: string;
  fromUid: string;
  fromName: string;
  fromPhoto?: string;
  toUid: string;
  toName: string;
  toPhoto?: string;
  amount: number;
}

export interface GroupMemberNetBalance {
  uid: string;
  name: string;
  photoURL?: string;
  net: number; // positive = owed money, negative = owes money
}

/**
 * Computes simplified minimum payments needed to clear everyone in a group.
 */
export function simplifyGroupDebts(params: {
  memberIds: string[];
  currentUser: UserProfile;
  allUsers: UserProfile[];
  activeExpenses: Expense[];
  activeLedgerEntries: LedgerEntry[];
}): {
  payments: SimplifiedDebtPayment[];
  memberBalances: GroupMemberNetBalance[];
  rawPairCount: number;
} {
  const { memberIds, currentUser, allUsers, activeExpenses, activeLedgerEntries } = params;
  const memberSet = new Set<string>(memberIds);
  memberSet.add(currentUser.uid);

  const getUserInfo = (uid: string): { name: string; photoURL?: string } => {
    if (uid === currentUser.uid || uid === 'me') {
      return { name: currentUser.displayName || 'You', photoURL: currentUser.photoURL };
    }
    const found = allUsers.find((u) => u.uid === uid);
    return {
      name: found?.displayName || 'Member',
      photoURL: found?.photoURL,
    };
  };

  const netMap: Record<string, number> = {};
  memberSet.forEach((uid) => {
    netMap[uid] = 0;
  });

  const activeExpenseIds = new Set<string>();

  // 1. Account for all active split expenses among group members
  activeExpenses.forEach((exp) => {
    if (exp.deleted) return;
    activeExpenseIds.add(exp.id);
    if (!exp.splits || exp.splits.length === 0) return;

    const payerUid =
      exp.paidBy === 'me' ? exp.createdBy || currentUser.uid : exp.paidBy;
    if (!memberSet.has(payerUid)) return;

    exp.splits.forEach((s) => {
      const participantUid = s.userId === 'me' ? currentUser.uid : s.userId;
      if (
        participantUid !== payerUid &&
        memberSet.has(participantUid) &&
        s.share > 0
      ) {
        netMap[payerUid] = (netMap[payerUid] || 0) + s.share;
        netMap[participantUid] = (netMap[participantUid] || 0) - s.share;
      }
    });
  });

  // 2. Account for manual ledger entries & settlements not already represented by an active expense
  activeLedgerEntries.forEach((entry) => {
    if (entry.deleted) return;
    if (entry.refExpenseId && activeExpenseIds.has(entry.refExpenseId)) {
      return;
    }

    // Check if entry is a direct peer-to-peer payment/record between two non-currentUser squad members
    if (
      entry.payerId &&
      entry.recipientId &&
      entry.payerId !== currentUser.uid &&
      entry.recipientId !== currentUser.uid &&
      memberSet.has(entry.payerId) &&
      memberSet.has(entry.recipientId)
    ) {
      const amt = Math.abs(entry.amount);
      if (entry.type === 'payment') {
        // payerId paid recipientId to settle debt
        netMap[entry.payerId] = (netMap[entry.payerId] || 0) + amt;
        netMap[entry.recipientId] = (netMap[entry.recipientId] || 0) - amt;
      } else if (entry.type === 'owes') {
        netMap[entry.payerId] = (netMap[entry.payerId] || 0) + amt;
        netMap[entry.recipientId] = (netMap[entry.recipientId] || 0) - amt;
      }
      return;
    }

    // Otherwise evaluate relative to currentUser.uid for each member in memberSet
    const otherUid =
      entry.friendId === currentUser.uid ? entry.createdBy : entry.friendId;
    if (!otherUid || otherUid === currentUser.uid || !memberSet.has(otherUid)) {
      return;
    }

    const delta = calculateFriendBalance(otherUid, [entry], currentUser.uid);
    if (delta !== 0) {
      // delta > 0 means otherUid owes currentUser; delta < 0 means currentUser owes otherUid
      netMap[currentUser.uid] = (netMap[currentUser.uid] || 0) + delta;
      netMap[otherUid] = (netMap[otherUid] || 0) - delta;
    }
  });

  const memberBalances: GroupMemberNetBalance[] = Array.from(memberSet).map((uid) => {
    const info = getUserInfo(uid);
    return {
      uid,
      name: info.name,
      photoURL: info.photoURL,
      net: Math.round(netMap[uid] || 0),
    };
  });

  const debtors = memberBalances
    .filter((m) => m.net < -1)
    .map((m) => ({ ...m, remaining: Math.abs(m.net) }))
    .sort((a, b) => b.remaining - a.remaining);

  const creditors = memberBalances
    .filter((m) => m.net > 1)
    .map((m) => ({ ...m, remaining: m.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const rawPairCount = debtors.length * creditors.length;
  const payments: SimplifiedDebtPayment[] = [];

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settleAmt = Math.min(debtor.remaining, creditor.remaining);

    if (settleAmt >= 1) {
      payments.push({
        id: `${debtor.uid}->${creditor.uid}`,
        fromUid: debtor.uid,
        fromName: debtor.name,
        fromPhoto: debtor.photoURL,
        toUid: creditor.uid,
        toName: creditor.name,
        toPhoto: creditor.photoURL,
        amount: Math.round(settleAmt),
      });
    }

    debtor.remaining -= settleAmt;
    creditor.remaining -= settleAmt;

    if (debtor.remaining < 1) i++;
    if (creditor.remaining < 1) j++;
  }

  return {
    payments,
    memberBalances: memberBalances.sort((a, b) => b.net - a.net),
    rawPairCount,
  };
}


/**
 * Formats numbers into PKR style currency e.g. "Rs 1,250"
 */
export function formatPKR(amount: number): string {
  if (isNaN(amount)) return 'Rs 0';
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(absVal);

  if (isNegative) {
    return `-Rs ${formatted}`;
  }
  return `Rs ${formatted}`;
}

/**
 * Formats standard ISO or YYYY-MM-DD date into friendly Pakistani format e.g. "9 Oct"
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Accurately determines relative day heading ("Today", "Yesterday", or formatted date)
 * based on actual local calendar dates without hardcoded numbers.
 */
export function formatDateGroupHeading(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const todayStr = toDateInputFormat(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateInputFormat(yesterday);

  // Clean date string (handles YYYY-MM-DD or ISO string)
  const cleanDateStr = dateStr.slice(0, 10);

  if (cleanDateStr === todayStr) {
    return 'Today';
  }
  if (cleanDateStr === yesterdayStr) {
    return 'Yesterday';
  }

  const dateObj = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  if (isNaN(dateObj.getTime())) return dateStr;

  // Include year if different from current year
  const isCurrentYear = dateObj.getFullYear() === now.getFullYear();
  return dateObj.toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Formats full date e.g. "9 Oct 2026, 4:30 PM"
 */
export function formatFullDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Converts date to YYYY-MM-DD
 */
export function toDateInputFormat(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculate net balance between the current user and a specific friend from ledger entries:
 * If current user created the entry (or friendId is the target friend):
 *   - type: 'owes' => positive (friend owes current user)
 *   - type: 'payment' => negative (friend paid current user)
 *   - type: 'adjustment' => positive or negative as signed
 * If friend created the entry and current user is friendId:
 *   - type: 'owes' => negative (current user owes friend)
 *   - type: 'payment' => positive (current user paid friend)
 *   - type: 'adjustment' => inverted signed
 */
export function calculateFriendBalance(
  friendId: string,
  entries: LedgerEntry[],
  currentUserId?: string
): number {
  return entries.reduce((sum, entry) => {
    // Ignore deleted entries (e.g. from deleted split bills)
    if (entry.deleted) {
      return sum;
    }

    // Check if this entry involves both current user and friendId
    const isDirect = entry.friendId === friendId;
    const isReverse =
      Boolean(currentUserId &&
      entry.friendId === currentUserId &&
      entry.createdBy === friendId);

    if (!isDirect && !isReverse) {
      return sum;
    }

    if (isReverse) {
      if (entry.type === 'owes') {
        const iOweFriend =
          entry.amount < 0 ||
          entry.recipientId === currentUserId ||
          (entry.payerId && entry.payerId === friendId);
        return iOweFriend ? sum - Math.abs(entry.amount) : sum + Math.abs(entry.amount);
      } else if (entry.type === 'payment') {
        // Did current user pay friend, or did friend pay current user?
        let isUserPayingFriend = false;
        if (entry.paymentDirection === 'paid_to_friend') {
          isUserPayingFriend = true;
        } else if (entry.paymentDirection === 'received_from_friend') {
          isUserPayingFriend = false;
        } else if (entry.payerId && currentUserId) {
          isUserPayingFriend = entry.payerId === currentUserId;
        } else if (entry.label) {
          if (/received|got from|from friend/i.test(entry.label)) {
            isUserPayingFriend = false;
          } else if (/paid to|pay to|paid friend/i.test(entry.label)) {
            isUserPayingFriend = true;
          }
        }
        return isUserPayingFriend ? sum + Math.abs(entry.amount) : sum - Math.abs(entry.amount);
      } else if (entry.type === 'adjustment') {
        return sum - entry.amount;
      }
      return sum;
    }

    // Direct entry (entry.friendId === friendId)
    if (entry.type === 'owes') {
      // If amount is negative, or recipient is current user, or payer is friend -> current user owes friend
      const iOweFriend =
        entry.amount < 0 ||
        (currentUserId && entry.recipientId === currentUserId && entry.payerId === friendId) ||
        (Boolean(entry.payerId) && entry.payerId === friendId && entry.payerId !== currentUserId);

      return iOweFriend ? sum - Math.abs(entry.amount) : sum + Math.abs(entry.amount);
    } else if (entry.type === 'payment') {
      // Determine direction of payment with strict precedence
      let isUserPayingFriend = false;
      if (entry.paymentDirection === 'paid_to_friend') {
        isUserPayingFriend = true;
      } else if (entry.paymentDirection === 'received_from_friend') {
        isUserPayingFriend = false;
      } else if (entry.payerId) {
        isUserPayingFriend = Boolean(currentUserId && entry.payerId === currentUserId);
      } else if (entry.label) {
        if (/received|got from|from friend|collected/i.test(entry.label)) {
          isUserPayingFriend = false;
        } else if (/paid to|pay debt|paid friend/i.test(entry.label)) {
          isUserPayingFriend = true;
        } else {
          // Default for friend ledger payments: friend paid user to clear their debt
          isUserPayingFriend = false;
        }
      } else {
        isUserPayingFriend = false;
      }

      if (isUserPayingFriend) {
        // Current user paid friend: recovers negative balance towards zero / advances credit
        return sum + Math.abs(entry.amount);
      } else {
        // Friend paid current user: friend owes less, balance reduces towards zero
        return sum - Math.abs(entry.amount);
      }
    } else if (entry.type === 'adjustment') {
      return sum + entry.amount;
    }
    return sum;
  }, 0);
}

/**
 * Retrieves all ledger entries between the current user and a target friend
 */
export function getEntriesForFriend(
  entries: LedgerEntry[],
  friendId: string,
  currentUserId?: string
): LedgerEntry[] {
  return entries.filter((e) => {
    if (e.deleted) return false;
    if (e.friendId === friendId) {
      if (!currentUserId || !e.createdBy || e.createdBy === currentUserId) return true;
      return true;
    }
    if (currentUserId && e.friendId === currentUserId && e.createdBy === friendId) {
      return true;
    }
    return false;
  });
}

/**
 * Formats a month key (e.g. "2026-10" or "2026-03") or raw numeric month into a full month name (e.g. "October 2026")
 */
export function formatMonthDisplay(monthKeyOrName: string): string {
  if (!monthKeyOrName) return '';

  // If already in full name format like "October 2026" or "March 2026"
  if (/^[A-Za-z]+ \d{4}$/.test(monthKeyOrName.trim())) {
    return monthKeyOrName.trim();
  }

  // Handle YYYY-MM (e.g. "2026-10" or "2026-3" or "2026-03")
  const yyyyMmMatch = monthKeyOrName.match(/^(\d{4})-(\d{1,2})$/);
  if (yyyyMmMatch) {
    const year = parseInt(yyyyMmMatch[1], 10);
    const month = parseInt(yyyyMmMatch[2], 10) - 1; // 0-based month index
    const d = new Date(year, month, 1, 12, 0, 0);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }

  // Handle MM/YYYY or MM-YYYY
  const mmYyyyMatch = monthKeyOrName.match(/^(\d{1,2})[/-](\d{4})$/);
  if (mmYyyyMatch) {
    const month = parseInt(mmYyyyMatch[1], 10) - 1;
    const year = parseInt(mmYyyyMatch[2], 10);
    const d = new Date(year, month, 1, 12, 0, 0);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }

  // Fallback
  return monthKeyOrName;
}
