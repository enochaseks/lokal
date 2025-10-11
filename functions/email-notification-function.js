const functions = require('firebase-functions');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest, onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Load environment variables if .env file exists (for local development)
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (error) {
    console.log('dotenv not available, using Firebase config or system env vars');
  }
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Gmail configuration using environment variables
const createGmailTransporter = () => {
  // Firebase Functions v2 only supports environment variables
  const gmailEmail = process.env.GMAIL_EMAIL;
  const gmailPassword = process.env.GMAIL_PASSWORD;
  
  if (!gmailEmail || !gmailPassword) {
    throw new Error('Gmail credentials not configured. Please set GMAIL_EMAIL and GMAIL_PASSWORD environment variables or use Firebase config.');
  }
  
  console.log(`Creating Gmail transporter for: ${gmailEmail.substring(0, 3)}***@${gmailEmail.split('@')[1]}`);
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailEmail,
      pass: gmailPassword
    },
    // Add additional configuration for better reliability and spam prevention
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10,
    // Better email headers to avoid spam
    secure: true,
    requireTLS: true,
    tls: {
      rejectUnauthorized: true
    }
  });
};

// Message type descriptions for email subjects
const getMessageTypeDescription = (messageType) => {
  const types = {
    'text': 'New Message',
    'payment_notification': 'Payment Confirmation',
    'collection_scheduled': 'Collection Scheduled',
    'ready_for_collection': 'Order Ready for Collection',
    'done_adding': 'Order Complete - Ready for Payment',
    'items_bagged': 'Items Ready',
    'pay_at_store_ready': 'Ready for Store Payment',
    'pay_at_store_completed': 'Payment Completed',
    'collection_completed': 'Order Collected',
    'customer_coming_to_pay': 'Customer Coming to Store',
    'bank_transfer_submitted': 'Bank Transfer Submitted',
    'item_request': 'Item Request',
    'receipt_offer': 'Receipt Available'
  };
  return types[messageType] || 'New Message';
};

// Format message content for email
const formatMessageForEmail = (message) => {
  let content = message.message;
  
  // Clean up formatting for email
  content = content.replace(/\n/g, '<br>');
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  return content;
};

