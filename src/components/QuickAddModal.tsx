import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Expense, ExpenseCategory, SplitDetail } from '../types';
import {
  Calendar,
  FileText,
  Sparkles,
  Camera,
  X,
  Utensils,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Check,
  Users,
  Wallet,
} from 'lucide-react';
import { formatPKR, formatShortDate } from '../lib/formatters';
import { Avatar } from '../ui';
import { compressImageToDataUrl } from '../lib/mediaUtils';
import { triggerConfettiBurst, triggerHaptic } from '../lib/webNotification';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

export const CATEGORY_CHIPS: {
  value: ExpenseCategory;
  label: string;
  emoji: string;
}[] = [
  { value: 'Food', label: 'Food & Dining', emoji: '🍔' },
  { value: 'Snacks', label: 'Chai & Snacks', emoji: '☕' },
  { value: 'Transport', label: 'Transport', emoji: '🚕' },
  { value: 'Rent', label: 'Rent & Bills', emoji: '🏠' },
  { value: 'Study', label: 'Study & Books', emoji: '📚' },
  { value: 'Personal', label: 'Personal', emoji: '🛍️' },
  { value: 'Other', label: 'Other', emoji: '✨' },
];

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'add' | 'edit';
  initialExpense?: Expense | null;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  mode = 'add',
  initialExpense = null,
}) => {
  const { currentUser, friends, addExpense, updateExpense, showToast } = useApp();

  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [date, setDate] = useState(getTodayDateString());
  const [note, setNote] = useState('');
  const [whatEat, setWhatEat] = useState('');
  const [timeWhen, setTimeWhen] = useState('');
  const [situation, setSituation] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [receiptProof, setReceiptProof] = useState<string | null>(null);
  const [isCompressingProof, setIsCompressingProof] = useState(false);
  const [paidById, setPaidById] = useState<string>('me');
  const [selectedFriends, setSelectedFriends] = useState<string[]>(() =>
    friends.map((f) => f.uid)
  );
  const [splitType, setSplitType] = useState<'equal' | 'friend_full' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<{ [uid: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  // Drag-to-dismiss state for mobile bottom sheet
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartYRef = useRef<number | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize form when opened or when initialExpense changes
  useEffect(() => {
    if (!isOpen) {
      setDragOffsetY(0);
      return;
    }

    if (mode === 'edit' && initialExpense) {
      setAmount(String(initialExpense.amount));
      setTitle(initialExpense.title);
      setCategory(initialExpense.category);
      setDate(initialExpense.date || getTodayDateString());
      setNote(initialExpense.note || '');
      setWhatEat(initialExpense.whatEat || '');
      setTimeWhen(initialExpense.timeWhen || '');
      setSituation(initialExpense.situation || '');
      setDetailsOpen(
        Boolean(
          initialExpense.whatEat ||
            initialExpense.timeWhen ||
            initialExpense.situation ||
            initialExpense.note
        )
      );
      setReceiptProof(initialExpense.proofOfPayment || null);
      setPaidById(
        initialExpense.paidBy === currentUser.uid || initialExpense.paidBy === 'me'
          ? 'me'
          : initialExpense.paidBy
      );
      setSplitType(
        initialExpense.splitType === 'friend_full'
          ? 'friend_full'
          : initialExpense.splitType === 'custom'
          ? 'custom'
          : 'equal'
      );

      const splitFriendIds = (initialExpense.splits || [])
        .map((s) => s.userId)
        .filter((uid) => uid !== currentUser.uid);
      setSelectedFriends(splitFriendIds);

      const map: { [uid: string]: string } = {};
      (initialExpense.splits || []).forEach((s) => {
        if (s.userId === currentUser.uid) {
          map['me'] = String(s.share);
        } else {
          map[s.userId] = String(s.share);
        }
      });
      setCustomShares(map);
    } else {
      setAmount('');
      setTitle('');
      setCategory('Food');
      setDate(getTodayDateString());
      setNote('');
      setWhatEat('');
      setTimeWhen('');
      setSituation('');
      setDetailsOpen(false);
      setReceiptProof(null);
      setPaidById('me');
      setSplitType('equal');
      setSelectedFriends(friends.map((f) => f.uid));
      setCustomShares({});
    }

    const focusTimer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(focusTimer);
  }, [isOpen, mode, initialExpense, currentUser.uid, friends.length]);

  const numericAmount = parseFloat(amount) || 0;
  const todayStr = getTodayDateString();
  const isToday = date === todayStr;

  const toggleFriend = (uid: string) => {
    setSelectedFriends((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingProof(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 900, 0.72);
      setReceiptProof(dataUrl);
      showToast({ type: 'success', message: 'Receipt attached!' });
    } catch {
      showToast({ type: 'error', message: 'Failed to process receipt image.' });
    } finally {
      setIsCompressingProof(false);
      if (e.target) e.target.value = '';
    }
  };

  // Calculate live splits
  const calculatedSplits = useMemo((): SplitDetail[] => {
    if (numericAmount <= 0) return [];

    if (selectedFriends.length === 0) {
      return [
        {
          userId: currentUser.uid,
          userName: currentUser.displayName,
          share: numericAmount,
        },
      ];
    }

    if (splitType === 'equal') {
      const totalPeople = selectedFriends.length + 1;
      const perPerson = Math.round(numericAmount / totalPeople);
      const list: SplitDetail[] = [
        {
          userId: currentUser.uid,
          userName: currentUser.displayName,
          share: perPerson,
        },
      ];
      selectedFriends.forEach((fId) => {
        const f = friends.find((u) => u.uid === fId);
        if (f) {
          list.push({ userId: f.uid, userName: f.displayName, share: perPerson });
        }
      });
      return list;
    }

    if (splitType === 'friend_full') {
      const perFriend = Math.round(numericAmount / selectedFriends.length);
      return selectedFriends.map((fId) => {
        const f = friends.find((u) => u.uid === fId);
        return {
          userId: fId,
          userName: f?.displayName || 'Friend',
          share: perFriend,
        };
      });
    }

    // Custom split
    const list: SplitDetail[] = [];
    const myCustom = parseFloat(customShares['me'] || '0') || 0;
    if (myCustom > 0) {
      list.push({
        userId: currentUser.uid,
        userName: currentUser.displayName,
        share: myCustom,
      });
    }
    selectedFriends.forEach((fId) => {
      const f = friends.find((u) => u.uid === fId);
      const shareVal = parseFloat(customShares[fId] || '0') || 0;
      if (f && shareVal > 0) {
        list.push({ userId: f.uid, userName: f.displayName, share: shareVal });
      }
    });
    return list;
  }, [numericAmount, selectedFriends, splitType, customShares, currentUser, friends]);

  const customTotalAllocated = useMemo(() => {
    const myVal = parseFloat(customShares['me'] || '0') || 0;
    const friendsVal = selectedFriends.reduce(
      (acc, uid) => acc + (parseFloat(customShares[uid] || '0') || 0),
      0
    );
    return myVal + friendsVal;
  }, [customShares, selectedFriends]);

  const customRemaining = Math.round(numericAmount - customTotalAllocated);
  const isCustomInvalid =
    splitType === 'custom' &&
    selectedFriends.length > 0 &&
    numericAmount > 0 &&
    Math.abs(customRemaining) > 1;

  // Live split summary line: e.g. "Each pays Rs 120. You are owed Rs 240."
  const liveSplitSummary = useMemo(() => {
    if (numericAmount <= 0) {
      return selectedFriends.length > 0
        ? `Splitting with ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}. Enter an amount above.`
        : 'Solo expense (not split with friends).';
    }
    if (selectedFriends.length === 0) {
      return `Solo expense · You pay ${formatPKR(numericAmount)}.`;
    }

    const myShare =
      calculatedSplits.find((s) => s.userId === currentUser.uid)?.share || 0;
    const friendsTotalShare = calculatedSplits
      .filter((s) => s.userId !== currentUser.uid)
      .reduce((sum, s) => sum + s.share, 0);

    if (paidById === 'me' || paidById === currentUser.uid) {
      if (splitType === 'equal') {
        const eachPays = Math.round(numericAmount / (selectedFriends.length + 1));
        return `Each pays ${formatPKR(eachPays)}. You are owed ${formatPKR(friendsTotalShare)}.`;
      }
      if (splitType === 'friend_full') {
        const eachFriendPays = Math.round(numericAmount / selectedFriends.length);
        return selectedFriends.length === 1
          ? `They pay ${formatPKR(eachFriendPays)}. You are owed ${formatPKR(numericAmount)}.`
          : `Each friend pays ${formatPKR(eachFriendPays)}. You are owed ${formatPKR(numericAmount)}.`;
      }
      return `Custom split · You are owed ${formatPKR(friendsTotalShare)}.`;
    } else {
      const payerFriend = friends.find((f) => f.uid === paidById);
      const payerName = payerFriend?.displayName || 'Friend';
      if (splitType === 'equal') {
        const eachPays = Math.round(numericAmount / (selectedFriends.length + 1));
        return `Each pays ${formatPKR(eachPays)}. You owe ${payerName} ${formatPKR(myShare)}.`;
      }
      return `Paid by ${payerName}. You owe ${formatPKR(myShare)}.`;
    }
  }, [
    numericAmount,
    selectedFriends,
    calculatedSplits,
    currentUser.uid,
    paidById,
    splitType,
    friends,
  ]);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartYRef.current === null) return;
    const delta = e.touches[0].clientY - dragStartYRef.current;
    if (delta > 0) {
      setDragOffsetY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 95) {
      setDragOffsetY(0);
      dragStartYRef.current = null;
      onClose();
    } else {
      setDragOffsetY(0);
      dragStartYRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      showToast({ type: 'warning', message: 'Please enter a valid amount.' });
      return;
    }
    if (!title.trim()) {
      showToast({ type: 'warning', message: 'Please enter an expense title.' });
      return;
    }
    if (isCustomInvalid) {
      showToast({
        type: 'warning',
        message: `Custom split must match total (${formatPKR(Math.abs(customRemaining))} ${
          customRemaining > 0 ? 'remaining' : 'over'
        }).`,
      });
      return;
    }

    const payerUser =
      paidById === 'me' || paidById === currentUser.uid
        ? currentUser
        : friends.find((f) => f.uid === paidById) || currentUser;

    const finalSplitType: Expense['splitType'] =
      selectedFriends.length === 0 ? 'personal' : splitType;

    setIsSaving(true);
    try {
      if (mode === 'edit' && initialExpense) {
        await updateExpense(initialExpense.id, {
          title: title.trim(),
          amount: numericAmount,
          category,
          date,
          paidBy: payerUser.uid === currentUser.uid ? 'me' : payerUser.uid,
          paidByName: payerUser.displayName,
          splitType: finalSplitType,
          splits: calculatedSplits,
          note: note.trim() || undefined,
          whatEat: whatEat.trim() || undefined,
          timeWhen: timeWhen.trim() || undefined,
          situation: situation.trim() || undefined,
          proofOfPayment: receiptProof || undefined,
        });
      } else {
        await addExpense({
          title: title.trim(),
          amount: numericAmount,
          category,
          date,
          paidBy: payerUser.uid === currentUser.uid ? 'me' : payerUser.uid,
          paidByName: payerUser.displayName,
          splitType: finalSplitType,
          splits: calculatedSplits,
          note: note.trim() || undefined,
          whatEat: whatEat.trim() || undefined,
          timeWhen: timeWhen.trim() || undefined,
          situation: situation.trim() || undefined,
          proofOfPayment: receiptProof || undefined,
          status: 'approved',
          createdBy: currentUser.uid,
          createdByName: currentUser.displayName,
        });
      }

      triggerHaptic([50, 30, 70]);
      triggerConfettiBurst();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const filledDetailsCount = [whatEat, timeWhen, situation, note].filter((v) =>
    v.trim()
  ).length;

  return (
    <div
      className="fixed inset-0 z-70 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: dragOffsetY > 0 ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
        className="w-full sm:max-w-[520px] h-[92dvh] sm:h-auto sm:max-h-[88dvh] rounded-t-[28px] sm:rounded-[28px] bg-[#160D2C]/95 border-[1.5px] border-[var(--line)] shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-2xl flex flex-col overflow-hidden"
      >
        {/* Mobile Drag Handle + Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="pt-2.5 pb-2 px-5 border-b border-[var(--line)] shrink-0 select-none cursor-grab active:cursor-grabbing"
        >
          <div className="w-11 h-1.5 rounded-full bg-white/25 mx-auto mb-2.5 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--em)]" />
              <h3 className="text-base font-extrabold font-heading text-[var(--tx)]">
                {mode === 'edit' ? 'Edit expense' : 'Add expense'}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {/* Small Date Chip defaulting to Today */}
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (dateInputRef.current?.showPicker) {
                      dateInputRef.current.showPicker();
                    } else {
                      dateInputRef.current?.focus();
                    }
                  }}
                  className="chip !h-8 !px-3 !text-xs gap-1.5 hover:bg-white/20 transition cursor-pointer border border-[var(--line)]"
                  title="Change expense date"
                >
                  <Calendar className="w-3.5 h-3.5 text-[var(--em)]" />
                  <span>{isToday ? 'Today' : formatShortDate(date)}</span>
                </button>
                {!isToday && (
                  <button
                    type="button"
                    onClick={() => setDate(todayStr)}
                    className="ml-1 text-[10px] font-bold text-[var(--em)] hover:underline px-1.5 py-0.5 cursor-pointer"
                    title="Reset to Today"
                  >
                    Today
                  </button>
                )}
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || todayStr)}
                  className="sr-only"
                  aria-label="Expense Date"
                />
              </div>

              <button
                type="button"
                onClick={onClose}
                className="ib !w-8 !h-8"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-[var(--tx)]" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <form
          id="expense-modal-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {/* 1. Big 40px Amount Input with "Rs" prefix + Quick Amount Chips */}
          <div className="p-4 rounded-[22px] bg-black/35 border-[1.5px] border-[var(--line)] focus-within:border-[var(--em)] transition-colors">
            <div className="flex items-baseline gap-2.5 flex-nowrap whitespace-nowrap overflow-x-auto no-scrollbar">
              <span className="text-[28px] font-extrabold font-heading text-[var(--em)] shrink-0 select-none">
                Rs
              </span>
              <input
                ref={amountInputRef}
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                required
                className="w-full min-w-0 bg-transparent border-none text-[40px] leading-none font-extrabold font-heading text-[var(--tx)] placeholder:text-white/20 focus:outline-none tabular-nums whitespace-nowrap"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 mt-3 border-t border-white/10">
              {QUICK_AMOUNTS.map((preset) => {
                const isSelected = numericAmount === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className={`chip !h-7 !px-2.5 !text-xs num shrink-0 cursor-pointer transition ${
                      isSelected
                        ? 'g border border-[var(--em)]/50'
                        : 'hover:bg-white/20'
                    }`}
                  >
                    Rs {preset.toLocaleString()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Title Field */}
          <div>
            <input
              type="text"
              placeholder="What was this for? (e.g. Savour Pulao, Careem, Chai)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-[18px] bg-black/30 border-[1.5px] border-[var(--line)] text-sm font-semibold text-[var(--tx)] placeholder:text-[var(--mu)] focus:outline-none focus:border-[var(--em)] transition"
            />
          </div>

          {/* 3. Category Chips in ONE Horizontally Scrolling Row with Edge Fade */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)]">
                Category
              </span>
              <span className="text-[11px] text-[var(--mu)]">Swipe →</span>
            </div>
            <div className="-mx-2 px-2 fade-edges-x">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-2">
                {CATEGORY_CHIPS.map((cat) => {
                  const active = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`h-9 px-3.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition cursor-pointer border ${
                        active
                          ? 'bg-[var(--em)] text-[#04140a] border-[var(--em)] shadow-sm'
                          : 'bg-white/10 text-[var(--tx)] border-[var(--line)] hover:bg-white/15'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Paid By Selector + Receipt Attach Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Paid By Selector */}
            <div className="p-3 rounded-[18px] bg-black/28 border border-[var(--line)] space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)] flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[var(--em)]" /> Paid by
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setPaidById('me')}
                  className={`h-8 px-3 rounded-full text-xs font-bold shrink-0 cursor-pointer transition border ${
                    paidById === 'me' || paidById === currentUser.uid
                      ? 'bg-[var(--em)] text-[#04140a] border-[var(--em)]'
                      : 'bg-white/10 text-[var(--tx)] border-[var(--line)] hover:bg-white/15'
                  }`}
                >
                  You
                </button>
                {friends.map((f) => {
                  const isPayer = paidById === f.uid;
                  return (
                    <button
                      key={f.uid}
                      type="button"
                      onClick={() => setPaidById(f.uid)}
                      className={`h-8 px-3 rounded-full text-xs font-bold shrink-0 cursor-pointer transition border ${
                        isPayer
                          ? 'bg-[var(--em)] text-[#04140a] border-[var(--em)]'
                          : 'bg-white/10 text-[var(--tx)] border-[var(--line)] hover:bg-white/15'
                      }`}
                    >
                      {f.displayName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Receipt Attach Button with Thumbnail Preview */}
            <div className="p-3 rounded-[18px] bg-black/28 border border-[var(--line)] flex items-center justify-between gap-2">
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*"
                onChange={handleReceiptFileChange}
                className="hidden"
              />
              {receiptProof ? (
                <div className="flex items-center justify-between w-full gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={receiptProof}
                      alt="Receipt preview"
                      className="w-11 h-11 rounded-[12px] object-cover border border-[var(--em)]/50 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[var(--em)] block truncate">
                        Receipt attached
                      </span>
                      <button
                        type="button"
                        onClick={() => receiptInputRef.current?.click()}
                        className="text-[11px] text-[var(--mu)] hover:text-[var(--tx)] underline cursor-pointer"
                      >
                        Replace photo
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptProof(null)}
                    className="ib !w-8 !h-8 shrink-0"
                    title="Remove receipt"
                  >
                    <X className="w-4 h-4 text-[var(--ro)]" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => receiptInputRef.current?.click()}
                  disabled={isCompressingProof}
                  className="w-full h-full flex items-center justify-center gap-2 py-1.5 rounded-[14px] border border-dashed border-[var(--line)] hover:border-[var(--em)] text-xs font-bold text-[var(--tx)] transition cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[var(--em)]" />
                  <span>
                    {isCompressingProof ? 'Processing...' : 'Attach receipt'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* 5. Split Section: Friend Avatar Toggles + Live Summary Line + Segmented Control */}
          <div className="p-4 rounded-[22px] bg-black/30 border-[1.5px] border-[var(--line)] space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--tx)] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[var(--em)]" /> Split with friends
              </span>
              {friends.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedFriends(friends.map((f) => f.uid))}
                    className="text-[var(--em)] hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-[var(--mu)]">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFriends([])}
                    className="text-[var(--mu)] hover:text-[var(--tx)] cursor-pointer"
                  >
                    Just me
                  </button>
                </div>
              )}
            </div>

            {/* Avatar Toggles for Friends */}
            {friends.length === 0 ? (
              <p className="text-xs text-[var(--mu)]">
                No friends added yet — this expense will be saved as a personal transaction.
              </p>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {friends.map((friend) => {
                  const selected = selectedFriends.includes(friend.uid);
                  return (
                    <button
                      key={friend.uid}
                      type="button"
                      onClick={() => toggleFriend(friend.uid)}
                      className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border transition cursor-pointer shrink-0 ${
                        selected
                          ? 'bg-[var(--em)]/20 border-[var(--em)] text-[var(--tx)]'
                          : 'bg-white/5 border-[var(--line)] text-[var(--mu)] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="relative">
                        <Avatar
                          name={friend.displayName}
                          photoURL={friend.photoURL}
                          size="xs"
                        />
                        {selected && (
                          <span className="-bottom-0.5 -right-0.5 absolute w-3.5 h-3.5 rounded-full bg-[var(--em)] text-[#04140a] flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold">{friend.displayName}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Live Split Calculation Line */}
            <div className="px-3.5 py-2.5 rounded-[14px] bg-white/6 border border-[var(--line)] flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--tx)] num">
                {liveSplitSummary}
              </span>
            </div>

            {/* Modes as a Segmented Control: Equal / They owe full / Custom */}
            {selectedFriends.length > 0 && (
              <div className="grid grid-cols-3 p-1 rounded-[14px] bg-black/40 border border-[var(--line)] gap-1">
                {(
                  [
                    { value: 'equal', label: 'Equal' },
                    { value: 'friend_full', label: 'They owe full' },
                    { value: 'custom', label: 'Custom' },
                  ] as const
                ).map((opt) => {
                  const active = splitType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSplitType(opt.value)}
                      className={`h-8 rounded-[10px] text-xs font-bold transition cursor-pointer ${
                        active
                          ? 'bg-[var(--em)] text-[#04140a] shadow-sm'
                          : 'text-[var(--mu)] hover:text-[var(--tx)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom Mode Per-Person Amount Inputs & "Rs X remaining" Indicator */}
            {splitType === 'custom' && selectedFriends.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--mu)]">
                    Enter custom share per person
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold num border ${
                      Math.abs(customRemaining) <= 1
                        ? 'bg-[var(--em)]/20 text-[var(--em)] border-[var(--em)]/40'
                        : 'bg-[var(--ro)]/20 text-[var(--ro)] border-[var(--ro)]/50'
                    }`}
                  >
                    {customRemaining >= 0
                      ? `Rs ${customRemaining.toLocaleString()} remaining`
                      : `Rs ${Math.abs(customRemaining).toLocaleString()} over`}
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Current User Custom Input */}
                  <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[14px] bg-black/30 border border-[var(--line)]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={currentUser.displayName}
                        photoURL={currentUser.photoURL}
                        size="xs"
                      />
                      <span className="text-xs font-bold text-[var(--tx)] truncate">
                        You ({currentUser.displayName})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 w-32 shrink-0">
                      <span className="text-xs font-bold text-[var(--mu)]">Rs</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={customShares['me'] || ''}
                        onChange={(e) =>
                          setCustomShares((prev) => ({
                            ...prev,
                            me: e.target.value,
                          }))
                        }
                        className="w-full h-8 px-2.5 rounded-[10px] bg-black/40 border border-[var(--line)] text-right text-xs font-bold text-[var(--tx)] tabular-nums focus:outline-none focus:border-[var(--em)]"
                      />
                    </div>
                  </div>

                  {/* Selected Friends Custom Inputs */}
                  {selectedFriends.map((fId) => {
                    const friend = friends.find((u) => u.uid === fId);
                    if (!friend) return null;
                    return (
                      <div
                        key={fId}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-[14px] bg-black/30 border border-[var(--line)]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            name={friend.displayName}
                            photoURL={friend.photoURL}
                            size="xs"
                          />
                          <span className="text-xs font-bold text-[var(--tx)] truncate">
                            {friend.displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 w-32 shrink-0">
                          <span className="text-xs font-bold text-[var(--mu)]">Rs</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={customShares[fId] || ''}
                            onChange={(e) =>
                              setCustomShares((prev) => ({
                                ...prev,
                                [fId]: e.target.value,
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded-[10px] bg-black/40 border border-[var(--line)] text-right text-xs font-bold text-[var(--tx)] tabular-nums focus:outline-none focus:border-[var(--em)]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 6. Collapsed Optional Section: "Add details" (keeps Meal & Situation 3 fields + Note) */}
          <div className="rounded-[22px] bg-black/25 border border-[var(--line)] overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-[var(--tx)] hover:bg-white/5 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Utensils className="w-3.5 h-3.5 text-[var(--em)]" />
                <span>Add details (Meal, Situation &amp; Notes)</span>
                {filledDetailsCount > 0 && (
                  <span className="chip g !h-5 !px-2 !text-[10px]">
                    {filledDetailsCount} added
                  </span>
                )}
              </span>
              {detailsOpen ? (
                <ChevronUp className="w-4 h-4 text-[var(--mu)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--mu)]" />
              )}
            </button>

            {detailsOpen && (
              <div className="p-4 pt-2 border-t border-[var(--line)] space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--mu)] mb-1">
                    What did we eat / buy?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2x Chicken Pulao, Cold Drinks"
                    value={whatEat}
                    onChange={(e) => setWhatEat(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-[14px] bg-black/35 border border-[var(--line)] text-xs text-[var(--tx)] placeholder:text-[var(--mu)] focus:outline-none focus:border-[var(--em)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--mu)] mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Time / Meal
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Late Night Dinner"
                      value={timeWhen}
                      onChange={(e) => setTimeWhen(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-[14px] bg-black/35 border border-[var(--line)] text-xs text-[var(--tx)] placeholder:text-[var(--mu)] focus:outline-none focus:border-[var(--em)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--mu)] mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Where / Situation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Exam Study Session"
                      value={situation}
                      onChange={(e) => setSituation(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-[14px] bg-black/35 border border-[var(--line)] text-xs text-[var(--tx)] placeholder:text-[var(--mu)] focus:outline-none focus:border-[var(--em)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--mu)] mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Notes / @Mentions
                  </label>
                  <input
                    type="text"
                    placeholder="Optional note or @friend..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-[14px] bg-black/35 border border-[var(--line)] text-xs text-[var(--tx)] placeholder:text-[var(--mu)] focus:outline-none focus:border-[var(--em)]"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Sticky Bottom Bar with Cancel and Save Expense */}
        <div className="px-5 py-3.5 bg-black/45 border-t border-[var(--line)] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn s flex-1 sm:flex-initial justify-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="expense-modal-form"
            disabled={isSaving || isCustomInvalid}
            className="btn flex-1 sm:flex-initial justify-center disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save expense'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const QuickAddModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  return <ExpenseFormModal isOpen={isOpen} onClose={onClose} mode="add" />;
};

export const EditExpenseModal: React.FC<{
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
}> = ({ expense, isOpen, onClose }) => {
  return (
    <ExpenseFormModal
      isOpen={isOpen}
      onClose={onClose}
      mode="edit"
      initialExpense={expense}
    />
  );
};
