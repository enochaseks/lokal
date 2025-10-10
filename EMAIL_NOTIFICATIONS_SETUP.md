# Email Notifications Setup Guide

## Gmail Configuration for Lokal Email Notifications

This guide helps you set up Gmail-based email notifications for message alerts in your Lokal platform.

### Prerequisites

1. **Gmail Account**: You need a Gmail account dedicated to sending notifications
2. **App Password**: You'll need to generate an App Password for the Gmail account
3. **Firebase Functions**: The email notification functions are ready to deploy

### Step 1: Prepare Gmail Account

1. **Use Dedicated Account**: Create or use a dedicated Gmail account for sending notifications (e.g., `notifications@yourdomain.com` or `lokal.notifications@gmail.com`)

2. **Enable 2-Factor Authentication**:
   - Go to your Google Account settings
   - Navigate to Security
   - Enable 2-Step Verification

3. **Generate App Password**:
   - Still in Security settings
   - Click on "App passwords"
   - Select "Mail" and "Other (Custom name)"
   - Enter "Lokal Notifications"
   - Copy the generated 16-character password

### Step 2: Configure Firebase Functions

You have two options for setting Gmail credentials:

#### Option A: Using Firebase Config (Recommended)

```bash
# Set Gmail configuration using Firebase CLI
firebase functions:config:set gmail.email="your-email@gmail.com"
firebase functions:config:set gmail.password="your-app-password"

# Verify configuration
firebase functions:config:get
```

#### Option B: Using Environment Variables

Create a `.env` file in the `functions` directory:

```env
GMAIL_EMAIL=your-email@gmail.com
GMAIL_PASSWORD=your-app-password
```

**Note**: Add `.env` to your `.gitignore` file to keep credentials secure.

### Step 3: Deploy Functions

```bash
# Navigate to your project root
cd /path/to/lokal

# Deploy the functions
firebase deploy --only functions
```

### Step 4: Test Email Notifications

#### Test via HTTP Function

```bash
# Test with curl
curl -X POST https://your-region-your-project.cloudfunctions.net/testEmailNotification \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your-test@email.com"}'
```

#### Test by Creating a Message

1. Go to your Lokal app
2. Send a message to another user
3. Check if the recipient receives an email notification

### Features

#### Automatic Email Notifications

- **Triggers**: Automatically sends when new messages are created in Firestore
- **Smart Filtering**: Skips internal messages and self-messages
- **Message Types**: Supports all message types (payment confirmations, order updates, etc.)
- **Seller Detection**: Automatically detects if recipient is a seller for customized emails

#### Email Template Features

- **Professional Design**: Clean, responsive HTML email template
- **Message Formatting**: Converts markdown-style formatting to HTML
- **Order Details**: Includes order information when available
- **Direct Links**: Links back to Lokal for easy replies
- **Mobile Friendly**: Responsive design for all devices

#### Message Types Supported

- ✅ Text messages
- ✅ Payment notifications
- ✅ Collection scheduling
- ✅ Order ready notifications
- ✅ Payment completions
- ✅ Bank transfer confirmations
- ✅ Item requests
- ✅ And more...

### Monitoring and Troubleshooting

#### Check Function Logs

```bash
# View function logs
firebase functions:log

# View specific function logs
firebase functions:log --only "sendMessageNotification"
```

#### Common Issues

1. **Authentication Failed**:
   - Verify App Password is correct
   - Ensure 2FA is enabled on Gmail account
   - Check Firebase config values

2. **Function Timeout**:
   - Check Gmail server connectivity
   - Verify function memory allocation
   - Review email content size

3. **Emails Not Delivered**:
   - Check spam folders
   - Verify recipient email addresses
   - Monitor Gmail sending limits

### Security Best Practices

1. **Dedicated Account**: Use a separate Gmail account only for notifications
2. **App Passwords**: Never use your main Gmail password
3. **Environment Security**: Keep credentials in Firebase config or secure .env files
4. **Regular Rotation**: Periodically rotate App Passwords
5. **Monitor Usage**: Watch for unusual sending patterns

### Customization

#### Email Templates

The email templates are in `email-notification-function.js`. You can customize:

- **HTML Styling**: Modify the CSS in `generateEmailTemplate()`
- **Content Format**: Adjust message formatting in `formatMessageForEmail()`
- **Subject Lines**: Update `getMessageTypeDescription()` for custom subjects

#### Notification Rules

Modify the notification logic in `sendMessageNotificationEmail()`:

- **Filter Message Types**: Add/remove message types to skip
- **Custom Recipients**: Add special handling for different user types
- **Timing Rules**: Add delays or scheduling logic

### Production Considerations

1. **Sending Limits**: Gmail has daily sending limits (500 emails/day for free accounts)
2. **Rate Limiting**: Implement delays between emails if sending many notifications
3. **Monitoring**: Set up alerts for failed email deliveries
4. **Backup Methods**: Consider alternative notification methods (SMS, push notifications)

### Support

If you encounter issues:

1. Check Firebase Functions logs
2. Verify Gmail account settings
3. Test with the HTTP test function
4. Monitor Firestore for notification status fields

The system automatically tracks email delivery status in the message documents with:
- `emailNotificationSent`: Boolean indicating success
- `emailNotificationId`: Gmail message ID
- `emailSentAt`: Timestamp of successful delivery
- `emailNotificationError`: Error message if failed

### Next Steps

1. Set up your Gmail credentials
2. Deploy the functions
3. Test with a few messages
4. Monitor the system for a few days
5. Customize email templates as needed
6. Consider additional notification channels

Your email notification system is now ready to keep your users engaged with timely message alerts!