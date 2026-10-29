// Hisaab Service Worker for Offline Persistence and Background Push Alerts
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    apiKey: "AIzaSyCAkWeLXghbr1r8957fqYu3bWdwp1ijRRc",
    appId: "1:4089499389:web:645546f6df56b3756c3894",
    messagingSenderId: "4089499389",
    projectId: "gen-lang-client-0702376268",
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = 'Hisaab';
    const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || 'You have a new update in Hisaab.';
    const link = (payload.data && payload.data.link) || '/';
    const tag = (payload.data && payload.data.tag) || (payload.notification && payload.notification.tag) || 'hisaab-fcm-alert';
    const iconUrl = new URL('/icon-192.png', self.location.origin).href;

    self.registration.showNotification(title, {
      body,
      icon: iconUrl,
      badge: iconUrl,
      vibrate: [200, 100, 200],
      data: {
        link,
        ...((payload.data && payload.data) || {}),
      },
      tag,
      renotify: true,
      requireInteraction: true,
    });
  });
} catch (e) {
  // Graceful fallback if compat scripts are offline or blocked
}

const CACHE_NAME = 'hisaab-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('SW Precache error:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Do NOT intercept Firestore, Firebase Auth, Google APIs, or backend API routes
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.pathname.startsWith('/api/') ||
    url.protocol.startsWith('ws')
  ) {
    return;
  }

  // Network-first with cache fallback for navigation requests (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // Stale-while-revalidate for local static assets (JS, CSS, icons, images, fonts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push event listener for background mobile notifications
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Hisaab Alert 🔔',
    body: 'You have a new update in your Hisaab wallet or chat.',
    data: { link: '/' },
  };

  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (_) {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const title = 'Hisaab';
  const iconUrl = new URL('/icon-192.png', self.location.origin).href;

  const options = {
    body: payload.body || 'Notifications are on. You will get alerts for new expenses and payments.',
    icon: iconUrl,
    badge: iconUrl,
    vibrate: [200, 100, 200],
    data: payload.data || { link: '/' },
    tag: payload.tag || 'hisaab-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Background Sync listener for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  if (event.tag === 'sync-expenses' || event.tag === 'sync-messages') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_BACKGROUND_SYNC', tag: event.tag });
        });
      })
    );
  }
});

// Notification click event listener to wake up & focus the app on phone
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.link) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
