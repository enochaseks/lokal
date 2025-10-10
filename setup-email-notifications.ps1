# Lokal Email Notifications Deployment Script (PowerShell)
# This script helps you deploy the email notification functions with proper Gmail configuration

$ErrorActionPreference = "Stop"

Write-Host "🚀 Lokal Email Notifications Deployment" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "firebase.json")) {
    Write-Host "❌ Error: Please run this script from your Lokal project root directory" -ForegroundColor Red
    Write-Host "   (The directory containing firebase.json)" -ForegroundColor Red
    exit 1
}

# Check if Firebase CLI is installed
try {
    firebase --version | Out-Null
} catch {
    Write-Host "❌ Error: Firebase CLI is not installed" -ForegroundColor Red
    Write-Host "   Install it with: npm install -g firebase-tools" -ForegroundColor Red
    exit 1
}

# Check if user is logged in to Firebase
try {
    firebase projects:list | Out-Null
} catch {
    Write-Host "🔐 Please log in to Firebase first:" -ForegroundColor Yellow
    firebase login
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host ""
Write-Host "📧 Gmail Configuration Setup" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green

# Get Gmail credentials from user
$GMAIL_EMAIL = Read-Host "Enter your Gmail email address for notifications"
if ([string]::IsNullOrEmpty($GMAIL_EMAIL)) {
    Write-Host "❌ Gmail email is required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 To get your Gmail App Password:" -ForegroundColor Yellow
Write-Host "   1. Go to your Google Account settings" -ForegroundColor Yellow
Write-Host "   2. Navigate to Security > 2-Step Verification" -ForegroundColor Yellow
Write-Host "   3. At the bottom, click 'App passwords'" -ForegroundColor Yellow
Write-Host "   4. Select 'Mail' and 'Other (Custom name)'" -ForegroundColor Yellow
Write-Host "   5. Enter 'Lokal Notifications' as the name" -ForegroundColor Yellow
Write-Host "   6. Copy the 16-character password" -ForegroundColor Yellow
Write-Host ""

$GMAIL_PASSWORD = Read-Host "Enter your Gmail App Password" -AsSecureString
$GMAIL_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($GMAIL_PASSWORD))

if ([string]::IsNullOrEmpty($GMAIL_PASSWORD_PLAIN)) {
    Write-Host "❌ Gmail App Password is required" -ForegroundColor Red
    exit 1
}

# Validate email format
if ($GMAIL_EMAIL -notmatch '^[^@]+@[^@]+\.[^@]+$') {
    Write-Host "❌ Invalid email format" -ForegroundColor Red
    exit 1
}

# Validate password format (should be 16 characters)
if ($GMAIL_PASSWORD_PLAIN.Length -ne 16) {
    Write-Host "⚠️  Warning: Gmail App Passwords are typically 16 characters long" -ForegroundColor Yellow
    Write-Host "   Please verify your password is correct" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔧 Setting Firebase configuration..." -ForegroundColor Cyan

# Set Firebase function configuration
firebase functions:config:set gmail.email="$GMAIL_EMAIL" gmail.password="$GMAIL_PASSWORD_PLAIN"
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ Failed to set Firebase configuration" -ForegroundColor Red
    exit 1 
}

Write-Host "✅ Gmail configuration set successfully" -ForegroundColor Green

# Verify configuration
Write-Host ""
Write-Host "📋 Current Firebase configuration:" -ForegroundColor Cyan
firebase functions:config:get

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan

# Install dependencies in functions directory
Push-Location functions
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} catch {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "✅ Dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 Deploying functions..." -ForegroundColor Cyan

# Deploy only the functions
firebase deploy --only functions
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1 
}

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green

Write-Host ""
Write-Host "🧪 Testing email notifications..." -ForegroundColor Cyan

# Test email notification
Write-Host "📧 Sending test email to verify configuration..." -ForegroundColor Cyan

$TEST_EMAIL = Read-Host "Enter an email address to send a test notification to (or press Enter to skip)"

if (-not [string]::IsNullOrEmpty($TEST_EMAIL)) {
    Write-Host "Sending test email..." -ForegroundColor Cyan
    
    try {
        # Get project ID
        $PROJECT_ID = firebase use --quiet
        $REGION = "us-central1"  # Default region, adjust if different
        
        $uri = "https://$REGION-$PROJECT_ID.cloudfunctions.net/testEmailNotification"
        $body = @{
            testEmail = $TEST_EMAIL
        } | ConvertTo-Json
        
        Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType "application/json" | Out-Null
        Write-Host "📬 Test email sent! Please check the inbox for $TEST_EMAIL" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Could not send test email via HTTP. The function may still work via Firestore triggers." -ForegroundColor Yellow
    }
} else {
    Write-Host "⏩ Skipping test email" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Your email notification system is now configured:" -ForegroundColor Green
Write-Host "   • Gmail: $GMAIL_EMAIL" -ForegroundColor White
Write-Host "   • Functions deployed" -ForegroundColor White
Write-Host "   • Automatic notifications enabled" -ForegroundColor White
Write-Host ""
Write-Host "📚 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Users can manage their email preferences in Settings > Communication Preferences" -ForegroundColor White
Write-Host "   2. Monitor function logs with: firebase functions:log" -ForegroundColor White
Write-Host "   3. Check email statistics with: npm run email:stats" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Management commands:" -ForegroundColor Cyan
Write-Host "   • Test emails: npm run email:test <email>" -ForegroundColor White
Write-Host "   • Resend failed: npm run email:resend" -ForegroundColor White
Write-Host "   • View stats: npm run email:stats" -ForegroundColor White
Write-Host "   • Clean up old data: npm run email:cleanup" -ForegroundColor White
Write-Host ""
Write-Host "📖 For detailed documentation, see EMAIL_NOTIFICATIONS_SETUP.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Email notifications will now be automatically sent when:" -ForegroundColor Cyan
Write-Host "   • Users receive new messages" -ForegroundColor White
Write-Host "   • Payment confirmations are sent" -ForegroundColor White
Write-Host "   • Orders are ready for collection" -ForegroundColor White
Write-Host "   • And many other message types!" -ForegroundColor White
Write-Host ""
Write-Host "Happy messaging! 🚀" -ForegroundColor Green

# Clear the password from memory
$GMAIL_PASSWORD_PLAIN = $null