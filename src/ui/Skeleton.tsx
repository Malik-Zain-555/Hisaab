import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text' | 'card';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect',
}) => {
  const variantStyles = {
    rect: 'rounded-[14px]',
    circle: 'rounded-full',
    text: 'rounded-[6px] h-3.5 w-full',
    card: 'rounded-[20px] h-32 w-full',
  };

  return (
    <div
      className={`skeleton-shimmer ${variantStyles[variant]} ${className}`}
    />
  );
};

export const SkeletonRow: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="min-h-[64px] px-4 py-3 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton variant="rect" className="w-10 h-10 shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton variant="text" className="w-32" />
              <Skeleton variant="text" className="h-2.5 w-20" />
            </div>
          </div>
          <Skeleton variant="text" className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
};

export const PageSkeleton: React.FC<{ title?: string }> = ({ title }) => {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-label={title || 'Loading screen'}>
      <div className="card !p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton variant="text" className="w-24 h-3" />
            <Skeleton variant="text" className="w-48 h-7" />
          </div>
          <Skeleton variant="rect" className="w-24 h-9 shrink-0" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Skeleton variant="card" className="h-20" />
          <Skeleton variant="card" className="h-20" />
        </div>
      </div>
      <div className="card !p-4">
        <SkeletonRow count={5} />
      </div>
    </div>
  );
};

export const SheetSkeleton: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
      <div className="w-full sm:max-w-lg bg-[var(--surface-solid)] rounded-t-[28px] sm:rounded-[28px] border border-[var(--line)] p-6 space-y-4 shadow-2xl">
        <Skeleton variant="text" className="w-40 h-5" />
        <Skeleton variant="card" className="h-24" />
        <SkeletonRow count={3} />
      </div>
    </div>
  );
};
