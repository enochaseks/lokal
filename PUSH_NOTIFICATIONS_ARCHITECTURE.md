# Push Notifications - System Architecture

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  React App (lokalshops.co.uk)                              │ │
│  │                                                             │ │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐   │ │
│  │  │ PushNotification     │  │ pushNotificationService  │   │ │
│  │  │ Prompt Component     │──│ - Request permission     │   │ │
│  │  │ - Shows on login     │  │ - Get FCM token          │   │ │
│  │  │ - Beautiful UI       │  │ - Save to Firestore      │   │ │
│  │  └──────────────────────┘  └──────────────────────────┘   │ │
│  │                                      ↓                      │ │
│  │            FCM Token saved to Firestore                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Service Worker (firebase-messaging-sw.js)                 │ │
│  │  - Runs in background                                      │ │
│  │  - Receives push messages                                  │ │
│  │  - Shows notifications                                     │ │
│  │  - Handles clicks                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕
                    Firebase Cloud Messaging
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      FIREBASE BACKEND                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Cloud Functions (Automatic Triggers)                      │ │
│  │                                                             │ │
│  │  📨 New Message Created → sendMessageNotification()        │ │
│  │  📦 New Order Placed    → sendOrderNotification()          │ │
│  │  💰 Payment Received    → sendPaymentNotification()        │ │
│  │  ⭐ Review Posted       → sendReviewNotification()         │ │
│  │  🚀 Store Boosted       → sendStoreBoostNotification()     │ │
│  │  🎯 Custom Call         → sendCustomPushNotification()     │ │
│  │                                                             │ │
│  │  Each function:                                            │ │
│  │  1. Gets user's FCM token from Firestore                  │ │
│  │  2. Checks notification preferences                       │ │
│  │  3. Sends notification via FCM                            │ │
│  │  4. Handles invalid tokens                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Firestore Collections                                     │ │
│  │                                                             │ │
│  │  • fcmTokens/{userId}                                      │ │
│  │    - token: "fcm_token_string"                            │ │
│  │    - platform: "Windows"                                  │ │
│  │    - browser: "Chrome"                                    │ │
│  │    - updatedAt: timestamp                                 │ │
│  │                                                             │ │
│  │  • userPreferences/{userId}                               │ │
│  │    - notifications: {                                     │ │
│  │        messageNotifications: true,                        │ │
│  │        orderNotifications: true,                          │ │
│  │        ...                                                 │ │
│  │      }                                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Notification Flow

### 1️⃣ Initial Setup (First Visit)
```
User logs in
    ↓
Wait 3 seconds
    ↓
Show PushNotificationPrompt
    ↓
User clicks "Enable Notifications"
    ↓
Browser shows permission dialog
    ↓
User clicks "Allow"
    ↓
Request FCM token from Firebase
    ↓
Save token to Firestore (fcmTokens collection)
    ↓
✅ Setup complete!
```

### 2️⃣ Sending Notification (Automatic)
```
Event occurs (e.g., new message)
    ↓
Firestore document created/updated
    ↓
Cloud Function triggered automatically
    ↓
Function checks user preferences
    ↓
Function gets FCM token from Firestore
    ↓
Function sends notification to FCM
    ↓
FCM delivers to user's device
    ↓
🔔 Notification appears!
```

### 3️⃣ Receiving Notification

#### When app is OPEN (Foreground):
```
FCM message arrives
    ↓
pushNotificationService receives it
    ↓
Shows browser notification
    ↓
Dispatches custom event for in-app handling
    ↓
🔔 User sees notification
```

#### When app is CLOSED (Background):
```
FCM message arrives
    ↓
Service Worker receives it
    ↓
Shows notification
    ↓
🔔 User sees notification (even if browsing other sites!)
```

### 4️⃣ Clicking Notification
```
User clicks notification
    ↓
Service worker handles click
    ↓
Check notification type (message, order, payment, etc.)
    ↓
Determine target URL
    ↓
Open/focus browser window
    ↓
Navigate to target page
    ↓
✅ User sees relevant content
```

## 🎯 Component Relationships

```
App.js
 ├── PushNotificationPrompt (auto-shows on login)
 │    └── pushNotificationService
 │         ├── firebase.js (messaging)
 │         └── Firestore (save token)
 │
 └── Settings Page
      └── NotificationPreferences
           └── PushNotificationSettings
                └── pushNotificationService
                     ├── Enable/disable
                     ├── Check status
                     └── Manage token
```

## 🔄 Data Flow

