import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sheet, Button } from '../ui';
import { Mail, MessageCircle, Copy, ExternalLink, Check, BellRing, Wallet } from 'lucide-react';
import { formatPKR } from '../lib/formatters';
import { PaymentMethodDetail } from '../types';

export const NudgeModal: React.FC = () => {
  const { currentUser, nudgeTargetFriend, setNudgeTargetFriend, showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);

  if (!nudgeTargetFriend) return null;

  const { friend, balance, subject, textBody } = nudgeTargetFriend;
  const friendEmail = friend.email || '';
  const paymentMethods = currentUser.paymentMethods || [];

  const handleOpenGmailWeb = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      friendEmail
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    showToast({ type: 'success', message: 'Opening Gmail Web Compose...' });
  };

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(textBody)}`, '_blank');
    showToast({ type: 'success', message: 'Opening WhatsApp...' });
  };

  const handleOpenMailApp = () => {
    const mailto = `mailto:${encodeURIComponent(friendEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(textBody)}`;
    try {
      window.location.href = mailto;
    } catch (_) {
      window.open(mailto, '_self');
    }
    showToast({ type: 'success', message: 'Opening default mail app...' });
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(textBody);
    setCopied(true);
    showToast({ type: 'success', message: 'Reminder message copied to clipboard!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAccount = (m: PaymentMethodDetail) => {
    navigator.clipboard.writeText(m.accountNumber);
    setCopiedAccountId(m.id);
    showToast({ type: 'success', message: `Copied ${m.provider} number!` });
    setTimeout(() => setCopiedAccountId(null), 2000);
  };

  return (
    <Sheet
      isOpen={!!nudgeTargetFriend}
      onClose={() => setNudgeTargetFriend(null)}
      title="Send Balance Reminder"
    >
      <div className="space-y-4 py-1">
        {/* In-app status banner */}
        <div className="card t-em !p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-[12px] bg-[var(--em)]/15 border border-[var(--em)]/30 text-[var(--em)] flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[var(--em)]">
              In-App Notification Sent!
            </h4>
            <p className="text-[11px] text-[var(--mu)]">
              {friend.displayName} received a notification badge for their <span className="num whitespace-nowrap font-bold text-[var(--tx)]">{formatPKR(balance)}</span> balance.
            </p>
          </div>
        </div>

        {/* Saved Payment Details Included Banner */}
        {paymentMethods.length > 0 && (
          <div className="card !p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[var(--tx)] flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[var(--em)]" /> Payment Accounts Attached
              </span>
              <span className="chip g !h-5 !px-2 !text-[10px]">Auto-included</span>
            </div>
            <div className="space-y-2">
              {paymentMethods.map((m) => (
                <div
                  key={m.id}
                  className="min-h-[64px] px-3.5 py-2.5 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="chip g !h-5 !px-2 !text-[10px]">{m.provider}</span>
                      <span className="text-xs font-bold text-[var(--tx)] truncate">
                        {m.accountTitle}
                      </span>
                    </div>
                    <p className="text-xs font-mono font-bold text-[var(--em)] mt-1 truncate">
                      {m.accountNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyAccount(m)}
                    className="chip !h-8 !px-3 !text-xs shrink-0"
                  >
                    {copiedAccountId === m.id ? (
                      <Check className="w-3.5 h-3.5 text-[var(--em)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedAccountId === m.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message preview card */}
        <div className="card !p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--tx)]">
            <span>Reminder Message</span>
            <span className="text-[10px] text-[var(--mu)] font-normal">
              To: {friendEmail || friend.displayName}
            </span>
          </div>
          <p className="text-xs text-[var(--tx)] bg-[var(--surface-2)] p-3 rounded-[14px] border border-[var(--line)] whitespace-pre-wrap leading-relaxed select-all">
            {textBody}
          </p>
        </div>

        {/* 1-Tap Delivery Actions */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={handleOpenGmailWeb}
              icon={<Mail className="w-4 h-4" />}
            >
              Open in Gmail Web
            </Button>
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={handleShareWhatsApp}
              icon={<MessageCircle className="w-4 h-4 text-[var(--em)]" />}
            >
              Send via WhatsApp
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={handleOpenMailApp}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              Open Mail App
            </Button>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={handleCopyText}
              icon={copied ? <Check className="w-3.5 h-3.5 text-[var(--em)]" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copied ? 'Copied!' : 'Copy Text'}
            </Button>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          fullWidth
          onClick={() => setNudgeTargetFriend(null)}
          className="mt-2"
        >
          Done
        </Button>
      </div>
    </Sheet>
  );
};

