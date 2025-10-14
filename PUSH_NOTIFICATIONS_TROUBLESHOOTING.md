# Push Notifications - Troubleshooting Guide

## 🔍 Quick Diagnostics

Run these checks first:

### 1. Check Service Worker
```javascript
// Open DevTools Console and run:
navigator.serviceWorker.getRegistration().then(reg => {
  if (reg) {
    console.log('✅ Service Worker registered:', reg.active?.scriptURL);
  } else {
    console.log('❌ No service worker registered');
  }
});
```

### 2. Check Notification Permission
```javascript
// In DevTools Console:
console.log('Permission:', Notification.permission);
// Should be: "granted", "denied", or "default"
```

### 3. Check FCM Token
```javascript
// In DevTools Console (after allowing notifications):
// Check Firestore in Firebase Console
// Go to: fcmTokens collection → your user ID
// Should see: { token: "...", platform: "...", browser: "..." }
```

### 4. Check Browser Support
```javascript
// In DevTools Console:
console.log('Notifications supported:', 'Notification' in window);
console.log('Service Workers supported:', 'serviceWorker' in navigator);
// Both should be true
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Service worker not found" (404)

**Symptoms:**
- Console shows 404 error for firebase-messaging-sw.js
- No service worker in DevTools → Application → Service Workers

**Solutions:**

✅ **Solution A:** Check file location
```
Verify firebase-messaging-sw.js is in:
- Development: /public/firebase-messaging-sw.js
- Production: /firebase-messaging-sw.js (root of deployed site)
```

✅ **Solution B:** Clear cache
```powershell
# In Chrome
# DevTools → Application → Clear Storage → Clear site data

# Or programmatically:
# DevTools Console:
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});
# Then reload page
```

✅ **Solution C:** Check build configuration
```javascript
// Ensure your build process copies firebase-messaging-sw.js to output
// For Create React App, files in /public are automatically copied
```

---

### Issue 2: "Permission denied" / Notifications blocked

**Symptoms:**
- Notification.permission === "denied"
- No permission prompt appears
- Browser shows blocked icon in address bar

**Solutions:**

✅ **For Chrome/Edge:**
1. Click lock/info icon in address bar
2. Click "Site settings"
3. Find "Notifications"
4. Change to "Allow"
5. Reload page

✅ **For Firefox:**
1. Click shield/lock icon in address bar
2. Click "Connection secure" → "More information"
3. Go to "Permissions" tab
4. Find "Receive Notifications"
5. Uncheck "Use Default" and select "Allow"
6. Reload page

✅ **For Safari:**
1. Safari → Preferences
2. Websites tab
3. Select "Notifications"
4. Find lokalshops.co.uk
5. Change to "Allow"
6. Reload page

✅ **Reset for testing:**
```javascript
// Note: You can't reset programmatically!
// User must manually reset in browser settings
// Or test in incognito/private mode
```

---

### Issue 3: No FCM token generated

**Symptoms:**
- Permission is granted
- But no token in Firestore
- Console shows no errors

**Solutions:**

✅ **Solution A:** Check VAPID key
```javascript
// Verify in src/services/pushNotificationService.js
// Line ~65 should have your actual VAPID key:
vapidKey: 'BNxxx...' // Not 'YOUR_VAPID_KEY_HERE'

// Get VAPID key from:
// Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
```

✅ **Solution B:** Check Firebase initialization
```javascript
// Verify firebase.js has messaging imported
import { getMessaging, isSupported } from 'firebase/messaging';

// And messaging is exported
export { app, analytics, db, storage, messaging };
```

✅ **Solution C:** Check browser console for errors
```
Look for errors containing:
- "messaging/..."
- "registration-token-not-registered"
- "invalid-registration-token"
```

---

### Issue 4: Notifications not being sent

**Symptoms:**
- FCM token exists in Firestore
- Functions are deployed
- But no notifications arrive

**Solutions:**

✅ **Solution A:** Check Cloud Functions are deployed
```powershell
firebase functions:list

# Should show:
# sendMessageNotification
# sendOrderNotification
# sendPaymentNotification
# sendReviewNotification
# sendStoreBoostNotification
# sendCustomPushNotification
```

✅ **Solution B:** Check function logs
```powershell
firebase functions:log

# Or in Firebase Console:
# Functions → Logs → Look for errors
```

✅ **Solution C:** Verify trigger is working
```javascript
// In Firebase Console → Functions → Dashboard
// Check if function is being invoked when event occurs

