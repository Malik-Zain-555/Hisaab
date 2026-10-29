import React from 'react';

export interface ListRowProps {
  left?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  bottom?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isNew?: boolean;
}

export const ListRow: React.FC<ListRowProps> = ({
  left,
  title,
  subtitle,
  right,
  bottom,
  onClick,
  className = '',
  isNew = false,
}) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`w-full min-h-[64px] text-left py-3 px-3.5 rounded-[20px] flex flex-col justify-center transition-all cq-card ${
        onClick ? 'hover:bg-[var(--surface-2)] cursor-pointer active-press' : ''
      } ${isNew ? 'animate-row-enter' : ''} ${className}`}
    >
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {left && <div className="shrink-0">{left}</div>}
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-bold text-[var(--tx)] truncate">
              {title}
            </h4>
            {subtitle && (
              <p className="text-[13px] text-[var(--mu)] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {right && (
          <div className="shrink-0 text-right whitespace-nowrap pl-2 font-money tabular-nums">
            {right}
          </div>
        )}
      </div>

      {bottom && <div className="mt-2 pl-12">{bottom}</div>}
    </Component>
  );
};

