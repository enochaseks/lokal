const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Initialize Firebase Admin for standalone script
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error) {
    console.log('Firebase Admin initialization skipped (not needed for Gmail test)');
  }
}

// Create Gmail transporter for testing
function createTestGmailTransporter(email, password) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10
  });
}

// Test Gmail connection
async function testGmailConnection(email = null, password = null) {
  console.log('🧪 Testing Gmail Connection...');
  
  try {
    // Use provided credentials or environment variables
    const gmailEmail = email || process.env.GMAIL_EMAIL;
    const gmailPassword = password || process.env.GMAIL_PASSWORD;
    
    if (!gmailEmail || !gmailPassword) {
      throw new Error('Gmail credentials not found. Please run setup first.');
    }
    
    console.log(`Testing connection for: ${gmailEmail.substring(0, 3)}***@${gmailEmail.split('@')[1]}`);
    
    const transporter = createTestGmailTransporter(gmailEmail, gmailPassword);
    
    // Verify SMTP connection
    await transporter.verify();
    console.log('✅ Gmail SMTP connection successful!');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Gmail connection failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('Invalid login')) {
      console.error('🔑 Check your Gmail App Password - it should be 16 characters');
      console.error('🔐 Make sure 2-Factor Authentication is enabled on your Gmail account');
    } else if (error.message.includes('less secure app')) {
      console.error('🔒 Use App Password instead of your regular Gmail password');
    }
    
    return { success: false, error: error.message };
  }
}

// Setup Gmail configuration
async function setupGmailConfig() {
  console.log('🔧 Gmail Configuration Setup');
  console.log('============================');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
  
  try {
    console.log('\n📧 Gmail Setup Instructions:');
    console.log('1. Create or use a Gmail account for notifications');
    console.log('2. Enable 2-Factor Authentication on the account');
    console.log('3. Generate an App Password:');
    console.log('   - Go to Google Account settings');
    console.log('   - Security > 2-Step Verification');
    console.log('   - At bottom, click "App passwords"');
    console.log('   - Select "Mail" and "Other (Custom name)"');
    console.log('   - Enter "Lokal Notifications"');
    console.log('   - Copy the 16-character password');
    console.log('');
    
    const email = await question('Enter your Gmail email: ');
    const password = await question('Enter your Gmail App Password: ');
    
    rl.close();
    
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email format');
    }
    
    // Create .env file
    const fs = require('fs');
    const envContent = `# Lokal Email Notifications Configuration
# Generated on ${new Date().toISOString()}

GMAIL_EMAIL=${email}
GMAIL_PASSWORD=${password}

# Never commit this file to git!
`;
    
    fs.writeFileSync('.env', envContent);
    console.log('✅ .env file created successfully');
    
    // Test the connection with the provided credentials
    const testResult = await testGmailConnection(email, password);
    
    if (testResult.success) {
      console.log('🎉 Gmail configuration complete and tested!');
      return true;
    } else {
      console.log('❌ Configuration saved but connection test failed');
      console.log('Please verify your credentials and try again');
      console.log('');
      console.log('💡 Common issues:');
      console.log('   • Make sure you used an App Password, not your regular Gmail password');
      console.log('   • Verify 2-Factor Authentication is enabled on your Gmail account');
      console.log('   • Check that the App Password is exactly 16 characters');
      return false;
    }
    
  } catch (error) {
    rl.close();
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

// Send test email
async function sendTestEmail(testEmailAddress) {
  console.log(`📧 Sending test email to ${testEmailAddress}...`);
  
  try {
    const gmailEmail = process.env.GMAIL_EMAIL;
    const gmailPassword = process.env.GMAIL_PASSWORD;
    
    if (!gmailEmail || !gmailPassword) {
      throw new Error('Gmail credentials not configured. Please run setup first.');
    }
    
    const transporter = createTestGmailTransporter(gmailEmail, gmailPassword);
    
    const testMessage = {
      from: {
        name: 'Lokal Test',
        address: gmailEmail
      },
      to: testEmailAddress,
      subject: 'Lokal - Test Email Notification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">📱 Lokal</h1>
            <h2 style="margin: 10px 0 0 0;">Test Email Notification</h2>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <p><strong>Hello there!</strong></p>
            <p>This is a test email from your Lokal notification system.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4F46E5; margin: 20px 0;">
              <p style="margin: 0;"><strong>🎉 Success!</strong> If you receive this email, your email notifications are working correctly!</p>
            </div>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">📦 Test Order Details</h3>
              <p style="margin: 5px 0;"><strong>Order ID:</strong> TEST-ORDER-123</p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> £25.99</p>
              <p style="margin: 5px 0;"><strong>Pickup Code:</strong> TEST123</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://lokal-c2413.web.app/messages" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View on Lokal
              </a>
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
            <p>This email was sent by Lokal - Your Local Shopping Platform</p>
          </div>
        </div>
      `,
      text: `
        Hello there!
        
        This is a test email from your Lokal notification system.
        
        🎉 Success! If you receive this email, your email notifications are working correctly!
        
        Test Order Details:
        Order ID: TEST-ORDER-123
        Amount: £25.99
        Pickup Code: TEST123
        
        Visit https://lokal-c2413.web.app/messages to view on Lokal.
        
        This email was sent by Lokal - Your Local Shopping Platform
      `
    };
    
    const result = await transporter.sendMail(testMessage);
    
    console.log('✅ Test email sent successfully!');
    console.log(`📬 Check the inbox for ${testEmailAddress}`);
    console.log(`📧 Message ID: ${result.messageId}`);
    
    return true;
  } catch (error) {
    console.error('❌ Test email error:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.error('🔑 Gmail authentication failed - check your App Password');
    } else if (error.message.includes('Invalid mail command')) {
      console.error('📧 Invalid email address format');
    }
    
    return false;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'setup':
      await setupGmailConfig();
      break;
      
    case 'test-connection':
      await testGmailConnection();
      break;
      
    case 'send-test':
      const email = args[1];
      if (!email) {
        console.error('Usage: node gmail-setup.js send-test <email>');
        process.exit(1);
      }
      await sendTestEmail(email);
      break;
      
    default:
      console.log(`
📧 Lokal Gmail Configuration Tool

Usage:
  node gmail-setup.js <command> [options]

Commands:
  setup              Interactive Gmail configuration setup
  test-connection    Test Gmail SMTP connection
  send-test <email>  Send test email to verify everything works

Examples:
  node gmail-setup.js setup
  node gmail-setup.js test-connection
  node gmail-setup.js send-test test@example.com
      `);
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testGmailConnection,
  setupGmailConfig,
  sendTestEmail
};