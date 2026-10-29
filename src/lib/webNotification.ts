/**
 * Web Notifications Service for Hisaab
 * Manages browser notification permissions, native notifications, and alert fallbacks.
 */

export function isWebNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getWebNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isWebNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function isWebNotificationGranted(): boolean {
  if (!isWebNotificationSupported()) return false;
  return Notification.permission === 'granted';
}

/**
 * Requests browser permission to show web notifications.
 * Stores status in localStorage and returns the resulting permission string.
 */
export async function requestWebNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isWebNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      try {
        localStorage.setItem('hisaab_web_notification_enabled', 'true');
      } catch (_) {}
    } else {
      try {
        localStorage.setItem('hisaab_web_notification_enabled', 'false');
      } catch (_) {}
    }
    return result;
  } catch (error) {
    console.warn('Error requesting notification permission:', error);
    return Notification.permission;
  }
}

export interface WebNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  silent?: boolean;
  onClick?: () => void;
}

/**
 * Sends a native browser / mobile web notification if permission is granted.
 * Title is always "Hisaab" with friendly body text and the 192px app icon.
 */
export function sendWebNotification(
  title: string,
  options?: WebNotificationOptions
): boolean {
  if (!isWebNotificationSupported()) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const formattedTitle = 'Hisaab';
  const rawSubtitle =
    title && title !== 'Hisaab' && !title.toLowerCase().startsWith('hisaab')
      ? title.replace(/[🔔💸📒💬]/g, '').trim()
      : '';
  const bodyText = options?.body
    ? options.body
    : rawSubtitle || 'Notifications are on. You will get alerts for new expenses and payments.';

  const iconUrl =
    typeof window !== 'undefined'
      ? new URL('/icon-192.png', window.location.origin).href
      : '/icon-192.png';

  const notifOptions = {
    body: bodyText,
    icon: options?.icon || iconUrl,
    badge: options?.badge || iconUrl,
    tag: options?.tag || 'hisaab-alert',
    data: options?.data,
    silent: options?.silent ?? false,
    vibrate: [200, 100, 200],
  };

  // Try Service Worker registration first (essential for mobile Chrome / Safari background notifications)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.showNotification(formattedTitle, notifOptions);
      })
      .catch(() => {
        fallbackDesktopNotification(formattedTitle, { ...notifOptions });
      });
    return true;
  }

  return fallbackDesktopNotification(formattedTitle, { ...notifOptions });
}

function fallbackDesktopNotification(title: string, options?: WebNotificationOptions): boolean {
  try {
    const notif = new Notification(title, {
      body: options?.body || '',
      icon: options?.icon || '/icon-192.png',
      badge: options?.badge || '/icon-192.png',
      tag: options?.tag,
      data: options?.data,
      silent: options?.silent ?? false,
    });

    notif.onclick = () => {
      try {
        window.focus();
      } catch (_) {}
      if (options?.onClick) {
        options.onClick();
      }
      notif.close();
    };

    return true;
  } catch (err) {
    console.warn('Error dispatching web notification:', err);
    return false;
  }
}

/**
 * Plays a crisp synthesized audio chime and vibrations for Nudges & alerts
 */
export function playNudgeChime(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      // Harmonic 2-tone gentle chime (D5 -> A5)
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch (_) {}

  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch (_) {}
}

export function triggerHaptic(pattern = [50]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (_) {}
}

/**
 * Fires a lightweight 28-piece DOM confetti burst at (x, y) or screen center
 */
export function triggerConfettiBurst(originX?: number, originY?: number): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const cx = originX ?? window.innerWidth / 2;
  const cy = originY ?? window.innerHeight * 0.72;
  const colors = ['#2EF2A0', '#FFC83D', '#FF5C8A', '#7C5CFF', '#22D3EE'];

  for (let k = 0; k < 28; k++) {
    const p = document.createElement('span');
    const a = (Math.PI * 2 * k) / 28 + (Math.random() - 0.5) * 0.3;
    const v = 55 + Math.random() * 95;
    p.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:8px;height:8px;border-radius:2px;background:${
      colors[k % colors.length]
    };pointer-events:none;z-index:9999`;
    document.body.appendChild(p);
    const anim = p.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        {
          transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v + 60}px) rotate(${
            Math.random() * 520
          }deg)`,
          opacity: 0,
        },
      ],
      { duration: 850, easing: 'cubic-bezier(.2,.8,.3,1)' }
    );
    anim.onfinish = () => p.remove();
  }
}
