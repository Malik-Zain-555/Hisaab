import React from 'react';
import {
  Utensils,
  Coffee,
  Car,
  User,
  Home,
  ShoppingBag,
  Tag,
  Receipt,
} from 'lucide-react';
import { MoneyText } from './MoneyText';
import { ReceiptThumb } from './ReceiptThumb';

export interface TransactionRowProps {
  id: string;
  title: string;
  amount: number;
  dateStr: string;
  category: string;
  paidByText: string;
  splitInfo?: {
    type: 'positive' | 'negative' | 'neutral';
    text: string;
  };
  mealOrOccasionNote?: string;
  proofOfPayment?: string | null;
  disputed?: boolean;
  onClick?: () => void;
  onReceiptClick?: (imgUrl: string) => void;
  actionRight?: React.ReactNode;
  className?: string;
}

export function getCategoryIconAndStyle(category: string): {
  icon: React.ReactNode;
  tileClass: string;
} {
  const norm = (category || '').toLowerCase();
  if (norm.includes('food') || norm.includes('dinner') || norm.includes('lunch')) {
    return {
      icon: <Utensils className="w-5 h-5" />,
      tileClass: 'bg-emerald-500/12 text-emerald-500',
    };
  }
  if (norm.includes('snack') || norm.includes('cafe') || norm.includes('chai') || norm.includes('coffee')) {
    return {
      icon: <Coffee className="w-5 h-5" />,
      tileClass: 'bg-amber-500/12 text-amber-500',
    };
  }
  if (norm.includes('transport') || norm.includes('travel') || norm.includes('ride') || norm.includes('fuel')) {
    return {
      icon: <Car className="w-5 h-5" />,
      tileClass: 'bg-purple-500/12 text-purple-500',
    };
  }
  if (norm.includes('personal') || norm.includes('health') || norm.includes('self')) {
    return {
      icon: <User className="w-5 h-5" />,
      tileClass: 'bg-rose-500/12 text-rose-500',
    };
  }
  if (norm.includes('rent') || norm.includes('house') || norm.includes('home') || norm.includes('utility')) {
    return {
      icon: <Home className="w-5 h-5" />,
      tileClass: 'bg-blue-500/12 text-blue-500',
    };
  }
  if (norm.includes('grocer') || norm.includes('supermarket') || norm.includes('market')) {
    return {
      icon: <ShoppingBag className="w-5 h-5" />,
      tileClass: 'bg-teal-500/12 text-teal-500',
    };
  }
  return {
    icon: <Tag className="w-5 h-5" />,
    tileClass: 'bg-slate-500/12 text-slate-400',
  };
}

export const TransactionRow: React.FC<TransactionRowProps> = React.memo(({
  title,
  amount,
  dateStr,
  category,
  paidByText,
  splitInfo,
  mealOrOccasionNote,
  proofOfPayment,
  disputed,
  onClick,
  onReceiptClick,
  actionRight,
  className = '',
}) => {
  const { icon, tileClass } = getCategoryIconAndStyle(category);

  return (
    <div
      onClick={onClick}
      className={`min-h-[64px] px-3.5 sm:px-4 py-3 flex items-center justify-between gap-3 select-none rounded-[18px] transition-colors cq-card ${
        onClick ? 'cursor-pointer hover:bg-[var(--surface-2)] active-press' : ''
      } ${className}`}
    >
      {/* Left: 44px Rounded Category Tile */}
      <div
        className={`w-11 h-11 rounded-[14px] border border-[var(--line)] flex items-center justify-center shrink-0 ${tileClass}`}
      >
        {icon}
      </div>

      {/* Middle: Title & One Muted Subtitle Line */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="text-[15px] font-bold text-[var(--tx)] truncate leading-snug">
            {title}
          </h4>
          {disputed && (
            <span className="chip r !h-5 !px-2 !text-[10px] shrink-0">
              Disputed
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--mu)] truncate flex items-center gap-1.5 pt-0.5">
          <span>{paidByText}</span>
          <span>·</span>
          <span>{dateStr}</span>
          {mealOrOccasionNote && (
            <>
              <span>·</span>
              <span className="text-[var(--mu)]/75 truncate">{mealOrOccasionNote}</span>
            </>
          )}
        </p>
      </div>

      {/* Right: Amount & Sub-line */}
      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
        <div className="text-right whitespace-nowrap">
          <div className="font-bold font-money tabular-nums text-[var(--tx)] whitespace-nowrap cq-amount">
            <MoneyText amount={amount} />
          </div>
          {splitInfo && (
            <p
              className={`text-[11px] font-bold leading-none pt-1 whitespace-nowrap ${
                splitInfo.type === 'positive'
                  ? 'text-[var(--em)]'
                  : splitInfo.type === 'negative'
                  ? 'text-[var(--ro)]'
                  : 'text-[var(--mu)]'
              }`}
            >
              {splitInfo.text}
            </p>
          )}
        </div>

        {/* Small 36px receipt thumbnail if available */}
        {proofOfPayment && (
          <div className="relative group shrink-0">
            <ReceiptThumb
              src={proofOfPayment}
              alt="Receipt"
              size={36}
              onClick={(e) => {
                e.stopPropagation();
                onReceiptClick?.(proofOfPayment);
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-[10px] bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Receipt className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        )}

        {actionRight}
      </div>
    </div>
  );
});
TransactionRow.displayName = 'TransactionRow';
