// Firebase Email Verification Diagnostics
import { getAuth } from 'firebase/auth';
import { app } from '../firebase';

export const diagnoseEmailConfiguration = () => {
  const auth = getAuth(app);
  const config = auth.app.options;
  
  console.group('🔍 Firebase Email Configuration Diagnostics');
  
  // Basic configuration
  console.log('📋 Firebase Configuration:');
  console.log('  Project ID:', config.projectId);
  console.log('  Auth Domain:', config.authDomain);
  console.log('  API Key:', config.apiKey ? config.apiKey.substring(0, 10) + '...' : 'Missing');
  
  // Current environment
  console.log('🌐 Environment Details:');
  console.log('  Current Domain:', window.location.hostname);
  console.log('  Current Origin:', window.location.origin);
  console.log('  Current Protocol:', window.location.protocol);
  console.log('  User Agent:', navigator.userAgent.substring(0, 100) + '...');
  
  // Expected domains for verification
  const expectedDomains = [
    'localhost',
    'lokalshops.co.uk',
    'lokal-b4b28.firebaseapp.com',
    'lokal-b4b28.web.app'
  ];
  
  console.log('✅ Expected Authorized Domains:');
  expectedDomains.forEach(domain => {
    console.log(`  - ${domain}`);
  });
  
  // Check if current domain might be authorized
  const currentDomain = window.location.hostname;
  const isLikelyAuthorized = expectedDomains.some(domain => 
    currentDomain === domain || 
    currentDomain.endsWith('.' + domain) ||
    domain.includes(currentDomain)
  );
  
  console.log('🔒 Domain Authorization Status:');
  console.log(`  Current domain (${currentDomain}) likely authorized:`, isLikelyAuthorized);
  
  if (!isLikelyAuthorized) {
    console.warn('⚠️  WARNING: Current domain may not be authorized for custom email verification URLs!');
    console.warn('   This is why we use Firebase default email settings instead of custom URLs');
    console.warn('   To use custom URLs, add this domain to Firebase Console > Authentication > Settings > Authorized domains');
  } else {
    console.log('✅ Domain appears to be authorized, but we still use default settings for reliability');
  }
  
  // Network connectivity check
  console.log('🌍 Network Connectivity:');
  console.log('  Online:', navigator.onLine);
  
  // Auth state
  console.log('👤 Auth State:');
  const currentUser = auth.currentUser;
  if (currentUser) {
    console.log('  User Email:', currentUser.email);
    console.log('  Email Verified:', currentUser.emailVerified);
    console.log('  User ID:', currentUser.uid);
    console.log('  Creation Time:', currentUser.metadata.creationTime);
    console.log('  Last Sign In:', currentUser.metadata.lastSignInTime);
  } else {
    console.log('  No authenticated user');
  }
  
  console.groupEnd();
  
  return {
    config,
    currentDomain,
    isLikelyAuthorized,
    currentUser: currentUser ? {
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      uid: currentUser.uid
    } : null
  };
};

export const testEmailVerification = async (user) => {
  console.group('🧪 Email Verification Test');
  
  if (!user) {
    console.error('❌ No user provided for testing');
    console.groupEnd();
    return false;
  }
  
  const testConfigs = [
    {
      name: 'Default Firebase settings (recommended)',
      config: null
    }
  ];
  
  for (const testConfig of testConfigs) {
    try {
      console.log(`🔄 Testing: ${testConfig.name}`);
      
      const { sendEmailVerification } = await import('firebase/auth');
      
      if (testConfig.config) {
        await sendEmailVerification(user, testConfig.config);
      } else {
        await sendEmailVerification(user);
      }
      
      console.log(`✅ SUCCESS: ${testConfig.name}`);
      console.groupEnd();
      return true;
      
    } catch (error) {
      console.log(`❌ FAILED: ${testConfig.name}`);
      console.log(`   Error: ${error.code} - ${error.message}`);
    }
  }
  
  console.error('❌ All email verification attempts failed');
  console.groupEnd();
  return false;
};