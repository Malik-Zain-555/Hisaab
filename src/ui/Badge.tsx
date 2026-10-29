import React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'neutral';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  dot = false,
  className = '',
}) => {
  const variants = {
    primary: 'bg-[var(--accent)] text-slate-950 font-bold',
    success: 'bg-[var(--positive)] text-slate-950 font-bold',
    danger: 'bg-[var(--negative)] text-white font-bold',
    warning: 'bg-[var(--warning)] text-slate-950 font-bold',
    neutral: 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] font-medium',
  };

  if (dot) {
    const dotColors = {
      primary: 'bg-[var(--accent)]',
      success: 'bg-[var(--positive)]',
      danger: 'bg-[var(--negative)]',
      warning: 'bg-[var(--warning)]',
      neutral: 'bg-[var(--text-muted)]',
    };
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ring-2 ring-[var(--surface)] ${dotColors[variant]} ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center text-[11px] px-2 py-0.5 rounded-full min-w-[18px] ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
