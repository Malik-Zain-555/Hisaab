import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  variant?: 'surface' | 'ghost' | 'primary' | 'destructive';
  size?: 'sm' | 'md';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  'aria-label': ariaLabel,
  variant = 'surface',
  size = 'md',
  className = '',
  ...props
}) => {
  const variants = {
    surface:
      'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)]',
    ghost:
      'bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5',
    primary:
      'bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)]',
    destructive:
      'bg-rose-500/10 text-[var(--negative)] hover:bg-rose-500/20',
  };

  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
  };

  return (
    <div className="min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0">
      <button
        type="button"
        aria-label={ariaLabel}
        className={`rounded-full flex items-center justify-center transition-all cursor-pointer active-press focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {icon}
      </button>
    </div>
  );
};
