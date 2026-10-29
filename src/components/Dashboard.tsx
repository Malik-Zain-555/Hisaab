import React, { useMemo, useState, useEffect, Suspense } from 'react';
import { useApp } from '../context/AppContext';
import { formatPKR, formatShortDate } from '../lib/formatters';
import {
  Plus,
  Utensils,
  Coffee,
  Home,
  GraduationCap,
  Car,
  User,
  Tag,
} from 'lucide-react';
import { ExpenseCategory, Expense, UserProfile } from '../types';
import { AnimatedNumber, StaggerItem, SheetSkeleton, m } from '../ui';
import {
  LazyKhataSettlementModal,
  LazyTransactionDetailModal,
  LazyAddFriendModal,
  LazyFriendLedgerSheet,
  preloadScreen,
} from '../lib/preloadRoutes';

export const CATEGORY_STYLES: {
  [key in ExpenseCategory]: { bg: string; color: string; hex: string; icon: React.ReactNode };
} = {
  Food: {
    bg: 'bg-[#2EF2A0]',
    color: 'text-[#10081f]',
    hex: 'var(--em)',
    icon: <Utensils className="w-5 h-5" />,
  },
  Snacks: {
    bg: 'bg-[#FFC83D]',
    color: 'text-[#10081f]',
    hex: 'var(--su)',
    icon: <Coffee className="w-5 h-5" />,
  },
  Rent: {
    bg: 'bg-[#22D3EE]',
    color: 'text-[#10081f]',
    hex: 'var(--cy)',
    icon: <Home className="w-5 h-5" />,
  },
  Study: {
    bg: 'bg-[#7C5CFF]',
    color: 'text-[#10081f]',
    hex: 'var(--vi)',
    icon: <GraduationCap className="w-5 h-5" />,
  },
  Transport: {
    bg: 'bg-[#22D3EE]',
    color: 'text-[#10081f]',
    hex: 'var(--cy)',
    icon: <Car className="w-5 h-5" />,
  },
  Personal: {
    bg: 'bg-[#FF5C8A]',
    color: 'text-[#10081f]',
    hex: 'var(--ro)',
    icon: <User className="w-5 h-5" />,
  },
  Other: {
    bg: 'bg-[#FF5C8A]',
    color: 'text-[#10081f]',
    hex: 'var(--ro)',
    icon: <Tag className="w-5 h-5" />,
  },
};

const FRIEND_TILE_COLORS = ['#0EA5A4', '#7C5CFF', '#FF5C8A', '#2EF2A0', '#FFC83D'];
const WEEK_BAR_COLORS = ['#2EF2A0', '#FFC83D', '#FF5C8A', '#22D3EE', '#7C5CFF', '#2EF2A0', '#FFC83D'];

