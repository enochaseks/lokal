# Firebase Domain Authorization Guide

## Issue: `auth/unauthorized-continue-uri` Error

This error occurs when trying to use custom URLs in Firebase email verification that aren't authorized in your Firebase project.

## Quick Fix (Current Solution)

We've updated the code to use Firebase's default email verification (no custom URLs), which should work immediately without any configuration changes.

## Files Updated:
- `EmailVerificationPage.js` - Simplified to use default email verification
- `RegisterPage.js` - Simplified to use default email verification
- `emailDiagnostics.js` - Updated to test only default settings
- `manualEmailTest.js` - Updated to avoid unauthorized domains

## How to Authorize Domains (Optional)

If you want to use custom verification URLs in the future:

### Step 1: Access Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `lokal-b4b28`

### Step 2: Navigate to Authentication Settings
1. Click on "Authentication" in the left sidebar
2. Click on the "Settings" tab
3. Scroll down to "Authorized domains"

### Step 3: Add Authorized Domains
Add these domains to the authorized list:
- `localhost` (for development)
- `lokalshops.co.uk` (your production domain)
- `lokal-b4b28.firebaseapp.com` (Firebase hosting)
- `lokal-b4b28.web.app` (Firebase hosting alternative)
- Any other domains where your app runs

### Step 4: Configure Email Templates (Optional)
1. In Firebase Console > Authentication > Templates
2. Click on "Email address verification"
3. Customize the email template if needed
4. Set the action URL to your preferred domain

## Testing Email Verification

### Current Status
- ✅ Uses Firebase default email verification
- ✅ No domain authorization required
- ✅ Should work immediately
- ✅ Rate limiting implemented
- ✅ Proper error handling

### To Test:
1. Register a new user
2. Check console for "Email sent successfully with default settings"
3. Check your email inbox (and spam folder)
4. Click the verification link in the email

### If Still Not Working:
1. Check Firebase Console > Authentication > Sign-in method
2. Ensure Email/Password is enabled
3. Check Firebase Console > Authentication > Templates
4. Ensure email verification template is enabled
5. Check browser network tab for any blocked requests

## Troubleshooting Checklist

- [ ] Firebase Authentication is enabled
- [ ] Email/Password sign-in method is enabled
- [ ] Email verification template is enabled
- [ ] No ad blockers blocking Firebase requests
- [ ] Correct Firebase configuration in `firebase.js`
- [ ] User has proper internet connection
- [ ] Email provider isn't blocking Firebase emails

## Support

If email verification still doesn't work after these changes:
1. Check browser console for detailed error messages
2. Try in incognito mode
3. Try with a different email provider (Gmail, etc.)
4. Check Firebase Console > Usage for any quota issues