import React, { useEffect, useRef, useState } from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion } from 'motion/react';
import { formatPKR } from '../lib/formatters';

export { m, AnimatePresence, useReducedMotion };

export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LazyMotion features={domAnimation} strict>
    {children}
  </LazyMotion>
);

export const PageTransition: React.FC<{
  pageKey: string;
  children: React.ReactNode;
}> = ({ pageKey, children }) => {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={pageKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
};

/**
 * Staggered list entry capped strictly at max 8 items and < 400ms total duration.
 * Only animates transform (y) and opacity.
 */
export const StaggerItem: React.FC<{
  index: number;
  className?: string;
  children: React.ReactNode;
}> = React.memo(({ index, className = '', children }) => {
  const prefersReduced = useReducedMotion();

  if (prefersReduced || index >= 8) {
    return <div className={className}>{children}</div>;
  }

  const delay = Math.min(index, 7) * 0.028;

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
});
StaggerItem.displayName = 'StaggerItem';

/**
 * Smooth number count-up on balances (< 320ms, respects prefers-reduced-motion).
 */
export const AnimatedNumber: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  formatFn?: (n: number) => string;
  className?: string;
}> = React.memo(({ value, prefix = '', suffix = '', formatFn = formatPKR, className = '' }) => {
  const prefersReduced = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prefersReduced || prevValueRef.current === value) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = value;

    const duration = 280;
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(to);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, prefersReduced]);

  return (
    <span className={className}>
      {prefix}
      {formatFn(displayValue)}
      {suffix}
    </span>
  );
});
AnimatedNumber.displayName = 'AnimatedNumber';

/**
 * Swipe action wrapper for chat and notification rows.
 * Only animates transform (translateX) and opacity, under 250ms.
 */
export const SwipeableRow: React.FC<{
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftActionLabel?: string;
  rightActionLabel?: string;
  className?: string;
  children: React.ReactNode;
}> = ({
  onSwipeLeft,
  onSwipeRight,
  leftActionLabel = 'Action',
  rightActionLabel = 'Action',
  className = '',
  children,
}) => {
  const startXRef = useRef<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const delta = e.touches[0].clientX - startXRef.current;
    if ((delta < 0 && onSwipeLeft) || (delta > 0 && onSwipeRight)) {
      setOffsetX(Math.max(-88, Math.min(88, delta * 0.65)));
    }
  };

  const handleTouchEnd = () => {
    if (offsetX <= -52 && onSwipeLeft) {
      onSwipeLeft();
    } else if (offsetX >= 52 && onSwipeRight) {
      onSwipeRight();
    }
    setOffsetX(0);
    startXRef.current = null;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[18px] ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {offsetX !== 0 && (
        <div
          className={`absolute inset-0 flex items-center justify-between px-4 text-[11px] font-extrabold uppercase tracking-wider pointer-events-none ${
            offsetX < 0
              ? 'bg-[var(--ro)]/25 text-[var(--ro)] justify-end'
              : 'bg-[var(--em)]/25 text-[var(--em)] justify-start'
          }`}
        >
          <span>{offsetX < 0 ? leftActionLabel : rightActionLabel}</span>
        </div>
      )}
      <div
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: startXRef.current === null ? 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};
