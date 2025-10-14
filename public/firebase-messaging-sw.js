// Firebase Cloud Messaging Service Worker
// This file must be in the public folder to be served at the root

importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyAGEHLV7k8nAVaoqDmdbidi4j9Wm-zwOr8",
  authDomain: "lokal-b4b28.firebaseapp.com",
  databaseURL: "https://lokal-b4b28-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lokal-b4b28",
  storageBucket: "lokal-b4b28.firebasestorage.app",
  messagingSenderId: "469061847946",
  appId: "1:469061847946:web:71c4974365a321a328d673",
  measurementId: "G-WKYD2FX255"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'Lokal';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/images/logo192.png',
    badge: '/images/logo192.png',
    tag: payload.data?.type || 'default',
    data: payload.data,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Handle different notification types
  const data = event.notification.data;
  let urlToOpen = 'https://lokalshops.co.uk/';

  if (data) {
    switch (data.type) {
      case 'message':
        urlToOpen = `https://lokalshops.co.uk/messages${data.conversationId ? '?id=' + data.conversationId : ''}`;
        break;
      case 'order':
        urlToOpen = `https://lokalshops.co.uk/receipts${data.orderId ? '?id=' + data.orderId : ''}`;
        break;
      case 'payment':
        urlToOpen = `https://lokalshops.co.uk/receipts${data.receiptId ? '?id=' + data.receiptId : ''}`;
        break;
      case 'review':
        urlToOpen = `https://lokalshops.co.uk/store/${data.storeId}${data.reviewId ? '#review-' + data.reviewId : ''}`;
        break;
      case 'store_boost':
        urlToOpen = `https://lokalshops.co.uk/store-profile`;
        break;
      default:
        urlToOpen = data.url || 'https://lokalshops.co.uk/';
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
