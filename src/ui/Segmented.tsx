import React from 'react';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (val: T) => void;
  fullWidth?: boolean;
  className?: string;
}

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  fullWidth = true,
  className = '',
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={`inline-flex p-1.5 bg-[rgba(20,12,40,0.65)] backdrop-blur-xl rounded-[20px] border-[1.5px] border-[var(--line)] ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(opt.value)}
            className={`flex-1 min-h-[40px] py-1.5 px-4 rounded-[14px] text-[13px] font-bold transition-all select-none cursor-pointer flex items-center justify-center gap-2 active-press ${
              isSelected
                ? 'bg-[var(--em)] text-[#04140a] shadow-[3px_3px_0_rgba(0,0,0,0.35)]'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                  isSelected
                    ? 'bg-black/20 text-[#04140a]'
                    : 'bg-white/10 text-[var(--mu)]'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
