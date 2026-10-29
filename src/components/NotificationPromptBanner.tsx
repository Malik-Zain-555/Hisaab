import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, X } from 'lucide-react';
import {
  isWebNotificationSupported,
  getWebNotificationPermission,
  requestWebNotificationPermission,
  sendWebNotification,
} from '../lib/webNotification';
import { requestFcmToken } from '../lib/fcmService';
import { useApp } from '../context/AppContext';

export const NotificationPromptBanner: React.FC = () => {
  const { showToast, currentUser } = useApp();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [dismissed, setDismissed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (!isWebNotificationSupported()) {
      setPermission('unsupported');
      return;
    }
    setPermission(getWebNotificationPermission());
    const isDismissed = sessionStorage.getItem('hisaab_notif_banner_dismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  if (permission !== 'default' || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const res = await requestWebNotificationPermission();
      setPermission(res);
      if (res === 'granted') {
        // Register FCM Web Push token for background mobile push alerts
        if (currentUser?.uid) {
          requestFcmToken(currentUser.uid).catch((err) => console.debug('FCM register:', err));
        }

        showToast({
          type: 'success',
          message: 'Notifications are on. You will get alerts for new expenses and payments.',
        });
        // Send initial confirmation web notification
        sendWebNotification('Hisaab', {
          body: 'Notifications are on. You will get alerts for new expenses and payments.',
        });
      } else if (res === 'denied') {
        showToast({
          type: 'info',
          message: 'Notification permission was declined. You can enable it anytime in browser settings.',
        });
      }
    } catch (_) {
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('hisaab_notif_banner_dismissed', 'true');
    } catch (_) {}
  };

  return (
    <div className="c mb-5 !p-3.5 sm:!p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[var(--em)]/15 border border-[var(--em)]/30 text-[var(--em)] flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-[var(--tx)] flex items-center gap-1.5">
            <span>Enable Browser Notifications</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--em)]/15 text-[var(--em)]">
              Recommended
            </span>
          </h4>
          <p className="text-[11px] sm:text-xs text-[var(--mu)] line-clamp-2">
            Get instant alerts when friends add expenses, settle payments, nudge you, or send messages.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          type="button"
          onClick={handleEnable}
          disabled={isRequesting}
          className="btn sm"
        >
          {isRequesting ? 'Enabling...' : 'Enable Notifications'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="ib !w-8 !h-8"
          title="Dismiss for now"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
