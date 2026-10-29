import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  Bell,
  Copy,
  Share2,
  RefreshCw,
  Slash,
  MessageSquare,
  FileDown,
  ExternalLink,
  CheckCircle2,
  Camera,
  X,
  AlertCircle,
  Receipt,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { formatPKR, formatShortDate, getEntriesForFriend } from '../lib/formatters';
import { Card, Avatar, Button, Input, Modal, Sheet } from '../ui';
import { PaymentMethod } from '../types';
import { exportFriendStatementPDF } from '../lib/pdfExport';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'JazzCash', label: 'JazzCash', icon: '📱' },
  { id: 'EasyPaisa', label: 'EasyPaisa', icon: '🟢' },
  { id: 'Nayapay / Sadapay', label: 'SadaPay / NayaPay', icon: '💳' },
  { id: 'Bank Transfer', label: 'Bank Transfer', icon: '🏦' },
  { id: 'Cash', label: 'Cash', icon: '💵' },
  { id: 'Other', label: 'Other', icon: '✨' },
];

export const FriendLedgerView: React.FC = () => {
  const {
    friends,
    ledgerEntries,
    activeLedgerEntries,
    activeExpenses,
    addLedgerEntry,
    friendBalance,
    sendNudge,
    isOwnerMode,
    currentUser,
    paymentClaims,
    submitPaymentClaim,
    resolvePaymentClaim,
    comments,
    addComment,
    reactions,
    toggleReaction,
    shareLinksMap,
    getFriendShareUrl,
    regenerateLink,
    revokeLink,
    showToast,
  } = useApp();

  const [activeFriendId, setActiveFriendId] = useState<string>(
    friends[0]?.uid || ''
  );

  // Settlement & Payment Modal states
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showSettleConfirmStep, setShowSettleConfirmStep] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDirection, setSettleDirection] = useState<'i_paid' | 'friend_paid'>('i_paid');
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('JazzCash');
  const [settleRefId, setSettleRefId] = useState('');
  const [settleProof, setSettleProof] = useState<string | null>(null);
  const [settleNote, setSettleNote] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const settleFileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox for proof
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  // Manual adjustment modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustLabel, setAdjustLabel] = useState('');
  const [adjustType, setAdjustType] = useState<'owes' | 'adjustment' | 'payment'>('owes');

  // Claim modal
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimAmount, setClaimAmount] = useState('');
  const [claimNote, setClaimNote] = useState('');

  // Commenting
  const [activeCommentEntryId, setActiveCommentEntryId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const activeFriend = friends.find((f) => f.uid === activeFriendId) || friends[0];

  const friendEntries = useMemo(() => {
    if (!activeFriendId) return [];
    return getEntriesForFriend(activeLedgerEntries, activeFriendId, currentUser.uid)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeLedgerEntries, activeFriendId, currentUser.uid]);

  const currentBalance = activeFriendId ? friendBalance(activeFriendId) : 0;
  const isOwed = currentBalance > 0;
  const isSettled = currentBalance === 0;

  // Accurate Personal Spending Calculation for Friend (their actual share in split bills, NOT the total bill amounts!)
  const friendPersonalSpending = useMemo(() => {
    if (!activeFriendId) return 0;
    return activeExpenses.reduce((sum, exp) => {
      if (exp.splits && exp.splits.length > 0) {
        const s = exp.splits.find((sp) => sp.userId === activeFriendId);
        if (s) return sum + s.share;
      } else if (exp.paidBy === activeFriendId) {
        return sum + exp.amount;
      }
      return sum;
    }, 0);
  }, [activeExpenses, activeFriendId]);

  const friendSharedBillsCount = useMemo(() => {
    if (!activeFriendId) return 0;
    return activeExpenses.filter((exp) =>
      exp.splits && exp.splits.some((sp) => sp.userId === activeFriendId)
    ).length;
  }, [activeExpenses, activeFriendId]);

  const friendTotalSettled = useMemo(() => {
    return friendEntries
      .filter((e) => e.type === 'payment')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [friendEntries]);

  const activeFriendClaims = paymentClaims.filter(
    (c) => c.friendId === activeFriendId && c.status === 'pending'
  );

  const activeLink = activeFriendId ? shareLinksMap[activeFriendId] : null;

  // Image compression for settlement proof
  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showToast({ type: 'error', message: 'Image too large. Please select an image under 8MB.' });
      return;
    }

    setIsUploadingProof(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.8);
            setSettleProof(compressed);
            showToast({ type: 'success', message: 'Receipt screenshot attached!' });
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch {
      showToast({ type: 'error', message: 'Failed to process receipt image.' });
    } finally {
      setIsUploadingProof(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleOpenSettleModal = (initialAmt?: number) => {
    if (!activeFriend) return;
    const defaultAmt = initialAmt !== undefined ? Math.abs(initialAmt) : Math.abs(currentBalance);
    setSettleAmount(defaultAmt > 0 ? String(defaultAmt) : '');
    setSettleDirection(currentBalance < 0 ? 'i_paid' : 'friend_paid');
    setSettleMethod('JazzCash');
    setSettleRefId('');
    setSettleProof(null);
    setSettleNote('');
    setShowSettleConfirmStep(false);
    setShowSettleModal(true);
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
    if (!activeFriend) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return;

    const isUserPaying = settleDirection === 'i_paid';
    setIsSubmittingSettle(true);
    try {
      await addLedgerEntry({
        friendId: activeFriend.uid,
        friendName: activeFriend.displayName,
        date: new Date().toISOString().split('T')[0],
        label: isUserPaying
          ? `Settled debt to ${activeFriend.displayName} via ${settleMethod}${settleRefId ? ` (Ref: ${settleRefId})` : ''}`
          : `Received payment from ${activeFriend.displayName} via ${settleMethod}${settleRefId ? ` (Ref: ${settleRefId})` : ''}`,
        amount: amt,
        type: 'payment',
        paymentDirection: isUserPaying ? 'paid_to_friend' : 'received_from_friend',
        payerId: isUserPaying ? currentUser.uid : activeFriend.uid,
        payerName: isUserPaying ? currentUser.displayName : activeFriend.displayName,
        recipientId: isUserPaying ? activeFriend.uid : currentUser.uid,
        recipientName: isUserPaying ? activeFriend.displayName : currentUser.displayName,
        paymentMethod: settleMethod,
        proofOfPayment: settleProof || undefined,
        note: settleNote.trim() || undefined,
        createdBy: currentUser.uid,
      });

      showToast({
        type: 'success',
        message: `${isUserPaying ? 'Paid debt of' : 'Recorded payment of'} ${formatPKR(amt)} with ${activeFriend.displayName}!`,
      });
      setShowSettleModal(false);
      setShowSettleConfirmStep(false);
    } catch {
      showToast({ type: 'error', message: 'Failed to record settlement.' });
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleCopyStatement = () => {
    if (!activeFriend) return;
    const chronological = [...friendEntries].reverse();
    const parts = chronological.map((e) => {
      const sign = e.amount < 0 || e.type === 'payment' ? '-' : '+';
      const abs = Math.abs(e.amount);
      return `${sign} ${abs} (${e.label})`;
    });

    const formula = parts.join(' ').replace(/^\+\s*/, '') || 'Rs 0';
    const shareUrl = getFriendShareUrl(activeFriend.uid);
    const text = `*Hisaab Statement for ${activeFriend.displayName}*\n${formula} = *${formatPKR(currentBalance)}*${
      shareUrl ? `\n\nLive Statement: ${shareUrl}` : ''
    }`;

    navigator.clipboard.writeText(text);
    showToast({ type: 'success', message: 'Statement copied in classic format.' });
  };

  const handleShareWhatsApp = () => {
    if (!activeFriend) return;
    const chronological = [...friendEntries].reverse();
    const parts = chronological.map((e) => {
      const sign = e.amount < 0 || e.type === 'payment' ? '-' : '+';
      const abs = Math.abs(e.amount);
      return `${sign} ${abs} (${e.label})`;
    });

    const formula = parts.join(' ').replace(/^\+\s*/, '') || 'Rs 0';
    const shareUrl = getFriendShareUrl(activeFriend.uid);
    const text = `*Hisaab Statement for ${activeFriend.displayName}*\n${formula} = *${formatPKR(currentBalance)}*${
      shareUrl ? `\n\nLive Statement: ${shareUrl}` : ''
    }`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyShareUrl = async () => {
    if (!activeFriend) return;
    let url = getFriendShareUrl(activeFriend.uid);
    if (!url) {
      url = await regenerateLink(activeFriend.uid);
    }
    navigator.clipboard.writeText(url);
    showToast({ type: 'success', message: 'Secure link copied (?s=<token>).' });
  };

  const handleExportPDF = async () => {
    if (!activeFriend) return;
    await exportFriendStatementPDF(activeFriend.displayName, currentBalance, friendEntries);
    showToast({ type: 'success', message: 'PDF statement downloaded.' });
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFriend) return;
    const val = parseFloat(adjustAmount);
    if (!adjustLabel.trim() || isNaN(val) || val === 0) return;

    const absVal = Math.abs(val);

    if (adjustType === 'payment') {
      // Direct payment from friend to user to clear balance
      await addLedgerEntry({
        friendId: activeFriend.uid,
        friendName: activeFriend.displayName,
        date: new Date().toISOString().split('T')[0],
        label: adjustLabel.trim(),
        amount: absVal,
        type: 'payment',
        paymentDirection: 'received_from_friend',
        payerId: activeFriend.uid,
        payerName: activeFriend.displayName,
        recipientId: currentUser.uid,
        recipientName: currentUser.displayName,
        createdBy: currentUser.uid,
      });
    } else if (adjustType === 'owes') {
      await addLedgerEntry({
        friendId: activeFriend.uid,
        friendName: activeFriend.displayName,
        date: new Date().toISOString().split('T')[0],
        label: adjustLabel.trim(),
        amount: absVal,
        type: 'owes',
        payerId: currentUser.uid,
        payerName: currentUser.displayName,
        recipientId: activeFriend.uid,
        recipientName: activeFriend.displayName,
        createdBy: currentUser.uid,
      });
    } else {
      await addLedgerEntry({
        friendId: activeFriend.uid,
        friendName: activeFriend.displayName,
        date: new Date().toISOString().split('T')[0],
        label: adjustLabel.trim(),
        amount: val,
        type: 'adjustment',
        createdBy: currentUser.uid,
      });
    }

    setAdjustAmount('');
    setAdjustLabel('');
    setShowAdjustModal(false);
    showToast({ type: 'success', message: 'Entry recorded in ledger.' });
  };

  const handleFriendSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(claimAmount);
    if (isNaN(num) || num <= 0) return;

    await submitPaymentClaim(num, claimNote);
    setClaimAmount('');
    setClaimNote('');
    setShowClaimModal(false);
    showToast({ type: 'success', message: 'Payment claim submitted for review.' });
  };

  const handleAddComment = async (entryId: string) => {
    if (!commentText.trim()) return;
    await addComment('ledger', entryId, commentText);
    setCommentText('');
    setActiveCommentEntryId(null);
  };

  const emojis = ['👍', '❤️', '😂', '😮', '🙏'];

  if (!activeFriend) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm font-semibold text-[#101828] dark:text-[#F2F4F7]">
          No friends connected yet
        </p>
        <p className="text-xs text-[#667085] dark:text-[#98A2B3]">
          Connect with friends to view statements and track mutual khata.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto">
      {/* Friend selector tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {friends.map((f) => {
          const isSelected = f.uid === activeFriendId;
          const bal = friendBalance(f.uid);
          const isOwedToMe = bal > 0;
          const isFriendSettled = bal === 0;

          return (
            <button
              key={f.uid}
              onClick={() => setActiveFriendId(f.uid)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer active-press shadow-xs ${
                isSelected
                  ? 'bg-[#4F46E5] text-white shadow-indigo-500/20'
                  : 'bg-white dark:bg-[#121826] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#1F293D] hover:border-indigo-300'
              }`}
            >
              <Avatar name={f.displayName} photoURL={f.photoURL} size="xs" />
              <span>{f.displayName.split(' ')[0]}</span>
              <span
                className={`tabular-nums text-[11px] font-bold ${
                  isSelected
                    ? 'text-white/90'
                    : isOwedToMe
                    ? 'text-[#12A150]'
                    : isFriendSettled
                    ? 'text-[#64748B] dark:text-[#94A3B8]'
                    : 'text-[#E5484D]'
                }`}
              >
                {isFriendSettled ? '0' : formatPKR(Math.abs(bal))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Friend Ledger Hero Card */}
      <Card padding="lg" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E7EC] dark:border-[#232B3E]">
          <div className="flex items-center gap-3.5">
            <Avatar
              name={activeFriend.displayName}
              photoURL={activeFriend.photoURL}
              size="lg"
              ring={isSettled ? 'none' : isOwed ? 'green' : 'red'}
              className="shadow-sm"
            />
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#101828] dark:text-[#F8FAFC]">
                {activeFriend.displayName}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                @{activeFriend.displayName.toLowerCase().replace(/\s+/g, '_')} • Itemized Khata & Payments
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] block">
              {isSettled
                ? 'All Balances Settled'
                : isOwed
                ? `${activeFriend.displayName.split(' ')[0]} Owes You`
                : `You Owe ${activeFriend.displayName.split(' ')[0]}`}
            </span>
            <span
              className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${
                isSettled
                  ? 'text-[#64748B] dark:text-[#94A3B8]'
                  : isOwed
                  ? 'text-[#12A150]'
                  : 'text-[#E5484D]'
              }`}
            >
              {isSettled ? 'Rs 0' : formatPKR(Math.abs(currentBalance))}
            </span>
          </div>
        </div>

        {/* 3-Stat Friend Breakdown Card */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#101626] border border-[#E2E8F0] dark:border-[#1F293D]">
            <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#4F46E5] dark:text-[#8B85FF]" />
              <span>{activeFriend.displayName.split(' ')[0]}'s Spent</span>
            </span>
            <span className="text-base sm:text-lg font-black text-[#101828] dark:text-[#F8FAFC] tabular-nums block pt-1">
              {formatPKR(friendPersonalSpending)}
            </span>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block pt-0.5 leading-tight">
              Their share in {friendSharedBillsCount} split bill{friendSharedBillsCount === 1 ? '' : 's'} (not total bill)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#101626] border border-[#E2E8F0] dark:border-[#1F293D]">
            <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#12A150]" />
              <span>Total Settled</span>
            </span>
            <span className="text-base sm:text-lg font-black text-[#12A150] tabular-nums block pt-1">
              {formatPKR(friendTotalSettled)}
            </span>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block pt-0.5 leading-tight">
              Total payment entries
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#101626] border border-[#E2E8F0] dark:border-[#1F293D] col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-amber-500" />
              <span>Current Status</span>
            </span>
            <span
              className={`text-base sm:text-lg font-black tabular-nums block pt-1 ${
                isSettled ? 'text-[#64748B]' : isOwed ? 'text-[#12A150]' : 'text-[#E5484D]'
              }`}
            >
              {isSettled ? 'Zero debt' : formatPKR(Math.abs(currentBalance))}
            </span>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block pt-0.5 leading-tight">
              {isSettled ? 'Clean slate' : isOwed ? 'Owed to you' : 'Debt owed by you'}
            </span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Settle Debt Button */}
          {!isSettled && (
            <Button
              variant={!isOwed ? 'danger' : 'primary'}
              size="md"
              onClick={() => handleOpenSettleModal()}
              icon={<Zap className="w-4 h-4" />}
            >
              {!isOwed ? `Pay Debt (${formatPKR(Math.abs(currentBalance))})` : 'Settle Balance'}
            </Button>
          )}

          <Button
            variant="outline"
            size="md"
            onClick={() => setShowAdjustModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add adjustment
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={() => sendNudge(activeFriend.uid)}
            icon={<Bell className="w-4 h-4 text-amber-500" />}
          >
            Nudge
          </Button>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Button
              variant="outline"
              size="md"
              onClick={handleCopyShareUrl}
              icon={<ExternalLink className="w-4 h-4" />}
              title="Copy secure public statement link"
            >
              Share link
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handleShareWhatsApp}
              icon={<Share2 className="w-4 h-4 text-emerald-600" />}
              title="Share statement on WhatsApp"
            >
              WhatsApp
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handleExportPDF}
              icon={<FileDown className="w-4 h-4 text-rose-500" />}
              title="Download PDF statement"
            >
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Ledger Entries List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Timeline of Entries ({friendEntries.length})
          </h3>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {isSettled ? 'All settled' : `Net: ${formatPKR(currentBalance)}`}
          </span>
        </div>

        <Card padding="none" className="divide-y divide-[#E4E7EC]/60 dark:divide-[#232B3E]/60">
          {friendEntries.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm font-semibold text-[#101828] dark:text-[#F8FAFC]">
                No ledger entries with {activeFriend.displayName} yet
              </p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Add an expense or record a payment to start tracking.
              </p>
            </div>
          ) : (
            friendEntries.map((entry) => {
              const isPaid = entry.type === 'payment';
              const isUserPaid = entry.paymentDirection === 'paid_to_friend' || (entry.payerId && entry.payerId === currentUser.uid);

              return (
                <div key={entry.id} className="p-4 sm:p-5 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#101828] dark:text-[#F8FAFC]">
                          {entry.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#12A150]'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-[#E5484D]'
                          }`}
                        >
                          {isPaid ? (isUserPaid ? 'Debt Paid' : 'Payment Received') : 'Owes'}
                        </span>
                        {entry.paymentMethod && (
                          <span className="text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            via {entry.paymentMethod}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] pt-0.5">
                        {formatShortDate(entry.date)} {entry.note ? `• ${entry.note}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {entry.proofOfPayment && (
                        <div
                          onClick={() => setActiveLightboxImage(entry.proofOfPayment || null)}
                          className="cursor-pointer group/receipt p-0.5"
                          title="View Payment Proof Receipt"
                        >
                          <img
                            src={entry.proofOfPayment}
                            alt="Receipt"
                            className="w-9 h-9 rounded-xl object-cover border border-[#E2E8F0] dark:border-[#1F293D] hover:opacity-80 transition shadow-xs"
                          />
                        </div>
                      )}

                      <span
                        className={`text-base font-extrabold tabular-nums ${
                          isPaid ? 'text-[#12A150]' : 'text-[#E5484D]'
                        }`}
                      >
                        {isPaid ? `-${formatPKR(entry.amount)}` : `+${formatPKR(entry.amount)}`}
                      </span>
                    </div>
                  </div>

                  {/* Comments & Reactions */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {emojis.map((emoji) => {
                        const count = reactions.filter(
                          (r) => r.targetId === entry.id && r.emoji === emoji
                        ).length;
                        return (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction('ledger', entry.id, emoji)}
                            className="text-xs p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <span>{emoji}</span> {count > 0 && <span className="text-[10px] font-bold text-[#64748B]">{count}</span>}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() =>
                        setActiveCommentEntryId(
                          activeCommentEntryId === entry.id ? null : entry.id
                        )
                      }
                      className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] hover:text-[#4F46E5] flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Comments ({comments.filter((c) => c.targetId === entry.id).length})</span>
                    </button>
                  </div>

                  {/* Comment Input */}
                  {activeCommentEntryId === entry.id && (
                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add note or verification comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(entry.id);
                        }}
                        className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-[#E2E8F0] dark:border-[#1F293D] bg-white dark:bg-[#121826]"
                      />
                      <Button size="sm" onClick={() => handleAddComment(entry.id)}>
                        Post
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* FORMAL SETTLEMENT & DEBT PAYMENT MODAL WITH PROOF & 2-STEP CONFIRMATION */}
      {showSettleModal && (
        <Modal
          isOpen={showSettleModal}
          onClose={() => {
            setShowSettleModal(false);
            setShowSettleConfirmStep(false);
          }}
          title={showSettleConfirmStep ? 'Review & Confirm Settlement' : `Settle Balance with ${activeFriend.displayName}`}
          size="md"
        >
          {!showSettleConfirmStep ? (
            /* STEP 1: Details, Amount & Proof of Payment */
            <form onSubmit={handleReviewSettle} className="space-y-4">
              {/* Direction Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                  Payment Direction
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] dark:bg-[#101626] p-1 rounded-2xl border border-[#E2E8F0] dark:border-[#1F293D]">
                  <button
                    type="button"
                    onClick={() => setSettleDirection('i_paid')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      settleDirection === 'i_paid'
                        ? 'bg-[#4F46E5] text-white shadow-sm'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#101828]'
                    }`}
                  >
                    <span>I paid {activeFriend.displayName.split(' ')[0]}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleDirection('friend_paid')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      settleDirection === 'friend_paid'
                        ? 'bg-[#12A150] text-white shadow-sm'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#101828]'
                    }`}
                  >
                    <span>{activeFriend.displayName.split(' ')[0]} paid me</span>
                  </button>
                </div>
              </div>

              {/* Status Info Box */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200">
                    {settleDirection === 'i_paid'
                      ? `Paying debt to ${activeFriend.displayName}`
                      : `Recording payment received from ${activeFriend.displayName}`}
                  </span>
                  <span className="font-bold text-[#64748B] dark:text-[#94A3B8]">
                    Current balance: {formatPKR(Math.abs(currentBalance))}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] pt-1">
                  This payment will be recorded into both ledgers and immediately reduce the outstanding balance towards zero.
                </p>
              </div>

              {/* Settle Amount */}
              <Input
                label="Settlement Amount (PKR)"
                type="number"
                step="any"
                required
                placeholder="e.g. 1500"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
              />

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettleMethod(m.id)}
                      className={`p-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer flex flex-col items-center gap-1 ${
                        settleMethod === m.id
                          ? 'border-[#4F46E5] bg-indigo-50/60 dark:bg-indigo-950/40 text-[#4F46E5] dark:text-[#8B85FF]'
                          : 'border-[#E2E8F0] dark:border-[#1F293D] text-[#64748B] dark:text-[#94A3B8] hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base">{m.icon}</span>
                      <span className="truncate w-full">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference / Transaction ID */}
              <Input
                label="Reference / Transaction ID (Optional)"
                placeholder="e.g. JazzCash TID # 982173456"
                value={settleRefId}
                onChange={(e) => setSettleRefId(e.target.value)}
              />

              {/* Proof of Payment Screenshot */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider flex items-center justify-between">
                  <span>Proof of Payment / Screenshot</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Recommended</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={settleFileInputRef}
                  onChange={handleProofChange}
                  className="hidden"
                />

                {settleProof ? (
                  <div className="border border-[#E2E8F0] dark:border-[#1F293D] rounded-2xl p-2.5 bg-[#F8FAFC] dark:bg-[#101626] flex items-center gap-3">
                    <img
                      src={settleProof}
                      alt="Proof"
                      className="w-14 h-14 object-cover rounded-xl border border-white/20 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">Receipt attached</p>
                      <p className="text-[11px] text-[#12A150] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ready for verification
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettleProof(null)}
                      className="p-1.5 text-[#64748B] hover:text-[#E5484D] rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => settleFileInputRef.current?.click()}
                    disabled={isUploadingProof}
                    className="w-full border-2 border-dashed border-[#E2E8F0] dark:border-[#1F293D] rounded-2xl p-3 flex items-center justify-center gap-2 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] hover:border-[#4F46E5] hover:text-[#4F46E5] transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isUploadingProof ? 'Compressing receipt...' : 'Upload receipt screenshot or camera photo'}</span>
                  </button>
                )}
              </div>

              {/* Note */}
              <Input
                label="Note / Memo"
                placeholder="e.g. Samosa and chai balance clearance"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setShowSettleModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Review Details
                </Button>
              </div>
            </form>
          ) : (
            /* STEP 2: Strict Review & Confirmation Dialog */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    Confirm Settlement Payment
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Please verify the details below. Once confirmed, this transaction is recorded and the balance between you and {activeFriend.displayName} is officially updated.
                  </p>
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#101626] border border-[#E2E8F0] dark:border-[#1F293D] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]/60 dark:border-[#1F293D]/60">
                  <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Settlement Amount</span>
                  <span className="text-xl font-black text-[#101828] dark:text-[#F8FAFC] tabular-nums">
                    {formatPKR(parseFloat(settleAmount) || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Payer</span>
                    <span className="font-bold text-[#101828] dark:text-[#F8FAFC]">
                      {settleDirection === 'i_paid' ? currentUser.displayName : activeFriend.displayName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Recipient</span>
                    <span className="font-bold text-[#101828] dark:text-[#F8FAFC]">
                      {settleDirection === 'i_paid' ? activeFriend.displayName : currentUser.displayName}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Method</span>
                    <span className="font-semibold text-[#101828] dark:text-[#F8FAFC]">{settleMethod}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Reference #</span>
                    <span className="font-semibold text-[#101828] dark:text-[#F8FAFC]">{settleRefId || 'None provided'}</span>
                  </div>
                </div>

                {settleProof && (
                  <div className="pt-2 border-t border-[#E2E8F0]/60 dark:border-[#1F293D]/60 flex items-center gap-2.5">
                    <img
                      src={settleProof}
                      alt="Proof Receipt"
                      className="w-12 h-12 object-cover rounded-xl border border-[#E2E8F0] dark:border-[#1F293D]"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[#12A150] flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Proof Receipt Attached
                      </span>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Will be saved into statement</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setShowSettleConfirmStep(false)}
                  disabled={isSubmittingSettle}
                >
                  Back to Edit
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleFinalizeSettle}
                  isLoading={isSubmittingSettle}
                  icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                >
                  Confirm & Clear Debt
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* LIGHTBOX MODAL FOR RECEIPT PROOFS */}
      {activeLightboxImage && (
        <div
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl max-h-[90vh] flex flex-col items-center bg-[#131A2D] rounded-3xl p-3 border border-[#202B45] shadow-2xl"
          >
            <div className="w-full flex items-center justify-between pb-2 px-1 text-white">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#4F46E5]" /> Proof of Payment
              </span>
              <button
                type="button"
                onClick={() => setActiveLightboxImage(null)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={activeLightboxImage}
              alt="Payment receipt proof"
              className="max-h-[80vh] w-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Manual Adjustment Modal */}
      {showAdjustModal && (
        <Modal
          isOpen={showAdjustModal}
          onClose={() => setShowAdjustModal(false)}
          title={`Add adjustment for ${activeFriend.displayName}`}
          size="sm"
        >
          <form onSubmit={handleCreateAdjustment} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] block mb-1">
                Entry Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAdjustType('owes')}
                  className={`py-2 px-3 border rounded-xl text-xs font-bold cursor-pointer transition ${
                    adjustType === 'owes'
                      ? 'bg-[#4F46E5] text-white border-[#4F46E5]'
                      : 'border-[#E2E8F0] dark:border-[#1F293D] text-[#64748B]'
                  }`}
                >
                  Friend owes
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('payment')}
                  className={`py-2 px-3 border rounded-xl text-xs font-bold cursor-pointer transition ${
                    adjustType === 'payment'
                      ? 'bg-[#12A150] text-white border-[#12A150]'
                      : 'border-[#E2E8F0] dark:border-[#1F293D] text-[#64748B]'
                  }`}
                >
                  Payment
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('adjustment')}
                  className={`py-2 px-3 border rounded-xl text-xs font-bold cursor-pointer transition ${
                    adjustType === 'adjustment'
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'border-[#E2E8F0] dark:border-[#1F293D] text-[#64748B]'
                  }`}
                >
                  Adjustment
                </button>
              </div>
            </div>

            <Input
              label="Description / Reason"
              required
              placeholder="e.g. Samosa share, Token discount"
              value={adjustLabel}
              onChange={(e) => setAdjustLabel(e.target.value)}
            />

            <Input
              label="Amount (PKR)"
              type="number"
              step="any"
              required
              placeholder="e.g. 500"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="md" onClick={() => setShowAdjustModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md">
                Save Entry
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
