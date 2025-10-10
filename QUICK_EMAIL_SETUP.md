# 📧 Email Notifications - Quick Setup Guide

## Step 1: Install Dependencies

```powershell
cd functions
npm install
```

## Step 2: Configure Gmail

Run the interactive setup:
```powershell
npm run gmail:setup
```

This will ask for:
- Your Gmail email address
- Your Gmail App Password (16 characters)

### Getting Gmail App Password:
1. Go to [Google Account settings](https://myaccount.google.com/)
2. Click **Security** 
3. Enable **2-Step Verification** (if not already enabled)
4. Scroll down and click **App passwords**
5. Select **Mail** and **Other (Custom name)**
6. Enter **"Lokal Notifications"**
7. Copy the **16-character password** (with spaces is fine)

## Step 3: Test Everything

Test Gmail connection:
```powershell
npm run gmail:test
```

Send test email:
```powershell
npm run gmail:send-test your-email@example.com
```

## Step 4: Deploy

```powershell
cd ..
firebase deploy --only functions
```

## Step 5: Verify

1. Go to your Lokal app
2. Send a message to another user
3. Check if the recipient gets an email notification

## That's it! 🎉

Your email notification system is now live. Users will automatically receive email notifications when they get messages, unless they disable them in Settings > Communication Preferences.

## Quick Commands

```powershell
# In the functions directory:
npm run gmail:setup      # Setup Gmail credentials
npm run gmail:test       # Test Gmail connection  
npm run email:stats      # View email statistics
firebase functions:log   # View function logs
```

## Troubleshooting

**Gmail authentication failed?**
- Make sure 2FA is enabled on your Gmail account
- Double-check your App Password
- Try `npm run gmail:test`

**Emails not being sent?**
- Check `firebase functions:log` for errors
- Run `npm run email:stats` to see delivery rates
- Make sure functions deployed successfully

**Users not receiving emails?**
- Check their spam folders
- Verify they haven't disabled notifications in Settings
- Test with `npm run gmail:send-test their-email@example.com`