// Example: Send a test message
// Then check if sendMessageNotification was called
```

✅ **Solution D:** Check user preferences
```javascript
// In Firestore:
// userPreferences/{userId}/notifications/messageNotifications
// Should be true (or undefined, which defaults to true)
```

✅ **Solution E:** Test manually
```javascript
// In your app, call the function directly:
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendNotif = httpsCallable(functions, 'sendCustomPushNotification');

sendNotif({
  userId: 'YOUR_USER_ID',
  title: 'Test',
  body: 'Testing notifications',
  type: 'custom',
  url: '/'
}).then(result => {
  console.log('Result:', result);
}).catch(error => {
  console.error('Error:', error);
});
```

---

### Issue 5: Works in foreground but not background

**Symptoms:**
- Notifications appear when app is open
- But NOT when app is closed or in another tab

**Solutions:**

✅ **Solution A:** Verify service worker is active
```javascript
// DevTools Console:
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('State:', reg.active?.state); // Should be "activated"
});
```

✅ **Solution B:** Check service worker code
```javascript
// firebase-messaging-sw.js should have:
messaging.onBackgroundMessage((payload) => {
  // This handles background messages
  return self.registration.showNotification(...);
});
```

✅ **Solution C:** Test service worker directly
```javascript
// DevTools → Application → Service Workers
// Click "Update" to reload service worker
// Check for errors in service worker console
```

---

### Issue 6: Notification shows but click doesn't work

**Symptoms:**
- Notifications appear correctly
- But clicking does nothing or opens wrong page

**Solutions:**

✅ **Solution A:** Check notification data
```javascript
// In firebase-messaging-sw.js, log notification data:
self.addEventListener('notificationclick', (event) => {
  console.log('Notification data:', event.notification.data);
  // Verify data.type and data.url are correct
});
```

✅ **Solution B:** Verify URL format
```javascript
// In push-notification-function.js
// URLs should be relative: '/messages' not 'messages'
// Or absolute: 'https://lokalshops.co.uk/messages'
```

✅ **Solution C:** Check clients.matchAll
```javascript
// Service worker should open existing window if available
// Otherwise open new window
```

---

### Issue 7: Works in Chrome but not Safari

**Symptoms:**
- Notifications work perfectly in Chrome
- But nothing in Safari

**Solutions:**

✅ **macOS Safari requirements:**
- macOS 13 Ventura or later
- Safari 16.1 or later
- User must grant permission (same as Chrome)

✅ **iOS Safari requirements:**
- iOS 16.4 or later
- User must "Add to Home Screen" first
- Then grant notification permission

✅ **Test on macOS:**
```
1. Open Safari (not Chrome)
2. Go to your site
3. Allow notifications when prompted
4. Check Safari → Preferences → Websites → Notifications
5. Ensure your site is set to "Allow"
```

✅ **For iOS:** Push notifications only work for installed PWAs
```
1. Open site in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Open app from home screen
5. Allow notifications when prompted
```

---

### Issue 8: "Invalid registration token" error

**Symptoms:**
- Function logs show "invalid-registration-token"
- Or "registration-token-not-registered"

**Solutions:**

✅ **Solution A:** Token cleanup (automatic)
```javascript
// push-notification-function.js already handles this
// It removes invalid tokens automatically
// Check if token was removed from Firestore
```

✅ **Solution B:** User needs to re-enable notifications
```javascript
// User should:
1. Go to Settings → Push Notifications
2. Toggle off and on again
3. This generates new token
```

✅ **Solution C:** Clear old tokens
```javascript
// Run this Firebase Admin script:
const tokensRef = admin.firestore().collection('fcmTokens');
const snapshot = await tokensRef.get();

snapshot.forEach(async doc => {
  const data = doc.data();
  // Remove tokens older than 90 days
  if (data.updatedAt < Date.now() - 90 * 24 * 60 * 60 * 1000) {
    await doc.ref.update({ token: null, invalidatedAt: new Date() });
  }
});
```

---

### Issue 9: Notifications showing multiple times

**Symptoms:**
- Single event triggers multiple notifications
- Duplicate notifications appear

**Solutions:**

✅ **Solution A:** Check for multiple function deployments
```powershell
firebase functions:list
# Should only see each function once
# If duplicates, redeploy:
firebase deploy --only functions --force
```

✅ **Solution B:** Check for multiple service worker registrations
```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registrations:', regs.length); // Should be 1
  // If more than 1:
  regs.forEach(reg => reg.unregister());
  // Then reload page
});
```

✅ **Solution C:** Check notification tag
```javascript
// In firebase-messaging-sw.js
// Notifications with same tag replace each other
tag: payload.data?.type || 'default',
```

---

### Issue 10: High latency / Slow notifications

**Symptoms:**
- Notifications arrive but with significant delay
- Sometimes 30+ seconds after event

**Solutions:**

✅ **Solution A:** Check function cold starts
```javascript
// In Firebase Console → Functions → Details
// Check "Cold start" times
// If high (>3s), functions may be slow to start
```

✅ **Solution B:** Keep functions warm
```javascript
// Add a scheduled function to keep warm:
exports.keepWarm = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    console.log('Keeping functions warm');
  });
