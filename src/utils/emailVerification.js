import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Prevent multiple simultaneous verification checks
let isCheckingVerification = false;

/**
 * Checks if user's email is verified in Firebase Auth and syncs with Firestore
 * @param {Object} user - Firebase Auth user object (optional, will get current user if not provided)
 * @returns {Promise<boolean>} - Returns true if email is verified
 */
export const checkAndSyncEmailVerification = async (user = null) => {
  // Prevent multiple simultaneous checks
  if (isCheckingVerification) {
    console.log('Email verification check already in progress, skipping...');
    return false;
  }
  
  isCheckingVerification = true;
  
  try {
    const auth = getAuth();
    const currentUser = user || auth.currentUser;
    
    if (!currentUser) {
      console.log('No user found for email verification check');
      return false;
    }

    // Reload user to get latest verification status
    await currentUser.reload();
    const refreshedUser = auth.currentUser;
    
    if (!refreshedUser) {
      console.log('No refreshed user found');
      return false;
    }

    const isVerifiedInAuth = refreshedUser.emailVerified;
    console.log(`Email verification status in Firebase Auth: ${isVerifiedInAuth}`);

    if (isVerifiedInAuth) {
      // Check Firestore and sync if needed
      try {
        const userRef = doc(db, 'users', refreshedUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const isVerifiedInFirestore = userData.emailVerified;
          
          console.log(`Email verification status in Firestore: ${isVerifiedInFirestore}`);
          
          if (!isVerifiedInFirestore) {
            await updateDoc(userRef, {
              emailVerified: true,
              emailVerifiedAt: new Date().toISOString()
            });
            console.log('Successfully synced email verification status to Firestore');
          }
        } else {
          console.log('User document not found in Firestore');
        }
      } catch (firestoreError) {
        console.error('Error syncing with Firestore:', firestoreError);
        // Even if Firestore sync fails, we trust Firebase Auth
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking email verification:', error);
    return false;
  } finally {
    isCheckingVerification = false;
  }
};

/**
 * Forces a check of email verification status without caching
 * @returns {Promise<boolean>}
 */
export const forceCheckEmailVerification = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) return false;
  
  // Force reload user from server
  await user.reload();
  return checkAndSyncEmailVerification();
};

/**
 * Debug function to check current verification status
 * @returns {Promise<Object>}
 */
export const debugEmailVerificationStatus = async () => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      return { error: 'No user logged in' };
    }

    // Force reload user
    await user.reload();
    const refreshedUser = auth.currentUser;
    
    const authStatus = refreshedUser.emailVerified;
    
    // Check Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    const firestoreStatus = userSnap.exists() ? userSnap.data().emailVerified : null;
    
    return {
      userId: user.uid,
      email: user.email,
      firebaseAuthVerified: authStatus,
      firestoreVerified: firestoreStatus,
      needsSync: authStatus && !firestoreStatus,
      userDocExists: userSnap.exists()
    };
  } catch (error) {
    return { error: error.message };
  }
};