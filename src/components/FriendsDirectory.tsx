import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  searchUsersByEmailOrUsername,
  sendEmailInviteWithLink,
  UserSearchResult,
} from '../lib/friendsService';
import { SHARED_APP_URL, getInviteDeepLink } from '../lib/constants';
import {
  Search,
  UserPlus,
  Check,
  X,
  MessageCircle,
  Bell,
  Share2,
  ArrowLeft,
  DollarSign,
  Copy,
  ExternalLink,
  RefreshCw,
  Slash,
  Clock,
  Plus,
  User,
  Phone,
  Mail,
  Send,
  Users,
  UserMinus,
  Trash2,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { UserProfile } from '../types';
import { formatPKR, formatShortDate, getEntriesForFriend } from '../lib/formatters';
import { Card, Avatar, Button, Input, Chip, ListRow, Badge, Sheet, Segmented } from '../ui';

export const FriendsDirectory: React.FC<{
  onOpenChatWithUser?: (userId: string) => void;
  initialSelectedFriendId?: string | null;
}> = ({ onOpenChatWithUser, initialSelectedFriendId }) => {
  const {
    currentUser,
    publicProfile,
    friends,
    friendships,
    incomingRequests,
    outgoingRequests,
    sendRequestToUser,
    acceptIncomingRequest,
    declineIncomingRequest,
    cancelOutgoingRequest,
    removeFriend,
    unfriendUser,
    isOwnerMode,
    friendBalance,
    ledgerEntries,
    activeLedgerEntries,
    activeExpenses,
    addLedgerEntry,
    addCustomFriend,
    sendNudge,
    shareLinksMap,
    getFriendShareUrl,
    regenerateLink,
    revokeLink,
    paymentClaims,
    submitPaymentClaim,
    resolvePaymentClaim,
    reactions,
    toggleReaction,
    comments,
    showToast,
  } = useApp();

  // Add friend sheet state
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [addFriendTab, setAddFriendTab] = useState<'search' | 'invite'>('search');

  // Friend removal modal state
  const [friendToRemove, setFriendToRemove] = useState<UserProfile | null>(null);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);

  // Search by email or username
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isEmailSearch, setIsEmailSearch] = useState(false);
  const [searchedEmail, setSearchedEmail] = useState<string | null>(null);
  const [isSendingInviteMail, setIsSendingInviteMail] = useState(false);
  const [inviteMailSent, setInviteMailSent] = useState(false);

  // Currently viewed friend detail screen
  const [viewedFriendId, setViewedFriendId] = useState<string | null>(
    initialSelectedFriendId || null
  );

  // Settlement modal for friend
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimAmount, setClaimAmount] = useState('');
  const [claimNote, setClaimNote] = useState('');

  const handleSearch = async (queryStr: string) => {
    setSearchQuery(queryStr);
    setInviteMailSent(false);
    const clean = queryStr.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      setIsEmailSearch(false);
      setSearchedEmail(null);
      return;
    }

    setIsSearching(true);
    try {
      const resp = await searchUsersByEmailOrUsername(clean, currentUser.uid);
      setSearchResults(resp.users);
      setIsEmailSearch(resp.isEmailQuery);
      setSearchedEmail(resp.searchedEmail || (clean.includes('@') ? clean.toLowerCase() : null));
    } catch (e) {
      console.warn('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (user: UserSearchResult) => {
    await sendRequestToUser(user.uid, user.username || user.displayName, user.displayName);
    setSearchQuery('');
    setSearchResults([]);
    showToast({
      type: 'success',
      message: `Friend request sent to ${user.username ? `@${user.username}` : user.displayName}!`,
    });
  };

  const handleSendEmailInvite = async (targetEmail: string) => {
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setIsSendingInviteMail(true);
    try {
      const res = await sendEmailInviteWithLink({
        toEmail: targetEmail,
        senderName: currentUser.displayName,
        senderUsername: publicProfile?.username,
        senderUid: currentUser.uid,
      });

      if (res.success) {
        setInviteMailSent(true);
        showToast({
          type: 'success',
          message: `Invite with Hisaab link emailed to ${targetEmail}!`,
        });
      } else {
        showToast({
          type: 'error',
          message: res.error || 'Failed to send invite email.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        message: err.message || 'Error sending invite email.',
      });
    } finally {
      setIsSendingInviteMail(false);
    }
  };

  const viewedFriend = friends.find((f) => f.uid === viewedFriendId);
  const viewedBalance = viewedFriendId ? friendBalance(viewedFriendId) : 0;
  const viewedEntries = useMemo(() => {
    if (!viewedFriendId) return [];
    return getEntriesForFriend(activeLedgerEntries, viewedFriendId, currentUser.uid)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeLedgerEntries, viewedFriendId, currentUser.uid]);

  // Accurate Personal Spending Calculation for Friend (their actual share in split bills, NOT the total bill amounts!)
  const viewedFriendPersonalSpending = useMemo(() => {
    if (!viewedFriendId) return 0;
    return activeExpenses.reduce((sum, exp) => {
      if (exp.splits && exp.splits.length > 0) {
        const s = exp.splits.find((sp) => sp.userId === viewedFriendId);
        if (s) return sum + s.share;
      } else if (exp.paidBy === viewedFriendId) {
        return sum + exp.amount;
      }
      return sum;
    }, 0);
  }, [activeExpenses, viewedFriendId]);

  const viewedFriendSharedBillsCount = useMemo(() => {
    if (!viewedFriendId) return 0;
    return activeExpenses.filter((exp) =>
      exp.splits && exp.splits.some((sp) => sp.userId === viewedFriendId)
    ).length;
  }, [activeExpenses, viewedFriendId]);

  const viewedFriendTotalSettled = useMemo(() => {
    return viewedEntries
      .filter((e) => e.type === 'payment')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [viewedEntries]);

  const activeLink = viewedFriendId ? shareLinksMap[viewedFriendId] : null;

  const handleCopyShareLink = async () => {
    if (!viewedFriendId) return;
    let url = getFriendShareUrl(viewedFriendId);
    if (!url) {
      url = await regenerateLink(viewedFriendId);
    }
    navigator.clipboard.writeText(url);
    showToast({ type: 'success', message: 'Statement link copied (?s=<token>).' });
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = getInviteDeepLink(publicProfile?.username || currentUser.uid, currentUser.uid);
    navigator.clipboard.writeText(inviteUrl);
    showToast({ type: 'success', message: 'Invite link copied to clipboard!' });
  };

  const handleOpenGmailWeb = (targetEmail?: string) => {
    const to = targetEmail || '';
    const inviteUrl = getInviteDeepLink(publicProfile?.username || currentUser.uid, currentUser.uid);
    const subject = `Join ${currentUser.displayName} on Hisaab (Expense Tracker)`;
    const body = `Salam!\n\nI have invited you to connect on Hisaab to track shared expenses, split bills, and settle balances easily.\n\nAccept invitation and connect here:\n${inviteUrl}\n\nLooking forward to managing expenses together!`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    showToast({ type: 'success', message: 'Opening Gmail Compose...' });
  };

  const handleOpenMailto = (targetEmail?: string) => {
    const to = targetEmail || '';
    const inviteUrl = getInviteDeepLink(publicProfile?.username || currentUser.uid, currentUser.uid);
    const subject = `Join ${currentUser.displayName} on Hisaab (Expense Tracker)`;
    const body = `Salam!\n\nI have invited you to connect on Hisaab to track shared expenses, split bills, and settle balances easily.\n\nAccept invitation and connect here:\n${inviteUrl}\n\nLooking forward to managing expenses together!`;
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const a = document.createElement('a');
      a.href = mailto;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (_) {
      window.open(mailto, '_blank');
    }
    showToast({ type: 'success', message: 'Opening your mail app...' });
  };

  const handleFriendSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(claimAmount);
    if (isNaN(num) || num <= 0) return;

    await submitPaymentClaim(num, claimNote);
    setClaimAmount('');
    setClaimNote('');
    setShowClaimModal(false);
  };

  // If viewing single friend screen (Spec 5)
  if (viewedFriend) {
    const isOwed = viewedBalance > 0;
    const isSettled = viewedBalance === 0;

    return (
      <div className="space-y-6 pb-24 max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => setViewedFriendId(null)}
          className="flex items-center gap-2 text-xs font-bold text-[#667085] dark:text-[#98A2B3] hover:text-[#101828] dark:hover:text-[#F2F4F7] cursor-pointer active-press"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to friends</span>
        </button>

        {/* 5a. Friend Profile & Balance Header */}
        <Card padding="lg" className="text-center space-y-4">
          <Avatar
            name={viewedFriend.displayName}
            photoURL={viewedFriend.photoURL}
            size="xl"
            ring={isSettled ? 'none' : isOwed ? 'green' : 'red'}
            className="mx-auto shadow-md"
          />

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-[#101828] dark:text-[#F2F4F7]">
              {viewedFriend.displayName}
            </h2>
            <p className="text-xs text-[#667085] dark:text-[#98A2B3]">
              @{viewedFriend.displayName.toLowerCase().replace(/\s+/g, '_')}
            </p>
            {viewedFriend.phone && (
              <p className="text-xs text-[#667085] dark:text-[#98A2B3]">
                {viewedFriend.phone}
              </p>
            )}
          </div>

          {/* Big Balance */}
          <div className="pt-2">
            <span className="text-xs uppercase font-bold tracking-wider text-[#667085] dark:text-[#98A2B3] block">
              {isSettled ? 'Balance settled' : isOwed ? 'Owed to you' : 'You owe'}
            </span>
            <div
              className={`text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight pt-1 ${
                isSettled
                  ? 'text-[#667085] dark:text-[#98A2B3]'
                  : isOwed
                  ? 'text-[#12A150]'
                  : 'text-[#E5484D]'
              }`}
            >
              {formatPKR(Math.abs(viewedBalance))}
            </div>
          </div>

          {/* Friend's Personal Spending & Settlement Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-[#E4E7EC]/60 dark:border-[#232B3E]/60 text-left">
            <div className="p-3 rounded-2xl bg-[#F4F5FA] dark:bg-[#0B0F1A] border border-[#E4E7EC]/60 dark:border-[#232B3E]/60">
              <span className="text-[10px] uppercase font-bold text-[#667085] dark:text-[#98A2B3] flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-[#4F46E5]" /> {viewedFriend.displayName.split(' ')[0]}'s Spent
              </span>
              <span className="text-base sm:text-lg font-black text-[#101828] dark:text-[#F2F4F7] tabular-nums block pt-0.5">
                {formatPKR(viewedFriendPersonalSpending)}
              </span>
              <span className="text-[10px] text-[#667085] dark:text-[#98A2B3] block pt-0.5 leading-tight">
                Their share in {viewedFriendSharedBillsCount} split bill{viewedFriendSharedBillsCount === 1 ? '' : 's'} (not total bill)
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#F4F5FA] dark:bg-[#0B0F1A] border border-[#E4E7EC]/60 dark:border-[#232B3E]/60">
              <span className="text-[10px] uppercase font-bold text-[#667085] dark:text-[#98A2B3] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#12A150]" /> Settled
              </span>
              <span className="text-base sm:text-lg font-black text-[#12A150] tabular-nums block pt-0.5">
                {formatPKR(viewedFriendTotalSettled)}
              </span>
              <span className="text-[10px] text-[#667085] dark:text-[#98A2B3] block pt-0.5 leading-tight">
                Total payments recorded
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#F4F5FA] dark:bg-[#0B0F1A] border border-[#E4E7EC]/60 dark:border-[#232B3E]/60 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-[#667085] dark:text-[#98A2B3] flex items-center gap-1">
                <Wallet className="w-3 h-3 text-amber-500" /> Current Net
              </span>
              <span className={`text-base sm:text-lg font-black tabular-nums block pt-0.5 ${isSettled ? 'text-[#667085]' : isOwed ? 'text-[#12A150]' : 'text-[#E5484D]'}`}>
                {isSettled ? 'Settled' : formatPKR(Math.abs(viewedBalance))}
              </span>
              <span className="text-[10px] text-[#667085] dark:text-[#98A2B3] block pt-0.5 leading-tight">
                {isSettled ? 'Zero debt' : isOwed ? 'Owed to you' : 'You owe friend'}
              </span>
            </div>
          </div>

          {/* 5b. Actions: Nudge / Share statement / Message */}
          <div className="pt-4 flex items-center justify-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="md"
              onClick={() => sendNudge(viewedFriend.uid)}
              icon={<Bell className="w-4 h-4 text-amber-500" />}
            >
              Nudge
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={handleCopyShareLink}
              icon={<Share2 className="w-4 h-4 text-[#4F46E5]" />}
            >
              Share statement
            </Button>

            {onOpenChatWithUser && (
              <Button
                variant="primary"
                size="md"
                onClick={() => onOpenChatWithUser(viewedFriend.uid)}
                icon={<MessageCircle className="w-4 h-4" />}
              >
                Message
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              onClick={() => setFriendToRemove(viewedFriend)}
              icon={<UserMinus className="w-4 h-4 text-[#E5484D]" />}
              className="border-[#E5484D]/30 hover:bg-[#E5484D]/10 text-[#E5484D]"
            >
              Remove friend
            </Button>
          </div>

          {/* Share link management */}
          {activeLink && (
            <div className="pt-3 border-t border-[#E4E7EC]/60 dark:border-[#232B3E]/60 text-xs flex items-center justify-between text-[#667085] dark:text-[#98A2B3]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Link updated {formatShortDate(activeLink.updatedAt || activeLink.createdAt)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const newUrl = await regenerateLink(viewedFriend.uid);
                    navigator.clipboard.writeText(newUrl);
                    showToast({ type: 'success', message: 'New link created and copied!' });
                  }}
                  className="font-bold text-[#4F46E5] dark:text-[#8B85FF] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Regenerate</span>
                </button>
                <span>•</span>
                <button
                  onClick={async () => {
                    await revokeLink(viewedFriend.uid);
                  }}
                  className="font-bold text-[#E5484D] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Slash className="w-3 h-3" />
                  <span>Revoke</span>
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* 5c. Timeline of ledger entries */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085] dark:text-[#98A2B3] px-1">
            Statement entries ({viewedEntries.length})
          </h3>

          <Card padding="none" className="divide-y divide-[#E4E7EC]/60 dark:divide-[#232B3E]/60">
            {viewedEntries.length === 0 ? (
              <p className="py-12 text-center text-xs text-[#667085] dark:text-[#98A2B3]">
                No ledger entries with {viewedFriend.displayName} yet.
              </p>
            ) : (
              viewedEntries.map((entry) => {
                const isPaid = entry.type === 'payment';
                const isOwedEntry = entry.type === 'owes';

                return (
                  <div key={entry.id} className="p-4 sm:p-5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#101828] dark:text-[#F2F4F7]">
                          {entry.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPaid
                              ? 'bg-[#12A150]/10 text-[#12A150]'
                              : 'bg-[#E5484D]/10 text-[#E5484D]'
                          }`}
                        >
                          {isPaid ? 'Payment' : 'Owes'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#667085] dark:text-[#98A2B3] pt-0.5">
                        {formatShortDate(entry.date)} {entry.note ? `• ${entry.note}` : ''}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-extrabold tabular-nums ${
                          isPaid ? 'text-[#12A150]' : 'text-[#E5484D]'
                        }`}
                      >
                        {isPaid ? `-${formatPKR(entry.amount)}` : `+${formatPKR(entry.amount)}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </div>

        {/* Settlement Claim Bottom Sheet */}
        <Sheet
          isOpen={showClaimModal}
          onClose={() => setShowClaimModal(false)}
          title="Submit payment settlement"
        >
          <form onSubmit={handleFriendSubmitClaim} className="space-y-4">
            <Input
              label="Amount paid (Rs)"
              type="number"
              placeholder="e.g. 1500"
              required
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
            />
            <Input
              label="Note (e.g. Cash handed, Sadapay transfer)"
              value={claimNote}
              onChange={(e) => setClaimNote(e.target.value)}
            />
            <Button type="submit" fullWidth size="lg">
              Submit payment confirmation
            </Button>
          </form>
        </Sheet>
      </div>
    );
  }

  // 4. Friends Directory Overview (Spec 4)
  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto">
      {/* Header with Title and Add Friend Button */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-extrabold text-[#101828] dark:text-[#F2F4F7]">
            Friends
          </h2>
          <p className="text-xs text-[#667085] dark:text-[#98A2B3]">
            Track shared expenses, balances, and chat
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setShowAddFriendModal(true)}
          icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
        >
          Add friend
        </Button>
      </div>

      {/* 4a. Top: Incoming requests as cards with Accept & Decline */}
      {incomingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#F5A524] flex items-center gap-1.5 px-1">
            <span>Incoming Friend Requests</span>
            <Badge variant="warning">{incomingRequests.length}</Badge>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {incomingRequests.map((req) => (
              <Card key={req.id} padding="md" className="space-y-3 border-l-4 border-l-[#F5A524]">
                <div className="flex items-center gap-3">
                  <Avatar name={req.fromDisplayName} photoURL={req.fromPhotoURL} size="md" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold truncate text-[#101828] dark:text-[#F2F4F7]">
                      {req.fromDisplayName}
                    </h4>
                    <p className="text-xs text-[#667085] dark:text-[#98A2B3] truncate">
                      @{req.fromUsername}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => acceptIncomingRequest(req)}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => declineIncomingRequest(req.id)}
                  >
                    Decline
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 4b. Friends List (avatar, name, @username, balance chip, small message button) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085] dark:text-[#98A2B3]">
            My friends ({friends.length})
          </h3>
        </div>

        <Card padding="none" className="divide-y divide-[#E4E7EC]/60 dark:divide-[#232B3E]/60">
          {friends.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <div className="w-14 h-14 rounded-3xl bg-[#4F46E5]/10 text-[#4F46E5] dark:text-[#8B85FF] flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-[#101828] dark:text-[#F2F4F7]">
                  No friends added yet
                </h4>
                <p className="text-xs text-[#667085] dark:text-[#98A2B3] max-w-sm mx-auto">
                  Add friends to split bills, track who owes what, and chat directly.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setShowAddFriendModal(true)}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Add your first friend
                </Button>
              </div>
            </div>
          ) : (
            friends.map((friend) => {
              const bal = friendBalance(friend.uid);
              const isOwed = bal > 0;
              const isSettled = bal === 0;

              return (
                <div
                  key={friend.uid}
                  onClick={() => setViewedFriendId(friend.uid)}
                  className="flex items-center justify-between p-4 sm:p-5 hover:bg-[#F4F5FA] dark:hover:bg-[#151B2B]/60 cursor-pointer active-press transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <Avatar
                      name={friend.displayName}
                      photoURL={friend.photoURL}
                      size="md"
                      ring={isSettled ? 'none' : isOwed ? 'green' : 'red'}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-[#101828] dark:text-[#F2F4F7] truncate">
                        {friend.displayName}
                      </h4>
                      <p className="text-xs text-[#667085] dark:text-[#98A2B3] truncate">
                        @{friend.displayName.toLowerCase().replace(/\s+/g, '_')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Balance Chip */}
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full tabular-nums ${
                        isOwed
                          ? 'bg-[#12A150]/10 text-[#12A150]'
                          : isSettled
                          ? 'bg-[#E4E7EC]/60 dark:bg-[#232B3E] text-[#667085] dark:text-[#98A2B3]'
                          : 'bg-[#E5484D]/10 text-[#E5484D]'
                      }`}
                    >
                      {isSettled
                        ? 'Settled'
                        : isOwed
                        ? `Owes ${formatPKR(bal)}`
                        : `You owe ${formatPKR(Math.abs(bal))}`}
                    </span>

                    {/* Small Message & Remove Actions */}
                    <div className="flex items-center gap-1.5">
                      {onOpenChatWithUser && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenChatWithUser(friend.uid);
                          }}
                          className="w-9 h-9 rounded-full bg-white dark:bg-[#151B2B] border border-[#E4E7EC] dark:border-[#232B3E] flex items-center justify-center text-[#667085] dark:text-[#98A2B3] hover:text-[#4F46E5] active-press cursor-pointer shadow-xs"
                          title="Chat"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFriendToRemove(friend);
                        }}
                        className="w-9 h-9 rounded-full bg-white dark:bg-[#151B2B] border border-[#E4E7EC] dark:border-[#232B3E] flex items-center justify-center text-[#667085] dark:text-[#98A2B3] hover:text-[#E5484D] hover:border-[#E5484D]/30 active-press cursor-pointer shadow-xs transition-colors"
                        title="Remove friend"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* ADD FRIEND BOTTOM SHEET */}
      <Sheet
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        title="Add a friend"
      >
        <div className="space-y-4">
          {/* Segmented Switcher: 2 Tabs (Search, Invite link) */}
          <div className="flex bg-[#F4F5FA] dark:bg-[#0B0F1A] p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setAddFriendTab('search')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                addFriendTab === 'search'
                  ? 'bg-white dark:bg-[#151B2B] text-[#4F46E5] dark:text-white shadow-xs'
                  : 'text-[#667085] dark:text-[#98A2B3]'
              }`}
            >
              Search user
            </button>
            <button
              type="button"
              onClick={() => setAddFriendTab('invite')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                addFriendTab === 'invite'
                  ? 'bg-white dark:bg-[#151B2B] text-[#4F46E5] dark:text-white shadow-xs'
                  : 'text-[#667085] dark:text-[#98A2B3]'
              }`}
            >
              Invite link & share
            </button>
          </div>

          {/* TAB 1: Search by Email or Username */}
          {addFriendTab === 'search' && (
            <div className="space-y-3.5">
              <Input
                placeholder="Search by email (e.g. friend@gmail.com) or @username..."
                leftIcon={<Search className="w-4 h-4" />}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />

              {isSearching && (
                <p className="text-xs text-center py-4 text-[#667085]">Searching users...</p>
              )}

              {/* Found Users List */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                  <p className="text-[11px] font-semibold text-[#667085] dark:text-[#98A2B3] px-1">
                    Matching users found:
                  </p>
                  {searchResults.map((user) => (
                    <div
                      key={user.uid}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#F4F5FA] dark:bg-[#0B0F1A] border border-[#E4E7EC]/60 dark:border-[#232B3E]/60 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar name={user.displayName} photoURL={user.photoURL} size="md" />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-[#101828] dark:text-[#F2F4F7] truncate">
                            {user.displayName}
                          </h4>
                          <p className="text-xs text-[#667085] dark:text-[#98A2B3] truncate">
                            {user.username ? `@${user.username}` : user.email || 'User'}
                          </p>
                          {user.email && user.username && (
                            <p className="text-[10px] text-[#667085] dark:text-[#98A2B3]/70 truncate">
                              {user.email}
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSendRequest(user)}
                        icon={<UserPlus className="w-4 h-4" />}
                        className="shrink-0"
                      >
                        Add friend
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* If searched email or query not found as registered user */}
              {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
                <div className="p-4 rounded-2xl bg-[#F4F5FA] dark:bg-[#0B0F1A] border border-[#E4E7EC] dark:border-[#232B3E] space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#101828] dark:text-[#F2F4F7]">
                      No registered user found for &quot;{searchQuery}&quot;
                    </p>
                    <p className="text-[11px] text-[#667085] dark:text-[#98A2B3]">
                      {isEmailSearch || searchQuery.includes('@')
                        ? 'This person has not joined Hisaab yet. Send them an invite link right now!'
                        : 'If you know their email address or want to invite them via WhatsApp, tap below.'}
                    </p>
                  </div>

                  {/* Mail & WhatsApp invite actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="md"
                      isLoading={isSendingInviteMail}
                      onClick={() =>
                        handleSendEmailInvite(searchedEmail || searchQuery.trim())
                      }
                      icon={<Mail className="w-4 h-4" />}
                    >
                      Email invite
                    </Button>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => {
                        const inviteLink = getInviteDeepLink(publicProfile?.username || currentUser.uid, currentUser.uid);
                        const text = `Salam! Connect with me on Hisaab to track shared expenses and balances: ${inviteLink}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      icon={<MessageCircle className="w-4 h-4 text-emerald-500" />}
                    >
                      WhatsApp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Invite via link & instant sharing */}
          {addFriendTab === 'invite' && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-[#F4F5FA] dark:bg-[#0B0F1A] border border-[#E4E7EC] dark:border-[#232B3E] space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#4F46E5]/10 text-[#4F46E5] dark:text-[#8B85FF] flex items-center justify-center shrink-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#101828] dark:text-[#F2F4F7]">
                      Direct Shareable Link
                    </h4>
                    <p className="text-[11px] text-[#667085] dark:text-[#98A2B3]">
                      Friends who open this link connect directly with your profile.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-[#151B2B] border border-[#E4E7EC] dark:border-[#232B3E] text-xs font-mono break-all select-all text-[#101828] dark:text-[#F2F4F7]">
                  {getInviteDeepLink(publicProfile?.username || currentUser.uid, currentUser.uid)}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCopyInviteLink}
                    icon={<Copy className="w-3.5 h-3.5" />}
                    fullWidth
                  >
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const inviteLink = getInviteDeepLink(publicProfile?.username || currentUser.uid, currentUser.uid);
                      const text = `Salam! Connect with me on Hisaab to track shared expenses and balances: ${inviteLink}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    icon={<MessageCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    fullWidth
                  >
                    WhatsApp
                  </Button>
                </div>
              </div>

              {/* Direct email invite in FriendsDirectory */}
              <div className="p-4 rounded-2xl bg-[#F4F5FA] dark:bg-[#0B0F1A] border border-[#E4E7EC] dark:border-[#232B3E] space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#12A150]/10 text-[#12A150] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#101828] dark:text-[#F2F4F7]">
                      Send Email Invitation
                    </h4>
                    <p className="text-[11px] text-[#667085] dark:text-[#98A2B3]">
                      We will email your invite link so your friend joins and connects immediately.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="friend@gmail.com"
                    value={searchedEmail || ''}
                    onChange={(e) => {
                      setSearchedEmail(e.target.value);
                      setInviteMailSent(false);
                    }}
                    leftIcon={<Mail className="w-4 h-4" />}
                  />

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      isLoading={isSendingInviteMail}
                      onClick={() => handleSendEmailInvite(searchedEmail || '')}
                      icon={<Mail className="w-3.5 h-3.5" />}
                    >
                      Send Email Invite
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      onClick={() => handleOpenGmailWeb(searchedEmail || '')}
                      icon={<ExternalLink className="w-3.5 h-3.5" />}
                    >
                      Open in Gmail Web
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#667085] dark:text-[#98A2B3] px-1 pt-0.5">
                    <span>Using another client?</span>
                    <button
                      type="button"
                      onClick={() => handleOpenMailto(searchedEmail || '')}
                      className="text-[#4F46E5] dark:text-[#8B85FF] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Open Mail App</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  {inviteMailSent && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                      <p className="text-xs font-bold text-[#12A150]">
                        ✓ Invitation ready for {searchedEmail}!
                      </p>
                      <p className="text-[11px] text-[#667085] dark:text-[#98A2B3]">
                        When your friend opens the link or signs up, they connect with your account automatically.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Sheet>

      {/* CONFIRM REMOVE FRIEND SHEET */}
      <Sheet
        isOpen={!!friendToRemove}
        onClose={() => setFriendToRemove(null)}
        title="Remove Friend"
      >
        {friendToRemove && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-900/50">
              <Avatar
                name={friendToRemove.displayName}
                photoURL={friendToRemove.photoURL}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-[#101828] dark:text-[#F2F4F7] truncate">
                  {friendToRemove.displayName}
                </h4>
                <p className="text-xs text-[#667085] dark:text-[#98A2B3] truncate">
                  @{friendToRemove.displayName.toLowerCase().replace(/\s+/g, '_')}
                </p>
              </div>
            </div>

            <div className="space-y-1 text-xs text-[#667085] dark:text-[#98A2B3]">
              <p className="font-semibold text-[#101828] dark:text-[#F2F4F7]">
                Remove this friend from your list?
              </p>
              <p>
                They will be removed from your friends list and 1:1 chat connection. Any existing expenses and history in the ledger will stay safely intact.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={() => setFriendToRemove(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                fullWidth
                isLoading={isRemovingFriend}
                onClick={async () => {
                  if (!friendToRemove) return;
                  setIsRemovingFriend(true);
                  try {
                    await removeFriend(friendToRemove.uid);
                    if (viewedFriendId === friendToRemove.uid) {
                      setViewedFriendId(null);
                    }
                    setFriendToRemove(null);
                  } finally {
                    setIsRemovingFriend(false);
                  }
                }}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Confirm Remove
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
};
