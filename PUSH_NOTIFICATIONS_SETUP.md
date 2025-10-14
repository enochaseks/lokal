# Push Notifications Setup Guide

This guide will help you complete the setup of push notifications for the Lokal app.

## Overview

Push notifications have been implemented using Firebase Cloud Messaging (FCM). Users will receive notifications even when they navigate away from the app on Safari, Chrome, Firefox, Edge, and other modern browsers.

## Features Implemented

✅ **Service Worker** - Handles background notifications
✅ **Push Notification Service** - Manages FCM tokens and permissions
✅ **User Prompt Component** - Beautiful UI to request permission
✅ **Settings Component** - Allow users to manage notification preferences
✅ **Backend Functions** - Automatically send notifications for:
  - New messages
  - Order updates
  - Payment confirmations
  - Store reviews
  - Store boost status

## Setup Steps

### Step 1: Generate VAPID Key

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: **lokal-b4b28**
3. Go to **Project Settings** (gear icon)
4. Navigate to **Cloud Messaging** tab
5. Scroll down to **Web Push certificates**
6. Click **Generate key pair** if you don't have one
7. Copy the VAPID key (it looks like: `BNxxx...`)

### Step 2: Update VAPID Key

Update the VAPID key in the push notification service:

**File:** `src/services/pushNotificationService.js`

Find line ~65:
```javascript
vapidKey: 'YOUR_VAPID_KEY_HERE'
```

Replace with your actual VAPID key:
```javascript
vapidKey: 'BNxxx...' // Your actual key from Firebase Console
```

### Step 3: Enable Firebase Cloud Messaging API

1. In Firebase Console, go to **Cloud Messaging** tab
2. Make sure **Firebase Cloud Messaging API (V1)** is enabled
3. If not, click **Enable**

### Step 4: Deploy Functions

Deploy the push notification functions to Firebase:

```powershell
cd functions
firebase deploy --only functions
```

This will deploy:
- `sendMessageNotification` - Triggered when new message is created
- `sendOrderNotification` - Triggered when new order is placed
- `sendPaymentNotification` - Triggered when payment is received
- `sendReviewNotification` - Triggered when new review is posted
- `sendStoreBoostNotification` - Triggered when store is boosted
- `sendCustomPushNotification` - Callable function for custom notifications

### Step 5: Update Service Worker Registration

The service worker is already registered in `public/firebase-messaging-sw.js`. Make sure your build process copies this file to the root of your deployed app.

For production deployment, ensure:
- `firebase-messaging-sw.js` is accessible at `https://lokalshops.co.uk/firebase-messaging-sw.js`

### Step 6: Test Push Notifications

1. **Start the app:**
   ```powershell
   npm start
   ```

2. **Log in to the app** with a test user

3. **Allow notifications** when prompted

4. **Trigger a test notification:**
   - Send a message to yourself from another account
   - Place a test order
   - Add a review to your store

5. **Test background notifications:**
   - Navigate to a different tab or close the browser
   - Trigger a notification event
   - You should see a push notification

### Step 7: Add to Settings Page

To let users manage their notification preferences, add the `PushNotificationSettings` component to your Settings page:

**File:** `src/pages/SettingsPage.js`

```javascript
import PushNotificationSettings from '../components/PushNotificationSettings';

// In your component:
<PushNotificationSettings />
```

## Browser Support

| Browser | Windows | macOS | iOS | Android |
|---------|---------|-------|-----|---------|
| Chrome  | ✅      | ✅    | ❌  | ✅      |
| Firefox | ✅      | ✅    | ❌  | ✅      |
| Safari  | ❌      | ✅    | ✅* | ❌      |
| Edge    | ✅      | ✅    | ❌  | ✅      |

*iOS Safari supports push notifications starting from iOS 16.4+ (requires Add to Home Screen)

## Testing Checklist

- [ ] VAPID key is configured
- [ ] Service worker is accessible at root
- [ ] Functions are deployed
- [ ] Permission prompt appears for new users
- [ ] Notifications work in foreground (app open)
- [ ] Notifications work in background (app closed)
- [ ] Clicking notification opens correct page
- [ ] Settings component allows enabling/disabling
- [ ] Works across different browsers

## Troubleshooting

### "Permission denied" error
- User has blocked notifications in browser settings
- Guide them to browser settings to allow notifications

### No notification received
- Check Firebase Console → Cloud Messaging → Usage
- Verify FCM token is saved in Firestore (`fcmTokens` collection)
- Check browser console for errors
- Ensure service worker is registered: `navigator.serviceWorker.getRegistration()`

### Service worker not found
- Verify `firebase-messaging-sw.js` is in `public` folder
- Check it's deployed to root of your domain
- Clear browser cache and re-register

### Notifications work in foreground but not background
- Service worker may not be properly registered
- Check browser console for service worker errors
- Ensure `firebase-messaging-sw.js` is at the root path

## Security Considerations

1. **FCM Tokens** are stored in Firestore (`fcmTokens` collection)
2. **Firestore Rules** should restrict token access:

```javascript
match /fcmTokens/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

3. **VAPID Key** is public and safe to include in client code
4. **Server Key** should remain private (only in Firebase Functions)

## Notification Types

The system supports the following notification types:

| Type | Trigger | Data |
|------|---------|------|
| `message` | New message received | `conversationId`, `senderId` |
| `order` | New order placed | `orderId` |
| `payment` | Payment received | `paymentId`, `receiptId` |
| `review` | New review posted | `reviewId`, `storeId` |
| `store_boost` | Store boosted | `storeId` |
| `custom` | Manual trigger | Custom data |

## Advanced: Send Custom Notifications

You can send custom notifications from your code:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendNotification = httpsCallable(functions, 'sendCustomPushNotification');

await sendNotification({
  userId: 'user123',
  title: 'Custom Notification',
  body: 'This is a custom message',
  type: 'custom',
  url: '/custom-page',
  additionalData: {
    key: 'value'
  }
});
```

## Next Steps

1. Complete Step 1-2 to add your VAPID key
2. Deploy functions (Step 4)
3. Test thoroughly across browsers
4. Add settings component to your Settings page
5. Monitor Firebase Console for notification analytics

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify Firebase Functions logs
3. Test service worker registration
4. Ensure VAPID key is correct

---

**Important:** Remember to update the VAPID key in `pushNotificationService.js` before deploying to production!
