import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'primary' | 'positive' | 'negative' | 'warning' | 'neutral';
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Chip: React.FC<ChipProps> = ({
  children,
  active = false,
  variant = 'primary',
  icon,
  size = 'md',
  className = '',
  ...props
}) => {
  const sizes = {
    sm: 'text-[12px] h-7 px-3 gap-1.5',
    md: 'text-[13px] h-8 px-3.5 gap-1.5',
  };

  let colorClasses = '';
  if (active) {
    if (variant === 'negative') {
      colorClasses = 'bg-[var(--ro)] text-[#2a0a14] font-bold shadow-[2px_2px_0_rgba(0,0,0,0.3)]';
    } else if (variant === 'warning') {
      colorClasses = 'bg-[var(--su)] text-[#2a1700] font-bold shadow-[2px_2px_0_rgba(0,0,0,0.3)]';
    } else {
      colorClasses = 'bg-[var(--em)] text-[#04140a] font-bold shadow-[2px_2px_0_rgba(0,0,0,0.3)]';
    }
  } else {
    colorClasses =
      'bg-white/12 text-[var(--tx)] hover:bg-white/20 font-semibold border border-[var(--line)]';
  }

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-full transition-all select-none active-press cursor-pointer shrink-0 whitespace-nowrap ${sizes[size]} ${colorClasses} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
