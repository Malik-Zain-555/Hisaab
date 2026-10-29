import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-bold tracking-tight transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--em)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer whitespace-nowrap';

  const sizes = {
    sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-[12px]',
    md: 'h-[46px] px-5 text-sm gap-2 rounded-[16px]',
    lg: 'h-[50px] px-6 text-base gap-2.5 rounded-[18px]',
  };

  const variants = {
    primary:
      'bg-[var(--em)] text-[#04140a] shadow-[4px_4px_0_rgba(0,0,0,0.35)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[6px_6px_0_rgba(0,0,0,0.35)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgba(0,0,0,0.35)]',
    secondary:
      'bg-white/14 text-[var(--tx)] hover:bg-white/20 shadow-[3px_3px_0_rgba(0,0,0,0.3)] active-press',
    outline:
      'bg-white/10 border-[1.5px] border-[var(--line)] text-[var(--tx)] hover:bg-white/18 active-press',
    ghost:
      'bg-transparent text-[var(--mu)] hover:text-[var(--tx)] hover:bg-white/10 active-press',
    destructive:
      'bg-[var(--ro)] text-[#2a0a14] font-extrabold shadow-[4px_4px_0_rgba(0,0,0,0.35)] hover:opacity-95 active-press',
    danger:
      'bg-[var(--ro)] text-[#2a0a14] font-extrabold shadow-[4px_4px_0_rgba(0,0,0,0.35)] hover:opacity-95 active-press',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0 mr-1.5" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
