const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

const { sendMessageNotificationEmail } = require('./email-notification-function');

/**
 * Test email notification system
 */
async function testEmailNotification(testEmail) {
  console.log('🧪 Testing email notification system...');
  
  const testMessage = {
    messageType: 'text',
    senderName: 'Test Seller',
    senderEmail: 'seller@test.com',
    receiverId: 'test-buyer-id',
    receiverName: 'Test Buyer',
    receiverEmail: testEmail,
    message: 'Hello! This is a test message from your Lokal seller. Your order is ready for collection. Please come to the store at your scheduled time.',
    timestamp: new Date(),
    conversationId: 'test-conversation-id',
    orderData: {
      orderId: 'ORD-TEST-123',
      totalAmount: 25.99,
      currency: '£',
      pickupCode: 'ABC123'
    }
  };

  try {
    const result = await sendMessageNotificationEmail(testMessage);
    console.log('✅ Test email sent successfully!');
    console.log('Result:', result);
    return result;
  } catch (error) {
    console.error('❌ Test email failed:', error);
    throw error;
  }
}

/**
 * Resend failed email notifications
 */
async function resendFailedNotifications(hoursBack = 24) {
  console.log(`🔄 Checking for failed email notifications in the last ${hoursBack} hours...`);
  
  const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
  
  const db = admin.firestore();
  const messagesQuery = db.collection('messages')
    .where('timestamp', '>=', cutoffTime)
    .where('emailNotificationSent', '==', false);
  
  const snapshot = await messagesQuery.get();
  
  if (snapshot.empty) {
    console.log('✅ No failed email notifications found.');
    return { processed: 0, successful: 0, failed: 0 };
  }

  console.log(`📧 Found ${snapshot.docs.length} messages with failed email notifications.`);
  
  let successful = 0;
  let failed = 0;
  
  for (const doc of snapshot.docs) {
    const message = doc.data();
    
    try {
      console.log(`Resending email for message ${doc.id}...`);
      const result = await sendMessageNotificationEmail(message);
      
      if (!result.skipped) {
        await doc.ref.update({
          emailNotificationSent: true,
          emailNotificationId: result.messageId,
          emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          emailResendAt: admin.firestore.FieldValue.serverTimestamp()
        });
        successful++;
        console.log(`✅ Resent email for message ${doc.id}`);
      } else {
        console.log(`⏩ Skipped email for message ${doc.id} (${result.reason || 'internal message'})`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to resend email for message ${doc.id}:`, error);
      
      await doc.ref.update({
        emailNotificationError: error.message,
        emailRetryAttemptedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      failed++;
    }
  }
  
  console.log(`\n📊 Resend Summary:`);
  console.log(`Total processed: ${snapshot.docs.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  
  return { processed: snapshot.docs.length, successful, failed };
}

/**
 * Get email notification statistics
 */
async function getEmailStats(daysBack = 7) {
  console.log(`📊 Getting email notification statistics for the last ${daysBack} days...`);
  
  const cutoffTime = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000));
  
  const db = admin.firestore();
  const messagesQuery = db.collection('messages')
    .where('timestamp', '>=', cutoffTime);
  
  const snapshot = await messagesQuery.get();
  
  let totalMessages = 0;
  let emailsSent = 0;
  let emailsFailed = 0;
  let emailsSkipped = 0;
  const messageTypes = {};
  const errorTypes = {};
  
  snapshot.docs.forEach(doc => {
    const message = doc.data();
    totalMessages++;
    
    // Count message types
    messageTypes[message.messageType] = (messageTypes[message.messageType] || 0) + 1;
    
    // Count email status
    if (message.emailNotificationSent === true) {
      emailsSent++;
    } else if (message.emailNotificationSent === false) {
      emailsFailed++;
      if (message.emailNotificationError) {
        errorTypes[message.emailNotificationError] = (errorTypes[message.emailNotificationError] || 0) + 1;
      }
    } else {
      emailsSkipped++;
    }
  });
  
  console.log(`\n📈 Email Notification Statistics (Last ${daysBack} days):`);
  console.log(`Total Messages: ${totalMessages}`);
  console.log(`Emails Sent: ${emailsSent}`);
  console.log(`Emails Failed: ${emailsFailed}`);
  console.log(`Emails Skipped: ${emailsSkipped}`);
  console.log(`Success Rate: ${totalMessages > 0 ? ((emailsSent / totalMessages) * 100).toFixed(1) : 0}%`);
  
  console.log(`\n📋 Message Types:`);
  Object.entries(messageTypes)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  
  if (Object.keys(errorTypes).length > 0) {
    console.log(`\n❌ Error Types:`);
    Object.entries(errorTypes)
      .sort(([,a], [,b]) => b - a)
      .forEach(([error, count]) => {
        console.log(`  ${error}: ${count}`);
      });
  }
  
  return {
    totalMessages,
    emailsSent,
    emailsFailed,
    emailsSkipped,
    successRate: totalMessages > 0 ? (emailsSent / totalMessages) * 100 : 0,
    messageTypes,
    errorTypes
  };
}

/**
 * Clean up old notification tracking data
 */
async function cleanupOldNotificationData(daysBack = 30) {
  console.log(`🧹 Cleaning up notification data older than ${daysBack} days...`);
  
  const cutoffTime = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000));
  
  const db = admin.firestore();
  const messagesQuery = db.collection('messages')
    .where('timestamp', '<', cutoffTime);
  
  const snapshot = await messagesQuery.get();
  
  if (snapshot.empty) {
    console.log('✅ No old notification data to clean up.');
    return 0;
  }
  
  console.log(`🗑️ Removing notification tracking fields from ${snapshot.docs.length} old messages...`);
  
  const batch = db.batch();
  let batchCount = 0;
  let totalCleaned = 0;
  
  for (const doc of snapshot.docs) {
    const updates = {};
    const data = doc.data();
    
    // Remove email notification tracking fields
    if ('emailNotificationSent' in data) updates.emailNotificationSent = admin.firestore.FieldValue.delete();
    if ('emailNotificationId' in data) updates.emailNotificationId = admin.firestore.FieldValue.delete();
    if ('emailSentAt' in data) updates.emailSentAt = admin.firestore.FieldValue.delete();
    if ('emailNotificationError' in data) updates.emailNotificationError = admin.firestore.FieldValue.delete();
    if ('emailAttemptedAt' in data) updates.emailAttemptedAt = admin.firestore.FieldValue.delete();
    if ('emailResendAt' in data) updates.emailResendAt = admin.firestore.FieldValue.delete();
    if ('emailRetryAttemptedAt' in data) updates.emailRetryAttemptedAt = admin.firestore.FieldValue.delete();
    
    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      batchCount++;
      totalCleaned++;
      
      // Commit batch every 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`  Processed ${totalCleaned} messages...`);
        batchCount = 0;
      }
    }
  }
  
  // Commit remaining batch
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`✅ Cleaned up notification data from ${totalCleaned} messages.`);
  return totalCleaned;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  switch (command) {
    case 'test':
      const email = args[0];
      if (!email) {
        console.error('Usage: node email-management.js test <email>');
        process.exit(1);
      }
      testEmailNotification(email)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'resend':
      const hours = parseInt(args[0]) || 24;
      resendFailedNotifications(hours)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'stats':
      const days = parseInt(args[0]) || 7;
      getEmailStats(days)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'cleanup':
      const cleanupDays = parseInt(args[0]) || 30;
      cleanupOldNotificationData(cleanupDays)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    default:
      console.log(`
📧 Lokal Email Notification Management

Usage:
  node email-management.js <command> [options]

Commands:
  test <email>        Test email notifications by sending to specified email
  resend [hours]      Resend failed notifications from last N hours (default: 24)
  stats [days]        Show email notification statistics for last N days (default: 7)
  cleanup [days]      Clean up notification data older than N days (default: 30)

Examples:
  node email-management.js test test@example.com
  node email-management.js resend 48
  node email-management.js stats 14
  node email-management.js cleanup 60
      `);
      break;
  }
}

module.exports = {
  testEmailNotification,
  resendFailedNotifications,
  getEmailStats,
  cleanupOldNotificationData
};