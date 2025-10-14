# Push Notifications - Quick Setup Checklist

## ⚡ Quick Start (5 Minutes)

### Step 1: Get VAPID Key from Firebase ⏱️ 2 min
- [ ] Go to https://console.firebase.google.com/
- [ ] Select **lokal-b4b28** project
- [ ] Click ⚙️ → **Project Settings**
- [ ] Go to **Cloud Messaging** tab
- [ ] Scroll to **Web Push certificates**
- [ ] Click **Generate key pair** (if not already done)
- [ ] Copy the key (starts with "BN...")

### Step 2: Add VAPID Key to Code ⏱️ 1 min
- [ ] Open `src/services/pushNotificationService.js`
- [ ] Find line ~65: `vapidKey: 'YOUR_VAPID_KEY_HERE'`
- [ ] Replace with your actual key: `vapidKey: 'BNxxx...'`
- [ ] Save the file

### Step 3: Deploy Functions ⏱️ 2 min
- [ ] Open PowerShell/Terminal
- [ ] Run: `cd functions`
- [ ] Run: `firebase deploy --only functions`
- [ ] Wait for deployment to complete
- [ ] Verify 6 functions deployed successfully

## 🧪 Testing (5 Minutes)

### Test Notifications
- [ ] Run: `npm start`
- [ ] Log in to the app
- [ ] You should see the notification permission prompt
- [ ] Click "Enable Notifications"
- [ ] Allow notifications in browser prompt
- [ ] Open DevTools Console - check for FCM token
- [ ] Open another browser/incognito window
- [ ] Log in with different account
- [ ] Send a message to your first account
- [ ] Check if notification appears (even if you switch tabs)
- [ ] Click notification - it should open Messages page

## 📋 Verification Checklist

### Frontend
- [✅] `PushNotificationPrompt` component created
- [✅] `PushNotificationSettings` component created
- [✅] `pushNotificationService.js` service created
- [✅] Service worker `firebase-messaging-sw.js` created
- [✅] Prompt added to `App.js`
- [✅] Settings added to `NotificationPreferences.js`
- [✅] Firebase messaging initialized in `firebase.js`
- [✅] Manifest updated with FCM support

### Backend
- [✅] `push-notification-function.js` created
- [✅] Functions exported in `index.js`
- [✅] Message notification trigger
- [✅] Order notification trigger
- [✅] Payment notification trigger
- [✅] Review notification trigger
- [✅] Store boost notification trigger
- [✅] Custom notification callable function

### Documentation
- [✅] Setup guide created
- [✅] Implementation summary created
- [✅] Usage examples created
- [✅] Test script created
- [✅] Security rules documented

## 🔍 What to Check

### In Browser
- [ ] Service worker registered (DevTools → Application → Service Workers)
- [ ] Notification permission: "granted" (DevTools → Console → `Notification.permission`)
- [ ] FCM token saved (check Firestore `fcmTokens` collection)
- [ ] No console errors

### In Firebase Console
- [ ] Functions deployed (Functions section)
- [ ] FCM tokens appearing in Firestore
- [ ] Cloud Messaging enabled
- [ ] VAPID key generated

### In Production
- [ ] Service worker accessible at root: `https://lokalshops.co.uk/firebase-messaging-sw.js`
- [ ] HTTPS enabled (required for service workers)
- [ ] Manifest file accessible

## 🎯 Expected Behavior

### First Visit
1. User logs in
2. After 3 seconds → Notification prompt appears
3. User clicks "Enable Notifications"
4. Browser asks for permission
5. User allows → FCM token saved
6. Prompt closes

### Receiving Notifications
1. User gets a message/order/payment
2. Cloud Function triggers automatically
3. Notification appears instantly
4. Works even if user is on different tab/app
5. Click notification → Opens relevant page

### Settings Management
1. User goes to Settings
2. Sees Push Notifications section
3. Can toggle on/off
4. Shows current status and browser info
5. Blocked users see instructions to unblock

## 🐛 Common Issues & Fixes

### "Service worker not found"
✅ **Fix:** Ensure `firebase-messaging-sw.js` is in `public` folder and deployed to root

### "Permission denied"
✅ **Fix:** Clear browser settings and try again, or guide user to allow in browser settings

### "No FCM token"
✅ **Fix:** Check VAPID key is correct, verify messaging is initialized

### "Notifications not triggering"
✅ **Fix:** Verify functions are deployed, check function logs in Firebase Console

### "Works in Chrome but not Safari"
✅ **Fix:** iOS Safari requires iOS 16.4+ and "Add to Home Screen" for push notifications

## 📱 Browser Testing

Test in these browsers:
- [ ] Chrome (Windows/Mac)
- [ ] Firefox (Windows/Mac)
- [ ] Safari (Mac) - macOS 13+
- [ ] Edge (Windows)
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS 16.4+) - Add to Home Screen first

## 🚀 Production Deployment

Before deploying to production:
- [ ] VAPID key added
- [ ] Functions deployed
- [ ] Service worker in build output
- [ ] HTTPS enabled
- [ ] Firestore rules updated
- [ ] Tested on multiple browsers
- [ ] Error handling verified

## ✅ Success Criteria

You'll know it's working when:
- ✅ Prompt appears for new users
- ✅ Browser permission request shows
- ✅ FCM token appears in Firestore
- ✅ Notifications arrive in real-time
- ✅ Works with browser in background
- ✅ Clicking notification opens correct page
- ✅ No console errors
- ✅ Settings page shows notification status

## 🎉 You're Done!

Once you've completed all steps:
1. ✅ Push notifications are live
2. ✅ Users get real-time updates
3. ✅ Works across all major browsers
4. ✅ Fully automated system

## 📞 Need Help?

Check these files:
- **Setup Guide:** `PUSH_NOTIFICATIONS_SETUP.md`
- **Implementation:** `PUSH_NOTIFICATIONS_IMPLEMENTATION.md`
- **Examples:** `src/utils/pushNotificationExamples.js`
- **Test Script:** `functions/test-push-notifications.js`

---

**Current Status:** 🟡 Waiting for VAPID key configuration

**Next Action:** Complete Step 1 & 2 above to activate push notifications!
