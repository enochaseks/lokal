# Firebase Authentication Setup Guide

## Issue: Registration not working properly

The error `POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=... 400 (Bad Request)` indicates that **Email/Password authentication is not enabled in Firebase Console**.

## Solution Steps:

### 1. Enable Email/Password Authentication
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`lokal-b4b28`)
3. Navigate to **Authentication** → **Sign-in method**
4. Find **Email/Password** in the list
5. Click on it and toggle **Enable**
6. Click **Save**

### 2. Configure Email Verification Settings
1. In Firebase Console, go to **Authentication** → **Templates**
2. Click on **Email address verification**
3. Update the action URL to: `https://your-domain.com/login`
4. Customize the email template if needed
5. Click **Save**

### 3. Check Project Configuration
Verify your Firebase config in `src/firebase.js`:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAGEHLV7k8nAVaoqDmdbidi4j9Wm-zwOr8",
  authDomain: "lokal-b4b28.firebaseapp.com", // ✅ Should end with .firebaseapp.com
  projectId: "lokal-b4b28",
  storageBucket: "lokal-b4b28.firebasestorage.app",
  messagingSenderId: "469061847946",
  appId: "1:469061847946:web:71c4974365a321a328d673",
  measurementId: "G-WKYD2FX255"
};
```

### 4. Additional Checks
- Ensure your domain is added to **Authorized domains** in Authentication → Settings
- Check that Firebase Billing is enabled (required for some features)
- Verify Firestore security rules allow user creation

### 5. Test the Fix
After enabling Email/Password authentication:
1. Try registering a new user
2. Check browser console for any remaining errors
3. Verify email verification is sent
4. Test the complete registration flow

## Common Error Codes:
- `auth/operation-not-allowed` → Authentication method not enabled
- `auth/weak-password` → Password less than 6 characters
- `auth/email-already-in-use` → Email already registered
- `auth/invalid-email` → Invalid email format
- `auth/network-request-failed` → Network connectivity issue

## Performance Issues:
The slow registration is likely due to:
1. Multiple Firestore queries for deactivated accounts
2. HubSpot API calls blocking the main flow
3. Email verification network delay

These have been optimized in the updated RegisterPage.js.