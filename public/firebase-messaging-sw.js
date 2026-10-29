// Firebase Cloud Messaging (FCM) Background Service Worker
// Enables mobile Web Push notifications when the browser or app is closed or backgrounded.

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCAkWeLXghbr1r8957fqYu3bWdwp1ijRRc",
  appId: "1:4089499389:web:645546f6df56b3756c3894",
  messagingSenderId: "4089499389",
  projectId: "gen-lang-client-0702376268",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background push message:', payload);
  const title = 'Hisaab';
  const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || 'You have an important update in Hisaab.';
  const link = (payload.data && payload.data.link) || '/';
  const tag = (payload.data && payload.data.tag) || (payload.notification && payload.notification.tag) || 'hisaab-fcm-push';
  const iconUrl = new URL('/icon-192.png', self.location.origin).href;

  const notificationOptions = {
    body,
    icon: iconUrl,
    badge: iconUrl,
    vibrate: [200, 100, 200, 100, 200],
    tag,
    data: {
      link,
      ...((payload.data && payload.data) || {}),
    },
    renotify: true,
    requireInteraction: true,
  };

  self.registration.showNotification(title, notificationOptions);
});

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
