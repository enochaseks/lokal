const {onDocumentCreated, onDocumentUpdated} = require('firebase-functions/v2/firestore');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {setGlobalOptions} = require('firebase-functions/v2');
const admin = require('firebase-admin');

// Set global options
setGlobalOptions({
  maxInstances: 10,
  timeoutSeconds: 60,
  memory: '256MiB'
});

/**
 * Send push notification to a specific user
 * @param {string} userId - User ID to send notification to
 * @param {object} notification - Notification payload
 * @param {object} data - Additional data to send with notification
 */
async function sendPushNotification(userId, notification, data = {}) {
  try {
    // Get user's FCM token from Firestore
    const tokenDoc = await admin.firestore()
      .collection('fcmTokens')
      .doc(userId)
      .get();

    if (!tokenDoc.exists || !tokenDoc.data().token) {
      console.log(`No FCM token found for user ${userId}`);
      return { success: false, reason: 'no_token' };
    }

    const token = tokenDoc.data().token;

    // Prepare the message
    const message = {
      token: token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl
      },
      data: {
        ...data,
        timestamp: Date.now().toString()
      },
      webpush: {
        fcmOptions: {
          link: data.url || 'https://lokalshops.co.uk/'
        },
        notification: {
          icon: '/images/logo192.png',
          badge: '/images/logo192.png',
          requireInteraction: false,
          vibrate: [200, 100, 200]
        }
      }
    };

    // Send the message
    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);

    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending push notification:', error);

    // If token is invalid, remove it from database
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      try {
        await admin.firestore()
          .collection('fcmTokens')
          .doc(userId)
          .update({
            token: null,
            invalidatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        console.log(`Removed invalid token for user ${userId}`);
      } catch (updateError) {
        console.error('Error removing invalid token:', updateError);
      }
    }

    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to multiple users
 */
async function sendMulticastPushNotification(userIds, notification, data = {}) {
  try {
    // Get all tokens
    const tokenPromises = userIds.map(userId =>
      admin.firestore().collection('fcmTokens').doc(userId).get()
    );
    const tokenDocs = await Promise.all(tokenPromises);

    const tokens = tokenDocs
      .filter(doc => doc.exists && doc.data().token)
      .map(doc => doc.data().token);

    if (tokens.length === 0) {
      console.log('No valid tokens found for multicast');
      return { success: false, reason: 'no_tokens' };
    }

    // Prepare multicast message
    const message = {
      tokens: tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl
      },
      data: {
        ...data,
        timestamp: Date.now().toString()
      },
      webpush: {
        fcmOptions: {
          link: data.url || 'https://lokalshops.co.uk/'
        },
        notification: {
          icon: '/images/logo192.png',
          badge: '/images/logo192.png'
        }
      }
    };

    // Send to multiple devices
    const response = await admin.messaging().sendMulticast(message);
    console.log(`Successfully sent ${response.successCount} notifications out of ${tokens.length}`);

    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            token: tokens[idx],
            error: resp.error
          });
        }
      });
      console.log('Failed tokens:', failedTokens);
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('Error sending multicast notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cloud Function: Send notification when new message is received
 */
exports.sendMessageNotification = onDocumentCreated('messages/{messageId}', async (event) => {
  const message = event.data.data();
  const { recipientId, senderId, senderName, content } = message;

  // Don't send notification if sender and recipient are the same
  if (recipientId === senderId) return null;

  // Check user's notification preferences
  const prefsDoc = await admin.firestore()
    .collection('userPreferences')
    .doc(recipientId)
    .get();

  if (prefsDoc.exists) {
    const prefs = prefsDoc.data().notifications || {};
    if (prefs.messageNotifications === false) {
      console.log(`User ${recipientId} has disabled message notifications`);
      return null;
    }
  }

  // Send push notification
  const notification = {
    title: `New message from ${senderName}`,
    body: content.substring(0, 100) + (content.length > 100 ? '...' : '')
  };

  const data = {
    type: 'message',
    conversationId: message.conversationId || '',
    senderId: senderId,
    url: `/messages?id=${message.conversationId || ''}`
  };

  await sendPushNotification(recipientId, notification, data);

  return null;
});

/**
 * Cloud Function: Send notification when order is placed
 */
exports.sendOrderNotification = onDocumentCreated('orders/{orderId}', async (event) => {
  const order = event.data.data();
  const { sellerId, buyerName, storeName, totalAmount, items } = order;

  // Check seller's notification preferences
  const prefsDoc = await admin.firestore()
    .collection('userPreferences')
    .doc(sellerId)
    .get();

  if (prefsDoc.exists) {
    const prefs = prefsDoc.data().notifications || {};
    if (prefs.orderNotifications === false) {
      console.log(`User ${sellerId} has disabled order notifications`);
      return null;
    }
  }

  // Send push notification to seller
  const itemCount = items ? items.length : 0;
  const notification = {
    title: `New Order from ${buyerName}`,
    body: `${itemCount} item(s) • £${totalAmount.toFixed(2)} • ${storeName}`
  };

  const data = {
    type: 'order',
    orderId: event.params.orderId,
    url: `/receipts?id=${event.params.orderId}`
  };

  await sendPushNotification(sellerId, notification, data);

  return null;
});

/**
 * Cloud Function: Send notification when payment is received
 */
exports.sendPaymentNotification = onDocumentCreated('payments/{paymentId}', async (event) => {
  const payment = event.data.data();
  const { sellerId, amount, buyerName, storeName, status } = payment;

    if (status !== 'succeeded' && status !== 'completed') {
      return null; // Only notify on successful payments
    }

    // Check seller's notification preferences
    const prefsDoc = await admin.firestore()
      .collection('userPreferences')
      .doc(sellerId)
      .get();

    if (prefsDoc.exists) {
      const prefs = prefsDoc.data().notifications || {};
      if (prefs.paymentNotifications === false) {
        console.log(`User ${sellerId} has disabled payment notifications`);
        return null;
      }
    }

    // Send push notification
    const notification = {
      title: `Payment Received!`,
      body: `£${amount.toFixed(2)} from ${buyerName} • ${storeName}`
    };

    const data = {
      type: 'payment',
      paymentId: context.params.paymentId,
      receiptId: payment.receiptId || '',
      url: `/receipts?id=${payment.receiptId || context.params.paymentId}`
    };

    await sendPushNotification(sellerId, notification, data);


  return null;
});

/**
 * Cloud Function: Send notification when new review is posted
 */
exports.sendReviewNotification = onDocumentCreated('reviews/{reviewId}', async (event) => {
  const review = event.data.data();
  const { storeId, reviewerName, rating, comment } = review;

  // Get store owner ID
  const storeDoc = await admin.firestore()
    .collection('stores')
    .doc(storeId)
    .get();

  if (!storeDoc.exists) return null;

  const sellerId = storeDoc.data().userId;

  // Send push notification
  const stars = '⭐'.repeat(rating);
  const notification = {
    title: `New ${rating}-Star Review`,
    body: `${reviewerName}: ${comment.substring(0, 80)}${comment.length > 80 ? '...' : ''}`
  };

  const data = {
    type: 'review',
    reviewId: event.params.reviewId,
    storeId: storeId,
    url: `/store/${storeId}#review-${event.params.reviewId}`
  };

  await sendPushNotification(sellerId, notification, data);

  return null;
});/**
 * Cloud Function: Send notification when store is boosted
 */
exports.sendStoreBoostNotification = onDocumentUpdated('stores/{storeId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // Check if store was just boosted
  if (!before.isBoosted && after.isBoosted) {
    const sellerId = after.userId;

    const notification = {
      title: `🚀 Store Boosted Successfully!`,
      body: `Your store "${after.storeName}" is now featured and will reach more customers!`
    };

    const data = {
      type: 'store_boost',
      storeId: event.params.storeId,
      url: '/store-profile'
    };

    await sendPushNotification(sellerId, notification, data);
  }

  return null;
});

/**
 * Callable function to send custom push notification
 */
exports.sendCustomPushNotification = onCall(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { userId, title, body, type, url, additionalData } = request.data;

  if (!userId || !title || !body) {
    throw new HttpsError(
      'invalid-argument',
      'userId, title, and body are required'
    );
  }

  const notification = { title, body };
  const notificationData = {
    type: type || 'custom',
    url: url || 'https://lokalshops.co.uk/',
    ...additionalData
  };

  const result = await sendPushNotification(userId, notification, notificationData);

  return result;
});

// Export helper functions for use in other cloud functions
module.exports = {
  sendPushNotification,
  sendMulticastPushNotification
};