function triggerConfettiBurst(x: number, y: number) {
  if (typeof document === 'undefined') return;
  const colors = ['#2EF2A0', '#FFC83D', '#FF5C8A', '#7C5CFF', '#22D3EE'];
  for (let i = 0; i < 24; i++) {
    const dot = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const radius = 60 + Math.random() * 120;
    dot.style.cssText = `position:fixed;z-index:120;left:${x}px;top:${y}px;width:9px;height:9px;border-radius:${
      i % 2 ? '50%' : '2px'
    };background:${colors[i % 5]};pointer-events:none`;
    document.body.appendChild(dot);
    const anim = dot.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * radius}px,${
            Math.sin(angle) * radius + 60
          }px) rotate(360deg) scale(0.4)`,
          opacity: 0,
        },
      ],
      { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' }
    );
    anim.onfinish = () => dot.remove();
  }
}

export const Dashboard: React.FC<{
  onOpenQuickAdd: () => void;
  onOpenWalletSettings?: () => void;
  onSelectTab: (tab: any) => void;
  onSelectFriend?: (friendId: string) => void;
}> = ({
  onOpenQuickAdd,
  onOpenWalletSettings,
  onSelectTab,
}) => {
  const {
    currentUser,
    currentMonth,
    activeExpenses,
    friends,
    friendBalance,
    sendNudge,
    selectedMonthKey,
    toggleFixedExpensePaid,
    clearNotificationsForTarget,
    hideAmounts,
    setHideAmounts,
    setActiveScreen,
  } = useApp();

  useEffect(() => {
    clearNotificationsForTarget('expense');
  }, [clearNotificationsForTarget]);

  const [isKhataModalOpen, setIsKhataModalOpen] = useState(false);
  const [khataInitialFilter, setKhataInitialFilter] = useState<'all' | 'owe_me' | 'i_owe'>('all');
  const [selectedExpenseForDetail, setSelectedExpenseForDetail] = useState<Expense | null>(null);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [selectedFriendForLedger, setSelectedFriendForLedger] = useState<UserProfile | null>(null);

  // Sync activeScreen when opening Friend Ledger so secondary Firebase listeners attach on demand
  useEffect(() => {
    if (selectedFriendForLedger) {
      setActiveScreen('ledger');
      return () => setActiveScreen('home');
    }
  }, [selectedFriendForLedger, setActiveScreen]);

  const handleToggleHideAmounts = () => {
    setHideAmounts(!hideAmounts);
  };

  // Current month active expenses
  const monthExpenses = useMemo(() => {
    return activeExpenses
      .filter((e) => e.date.startsWith(selectedMonthKey))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeExpenses, selectedMonthKey]);

  // Personal share of variable expenses
  const totalVariableSpent = useMemo(
    () =>
      monthExpenses.reduce((sum, e) => {
        if (e.splits && e.splits.length > 0) {
          const mySplit = e.splits.find((s) => s.userId === currentUser.uid);
          if (mySplit) return sum + mySplit.share;
          if (e.paidBy === 'me' || e.paidBy === currentUser.uid) {
            return sum;
          }
        }
        return sum + e.amount;
      }, 0),
    [monthExpenses, currentUser.uid]
  );

  const fixedList = currentMonth.fixedExpenses || [];
  const fixedPaidTotal = useMemo(
    () => fixedList.filter((f) => f.paid).reduce((sum, f) => sum + f.amount, 0),
    [fixedList]
  );

  const isMyMonthBudget =
    !currentMonth.userId || (currentUser.uid && currentMonth.userId === currentUser.uid);
  const myBudget = isMyMonthBudget ? currentMonth.budget : 0;
  const myCarryOver = isMyMonthBudget ? currentMonth.carryOver || 0 : 0;
  const totalSpent = totalVariableSpent + fixedPaidTotal;
  const hasBudgetSet = myBudget > 0;
  const totalAvailableFunds = hasBudgetSet ? myBudget + myCarryOver : 20000;
  const remainingBudget = Math.max(0, totalAvailableFunds - totalSpent);
  const percentUsed = Math.min(
    100,
    Math.round((totalSpent / Math.max(1, totalAvailableFunds)) * 100)
  );

  // Days left in month
  const now = new Date();
  const currentDay = now.getDate();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, totalDays - currentDay + 1);
  const dailyLeft = remainingBudget > 0 ? Math.floor(remainingBudget / daysLeft) : 0;

  const monthOnlyName = useMemo(() => {
    try {
      const [year, month] = selectedMonthKey.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long' });
    } catch (_) {
      return 'this month';
    }
  }, [selectedMonthKey]);

  // Khata net balance across all friends
  const khataSummary = useMemo(() => {
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

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const totals: { [cat in ExpenseCategory]?: number } = {};
    let catSum = 0;
    monthExpenses.forEach((exp) => {
      totals[exp.category] = (totals[exp.category] || 0) + exp.amount;
      catSum += exp.amount;
    });

    return (Object.entries(totals) as [ExpenseCategory, number][])
      .map(([category, amount]) => ({
        category,
        amount,
        percent: catSum > 0 ? Math.max(1, Math.round((amount / catSum) * 100)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  // Weekly 7 bars
  const [selectedBarDay, setSelectedBarDay] = useState<number | null>(null);
  const weekBars = useMemo(() => {
    const days: { day: number; label: string; dateStr: string; amount: number; color: string }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const startDay = Math.max(1, currentDay - 6);
    let idx = 0;
    for (let i = startDay; i <= currentDay; i++) {
      const dStr = `${selectedMonthKey}-${String(i).padStart(2, '0')}`;
      const sum = monthExpenses
        .filter((e) => e.date === dStr)
        .reduce((s, e) => s + e.amount, 0);

      const [yr, mo] = selectedMonthKey.split('-');
      const dateObj = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, i);
      days.push({
        day: i,
        label: i === currentDay ? 'Today' : dayNames[dateObj.getDay()],
        dateStr: dStr,
        amount: sum,
        color: WEEK_BAR_COLORS[idx % WEEK_BAR_COLORS.length],
      });
      idx++;
    }
    const max = Math.max(...days.map((d) => d.amount), 150);
    return { days, max };
  }, [monthExpenses, selectedMonthKey, currentDay]);

  const activeBarDay = selectedBarDay ?? currentDay;
  const activeBarObj = weekBars.days.find((d) => d.day === activeBarDay);

  // Live Marquee Text
  const marqueeText = useMemo(() => {
    const parts: string[] = [];
    friends.forEach((f) => {
      const bal = friendBalance(f.uid);
      if (bal > 0) {
        parts.push(`${f.displayName} owes ${formatPKR(bal)}`);
      } else if (bal < 0) {
        parts.push(`You owe ${f.displayName} ${formatPKR(Math.abs(bal))}`);
      } else {
        parts.push(`${f.displayName} is settled`);
      }
    });
    fixedList.forEach((bill) => {
      parts.push(`${bill.title} is ${bill.paid ? 'paid' : 'due'}`);
    });
    if (parts.length === 0) {
      parts.push(
        'Your money, sorted',
        `Spent ${formatPKR(totalSpent)} in ${monthOnlyName}`,
        `Safe to spend ${formatPKR(dailyLeft)} today`
      );
    }
    const unit = parts.join(' ✦ ') + ' ✦ ';
    return unit + unit + unit + unit;
  }, [friends, friendBalance, fixedList, totalSpent, monthOnlyName, dailyLeft]);

  const paidFixedCount = fixedList.filter((f) => f.paid).length;

  return (
    <div>
      {/* Tilted Yellow Marquee Ribbon */}
      <div className="mq" aria-hidden="true">
        <div>{marqueeText}</div>
      </div>

      {/* 12-Column Maximal Bento Grid */}
      <div className="bento">
        {/* 1. Hero Card (Span 8 on desktop) */}
        <section
          className="c hero t-em"
          style={{ '--s': 12, '--m': 12, '--d': 8 } as React.CSSProperties}
        >
          <div className="cn3" aria-hidden="true">
            Rs
          </div>
          <div className="chips">
            <span className="chip g">
              {khataSummary.netBal > 0
                ? 'Friends owe you'
                : khataSummary.netBal < 0
                ? 'You owe friends'
                : 'All settled up'}
            </span>
            <button
              type="button"
              className="chip cursor-pointer hover:bg-white/20 transition-colors"
              onClick={handleToggleHideAmounts}
            >
              {hideAmounts ? 'Show amounts' : 'Hide amounts'}
            </button>
          </div>

          <span id="bal" className="dp num" aria-live="polite">
            <AnimatedNumber
              value={Math.abs(khataSummary.netBal)}
              prefix={khataSummary.netBal >= 0 ? '+' : '−'}
            />
          </span>

          <p className="mu">Your real khata balance across all friends</p>

          <div className="two">
            <div
              onClick={() => {
                setKhataInitialFilter('owe_me');
                setIsKhataModalOpen(true);
              }}
              className="cursor-pointer hover:bg-black/40 transition-colors"
            >
              <span className="mu">Friends owe you</span>
              <b className="num in">
                <AnimatedNumber value={khataSummary.friendsOweMe} />
              </b>
            </div>
            <div
              onClick={() => {
                setKhataInitialFilter('i_owe');
                setIsKhataModalOpen(true);
              }}
              className="cursor-pointer hover:bg-black/40 transition-colors"
            >
              <span className="mu">You owe</span>
              <b className="num out">
                <AnimatedNumber value={khataSummary.iOweFriends} />
              </b>
            </div>
          </div>

          <div className="row">
            <button type="button" className="btn" onClick={onOpenQuickAdd}>
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>Add expense</span>
            </button>
            <button
              type="button"
              className="btn s"
              onClick={() => {
                setKhataInitialFilter('all');
                setIsKhataModalOpen(true);
              }}
            >
              Settle up
            </button>
          </div>
        </section>

        {/* 2. Safe to spend today (Span 4 on desktop) */}
        <section
          className="c t-su cursor-pointer"
          style={{ '--s': 12, '--m': 6, '--d': 4 } as React.CSSProperties}
          onClick={() => onOpenWalletSettings?.()}
          title="Click to adjust monthly budget"
        >
          <span className="mu">Safe to spend today</span>
          <b className="amt num" style={{ fontSize: 'clamp(30px, 17cqw, 56px)' }}>
            <AnimatedNumber value={dailyLeft} />
          </b>
          <span className="mu">
            {formatPKR(remainingBudget)} left over {daysLeft} days
          </span>
          <p style={{ marginTop: 14, fontWeight: 600 }}>
            Stay under this and {monthOnlyName} ends on budget.
          </p>
        </section>

        {/* 3. Spent this month (Span 4 on desktop) */}
        <section
          className="c t-vi cursor-pointer"
          style={{ '--s': 12, '--m': 6, '--d': 4 } as React.CSSProperties}
          onMouseEnter={() => preloadScreen('settings')}
          onClick={() => onOpenWalletSettings?.()}
        >
          <div className="rh">
            <div style={{ minWidth: 0 }}>
              <span className="mu">Spent this month</span>
              <b className="amt num">
                <AnimatedNumber value={totalSpent} />
              </b>
            </div>
            <m.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="ring"
              style={{ '--p': percentUsed } as React.CSSProperties}
              data-t={`${percentUsed}%`}
            />
          </div>
          <p className="mu" style={{ marginTop: 10 }}>
            {monthExpenses.length} transactions · {formatPKR(remainingBudget)} left of{' '}
            {formatPKR(totalAvailableFunds)}
          </p>
        </section>

        {/* 4. Friends Grid (Span 8 on desktop) */}
        <section
          className="c"
          style={{ '--s': 12, '--m': 12, '--d': 8 } as React.CSSProperties}
        >
          <h2 className="bento-h2">
            <span>Friends</span>
            <button
              type="button"
              className="bento-link"
              onClick={() => onSelectTab('chat')}
            >
              See chats
            </button>
          </h2>

          <div className="fg">
            {friends.map((friend, idx) => {
              const bal = friendBalance(friend.uid);
              const tileColor = FRIEND_TILE_COLORS[idx % FRIEND_TILE_COLORS.length];
              const initial = (friend.displayName || 'F').charAt(0).toUpperCase();

              return (
                <StaggerItem
                  key={friend.uid}
                  index={idx}
                  className="f"
                >
                  <div
                    onMouseEnter={() => preloadScreen('ledger')}
                    onTouchStart={() => preloadScreen('ledger')}
                    onClick={() => setSelectedFriendForLedger(friend)}
                    className="flex flex-col items-start gap-2 w-full cursor-pointer"
                  >
                    <span className="fa" style={{ background: tileColor }}>
                      {friend.photoURL ? (
                        <img
                          src={friend.photoURL}
                          alt={friend.displayName}
                          width={46}
                          height={46}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initial
                      )}
                    </span>
                    <b>{friend.displayName}</b>
                    {bal > 0 ? (
                      <span className="num in">
                        <AnimatedNumber value={bal} />
                      </span>
                    ) : bal < 0 ? (
                      <span className="num out">
                        <AnimatedNumber value={Math.abs(bal)} prefix="−" />
                      </span>
                    ) : (
                      <span className="mu">Settled</span>
                    )}
                    {bal > 0 && (
                      <button
                        type="button"
                        className="btn s sm mt-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          sendNudge(friend.uid);
                        }}
                      >
                        Remind
                      </button>
                    )}
                  </div>
                </StaggerItem>
              );
            })}

            <button
              type="button"
              className="f d"
              onClick={() => setShowAddFriendModal(true)}
            >
              <span
                className="fa"
                style={{ background: 'none', border: '2px dashed var(--line)' }}
              >
                +
              </span>
              <span>Add friend</span>
            </button>
          </div>
        </section>

        {/* 5. This week (Span 7 on desktop) */}
        <section
          className="c"
          style={{ '--s': 12, '--m': 12, '--d': 7 } as React.CSSProperties}
        >
          <h2 className="bento-h2">
            <span>This week</span>
            <span className="mu">
              {selectedBarDay !== null && activeBarObj
                ? `${activeBarObj.label} · ${formatPKR(activeBarObj.amount)}`
                : 'Tap a day'}
            </span>
          </h2>

          <div className="wk">
            {weekBars.days.map((d, barIdx) => {
              const heightPct = Math.max(Math.round((d.amount / weekBars.max) * 100), 7);
              const isSelected = d.day === activeBarDay;
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setSelectedBarDay(d.day)}
                  className={isSelected ? 'on' : ''}
                  aria-label={`${d.label} ${formatPKR(d.amount)}`}
                >
                  <m.i
                    initial={{ scaleY: 0, opacity: 0.4 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{
                      duration: 0.28,
                      delay: Math.min(barIdx, 7) * 0.03,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={
                      {
                        '--c': d.color,
                        '--h': `${heightPct}%`,
                        height: `${heightPct}%`,
                        transformOrigin: 'bottom',
                      } as React.CSSProperties
                    }
                  />
                  <span>{d.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 6. Where it went (Span 5 on desktop) */}
        <section
          className="c"
          style={{ '--s': 12, '--m': 6, '--d': 5 } as React.CSSProperties}
        >
          <h2 className="bento-h2">
            <span>Where it went</span>
          </h2>

          {categoryBreakdown.length === 0 ? (
            <p className="mu py-8 text-center">No expenses logged this month yet.</p>
          ) : (
            <>
              <div className="seg">
                {categoryBreakdown.map((item) => {
                  const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.Other;
                  return (
                    <i
                      key={item.category}
                      style={
                        {
                          '--c': style.hex,
                          '--w': Math.max(item.percent, 2),
                        } as React.CSSProperties
                      }
                    />
                  );
                })}
              </div>

              <div className="lg2">
                {categoryBreakdown.map((item) => {
                  const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.Other;
                  return (
                    <div key={item.category}>
                      <i style={{ '--c': style.hex } as React.CSSProperties} />
                      <span>{item.category}</span>
                      <b className="num">{formatPKR(item.amount)}</b>
                      <em>{item.percent}%</em>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* 7. Fixed bills (Span 5 on desktop) */}
        <section
          className="c"
          style={{ '--s': 12, '--m': 6, '--d': 5 } as React.CSSProperties}
        >
          <h2 className="bento-h2">
            <span>Fixed bills</span>
            <span className="mu">
              {paidFixedCount} of {fixedList.length} paid
            </span>
          </h2>

          {fixedList.length === 0 ? (
            <div className="py-4">
              <p className="mu">No fixed bills configured.</p>
              {onOpenWalletSettings && (
                <button
                  type="button"
                  onClick={onOpenWalletSettings}
                  className="btn s sm mt-3"
                >
                  Configure bills
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {fixedList.map((bill) => (
                <div key={bill.id} className="bill">
                  <span
                    className="ct"
                    style={{ '--c': 'var(--cy)' } as React.CSSProperties}
                  >
                    <Home className="w-5 h-5" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <b className="truncate">{bill.title}</b>
                      {bill.isShared && bill.splitFriendIds && bill.splitFriendIds.length > 0 && (
                        <span className="chip g !h-5 !px-2 !text-[10px]">
                          Shared ({bill.splitFriendIds.length + 1})
                        </span>
                      )}
                      {bill.dueDay && (
                        <span className="chip !h-5 !px-2 !text-[10px]">
                          Due {bill.dueDay}
                        </span>
                      )}
                    </div>
                    <div className="mu">
                      {bill.paid ? 'Paid' : 'Due'} · <span className="num">{formatPKR(bill.amount)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="tg"
                    role="switch"
                    aria-checked={bill.paid}
                    aria-label={`${bill.title} paid`}
                    onClick={(e) => {
                      const nextPaid = !bill.paid;
                      toggleFixedExpensePaid(bill.id);
                      if (nextPaid) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        triggerConfettiBurst(rect.left + 26, rect.top + 15);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 8. Recent expenses (Span 7 on desktop) */}
        <section
          className="c"
          style={{ '--s': 12, '--m': 12, '--d': 7 } as React.CSSProperties}
        >
          <h2 className="bento-h2">
            <span>Recent expenses</span>
            <button
              type="button"
              className="bento-link"
              onClick={() => onSelectTab('history')}
            >
              View all
            </button>
          </h2>

          {monthExpenses.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mu mb-3">No expenses recorded in {monthOnlyName} yet.</p>
              <button type="button" className="btn sm" onClick={onOpenQuickAdd}>
                <Plus className="w-4 h-4" />
                <span>Add first expense</span>
              </button>
            </div>
          ) : (
            <ul className="li">
              {monthExpenses.slice(0, 5).map((exp) => {
                const catStyle = CATEGORY_STYLES[exp.category] || CATEGORY_STYLES.Other;
                const isPaidByMe =
                  !exp.paidBy || exp.paidBy === 'me' || exp.paidBy === currentUser.uid;
                const payerFriend = !isPaidByMe
                  ? friends.find((f) => f.uid === exp.paidBy)
                  : null;
                const paidLabel = isPaidByMe
                  ? 'Paid by you'
                  : `Paid by ${payerFriend?.displayName || 'Friend'}`;

                // Calculate how much friends owe user on this expense
                let owedToMe = 0;
                if (isPaidByMe && exp.splits && exp.splits.length > 0) {
                  owedToMe = exp.splits
                    .filter((s) => s.userId !== currentUser.uid)
                    .reduce((acc, s) => acc + s.share, 0);
                }

                return (
                  <li
                    key={exp.id}
                    onClick={() => setSelectedExpenseForDetail(exp)}
                  >
                    <span
                      className="ct"
                      style={{ '--c': catStyle.hex } as React.CSSProperties}
                    >
                      {catStyle.icon}
                    </span>
                    <div className="t">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <b className="truncate">{exp.note || exp.category}</b>
                        {exp.dispute?.status === 'disputed' && (
                          <span className="chip r !h-5 !px-2 !text-[10px] shrink-0">
                            Disputed
                          </span>
                        )}
                      </div>
                      <span className="mu">
                        {paidLabel} · {formatShortDate(exp.date)}
                      </span>
                    </div>
                    <div className="r">
                      <b className="num">{formatPKR(exp.amount)}</b>
                      {owedToMe > 0 && (
                        <small>+{formatPKR(owedToMe)} owed to you</small>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Code-split Modals & Sheets */}
      {isKhataModalOpen && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyKhataSettlementModal
            isOpen={isKhataModalOpen}
            onClose={() => setIsKhataModalOpen(false)}
            initialFilter={khataInitialFilter}
            onOpenFriendLedger={(friend) => setSelectedFriendForLedger(friend)}
          />
        </Suspense>
      )}

      {selectedExpenseForDetail && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyTransactionDetailModal
            expense={selectedExpenseForDetail}
            isOpen={Boolean(selectedExpenseForDetail)}
            onClose={() => setSelectedExpenseForDetail(null)}
          />
        </Suspense>
      )}

      {showAddFriendModal && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyAddFriendModal
            isOpen={showAddFriendModal}
            onClose={() => setShowAddFriendModal(false)}
          />
        </Suspense>
      )}

      {selectedFriendForLedger && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyFriendLedgerSheet
            friend={selectedFriendForLedger}
            isOpen={Boolean(selectedFriendForLedger)}
            onClose={() => setSelectedFriendForLedger(null)}
          />
        </Suspense>
      )}
    </div>
  );
};
