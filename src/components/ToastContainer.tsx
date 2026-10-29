import React from 'react';
import { useApp } from '../context/AppContext';
import { X, RotateCcw } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        return (
          <div
            key={toast.id}
            className="pointer-events-auto p-3.5 bg-[var(--surface-solid)] backdrop-blur-2xl text-[var(--tx)] border border-[var(--line)] rounded-[18px] shadow-2xl flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  toast.type === 'error'
                    ? 'bg-[var(--ro)]'
                    : toast.type === 'success'
                    ? 'bg-[var(--em)]'
                    : 'bg-[var(--su)]'
                }`}
              />
              <span className="font-semibold truncate">{toast.message}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.undoAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.undoAction?.();
                    removeToast(toast.id);
                  }}
                  className="chip g !h-6 !px-2.5 !text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="ib !w-7 !h-7"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