### Token Management
```
Frontend                    Firestore                Backend
────────                    ─────────                ───────
Request token    ──────►    Save token    ◄─────    Get token
Delete token     ──────►    Update token  ────────► Send notification
Check status     ◄──────    Read token
```

### Notification Preferences
```
Frontend                         Firestore                      Backend
────────                         ─────────                      ───────
Toggle setting   ─────────►      Save preference   ◄────────    Check preference
                                                   │            before sending
Read settings    ◄─────────      Get preference    │
```

## 🎨 UI Components

### PushNotificationPrompt
```
┌─────────────────────────────────────┐
│  🔔                                  │
│  Stay Connected!                    │
│  Get instant updates on your        │
│  orders and messages                │
│                                     │
│  Benefits:                          │
│  💬 Message alerts                  │
│  📦 Order updates                   │
│  💳 Payment confirmations           │
│  ⭐ New reviews                     │
│                                     │
│  ┌────────────────────────────┐    │
│  │ 🔔 Enable Notifications    │    │
│  └────────────────────────────┘    │
│  ┌────────────────────────────┐    │
│  │ Remind Me Later            │    │
│  └────────────────────────────┘    │
│  [ No Thanks ]                      │
└─────────────────────────────────────┘
```

### PushNotificationSettings
```
┌─────────────────────────────────────┐
│  🔔 Push Notifications      [ON]    │
│                                     │
│  Receive real-time notifications... │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Status: ✅ Enabled          │   │
│  │ Platform: Windows           │   │
│  │ Browser: Chrome             │   │
│  └─────────────────────────────┘   │
│                                     │
│  You'll be notified about:         │
│  💬 New messages                   │
│  📦 Order updates                  │
│  💳 Payments                       │
│  ⭐ Reviews                        │
│  🚀 Store boosts                   │
└─────────────────────────────────────┘
```

## 🔐 Security Model

```
User Access Rules
─────────────────
User A can only:
  ✅ Read their own FCM token
  ✅ Write their own FCM token
  ✅ Delete their own FCM token
  ❌ Access other users' tokens

Admin Access Rules
──────────────────
Admins can:
  ✅ Read all FCM tokens (for notifications)
  ❌ Cannot write tokens (only users can)

Cloud Functions
───────────────
Functions can:
  ✅ Read any FCM token (authenticated context)
  ✅ Send notifications to any token
  ✅ Update token status (invalid tokens)
```

## 📱 Cross-Browser Support

```
Browser         Support    Notes
────────────    ─────────  ────────────────────────────
Chrome Desktop  ✅ Full    All features work
Firefox Desktop ✅ Full    All features work
Safari Desktop  ✅ Full    macOS 13+ required
Edge Desktop    ✅ Full    All features work
Chrome Mobile   ✅ Full    Android only
Safari Mobile   ⚠️ Limited iOS 16.4+, Add to Home Screen
```

## 🧪 Testing Scenarios

### Scenario 1: New Message
```
User A                  System                    User B
──────                  ──────                    ──────
                        Message created
                        Function triggered
Send message ────►      Get User B token ────►    Notification!
                        Send via FCM
                        
User B clicks notification ────►                  Opens Messages
```

### Scenario 2: Background Notification
```
User                    System                    Browser
────                    ──────                    ───────
Switch to Gmail         Event occurs              
                        Function sends ────►       Service Worker
                                                   receives
Gmail tab active                          ◄────   Shows notification
Clicks notification                       ────►   Opens Lokal app
```

## 🎓 Key Concepts

### FCM Token
- Unique identifier for a device/browser
- Used to send notifications to specific user
- Changes when user clears data or uses new device
- Stored in Firestore for each user

### Service Worker
- Background script that runs separately from web page
- Can receive notifications when app is closed
- Must be at root URL path
- Requires HTTPS in production

### VAPID Key
- Public key for web push authentication
- Safe to include in client code
- Used to identify your app to FCM
- Generate once in Firebase Console

### Permission States
- **default**: User hasn't been asked yet
- **granted**: User allowed notifications
- **denied**: User blocked notifications

## 📈 Monitoring & Analytics

Track these metrics in Firebase Console:
```
Cloud Messaging
  ├── Messages sent (total count)
  ├── Messages delivered (success rate)
  ├── Messages opened (click-through rate)
  └── Messages failed (error rate)

Cloud Functions
  ├── Function invocations (per function)
  ├── Execution time (performance)
  ├── Errors (debugging)
  └── Logs (detailed info)

Firestore
  ├── fcmTokens collection (active devices)
  └── userPreferences (notification settings)
```

---

**🎯 Goal:** Seamless, real-time notifications across all devices and browsers!
