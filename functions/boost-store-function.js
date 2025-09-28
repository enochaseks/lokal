const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Function to update a store's boost status after successful payment
 * Triggered by HTTP request to keep it separate from payment processing
 */
exports.updateStoreBoostStatus = functions.https.onCall(async (data, context) => {
  // Ensure authenticated user
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to update store boost status'
    );
  }

  const { 
    storeId, 
    boostDuration, 
    paymentIntentId,
    boostAmount,
    userId 
  } = data;

  // Validate input
  if (!storeId || !boostDuration || !paymentIntentId || !boostAmount) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  try {
    // Calculate boost expiration date based on duration in days
    const boostStartDate = new Date();
    const boostExpiryDate = new Date();
    boostExpiryDate.setDate(boostExpiryDate.getDate() + boostDuration);

    // Get store reference
    const storeRef = db.collection('stores').doc(storeId);
    const storeDoc = await storeRef.get();

    if (!storeDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `Store with ID ${storeId} not found`
      );
    }

    // Check if user has permission to boost this store
    const store = storeDoc.data();
    if (store.ownerId !== context.auth.uid && context.auth.uid !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to boost this store'
      );
    }

    // Update store with boost information
    await storeRef.update({
      isBoosted: true,
      boostExpiryDate: admin.firestore.Timestamp.fromDate(boostExpiryDate),
      boostStartDate: admin.firestore.Timestamp.fromDate(boostStartDate),
      boostDuration: boostDuration,
      boostPaymentIntentId: paymentIntentId,
      boostAmount: boostAmount,
      lastBoostedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Also record the boost transaction in a separate collection
    await db.collection('storeBoosts').add({
      storeId,
      storeName: store.name,
      storeOwnerId: store.ownerId,
      paymentIntentId,
      boostStartDate: admin.firestore.Timestamp.fromDate(boostStartDate),
      boostExpiryDate: admin.firestore.Timestamp.fromDate(boostExpiryDate),
      boostDuration,
      boostAmount,
      paidById: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Return success
    return { 
      success: true, 
      message: `Store ${store.name} boosted successfully until ${boostExpiryDate.toDateString()}` 
    };

  } catch (error) {
    console.error('Error updating store boost status:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error updating store boost status',
      error.message
    );
  }
});

/**
 * Function to expire store boosts automatically
 * This is triggered on a schedule (daily at midnight)
 */
exports.expireStoreBoosts = functions.pubsub.schedule('0 0 * * *') // Run at midnight every day
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // Query for all stores with expired boosts
      const expiredBoostsSnapshot = await db.collection('stores')
        .where('isBoosted', '==', true)
        .where('boostExpiryDate', '<', now)
        .get();

      console.log(`Found ${expiredBoostsSnapshot.size} expired store boosts`);
      
      // Update each expired store
      const batch = db.batch();
      expiredBoostsSnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          isBoosted: false,
          boostExpiryDate: null,
          wasRecentlyBoosted: true, // Flag to potentially show in "recently boosted" section
        });
      });

      // Commit all updates
      if (expiredBoostsSnapshot.size > 0) {
        await batch.commit();
        console.log(`Successfully expired ${expiredBoostsSnapshot.size} store boosts`);
      }
      
      return null;
    } catch (error) {
      console.error('Error expiring store boosts:', error);
      return null;
    }
  });