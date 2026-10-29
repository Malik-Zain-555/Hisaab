import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { checkUsernameAvailable } from '../lib/friendsService';
import { Button, Input, Avatar, Modal } from '../ui';
import {
  Check,
  X,
  Loader2,
  Sparkles,
  Wallet,
  Plus,
  Trash2,
  Copy,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PaymentMethodDetail, SavedPaymentProvider } from '../types';

const PROVIDERS: SavedPaymentProvider[] = [
  'JazzCash',
  'EasyPaisa',
  'SadaPay',
  'NayaPay',
  'Bank Account',
];

export const ProfileSetupModal: React.FC<{ isOpen?: boolean; onClose?: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentUser,
    publicProfile,
    firebaseAuthUser,
    needsUsernameClaim,
    claimMyUsername,
    updatePaymentMethods,
    setCurrentUser,
    setNeedsUsernameClaim,
    showToast,
  } = useApp();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [photoURL, setPhotoURL] = useState<string | undefined>(undefined);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDetail[]>([]);
  const [newProvider, setNewProvider] = useState<SavedPaymentProvider>('JazzCash');
  const [newAccountTitle, setNewAccountTitle] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newIbanOrNote, setNewIbanOrNote] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const existingUsername = publicProfile?.username || '';

  // Close handler
  const handleDismiss = () => {
    if (onClose) {
      onClose();
    } else {
      setNeedsUsernameClaim(false);
    }
  };

  // Initialize from current user
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || undefined);
      setPaymentMethods(currentUser.paymentMethods || []);
      if (!newAccountTitle && currentUser.displayName) {
        setNewAccountTitle(currentUser.displayName);
      }

      if (publicProfile?.username) {
        setUsername(publicProfile.username);
        setIsAvailable(true);
      } else {
        // Suggest clean username
        const suggested = (currentUser.displayName || 'friend')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 20);
        if (suggested.length >= 3) {
          setUsername(suggested);
        }
      }
    }
  }, [currentUser, publicProfile?.username]);

  // Live availability check for username
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (existingUsername && clean === existingUsername.toLowerCase()) {
      setIsAvailable(true);
      setIsChecking(false);
      return;
    }
    if (clean.length < 3 || clean.length > 20 || !clean.match(/^[a-z0-9_]+$/)) {
      setIsAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      const avail = await checkUsernameAvailable(clean);
      setIsAvailable(avail);
      setIsChecking(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [username, existingUsername]);

  const shouldShow = isOpen !== undefined ? isOpen : (needsUsernameClaim && Boolean(firebaseAuthUser));
  if (!shouldShow || !firebaseAuthUser) return null;

  const handleAddPaymentMethod = () => {
    if (!newAccountNumber.trim()) {
      showToast({ type: 'warning', message: 'Enter an account or mobile number first.' });
      return;
    }
    const item: PaymentMethodDetail = {
      id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      provider: newProvider,
      accountTitle: (newAccountTitle || displayName || currentUser.displayName || 'Account').trim(),
      accountNumber: newAccountNumber.trim(),
      ...(newIbanOrNote.trim() ? { ibanOrNote: newIbanOrNote.trim() } : {}),
    };
    const next = [...paymentMethods, item];
    setPaymentMethods(next);
    setNewAccountNumber('');
    setNewIbanOrNote('');
  };

  const handleRemovePaymentMethod = (id: string) => {
    setPaymentMethods((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCopyMethod = (m: PaymentMethodDetail) => {
    const text = `${m.provider}: ${m.accountNumber} (${m.accountTitle})${
      m.ibanOrNote ? ` - ${m.ibanOrNote}` : ''
    }`;
    navigator.clipboard.writeText(text);
    setCopiedId(m.id);
    showToast({ type: 'success', message: `Copied ${m.provider} details!` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isUsernameValid = Boolean(existingUsername) || isAvailable === true;
    if (!isUsernameValid || isSubmitting || !displayName.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Auto-include any typed-but-unadded payment method if accountNumber is filled
      let finalMethods = [...paymentMethods];
      if (newAccountNumber.trim()) {
        finalMethods.push({
          id: `pm-${Date.now()}`,
          provider: newProvider,
          accountTitle: (newAccountTitle || displayName || 'Account').trim(),
          accountNumber: newAccountNumber.trim(),
          ...(newIbanOrNote.trim() ? { ibanOrNote: newIbanOrNote.trim() } : {}),
        });
        setNewAccountNumber('');
        setNewIbanOrNote('');
      }

      // Update display name in user profile doc if changed
      if (displayName !== currentUser.displayName || photoURL !== currentUser.photoURL) {
        await updateDoc(doc(db, 'users', firebaseAuthUser.uid), {
          displayName: displayName.trim(),
          photoURL: photoURL || null,
        }).catch(() => {});
        setCurrentUser({
          ...currentUser,
          displayName: displayName.trim(),
          photoURL: photoURL || undefined,
          paymentMethods: finalMethods,
        });
      }

      await updatePaymentMethods(finalMethods);

      if (!existingUsername || username.trim().toLowerCase() !== existingUsername.toLowerCase()) {
        const res = await claimMyUsername(username);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to claim username.');
          setIsSubmitting(false);
          return;
        }
      }

      handleDismiss();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error completing profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={shouldShow}
      onClose={handleDismiss}
      title="Profile & Payment Details"
      size="lg"
    >
      <div className="space-y-5">
        <div className="card t-em !p-4 text-center space-y-2">
          <div className="w-12 h-12 rounded-[18px] bg-[var(--em)]/15 border border-[var(--em)]/30 text-[var(--em)] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold font-heading text-[var(--tx)]">
            Your Hisaab Identity &amp; Payment Accounts
          </h3>
          <p className="text-xs text-[var(--mu)]">
            Set your @handle and save your JazzCash, EasyPaisa, SadaPay or bank details for reminders and statements.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Preview Glass Card */}
          <div className="card !p-4 flex flex-col items-center gap-3">
            <Avatar
              name={displayName || 'You'}
              photoURL={photoURL}
              size="xl"
              ring="green"
            />
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {firebaseAuthUser?.photoURL && !photoURL && (
                <button
                  type="button"
                  onClick={() => setPhotoURL(firebaseAuthUser.photoURL || undefined)}
                  className="chip g !h-7 !px-3 !text-xs"
                >
                  Use my Google photo
                </button>
              )}
              {photoURL && (
                <button
                  type="button"
                  onClick={() => setPhotoURL(undefined)}
                  className="chip !h-7 !px-3 !text-xs"
                >
                  Use colored initials avatar
                </button>
              )}
            </div>
          </div>

          {/* Full Name */}
          <Input
            label="Full name"
            placeholder="e.g. Ehtisham Khan"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          {/* Username (16px input so iOS never zooms) */}
          <div className="space-y-1.5 text-left">
            <label className="lbl block">Unique username</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-sm font-bold text-[var(--em)] pointer-events-none">
                @
              </span>
              <input
                type="text"
                required
                maxLength={20}
                disabled={Boolean(existingUsername)}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setErrorMsg('');
                }}
                placeholder="username"
                className="inp !pl-8 !pr-10 text-[16px] font-semibold disabled:opacity-75"
              />
              <div className="absolute right-3.5 flex items-center">
                {isChecking && <Loader2 className="w-4 h-4 animate-spin text-[var(--mu)]" />}
                {!isChecking && isAvailable === true && (
                  <Check className="w-4 h-4 text-[var(--em)]" />
                )}
                {!isChecking && isAvailable === false && (
                  <X className="w-4 h-4 text-[var(--ro)]" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <span className="text-[var(--mu)]">
                {existingUsername ? 'Your permanent @handle' : '3–20 letters, numbers, and _'}
              </span>
              {isAvailable === true && (
                <span className="text-[var(--em)] font-bold">@{username} is active</span>
              )}
              {isAvailable === false && (
                <span className="text-[var(--ro)] font-bold">Username is already taken</span>
              )}
            </div>
          </div>

          {/* Saved Payment Details Section */}
          <div className="card !p-4 space-y-3.5 cq-card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[10px] bg-[var(--em)]/15 border border-[var(--em)]/30 text-[var(--em)] flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-[var(--tx)] uppercase tracking-wider">
                    Payment Details on Profile
                  </h4>
                  <p className="text-[11px] text-[var(--mu)]">
                    Auto-attached to WhatsApp/email reminders &amp; public statements
                  </p>
                </div>
              </div>
              <span className="chip g !h-6 !px-2.5 !text-[11px] shrink-0">
                {paymentMethods.length} saved
              </span>
            </div>

            {/* Existing saved payment accounts (min-h-[64px] on mobile) */}
            {paymentMethods.length > 0 && (
              <div className="space-y-2">
                {paymentMethods.map((m) => (
                  <div
                    key={m.id}
                    className="min-h-[64px] px-3.5 py-2.5 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
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
                        onClick={() => handleCopyMethod(m)}
                        className="chip !h-8 !px-2.5 !text-xs"
                        title="Copy payment details"
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
                        onClick={() => handleRemovePaymentMethod(m.id)}
                        className="ib !w-8 !h-8 text-[var(--ro)]"
                        title="Remove payment method"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Payment Method Form */}
            <div className="p-3 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mu)] block">
                Add JazzCash, EasyPaisa, SadaPay or Bank
              </span>

              <div className="flex items-center gap-1.5 flex-wrap">
                {PROVIDERS.map((prov) => (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setNewProvider(prov)}
                    className={`chip !h-7 !px-3 !text-xs ${newProvider === prov ? 'g' : ''}`}
                  >
                    {prov}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={newAccountTitle}
                  onChange={(e) => setNewAccountTitle(e.target.value)}
                  placeholder="Account Title (e.g. Zain Ali)"
                  className="inp !h-11 text-[16px]"
                />
                <input
                  type="text"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  placeholder={
                    newProvider === 'Bank Account'
                      ? 'Account / IBAN Number'
                      : '03XX-XXXXXXX'
                  }
                  className="inp !h-11 text-[16px] num"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newIbanOrNote}
                  onChange={(e) => setNewIbanOrNote(e.target.value)}
                  placeholder="Optional Bank Name / IBAN / Raast note"
                  className="inp !h-11 text-[16px] flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddPaymentMethod}
                  className="btn s sm !h-11 shrink-0"
                >
                  <Plus className="w-4 h-4 text-[var(--em)]" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-[16px] bg-[var(--ro)]/15 border border-[var(--ro)]/30 text-[var(--ro)] text-xs font-semibold text-center">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Button
              type="submit"
              fullWidth
              size="lg"
              variant="primary"
              disabled={(!existingUsername && !isAvailable) || isSubmitting || !displayName.trim()}
              isLoading={isSubmitting}
            >
              Save profile &amp; payment details
            </Button>

            <button
              type="button"
              onClick={handleDismiss}
              className="btn g sm w-full justify-center"
            >
              Done
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

