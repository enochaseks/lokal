// Example: How to manually send push notifications from your code
// Import this in any component where you need to send custom notifications

import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Send a custom push notification to a user
 * 
 * @param {string} userId - The user ID to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {string} type - Type of notification (message, order, payment, etc.)
 * @param {string} url - URL to open when notification is clicked
 * @param {object} additionalData - Any additional data to include
 * 
 * @returns {Promise} Result of the notification send
 */
export async function sendCustomNotification({
  userId,
  title,
  body,
  type = 'custom',
  url = '/',
  additionalData = {}
}) {
  try {
    const functions = getFunctions();
    const sendNotification = httpsCallable(functions, 'sendCustomPushNotification');

    const result = await sendNotification({
      userId,
      title,
      body,
      type,
      url,
      additionalData
    });

    console.log('Notification sent successfully:', result.data);
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// USAGE EXAMPLES
// ============================================

// Example 1: Send a simple notification
export async function sendWelcomeNotification(userId) {
  return await sendCustomNotification({
    userId: userId,
    title: 'Welcome to Lokal! 🎉',
    body: 'Thanks for joining our community. Start exploring stores near you!',
    type: 'welcome',
    url: '/explore'
  });
}

// Example 2: Notify user about a special offer
export async function sendOfferNotification(userId, offerDetails) {
  return await sendCustomNotification({
    userId: userId,
    title: '🔥 Special Offer!',
    body: `${offerDetails.discount}% off ${offerDetails.storeName}`,
    type: 'offer',
    url: `/store/${offerDetails.storeId}`,
    additionalData: {
      offerId: offerDetails.id,
      expiresAt: offerDetails.expiresAt
    }
  });
}

// Example 3: Notify seller about low stock
export async function sendLowStockAlert(sellerId, productName, currentStock) {
  return await sendCustomNotification({
    userId: sellerId,
    title: '⚠️ Low Stock Alert',
    body: `${productName} is running low (${currentStock} items left)`,
    type: 'low_stock',
    url: '/store-profile',
    additionalData: {
      productName,
      currentStock,
      alertType: 'inventory'
    }
  });
}

// Example 4: Notify about a scheduled event
export async function sendEventReminder(userId, eventDetails) {
  return await sendCustomNotification({
    userId: userId,
    title: `📅 Event Reminder: ${eventDetails.name}`,
    body: `Starting in ${eventDetails.startsIn}`,
    type: 'event_reminder',
    url: `/events/${eventDetails.id}`,
    additionalData: {
      eventId: eventDetails.id,
      startTime: eventDetails.startTime
    }
  });
}

// Example 5: Notify about account verification
export async function sendVerificationSuccessNotification(userId) {
  return await sendCustomNotification({
    userId: userId,
    title: '✅ Account Verified!',
    body: 'Your account has been successfully verified. You can now access all features.',
    type: 'account_verified',
    url: '/profile'
  });
}

// Example 6: Notify seller about new follower
export async function sendNewFollowerNotification(sellerId, followerName) {
  return await sendCustomNotification({
    userId: sellerId,
    title: '👋 New Follower!',
    body: `${followerName} started following your store`,
    type: 'new_follower',
    url: '/store-profile',
    additionalData: {
      followerName
    }
  });
}

// Example 7: Notify about price drop on watchlisted item
export async function sendPriceDropNotification(userId, itemDetails) {
  return await sendCustomNotification({
    userId: userId,
    title: '💰 Price Drop Alert!',
    body: `${itemDetails.name} is now £${itemDetails.newPrice} (was £${itemDetails.oldPrice})`,
    type: 'price_drop',
    url: `/store/${itemDetails.storeId}`,
    additionalData: {
      itemId: itemDetails.id,
      oldPrice: itemDetails.oldPrice,
      newPrice: itemDetails.newPrice,
      discount: itemDetails.discount
    }
  });
}

// Example 8: Notify about delivery status update
export async function sendDeliveryUpdateNotification(userId, orderDetails) {
  return await sendCustomNotification({
    userId: userId,
    title: '🚚 Delivery Update',
    body: `Your order #${orderDetails.orderNumber} ${orderDetails.status}`,
    type: 'delivery_update',
    url: `/receipts?id=${orderDetails.orderId}`,
    additionalData: {
      orderId: orderDetails.orderId,
      orderNumber: orderDetails.orderNumber,
      status: orderDetails.status,
      estimatedDelivery: orderDetails.estimatedDelivery
    }
  });
}

// Example 9: Notify about refund processed
export async function sendRefundNotification(userId, refundAmount, orderId) {
  return await sendCustomNotification({
    userId: userId,
    title: '💵 Refund Processed',
    body: `£${refundAmount.toFixed(2)} has been refunded to your account`,
    type: 'refund',
    url: `/receipts?id=${orderId}`,
    additionalData: {
      refundAmount,
      orderId,
      processedAt: new Date().toISOString()
    }
  });
}

// Example 10: Notify about chat message with image
export async function sendImageMessageNotification(recipientId, senderName, conversationId) {
  return await sendCustomNotification({
    userId: recipientId,
    title: `📷 ${senderName} sent you a photo`,
    body: 'Tap to view',
    type: 'image_message',
    url: `/messages?id=${conversationId}`,
    additionalData: {
      conversationId,
      senderId: senderName,
      messageType: 'image'
    }
  });
}

// ============================================
// HOW TO USE IN YOUR COMPONENTS
// ============================================

/*

// In MessagesPage.js - notify about image messages
import { sendImageMessageNotification } from '../utils/pushNotificationExamples';

const handleSendImage = async (imageUrl) => {
  // ... your image upload code ...
  
  // Send notification
  await sendImageMessageNotification(
    recipientUserId,
    currentUser.displayName,
    conversationId
  );
};


// In StoreProfilePage.js - notify about low stock
import { sendLowStockAlert } from '../utils/pushNotificationExamples';

const checkInventory = async (product) => {
  if (product.stock < 5) {
    await sendLowStockAlert(
      sellerId,
      product.name,
      product.stock
    );
  }
};


// In CheckoutPage.js - notify about delivery updates
import { sendDeliveryUpdateNotification } from '../utils/pushNotificationExamples';

const updateDeliveryStatus = async (orderId, newStatus) => {
  await sendDeliveryUpdateNotification(
    buyerId,
    {
      orderId,
      orderNumber: order.number,
      status: newStatus,
      estimatedDelivery: order.estimatedDelivery
    }
  );
};


// In ProfilePage.js - welcome new users
import { sendWelcomeNotification } from '../utils/pushNotificationExamples';

useEffect(() => {
  if (isNewUser) {
    sendWelcomeNotification(user.uid);
  }
}, [isNewUser]);

*/

// ============================================
// NOTIFICATION TYPES REFERENCE
// ============================================

/*

Supported notification types:
- 'message' - Chat messages
- 'order' - Order updates
- 'payment' - Payment confirmations
- 'review' - New reviews
- 'store_boost' - Store boost updates
- 'welcome' - Welcome messages
- 'offer' - Special offers
- 'low_stock' - Inventory alerts
- 'event_reminder' - Event reminders
- 'account_verified' - Account verification
- 'new_follower' - New followers
- 'price_drop' - Price drop alerts
- 'delivery_update' - Delivery status
- 'refund' - Refund notifications
- 'image_message' - Image messages
- 'custom' - Any other custom notification

*/

export default {
  sendCustomNotification,
  sendWelcomeNotification,
  sendOfferNotification,
  sendLowStockAlert,
  sendEventReminder,
  sendVerificationSuccessNotification,
  sendNewFollowerNotification,
  sendPriceDropNotification,
  sendDeliveryUpdateNotification,
  sendRefundNotification,
  sendImageMessageNotification
};
