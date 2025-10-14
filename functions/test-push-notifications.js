// Test script for push notifications
// Run this to verify your push notification setup

const admin = require('firebase-admin');
const { sendPushNotification } = require('./push-notification-function');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json'); // You'll need to download this

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function testPushNotification() {
  console.log('🧪 Testing Push Notification System...\n');

  // Test user ID (replace with your test user)
  const testUserId = 'YOUR_TEST_USER_ID'; // Replace this!

  console.log(`Target User ID: ${testUserId}`);
  console.log('-----------------------------------\n');

  // Test 1: Simple notification
  console.log('Test 1: Sending simple notification...');
  const result1 = await sendPushNotification(
    testUserId,
    {
      title: 'Test Notification',
      body: 'This is a test push notification from Lokal!'
    },
    {
      type: 'custom',
      url: 'https://lokalshops.co.uk/'
    }
  );
  console.log('Result:', result1);
  console.log('-----------------------------------\n');

  // Test 2: Message notification
  console.log('Test 2: Sending message notification...');
  const result2 = await sendPushNotification(
    testUserId,
    {
      title: 'New Message from Test User',
      body: 'Hey! I have a question about your product.'
    },
    {
      type: 'message',
      conversationId: 'test-conv-123',
      senderId: 'test-sender',
      url: '/messages?id=test-conv-123'
    }
  );
  console.log('Result:', result2);
  console.log('-----------------------------------\n');

  // Test 3: Order notification
  console.log('Test 3: Sending order notification...');
  const result3 = await sendPushNotification(
    testUserId,
    {
      title: 'New Order from John Doe',
      body: '3 items • £45.99 • Test Store'
    },
    {
      type: 'order',
      orderId: 'test-order-123',
      url: '/receipts?id=test-order-123'
    }
  );
  console.log('Result:', result3);
  console.log('-----------------------------------\n');

  // Test 4: Payment notification
  console.log('Test 4: Sending payment notification...');
  const result4 = await sendPushNotification(
    testUserId,
    {
      title: 'Payment Received!',
      body: '£45.99 from John Doe • Test Store'
    },
    {
      type: 'payment',
      paymentId: 'test-payment-123',
      receiptId: 'test-receipt-123',
      url: '/receipts?id=test-receipt-123'
    }
  );
  console.log('Result:', result4);
  console.log('-----------------------------------\n');

  console.log('✅ All tests completed!');
  console.log('\nCheck your device for notifications.');
  console.log('Make sure you have:');
  console.log('1. Granted notification permissions');
  console.log('2. Your FCM token saved in Firestore');
  console.log('3. The app open or recently used\n');

  process.exit(0);
}

// Run the test
testPushNotification().catch(error => {
  console.error('❌ Error during testing:', error);
  process.exit(1);
});
