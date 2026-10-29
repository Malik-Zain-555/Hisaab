import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Lock, Delete, Eye, EyeOff, ShieldAlert, LogOut } from 'lucide-react';
import { Avatar, BrandLogo } from '../ui';

export const AppLockOverlay: React.FC = () => {
  const {
    currentUser,
    appLockPin,
    isAppLocked,
    unlockApp,
    setAppLockPin,
    hideAmounts,
    setHideAmounts,
    logout,
  } = useApp();

  const [enteredPin, setEnteredPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDigit = useCallback(
    (digit: string) => {
      if (enteredPin.length >= 4) return;
      const next = enteredPin + digit;
      setEnteredPin(next);
      setErrorMsg('');

      if (next.length === 4) {
        const ok = unlockApp(next);
        if (ok) {
          setEnteredPin('');
        } else {
          setErrorShake(true);
          setErrorMsg('Incorrect 4-digit PIN. Try again.');
          setTimeout(() => {
            setEnteredPin('');
            setErrorShake(false);
          }, 420);
        }
      }
    },
    [enteredPin, unlockApp]
  );

  const handleBackspace = useCallback(() => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  }, []);

  useEffect(() => {
    if (!isAppLocked || !appLockPin) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAppLocked, appLockPin, handleDigit, handleBackspace]);

  if (!isAppLocked || !appLockPin) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--bg)]/95 backdrop-blur-2xl flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="card w-full max-w-sm !p-6 space-y-5 text-center border-[1.5px] border-[var(--line)] shadow-2xl">
        {/* Top Brand + User */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative">
            <BrandLogo size="lg" />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--vi)] text-white flex items-center justify-center shadow-md border border-white/40">
              <Lock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--line)]">
            <Avatar
              name={currentUser.displayName}
              photoURL={currentUser.photoURL}
              size="xs"
            />
            <span className="text-xs font-bold text-[var(--tx)] truncate max-w-[160px]">
              {currentUser.displayName}
            </span>
          </div>
          <h2 className="text-xl font-extrabold font-heading text-[var(--tx)]">
            Hisaab Locked
          </h2>
          <p className="text-xs text-[var(--mu)]">
            Enter your 4-digit PIN to unlock your khata
          </p>
        </div>

        {/* 4 PIN Dots */}
        <div
          className={`flex items-center justify-center gap-4 py-2 ${
            errorShake ? 'animate-bounce' : ''
          }`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = enteredPin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  filled
                    ? 'bg-[var(--em)] scale-110 shadow-[0_0_12px_var(--em)]'
                    : 'bg-[var(--surface-2)] border-2 border-[var(--line)]'
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <p className="text-xs font-bold text-[var(--ro)] -mt-2">{errorMsg}</p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-[18px] bg-[var(--surface-2)] hover:bg-[var(--surface)] border border-[var(--line)] text-lg font-extrabold font-heading text-[var(--tx)] flex items-center justify-center active-press transition-colors cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setHideAmounts(!hideAmounts)}
            className={`h-14 rounded-[18px] border border-[var(--line)] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold active-press transition-colors cursor-pointer ${
              hideAmounts
                ? 'bg-[var(--em)]/15 text-[var(--em)] border-[var(--em)]/40'
                : 'bg-[var(--surface-2)] text-[var(--mu)] hover:text-[var(--tx)]'
            }`}
            title="Toggle Hide Amounts when unlocked"
          >
            {hideAmounts ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            <span>{hideAmounts ? 'Hidden' : 'Amounts'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-[18px] bg-[var(--surface-2)] hover:bg-[var(--surface)] border border-[var(--line)] text-lg font-extrabold font-heading text-[var(--tx)] flex items-center justify-center active-press transition-colors cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-[18px] bg-[var(--surface-2)] hover:bg-[var(--surface)] border border-[var(--line)] text-[var(--mu)] hover:text-[var(--tx)] flex items-center justify-center active-press transition-colors cursor-pointer"
            aria-label="Backspace"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Honest Screen Lock Disclaimer */}
        <div className="p-3 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] text-left flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[var(--su)] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[var(--mu)] leading-relaxed">
            <strong className="text-[var(--tx)]">Screen lock only:</strong> This PIN locks the interface on open and after 2 minutes in the background. It is a privacy screen lock, not data encryption.
          </p>
        </div>

        {/* Forgot PIN / Sign out reset */}
        <div className="pt-1 flex items-center justify-center">
          <button
            type="button"
            onClick={async () => {
              setAppLockPin(null);
              await logout();
            }}
            className="text-[11px] font-semibold text-[var(--mu)] hover:text-[var(--ro)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Forgot PIN? Sign out &amp; reset lock</span>
          </button>
        </div>
      </div>
    </div>
  );
};
