import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: number | string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  variant = 'pill',
  className = '',
}) => {
  if (variant === 'underline') {
    return (
      <div className={`flex items-center gap-6 border-b border-[#E4E7EC] dark:border-[#232B3E] ${className}`}>
        {items.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`pb-3 text-sm font-semibold transition-all relative cursor-pointer active-press flex items-center gap-2 ${
                isActive
                  ? 'text-[#4F46E5] dark:text-[#8B85FF]'
                  : 'text-[#667085] dark:text-[#98A2B3] hover:text-[#101828] dark:hover:text-[#F2F4F7]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#4F46E5]/10 text-[#4F46E5] dark:bg-[#8B85FF]/20 dark:text-[#8B85FF]">
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4F46E5] dark:bg-[#8B85FF] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`inline-flex p-1 bg-[#F4F5FA] dark:bg-[#151B2B] rounded-full border border-[#E4E7EC] dark:border-[#232B3E] gap-1 ${className}`}>
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer active-press flex items-center gap-1.5 ${
              isActive
                ? 'bg-[#4F46E5] text-white shadow-sm'
                : 'text-[#667085] dark:text-[#98A2B3] hover:text-[#101828] dark:hover:text-[#F2F4F7]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[#667085]/15 text-[#667085] dark:text-[#98A2B3]'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
