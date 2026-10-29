import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`py-12 px-6 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-3.5 ${className}`}
    >
      <div className="w-14 h-14 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] text-[var(--em)] flex items-center justify-center shadow-xs">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-extrabold font-heading text-[var(--tx)]">
          {title}
        </h4>
        {subtitle && (
          <p className="text-xs text-[var(--mu)] leading-relaxed max-w-xs mx-auto">
            {subtitle}
          </p>
        )}
      </div>
      {actionText && onAction && (
        <div className="pt-1">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};
