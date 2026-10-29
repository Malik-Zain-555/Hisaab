import React, { useState, useMemo, Suspense } from 'react';
import { useApp } from '../context/AppContext';
import { Expense, ExpenseCategory } from '../types';
import {
  Search,
  FileDown,
  Trash2,
  RotateCcw,
  X,
  Receipt,
} from 'lucide-react';
import {
  formatPKR,
  formatShortDate,
  formatDateGroupHeading,
  formatMonthDisplay,
} from '../lib/formatters';
import {
  Chip,
  Button,
  Card,
  EmptyState,
  Modal,
  ReceiptThumb,
  VirtualList,
  StaggerItem,
  AnimatedNumber,
  SheetSkeleton,
} from '../ui';
import { CATEGORY_STYLES } from './Dashboard';
import { LazyTransactionDetailModal, LazyEditExpenseModal } from '../lib/preloadRoutes';
import { exportMonthlyHistoryPDF, preloadPdfExport } from '../lib/pdfExport';

const CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Snacks',
  'Rent',
  'Study',
  'Transport',
  'Personal',
  'Other',
];

export const HistoryView: React.FC = () => {
  const {
    currentUser,
    activeExpenses,
    trashExpenses,
    updateExpense,
    deleteExpense,
    undoDeleteExpense,
    permanentlyDeleteExpense,
    isOwnerMode,
    friends,
    selectedMonthKey,
    clearNotificationsForTarget,
    showToast,
  } = useApp();

  // Auto-clear expense-related notifications when visiting history view
  React.useEffect(() => {
    clearNotificationsForTarget('expense');
  }, [clearNotificationsForTarget]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  const [showTrash, setShowTrash] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const [selectedExpenseForDetail, setSelectedExpenseForDetail] = useState<Expense | null>(null);

  // Edit Expense Sheet
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('Food');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');

  const listToFilter = showTrash ? trashExpenses : activeExpenses;

  const filteredExpenses = useMemo(() => {
    return listToFilter
      .filter((exp) => {
        if (!exp.date.startsWith(selectedMonthKey)) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = exp.title.toLowerCase().includes(q);
          const matchesNote = exp.note?.toLowerCase().includes(q);
          const matchesCat = exp.category.toLowerCase().includes(q);
          const matchesPayer = exp.paidByName.toLowerCase().includes(q);
          if (!matchesTitle && !matchesNote && !matchesCat && !matchesPayer) return false;
        }

        if (selectedCategory !== 'all' && exp.category !== selectedCategory) {
          return false;
        }

        if (selectedPerson !== 'all') {
          const isInSplits = exp.splits.some((s) => s.userId === selectedPerson);
          const isPayer = exp.paidBy === selectedPerson;
          if (!isInSplits && !isPayer) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [listToFilter, selectedMonthKey, searchQuery, selectedCategory, selectedPerson]);

  // Group by day ("Today", "Yesterday", or formatted date)
  const groupedExpenses = useMemo(() => {
    const groups: { [day: string]: Expense[] } = {};
    filteredExpenses.forEach((exp) => {
      const heading = formatDateGroupHeading(exp.date);
      if (!groups[heading]) groups[heading] = [];
      groups[heading].push(exp);
    });
    return groups;
  }, [filteredExpenses]);

  // Total filtered volume
  const totalFilteredVolume = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpenses]);

  // Friend's personal spending (their actual share in split bills, NOT the total bill amounts!)
  const selectedPersonTotalSpend = useMemo(() => {
    if (selectedPerson === 'all') return 0;
    return filteredExpenses.reduce((sum, exp) => {
      if (exp.splits && exp.splits.length > 0) {
        const s = exp.splits.find((sp) => sp.userId === selectedPerson);
        if (s) return sum + s.share;
      } else if (exp.paidBy === selectedPerson) {
        return sum + exp.amount;
      }
      return sum;
    }, 0);
  }, [filteredExpenses, selectedPerson]);

  const monthTrashCount = useMemo(() => {
    return trashExpenses.filter((e) => e.date.startsWith(selectedMonthKey)).length;
  }, [trashExpenses, selectedMonthKey]);

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setEditTitle(exp.title);
    setEditAmount(exp.amount.toString());
    setEditCategory(exp.category);
    setEditDate(exp.date);
    setEditNote(exp.note || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const val = parseFloat(editAmount);
    if (isNaN(val) || val <= 0 || !editTitle.trim()) return;

    let updatedSplits = editingExpense.splits;
    if (editingExpense.splits && editingExpense.splits.length > 0 && editingExpense.amount > 0) {
      const ratio = val / editingExpense.amount;
      updatedSplits = editingExpense.splits.map((s) => ({
        ...s,
        share: Math.round(s.share * ratio),
      }));
    }

    await updateExpense(editingExpense.id, {
      title: editTitle.trim(),
      amount: val,
      category: editCategory,
      date: editDate,
      note: editNote.trim() || undefined,
      splits: updatedSplits,
    });

    setEditingExpense(null);
  };

  const handleExportPDF = async () => {
    await exportMonthlyHistoryPDF(selectedMonthKey, filteredExpenses);
    showToast({ type: 'success', message: 'Statement PDF downloaded.' });
  };

  return (
    <div className="space-y-4">
      {/* Top Glass Header & KPI Summary Card */}
      <Card className="cq-card">
        <div className="ch">
          <div>
            <div className="chips mb-2">
              <Chip active={!showTrash}>
                {showTrash ? 'Trash Bin' : formatMonthDisplay(selectedMonthKey)}
              </Chip>
              {selectedCategory !== 'all' && <Chip active>{selectedCategory}</Chip>}
              {selectedPerson !== 'all' && (
                <Chip active>
                  {friends.find((f) => f.uid === selectedPerson)?.displayName || 'Friend'}
                </Chip>
              )}
            </div>
            <h2>{showTrash ? 'Deleted Expenses' : 'Expense History'}</h2>
            <p className="sub">
              {showTrash
                ? `${filteredExpenses.length} deleted item${filteredExpenses.length === 1 ? '' : 's'} in this month · restore anytime`
                : `${filteredExpenses.length} transaction${filteredExpenses.length === 1 ? '' : 's'}${searchQuery ? ` matching "${searchQuery}"` : ''}`}
            </p>
          </div>

          <div
            className="flex items-center gap-2 flex-wrap"
            onMouseEnter={() => preloadPdfExport()}
            onTouchStart={() => preloadPdfExport()}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportPDF}
              icon={<FileDown className="w-4 h-4" />}
            >
              Export PDF
            </Button>

            <Button
              variant={showTrash ? 'danger' : 'secondary'}
              size="sm"
              onClick={() => setShowTrash(!showTrash)}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {showTrash
                ? 'Exit Trash'
                : `Trash${monthTrashCount > 0 ? ` (${monthTrashCount})` : ''}`}
            </Button>
          </div>
        </div>

        {/* Summary KPI Strip (Amounts never wrap, container-query sized) */}
        <div className="two !mt-2 mb-4">
          <div className="cq-card">
            <span>{showTrash ? 'Deleted Volume' : 'Filtered Total'}</span>
            <b className="em whitespace-nowrap font-money tabular-nums cq-amount-lg">
              <AnimatedNumber value={totalFilteredVolume} />
            </b>
          </div>
          <div className="cq-card">
            <span>
              {selectedPerson !== 'all'
                ? `${friends.find((f) => f.uid === selectedPerson)?.displayName?.split(' ')[0] || 'Friend'}'s Share`
                : 'Transactions'}
            </span>
            <b className="whitespace-nowrap font-money tabular-nums cq-amount-lg text-[var(--tx)]">
              {selectedPerson !== 'all'
                ? formatPKR(selectedPersonTotalSpend)
                : `${filteredExpenses.length} ${filteredExpenses.length === 1 ? 'bill' : 'bills'}`}
            </b>
          </div>
        </div>

        {/* Search Input (16px font size so iOS does not zoom) */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--mu)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search expenses by title, note, category, or person..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="f !pl-11 !pr-10 !h-12 !text-[16px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--surface-2)] text-[var(--mu)] hover:text-[var(--tx)] cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Chips (horizontally scrolling row with edge fade) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mu)] px-1 block">
              Categories
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar mask-fade-x">
              <Chip
                active={selectedCategory === 'all'}
                onClick={() => setSelectedCategory('all')}
              >
                All categories
              </Chip>
              {CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  active={selectedCategory === cat}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat ? 'all' : cat)
                  }
                >
                  {cat}
                </Chip>
              ))}
            </div>
          </div>

          {/* Person Filter Chips (horizontally scrolling row with edge fade) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mu)] px-1 block">
              People
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar mask-fade-x">
              <Chip
                size="sm"
                active={selectedPerson === 'all'}
                onClick={() => setSelectedPerson('all')}
              >
                Everyone
              </Chip>
              {friends.map((f) => (
                <Chip
                  key={f.uid}
                  size="sm"
                  active={selectedPerson === f.uid}
                  onClick={() =>
                    setSelectedPerson(selectedPerson === f.uid ? 'all' : f.uid)
                  }
                >
                  {f.displayName.split(' ')[0]}
                </Chip>
              ))}
              {(searchQuery || selectedCategory !== 'all' || selectedPerson !== 'all') && (
                <Chip
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedPerson('all');
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </Chip>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Day-Grouped Expenses with Sticky Date Headers & Daily Totals */}
      {Object.entries(groupedExpenses).length === 0 ? (
        <Card>
          <EmptyState
            icon={showTrash ? <Trash2 className="w-6 h-6" /> : <Receipt className="w-6 h-6" />}
            title={showTrash ? 'Trash is empty' : 'No expenses found'}
            subtitle={
              showTrash
                ? 'Deleted expenses from this month will appear here for recovery.'
                : 'Try adjusting your search query, category, or friend filter.'
            }
            actionText={
              searchQuery || selectedCategory !== 'all' || selectedPerson !== 'all'
                ? 'Reset Filters'
                : showTrash
                ? 'Back to Active'
                : undefined
            }
            onAction={
              searchQuery || selectedCategory !== 'all' || selectedPerson !== 'all'
                ? () => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedPerson('all');
                  }
                : showTrash
                ? () => setShowTrash(false)
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedExpenses).map(([dayLabel, exps]) => {
            const daySum = exps.reduce((acc, e) => acc + e.amount, 0);
            return (
              <div key={dayLabel} className="space-y-2">
                {/* Sticky Date Header with Daily Total */}
                <div className="sticky top-[78px] z-20 px-4 py-2.5 rounded-[18px] bg-[var(--surface-solid)]/92 backdrop-blur-xl border border-[var(--line)] flex items-center justify-between gap-3 shadow-sm cq-card">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-[var(--em)] shrink-0" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tx)] truncate">
                      {dayLabel}
                    </span>
                    <span className="text-[11px] font-bold text-[var(--mu)] shrink-0">
                      · {exps.length} {exps.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold font-money tabular-nums text-[var(--em)] whitespace-nowrap shrink-0 cq-amount">
                    {formatPKR(daySum)}
                  </span>
                </div>

                {/* Day's Transactions Glass Card (virtualized when > 24 items) */}
                <Card className="!p-3 sm:!p-4">
                  <VirtualList
                    items={exps}
                    estimateRowHeight={76}
                    threshold={24}
                    maxHeight={620}
                    className="li"
                    getKey={(exp) => exp.id}
                    renderItem={(exp, idx) => {
                      const catStyle =
                        CATEGORY_STYLES[exp.category] || CATEGORY_STYLES.Other;
                      const friendSplit = exp.splits.find(
                        (s) => s.userId !== 'me' && s.userId !== currentUser.uid
                      );
                      const subtitleText = friendSplit
                        ? `${friendSplit.userName} owes ${formatPKR(friendSplit.share)}`
                        : exp.splitType === 'personal'
                        ? 'Paid by you · Personal'
                        : `Paid by ${
                            exp.paidBy === 'me' || exp.paidBy === currentUser.uid
                              ? 'you'
                              : exp.paidByName
                          } · Split equally`;

                      const isSplit = Boolean(
                        exp.splits &&
                          exp.splits.length > 0 &&
                          exp.splits.some((s) => s.userId !== currentUser.uid)
                      );
                      const canDelete =
                        isOwnerMode ||
                        (isSplit
                          ? exp.createdBy === currentUser.uid
                          : exp.createdBy === currentUser.uid ||
                            exp.paidBy === currentUser.uid);

                      const personShare =
                        selectedPerson !== 'all'
                          ? exp.splits?.find((s) => s.userId === selectedPerson)
                              ?.share ?? exp.amount
                          : exp.amount;

                      return (
                        <StaggerItem key={exp.id} index={idx}>
                          <div
                            onClick={() => setSelectedExpenseForDetail(exp)}
                            className="group min-h-[64px] cursor-pointer cq-card grid grid-cols-[44px_1fr_auto] items-center gap-3.5 p-3 rounded-[18px] bg-white/5 border border-[var(--line)] hover:bg-white/10 transition-colors"
                          >
                            <span
                              className="ct shrink-0"
                              style={{ '--c': catStyle.hex } as React.CSSProperties}
                            >
                              {catStyle.icon}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="t flex items-center gap-1.5 flex-wrap">
                                <b className="truncate">{exp.title}</b>
                                {exp.dispute?.status === 'disputed' && (
                                  <span className="chip r !py-0.5 !px-2 !text-[10px]">
                                    Disputed
                                  </span>
                                )}
                                {exp.whatEat && (
                                  <span className="chip on !py-0.5 !px-2 !text-[10px]">
                                    🍽️ {exp.whatEat}
                                  </span>
                                )}
                                {exp.situation && (
                                  <span className="chip !py-0.5 !px-2 !text-[10px]">
                                    📍 {exp.situation}
                                  </span>
                                )}
                              </div>
                              <div className="mu text-xs truncate">
                                {subtitleText} · {formatShortDate(exp.date)}
                                {exp.timeWhen ? ` · ${exp.timeWhen}` : ''}
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                              {exp.proofOfPayment && (
                                <ReceiptThumb
                                  src={exp.proofOfPayment}
                                  alt="Receipt"
                                  size={36}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveLightboxImage(exp.proofOfPayment || null);
                                  }}
                                />
                              )}

                              <div className="r whitespace-nowrap text-right">
                                <div className="a ro whitespace-nowrap font-money tabular-nums cq-amount font-bold">
                                  −{formatPKR(personShare)}
                                </div>
                                {selectedPerson !== 'all' && isSplit ? (
                                  <div className="s whitespace-nowrap text-xs text-[var(--mu)]">
                                    Bill: {formatPKR(exp.amount)}
                                  </div>
                                ) : friendSplit ? (
                                  <div className="s whitespace-nowrap text-xs text-[var(--em)] font-bold">
                                    +{formatPKR(friendSplit.share)} owed
                                  </div>
                                ) : (
                                  <div className="s whitespace-nowrap text-xs text-[var(--mu)]">
                                    Personal
                                  </div>
                                )}
                              </div>

                              {showTrash ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      undoDeleteExpense(exp.id);
                                    }}
                                    className="ib !w-9 !h-9"
                                    title="Restore expense"
                                  >
                                    <RotateCcw className="w-4 h-4 text-[var(--em)]" />
                                  </button>
                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        permanentlyDeleteExpense(exp.id);
                                      }}
                                      className="ib !w-9 !h-9"
                                      title="Permanently delete"
                                    >
                                      <Trash2 className="w-4 h-4 text-[var(--ro)]" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                canDelete && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(exp.id);
                                    }}
                                    className="ib !w-9 !h-9 text-[var(--mu)] hover:!text-[var(--ro)]"
                                    title="Move to trash (with Undo)"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </StaggerItem>
                      );
                    }}
                  />
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Code-Split Edit Expense Modal / Bottom Sheet */}
      {editingExpense && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyEditExpenseModal
            expense={editingExpense}
            isOpen={!!editingExpense}
            onClose={() => setEditingExpense(null)}
          />
        </Suspense>
      )}

      {/* Lightbox Modal for Full-Size Receipt Proof */}
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
              loading="lazy"
              decoding="async"
              className="max-h-[72vh] w-auto object-contain"
            />
          </div>
        )}
      </Modal>

      {/* Code-Split Transaction Detail Breakdown Modal */}
      {selectedExpenseForDetail && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyTransactionDetailModal
            expense={selectedExpenseForDetail}
            isOpen={!!selectedExpenseForDetail}
            onClose={() => setSelectedExpenseForDetail(null)}
            onEdit={(exp) => handleOpenEdit(exp)}
          />
        </Suspense>
      )}
    </div>
  );
};

