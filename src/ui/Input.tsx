import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  icon,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}) => {
  const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const leadingIcon = leftIcon || icon;

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={generatedId}
          className="block text-xs font-medium text-[var(--text-muted)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
            {leadingIcon}
          </div>
        )}
        <input
          id={generatedId}
          className={`w-full h-12 rounded-[14px] bg-[var(--surface-2)] text-[var(--tx)] border border-[var(--line)] text-[16px] placeholder:text-[var(--mu)]/60 transition-all focus:outline-none focus:border-[var(--em)] focus:ring-2 focus:ring-[var(--em)]/20 ${
            leadingIcon ? 'pl-10' : 'pl-4'
          } ${rightIcon ? 'pr-10' : 'pr-4'} ${error ? 'border-[var(--ro)] focus:border-[var(--ro)] focus:ring-[var(--ro)]/20' : ''} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-[var(--negative)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text-faint)]">{hint}</p>}
    </div>
  );
};
