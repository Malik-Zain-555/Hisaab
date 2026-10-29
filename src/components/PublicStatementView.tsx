import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ShareLinkDoc, PaymentMethodDetail } from '../types';
import { formatPKR, formatShortDate, formatFullDateTime } from '../lib/formatters';
import { Card, Button, Avatar, EmptyState, SkeletonRow, BrandLogo, AnimatedNumber } from '../ui';
import {
  ArrowLeft,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  ArrowUpRight,
  Wallet,
  Copy,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const PublicStatementView: React.FC<{
  statementToken: string;
  onExit: () => void;
}> = ({ statementToken, onExit }) => {
  const { currentUser, showToast } = useApp();
  const [data, setData] = useState<ShareLinkDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInvalid, setIsInvalid] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatement() {
      try {
        setIsLoading(true);
        const ref = doc(db, 'shareLinks', statementToken);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setIsInvalid(true);
        } else {
          const docData = snap.data() as ShareLinkDoc;
          if (docData.revoked) {
            setIsInvalid(true);
          } else {
            setData(docData);
          }
        }
      } catch (err) {
        setIsInvalid(true);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStatement();
  }, [statementToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen relative text-[var(--tx)] py-10 px-4 sm:px-6 flex justify-center items-center">
        <div className="bg" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="w-full max-w-xl space-y-4">
          <Card className="text-center space-y-3 py-8">
            <div className="w-11 h-11 rounded-full border-2 border-[var(--em)] border-t-transparent animate-spin mx-auto" />
            <p className="text-sm font-extrabold font-heading text-[var(--tx)]">
              Opening verified statement...
            </p>
            <p className="text-xs text-[var(--mu)]">
              Fetching live ledger snapshot from Hisaab
            </p>
          </Card>
          <SkeletonRow count={3} />
        </div>
      </div>
    );
  }

  // Fails closed if missing or revoked (Error State)
  if (isInvalid || !data) {
    return (
      <div className="min-h-screen relative text-[var(--tx)] p-6 flex items-center justify-center">
        <div className="bg" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <Card className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-[18px] bg-[var(--ro)]/15 border border-[var(--ro)]/30 text-[var(--ro)] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold font-heading text-[var(--tx)]">
              This link is no longer active
            </h2>
            <p className="text-xs text-[var(--mu)] leading-relaxed">
              This statement link was revoked, expired, or could not be found. Please ask your friend for an updated Hisaab statement link.
            </p>
          </div>
          <div className="pt-2">
            <Button variant="primary" fullWidth onClick={onExit}>
              Open Hisaab App
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { snapshot, updatedAt } = data;
  const entries = snapshot.entries || [];
  const balance = snapshot.runningBalance || 0;
  const isOwed = balance > 0;
  const isSettled = balance === 0;
  const paymentMethods: PaymentMethodDetail[] =
    snapshot.paymentMethods && snapshot.paymentMethods.length > 0
      ? snapshot.paymentMethods
      : currentUser?.paymentMethods || [];

  const handleCopyAccount = (m: PaymentMethodDetail) => {
    navigator.clipboard.writeText(m.accountNumber);
    setCopiedId(m.id);
    showToast?.({ type: 'success', message: `Copied ${m.provider} account number!` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen relative text-[var(--tx)] py-8 px-4 sm:px-6 flex justify-center">
      <div className="bg print:hidden" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className="w-full max-w-2xl space-y-5 relative z-10">
        {/* Top Glass Navigation Bar */}
        <div className="flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onExit}
            className="btn s sm"
          >
            <BrandLogo size="sm" className="!w-6 !h-6" />
            <ArrowLeft className="w-4 h-4" />
            <span>Open Hisaab app</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print statement</span>
          </button>
        </div>

        {/* Printable Statement Glass Card */}
        <Card className="space-y-5 cq-card print:shadow-none">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[var(--line)] pb-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <Avatar name={snapshot.displayName} size="lg" ring="green" />
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold font-heading text-[var(--tx)] truncate">
                  {snapshot.displayName}
                </h1>
                <p className="text-xs text-[var(--mu)]">
                  Hisaab Statement • Updated {formatFullDateTime(updatedAt)}
                </p>
              </div>
            </div>
            <span className="chip g !h-7 !px-3 !text-[11px] shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified snapshot</span>
            </span>
          </div>

          {/* Balance Hero Glass Block */}
          <div
            className={`card !p-5 flex items-center justify-between gap-3 flex-wrap cq-card ${
              isOwed ? 't-ro' : isSettled ? '' : 't-em'
            }`}
          >
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)] block">
                {isOwed ? 'Amount you owe' : isSettled ? 'All settled up' : 'Amount owed to you'}
              </span>
              <span
                className={`font-extrabold font-heading num whitespace-nowrap text-[clamp(1.6rem,7cqw,2.35rem)] leading-tight block mt-0.5 ${
                  isOwed ? 'text-[var(--ro)]' : isSettled ? 'text-[var(--mu)]' : 'text-[var(--em)]'
                }`}
              >
                {isSettled ? 'Rs 0' : <AnimatedNumber value={Math.abs(balance)} />}
              </span>
            </div>
            <span className="chip !h-7 !px-3 !text-xs shrink-0">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {/* Payment Details Section (JazzCash, EasyPaisa, SadaPay, Bank) with Copy buttons */}
          {paymentMethods.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)] flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-[var(--em)]" /> Payment Details to Settle Up
                </h3>
                {snapshot.ownerName && (
                  <span className="text-[11px] text-[var(--mu)]">
                    Pay to {snapshot.ownerName}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {paymentMethods.map((m) => (
                  <div
                    key={m.id}
                    className="min-h-[64px] px-4 py-3 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3 cq-card"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="chip g !h-5 !px-2.5 !text-[10px]">{m.provider}</span>
                        <span className="text-xs font-extrabold text-[var(--tx)] truncate">
                          {m.accountTitle}
                        </span>
                      </div>
                      <p className="text-sm font-mono font-extrabold text-[var(--em)] mt-1 truncate">
                        {m.accountNumber}
                      </p>
                      {m.ibanOrNote && (
                        <p className="text-[11px] text-[var(--mu)] truncate">{m.ibanOrNote}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(m)}
                      className="btn s sm print:hidden shrink-0"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3.5 h-3.5 text-[var(--em)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === m.id ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itemized Entries List (64px minimum row height) */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)] px-1">
              Itemized ledger entries
            </h3>
            {entries.length === 0 ? (
              <EmptyState
                icon={<Receipt className="w-6 h-6" />}
                title="No entries recorded"
                description="There are no ledger transactions recorded in this statement snapshot yet."
              />
            ) : (
              <div className="space-y-2">
                {entries.map((entry, idx) => {
                  const isPayment = entry.amount < 0 || entry.type === 'payment';
                  return (
                    <div
                      key={idx}
                      className="min-h-[64px] px-4 py-3 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3 cq-card"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 border ${
                            isPayment
                              ? 'bg-[var(--em)]/15 border-[var(--em)]/30 text-[var(--em)]'
                              : 'bg-[var(--ro)]/15 border-[var(--ro)]/30 text-[var(--ro)]'
                          }`}
                        >
                          {isPayment ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--tx)] truncate">
                            {entry.label}
                          </p>
                          <p className="text-[11px] text-[var(--mu)]">
                            {formatShortDate(entry.date)} • <span className="capitalize">{entry.type}</span>
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-extrabold font-heading text-[clamp(0.875rem,3.8cqw,1rem)] num whitespace-nowrap shrink-0 ${
                          isPayment ? 'text-[var(--em)]' : 'text-[var(--ro)]'
                        }`}
                      >
                        {isPayment ? '-' : '+'}
                        {formatPKR(Math.abs(entry.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

