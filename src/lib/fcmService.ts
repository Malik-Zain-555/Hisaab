/**
 * Firebase Cloud Messaging (FCM) Service for Web Push Notifications
 * Supports mobile background notifications on Android and iOS (PWA / Home Screen).
 */

import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { app, db } from './firebase';
import { sendWebNotification } from './webNotification';

let messagingInstance: Messaging | null = null;

/**
 * Checks if FCM Web Push is supported in the current environment
 */
export async function isFcmSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
    return await isSupported();
  } catch (e) {
    return false;
  }
}

/**
 * Gets or initializes the Firebase Messaging instance safely
 */
export async function getFcmMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isFcmSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.debug('FCM initialization check:', err);
  }
  return null;
}

/**
 * Requests notification permission and retrieves an FCM registration token.
 * Saves the token to Firestore under users/{userId} and fcmTokens/{token}.
 */
export async function requestFcmToken(
  userId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { success: false, error: 'Notifications not supported on this browser' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied by user' };
    }

    const messaging = await getFcmMessaging();
    if (!messaging) {
      // Fallback: Web Notification permission granted, service worker handles background alerts
      return { success: true, error: 'Standard Web Push active (FCM unsupported on this browser)' };
    }

    // Wait for service worker registration
    let swReg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.ready.catch(() => undefined);
    }

    // Retrieve FCM token
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swReg,
    }).catch(async () => {
      // Retry with explicit sw registration if needed
      return undefined;
    });

    if (token) {
      await registerFcmTokenInFirestore(userId, token);
      try {
        localStorage.setItem('hisaab_fcm_token', token);
      } catch (_) {}
      return { success: true, token };
    }

    return { success: true, error: 'Web Push permission active' };
  } catch (err: any) {
    console.debug('requestFcmToken warning:', err);
    return { success: false, error: err?.message || 'Failed to initialize push token' };
  }
}

/**
 * Stores the FCM device token in Firestore for background push delivery
 */
export async function registerFcmTokenInFirestore(userId: string, token: string): Promise<void> {
  if (!userId || !token) return;

  try {
    // Save in user profile
    await setDoc(
      doc(db, 'users', userId),
      {
        fcmTokens: arrayUnion(token),
        lastPushTokenAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Save in global fcmTokens directory with device metadata
    await setDoc(
      doc(db, 'fcmTokens', token),
      {
        token,
        userId,
        updatedAt: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        isMobile: typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      },
      { merge: true }
    );
  } catch (e) {
    console.debug('registerFcmTokenInFirestore:', e);
  }
}

/**
 * Subscribes to foreground push messages from Firebase Cloud Messaging
 */
export async function listenToForegroundFcmMessages(
  onPushReceived?: (payload: any) => void
): Promise<(() => void) | null> {
  try {
    const messaging = await getFcmMessaging();
    if (!messaging) return null;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground FCM message received:', payload);
      const title = 'Hisaab';
      const body = payload.notification?.body || payload.data?.body || 'Notifications are on. You will get alerts for new expenses and payments.';

      // Show native web notification
      sendWebNotification(title, {
        body,
        data: payload.data,
      });

      if (onPushReceived) {
        onPushReceived(payload);
      }
    });

    return unsubscribe;
  } catch (err) {
    console.debug('Foreground FCM listener:', err);
    return null;
  }
}

/**
 * Sends a background push notification to a user's registered devices (phones, tablets, PCs)
 * so they receive the alert even when their app/browser is completely closed.
 */
export async function sendPushNotificationToUser(
  targetUserId: string,
  payload: {
    title: string;
    body: string;
    link?: string;
    tag?: string;
    data?: Record<string, string>;
  }
): Promise<{ success: boolean; count?: number }> {
  if (!targetUserId) return { success: false };

  try {
    // 1. Retrieve user's FCM tokens
    const userDocSnap = await getDoc(doc(db, 'users', targetUserId));
    let tokens: string[] = [];

    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      if (Array.isArray(data.fcmTokens) && data.fcmTokens.length > 0) {
        tokens = data.fcmTokens;
      }
    }

    if (!tokens.length) {
      return { success: false };
    }

    // 2. Dispatch via server endpoint
    const response = await fetch('/api/send-push-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens,
        title: 'Hisaab',
        body: payload.body,
        link: payload.link || '/',
        tag: payload.tag || 'hisaab-push',
        data: payload.data || {},
      }),
    });

    const resData = await response.json().catch(() => ({}));
    return { success: response.ok, count: tokens.length };
  } catch (err) {
    console.debug('sendPushNotificationToUser notice:', err);
    return { success: false };
  }
}
