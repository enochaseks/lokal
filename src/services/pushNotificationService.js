import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '../firebase';
import { getAuth } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

class PushNotificationService {
  constructor() {
    this.messaging = null;
    this.currentToken = null;
    this.initialized = false;
  }

  /**
   * Initialize Firebase Cloud Messaging
   */
  async initialize() {
    try {
      // Check if browser supports notifications
      if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return false;
      }

      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        console.warn('Service workers are not supported in this browser');
        return false;
      }

      // Initialize messaging
      this.messaging = getMessaging(app);
      this.initialized = true;

      // Set up foreground message handler
      this.setupForegroundMessageHandler();

      return true;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return false;
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission() {
    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Get FCM token for this device
   */
  async getToken() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.messaging) {
        throw new Error('Messaging not initialized');
      }

      // Get the FCM token
      const token = await getToken(this.messaging, {
        vapidKey: 'BKtMeogr0HGfYaBn7SLvPw9fXgevOTt41z6ZquWCz9A3MXRRl8HRFDKG2kCIM2BnBLcooVf7lEheFAif27J19YI' // You'll need to generate this in Firebase Console
      });

      if (token) {
        console.log('FCM Token:', token);
        this.currentToken = token;
        
        // Save token to Firestore
        await this.saveTokenToDatabase(token);
        
        return token;
      } else {
        console.log('No registration token available.');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      if (error.code === 'messaging/permission-blocked') {
        console.warn('User has blocked notifications');
      }
      return null;
    }
  }

  /**
   * Save FCM token to Firestore for the current user
   */
  async saveTokenToDatabase(token) {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        console.warn('No user logged in, cannot save token');
        return;
      }

      const userTokenRef = doc(db, 'fcmTokens', user.uid);
      const tokenDoc = await getDoc(userTokenRef);

      const tokenData = {
        token: token,
        userId: user.uid,
        updatedAt: new Date(),
        platform: this.getPlatform(),
        browser: this.getBrowser(),
        userAgent: navigator.userAgent
      };

      if (tokenDoc.exists()) {
        // Update existing token
        await updateDoc(userTokenRef, tokenData);
      } else {
        // Create new token document
        await setDoc(userTokenRef, {
          ...tokenData,
          createdAt: new Date()
        });
      }

      console.log('Token saved to database');
    } catch (error) {
      console.error('Error saving token to database:', error);
    }
  }

  /**
   * Setup handler for foreground messages (when app is open)
   */
  setupForegroundMessageHandler() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('Foreground message received:', payload);

      // Create a notification even when app is in foreground
      const notificationTitle = payload.notification?.title || 'Lokal';
      const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/images/logo192.png',
        badge: '/images/logo192.png',
        tag: payload.data?.type || 'default',
        data: payload.data,
        requireInteraction: false,
        vibrate: [200, 100, 200]
      };

      // Show notification if permission is granted
      if (Notification.permission === 'granted') {
        const notification = new Notification(notificationTitle, notificationOptions);
        
        notification.onclick = (event) => {
          event.preventDefault();
          this.handleNotificationClick(payload.data);
          notification.close();
        };
      }

      // Dispatch custom event for in-app handling
      window.dispatchEvent(new CustomEvent('fcm-message', { detail: payload }));
    });
  }

  /**
   * Handle notification click based on type
   */
  handleNotificationClick(data) {
    if (!data) return;

    let urlToOpen = '/';

    switch (data.type) {
      case 'message':
        urlToOpen = `/messages${data.conversationId ? '?id=' + data.conversationId : ''}`;
        break;
      case 'order':
        urlToOpen = `/receipts${data.orderId ? '?id=' + data.orderId : ''}`;
        break;
      case 'payment':
        urlToOpen = `/receipts${data.receiptId ? '?id=' + data.receiptId : ''}`;
        break;
      case 'review':
        urlToOpen = `/store/${data.storeId}${data.reviewId ? '#review-' + data.reviewId : ''}`;
        break;
      case 'store_boost':
        urlToOpen = '/store-profile';
        break;
      default:
        urlToOpen = data.url || '/';
    }

    window.location.href = urlToOpen;
  }

  /**
   * Delete FCM token from Firestore
   */
  async deleteToken() {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) return;

      const userTokenRef = doc(db, 'fcmTokens', user.uid);
      await updateDoc(userTokenRef, {
        token: null,
        deletedAt: new Date()
      });

      this.currentToken = null;
      console.log('Token deleted from database');
    } catch (error) {
      console.error('Error deleting token:', error);
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Get platform information
   */
  getPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'iOS';
    if (/android/.test(userAgent)) return 'Android';
    if (/macintosh|mac os x/.test(userAgent)) return 'macOS';
    if (/windows/.test(userAgent)) return 'Windows';
    if (/linux/.test(userAgent)) return 'Linux';
    return 'Unknown';
  }

  /**
   * Get browser information
   */
  getBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') && !userAgent.includes('edge')) return 'Chrome';
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'Safari';
    if (userAgent.includes('firefox')) return 'Firefox';
    if (userAgent.includes('edge')) return 'Edge';
    if (userAgent.includes('opera') || userAgent.includes('opr')) return 'Opera';
    return 'Unknown';
  }
}

// Export singleton instance
const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