```

✅ **Solution C:** Check network
```javascript
// In DevTools → Network
// Check FCM connection status
// Should see websocket connection to FCM
```

---

## 🧪 Testing Tools

### Test 1: Manual Notification Test
```javascript
// Send test notification to yourself
// DevTools Console:
const functions = getFunctions();
const sendNotif = httpsCallable(functions, 'sendCustomPushNotification');

sendNotif({
  userId: 'YOUR_USER_ID', // Your Firebase user ID
  title: '🧪 Test Notification',
  body: 'If you see this, it works!',
  type: 'test',
  url: '/'
});
```

### Test 2: Service Worker Test
```javascript
// Test service worker message handling
// DevTools Console:
navigator.serviceWorker.ready.then(reg => {
  reg.showNotification('Test', {
    body: 'Testing service worker',
    icon: '/images/logo192.png'
  });
});
```

### Test 3: Permission Test
```javascript
// Check all permission states
console.log('Permission:', Notification.permission);
console.log('Service Worker:', 'serviceWorker' in navigator);
console.log('Notifications:', 'Notification' in window);
console.log('PushManager:', 'PushManager' in window);
```

### Test 4: Token Verification
```javascript
// Verify token is saved
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const tokenDoc = await getDoc(doc(db, 'fcmTokens', auth.currentUser.uid));
console.log('Token data:', tokenDoc.data());
```

---

## 📊 Debugging Checklist

Use this checklist when troubleshooting:

- [ ] Service worker registered (DevTools → Application)
- [ ] Permission is "granted" (console: `Notification.permission`)
- [ ] FCM token exists in Firestore (`fcmTokens` collection)
- [ ] VAPID key is configured (not placeholder)
- [ ] Functions are deployed (`firebase functions:list`)
- [ ] No errors in browser console
- [ ] No errors in function logs (`firebase functions:log`)
- [ ] User preferences allow notifications
- [ ] HTTPS enabled (service workers require it)
- [ ] Browser is supported (check compatibility)
- [ ] Service worker script accessible at root

---

## 🆘 Still Not Working?

### Get Detailed Logs

**Browser Console:**
```javascript
// Enable verbose logging
localStorage.setItem('debug', 'messaging:*');
// Reload page and check console
```

**Function Logs:**
```powershell
# Stream function logs in real-time
firebase functions:log --only sendMessageNotification

# Or check specific function
firebase functions:log --only sendMessageNotification --limit 50
```

**Firestore Audit:**
```javascript
// Check if data is correct
// In Firebase Console → Firestore:

// Check fcmTokens/{userId}:
{
  token: "eCgU...",  // Should be long string
  platform: "Windows",
  browser: "Chrome",
  userId: "abc123",
  updatedAt: Timestamp
}

// Check userPreferences/{userId}:
{
  notifications: {
    messageNotifications: true,
    orderNotifications: true,
    ...
  }
}
```

---

## 📞 Getting Help

If none of these solutions work:

1. **Check files:**
   - `PUSH_NOTIFICATIONS_SETUP.md` - Setup instructions
   - `PUSH_NOTIFICATIONS_ARCHITECTURE.md` - System design
   - `PUSH_NOTIFICATIONS_IMPLEMENTATION.md` - What was built

2. **Gather info:**
   - Browser and version
   - Operating system
   - Error messages (console and function logs)
   - Permission status
   - Service worker status

3. **Test in different browser:**
   - If works in Chrome but not Firefox → Browser-specific issue
   - If works in none → Configuration issue

4. **Test with different user:**
   - If works for one user but not another → User-specific issue
   - If works for none → System-wide issue

---

## ✅ Success Indicators

You'll know everything is working when:

1. ✅ Service worker shows as "activated" in DevTools
2. ✅ `Notification.permission` returns "granted"
3. ✅ FCM token visible in Firestore
4. ✅ Functions show invocations in Firebase Console
5. ✅ Notifications appear in real-time
6. ✅ Notifications work with app closed
7. ✅ Clicking notification opens correct page
8. ✅ No errors in console or function logs

---

**Remember:** Most issues are configuration-related. Double-check VAPID key, service worker location, and permission status first!
