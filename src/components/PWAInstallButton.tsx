import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share2, PlusSquare, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC<{ variant?: 'banner' | 'pill' | 'button' }> = ({
  variant = 'pill',
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already installed on phone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const isInstallable = !!deferredPrompt;

  // If already running in standalone mode, or if not installable & not iOS, don't show
  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  return (
    <>
      {variant === 'pill' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[#4F46E5] dark:text-[#8B85FF] text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Install app on your phone for background notifications"
        >
          <Smartphone className="w-3.5 h-3.5 animate-pulse" />
          <span>Install App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Install on Phone</span>
        </button>
      )}

      {/* iOS Safari Guided Install Sheet */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#151B2B] text-[#101828] dark:text-[#F2F4F7] p-5 shadow-2xl border border-[#E4E7EC] dark:border-[#232B3E] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E7EC] dark:border-[#232B3E]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center font-bold text-sm">
                  H
                </div>
                <h3 className="text-sm font-bold">Install Hisaab on iPhone</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#667085] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#667085] dark:text-[#98A2B3]">
              <p>
                To receive background notifications on iOS even when your browser is closed, add Hisaab to your Home Screen:
              </p>
              <div className="space-y-2.5 bg-[#F4F5FA] dark:bg-[#0B0F1A] p-3 rounded-2xl border border-[#E4E7EC]/60 dark:border-[#232B3E]/60">
                <div className="flex items-center gap-2.5 text-[#101828] dark:text-[#F2F4F7] font-semibold">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-[#4F46E5] flex items-center justify-center shrink-0">
                    1
                  </div>
                  <span className="flex items-center gap-1.5">
                    Tap the <Share2 className="w-4 h-4 text-[#4F46E5]" /> <strong>Share</strong> button in Safari toolbar
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-[#101828] dark:text-[#F2F4F7] font-semibold">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-[#4F46E5] flex items-center justify-center shrink-0">
                    2
                  </div>
                  <span className="flex items-center gap-1.5">
                    Scroll down and tap <PlusSquare className="w-4 h-4 text-emerald-500" /> <strong>Add to Home Screen</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-[#101828] dark:text-[#F2F4F7] font-semibold">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-[#4F46E5] flex items-center justify-center shrink-0">
                    3
                  </div>
                  <span>Launch from Home Screen & grant notification permission!</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold hover:bg-[#4338CA] transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
