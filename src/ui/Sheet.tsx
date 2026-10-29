import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from './motion';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = 'max-h-[92vh]',
}) => {
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0.01 : 0.18 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md cursor-pointer"
            onClick={onClose}
            aria-hidden="true"
          />

          <m.div
            role="dialog"
            aria-modal="true"
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
            transition={{ duration: prefersReduced ? 0.01 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={`sheet-glass relative w-full sm:max-w-lg bg-[var(--surface-solid)] backdrop-blur-2xl text-[var(--tx)] rounded-t-[28px] sm:rounded-[28px] shadow-[0_24px_70px_rgba(0,0,0,0.45)] z-10 flex flex-col overflow-hidden border-[1.5px] border-[var(--line)] cq-card ${maxHeight}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="sm:hidden w-full flex justify-center pt-3 pb-1 cursor-pointer"
              onClick={onClose}
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--line)]" />
            </div>

            <div className="px-5 sm:px-6 py-4 flex items-center justify-between border-b border-[var(--line)] shrink-0">
              <h3 className="text-[18px] font-extrabold font-heading text-[var(--tx)]">
                {title || ''}
              </h3>
              <button
                type="button"
                aria-label="Close sheet"
                onClick={onClose}
                className="ib"
              >
                <X className="w-4.5 h-4.5 text-[var(--tx)]" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">{children}</div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
};
