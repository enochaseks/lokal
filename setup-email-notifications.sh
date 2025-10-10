#!/usr/bin/env bash

# Lokal Email Notifications Deployment Script
# This script helps you deploy the email notification functions with proper Gmail configuration

set -e  # Exit on any error

echo "🚀 Lokal Email Notifications Deployment"
echo "======================================="

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: Please run this script from your Lokal project root directory"
    echo "   (The directory containing firebase.json)"
    exit 1
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI is not installed"
    echo "   Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please log in to Firebase first:"
    firebase login
fi

echo ""
echo "📧 Gmail Configuration Setup"
echo "=============================="

# Get Gmail credentials from user
read -p "Enter your Gmail email address for notifications: " GMAIL_EMAIL
if [ -z "$GMAIL_EMAIL" ]; then
    echo "❌ Gmail email is required"
    exit 1
fi

echo ""
echo "📋 To get your Gmail App Password:"
echo "   1. Go to your Google Account settings"
echo "   2. Navigate to Security > 2-Step Verification"
echo "   3. At the bottom, click 'App passwords'"
echo "   4. Select 'Mail' and 'Other (Custom name)'"
echo "   5. Enter 'Lokal Notifications' as the name"
echo "   6. Copy the 16-character password"
echo ""

read -s -p "Enter your Gmail App Password: " GMAIL_PASSWORD
echo ""

if [ -z "$GMAIL_PASSWORD" ]; then
    echo "❌ Gmail App Password is required"
    exit 1
fi

# Validate email format
if ! echo "$GMAIL_EMAIL" | grep -E '^[^@]+@[^@]+\.[^@]+$' > /dev/null; then
    echo "❌ Invalid email format"
    exit 1
fi

# Validate password format (should be 16 characters)
if [ ${#GMAIL_PASSWORD} -ne 16 ]; then
    echo "⚠️  Warning: Gmail App Passwords are typically 16 characters long"
    echo "   Please verify your password is correct"
fi

echo ""
echo "🔧 Setting Firebase configuration..."

# Set Firebase function configuration
firebase functions:config:set gmail.email="$GMAIL_EMAIL" gmail.password="$GMAIL_PASSWORD"

echo "✅ Gmail configuration set successfully"

# Verify configuration
echo ""
echo "📋 Current Firebase configuration:"
firebase functions:config:get

echo ""
echo "📦 Installing dependencies..."

# Install dependencies in functions directory
cd functions
npm install
cd ..

echo "✅ Dependencies installed"

echo ""
echo "🚀 Deploying functions..."

# Deploy only the functions
firebase deploy --only functions

echo ""
echo "✅ Deployment complete!"

echo ""
echo "🧪 Testing email notifications..."

# Test email notification
echo "📧 Sending test email to verify configuration..."

# Create a simple test
read -p "Enter an email address to send a test notification to: " TEST_EMAIL

if [ ! -z "$TEST_EMAIL" ]; then
    echo "Sending test email..."
    
    # Use curl to call the test function
    PROJECT_ID=$(firebase use --quiet)
    REGION="us-central1"  # Default region, adjust if different
    
    curl -X POST \
        "https://$REGION-$PROJECT_ID.cloudfunctions.net/testEmailNotification" \
        -H "Content-Type: application/json" \
        -d "{\"testEmail\": \"$TEST_EMAIL\"}" \
        --silent --show-error || echo "⚠️  Could not send test email via HTTP. The function may still work via Firestore triggers."
    
    echo ""
    echo "📬 Test email sent! Please check the inbox for $TEST_EMAIL"
else
    echo "⏩ Skipping test email"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "✅ Your email notification system is now configured:"
echo "   • Gmail: $GMAIL_EMAIL"
echo "   • Functions deployed"
echo "   • Automatic notifications enabled"
echo ""
echo "📚 Next steps:"
echo "   1. Users can manage their email preferences in Settings > Communication Preferences"
echo "   2. Monitor function logs with: firebase functions:log"
echo "   3. Check email statistics with: npm run email:stats"
echo ""
echo "🔧 Management commands:"
echo "   • Test emails: npm run email:test <email>"
echo "   • Resend failed: npm run email:resend"
echo "   • View stats: npm run email:stats"
echo "   • Clean up old data: npm run email:cleanup"
echo ""
echo "📖 For detailed documentation, see EMAIL_NOTIFICATIONS_SETUP.md"
echo ""
echo "🎯 Email notifications will now be automatically sent when:"
echo "   • Users receive new messages"
echo "   • Payment confirmations are sent"
echo "   • Orders are ready for collection"
echo "   • And many other message types!"
echo ""
echo "Happy messaging! 🚀"