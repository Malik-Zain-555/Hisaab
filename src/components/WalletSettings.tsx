import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Save,
  RotateCcw,
  Trash2,
  Mail,
  Plus,
  ArrowLeft,
  Home,
  Bell,
  Calendar,
  Sparkles,
  Users,
  Wallet,
  Copy,
  Check,
  Lock,
  EyeOff,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { formatPKR, formatMonthDisplay } from '../lib/formatters';
import {
  getWebNotificationPermission,
  requestWebNotificationPermission,
  sendWebNotification,
} from '../lib/webNotification';
import { connectGoogleWorkspace } from '../lib/auth';
import { Button, Input } from '../ui';
import { PaymentMethodDetail, SavedPaymentProvider } from '../types';

const PROVIDERS: SavedPaymentProvider[] = [
  'JazzCash',
  'EasyPaisa',
  'SadaPay',
  'NayaPay',
  'Bank Account',
];

export const WalletSettings: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const {
    currentUser,
    friends,
    currentMonth,
    updateMonthBudget,
    addFixedExpense,
    deleteFixedExpense,
    triggerFixedBillSplit,
    toggleFixedExpensePaid,
    startNewMonth,
    updatePaymentMethods,
    appLockPin,
    setAppLockPin,
    lockAppNow,
    hideAmounts,
    toggleHideAmounts,
    queuedEmails,
    triggerMailQueueProcess,
    loadSampleData,
    clearAllData,
    showToast,
  } = useApp();

  // Budget form
  const [budgetInput, setBudgetInput] = useState(String(currentMonth.budget));
  const [carryOverInput, setCarryOverInput] = useState(String(currentMonth.carryOver));
  const [openingBalanceInput, setOpeningBalanceInput] = useState(String(currentMonth.openingBalance));

  useEffect(() => {
    setBudgetInput(String(currentMonth.budget));
    setCarryOverInput(String(currentMonth.carryOver));
    setOpeningBalanceInput(String(currentMonth.openingBalance));
  }, [currentMonth]);

  // Fixed & Recurring Shared Bills
  const [fixedTitle, setFixedTitle] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedDueDay, setFixedDueDay] = useState('5');
  const [isSharedRecurring, setIsSharedRecurring] = useState(false);
  const [selectedSplitFriendIds, setSelectedSplitFriendIds] = useState<string[]>([]);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDetail[]>(
    currentUser.paymentMethods || []
  );
  const [newProvider, setNewProvider] = useState<SavedPaymentProvider>('JazzCash');
  const [newAccountTitle, setNewAccountTitle] = useState(currentUser.displayName || '');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newIbanOrNote, setNewIbanOrNote] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setPaymentMethods(currentUser.paymentMethods || []);
    if (!newAccountTitle && currentUser.displayName) {
      setNewAccountTitle(currentUser.displayName);
    }
  }, [currentUser.paymentMethods, currentUser.displayName]);

  // App Lock PIN setup state
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [isEditingPin, setIsEditingPin] = useState(false);

  // Start new month
  const [nextMonthKey, setNextMonthKey] = useState('2026-11');
  const [nextMonthBudget, setNextMonthBudget] = useState('20000');

  const [isConnectingWorkspace, setIsConnectingWorkspace] = useState(false);
  const [isProcessingMail, setIsProcessingMail] = useState(false);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseFloat(budgetInput) || 0;
    const c = parseFloat(carryOverInput) || 0;
    const o = parseFloat(openingBalanceInput) || 0;
    await updateMonthBudget(b, c, o);
  };

  const toggleFriendForBill = (friendUid: string) => {
    setSelectedSplitFriendIds((prev) =>
      prev.includes(friendUid) ? prev.filter((id) => id !== friendUid) : [...prev, friendUid]
    );
  };

  const handleAddFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(fixedAmount);
    if (!fixedTitle.trim() || isNaN(amt) || amt <= 0) return;

    const dueDayNum = Math.min(31, Math.max(1, parseInt(fixedDueDay, 10) || 1));
    const dayPadded = String(dueDayNum).padStart(2, '0');
    const dueDateStr = `${currentMonth.monthKey}-${dayPadded}`;

    await addFixedExpense(fixedTitle.trim(), amt, dueDateStr, {
      dueDay: dueDayNum,
      isShared: isSharedRecurring && selectedSplitFriendIds.length > 0,
      splitFriendIds:
        isSharedRecurring && selectedSplitFriendIds.length > 0
          ? selectedSplitFriendIds
          : undefined,
      category: 'Rent',
    });
    setFixedTitle('');
    setFixedAmount('');
    setSelectedSplitFriendIds([]);
  };

  const handleAddPaymentAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountNumber.trim()) {
      showToast({ type: 'warning', message: 'Please enter an account or mobile number.' });
      return;
    }
    const newItem: PaymentMethodDetail = {
      id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      provider: newProvider,
      accountTitle: (newAccountTitle || currentUser.displayName || 'Account').trim(),
      accountNumber: newAccountNumber.trim(),
      ...(newIbanOrNote.trim() ? { ibanOrNote: newIbanOrNote.trim() } : {}),
    };
    const next = [...paymentMethods, newItem];
    setPaymentMethods(next);
    setNewAccountNumber('');
    setNewIbanOrNote('');
    await updatePaymentMethods(next);
  };

  const handleRemovePaymentAccount = async (id: string) => {
    const next = paymentMethods.filter((m) => m.id !== id);
    setPaymentMethods(next);
    await updatePaymentMethods(next);
  };

  const handleCopyAccount = (m: PaymentMethodDetail) => {
    navigator.clipboard.writeText(m.accountNumber);
    setCopiedId(m.id);
    showToast({ type: 'success', message: `Copied ${m.provider} account number!` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.replace(/\D/g, '');
    if (cleanPin.length !== 4) {
      showToast({ type: 'warning', message: 'PIN must be exactly 4 digits.' });
      return;
    }
    if (cleanPin !== pinConfirmInput.replace(/\D/g, '')) {
      showToast({ type: 'error', message: 'PIN numbers do not match.' });
      return;
    }
    setAppLockPin(cleanPin);
    setPinInput('');
    setPinConfirmInput('');
    setIsEditingPin(false);
    showToast({
      type: 'success',
      message: '4-digit App Lock PIN enabled! Locks on open and after 2 minutes in background.',
    });
  };

  const handleDisablePin = () => {
    setAppLockPin(null);
    setPinInput('');
    setPinConfirmInput('');
    setIsEditingPin(false);
    showToast({ type: 'info', message: 'App Lock PIN disabled.' });
  };

  const handleConnectWorkspace = async () => {
    setIsConnectingWorkspace(true);
    try {
      const ok = await connectGoogleWorkspace();
      if (ok) {
        showToast({
          type: 'success',
          message: 'Connected Gmail reminders! Automated emails are ready.',
        });
      } else {
        showToast({
          type: 'info',
          message:
            'If Google shows an unverified app prompt, click "Advanced" → "Continue to Hisaab" to connect Gmail reminders.',
        });
      }
    } finally {
      setIsConnectingWorkspace(false);
    }
  };

  const handleProcessMailQueue = async () => {
    setIsProcessingMail(true);
    try {
      const res = await triggerMailQueueProcess();
      showToast({
        type: 'success',
        message: `Processed mail queue: ${res.sent} sent, ${res.failed} failed.`,
      });
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'Error processing queue.' });
    } finally {
      setIsProcessingMail(false);
    }
  };

  const permStatus = getWebNotificationPermission();
  const paidBillsCount = currentMonth.fixedExpenses.filter((b) => b.paid).length;
  const previewSharePerPerson =
    isSharedRecurring && selectedSplitFriendIds.length > 0 && parseFloat(fixedAmount) > 0
      ? Math.round(parseFloat(fixedAmount) / (selectedSplitFriendIds.length + 1))
      : 0;

  return (
    <div className="space-y-5 pb-20">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ib"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--tx)]" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--tx)]">
              Wallet &amp; Settings
            </h1>
            <p className="mu">
              Configure your monthly budget, recurring shared bills, payment accounts, and app lock.
            </p>
          </div>
        </div>

        {onClose && (
          <button type="button" onClick={onClose} className="btn s sm">
            Done
          </button>
        )}
      </div>

      {/* 12-Column Maximal Bento Grid */}
      <div className="bento">
        {/* 1. Monthly Budget Card (Span 7 on desktop) */}
        <section
          className="c t-em"
          style={{ '--s': 12, '--m': 12, '--d': 7 } as React.CSSProperties}
        >
          <div className="chips mb-2">
            <span className="chip g">
              {formatMonthDisplay(currentMonth.monthName || currentMonth.monthKey)}
            </span>
          </div>

          <h2 className="bento-h2">
            <span>Monthly Wallet Budget</span>
            <span className="num in text-base">
              {formatPKR(parseFloat(budgetInput) || 0)}
            </span>
          </h2>

          <form onSubmit={handleSaveBudget} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Monthly Budget (Rs)"
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
              <Input
                label="Carry-over from last month"
                type="number"
                value={carryOverInput}
                onChange={(e) => setCarryOverInput(e.target.value)}
              />
              <Input
                label="Opening Cash in Hand"
                type="number"
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
              />
            </div>

            <div className="pt-1">
              <button type="submit" className="btn">
                <Save className="w-4 h-4" />
                <span>Save budget</span>
              </button>
            </div>
          </form>
        </section>

        {/* 2. Start Next Month Card (Span 5 on desktop) */}
        <section
          className="c t-su"
          style={{ '--s': 12, '--m': 12, '--d': 5 } as React.CSSProperties}
        >
          <div className="chips mb-2">
            <span className="chip">
              <Calendar className="w-3.5 h-3.5 mr-1" /> Rollover
            </span>
          </div>

          <h2 className="bento-h2">
            <span>Start Next Month</span>
          </h2>
          <p className="mu mb-4">
            Automatically carries over your remaining balance and recurring bills into the new month.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Input
              label="Next Month (YYYY-MM)"
              value={nextMonthKey}
              onChange={(e) => setNextMonthKey(e.target.value)}
            />
            <Input
              label="Target Budget (Rs)"
              type="number"
              value={nextMonthBudget}
              onChange={(e) => setNextMonthBudget(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn"
            onClick={async () => {
              const b = parseFloat(nextMonthBudget) || 20000;
              await startNewMonth(nextMonthKey, b);
              showToast({ type: 'success', message: `Initialized ${nextMonthKey}` });
            }}
          >
            <Sparkles className="w-4 h-4" />
            <span>Initialize month</span>
          </button>
        </section>

        {/* 3. Fixed & Recurring Shared Bills Card (Span 7 on desktop) */}
        <section
          className="c"
          style={{ '--s': 12, '--m': 12, '--d': 7 } as React.CSSProperties}
        >
          <h2 className="bento-h2">
            <span>Fixed &amp; Recurring Shared Bills</span>
            <span className="mu">
              {paidBillsCount} of {currentMonth.fixedExpenses.length} paid
            </span>
          </h2>
          <p className="mu mb-4">
            Rent, WiFi, hostel dues, and monthly subscriptions. Pick friends to auto-create each month&apos;s split expense on the due date.
          </p>

          {currentMonth.fixedExpenses.length === 0 ? (
            <p className="mu py-4">No fixed or recurring shared bills added yet.</p>
          ) : (
            <div className="space-y-3 mb-5">
              {currentMonth.fixedExpenses.map((bill) => {
                const isShared = Boolean(bill.isShared && bill.splitFriendIds?.length);
                const splitFriendsNames = (bill.splitFriendIds || [])
                  .map((fid) => friends.find((f) => f.uid === fid)?.displayName || 'Friend')
                  .join(', ');
                const totalPeople = (bill.splitFriendIds?.length || 0) + 1;
                const eachShare = isShared ? Math.round(bill.amount / totalPeople) : bill.amount;
                const alreadyAutoSplitThisMonth =
                  bill.lastAutoSplitMonth === currentMonth.monthKey;
                const dueDayLabel =
                  bill.dueDay || parseInt((bill.date || '').split('-')[2] || '1', 10) || 1;

                return (
                  <div key={bill.id} className="bill min-h-[64px] flex-wrap sm:flex-nowrap">
                    <span
                      className="ct"
                      style={
                        { '--c': isShared ? 'var(--em)' : 'var(--cy)' } as React.CSSProperties
                      }
                    >
                      {isShared ? <Users className="w-5 h-5" /> : <Home className="w-5 h-5" />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <b className={bill.paid ? 'line-through opacity-65' : ''}>
                          {bill.title}
                        </b>
                        {isShared && (
                          <span className="chip g !h-5 !px-2 !text-[10px]">
                            Shared ({totalPeople} way · {formatPKR(eachShare)} each)
                          </span>
                        )}
                        {isShared && (
                          <span className="chip !h-5 !px-2 !text-[10px]">
                            {alreadyAutoSplitThisMonth
                              ? '✓ Split created this month'
                              : `Auto-splits day ${dueDayLabel}`}
                          </span>
                        )}
                      </div>
                      <div className="mu mt-0.5">
                        {bill.paid ? 'Paid' : 'Due'} · Day {dueDayLabel} ({bill.date}) ·{' '}
                        <span className="num text-[var(--tx)] font-bold">
                          {formatPKR(bill.amount)}
                        </span>
                        {isShared && splitFriendsNames && (
                          <span> · with {splitFriendsNames}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isShared && !alreadyAutoSplitThisMonth && (
                        <button
                          type="button"
                          onClick={() => triggerFixedBillSplit(bill.id)}
                          className="chip g !h-7 !px-2.5 !text-[11px]"
                          title="Create this month's split expense now"
                        >
                          Split now
                        </button>
                      )}
                      <button
                        type="button"
                        className="tg"
                        role="switch"
                        aria-checked={bill.paid}
                        aria-label={`${bill.title} paid`}
                        onClick={() => toggleFixedExpensePaid(bill.id)}
                      />
                      <button
                        type="button"
                        onClick={() => deleteFixedExpense(bill.id)}
                        className="ib !w-8 !h-8 text-[var(--mu)] hover:text-[var(--ro)]"
                        title="Remove recurring bill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Fixed / Recurring Shared Bill Form */}
          <form
            onSubmit={handleAddFixed}
            className="pt-3.5 border-t border-[var(--line)] space-y-3"
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <input
                type="text"
                placeholder="Bill name (e.g. Flat Rent, StormFiber WiFi)"
                value={fixedTitle}
                onChange={(e) => setFixedTitle(e.target.value)}
                className="flex-1 min-w-[160px] h-11 bg-[var(--surface-2)] text-[16px] text-[var(--tx)] placeholder:text-[var(--mu)] px-4 rounded-[14px] border border-[var(--line)] focus:outline-none focus:border-[var(--em)]"
              />
              <input
                type="number"
                placeholder="Total (Rs)"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(e.target.value)}
                className="w-32 h-11 bg-[var(--surface-2)] text-[16px] text-[var(--tx)] placeholder:text-[var(--mu)] px-3.5 rounded-[14px] border border-[var(--line)] focus:outline-none focus:border-[var(--em)] num"
              />
              <div className="flex items-center gap-1.5 bg-[var(--surface-2)] px-3 h-11 rounded-[14px] border border-[var(--line)]">
                <span className="text-xs text-[var(--mu)] whitespace-nowrap">Due day:</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={fixedDueDay}
                  onChange={(e) => setFixedDueDay(e.target.value)}
                  className="w-12 bg-transparent text-[16px] font-bold text-[var(--tx)] focus:outline-none num text-center"
                />
              </div>
            </div>

            {/* Recurring Shared Split Toggle & Friend Picker */}
            <div className="p-3 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--em)]" />
                  <span className="text-xs font-extrabold text-[var(--tx)]">
                    Split this recurring bill with friends
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isSharedRecurring}
                  onClick={() => setIsSharedRecurring((prev) => !prev)}
                  className={`tg ${isSharedRecurring ? 'on' : ''}`}
                />
              </div>

              {isSharedRecurring && (
                <div className="space-y-2 pt-1">
                  {friends.length === 0 ? (
                    <p className="text-xs text-[var(--mu)]">
                      Add friends in the Chats &amp; Friends tab first to split recurring bills with them.
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] text-[var(--mu)]">
                        Pick friends to split with (auto-creates each month&apos;s split expense on day {fixedDueDay || 1}):
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {friends.map((fr) => {
                          const selected = selectedSplitFriendIds.includes(fr.uid);
                          return (
                            <button
                              key={fr.uid}
                              type="button"
                              onClick={() => toggleFriendForBill(fr.uid)}
                              className={`chip !h-8 !px-3 !text-xs ${selected ? 'g' : ''}`}
                            >
                              <span>{fr.displayName}</span>
                              {selected && <Check className="w-3.5 h-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                      {selectedSplitFriendIds.length > 0 && previewSharePerPerson > 0 && (
                        <p className="text-xs text-[var(--em)] font-bold">
                          Split equally {selectedSplitFriendIds.length + 1} ways (You +{' '}
                          {selectedSplitFriendIds.length} friend
                          {selectedSplitFriendIds.length === 1 ? '' : 's'}):{' '}
                          <span className="num whitespace-nowrap">
                            {formatPKR(previewSharePerPerson)} each
                          </span>
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <button type="submit" className="btn s">
              <Plus className="w-4 h-4" />
              <span>
                {isSharedRecurring && selectedSplitFriendIds.length > 0
                  ? 'Add recurring shared bill'
                  : 'Add fixed bill'}
              </span>
            </button>
          </form>
        </section>

        {/* 4. Payment Details on Profile Card (Span 5 on desktop) */}
        <section
          className="c t-em"
          style={{ '--s': 12, '--m': 12, '--d': 5 } as React.CSSProperties}
        >
          <div className="chips mb-2">
            <span className="chip g">
              <Wallet className="w-3.5 h-3.5 mr-1" /> Payment Details
            </span>
          </div>

          <h2 className="bento-h2">
            <span>Saved Payment Accounts</span>
            <span className="mu">{paymentMethods.length} saved</span>
          </h2>
          <p className="mu mb-3">
            Save your JazzCash, EasyPaisa, SadaPay or bank details. Automatically added to WhatsApp/email reminders and shown on your public statement page.
          </p>

          {paymentMethods.length > 0 && (
            <div className="space-y-2 mb-4">
              {paymentMethods.map((m) => (
                <div
                  key={m.id}
                  className="min-h-[64px] px-3.5 py-2.5 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="chip g !h-5 !px-2 !text-[10px]">{m.provider}</span>
                      <span className="text-xs font-extrabold text-[var(--tx)] truncate">
                        {m.accountTitle}
                      </span>
                    </div>
                    <p className="text-xs font-mono font-bold text-[var(--em)] mt-1 truncate">
                      {m.accountNumber}
                    </p>
                    {m.ibanOrNote && (
                      <p className="text-[11px] text-[var(--mu)] truncate">{m.ibanOrNote}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(m)}
                      className="chip !h-8 !px-2.5 !text-xs"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3.5 h-3.5 text-[var(--em)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePaymentAccount(m.id)}
                      className="ib !w-8 !h-8 text-[var(--ro)]"
                      title="Delete account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddPaymentAccount} className="space-y-2.5 pt-2 border-t border-[var(--line)]">
            <div className="flex items-center gap-1.5 flex-wrap">
              {PROVIDERS.map((prov) => (
                <button
                  key={prov}
                  type="button"
                  onClick={() => setNewProvider(prov)}
                  className={`chip !h-7 !px-2.5 !text-xs ${newProvider === prov ? 'g' : ''}`}
                >
                  {prov}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Account Title"
                value={newAccountTitle}
                onChange={(e) => setNewAccountTitle(e.target.value)}
                className="inp !h-10 text-[16px]"
              />
              <input
                type="text"
                placeholder={newProvider === 'Bank Account' ? 'Account / IBAN' : '03XX-XXXXXXX'}
                value={newAccountNumber}
                onChange={(e) => setNewAccountNumber(e.target.value)}
                className="inp !h-10 text-[16px] num"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Bank name / IBAN / Note (optional)"
                value={newIbanOrNote}
                onChange={(e) => setNewIbanOrNote(e.target.value)}
                className="inp !h-10 text-[16px] flex-1"
              />
              <button type="submit" className="btn s sm !h-10 shrink-0">
                <Plus className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
          </form>
        </section>

        {/* 5. App Lock & Privacy Card (Span 6 on desktop) */}
        <section
          className="c t-vi"
          style={{ '--s': 12, '--m': 6, '--d': 6 } as React.CSSProperties}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="chip">
              <Lock className="w-3.5 h-3.5 mr-1" /> Screen Lock &amp; Privacy
            </span>
            <span className={`chip ${appLockPin ? 'g' : ''}`}>
              {appLockPin ? 'PIN Active' : 'Unlocked'}
            </span>
          </div>

          <h2 className="bento-h2">
            <span>App Lock &amp; Hide Amounts</span>
          </h2>

          {/* Honest Security Notice */}
          <div className="p-3 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] flex items-start gap-2.5 text-xs text-[var(--mu)] mb-3.5">
            <ShieldAlert className="w-4 h-4 text-[var(--su)] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[var(--tx)]">Honest privacy note:</strong> App Lock is a convenience screen lock that locks on open and after 2 minutes in the background. It is a UI screen lock, not cryptographic data encryption.
            </span>
          </div>

          {/* Hide Amounts Toggle Row */}
          <div className="min-h-[64px] px-3.5 py-2.5 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {hideAmounts ? (
                <EyeOff className="w-4 h-4 text-[var(--em)] shrink-0" />
              ) : (
                <Eye className="w-4 h-4 text-[var(--mu)] shrink-0" />
              )}
              <div className="min-w-0">
                <b className="text-xs text-[var(--tx)] block">Hide amounts on screen</b>
                <span className="text-[11px] text-[var(--mu)]">
                  Masks rupee balances as Rs •••• across all screens
                </span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hideAmounts}
              onClick={toggleHideAmounts}
              className={`tg ${hideAmounts ? 'on' : ''}`}
            />
          </div>

          {/* 4-Digit PIN Controls */}
          {appLockPin && !isEditingPin ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={lockAppNow}
                className="btn sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Screen Now</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPin(true)}
                className="btn s sm"
              >
                <span>Change PIN</span>
              </button>
              <button
                type="button"
                onClick={handleDisablePin}
                className="btn s sm !text-[var(--ro)]"
              >
                <span>Remove PIN</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSavePin} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="inp !h-11 text-[16px] text-center tracking-widest num"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Confirm PIN"
                  value={pinConfirmInput}
                  onChange={(e) =>
                    setPinConfirmInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  className="inp !h-11 text-[16px] text-center tracking-widest num"
                />
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" className="btn sm">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{appLockPin ? 'Update 4-Digit PIN' : 'Enable 4-Digit PIN'}</span>
                </button>
                {isEditingPin && (
                  <button
                    type="button"
                    onClick={() => setIsEditingPin(false)}
                    className="btn s sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </section>

        {/* 6. Gmail Reminders Card (Span 6 on desktop) */}
        <section
          className="c"
          style={{ '--s': 12, '--m': 6, '--d': 6 } as React.CSSProperties}
        >
          <div className="chips mb-2">
            <span className="chip">
              <Mail className="w-3.5 h-3.5 mr-1.5" /> Gmail reminders
            </span>
          </div>

          <h2 className="bento-h2">
            <span>Gmail reminders</span>
          </h2>
          <p className="mu mb-4">
            Send automated reminder emails with your saved payment details to friends when expenses are split or balances are updated.
          </p>

          <div className="p-3.5 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--mu)] space-y-1 mb-4">
            <b className="text-[var(--tx)] block">Quick connection tip</b>
            <p>
              If Google shows a verification prompt during setup, choose{' '}
              <strong className="text-[var(--tx)]">Advanced</strong> and continue to grant Gmail access.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              onClick={handleConnectWorkspace}
              isLoading={isConnectingWorkspace}
              icon={<Mail className="w-4 h-4" />}
            >
              Connect Gmail
            </Button>

            <div className="flex items-center gap-2">
              <span className="chip">
                Queue: {queuedEmails.length}
              </span>
              {queuedEmails.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleProcessMailQueue}
                  isLoading={isProcessingMail}
                >
                  Send queue
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* 7. Device & Browser Notifications Card (Span 6 on desktop) */}
        <section
          className="c"
          style={{ '--s': 12, '--m': 6, '--d': 6 } as React.CSSProperties}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="bento-h2 !mb-0">
              <span>Browser Notifications</span>
            </h2>
            <span
              className={`chip ${
                permStatus === 'granted' ? 'g' : ''
              }`}
            >
              {permStatus === 'granted'
                ? 'Active'
                : permStatus === 'denied'
                ? 'Blocked'
                : 'Disabled'}
            </span>
          </div>

          <p className="mu mb-4">
            Get instant alerts on your device when friends split bills, flag a dispute, settle balances, or send voice notes.
          </p>

          {permStatus !== 'granted' ? (
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                const res = await requestWebNotificationPermission();
                if (res === 'granted') {
                  showToast({ type: 'success', message: 'Web notifications enabled!' });
                  sendWebNotification('Hisaab', {
                    body: 'Notifications are on. You will get alerts for new expenses and payments.',
                  });
                } else {
                  showToast({ type: 'info', message: 'Permission was not granted in browser.' });
                }
              }}
            >
              <Bell className="w-4 h-4" />
              <span>Enable Notifications</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn s sm"
              onClick={() => {
                const ok = sendWebNotification('Hisaab', {
                  body: 'Notifications are on. You will get alerts for new expenses and payments.',
                });
                if (ok) {
                  showToast({ type: 'success', message: 'Test notification sent to your device!' });
                } else {
                  showToast({ type: 'info', message: 'Could not send test notification.' });
                }
              }}
            >
              <Bell className="w-4 h-4" />
              <span>Send Test Alert</span>
            </button>
          )}
        </section>

        {/* 8. Data & Reset Actions Card (Span 6 on desktop) */}
        <section
          className="c t-ro"
          style={{ '--s': 12, '--m': 6, '--d': 6 } as React.CSSProperties}
        >
          <h2 className="bento-h2">
            <span>Personal Data &amp; Demo Records</span>
          </h2>
          <p className="mu mb-4">
            Clear your personal solo expenses or reload sample records. Shared split bills, squad hisaab, and friends&apos; owed balances are always protected.
          </p>

          <div className="row">
            <button
              type="button"
              onClick={loadSampleData}
              className="btn s sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload October records</span>
            </button>

            <button
              type="button"
              onClick={() => clearAllData()}
              className="btn sm"
              style={{ background: 'var(--ro)', color: '#2a0a14' }}
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear personal data</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
