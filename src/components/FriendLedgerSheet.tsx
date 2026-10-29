import React, { useState, useMemo, Suspense } from 'react';
import { useApp } from '../context/AppContext';
import { UserProfile } from '../types';
import {
  Bell,
  Share2,
  Trash2,
  RefreshCw,
  Slash,
  Clock,
  UserMinus,
  Check,
  Plus,
  DollarSign,
  Receipt,
  Camera,
  Utensils,
  MapPin,
  X,
  Image as ImageIcon,
  Wallet,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { formatPKR, formatShortDate, getEntriesForFriend } from '../lib/formatters';
import {
  Avatar,
  Button,
  Card,
  Input,
  Sheet,
  Modal,
  ReceiptThumb,
  AnimatedNumber,
  StaggerItem,
  SheetSkeleton,
} from '../ui';
import { compressImageToDataUrl } from '../lib/mediaUtils';
import { Expense } from '../types';
import { LazyTransactionDetailModal } from '../lib/preloadRoutes';
import { triggerHaptic } from '../lib/webNotification';

interface FriendLedgerSheetProps {
  friend: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onFriendRemoved?: () => void;
}

export const FriendLedgerSheet: React.FC<FriendLedgerSheetProps> = ({
  friend,
  isOpen,
  onClose,
  onFriendRemoved,
}) => {
  const {
    currentUser,
    friendBalance,
    ledgerEntries,
    activeLedgerEntries,
    activeExpenses,
    deleteExpense,
    deleteLedgerEntry,
    addLedgerEntry,
    sendNudge,
    shareLinksMap,
    getFriendShareUrl,
    regenerateLink,
    revokeLink,
    removeFriend,
    showToast,
  } = useApp();

  const [selectedExpenseForDetail, setSelectedExpenseForDetail] = useState<Expense | null>(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('EasyPaisa');
  const [settleNote, setSettleNote] = useState('');
  const [settleRefId, setSettleRefId] = useState('');
  const [settleDirection, setSettleDirection] = useState<'i_paid' | 'friend_paid'>('i_paid');
  const [settleProof, setSettleProof] = useState<string | null>(null);
  const [isUploadingSettleProof, setIsUploadingSettleProof] = useState(false);
  const [showSettleConfirmStep, setShowSettleConfirmStep] = useState(false);
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const settleFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Modals & sub-actions
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryLabel, setEntryLabel] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryType, setEntryType] = useState<'owes' | 'payment'>('owes');
  const [entryNote, setEntryNote] = useState('');
  const [entryWhatEat, setEntryWhatEat] = useState('');
  const [entryTimeWhen, setEntryTimeWhen] = useState('');
  const [entrySituation, setEntrySituation] = useState('');
  const [entryProof, setEntryProof] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const proofInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);

  // Remove confirmation
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const friendId = friend?.uid;
  const balance = friendId ? friendBalance(friendId) : 0;
  const isOwed = balance > 0;
  const isSettled = balance === 0;

  const entries = useMemo(() => {
    if (!friendId) return [];
    return getEntriesForFriend(activeLedgerEntries, friendId, currentUser.uid)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeLedgerEntries, friendId, currentUser.uid]);

  // Accurate Personal Spending Calculation for Friend (their actual share in split bills, NOT the total bill amounts!)
  const friendPersonalSpending = useMemo(() => {
    if (!friendId) return 0;
    return activeExpenses.reduce((sum, exp) => {
      if (exp.splits && exp.splits.length > 0) {
        const s = exp.splits.find((sp) => sp.userId === friendId);
        if (s) return sum + s.share;
      } else if (exp.paidBy === friendId) {
        return sum + exp.amount;
      }
      return sum;
    }, 0);
  }, [activeExpenses, friendId]);

  const friendSharedBillsCount = useMemo(() => {
    if (!friendId) return 0;
    return activeExpenses.filter((exp) =>
      exp.splits && exp.splits.some((sp) => sp.userId === friendId)
    ).length;
  }, [activeExpenses, friendId]);

  const friendTotalSettled = useMemo(() => {
    return entries
      .filter((e) => e.type === 'payment')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [entries]);

  const activeLink = friendId ? shareLinksMap[friendId] : null;

  if (!friend) return null;

  const handleCopyShareLink = async () => {
    if (!friendId) return;
    let url = getFriendShareUrl(friendId);
    if (!url) {
      url = await regenerateLink(friendId);
    }
    navigator.clipboard.writeText(url);
    showToast({ type: 'success', message: 'Statement link copied (?s=<token>).' });
  };

  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProof(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 900, 0.72);
      setEntryProof(dataUrl);
      showToast({ type: 'success', message: 'Proof of payment attached!' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to process receipt image.' });
    } finally {
      setIsUploadingProof(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(entryAmount);
    if (isNaN(amt) || amt <= 0 || !entryLabel.trim() || !friendId) {
      showToast({ type: 'warning', message: 'Please enter a valid amount and description.' });
      return;
    }

    setIsSubmittingEntry(true);
    try {
      const isPayingDebt = !isOwed;
      await addLedgerEntry({
        friendId,
        friendName: friend.displayName,
        date: new Date().toISOString().split('T')[0],
        label: entryLabel.trim(),
        amount: amt,
        type: entryType,
        paymentDirection: entryType === 'payment' ? (isPayingDebt ? 'paid_to_friend' : 'received_from_friend') : undefined,
        payerId: entryType === 'payment' ? (isPayingDebt ? currentUser.uid : friend.uid) : currentUser.uid,
        payerName: entryType === 'payment' ? (isPayingDebt ? currentUser.displayName : friend.displayName) : currentUser.displayName,
        recipientId: entryType === 'payment' ? (isPayingDebt ? friend.uid : currentUser.uid) : friend.uid,
        recipientName: entryType === 'payment' ? (isPayingDebt ? friend.displayName : currentUser.displayName) : friend.displayName,
        note: entryNote.trim() || undefined,
        whatEat: entryWhatEat.trim() || undefined,
        timeWhen: entryTimeWhen.trim() || undefined,
        situation: entrySituation.trim() || undefined,
        proofOfPayment: entryProof || undefined,
        createdBy: currentUser.uid,
      });

      setEntryLabel('');
      setEntryAmount('');
      setEntryNote('');
      setEntryWhatEat('');
      setEntryTimeWhen('');
      setEntrySituation('');
      setEntryProof(null);
      setShowAddEntry(false);
    } finally {
      setIsSubmittingEntry(false);
    }
  };

  const handleSettleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSettleProof(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 900, 0.72);
      setSettleProof(dataUrl);
      showToast({ type: 'success', message: 'Payment receipt attached!' });
    } catch {
      showToast({ type: 'error', message: 'Failed to process receipt image.' });
    } finally {
      setIsUploadingSettleProof(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleReviewSettle = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast({ type: 'warning', message: 'Please enter a valid settlement amount.' });
      return;
    }
    setShowSettleConfirmStep(true);
  };

  const handleFinalizeSettle = async () => {
    if (!friendId) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return;

    const isUserPaying = settleDirection === 'i_paid';
    setIsSubmittingSettle(true);
    try {
      await addLedgerEntry({
        friendId,
        friendName: friend.displayName,
        date: new Date().toISOString().split('T')[0],
        label: isUserPaying
          ? `Settled debt to ${friend.displayName} via ${settleMethod}${settleRefId ? ` (Ref: ${settleRefId})` : ''}`
          : `Received payment from ${friend.displayName} via ${settleMethod}${settleRefId ? ` (Ref: ${settleRefId})` : ''}`,
        amount: amt,
        type: 'payment',
        paymentDirection: isUserPaying ? 'paid_to_friend' : 'received_from_friend',
        payerId: isUserPaying ? currentUser.uid : friend.uid,
        payerName: isUserPaying ? currentUser.displayName : friend.displayName,
        recipientId: isUserPaying ? friend.uid : currentUser.uid,
        recipientName: isUserPaying ? friend.displayName : currentUser.displayName,
        paymentMethod: settleMethod,
        proofOfPayment: settleProof || undefined,
        note: settleNote.trim() || undefined,
        createdBy: currentUser.uid,
      });

      triggerHaptic([70, 50, 90]);
      showToast({
        type: 'success',
        message: `${isUserPaying ? 'Paid debt of' : 'Recorded payment of'} ${formatPKR(amt)} with ${friend.displayName}!`,
      });
      setShowSettleModal(false);
      setShowSettleConfirmStep(false);
    } catch {
      showToast({ type: 'error', message: 'Failed to record settlement.' });
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleConfirmRemoveFriend = async () => {
    if (!friendId) return;
    setIsRemoving(true);
    try {
      await removeFriend(friendId);
      setShowConfirmRemove(false);
      onClose();
      if (onFriendRemoved) onFriendRemoved();
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <>
      <Sheet isOpen={isOpen} onClose={onClose} title={`${friend.displayName}'s Statement & Ledger`}>
        <div className="space-y-5 max-w-xl mx-auto">
          {/* Header & Balance Glass Card */}
          <div className="card text-center space-y-4 cq-card">
            <Avatar
              name={friend.displayName}
              photoURL={friend.photoURL}
              size="xl"
              ring={isSettled ? 'none' : isOwed ? 'green' : 'red'}
              className="mx-auto shadow-md"
            />

            <div className="space-y-0.5">
              <h3 className="text-xl font-extrabold text-[var(--tx)] tracking-tight">
                {friend.displayName}
              </h3>
              <p className="text-xs text-[var(--mu)]">
                @{friend.displayName.toLowerCase().replace(/\s+/g, '_')}
              </p>
              {friend.phone && (
                <p className="text-xs text-[var(--mu)]">{friend.phone}</p>
              )}
            </div>

            {/* Big Balance (never wraps, container-query sized) */}
            <div className="pt-1 cq-card">
              <span className="text-[11px] uppercase font-extrabold tracking-wider text-[var(--mu)] block">
                {isSettled ? 'Balance settled' : isOwed ? 'Owed to you' : 'You owe'}
              </span>
              <div
                className={`font-extrabold font-money tabular-nums tracking-tight pt-1 whitespace-nowrap cq-amount-hero ${
                  isSettled
                    ? 'text-[var(--mu)]'
                    : isOwed
                    ? 'text-[var(--em)]'
                    : 'text-[var(--ro)]'
                }`}
              >
                <AnimatedNumber value={Math.abs(balance)} />
              </div>
            </div>

            {/* Friend's Personal Spending & Settlement Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-[var(--line)] text-left">
              <div className="p-3 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] cq-card">
                <span className="text-[10px] uppercase font-extrabold text-[var(--mu)] flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-[var(--vi)]" /> {friend.displayName.split(' ')[0]}'s Spent
                </span>
                <span className="font-extrabold font-money text-[var(--tx)] tabular-nums block pt-0.5 whitespace-nowrap cq-amount-lg">
                  {formatPKR(friendPersonalSpending)}
                </span>
                <span className="text-[10px] text-[var(--mu)] block pt-0.5 leading-tight">
                  Share in {friendSharedBillsCount} split bill{friendSharedBillsCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="p-3 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] cq-card">
                <span className="text-[10px] uppercase font-extrabold text-[var(--mu)] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[var(--em)]" /> Settled
                </span>
                <span className="font-extrabold font-money text-[var(--em)] tabular-nums block pt-0.5 whitespace-nowrap cq-amount-lg">
                  {formatPKR(friendTotalSettled)}
                </span>
                <span className="text-[10px] text-[var(--mu)] block pt-0.5 leading-tight">
                  Total payments recorded
                </span>
              </div>

              <div className="p-3 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] col-span-2 sm:col-span-1 cq-card">
                <span className="text-[10px] uppercase font-extrabold text-[var(--mu)] flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-[var(--su)]" /> Current Net
                </span>
                <span
                  className={`font-extrabold font-money tabular-nums block pt-0.5 whitespace-nowrap cq-amount-lg ${
                    isSettled
                      ? 'text-[var(--mu)]'
                      : isOwed
                      ? 'text-[var(--em)]'
                      : 'text-[var(--ro)]'
                  }`}
                >
                  {isSettled ? 'Settled' : formatPKR(Math.abs(balance))}
                </span>
                <span className="text-[10px] text-[var(--mu)] block pt-0.5 leading-tight">
                  {isSettled ? 'Zero debt' : isOwed ? 'Owed to you' : 'You owe friend'}
                </span>
              </div>
            </div>

            {/* Actions: Settle Up, Nudge, Share Statement, Add Entry, Remove */}
            <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
              {!isSettled && !isOwed && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSettleAmount(Math.abs(balance).toString());
                    setSettleDirection('i_paid');
                    setSettleProof(null);
                    setSettleRefId('');
                    setSettleNote(`Settling balance with ${friend.displayName}`);
                    setShowSettleConfirmStep(false);
                    setShowSettleModal(true);
                  }}
                  icon={<Wallet className="w-3.5 h-3.5" />}
                >
                  Pay / Settle Up ({formatPKR(Math.abs(balance))})
                </Button>
              )}

              {isOwed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSettleAmount(balance.toString());
                    setSettleDirection('friend_paid');
                    setSettleProof(null);
                    setSettleRefId('');
                    setSettleNote(`Received payment from ${friend.displayName}`);
                    setShowSettleConfirmStep(false);
                    setShowSettleModal(true);
                  }}
                  icon={<DollarSign className="w-3.5 h-3.5 text-[var(--em)]" />}
                >
                  Record Received
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => sendNudge(friend.uid)}
                icon={<Bell className="w-3.5 h-3.5 text-[var(--su)]" />}
              >
                Nudge
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyShareLink}
                icon={<Share2 className="w-3.5 h-3.5 text-[var(--vi)]" />}
              >
                Share Link
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddEntry(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Entry
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowConfirmRemove(true)}
                icon={<UserMinus className="w-3.5 h-3.5" />}
              >
                Remove
              </Button>
            </div>

            {/* Share link management */}
            {activeLink && (
              <div className="pt-3 border-t border-[var(--line)] text-xs flex items-center justify-between text-[var(--mu)]">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Updated {formatShortDate(activeLink.updatedAt || activeLink.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const newUrl = await regenerateLink(friend.uid);
                      navigator.clipboard.writeText(newUrl);
                      showToast({ type: 'success', message: 'New link created and copied!' });
                    }}
                    className="font-bold text-[var(--em)] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerate</span>
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await revokeLink(friend.uid);
                    }}
                    className="font-bold text-[var(--ro)] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Slash className="w-3 h-3" />
                    <span>Revoke</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Statement History Entries (Every row >= 64px tall on mobile) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--mu)]">
                Statement Entries ({entries.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowAddEntry(true)}
                className="text-xs font-extrabold text-[var(--em)] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Record</span>
              </button>
            </div>

            <div className="card !p-3 max-h-96 overflow-y-auto custom-scrollbar">
              {entries.length === 0 ? (
                <p className="py-10 text-center text-xs text-[var(--mu)]">
                  No statement transactions recorded with {friend.displayName} yet.
                </p>
              ) : (
                <ul className="li">
                  {entries.map((entry) => {
                    const isPaid = entry.type === 'payment' || entry.amount < 0;
                    const matchingExpense = entry.refExpenseId
                      ? activeExpenses.find((e) => e.id === entry.refExpenseId)
                      : null;

                    return (
                      <li
                        key={entry.id}
                        onClick={() => {
                          if (matchingExpense) {
                            setSelectedExpenseForDetail(matchingExpense);
                          }
                        }}
                        className={`min-h-[64px] group cq-card ${
                          matchingExpense ? 'cursor-pointer' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-[var(--tx)] truncate">
                              {entry.label}
                            </span>
                            <span
                              className={`chip !py-0.5 !px-2 !text-[10px] ${
                                isPaid ? 'on' : '!bg-[var(--ro)]/18 !text-[var(--ro)]'
                              }`}
                            >
                              {isPaid ? 'Payment' : 'Owes'}
                            </span>
                            {matchingExpense && (
                              <span className="chip !py-0.5 !px-2 !text-[10px]">
                                Split Bill →
                              </span>
                            )}
                            {matchingExpense?.dispute?.status === 'disputed' && (
                              <span className="chip r !py-0.5 !px-2 !text-[10px]">
                                Disputed
                              </span>
                            )}
                            {entry.whatEat && (
                              <span className="chip !py-0.5 !px-2 !text-[10px]">
                                🍽️ {entry.whatEat}
                              </span>
                            )}
                            {entry.situation && (
                              <span className="chip !py-0.5 !px-2 !text-[10px]">
                                📍 {entry.situation}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--mu)] pt-0.5 truncate flex items-center gap-1.5">
                            <span>{formatShortDate(entry.date)}</span>
                            {entry.timeWhen && <span>• {entry.timeWhen}</span>}
                            {entry.note && <span>• {entry.note}</span>}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                          {entry.proofOfPayment && (
                            <ReceiptThumb
                              src={entry.proofOfPayment}
                              alt="Receipt proof"
                              size={36}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveLightboxImage(entry.proofOfPayment || null);
                              }}
                            />
                          )}
                          <span
                            className={`font-extrabold font-money tabular-nums whitespace-nowrap shrink-0 cq-amount ${
                              isPaid ? 'text-[var(--em)]' : 'text-[var(--ro)]'
                            }`}
                          >
                            {isPaid
                              ? `−${formatPKR(Math.abs(entry.amount))}`
                              : `+${formatPKR(entry.amount)}`}
                          </span>

                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (entry.refExpenseId) {
                                await deleteExpense(entry.refExpenseId);
                              } else {
                                await deleteLedgerEntry(entry.id);
                              }
                            }}
                            className="ib !w-8 !h-8 text-[var(--mu)] hover:!text-[var(--ro)]"
                            title="Delete entry (with Undo)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Sheet>

      {/* ADD LEDGER ENTRY MODAL */}
      <Sheet
        isOpen={showAddEntry}
        onClose={() => setShowAddEntry(false)}
        title={`Add Entry for ${friend.displayName}`}
      >
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div className="seg w-full grid grid-cols-2">
            <button
              type="button"
              onClick={() => setEntryType('owes')}
              className={entryType === 'owes' ? 'on' : ''}
            >
              Friend Owes (+)
            </button>
            <button
              type="button"
              onClick={() => setEntryType('payment')}
              className={entryType === 'payment' ? 'on' : ''}
            >
              Payment Made (−)
            </button>
          </div>

          <Input
            label="Amount (PKR) *"
            type="number"
            placeholder="e.g. 1200"
            required
            autoFocus
            value={entryAmount}
            onChange={(e) => setEntryAmount(e.target.value)}
          />

          <Input
            label="Description / Title *"
            placeholder="e.g. Dinner split, Sadapay settlement, Ride share"
            required
            value={entryLabel}
            onChange={(e) => setEntryLabel(e.target.value)}
          />

          {/* What eat & Situation details */}
          <div className="p-3.5 rounded-[20px] bg-[var(--surface-2)] border border-[var(--line)] space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--tx)] flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-[var(--em)]" />
                <span>What was eaten / ordered?</span>
              </label>
              <Input
                placeholder="e.g. 🍕 Pizza & Coke, Karahi & Naan, Chai"
                value={entryWhatEat}
                onChange={(e) => setEntryWhatEat(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--tx)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--em)]" />
                <span>When was this? (Time & Meal)</span>
              </label>
              <Input
                placeholder="e.g. Dinner (9:00 PM), Friday Lunch"
                value={entryTimeWhen}
                onChange={(e) => setEntryTimeWhen(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--tx)] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--em)]" />
                <span>What's the situation / occasion?</span>
              </label>
              <Input
                placeholder="e.g. Birthday treat, Office team lunch, Weekend hangout"
                value={entrySituation}
                onChange={(e) => setEntrySituation(e.target.value)}
              />
            </div>

            {/* Proof of Payment upload */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--tx)] flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-[var(--em)]" />
                  <span>Proof of Payment / Receipt</span>
                </label>
                {entryProof && (
                  <span className="text-[10px] font-bold text-[var(--em)] flex items-center gap-1">
                    <Check className="w-3 h-3" /> Attached
                  </span>
                )}
              </div>

              <input
                ref={proofInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleProofChange}
                className="hidden"
              />

              {entryProof ? (
                <div className="relative rounded-[16px] border border-[var(--em)]/30 bg-[var(--surface-2)] p-2.5 flex items-center gap-2.5">
                  <img
                    src={entryProof}
                    alt="Receipt proof"
                    className="w-12 h-12 object-cover rounded-[12px] border border-[var(--line)] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-[var(--tx)]">
                      Receipt Attached
                    </p>
                    <p className="text-[10px] text-[var(--mu)]">
                      Proof saved with entry
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEntryProof(null)}
                    className="ib !w-8 !h-8 text-[var(--ro)]"
                    title="Remove proof"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isUploadingProof}
                  onClick={() => proofInputRef.current?.click()}
                  className="w-full py-3 px-3 rounded-[16px] border border-dashed border-[var(--em)]/40 hover:border-[var(--em)] bg-[var(--surface-2)] flex items-center justify-center gap-2 text-xs font-bold text-[var(--em)] cursor-pointer transition"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isUploadingProof ? 'Compressing...' : 'Attach Receipt or Screenshot'}</span>
                </button>
              )}
            </div>
          </div>

          <Input
            label="Additional Note (Optional)"
            placeholder="e.g. Paid via Sadapay, cash in person"
            value={entryNote}
            onChange={(e) => setEntryNote(e.target.value)}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isSubmittingEntry}
          >
            {isSubmittingEntry ? 'Saving...' : 'Save Entry'}
          </Button>
        </form>
      </Sheet>

      {/* LIGHTBOX MODAL FOR FULL-SIZE RECEIPT PROOF */}
      <Modal
        isOpen={Boolean(activeLightboxImage)}
        onClose={() => setActiveLightboxImage(null)}
        title="Proof of Payment"
        size="lg"
      >
        {activeLightboxImage && (
          <div className="flex items-center justify-center rounded-[20px] overflow-hidden border border-[var(--line)] bg-black/40 max-h-[75vh]">
            <img
              src={activeLightboxImage}
              alt="Payment receipt proof"
              className="max-h-[72vh] w-auto object-contain"
            />
          </div>
        )}
      </Modal>

      {/* CONFIRM REMOVE MODAL */}
      <Sheet
        isOpen={showConfirmRemove}
        onClose={() => setShowConfirmRemove(false)}
        title="Remove Friend"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3.5 rounded-[20px] bg-[var(--ro)]/12 border border-[var(--ro)]/30">
            <Avatar name={friend.displayName} photoURL={friend.photoURL} size="md" />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-extrabold text-[var(--tx)] truncate">
                {friend.displayName}
              </h4>
              <p className="text-xs text-[var(--mu)] truncate">
                @{friend.displayName.toLowerCase().replace(/\s+/g, '_')}
              </p>
            </div>
          </div>

          <p className="text-xs text-[var(--mu)] leading-relaxed">
            Are you sure you want to remove <strong className="text-[var(--tx)]">{friend.displayName}</strong>? They will be removed from your friends and chat list. Your shared transactions in the ledger and groups will be safely preserved.
          </p>

          <div className="pt-2 flex items-center gap-2.5">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowConfirmRemove(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              disabled={isRemoving}
              onClick={handleConfirmRemoveFriend}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {isRemoving ? 'Removing...' : 'Confirm Remove'}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* 2-Step Settle Up Payment Modal with Progress Indicator */}
      {showSettleModal && (
        <Modal
          isOpen={showSettleModal}
          onClose={() => {
            setShowSettleModal(false);
            setShowSettleConfirmStep(false);
          }}
          title={showSettleConfirmStep ? 'Step 2: Review & Confirm' : `Settle Balance with ${friend.displayName}`}
          size="md"
        >
          {/* 2-Step Progress Indicator */}
          <div className="mb-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span className={!showSettleConfirmStep ? 'text-[var(--em)]' : 'text-[var(--mu)]'}>
                1. Payment Details
              </span>
              <span className={showSettleConfirmStep ? 'text-[var(--em)]' : 'text-[var(--mu)]'}>
                2. Verify &amp; Settle
              </span>
            </div>
            <div className="bar !h-2">
              <i style={{ width: showSettleConfirmStep ? '100%' : '50%' }} />
            </div>
          </div>

          {!showSettleConfirmStep ? (
            /* STEP 1: Details & Proof Attachment */
            <form onSubmit={handleReviewSettle} className="space-y-4">
              {/* Direction Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[var(--mu)] uppercase tracking-wider block">
                  Payment Direction
                </label>
                <div className="seg w-full grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSettleDirection('i_paid')}
                    className={settleDirection === 'i_paid' ? 'on' : ''}
                  >
                    I paid {friend.displayName.split(' ')[0]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleDirection('friend_paid')}
                    className={settleDirection === 'friend_paid' ? 'on' : ''}
                  >
                    {friend.displayName.split(' ')[0]} paid me
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-[18px] bg-[var(--em)]/12 border border-[var(--em)]/30 text-xs flex items-center justify-between gap-2 cq-card">
                <span className="font-extrabold text-[var(--em)]">
                  {settleDirection === 'i_paid'
                    ? `Paying debt to ${friend.displayName}`
                    : `Recording payment from ${friend.displayName}`}
                </span>
                <span className="font-extrabold font-money tabular-nums text-[var(--tx)] whitespace-nowrap cq-amount">
                  Net: {formatPKR(Math.abs(balance))}
                </span>
              </div>

              <Input
                label="Amount (Rs)"
                type="number"
                step="any"
                value={settleAmount}
                required
                onChange={(e) => setSettleAmount(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--mu)] block">
                    Payment Channel
                  </label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    className="f !h-12 !text-[16px]"
                  >
                    <option value="EasyPaisa" className="bg-[var(--surface-solid)] text-[var(--tx)]">EasyPaisa</option>
                    <option value="JazzCash" className="bg-[var(--surface-solid)] text-[var(--tx)]">JazzCash</option>
                    <option value="Nayapay / Sadapay" className="bg-[var(--surface-solid)] text-[var(--tx)]">Nayapay / Sadapay</option>
                    <option value="Raast" className="bg-[var(--surface-solid)] text-[var(--tx)]">Raast Instant Transfer</option>
                    <option value="Bank Transfer" className="bg-[var(--surface-solid)] text-[var(--tx)]">Bank Transfer</option>
                    <option value="Cash in Hand" className="bg-[var(--surface-solid)] text-[var(--tx)]">Cash in Hand</option>
                  </select>
                </div>

                <Input
                  label="Transaction Ref / TID #"
                  placeholder="e.g. EP-492810"
                  value={settleRefId}
                  onChange={(e) => setSettleRefId(e.target.value)}
                />
              </div>

              {/* Proof of Payment Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--tx)] flex items-center justify-between">
                  <span>Proof of Payment / Receipt</span>
                  <span className="text-[11px] text-[var(--mu)]">Recommended</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={settleFileInputRef}
                  onChange={handleSettleProofChange}
                  className="hidden"
                />

                {settleProof ? (
                  <div className="relative border border-[var(--line)] rounded-[18px] p-2.5 bg-[var(--surface-2)] flex items-center gap-3">
                    <img
                      src={settleProof}
                      alt="Payment Proof"
                      className="w-14 h-14 object-cover rounded-[12px] border border-[var(--line)] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-[var(--tx)]">Receipt attached</p>
                      <p className="text-[11px] text-[var(--em)] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ready for verification
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettleProof(null)}
                      className="ib !w-8 !h-8 text-[var(--ro)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => settleFileInputRef.current?.click()}
                    disabled={isUploadingSettleProof}
                    className="w-full border-2 border-dashed border-[var(--line)] rounded-[18px] p-3.5 flex items-center justify-center gap-2 text-xs font-bold text-[var(--mu)] hover:border-[var(--em)] hover:text-[var(--em)] transition cursor-pointer bg-[var(--surface-2)]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isUploadingSettleProof ? 'Compressing receipt...' : 'Upload receipt screenshot or camera photo'}</span>
                  </button>
                )}
              </div>

              <Input
                label="Note (optional)"
                placeholder="e.g. Cleared pending debt"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button variant="secondary" onClick={() => setShowSettleModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Review &amp; Confirm
                </Button>
              </div>
            </form>
          ) : (
            /* STEP 2: Confirmation Review */
            <div className="space-y-4">
              <div className="p-4 rounded-[20px] bg-[var(--su)]/12 border border-[var(--su)]/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--su)] shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                  <p className="font-extrabold text-[var(--su)]">
                    Verify settlement details
                  </p>
                  <p className="text-[var(--mu)]">
                    Double-check payment proof and channel. This logs a transaction that officially updates the ledger between both users.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-[20px] bg-[var(--surface-2)] border border-[var(--line)] space-y-3 cq-card">
                <div className="flex items-center justify-between pb-2.5 border-b border-[var(--line)]">
                  <span className="text-xs font-bold text-[var(--mu)]">Amount</span>
                  <span className="font-extrabold font-money text-[var(--em)] tabular-nums whitespace-nowrap cq-amount-lg">
                    {formatPKR(parseFloat(settleAmount) || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--mu)] block text-[11px]">Payer</span>
                    <span className="font-extrabold text-[var(--tx)]">
                      {settleDirection === 'i_paid' ? `${currentUser.displayName} (You)` : friend.displayName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--mu)] block text-[11px]">Recipient</span>
                    <span className="font-extrabold text-[var(--tx)]">
                      {settleDirection === 'i_paid' ? friend.displayName : `${currentUser.displayName} (You)`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-[var(--mu)] block text-[11px]">Channel</span>
                    <span className="font-bold text-[var(--tx)]">{settleMethod}</span>
                  </div>
                  <div>
                    <span className="text-[var(--mu)] block text-[11px]">Reference #</span>
                    <span className="font-bold text-[var(--tx)]">{settleRefId || 'None provided'}</span>
                  </div>
                </div>

                {settleProof && (
                  <div className="pt-2.5 border-t border-[var(--line)] flex items-center gap-2.5">
                    <img
                      src={settleProof}
                      alt="Proof Receipt"
                      className="w-12 h-12 object-cover rounded-[12px] border border-[var(--line)]"
                    />
                    <div className="text-xs">
                      <span className="font-extrabold text-[var(--em)] flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Proof Receipt Verified
                      </span>
                      <p className="text-[11px] text-[var(--mu)]">Image proof saved to ledger</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowSettleConfirmStep(false)}
                  disabled={isSubmittingSettle}
                >
                  Back to Edit
                </Button>
                <Button
                  variant="primary"
                  onClick={handleFinalizeSettle}
                  disabled={isSubmittingSettle}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  {isSubmittingSettle ? 'Settling...' : 'Confirm & Settle Now'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Code-split Transaction Detail Breakdown Modal */}
      {selectedExpenseForDetail && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyTransactionDetailModal
            expense={selectedExpenseForDetail}
            isOpen={!!selectedExpenseForDetail}
            onClose={() => setSelectedExpenseForDetail(null)}
          />
        </Suspense>
      )}
    </>
  );
};


