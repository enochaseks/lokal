// Registration Debug Utility
import { getAuth } from 'firebase/auth';
import { app } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const debugRegistrationIssues = async () => {
  console.log('🔍 Starting comprehensive registration debug...');
  
  try {
    // 1. Check Firebase App initialization
    console.log('1️⃣ Checking Firebase App...');
    console.log('   App Name:', app.name);
    console.log('   Config Keys:', Object.keys(app.options));
    
    // 2. Check Firebase Auth
    console.log('2️⃣ Checking Firebase Auth...');
    const auth = getAuth(app);
    console.log('   Auth Domain:', auth.config.authDomain);
    console.log('   API Key (first 10 chars):', auth.config.apiKey?.substring(0, 10) + '...');
    
    // 3. Check Firestore connection
    console.log('3️⃣ Checking Firestore connection...');
    try {
      const testCollection = collection(db, 'test');
      console.log('   ✅ Firestore connection successful');
    } catch (firestoreError) {
      console.log('   ❌ Firestore connection failed:', firestoreError.message);
    }
    
    // 4. Check network connectivity
    console.log('4️⃣ Checking network connectivity...');
    try {
      const response = await fetch('https://identitytoolkit.googleapis.com/v1/projects', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('   Network response status:', response.status);
    } catch (networkError) {
      console.log('   ❌ Network connectivity issue:', networkError.message);
    }
    
    // 5. Check specific Firebase Auth endpoint
    console.log('5️⃣ Testing Firebase Auth endpoint...');
    const apiKey = app.options.apiKey;
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
    
    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpass123',
          returnSecureToken: true
        })
      });
      
      const result = await response.text();
      console.log('   Auth endpoint response status:', response.status);
      console.log('   Auth endpoint response:', result.substring(0, 200) + '...');
      
      if (response.status === 400) {
        console.log('   🚨 400 Bad Request detected - likely auth method not enabled');
      }
      
    } catch (authError) {
      console.log('   ❌ Auth endpoint test failed:', authError.message);
    }
    
    console.log('✅ Debug completed. Check the logs above for issues.');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
};

export const getDetailedFirebaseError = (error) => {
  console.log('🔍 Analyzing Firebase error...');
  console.log('Error Code:', error.code);
  console.log('Error Message:', error.message);
  console.log('Error Stack:', error.stack);
  
  const solutions = {
    'auth/operation-not-allowed': {
      message: 'Email/Password authentication is not enabled in Firebase Console',
      solution: 'Go to Firebase Console > Authentication > Sign-in method > Email/Password > Enable'
    },
    'auth/weak-password': {
      message: 'Password is too weak',
      solution: 'Use a password with at least 6 characters'
    },
    'auth/email-already-in-use': {
      message: 'Email is already registered',
      solution: 'Try logging in or use a different email'
    },
    'auth/invalid-email': {
      message: 'Email format is invalid',
      solution: 'Check email format and try again'
    },
    'auth/network-request-failed': {
      message: 'Network connection failed',
      solution: 'Check your internet connection'
    }
  };
  
  const errorInfo = solutions[error.code];
  if (errorInfo) {
    console.log('📋 Error Analysis:');
    console.log('   Issue:', errorInfo.message);
    console.log('   Solution:', errorInfo.solution);
    return errorInfo;
  }
  
  return null;
};