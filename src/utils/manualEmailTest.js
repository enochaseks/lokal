// Manual Email Verification Test
// Use this in the browser console or as a test script

import { getAuth, sendEmailVerification } from 'firebase/auth';
import { diagnoseEmailConfiguration } from './emailDiagnostics';

export const manualEmailTest = async () => {
  console.log('🚀 Starting manual email verification test...');
  
  // Run diagnostics first
  const diagnostics = diagnoseEmailConfiguration();
  
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    console.error('❌ No authenticated user found. Please log in first.');
    return;
  }
  
  if (user.emailVerified) {
    console.log('✅ User email is already verified!');
    return;
  }
  
  console.log(`📧 Attempting to send verification email to: ${user.email}`);
  
  // Use only default Firebase settings to avoid domain authorization issues
  const configs = [
    {
      name: 'Default Firebase settings',
      settings: null
    }
  ];
  
  for (const config of configs) {
    try {
      console.log(`🔄 Testing: ${config.name}`);
      
      if (config.settings) {
        await sendEmailVerification(user, config.settings);
      } else {
        await sendEmailVerification(user);
      }
      
      console.log(`✅ SUCCESS: ${config.name} - Email sent!`);
      break; // Stop on first success
      
    } catch (error) {
      console.log(`❌ FAILED: ${config.name}`);
      console.log(`   Error Code: ${error.code}`);
      console.log(`   Error Message: ${error.message}`);
      
      // Specific error analysis
      if (error.code === 'auth/unauthorized-domain') {
        console.warn('🚨 DOMAIN NOT AUTHORIZED!');
        console.warn('   Add this domain to Firebase Console > Authentication > Settings > Authorized domains');
        console.warn(`   Domain to add: ${window.location.hostname}`);
      } else if (error.code === 'auth/too-many-requests') {
        console.warn('🚨 RATE LIMITED!');
        console.warn('   Too many requests. Wait a few minutes before trying again.');
      } else if (error.code === 'auth/network-request-failed') {
        console.warn('🚨 NETWORK ERROR!');
        console.warn('   Check your internet connection and Firebase connectivity.');
      }
    }
  }
  
  console.log('✅ Manual test completed. Check console logs above for results.');
};

// Make it available globally for console testing
if (typeof window !== 'undefined') {
  window.manualEmailTest = manualEmailTest;
  console.log('🔧 Manual email test available as window.manualEmailTest()');
}