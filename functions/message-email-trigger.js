const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Import the email notification function
const { sendMessageNotificationEmail } = require('./email-notification-function');

// Firestore trigger for new messages
exports.onMessageCreated = onDocumentCreated('messages/{messageId}', async (event) => {
  try {
    const message = event.data.data();
    const messageId = event.params.messageId;
    
    console.log(`📧 Processing email notification for message ${messageId}`);
    console.log('Message data:', {
      messageType: message.messageType,
      senderEmail: message.senderEmail,
      receiverEmail: message.receiverEmail,
      hasOrderData: !!message.orderData
    });

    const result = await sendMessageNotificationEmail(message);
    
    if (result.skipped) {
      console.log('✅ Email notification skipped for message:', messageId, 'Reason:', result.reason);
      return null;
    }

    // Update message document to track email notification
    await event.data.ref.update({
      emailNotificationSent: true,
      emailNotificationId: result.messageId,
      emailSentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Email notification completed for message:', messageId);
    return result;

  } catch (error) {
    console.error('❌ Error in email notification function:', error);
    
    // Update message document to track failed email
    try {
      await event.data.ref.update({
        emailNotificationSent: false,
        emailNotificationError: error.message,
        emailAttemptedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      console.error('❌ Failed to update message with error status:', updateError);
    }
    
    // Don't throw error to prevent function retry spam
    return { success: false, error: error.message };
  }
});