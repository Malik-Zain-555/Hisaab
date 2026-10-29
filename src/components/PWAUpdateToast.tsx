import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { m, AnimatePresence } from '../ui/motion';

export const PWAUpdateToast: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('SW registration error:', error);
    },
  });

  return (
    <AnimatePresence>
      {needRefresh && (
        <m.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-24 sm:bottom-6 right-4 z-[92] max-w-xs w-[calc(100%-2rem)] rounded-[20px] bg-[var(--surface-solid)] border border-[var(--em)]/40 shadow-2xl p-3.5 flex items-center justify-between gap-3"
          role="status"
          aria-live="polite"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-[var(--tx)]">Update available</p>
            <p className="text-[11px] text-[var(--mu)] truncate">
              A new version of Hisaab is ready.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="btn sm !h-8 !px-3 !text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload</span>
            </button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="ib !w-8 !h-8"
              aria-label="Dismiss update notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
};
