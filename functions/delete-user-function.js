// Cloud Function for deleting Firebase Authentication users
// This function should be deployed to Firebase Functions for production use

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function to delete a Firebase Authentication user
 * This function should be called from the admin dashboard when deleting a store/seller
 * 
 * Usage from client:
 * const functions = getFunctions();
 * const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
 * await deleteUserAccount({ userId: 'user-id-here' });
 */
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  try {
    // Verify that the caller is an admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if caller is admin (you should implement your admin verification logic)
    const callerUid = context.auth.uid;
    const adminDoc = await admin.firestore().collection('admins').doc(callerUid).get();
    
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can delete user accounts');
    }

    const { userId } = data;

    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }

    console.log(`Admin ${callerUid} requesting deletion of user ${userId}`);

    // Delete the user from Firebase Authentication
    await admin.auth().deleteUser(userId);
    
    console.log(`Successfully deleted user ${userId} from Firebase Auth`);

    // Log the deletion for audit purposes
    await admin.firestore().collection('adminActions').add({
      action: 'delete_user_account',
      targetUserId: userId,
      performedBy: callerUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      success: true
    });

    return { 
      success: true, 
      message: `User ${userId} deleted successfully from Firebase Authentication`,
      deletedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error deleting user:', error);
    
    // Log the failed attempt
    await admin.firestore().collection('adminActions').add({
      action: 'delete_user_account',
      targetUserId: data.userId || 'unknown',
      performedBy: context.auth?.uid || 'unknown',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      success: false,
      error: error.message
    });

    // Re-throw as Firebase Function error
    if (error instanceof functions.https.HttpsError) {
      throw error;
    } else {
      throw new functions.https.HttpsError('internal', 'Failed to delete user account');
    }
  }
});

/**
 * Optional: Function to delete all user data (Firestore cleanup)
 * This can be called after successfully deleting the Auth user
 */
exports.cleanupUserData = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const callerUid = context.auth.uid;
    const adminDoc = await admin.firestore().collection('admins').doc(callerUid).get();
    
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can cleanup user data');
    }

    const { userId } = data;
    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }

    const batch = admin.firestore().batch();
    let deleteCount = 0;

    // Delete from multiple collections
    const collections = ['users', 'items', 'messages', 'userSessions', 'userPresence'];
    
    for (const collectionName of collections) {
      const query = admin.firestore().collection(collectionName);
      let queryRef;
      
      if (collectionName === 'users') {
        queryRef = query.where(admin.firestore.FieldPath.documentId(), '==', userId);
      } else if (collectionName === 'items') {
        queryRef = query.where('sellerId', '==', userId);
      } else if (collectionName === 'messages') {
        queryRef = query.where('senderId', '==', userId);
      } else {
        queryRef = query.where('userId', '==', userId);
      }

      const snapshot = await queryRef.get();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
        deleteCount++;
      });
    }

    await batch.commit();
    
    console.log(`Cleaned up ${deleteCount} documents for user ${userId}`);

    return { 
      success: true, 
      documentsDeleted: deleteCount,
      message: `Cleaned up ${deleteCount} documents for user ${userId}`
    };

  } catch (error) {
    console.error('Error cleaning up user data:', error);
    throw new functions.https.HttpsError('internal', 'Failed to cleanup user data');
  }
});

/**
 * Deployment Instructions:
 * 
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login to Firebase: firebase login
 * 3. Initialize functions: firebase init functions
 * 4. Copy this code to functions/index.js
 * 5. Install dependencies: cd functions && npm install
 * 6. Deploy: firebase deploy --only functions
 * 
 * Then update the admin dashboard to use these functions:
 * 
 * import { getFunctions, httpsCallable } from 'firebase/functions';
 * 
 * const functions = getFunctions();
 * const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
 * 
 * try {
 *   const result = await deleteUserAccount({ userId: userId });
 *   console.log('User deleted:', result.data);
 * } catch (error) {
 *   console.error('Error deleting user:', error);
 * }
 */