import React, { useState, useEffect } from 'react';
import { Expense, ExpenseActivityEntry } from '../types';
import { useApp } from '../context/AppContext';
import { formatPKR, formatShortDate, formatFullDateTime } from '../lib/formatters';
import { Avatar, Sheet } from '../ui';
import { CATEGORY_STYLES } from './Dashboard';
import { EditExpenseModal } from './QuickAddModal';
import {
  Receipt,
  Calendar,
  User,
  Users,
  Utensils,
  Clock,
  MapPin,
  FileText,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Lock,
  Flag,
  AlertTriangle,
  History,
} from 'lucide-react';

interface TransactionDetailModalProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (expense: Expense) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  expense,
  isOpen,
  onClose,
}) => {
  const {
    currentUser,
    allUsers,
    activeLedgerEntries,
    deleteExpense,
    disputeExpense,
    resolveExpenseDispute,
    isOwnerMode,
    activeExpenses,
    trashExpenses,
  } = useApp();

  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  const liveExpense =
    activeExpenses.find((e) => e.id === expense?.id) ||
    trashExpenses.find((e) => e.id === expense?.id) ||
    expense;

  useEffect(() => {
    if (!isOpen) {
      setIsEditingModalOpen(false);
      setShowDisputeForm(false);
      setDisputeNote('');
    }
  }, [isOpen]);

  if (!liveExpense || !isOpen) return null;

  const style = CATEGORY_STYLES[liveExpense.category] || CATEGORY_STYLES.Other;
  const isMePayer =
    liveExpense.paidBy === 'me' || liveExpense.paidBy === currentUser.uid;
  const payerProfile = isMePayer
    ? currentUser
    : allUsers.find((u) => u.uid === liveExpense.paidBy);
  const payerName = isMePayer
    ? `${currentUser.displayName} (You)`
    : liveExpense.paidByName || payerProfile?.displayName || 'Friend';

  const splits = liveExpense.splits || [];
  const isSplitBill =
    splits.length > 0 &&
    splits.some((s) => s.userId !== liveExpense.createdBy);

  const isCreator = liveExpense.createdBy === currentUser.uid;
  const isInSplit = splits.some((s) => s.userId === currentUser.uid);

  const canEdit = isOwnerMode || isCreator || isMePayer || isInSplit;
  const canDelete = isSplitBill
    ? isOwnerMode || isCreator
    : isOwnerMode || isCreator || isMePayer;

  const isDisputed = liveExpense.dispute?.status === 'disputed';
  const canResolveDispute = isOwnerMode || isCreator || isMePayer || isInSplit;

  const linkedLedgerEntries = activeLedgerEntries.filter(
    (l) => l.refExpenseId === liveExpense.id
  );

  // Build complete activity log for shared expenses (synthesizing fallback entries if older expense)
  const activityTimeline: ExpenseActivityEntry[] = (() => {
    const existing = Array.isArray(liveExpense.activityLog)
      ? [...liveExpense.activityLog]
      : [];
    if (existing.length === 0) {
      existing.push({
        id: `init-${liveExpense.id}`,
        action: 'added',
        byUid: liveExpense.createdBy,
        byName: liveExpense.createdByName || payerName,
        timestamp: liveExpense.date,
        note: `Created ${liveExpense.title} (${formatPKR(liveExpense.amount)})`,
      });
      if ((liveExpense as any).updatedAt) {
        existing.push({
          id: `upd-${liveExpense.id}`,
          action: 'edited',
          byUid: (liveExpense as any).updatedBy || liveExpense.createdBy,
          byName: (liveExpense as any).updatedByName || 'Member',
          timestamp: (liveExpense as any).updatedAt,
          note: 'Updated expense details',
        });
      }
    }
    return existing;
  })();

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeNote.trim()) return;
    setIsSubmittingDispute(true);
    try {
      await disputeExpense(liveExpense.id, disputeNote.trim());
      setDisputeNote('');
      setShowDisputeForm(false);
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleResolveDispute = async () => {
    setIsSubmittingDispute(true);
    try {
      await resolveExpenseDispute(liveExpense.id, 'Dispute marked as resolved');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  if (isEditingModalOpen) {
    return (
      <EditExpenseModal
        expense={liveExpense}
        isOpen={true}
        onClose={() => setIsEditingModalOpen(false)}
      />
    );
  }

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title="Transaction Breakdown"
      >
        <div className="space-y-4">
          {/* Top Hero Glass Card */}
          <div className={`card ${isDisputed ? 't-ro' : 't-em'} text-center space-y-2.5 relative overflow-hidden cq-card`}>
            <div className="mx-auto flex items-center justify-center">
              <span
                className="ct !w-12 !h-12 !text-xl"
                style={{ '--c': style.color } as React.CSSProperties}
              >
                {style.icon}
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
              <span className="chip !h-6 !px-2.5 !text-xs">
                {liveExpense.category}
              </span>
              <span
                className={`chip !h-6 !px-2.5 !text-xs ${
                  isSplitBill ? 'g' : ''
                }`}
              >
                {isSplitBill
                  ? `Split (${
                      liveExpense.splitType === 'equal'
                        ? 'Equal'
                        : liveExpense.splitType === 'friend_full'
                        ? 'They owe full'
                        : 'Custom'
                    })`
                  : 'Personal'}
              </span>
              {isDisputed && (
                <span className="chip r !h-6 !px-2.5 !text-xs font-extrabold">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  Disputed
                </span>
              )}
            </div>

            <h3 className="text-xl font-extrabold font-heading text-[var(--tx)] break-words pt-0.5">
              {liveExpense.title}
            </h3>

            <div className="font-extrabold font-heading text-[var(--em)] num whitespace-nowrap text-[clamp(1.5rem,7cqw,2.15rem)] leading-tight">
              {formatPKR(liveExpense.amount)}
            </div>

            <div className="flex items-center justify-center gap-3 text-xs text-[var(--mu)] pt-1 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[var(--em)]" />
                {formatShortDate(liveExpense.date)} ({liveExpense.date})
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--em)]" />
                By {liveExpense.createdByName || payerName}
              </span>
            </div>

            {(liveExpense as any).updatedAt && (
              <p className="text-[11px] text-[var(--mu)] pt-0.5">
                Last edited{' '}
                {(liveExpense as any).updatedByName
                  ? `by ${(liveExpense as any).updatedByName}`
                  : ''}{' '}
                on {new Date((liveExpense as any).updatedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Disputed Alert Banner (when flagged) */}
          {isDisputed && liveExpense.dispute && (
            <div className="card !p-4 !bg-[var(--ro)]/12 !border-[var(--ro)]/40 space-y-3 cq-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-[12px] bg-[var(--ro)]/20 text-[var(--ro)] flex items-center justify-center shrink-0">
                    <Flag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-[var(--ro)] uppercase tracking-wider">
                        Disputed by {liveExpense.dispute.flaggedByName}
                      </span>
                      <span className="text-[11px] text-[var(--mu)]">
                        {formatFullDateTime(liveExpense.dispute.flaggedAt)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[var(--tx)] mt-1 break-words">
                      &ldquo;{liveExpense.dispute.note}&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              {canResolveDispute && (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    disabled={isSubmittingDispute}
                    onClick={handleResolveDispute}
                    className="btn sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Resolve Dispute</span>
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditingModalOpen(true)}
                      className="btn s sm"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[var(--em)]" />
                      <span>Edit &amp; Auto-Resolve</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Flag / Dispute Expense Form (available on shared expenses when not currently disputed) */}
          {isSplitBill && !liveExpense.deleted && !isDisputed && (
            <div className="card !p-4 space-y-3 cq-card">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Flag className="w-4 h-4 text-[var(--ro)] shrink-0" />
                  <span className="text-xs font-bold text-[var(--tx)] truncate">
                    Something wrong with this split?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDisputeForm(!showDisputeForm)}
                  className="btn s sm !text-[var(--ro)] shrink-0"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{showDisputeForm ? 'Cancel' : 'Dispute expense'}</span>
                </button>
              </div>

              {showDisputeForm && (
                <form onSubmit={handleSubmitDispute} className="space-y-2.5 pt-1">
                  <input
                    type="text"
                    value={disputeNote}
                    onChange={(e) => setDisputeNote(e.target.value)}
                    placeholder="Short note (e.g. Amount was Rs 800, or I wasn't there)"
                    className="inp !text-[16px]"
                    maxLength={140}
                    required
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="submit"
                      disabled={isSubmittingDispute || !disputeNote.trim()}
                      className="btn sm !bg-[var(--ro)] !text-white"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>{isSubmittingDispute ? 'Flagging...' : 'Send Dispute Flag'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Who Paid Glass Card */}
          <div className="card !p-4 space-y-2.5 cq-card">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[var(--em)]" /> Paid By (Bill Payer)
            </div>
            <div className="min-h-[64px] px-3.5 py-2.5 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  name={payerName}
                  photoURL={payerProfile?.photoURL}
                  size="sm"
                  ring="green"
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--tx)] truncate">
                    {payerName}
                  </div>
                  <div className="text-xs text-[var(--mu)] truncate">
                    Paid the full bill of <span className="num whitespace-nowrap font-semibold text-[var(--tx)]">{formatPKR(liveExpense.amount)}</span>
                  </div>
                </div>
              </div>
              <span className="chip g !h-6 !px-2.5 !text-[11px] shrink-0">
                Payer
              </span>
            </div>
          </div>

          {/* Per-Participant Split Breakdown Glass Card */}
          <div className="card !p-4 space-y-3 cq-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[var(--vi)]" /> Per-Person Breakdown
              </span>
              <span className="chip !h-6 !px-2.5 !text-[11px]">
                {splits.length > 0 ? `${splits.length} Participant(s)` : 'Solo'}
              </span>
            </div>

            {splits.length === 0 ? (
              <div className="min-h-[64px] px-3.5 py-2.5 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3 cq-card">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    name={payerName}
                    photoURL={payerProfile?.photoURL}
                    size="sm"
                  />
                  <span className="text-xs font-bold text-[var(--tx)] truncate">
                    {payerName} (Personal)
                  </span>
                </div>
                <span className="text-[clamp(0.875rem,3.8cqw,1rem)] font-extrabold font-heading num whitespace-nowrap text-[var(--tx)] shrink-0">
                  {formatPKR(liveExpense.amount)}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {splits.map((s, idx) => {
                  const isParticipantPayer =
                    s.userId === liveExpense.paidBy ||
                    (liveExpense.paidBy === 'me' && s.userId === liveExpense.createdBy);
                  const participantProfile = allUsers.find(
                    (u) => u.uid === s.userId
                  );
                  const pct =
                    liveExpense.amount > 0
                      ? Math.round((s.share / liveExpense.amount) * 100)
                      : 0;

                  return (
                    <div
                      key={`${s.userId}-${idx}`}
                      className="min-h-[64px] px-3.5 py-2.5 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3 cq-card"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={s.userName}
                          photoURL={participantProfile?.photoURL}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--tx)] flex items-center gap-1.5 truncate">
                            <span className="truncate">
                              {s.userId === currentUser.uid
                                ? `${s.userName} (You)`
                                : s.userName}
                            </span>
                            <span className="text-[10px] font-normal text-[var(--mu)] shrink-0">
                              ({pct}%)
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--mu)] flex items-center gap-1 mt-0.5">
                            {isParticipantPayer ? (
                              <span className="text-[var(--em)] font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Paid own share
                              </span>
                            ) : (
                              <span className="text-[var(--ro)] font-medium flex items-center gap-1">
                                Owes {isMePayer ? 'You' : liveExpense.paidByName}
                                <ArrowRight className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 whitespace-nowrap">
                        <div className="text-[clamp(0.875rem,3.8cqw,1rem)] font-extrabold font-heading num whitespace-nowrap text-[var(--tx)]">
                          {formatPKR(s.share)}
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            isParticipantPayer
                              ? 'text-[var(--em)]'
                              : 'text-[var(--ro)]'
                          }`}
                        >
                          {isParticipantPayer ? 'Paid' : 'Owes'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meal & Situation Context (if present) */}
          {(liveExpense.whatEat ||
            liveExpense.timeWhen ||
            liveExpense.situation ||
            liveExpense.note) && (
            <div className="card !p-4 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)] flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-[var(--em)]" /> Meal, Situation &amp; Notes
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {liveExpense.whatEat && (
                  <div className="p-3 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)]">
                    <span className="text-[10px] text-[var(--mu)] font-semibold uppercase block">
                      What Was Eaten / Bought
                    </span>
                    <span className="font-bold text-[var(--tx)] mt-0.5 flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-[var(--em)] shrink-0" />
                      <span>{liveExpense.whatEat}</span>
                    </span>
                  </div>
                )}

                {liveExpense.timeWhen && (
                  <div className="p-3 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)]">
                    <span className="text-[10px] text-[var(--mu)] font-semibold uppercase block">
                      Date &amp; Time / Meal
                    </span>
                    <span className="font-bold text-[var(--tx)] mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[var(--vi)] shrink-0" />
                      <span>{liveExpense.timeWhen}</span>
                    </span>
                  </div>
                )}

                {liveExpense.situation && (
                  <div className="p-3 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] sm:col-span-2">
                    <span className="text-[10px] text-[var(--mu)] font-semibold uppercase block">
                      Situation / Occasion
                    </span>
                    <span className="font-bold text-[var(--tx)] mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[var(--su)] shrink-0" />
                      <span>{liveExpense.situation}</span>
                    </span>
                  </div>
                )}

                {liveExpense.note && (
                  <div className="p-3 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] sm:col-span-2">
                    <span className="text-[10px] text-[var(--mu)] font-semibold uppercase block">
                      Additional Note
                    </span>
                    <span className="text-[var(--tx)] mt-0.5 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[var(--mu)] shrink-0 mt-0.5" />
                      <span>{liveExpense.note}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Proof of Payment Image */}
          {liveExpense.proofOfPayment && (
            <div className="card !p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--em)] flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" /> Attached Receipt / Proof
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setActiveLightboxImage(liveExpense.proofOfPayment || null)
                  }
                  className="chip g !h-6 !px-2.5 !text-[11px]"
                >
                  View Full Screen
                </button>
              </div>
              <div
                onClick={() =>
                  setActiveLightboxImage(liveExpense.proofOfPayment || null)
                }
                className="overflow-hidden rounded-[18px] border border-[var(--line)] cursor-pointer bg-[var(--surface-2)] max-h-56 flex items-center justify-center"
              >
                <img
                  src={liveExpense.proofOfPayment}
                  alt="Proof of payment"
                  className="max-h-56 w-auto object-contain hover:scale-[1.02] transition-transform"
                />
              </div>
            </div>
          )}

          {/* Shared Expense Activity Log (added, edited, disputed, resolved) */}
          {isSplitBill && activityTimeline.length > 0 && (
            <div className="card !p-4 space-y-3 cq-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[var(--em)]" /> Expense Activity Log
                </span>
                <span className="chip !h-6 !px-2.5 !text-[11px]">
                  {activityTimeline.length} {activityTimeline.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              <div className="space-y-2">
                {activityTimeline.map((entry) => {
                  const badgeStyle =
                    entry.action === 'disputed'
                      ? 'chip r !h-5 !px-2 !text-[10px]'
                      : entry.action === 'resolved'
                      ? 'chip g !h-5 !px-2 !text-[10px]'
                      : entry.action === 'edited'
                      ? 'chip s !h-5 !px-2 !text-[10px]'
                      : 'chip !h-5 !px-2 !text-[10px]';

                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={badgeStyle}>
                            {entry.action.toUpperCase()}
                          </span>
                          <span className="font-bold text-[var(--tx)] truncate">
                            {entry.byName}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-[11px] text-[var(--mu)] break-words pt-0.5">
                            {entry.note}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--mu)] whitespace-nowrap shrink-0">
                        {entry.timestamp.includes('T')
                          ? formatFullDateTime(entry.timestamp)
                          : formatShortDate(entry.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linked Khata Ledger Impact */}
          {linkedLedgerEntries.length > 0 && (
            <div className="p-3.5 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] text-xs space-y-1">
              <div className="font-bold text-[var(--tx)] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[var(--em)]" /> Auto-Synced Khata Entries (
                {linkedLedgerEntries.length})
              </div>
              <p className="text-[11px] text-[var(--mu)]">
                This split bill automatically updated {linkedLedgerEntries.length} friend ledger
                balance(s).
              </p>
            </div>
          )}

          {/* Permission Notice for Split Bill Deletion */}
          {isSplitBill && !canDelete && (
            <div className="p-3.5 rounded-[18px] bg-[var(--su)]/15 border border-[var(--su)]/40 flex items-center gap-2 text-xs text-[var(--su)]">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                Only the creator ({liveExpense.createdByName || 'bill creator'}) can delete this
                shared split bill. You can still edit details or notes.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2.5 pt-2">
            <div className="flex items-center gap-2">
              {canEdit && !liveExpense.deleted && (
                <button
                  type="button"
                  onClick={() => setIsEditingModalOpen(true)}
                  className="btn s sm"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[var(--em)]" />
                  <span>Edit expense</span>
                </button>
              )}

              {canDelete && !liveExpense.deleted && (
                <button
                  type="button"
                  onClick={() => {
                    deleteExpense(liveExpense.id);
                    onClose();
                  }}
                  className="btn s sm !text-[var(--ro)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            <button type="button" onClick={onClose} className="btn sm">
              Done
            </button>
          </div>
        </div>
      </Sheet>

      {/* Lightbox for Full-Size Receipt */}
      {activeLightboxImage && (
        <div
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 z-80 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl max-h-[90vh] flex flex-col items-center bg-[var(--surface-solid)] backdrop-blur-2xl rounded-[28px] p-4 border-[1.5px] border-[var(--line)] shadow-2xl"
          >
            <div className="w-full flex items-center justify-between pb-3 px-1 text-[var(--tx)]">
              <span className="text-xs font-bold flex items-center gap-1.5 text-[var(--em)]">
                <Receipt className="w-4 h-4 text-[var(--em)]" /> Proof of Payment
              </span>
              <button
                type="button"
                onClick={() => setActiveLightboxImage(null)}
                className="ib !w-8 !h-8"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={activeLightboxImage}
              alt="Receipt proof"
              className="max-h-[80vh] w-auto object-contain rounded-[20px]"
            />
          </div>
        </div>
      )}
    </>
  );
};


