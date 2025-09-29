// Store buyer receipt function
// This function ensures that when a seller generates a receipt, it's also stored in the buyer's receipts

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
try {
  admin.initializeApp();
} catch (e) {
  console.log('Firebase admin already initialized');
}

const db = admin.firestore();

/**
 * Listens for new receipts created and creates a duplicate receipt for the buyer
 * This ensures that when a seller generates a receipt, it appears in the buyer's receipts page
 */
exports.storeBuyerReceipt = functions.firestore
  .document('receipts/{receiptId}')
  .onCreate(async (snap, context) => {
    try {
      const receiptData = snap.data();
      
      // Skip processing if this is already a buyer receipt or doesn't have buyer info
      if (
        !receiptData ||
        !receiptData.buyerId || 
        receiptData.userId === receiptData.buyerId ||
        receiptData.isBuyerCopy === true
      ) {
        console.log('Skipping buyer receipt creation - receipt is already for buyer or missing buyer info');
        return null;
      }
      
      console.log(`Processing receipt ${context.params.receiptId} for buyer ${receiptData.buyerId}`);
      
      // Create a copy of the receipt specifically for the buyer
      const buyerReceiptData = {
        ...receiptData,
        userId: receiptData.buyerId, // Set userId to the buyer's ID so it appears in their receipts page
        isBuyerCopy: true, // Mark as a buyer copy to prevent infinite loops
        originalReceiptId: context.params.receiptId, // Link to the original receipt
        // Use the current time for createdAt/timestamp to ensure proper ordering
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Add the new receipt to the receipts collection
      await db.collection('receipts').add(buyerReceiptData);
      
      console.log(`Successfully created buyer copy of receipt for user ${receiptData.buyerId}`);
      return null;
    } catch (error) {
      console.error('Error creating buyer receipt copy:', error);
      return null;
    }
  });