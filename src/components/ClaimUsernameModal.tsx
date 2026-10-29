import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { checkUsernameAvailable } from '../lib/friendsService';
import { Check, X, Loader2 } from 'lucide-react';

export const ClaimUsernameModal: React.FC = () => {
  const { needsUsernameClaim, claimMyUsername, currentUser, firebaseAuthUser } = useApp();

  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate clean suggestion from Google name or email
  useEffect(() => {
    if (currentUser?.displayName) {
      const suggested = currentUser.displayName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 20);
      if (suggested.length >= 3) {
        setUsername(suggested);
      }
    }
  }, [currentUser]);

  // Live availability check
  useEffect(() => {
    const clean = username.trim().toLowerCase();
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
  }, [username]);

  if (!needsUsernameClaim || !firebaseAuthUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAvailable || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');
    const res = await claimMyUsername(username);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to claim username.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17233B]/70 backdrop-blur-xs">
      <div className="bg-[#EDF0EA] dark:bg-[#0F1626] text-[#17233B] dark:text-[#EDF0EA] w-full max-w-md p-6 border-2 border-[#C7D2E4] dark:border-[#26324A] space-y-5 rounded-xs">
        {/* Margin line header */}
        <div className="border-b-2 border-[#D6453D] pb-3">
          <span className="font-urdu text-sm opacity-60 block">حساب</span>
          <h2 className="font-heading text-2xl font-bold tracking-tight">
            Pick your username
          </h2>
          <p className="text-xs text-[#17233B]/70 dark:text-[#EDF0EA]/70 mt-1">
            Choose a unique handle so friends can find you. Usernames are permanent.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#17233B]/80 dark:text-[#EDF0EA]/80 block">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-semibold opacity-50">
                @
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setErrorMsg('');
                }}
                maxLength={20}
                placeholder="e.g. ehtisham"
                className="w-full pl-7 pr-10 py-2.5 bg-white dark:bg-[#17233B] border border-[#C7D2E4] dark:border-[#26324A] text-sm text-[#17233B] dark:text-[#EDF0EA] rounded-xs focus:outline-none focus:border-[#17233B] dark:focus:border-[#EDF0EA]"
              />
              <div className="absolute right-3 top-3">
                {isChecking && (
                  <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                )}
                {!isChecking && isAvailable === true && (
                  <Check className="w-4 h-4 text-[#1F8A5B]" />
                )}
                {!isChecking && isAvailable === false && (
                  <X className="w-4 h-4 text-[#D6453D]" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-[#17233B]/60 dark:text-[#EDF0EA]/60">
                3 to 20 letters, numbers, and _
              </span>
              {isAvailable === false && (
                <span className="text-[#D6453D] font-medium">Already taken</span>
              )}
              {isAvailable === true && (
                <span className="text-[#1F8A5B] font-medium">Available</span>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 border border-[#D6453D] bg-[#D6453D]/10 text-[#D6453D] text-xs">
              {errorMsg}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isAvailable || isSubmitting}
              className="w-full py-3 bg-[#17233B] text-[#EDF0EA] dark:bg-[#EDF0EA] dark:text-[#17233B] font-heading font-bold text-sm rounded-xs disabled:opacity-40 transition-opacity"
            >
              {isSubmitting ? 'Claiming username...' : 'Claim username'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
