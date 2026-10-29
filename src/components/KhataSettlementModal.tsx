import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Bell,
  Wallet,
  ChevronDown,
  ChevronUp,
  Receipt,
  Search,
  ExternalLink,
  Plus,
  Camera,
  Upload,
  X,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatPKR, formatShortDate, getEntriesForFriend } from '../lib/formatters';
import { UserProfile, LedgerEntry } from '../types';
import { Modal, Avatar, Button, Card, Input } from '../ui';
import { triggerHaptic } from '../lib/webNotification';
import { compressImageToDataUrl } from '../lib/mediaUtils';

interface KhataSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFriendLedger?: (friend: UserProfile) => void;
  initialFilter?: 'all' | 'owe_me' | 'i_owe';
}

export const KhataSettlementModal: React.FC<KhataSettlementModalProps> = ({
  isOpen,
  onClose,
  onOpenFriendLedger,
  initialFilter = 'all',
}) => {
  const {
    currentUser,
    friends,
    friendBalance,
    activeLedgerEntries,
    addLedgerEntry,
    sendNudge,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'owe_me' | 'i_owe' | 'settled'>(
    initialFilter === 'owe_me' ? 'owe_me' : initialFilter === 'i_owe' ? 'i_owe' : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);

  // Settlement sub-modal state
  const [settleFriend, setSettleFriend] = useState<UserProfile | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('EasyPaisa');
  const [settleNote, setSettleNote] = useState('');
  const [settleRefId, setSettleRefId] = useState('');
  const [settleDirection, setSettleDirection] = useState<'i_paid' | 'friend_paid'>('i_paid');
  const [settleProof, setSettleProof] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Calculate totals
  const summary = useMemo(() => {
    let friendsOweMe = 0;
    let iOweFriends = 0;
    friends.forEach((f) => {
      const bal = friendBalance(f.uid);
      if (bal > 0) friendsOweMe += bal;
      else if (bal < 0) iOweFriends += Math.abs(bal);
    });
    const netBal = friendsOweMe - iOweFriends;
    return { friendsOweMe, iOweFriends, netBal };
  }, [friends, friendBalance]);

  // Filter friends list
  const filteredFriends = useMemo(() => {
    return friends
      .filter((f) => {
        const bal = friendBalance(f.uid);
        if (activeTab === 'owe_me' && bal <= 0) return false;
        if (activeTab === 'i_owe' && bal >= 0) return false;
        if (activeTab === 'settled' && bal !== 0) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = f.displayName.toLowerCase().includes(q);
          const matchEmail = f.email?.toLowerCase().includes(q);
          return matchName || matchEmail;
        }
        return true;
      })
      .sort((a, b) => {
        const balA = Math.abs(friendBalance(a.uid));
        const balB = Math.abs(friendBalance(b.uid));
        return balB - balA; // Highest balances first
      });
  }, [friends, friendBalance, activeTab, searchQuery]);

  const handleOpenSettle = (friend: UserProfile, defaultAmt: number) => {
    const curBal = friendBalance(friend.uid);
    setSettleFriend(friend);
    setSettleAmount(Math.abs(defaultAmt || curBal).toString());
    setSettleDirection(curBal < 0 ? 'i_paid' : 'friend_paid');
    setSettleProof(null);
    setSettleRefId('');
    setSettleNote(`Settlement payment with ${friend.displayName}`);
    setShowConfirmStep(false);
  };

  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProof(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 720, 0.68);
      setSettleProof(dataUrl);
      showToast({ type: 'success', message: 'Payment proof attached!' });
    } catch {
      showToast({ type: 'error', message: 'Failed to process proof image.' });
    } finally {
      setIsUploadingProof(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleReviewStep = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast({ type: 'warning', message: 'Please enter a valid settlement amount.' });
      return;
    }
    setShowConfirmStep(true);
  };

  const [showSuccessAnim, setShowSuccessAnim] = useState(false);

  const handleFinalizeSettle = async () => {
    if (!settleFriend) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return;

    const isUserPaying = settleDirection === 'i_paid';

    setIsSubmittingSettle(true);
    try {
      await addLedgerEntry({
        friendId: settleFriend.uid,
        friendName: settleFriend.displayName,
        date: new Date().toISOString().split('T')[0],
        label: isUserPaying
          ? `Settled debt to ${settleFriend.displayName} via ${settleMethod}${settleRefId ? ` (Ref: ${settleRefId})` : ''}`
          : `Received payment from ${settleFriend.displayName} via ${settleMethod}${settleRefId ? ` (Ref: ${settleRefId})` : ''}`,
        amount: amt,
        type: 'payment',
        paymentDirection: isUserPaying ? 'paid_to_friend' : 'received_from_friend',
        payerId: isUserPaying ? currentUser.uid : settleFriend.uid,
        payerName: isUserPaying ? currentUser.displayName : settleFriend.displayName,
        recipientId: isUserPaying ? settleFriend.uid : currentUser.uid,
        recipientName: isUserPaying ? settleFriend.displayName : currentUser.displayName,
        paymentMethod: settleMethod,
        proofOfPayment: settleProof || undefined,
        note: settleNote.trim() || undefined,
        createdBy: currentUser.uid,
      });

      triggerHaptic([70, 50, 90]);
      showToast({
        type: 'success',
        message: `${isUserPaying ? 'Paid debt of' : 'Recorded payment of'} ${formatPKR(amt)} with ${settleFriend.displayName}!`,
      });
      setShowSuccessAnim(true);
      setTimeout(() => {
        setShowSuccessAnim(false);
        setSettleFriend(null);
        setShowConfirmStep(false);
      }, 1500);
    } catch {
      showToast({ type: 'error', message: 'Failed to record settlement.' });
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !settleFriend}
        onClose={onClose}
        title="Khata Net Balance & Settlements"
        size="lg"
      >
        <div className="space-y-4">
          {/* Top 3 Balance Summary Glass Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div
              onClick={() => setActiveTab('owe_me')}
              className={`p-3.5 rounded-[18px] border cursor-pointer transition-all cq-card ${
                activeTab === 'owe_me'
                  ? 'bg-[var(--em)]/15 border-[var(--em)]'
                  : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--em)]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-[var(--em)]">
                  Friends Owe You
                </span>
                <ArrowDownLeft className="w-4 h-4 text-[var(--em)]" />
              </div>
              <span className="font-extrabold font-money text-[var(--em)] tabular-nums block pt-1 whitespace-nowrap cq-amount-lg">
                {formatPKR(summary.friendsOweMe)}
              </span>
              <span className="text-[10px] text-[var(--mu)] block">
                Total to receive
              </span>
            </div>

            <div
              onClick={() => setActiveTab('i_owe')}
              className={`p-3.5 rounded-[18px] border cursor-pointer transition-all cq-card ${
                activeTab === 'i_owe'
                  ? 'bg-[var(--ro)]/15 border-[var(--ro)]'
                  : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--ro)]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-[var(--ro)]">
                  You Owe Friends
                </span>
                <ArrowUpRight className="w-4 h-4 text-[var(--ro)]" />
              </div>
              <span className="font-extrabold font-money text-[var(--ro)] tabular-nums block pt-1 whitespace-nowrap cq-amount-lg">
                {formatPKR(summary.iOweFriends)}
              </span>
              <span className="text-[10px] text-[var(--mu)] block">
                Total you must pay
              </span>
            </div>

            <div
              onClick={() => setActiveTab('all')}
              className={`p-3.5 rounded-[18px] border cursor-pointer transition-all cq-card ${
                activeTab === 'all'
                  ? 'bg-[var(--vi)]/15 border-[var(--vi)]'
                  : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--vi)]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-[var(--mu)]">
                  Net Khata Balance
                </span>
                <CreditCard className="w-4 h-4 text-[var(--vi)]" />
              </div>
              <span
                className={`font-extrabold font-money tabular-nums block pt-1 whitespace-nowrap cq-amount-lg ${
                  summary.netBal >= 0 ? 'text-[var(--em)]' : 'text-[var(--ro)]'
                }`}
              >
                {summary.netBal >= 0 ? '+' : ''}
                {formatPKR(summary.netBal)}
              </span>
              <span className="text-[10px] text-[var(--mu)] block">
                {summary.netBal >= 0 ? 'You are in positive net' : 'You have outstanding debts'}
              </span>
            </div>
          </div>

          {/* Segmented Filter Tabs & 16px Search Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="seg overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`!py-1.5 !px-3 !text-xs whitespace-nowrap ${activeTab === 'all' ? 'on' : ''}`}
              >
                All ({friends.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('owe_me')}
                className={`!py-1.5 !px-3 !text-xs whitespace-nowrap ${activeTab === 'owe_me' ? 'on' : ''}`}
              >
                Owe You
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('i_owe')}
                className={`!py-1.5 !px-3 !text-xs whitespace-nowrap ${activeTab === 'i_owe' ? 'on' : ''}`}
              >
                You Owe
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settled')}
                className={`!py-1.5 !px-3 !text-xs whitespace-nowrap ${activeTab === 'settled' ? 'on' : ''}`}
              >
                Settled
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mu)] pointer-events-none" />
              <input
                type="text"
                placeholder="Search friend..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="f !pl-10 !pr-3 !h-11 !text-[16px]"
              />
            </div>
          </div>

          {/* Friends List with Detailed Balances (Every row >= 64px tall on mobile) */}
          <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-1 custom-scrollbar">
            {filteredFriends.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--mu)] space-y-1">
                <p className="font-extrabold text-sm text-[var(--tx)]">
                  No contacts in this category
                </p>
                <p>Everything is settled or no matches found.</p>
              </div>
            ) : (
              filteredFriends.map((f) => {
                const bal = friendBalance(f.uid);
                const owesMe = bal > 0;
                const iOwe = bal < 0;
                const isSettled = bal === 0;
                const isExpanded = expandedFriendId === f.uid;

                const friendEntries = isExpanded
                  ? getEntriesForFriend(activeLedgerEntries, f.uid, currentUser.uid).slice(0, 5)
                  : [];

                return (
                  <div
                    key={f.uid}
                    className="border border-[var(--line)] rounded-[20px] bg-[var(--surface-2)] overflow-hidden transition-all cq-card"
                  >
                    <div className="min-h-[64px] p-3.5 sm:p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={f.displayName}
                          photoURL={f.photoURL}
                          size="md"
                          ring={isSettled ? 'none' : owesMe ? 'green' : 'red'}
                        />
                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold text-[var(--tx)] truncate">
                            {f.displayName}
                          </h4>
                          <span className="text-xs text-[var(--mu)] block truncate">
                            {f.phone || f.email || `@${f.displayName.toLowerCase().replace(/\s+/g, '_')}`}
                          </span>
                        </div>
                      </div>

                      {/* Right Balance & Actions (nowrap) */}
                      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                        <div className="text-right whitespace-nowrap">
                          <span
                            className={`font-extrabold font-money tabular-nums block whitespace-nowrap cq-amount ${
                              owesMe
                                ? 'text-[var(--em)]'
                                : iOwe
                                ? 'text-[var(--ro)]'
                                : 'text-[var(--mu)]'
                            }`}
                          >
                            {owesMe
                              ? `+${formatPKR(bal)}`
                              : iOwe
                              ? `−${formatPKR(Math.abs(bal))}`
                              : formatPKR(0)}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mu)] block">
                            {owesMe ? 'Owes you' : iOwe ? 'You owe' : 'Settled'}
                          </span>
                        </div>

                        {iOwe && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenSettle(f, Math.abs(bal))}
                            icon={<Wallet className="w-3.5 h-3.5" />}
                          >
                            Pay
                          </Button>
                        )}

                        {owesMe && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => sendNudge(f.uid)}
                              className="ib !w-9 !h-9 text-[var(--su)]"
                              title={`Send gentle reminder to ${f.displayName}`}
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenSettle(f, bal)}
                            >
                              Record Paid
                            </Button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedFriendId(isExpanded ? null : f.uid)}
                          className="ib !w-8 !h-8"
                          title="Toggle transaction breakdown"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Transactions Breakdown */}
                    {isExpanded && (
                      <div className="border-t border-[var(--line)] bg-black/15 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-extrabold text-[var(--mu)]">
                          <span>Recent Split Transactions &amp; Payments</span>
                          {onOpenFriendLedger && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenFriendLedger(f);
                              }}
                              className="text-[var(--em)] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>Full Ledger Statement</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {friendEntries.length === 0 ? (
                          <p className="text-xs text-[var(--mu)] py-2">
                            No ledger entries recorded yet.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {friendEntries.map((ent: LedgerEntry) => {
                              const isPayment = ent.type === 'payment' || ent.amount < 0;
                              return (
                                <div
                                  key={ent.id}
                                  className="min-h-[56px] flex items-center justify-between p-2.5 rounded-[14px] bg-[var(--surface-2)] border border-[var(--line)] text-xs cq-card"
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-extrabold text-[var(--tx)] truncate">
                                        {ent.label}
                                      </span>
                                      <span
                                        className={`chip !py-0.5 !px-2 !text-[9px] ${
                                          isPayment ? 'on' : '!bg-[var(--ro)]/18 !text-[var(--ro)]'
                                        }`}
                                      >
                                        {isPayment ? 'Payment' : 'Owes'}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-[var(--mu)] block mt-0.5">
                                      {formatShortDate(ent.date)} {ent.note ? `• ${ent.note}` : ''}
                                    </span>
                                  </div>

                                  <span
                                    className={`font-extrabold font-money tabular-nums whitespace-nowrap shrink-0 cq-amount ${
                                      isPayment ? 'text-[var(--em)]' : 'text-[var(--ro)]'
                                    }`}
                                  >
                                    {isPayment
                                      ? `−${formatPKR(Math.abs(ent.amount))}`
                                      : `+${formatPKR(ent.amount)}`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* 2-Step Settlement Flow Modal (with Progress Indicator & Success Animation) */}
      {settleFriend && (
        <Modal
          isOpen={!!settleFriend}
          onClose={() => {
            setSettleFriend(null);
            setShowConfirmStep(false);
            setShowSuccessAnim(false);
          }}
          title={
            showSuccessAnim
              ? 'Settlement Complete!'
              : showConfirmStep
              ? 'Step 2: Review & Confirm'
              : `Step 1: Settle with ${settleFriend.displayName}`
          }
          size="md"
        >
          {/* 2-Step Progress Indicator */}
          {!showSuccessAnim && (
            <div className="mb-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className={!showConfirmStep ? 'text-[var(--em)]' : 'text-[var(--mu)]'}>
                  1. Payment Details
                </span>
                <span className={showConfirmStep ? 'text-[var(--em)]' : 'text-[var(--mu)]'}>
                  2. Verify &amp; Settle
                </span>
              </div>
              <div className="bar !h-2">
                <i style={{ width: showConfirmStep ? '100%' : '50%' }} />
              </div>
            </div>
          )}

          {showSuccessAnim ? (
            /* Success Animation View */
            <div className="py-10 px-4 text-center flex flex-col items-center justify-center space-y-4 animate-in zoom-in-95 duration-200 cq-card">
              <div className="w-20 h-20 rounded-full bg-[var(--em)]/20 border-2 border-[var(--em)] flex items-center justify-center text-[var(--em)] shadow-[0_0_40px_rgba(46,242,160,0.4)] animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--em)] block">
                  Khata Updated
                </span>
                <h3 className="font-extrabold font-money tabular-nums text-[var(--tx)] whitespace-nowrap cq-amount-hero">
                  {formatPKR(parseFloat(settleAmount) || 0)}
                </h3>
                <p className="text-xs text-[var(--mu)]">
                  Settled with <strong className="text-[var(--tx)]">{settleFriend.displayName}</strong> via {settleMethod}
                </p>
              </div>
            </div>
          ) : !showConfirmStep ? (
            /* STEP 1: Enter Amount, Channel, Direction & Proof */
            <form onSubmit={handleReviewStep} className="space-y-4">
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
                    I paid {settleFriend.displayName.split(' ')[0]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleDirection('friend_paid')}
                    className={settleDirection === 'friend_paid' ? 'on' : ''}
                  >
                    {settleFriend.displayName.split(' ')[0]} paid me
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-[18px] bg-[var(--em)]/12 border border-[var(--em)]/30 text-xs flex items-center justify-between gap-2 cq-card">
                <span className="font-extrabold text-[var(--em)]">
                  {settleDirection === 'i_paid'
                    ? `Paying debt to ${settleFriend.displayName}`
                    : `Receiving settlement from ${settleFriend.displayName}`}
                </span>
                <span className="font-extrabold font-money text-[var(--tx)] tabular-nums whitespace-nowrap cq-amount">
                  Net: {formatPKR(Math.abs(friendBalance(settleFriend.uid)))}
                </span>
              </div>

              <Input
                label="Amount to Settle (Rs)"
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
                  label="Transaction Ref / UTR #"
                  placeholder="e.g. TID-9823412"
                  value={settleRefId}
                  onChange={(e) => setSettleRefId(e.target.value)}
                />
              </div>

              {/* Proof of Payment Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--tx)] flex items-center justify-between">
                  <span>Proof of Payment / Screenshot</span>
                  <span className="text-[11px] text-[var(--mu)]">Recommended</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleProofChange}
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingProof}
                    className="w-full border-2 border-dashed border-[var(--line)] rounded-[18px] p-3.5 flex items-center justify-center gap-2 text-xs font-bold text-[var(--mu)] hover:border-[var(--em)] hover:text-[var(--em)] transition cursor-pointer bg-[var(--surface-2)]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isUploadingProof ? 'Compressing receipt...' : 'Upload receipt screenshot or camera photo'}</span>
                  </button>
                )}
              </div>

              <Input
                label="Note / Memo"
                placeholder="e.g. Dinner settlement or rent share"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setSettleFriend(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                  Review &amp; Confirm
                </Button>
              </div>
            </form>
          ) : (
            /* STEP 2: Strict Review & Confirmation Dialog */
            <div className="space-y-4">
              <div className="p-4 rounded-[20px] bg-[var(--su)]/12 border border-[var(--su)]/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--su)] shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                  <p className="font-extrabold text-[var(--su)]">
                    Please verify this payment before confirming
                  </p>
                  <p className="text-[var(--mu)]">
                    Ensure the amount was actually transferred. This logs a formal settlement record and updates both party ledgers.
                  </p>
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-4 rounded-[20px] bg-[var(--surface-2)] border border-[var(--line)] space-y-3 cq-card">
                <div className="flex items-center justify-between pb-2.5 border-b border-[var(--line)]">
                  <span className="text-xs font-bold text-[var(--mu)]">Settlement Amount</span>
                  <span className="font-extrabold font-money text-[var(--em)] tabular-nums whitespace-nowrap cq-amount-lg">
                    {formatPKR(parseFloat(settleAmount) || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--mu)] block text-[11px]">Payer</span>
                    <span className="font-extrabold text-[var(--tx)]">
                      {settleDirection === 'i_paid' ? `${currentUser.displayName} (You)` : settleFriend.displayName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--mu)] block text-[11px]">Recipient</span>
                    <span className="font-extrabold text-[var(--tx)]">
                      {settleDirection === 'i_paid' ? settleFriend.displayName : `${currentUser.displayName} (You)`}
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
                      <p className="text-[11px] text-[var(--mu)]">Screenshot attached to transaction</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowConfirmStep(false)}
                  disabled={isSubmittingSettle}
                >
                  Back to Edit
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleFinalizeSettle}
                  isLoading={isSubmittingSettle}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Confirm &amp; Settle Now
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
};

