// Firebase Auth Test Utility
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { app } from '../firebase';

export const testFirebaseAuth = async () => {
  console.log('🔍 Testing Firebase Auth Configuration...');
  
  try {
    const auth = getAuth(app);
    console.log('✅ Firebase Auth initialized successfully');
    console.log('📱 App Name:', auth.app.name);
    console.log('🌐 Auth Domain:', auth.app.options.authDomain);
    console.log('🔑 API Key exists:', !!auth.app.options.apiKey);
    
    // Test with a dummy email to see what error we get
    const testEmail = 'test-' + Date.now() + '@example.com';
    const testPassword = 'TestPassword123!';
    
    console.log('🧪 Testing account creation with:', testEmail);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      console.log('✅ Test account created successfully:', userCredential.user.uid);
      
      // Test email verification
      try {
        await sendEmailVerification(userCredential.user);
        console.log('✅ Email verification sent successfully');
      } catch (emailError) {
        console.error('❌ Email verification failed:', emailError);
      }
      
      // Delete the test user
      try {
        await userCredential.user.delete();
        console.log('🗑️ Test account deleted successfully');
      } catch (deleteError) {
        console.error('⚠️ Could not delete test account:', deleteError);
      }
      
    } catch (createError) {
      console.error('❌ Test account creation failed:', createError);
      console.error('Error Code:', createError.code);
      console.error('Error Message:', createError.message);
      
      // Check specific error codes
      if (createError.code === 'auth/operation-not-allowed') {
        console.error('🚨 SOLUTION: Email/Password authentication is not enabled in Firebase Console');
        console.error('👉 Go to Firebase Console > Authentication > Sign-in method > Email/Password > Enable');
      }
    }
    
  } catch (error) {
    console.error('❌ Firebase Auth initialization failed:', error);
  }
};

// Function to check Firebase project configuration
export const checkFirebaseConfig = () => {
  console.log('🔍 Checking Firebase Configuration...');
  
  try {
    const config = app.options;
    
    console.log('📋 Firebase Config:');
    console.log('  - API Key:', config.apiKey ? '✅ Present' : '❌ Missing');
    console.log('  - Auth Domain:', config.authDomain ? '✅ Present' : '❌ Missing');
    console.log('  - Project ID:', config.projectId ? '✅ Present' : '❌ Missing');
    console.log('  - Storage Bucket:', config.storageBucket ? '✅ Present' : '❌ Missing');
    console.log('  - Messaging Sender ID:', config.messagingSenderId ? '✅ Present' : '❌ Missing');
    console.log('  - App ID:', config.appId ? '✅ Present' : '❌ Missing');
    
    // Validate specific fields
    if (!config.apiKey || !config.authDomain || !config.projectId) {
      console.error('❌ Critical Firebase configuration fields are missing!');
      return false;
    }
    
    console.log('✅ Firebase configuration appears valid');
    return true;
    
  } catch (error) {
    console.error('❌ Error checking Firebase config:', error);
    return false;
  }
};