// Generate HTML email template
const generateEmailTemplate = (message, isForSeller = false) => {
  const messageTypeDesc = getMessageTypeDescription(message.messageType);
  const userType = isForSeller ? 'Seller' : 'Buyer';
  const formattedMessage = formatMessageForEmail(message);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lokal - ${messageTypeDesc}</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
                line-height: 1.6; 
                color: #333333; 
                margin: 0; 
                padding: 0; 
                background: linear-gradient(135deg, #F9F5EE 0%, #F0F8FF 100%);
            }
            .email-wrapper {
                background: linear-gradient(135deg, #F9F5EE 0%, #F0F8FF 100%);
                min-height: 100vh;
                padding: 20px 0;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background-color: #ffffff;
                border-radius: 16px;
                box-shadow: 0 4px 20px rgba(0, 123, 127, 0.1);
                overflow: hidden;
            }
            .header { 
                background: linear-gradient(135deg, #007B7F 0%, #00A8AC 50%, #FFD700 100%);
                color: #ffffff; 
                padding: 30px 20px; 
                text-align: center; 
                position: relative;
            }
            .logo-container {
                margin-bottom: 15px;
            }
            .logo {
                max-width: 80px;
                height: auto;
                margin-bottom: 10px;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
            }
            .brand-name {
                font-size: 2rem;
                font-weight: 800;
                margin: 0;
                text-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .subtitle {
                font-size: 1.1rem;
                font-weight: 400;
                margin: 8px 0 0 0;
                opacity: 0.95;
            }
            .content { 
                background: #ffffff;
                padding: 40px 30px;
            }
            .greeting {
                font-size: 1.1rem;
                color: #007B7F;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .message-box { 
                background: linear-gradient(135deg, #f8fdff 0%, #f0f9ff 100%);
                padding: 25px; 
                border-radius: 12px; 
                margin: 25px 0; 
                border-left: 5px solid #007B7F;
                border: 1px solid #e0f2f1;
                box-shadow: 0 2px 8px rgba(0, 123, 127, 0.05);
            }
            .meta-info { 
                background: rgba(0, 123, 127, 0.08);
                padding: 15px; 
                border-radius: 8px; 
                font-size: 14px; 
                margin-bottom: 20px;
                border: 1px solid rgba(0, 123, 127, 0.1);
            }
            .message-content {
                font-size: 1.05rem;
                line-height: 1.7;
                color: #2d3748;
                background: #ffffff;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
            }
            .button { 
                background: linear-gradient(135deg, #007B7F 0%, #00A8AC 100%);
                color: #ffffff; 
                padding: 16px 32px; 
                text-decoration: none; 
                border-radius: 25px; 
                display: inline-block; 
                margin: 25px 0; 
                font-weight: 700;
                font-size: 1.05rem;
                box-shadow: 0 4px 15px rgba(0, 123, 127, 0.3);
                transition: all 0.3s ease;
            }
            .button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 123, 127, 0.4);
            }
            .order-details { 
                background: linear-gradient(135deg, #fff8e6 0%, #fffbf0 100%);
                padding: 20px; 
                border-radius: 12px; 
                margin: 20px 0;
                border: 1px solid #fed7aa;
                border-left: 5px solid #FFD700;
            }
            .order-details h3 {
                color: #d97706;
                margin-top: 0;
                font-size: 1.1rem;
            }
            .quick-actions {
                background: #f8fafc;
                padding: 20px;
                border-radius: 12px;
                margin: 25px 0;
                border: 1px solid #e2e8f0;
            }
            .quick-actions h4 {
                color: #007B7F;
                margin-top: 0;
                font-size: 1.05rem;
            }
            .quick-actions ul {
                margin: 10px 0;
                padding-left: 20px;
            }
            .quick-actions li {
                margin: 8px 0;
                color: #4a5568;
            }
            .footer { 
                text-align: center; 
                padding: 30px 20px;
                background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                color: #718096; 
                font-size: 14px; 
            }
            .footer-logo {
                font-size: 1.2rem;
                font-weight: 700;
                color: #007B7F;
                margin-bottom: 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
            }
            .footer a {
                color: #007B7F;
                text-decoration: none;
                font-weight: 600;
            }
            .footer a:hover {
                text-decoration: underline;
            }
            .divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, #007B7F, transparent);
                margin: 25px 0;
            }
            
            /* Mobile responsiveness */
            @media only screen and (max-width: 600px) {
                .container { margin: 10px; }
                .content { padding: 25px 20px; }
                .header { padding: 25px 15px; }
                .brand-name { font-size: 1.6rem; }
                .button { padding: 14px 24px; font-size: 1rem; }
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="container">
                <div class="header">
                    <div class="logo-container">
                        <img src="https://lokalshops.co.uk/images/logo png.png" alt="Lokal Logo" style="width: 80px; height: auto; margin-bottom: 10px;" />
                    </div>
                    <h1 class="brand-name">Lokal</h1>
                    <p class="subtitle">${messageTypeDesc}</p>
                </div>
                <div class="content">
                    <div class="greeting">Hello ${message.receiverName || 'there'}! 👋</div>
                    <p style="font-size: 1.05rem; color: #4a5568; margin-bottom: 25px;">
                        You have received a new message on your local shopping platform:
                    </p>
                    
                    <div class="message-box">
                        <div class="meta-info">
                            <strong>📤 From:</strong> ${message.senderName}<br>
                            <strong>📋 Type:</strong> ${messageTypeDesc}<br>
                            <strong>🕒 Time:</strong> ${new Date().toLocaleString('en-GB', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                        <div class="message-content">
                            ${formattedMessage}
                        </div>
                    </div>

                    ${message.orderData ? `
                    <div class="order-details">
                        <h3>📦 Order Information</h3>
                        ${message.orderData.orderId ? `<p><strong>Order ID:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${message.orderData.orderId}</code></p>` : ''}
                        ${message.orderData.totalAmount ? `<p><strong>Total Amount:</strong> <span style="font-size: 1.1rem; font-weight: 600; color: #d97706;">${message.orderData.currency || '£'}${message.orderData.totalAmount}</span></p>` : ''}
                        ${message.orderData.pickupCode ? `<p><strong>Pickup Code:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-weight: bold; color: #007B7F;">${message.orderData.pickupCode}</code></p>` : ''}
                    </div>
                    ` : ''}

                    <div class="divider"></div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://lokalshops.co.uk/" class="button">🚀 Open Lokal App</a>
                    </div>

                    <div class="quick-actions">
                        <h4>⚡ What you can do:</h4>
                        <ul>
                            <li>💬 Reply to this message instantly</li>
                            <li>📦 Check your order status and tracking</li>
                            <li>🛍️ Browse local shops and deals</li>
                            <li>🔔 Manage your notification preferences</li>
                            <li>❓ Contact support if you need help</li>
                        </ul>
                    </div>
                </div>
                
                <div class="footer">
                    <div class="footer-logo">
                        <img src="https://lokalshops.co.uk/images/logo png.png" alt="Lokal" style="width: 40px; height: auto; margin-bottom: 5px;" />
                        <div>Lokal</div>
                    </div>
                    <p><strong>Your First Stop for Local African and Caribbean Shopping</strong></p>
                    <p>Connecting you with local businesses in your community</p>
                    <p style="margin: 15px 0;">
                        <a href="https://lokalshops.co.uk">Visit lokalshops.co.uk</a> • 
                        <a href="https://lokalshops.co.uk/settings">Notification Settings</a>
                    </p>
                    <p style="font-size: 12px; color: #a0aec0; margin-top: 20px;">
                        This email was sent because you have an active account on Lokal.<br>
                        To manage your email preferences, visit your account settings.
                    </p>
                </div>
            </div>
        </div>
        </div>
    </body>
    </html>
  `;
};

// Check user notification preferences
const checkUserPreferences = async (userId, messageType) => {
  try {
    const prefsDoc = await admin.firestore().doc(`userPreferences/${userId}`).get();
    if (!prefsDoc.exists) {
      // Default to sending emails if no preferences set
      return true;
    }

    const prefs = prefsDoc.data().notifications || {};
    
    // Check global email notifications setting
    if (!prefs.emailNotifications) {
      return false;
    }

    // Check specific notification type preferences
    const messageTypeMap = {
      'text': 'messageNotifications',
      'payment_notification': 'paymentNotifications',
      'bank_transfer_submitted': 'paymentNotifications',
      'collection_scheduled': 'orderNotifications',
      'ready_for_collection': 'collectionNotifications',
      'done_adding': 'orderNotifications',
      'items_bagged': 'orderNotifications',
      'pay_at_store_ready': 'collectionNotifications',
      'pay_at_store_completed': 'paymentNotifications',
      'collection_completed': 'orderNotifications',
      'customer_coming_to_pay': 'orderNotifications',
      'item_request': 'messageNotifications'
    };

    const prefKey = messageTypeMap[messageType];
    if (prefKey && prefs[prefKey] === false) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking user preferences:', error);
    // Default to sending emails if there's an error checking preferences
    return true;
  }
};

// Main function to send email notification
const sendMessageNotificationEmail = async (message) => {
  try {
    // Don't send emails for certain message types that are internal
    const skipEmailTypes = ['collection_pickup_code', 'receipt_offer'];
    if (skipEmailTypes.includes(message.messageType)) {
      console.log(`Skipping email for message type: ${message.messageType}`);
      return { success: true, skipped: true, reason: 'internal_message_type' };
    }

    // Get receiver email - first check message, then fetch from user/store document
    let receiverEmail = message.receiverEmail;
    
    if (!receiverEmail && message.receiverId) {
      console.log('No receiverEmail in message, fetching from user/store document...');
      
      try {
        // Try to get email from store document first (for sellers)
        const storeDoc = await admin.firestore().doc(`stores/${message.receiverId}`).get();
        if (storeDoc.exists) {
          receiverEmail = storeDoc.data().email;
          console.log(`Found email in store document: ${receiverEmail ? 'yes' : 'no'}`);
        }
        
        // If not found in store, try user document (for buyers)
        if (!receiverEmail) {
          const userDoc = await admin.firestore().doc(`users/${message.receiverId}`).get();
          if (userDoc.exists) {
            receiverEmail = userDoc.data().email;
            console.log(`Found email in user document: ${receiverEmail ? 'yes' : 'no'}`);
          }
        }
        
        // If still not found, try getting from Firebase Auth
        if (!receiverEmail) {
          try {
            const userRecord = await admin.auth().getUser(message.receiverId);
            receiverEmail = userRecord.email;
            console.log(`Found email in Firebase Auth: ${receiverEmail ? 'yes' : 'no'}`);
          } catch (authError) {
            console.log('Could not get email from Firebase Auth:', authError.message);
          }
        }
        
      } catch (error) {
        console.error('Error fetching receiver email:', error);
      }
    }

    // Don't send email if no receiver email found
    if (!receiverEmail) {
      console.log('No receiver email found after checking all sources, skipping email notification');
      return { success: true, skipped: true, reason: 'no_receiver_email' };
    }

    // Update message object with the found email for processing
    message.receiverEmail = receiverEmail;

    // Don't send email to self
    if (message.senderEmail === message.receiverEmail) {
      console.log('Sender and receiver are the same, skipping email notification');
      return { success: true, skipped: true, reason: 'self_message' };
    }

    // Check user notification preferences
    if (message.receiverId) {
      const allowNotification = await checkUserPreferences(message.receiverId, message.messageType);
      if (!allowNotification) {
        console.log(`User has disabled notifications for message type: ${message.messageType}`);
        return { success: true, skipped: true, reason: 'user_preferences_disabled' };
      }
    }

    const transporter = createGmailTransporter();
    const messageTypeDesc = getMessageTypeDescription(message.messageType);
    
    // Check if receiver is a seller (has a store)
    let isForSeller = false;
    try {
      const storeDoc = await admin.firestore().doc(`stores/${message.receiverId}`).get();
      isForSeller = storeDoc.exists;
    } catch (error) {
      console.log('Could not check if receiver is seller:', error);
    }

    const emailTemplate = generateEmailTemplate(message, isForSeller);
    
    const gmailEmail = process.env.GMAIL_EMAIL;
    
    const mailOptions = {
      from: {
        name: 'Lokal - Find Nearby African and Carribean Stores',
        address: gmailEmail
      },
      to: message.receiverEmail,
      subject: `Lokal - ${messageTypeDesc} from ${message.senderName}`,
      html: emailTemplate,
      // Plain text fallback
      text: `
        You have received a new message on Lokal from ${message.senderName}.
        
        Message: ${message.message}
        
        Visit https://lokalshops.co.uk/ to view and reply.
      `,
      // Additional headers to help avoid spam
      headers: {
        'X-Mailer': 'Lokal Notification System',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'List-Unsubscribe': `<https://lokalshops.co.uk/settings>`,
        'List-Id': 'Lokal Message Notifications <notifications.lokalshops.co.uk>',
        'Message-ID': `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@lokalshops.co.uk>`,
        'Reply-To': `noreply@lokalshops.co.uk`
      },
      // Better content type specification
      alternatives: [{
        contentType: 'text/html; charset=utf-8',
        content: emailTemplate
      }]
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email notification sent successfully:', result.messageId);
    
    return { 
      success: true, 
      messageId: result.messageId,
      recipientEmail: message.receiverEmail
    };

  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
};

// Cloud Function triggered when a new message is created
exports.sendMessageNotification = onDocumentCreated('messages/{messageId}', async (event) => {
  try {
    const message = event.data.data();
    const messageId = event.params.messageId;
    
    console.log(`Processing email notification for message ${messageId}`);
    console.log('Message data:', {
      messageType: message.messageType,
      senderEmail: message.senderEmail,
      receiverEmail: message.receiverEmail,
      hasOrderData: !!message.orderData
    });
    console.log('Email notification system activated');

    const result = await sendMessageNotificationEmail(message);
    
    if (result.skipped) {
      console.log('Email notification skipped for message:', messageId);
      return null;
    }

    // Update message document to track email notification
    await event.data.ref.update({
      emailNotificationSent: true,
      emailNotificationId: result.messageId,
      emailSentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Email notification completed for message:', messageId);
    return result;

  } catch (error) {
    console.error('Error in sendMessageNotification function:', error);
    
    // Update message document to track failed email
    await event.data.ref.update({
      emailNotificationSent: false,
      emailNotificationError: error.message,
      emailAttemptedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Don't throw error to prevent function retry spam
    return { success: false, error: error.message };
  }
});

// HTTP function to manually send email notifications (for testing)
exports.testEmailNotification = onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }

    const testMessage = {
      messageType: 'text',
      senderName: 'Test Sender',
      senderEmail: 'test@example.com',
      receiverName: 'Test Receiver',
      receiverEmail: req.body.testEmail || 'test@example.com',
      message: 'This is a test message to verify email notifications are working correctly.',
      timestamp: new Date(),
      conversationId: 'test-conversation'
    };

    const result = await sendMessageNotificationEmail(testMessage);
    
    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      result: result
    });

  } catch (error) {
    console.error('Error in test email function:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Batch email notification function for multiple messages
exports.batchSendEmailNotifications = onCall(async (request) => {
  const data = request.data;
  try {
    // Check if user is authenticated
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    const messageIds = data.messageIds;
    if (!messageIds || !Array.isArray(messageIds)) {
      throw new Error('messageIds must be an array');
    }

    const results = [];
    
    for (const messageId of messageIds) {
      try {
        const messageDoc = await admin.firestore().doc(`messages/${messageId}`).get();
        if (!messageDoc.exists) {
          results.push({ messageId, success: false, error: 'Message not found' });
          continue;
        }

        const message = messageDoc.data();
        const result = await sendMessageNotificationEmail(message);
        
        if (!result.skipped) {
          await messageDoc.ref.update({
            emailNotificationSent: true,
            emailNotificationId: result.messageId,
            emailSentAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        results.push({ messageId, success: true, result });

      } catch (error) {
        console.error(`Error processing message ${messageId}:`, error);
        results.push({ messageId, success: false, error: error.message });
      }
    }

    return {
      success: true,
      results: results,
      totalProcessed: results.length,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length
    };

  } catch (error) {
    console.error('Error in batch email notification:', error);
    throw new Error(error.message);
  }
});

// Export helper functions for other modules
module.exports = {
  sendMessageNotificationEmail,
  generateEmailTemplate,
  getMessageTypeDescription
};
