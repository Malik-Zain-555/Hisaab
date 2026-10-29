import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from './motion';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
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

  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-[480px]',
    lg: 'sm:max-w-xl',
    xl: 'sm:max-w-3xl',
  }[size];

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
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: prefersReduced ? 0.01 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`modal-glass relative w-full ${sizeClasses} bg-[var(--surface-solid)] backdrop-blur-2xl text-[var(--tx)] rounded-t-[28px] sm:rounded-[28px] shadow-[0_24px_70px_rgba(0,0,0,0.45)] z-10 flex flex-col max-h-[92dvh] overflow-hidden border-[1.5px] border-[var(--line)] cq-card`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="sm:hidden w-full flex justify-center pt-3 pb-1 cursor-pointer"
              onClick={onClose}
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--line)]" />
            </div>

            {title && (
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--line)] shrink-0">
                <h2 className="text-[18px] font-extrabold font-heading text-[var(--tx)]">{title}</h2>
                <button
                  type="button"
                  aria-label="Close dialog"
                  onClick={onClose}
                  className="ib"
                >
                  <X className="w-4.5 h-4.5 text-[var(--tx)]" />
                </button>
              </div>
            )}

            <div className="px-5 sm:px-6 py-5 overflow-y-auto max-h-[calc(92dvh-75px)] custom-scrollbar">{children}</div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
};
