import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hero' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  radius?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  radius,
  className = '',
  ...props
}) => {
  const paddings = {
    none: 'p-0',
    sm: 'p-3.5',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
  };

  let variantStyle = 'card-base';
  if (variant === 'hero') {
    variantStyle = 'card-hero';
  } else if (variant === 'flat') {
    variantStyle = 'bg-[var(--surface-2)] border border-[var(--border)] rounded-[20px]';
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[20px] transition-all ${paddings[padding]} ${variantStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
