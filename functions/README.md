# Lokal Functions - Email Notifications

This directory contains Firebase Cloud Functions for sending email notifications when users receive messages.

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Gmail
```bash
npm run gmail:setup
```
This will guide you through:
- Setting up Gmail credentials
- Creating `.env` file
- Testing the connection

### 3. Test Email System
```bash
npm run gmail:test                    # Test Gmail connection
npm run gmail:send-test your@email.com  # Send test email
```

### 4. Deploy Functions
```bash
firebase deploy --only functions
```

## Gmail Setup Requirements

1. **Gmail Account**: Use a dedicated Gmail account for notifications
2. **2-Factor Authentication**: Must be enabled on the Gmail account
3. **App Password**: Generate a 16-character app password:
   - Go to Google Account settings
   - Security > 2-Step Verification  
   - Click "App passwords" at bottom
   - Select "Mail" and "Other (Custom name)"
   - Enter "Lokal Notifications"
   - Copy the password

## Environment Variables

The system uses a `.env` file (created by `npm run gmail:setup`):

```bash
GMAIL_EMAIL=your-notifications@gmail.com
GMAIL_PASSWORD=your-16-character-app-password
```

**Important**: Never commit the `.env` file to git!

## Available Commands

```bash
# Gmail Configuration
npm run gmail:setup           # Interactive Gmail setup
npm run gmail:test           # Test Gmail connection
npm run gmail:send-test      # Send test email

# Email Management  
npm run email:test           # Test email notifications
npm run email:resend         # Resend failed emails
npm run email:stats          # View delivery statistics
npm run email:cleanup        # Clean old tracking data

# Firebase Functions
npm run serve               # Run functions locally
npm run deploy              # Deploy to production
npm run logs                # View function logs
```

## How It Works

1. **Trigger**: When a new message is added to Firestore `messages` collection
2. **Process**: The `sendMessageNotification` function automatically:
   - Checks user notification preferences
   - Formats the message for email
   - Sends via Gmail SMTP
   - Tracks delivery status
3. **User Control**: Users can manage preferences in Settings > Communication Preferences

## Email Types Supported

- ✅ New text messages
- ✅ Payment confirmations  
- ✅ Order status updates
- ✅ Collection reminders
- ✅ Bank transfer notifications
- ✅ Item requests
- ✅ All message types in the system

## Troubleshooting

### Gmail Authentication Failed
- Verify 2FA is enabled on Gmail account
- Check App Password is correct (16 characters)
- Test with `npm run gmail:test`

### Emails Not Delivered
- Check spam folders
- Verify recipient email addresses
- Monitor with `npm run email:stats`
- Check function logs: `npm run logs`

### Function Deployment Issues
- Ensure Firebase CLI is installed and logged in
- Check project permissions
- Verify functions are enabled in Firebase console

## File Structure

```
functions/
├── .env.example              # Environment template
├── .env                      # Your Gmail credentials (don't commit!)
├── gmail-setup.js           # Gmail configuration tool
├── email-notification-function.js  # Main notification function
├── email-management.js      # Management utilities
├── index.js                 # Function exports
└── package.json            # Dependencies and scripts
```

## Production Considerations

- **Sending Limits**: Gmail has daily sending limits
- **Rate Limiting**: Built-in rate limiting to prevent spam
- **Error Tracking**: Failed emails are logged for retry
- **User Preferences**: Respect user notification settings
- **Security**: App passwords are more secure than account passwords

## Support

If you encounter issues:

1. Check function logs: `npm run logs`
2. Test Gmail connection: `npm run gmail:test`
3. View email statistics: `npm run email:stats`
4. Check `.env` file configuration
5. Verify Firebase project settings

For detailed documentation, see the main project README.