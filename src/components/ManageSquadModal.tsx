import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SHARED_APP_URL } from '../lib/constants';
import {
  Users,
  Shield,
  ShieldCheck,
  Crown,
  UserPlus,
  UserX,
  Settings,
  Lock,
  Check,
  Copy,
  AlertTriangle,
  X,
  MessageSquare,
  DollarSign,
  Sparkles,
  ChevronRight,
  Search,
  KeyRound,
  Send,
  Trash2,
  LogOut,
  ArrowRight,
} from 'lucide-react';
import { Sheet, Avatar, Button, Input, Badge } from '../ui';
import { SquadGroupConfig } from '../types';
import { formatPKR, simplifyGroupDebts, SimplifiedDebtPayment } from '../lib/formatters';

interface ManageSquadModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSquad?: SquadGroupConfig | null;
}

const SQUAD_EMOJIS = ['👥', '⚡', '🚀', '💰', '🛡️', '🎯', '🔥', '🏆', '💎', '💼', '🤝', '🌟', '🍕', '🏕️', '✈️', '🎮'];

export const ManageSquadModal: React.FC<ManageSquadModalProps> = ({
  isOpen,
  onClose,
  targetSquad,
}) => {
  const {
    squadGroup,
    updateSquadConfig,
    addSquadMember,
    removeSquadMember,
    toggleSquadAdmin,
    transferSquadOwnership,
    leaveSquadGroup,
    deleteSquadGroup,
    sendSquadInvitation,
    currentUser,
    friends,
    allUsers,
    activeExpenses,
    activeLedgerEntries,
    addLedgerEntry,
    sendChatMessage,
    showToast,
  } = useApp();

  const squad = targetSquad || squadGroup;

  const [activeTab, setActiveTab] = useState<'settle' | 'members' | 'permissions' | 'settings'>('settle');
  const [settlingPaymentId, setSettlingPaymentId] = useState<string | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');

  // Editable group settings
  const [editingName, setEditingName] = useState(squad?.name || 'Squad Group');
  const [editingDescription, setEditingDescription] = useState(
    squad?.description || 'Shared expense and ledger discussion group'
  );
  const [selectedEmoji, setSelectedEmoji] = useState(squad?.avatarIcon || '👥');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    variant: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (squad) {
      setEditingName(squad.name || 'Squad Group');
      setEditingDescription(squad.description || '');
      setSelectedEmoji(squad.avatarIcon || '👥');
    }
  }, [squad?.id, squad?.name, squad?.description, squad?.avatarIcon, isOpen]);

  if (!squad) return null;

  const isOwner = squad.ownerUid === currentUser.uid;
  const isAdmin = isOwner || (squad.admins || []).includes(currentUser.uid);
  const canEditGroupInfo = isOwner || squad.whoCanEditInfo !== 'admins' || isAdmin;
  const canAddMembers =
    isOwner ||
    (squad.whoCanAdd === 'admins' && isAdmin) ||
    squad.whoCanAdd === 'all_members';
  const canRemoveMembers =
    isOwner || (squad.whoCanRemove === 'admins' && isAdmin);

  // Filtered lists
  const currentMembersList = (squad.members || []).map((uid) => {
    const user = allUsers.find((u) => u.uid === uid) || {
      uid,
      displayName: uid === currentUser.uid ? currentUser.displayName : 'Member',
      photoURL: undefined,
      email: undefined,
    };
    const isMemberOwner = uid === squad.ownerUid;
    const isMemberAdmin = (squad.admins || []).includes(uid);
    return {
      uid,
      user,
      isOwner: isMemberOwner,
      isAdmin: isMemberAdmin,
      isMe: uid === currentUser.uid,
    };
  });

  const filteredMembers = currentMembersList.filter(
    (m) =>
      m.user.displayName.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      (m.user.email && m.user.email.toLowerCase().includes(memberSearchQuery.toLowerCase()))
  );

  const eligibleFriendsToAdd = friends.filter(
    (f) => !(squad.members || []).includes(f.uid)
  );

  const filteredFriendsToAdd = eligibleFriendsToAdd.filter(
    (f) =>
      f.displayName.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
      (f.email && f.email.toLowerCase().includes(friendSearchQuery.toLowerCase()))
  );

  const handleSaveGroupInfo = async () => {
    if (!editingName.trim()) {
      showToast({ type: 'error', message: 'Group name cannot be empty.' });
      return;
    }
    setIsSavingSettings(true);
    await updateSquadConfig(
      {
        name: editingName.trim(),
        description: editingDescription.trim(),
        avatarIcon: selectedEmoji,
      },
      squad.id
    );
    setIsSavingSettings(false);
  };

  const handleCopyInviteCode = () => {
    if (!squad.inviteCode) return;
    navigator.clipboard?.writeText(squad.inviteCode);
    showToast({ type: 'success', message: `Invite code ${squad.inviteCode} copied!` });
  };

  const handleCopyInviteLink = () => {
    const url = `${SHARED_APP_URL}/?joinCode=${squad.inviteCode || ''}`;
    navigator.clipboard?.writeText(url);
    showToast({ type: 'success', message: 'Squad invite link copied to clipboard!' });
  };

  // Compute simplified debts for this squad
  const squadMemberIds =
    squad.members && squad.members.length > 1
      ? squad.members
      : [currentUser.uid, ...friends.map((f) => f.uid)];

  const simplifiedDebts = simplifyGroupDebts({
    memberIds: squadMemberIds,
    currentUser,
    allUsers: [...allUsers, ...friends],
    activeExpenses,
    activeLedgerEntries,
  });

  const handleSettleSmartPayment = async (payment: SimplifiedDebtPayment) => {
    setSettlingPaymentId(payment.id);
    try {
      const isMePaying = payment.fromUid === currentUser.uid;
      const targetFriendId = isMePaying ? payment.toUid : payment.fromUid;
      const targetFriendName = isMePaying ? payment.toName : payment.fromName;

      await addLedgerEntry({
        friendId: targetFriendId,
        friendName: targetFriendName,
        date: new Date().toISOString().split('T')[0],
        label: `Smart Settle (${squad.name}): ${payment.fromName} paid ${payment.toName}`,
        amount: payment.amount,
        type: 'payment',
        paymentDirection: isMePaying ? 'paid_to_friend' : 'received_from_friend',
        payerId: payment.fromUid,
        payerName: payment.fromName,
        recipientId: payment.toUid,
        recipientName: payment.toName,
        note: `Simplified squad debt settlement in ${squad.name}`,
        createdBy: currentUser.uid,
      });

      await sendChatMessage(
        `✅ Settle Smartly: ${payment.fromName} paid ${payment.toName} ${formatPKR(payment.amount)}`,
        {
          type: 'balance',
          title: `${payment.fromName} → ${payment.toName}`,
          amount: payment.amount,
        },
        squad.id
      );

      showToast({
        type: 'success',
        message: `Settled: ${payment.fromName} pays ${payment.toName} ${formatPKR(payment.amount)}`,
      });
    } finally {
      setSettlingPaymentId(null);
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Squad & Settle Smartly">
      <div className="space-y-5 pb-6">
        {/* Squad Hero Banner */}
        <div className="p-4 rounded-3xl bg-linear-to-br from-[#EEF2FF] to-[#E0E7FF] dark:from-[#171E36] dark:to-[#0F1424] border border-[#C7D2FE] dark:border-[#2C3754] flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#1E2742] border border-[#CBD5E1] dark:border-[#334155] flex items-center justify-center text-3xl shadow-sm shrink-0">
              {squad.avatarIcon || selectedEmoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-[#101828] dark:text-[#F8FAFC] truncate">
                  {squad.name}
                </h3>
                {isOwner ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Owner
                  </span>
                ) : isAdmin ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#4F46E5]/15 text-[#4F46E5] dark:text-[#8B85FF] border border-[#4F46E5]/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Member
                  </span>
                )}
              </div>
              <p className="text-xs text-[#475467] dark:text-[#94A3B8] truncate mt-0.5">
                {squad.description || 'Ledger discussion & bill splitting'}
              </p>
              <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium mt-1 flex items-center gap-2">
                <span>{squad.members?.length || 1} members</span>
                <span>•</span>
                <span>{squad.admins?.length || 1} admins</span>
                {squad.inviteCode && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-[#4F46E5] dark:text-[#8B85FF]">
                      Code: {squad.inviteCode}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopyInviteCode}
              className="p-2 rounded-2xl bg-white dark:bg-[#1E2742] border border-[#CBD5E1] dark:border-[#334155] text-[#4F46E5] dark:text-[#8B85FF] hover:bg-[#EEF2FF] dark:hover:bg-[#253052] transition cursor-pointer shadow-xs active-press"
              title="Copy Invite Code"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyInviteLink}
              className="p-2 rounded-2xl bg-white dark:bg-[#1E2742] border border-[#CBD5E1] dark:border-[#334155] text-[#4F46E5] dark:text-[#8B85FF] hover:bg-[#EEF2FF] dark:hover:bg-[#253052] transition cursor-pointer shadow-xs active-press"
              title="Copy Invite Link"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="seg w-full grid grid-cols-4 !p-1">
          <button
            type="button"
            onClick={() => setActiveTab('settle')}
            className={`!text-xs ${activeTab === 'settle' ? 'on' : ''}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Settle smartly</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`!text-xs ${activeTab === 'members' ? 'on' : ''}`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({squad.members?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`!text-xs ${activeTab === 'permissions' ? 'on' : ''}`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Permissions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`!text-xs ${activeTab === 'settings' ? 'on' : ''}`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>

        {/* TAB 0: SETTLE SMARTLY (SIMPLIFY GROUP DEBTS) */}
        {activeTab === 'settle' && (
          <div className="space-y-4">
            <div className="card t-em !p-4 space-y-2 cq-card">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="chip g !h-6 !px-2.5 !text-xs">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Simplify Group Debts
                </span>
                <span className="chip !h-6 !px-2.5 !text-xs">
                  {simplifiedDebts.payments.length === 0
                    ? '0 payments needed'
                    : `${simplifiedDebts.payments.length} ${
                        simplifiedDebts.payments.length === 1 ? 'payment' : 'payments'
                      } to clear all`}
                </span>
              </div>
              <h4 className="text-base font-extrabold font-heading text-[var(--tx)]">
                {simplifiedDebts.payments.length === 0
                  ? 'Everyone in this squad is settled up!'
                  : `Fewest payments needed to clear everyone`}
              </h4>
              <p className="text-xs text-[var(--mu)]">
                Combines overlapping shared bills and khata balances into the minimum transfers.
              </p>
            </div>

            {simplifiedDebts.payments.length === 0 ? (
              <div className="card !p-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[var(--em)]/15 text-[var(--em)] flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-sm font-extrabold text-[var(--tx)]">
                  All balances are Rs 0
                </p>
                <p className="text-xs text-[var(--mu)]">
                  No pending payments between squad members right now.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {simplifiedDebts.payments.map((payment) => {
                  const isSettling = settlingPaymentId === payment.id;
                  return (
                    <div
                      key={payment.id}
                      className="min-h-[64px] p-3.5 rounded-[20px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3 cq-card"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex items-center -space-x-2 shrink-0">
                          <Avatar
                            name={payment.fromName}
                            photoURL={payment.fromPhoto}
                            size="sm"
                            ring="red"
                          />
                          <Avatar
                            name={payment.toName}
                            photoURL={payment.toPhoto}
                            size="sm"
                            ring="green"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-extrabold text-[var(--tx)] truncate">
                            <span>{payment.fromName}</span>{' '}
                            <span className="text-[var(--mu)] font-semibold">pays</span>{' '}
                            <span>{payment.toName}</span>{' '}
                            <span className="text-[var(--em)] font-money tabular-nums num whitespace-nowrap">
                              {formatPKR(payment.amount)}
                            </span>
                          </p>
                          <p className="text-[11px] text-[var(--mu)] flex items-center gap-1 mt-0.5">
                            <span>Clears net squad balance</span>
                            <ArrowRight className="w-3 h-3 text-[var(--em)]" />
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSettling}
                        onClick={() => handleSettleSmartPayment(payment)}
                        className="btn sm shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSettling ? 'Settling...' : 'Settle'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Net Member Standings */}
            <div className="card !p-4 space-y-2.5 cq-card">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mu)] block">
                Member Net Standings
              </span>
              <div className="space-y-2">
                {simplifiedDebts.memberBalances.map((m) => (
                  <div
                    key={m.uid}
                    className="min-h-[52px] px-3 py-2 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={m.name} photoURL={m.photoURL} size="xs" />
                      <span className="text-xs font-bold text-[var(--tx)] truncate">
                        {m.uid === currentUser.uid ? `${m.name} (You)` : m.name}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-extrabold font-money tabular-nums num whitespace-nowrap shrink-0 ${
                        m.net > 0
                          ? 'text-[var(--em)]'
                          : m.net < 0
                          ? 'text-[var(--ro)]'
                          : 'text-[var(--mu)]'
                      }`}
                    >
                      {m.net > 0
                        ? `Gets back +${formatPKR(m.net)}`
                        : m.net < 0
                        ? `Owes −${formatPKR(Math.abs(m.net))}`
                        : 'Settled'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: MEMBERS LIST & ADD MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {/* Search within current members */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search squad members..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#F8FAFC] dark:bg-[#131A2D] border border-[#E2E8F0] dark:border-[#202B45] text-[#101828] dark:text-[#F8FAFC] focus:outline-none focus:border-[#4F46E5]"
              />
            </div>

            {/* Members List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#64748B]">
                <span>PARTICIPANTS</span>
                <span>{filteredMembers.length} active</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {filteredMembers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#94A3B8]">
                    No members match search.
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <div
                      key={member.uid}
                      className="p-3 rounded-2xl border border-[#E2E8F0] dark:border-[#202B45] bg-[#F8FAFC] dark:bg-[#151D30] flex items-center justify-between gap-3 shadow-2xs hover:border-[#CBD5E1] dark:hover:border-[#2C3B5E] transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={member.user.displayName}
                          photoURL={member.user.photoURL}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC] truncate">
                              {member.user.displayName}
                            </span>
                            {member.isMe && (
                              <span className="text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                                (You)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5">
                            {member.isOwner ? (
                              <Badge variant="warning">
                                <Crown className="w-2.5 h-2.5 mr-0.5" /> Owner
                              </Badge>
                            ) : member.isAdmin ? (
                              <Badge variant="primary">
                                <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Admin
                              </Badge>
                            ) : (
                              <Badge variant="neutral">
                                Member
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Member Action Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOwner && !member.isMe && (
                          <button
                            onClick={() =>
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Transfer Squad Ownership',
                                description: `Are you sure you want to make ${member.user.displayName} the master owner of "${squad.name}"? You will remain an admin.`,
                                actionLabel: 'Transfer Ownership',
                                variant: 'warning',
                                onConfirm: async () => {
                                  await transferSquadOwnership(member.uid, squad.id);
                                },
                              })
                            }
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                            title="Transfer Ownership"
                          >
                            <Crown className="w-4 h-4" />
                          </button>
                        )}

                        {isOwner && !member.isMe && (
                          <button
                            onClick={() => toggleSquadAdmin(member.uid, squad.id)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              member.isAdmin
                                ? 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={member.isAdmin ? 'Dismiss as Admin' : 'Make Squad Admin'}
                          >
                            {member.isAdmin ? (
                              <ShieldCheck className="w-4 h-4" />
                            ) : (
                              <Shield className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {canRemoveMembers && !member.isOwner && !member.isMe && (
                          <button
                            onClick={() =>
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Remove Member',
                                description: `Remove ${member.user.displayName} from this squad group?`,
                                actionLabel: 'Remove Member',
                                variant: 'danger',
                                onConfirm: async () => {
                                  await removeSquadMember(member.uid, squad.id);
                                },
                              })
                            }
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                            title="Remove from squad"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add Friends Section */}
            {canAddMembers && (
              <div className="space-y-3 pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Invite or Add Friends
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    {eligibleFriendsToAdd.length} friends available
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Search connected friends..."
                    value={friendSearchQuery}
                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-[#131A2D] border border-[#E2E8F0] dark:border-[#202B45] text-[#101828] dark:text-[#F8FAFC] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>

                {eligibleFriendsToAdd.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center text-xs text-[#64748B]">
                    All your connected friends are already in this squad group!
                  </div>
                ) : filteredFriendsToAdd.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#94A3B8]">
                    No friends match your search.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filteredFriendsToAdd.map((friend) => (
                      <div
                        key={friend.uid}
                        className="p-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#202B45] bg-white dark:bg-[#131A2D] flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={friend.displayName}
                            photoURL={friend.photoURL}
                            size="sm"
                          />
                          <div className="truncate">
                            <p className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC] truncate">
                              {friend.displayName}
                            </p>
                            {friend.email && (
                              <p className="text-[10px] text-[#64748B] truncate">{friend.email}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => sendSquadInvitation(squad.id, friend.uid)}
                            icon={<Send className="w-3.5 h-3.5" />}
                          >
                            Invite
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => addSquadMember(friend.uid, squad.id)}
                              icon={<UserPlus className="w-3.5 h-3.5" />}
                            >
                              Add Direct
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PERMISSIONS & GOVERNANCE */}
        {activeTab === 'permissions' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
              <Shield className="w-4 h-4 shrink-0" />
              <span>
                {isAdmin
                  ? 'As a squad admin, you can configure member permissions for this group.'
                  : 'Only squad admins can change group permissions.'}
              </span>
            </div>

            {/* Permission 1: Who can add members */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#202B45] bg-[#F8FAFC] dark:bg-[#151D30] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">
                    Who can add or invite members?
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    Controls who is allowed to invite or add friends into the squad.
                  </p>
                </div>
                {!isAdmin && <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { value: 'all_members', label: 'All Members' },
                  { value: 'admins', label: 'Admins Only' },
                  { value: 'owner_only', label: 'Owner Only' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    disabled={!isAdmin}
                    onClick={() => updateSquadConfig({ whoCanAdd: opt.value as any }, squad.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      squad.whoCanAdd === opt.value
                        ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-xs'
                        : 'bg-white dark:bg-[#1A233A] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#263353]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permission 2: Who can remove members */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#202B45] bg-[#F8FAFC] dark:bg-[#151D30] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">
                    Who can remove members?
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    Controls authority to remove members from the squad chat.
                  </p>
                </div>
                {!isAdmin && <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { value: 'admins', label: 'Admins & Owner' },
                  { value: 'owner_only', label: 'Owner Only' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    disabled={!isAdmin}
                    onClick={() => updateSquadConfig({ whoCanRemove: opt.value as any }, squad.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      squad.whoCanRemove === opt.value
                        ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-xs'
                        : 'bg-white dark:bg-[#1A233A] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#263353]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permission 3: Who can post chat messages */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#202B45] bg-[#F8FAFC] dark:bg-[#151D30] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">
                    Who can send messages?
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    Restrict messages to admins for announcement-only broadcast groups.
                  </p>
                </div>
                {!isAdmin && <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { value: 'all_members', label: 'All Members (Chat)' },
                  { value: 'admins_only', label: 'Only Admins (Broadcast)' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    disabled={!isAdmin}
                    onClick={() => updateSquadConfig({ whoCanPost: opt.value as any }, squad.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      squad.whoCanPost === opt.value
                        ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-xs'
                        : 'bg-white dark:bg-[#1A233A] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#263353]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permission 4: Who can edit group info */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#202B45] bg-[#F8FAFC] dark:bg-[#151D30] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">
                    Who can edit squad info?
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    Change group name, icon avatar, and description.
                  </p>
                </div>
                {!isAdmin && <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { value: 'admins', label: 'Admins & Owner' },
                  { value: 'all_members', label: 'All Members' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    disabled={!isAdmin}
                    onClick={() => updateSquadConfig({ whoCanEditInfo: opt.value as any }, squad.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      squad.whoCanEditInfo === opt.value
                        ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-xs'
                        : 'bg-white dark:bg-[#1A233A] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#263353]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permission 5: Who can post money cards */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#202B45] bg-[#F8FAFC] dark:bg-[#151D30] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">
                    Who can post money & ledger cards?
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    Share expense cards or ledger settlement requests in chat.
                  </p>
                </div>
                {!isAdmin && <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { value: 'all_members', label: 'All Members' },
                  { value: 'admins', label: 'Admins Only' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    disabled={!isAdmin}
                    onClick={() => updateSquadConfig({ whoCanShareCards: opt.value as any }, squad.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      squad.whoCanShareCards === opt.value
                        ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-xs'
                        : 'bg-white dark:bg-[#1A233A] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#263353]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GROUP SETTINGS & DANGER ZONE */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* WhatsApp Invite Code & Link Box */}
            <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#151D30] border border-[#CBD5E1] dark:border-[#263353] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#4F46E5]" />
                  <span className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">
                    WhatsApp-Style Invite Code & Link
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-[#EEF2FF] dark:bg-[#1E2642] text-[#4F46E5] dark:text-[#8B85FF] border border-[#4F46E5]/30">
                  {squad.inviteCode || 'SQD-PRIVATE'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Groups are private. Share this invite code with friends or copy the join link.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={handleCopyInviteCode}
                  icon={<KeyRound className="w-3.5 h-3.5" />}
                >
                  Copy Code
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={handleCopyInviteLink}
                  icon={<Copy className="w-3.5 h-3.5" />}
                >
                  Copy Link
                </Button>
              </div>
            </div>

            {/* Group Profile Settings */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#202B45] bg-[#F8FAFC] dark:bg-[#151D30] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Group Profile & Customization
              </h4>

              {/* Emoji Icon Picker */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC] block">
                  Group Icon Avatar
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {SQUAD_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      disabled={!canEditGroupInfo}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 transition cursor-pointer border ${
                        selectedEmoji === emoji
                          ? 'bg-[#EEF2FF] dark:bg-[#202B4B] border-[#4F46E5] scale-110 shadow-xs'
                          : 'bg-[#F8FAFC] dark:bg-[#182239] border-[#E2E8F0] dark:border-[#263353]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC] block">
                  Squad Name
                </label>
                <Input
                  disabled={!canEditGroupInfo}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="e.g. Flatmates 2026, Startup Team"
                />
              </div>

              {/* Group Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC] block">
                  Group Description
                </label>
                <Input
                  disabled={!canEditGroupInfo}
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  placeholder="Brief purpose of this squad group..."
                />
              </div>

              {canEditGroupInfo && (
                <Button
                  variant="primary"
                  fullWidth
                  isLoading={isSavingSettings}
                  onClick={handleSaveGroupInfo}
                  icon={<Check className="w-4 h-4" />}
                >
                  Save Group Changes
                </Button>
              )}
            </div>

            {/* Danger Zone */}
            <div className="p-4 rounded-2xl border border-red-200 dark:border-red-950/40 bg-red-50/50 dark:bg-red-950/10 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Squad Actions
              </h4>

              {!isOwner ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">
                      Leave Squad Group
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      You will no longer participate in this group chat.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      setConfirmDialog({
                        isOpen: true,
                        title: 'Leave Squad Group',
                        description:
                          'Are you sure you want to leave this squad group? An admin or member will need to add you back.',
                        actionLabel: 'Leave Squad',
                        variant: 'danger',
                        onConfirm: async () => {
                          await leaveSquadGroup(squad.id);
                          onClose();
                        },
                      })
                    }
                    icon={<LogOut className="w-3.5 h-3.5" />}
                  >
                    Leave
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-[#64748B]">
                    You are the master owner of this squad group. To leave, transfer ownership first or delete the group.
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-red-200 dark:border-red-900/40">
                    <div>
                      <p className="text-xs font-bold text-red-700 dark:text-red-400">
                        Delete Squad Group
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        Permanently delete this squad and all its messages.
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Delete Squad Group',
                          description:
                            `Are you sure you want to permanently delete "${squad.name}"? This action cannot be undone.`,
                          actionLabel: 'Delete Group',
                          variant: 'danger',
                          onConfirm: async () => {
                            await deleteSquadGroup(squad.id);
                            onClose();
                          },
                        })
                      }
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Confirmation Dialog */}
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-[#131A2D] rounded-3xl border border-[#E2E8F0] dark:border-[#202B45] p-5 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    confirmDialog.variant === 'danger'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#101828] dark:text-[#F8FAFC]">
                    {confirmDialog.title}
                  </h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {confirmDialog.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-3.5 py-2 text-xs font-bold text-[#64748B] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  variant={confirmDialog.variant === 'danger' ? 'danger' : 'primary'}
                  size="sm"
                  onClick={async () => {
                    await confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                >
                  {confirmDialog.actionLabel}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};
