import React from 'react';
import { AnimatedNumber } from './motion';

export interface MoneyTextProps {
  amount: number;
  showSign?: boolean;
  size?: 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | 'hero';
  colored?: boolean;
  direction?: 'neutral' | 'positive' | 'negative';
  className?: string;
}

export function formatPKR(num: number): string {
  const rounded = Math.round(Math.abs(num));
  return `Rs ${rounded.toLocaleString('en-PK')}`;
}

export const MoneyText: React.FC<MoneyTextProps> = React.memo(({
  amount,
  showSign = false,
  size = 'base',
  colored = false,
  direction,
  className = '',
}) => {
  const isPositive = direction ? direction === 'positive' : amount > 0;
  const isNegative = direction ? direction === 'negative' : amount < 0;

  const sizeClasses = {
    xs: 'text-[11px] font-bold whitespace-nowrap',
    sm: 'text-xs font-bold whitespace-nowrap',
    base: 'text-sm font-bold whitespace-nowrap cq-amount',
    md: 'text-base font-bold whitespace-nowrap cq-amount',
    lg: 'text-lg font-extrabold whitespace-nowrap cq-amount-lg',
    xl: 'text-2xl font-extrabold tracking-tight whitespace-nowrap cq-amount-lg',
    hero: 'font-extrabold tracking-tight whitespace-nowrap cq-amount-hero',
  };

  let colorClass = 'text-[var(--tx)]';
  if (colored || direction) {
    if (isPositive) colorClass = 'text-[var(--em)]';
    else if (isNegative) colorClass = 'text-[var(--ro)]';
    else colorClass = 'text-[var(--mu)]';
  }

  let prefix = '';
  if (showSign) {
    if (isPositive) prefix = '+';
    else if (isNegative) prefix = '−';
  }

  return (
    <span
      className={`num font-money tabular-nums whitespace-nowrap shrink-0 inline-block ${sizeClasses[size]} ${colorClass} ${className}`}
    >
      <AnimatedNumber value={Math.abs(amount)} prefix={prefix} formatFn={formatPKR} />
    </span>
  );
});
MoneyText.displayName = 'MoneyText';
