import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, sendEmailVerification, onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { checkAndSyncEmailVerification, forceCheckEmailVerification } from '../utils/emailVerification';

function EmailVerificationPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();

  const handleVerifiedUser = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString()
      });
      
      const { getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(userRef);
      
      setMessage('Email verified successfully! Redirecting to onboarding...');
      setTimeout(() => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const onboardingStep = userData.onboardingStep;
          
          if (onboardingStep && onboardingStep !== 'complete') {
            navigate('/' + onboardingStep, { replace: true });
          } else {
            navigate('/explore', { replace: true });
          }
        } else {
          navigate('/onboarding', { replace: true });
        }
      }, 1500);
    } catch (firestoreError) {
      console.log('Firestore update failed, but user is authenticated, continuing to onboarding');
      setMessage('Email verified successfully! Redirecting to onboarding...');
      setTimeout(() => {
        navigate('/onboarding', { replace: true });
      }, 1500);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (currentUser) {
      console.log('EmailVerificationPage: Setting user object');
      console.log('EmailVerificationPage: User email:', currentUser.email);
      console.log('EmailVerificationPage: User UID:', currentUser.uid);
      console.log('EmailVerificationPage: Email verified status:', currentUser.emailVerified);
      
      setUser(currentUser);
      setInitializing(false);
      
      // CRITICAL: Only redirect if user is actually verified
      if (currentUser.emailVerified === true) {
        console.log('EmailVerificationPage: User already verified, redirecting...');
        handleVerifiedUser();
        return;
      } else {
        console.log('EmailVerificationPage: User NOT verified, staying on verification page');
      }
      
      // Auto-check verification status every 5 seconds
      const verificationCheckInterval = setInterval(async () => {
        try {
          await currentUser.reload();
          const refreshedUser = auth.currentUser;
          
          console.log('EmailVerificationPage: Auto-check - email verified status:', refreshedUser?.emailVerified);
          
          if (refreshedUser && refreshedUser.emailVerified === true) {
            console.log('EmailVerificationPage: Email verified detected in auto-check, redirecting...');
            clearInterval(verificationCheckInterval);
            handleVerifiedUser();
          } else {
            console.log('EmailVerificationPage: Auto-check - user still not verified, continuing to wait...');
          }
        } catch (error) {
          console.log('Auto-verification check failed:', error);
        }
      }, 5000); // Check every 5 seconds
      
      // Cleanup interval on unmount
      return () => clearInterval(verificationCheckInterval);
    } else {
      // If no user, redirect to login
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleResendVerification = async () => {
    const currentAuth = getAuth();
    const currentUser = currentAuth.currentUser;
    
    console.log('Resend verification: Auth state check');
    console.log('Resend verification: Current user from auth:', currentUser?.email);
    console.log('Resend verification: User from state:', user?.email);
    
    if (!user && !currentUser) {
      console.error('Resend verification: No user found in state or auth');
      setError('User not found. Please try logging in again.');
      return;
    }
    
    const userToUse = currentUser || user;
    
      console.log('Resend verification: Starting for user:', userToUse.email);
      console.log('Resend verification: User object:', {
        uid: userToUse.uid,
        email: userToUse.email,
        emailVerified: userToUse.emailVerified,
        providerData: userToUse.providerData
      });
      
      setLoading(true);
      setError('');
      setMessage('');    try {
      // Check if user is already verified before sending
      await userToUse.reload();
      if (userToUse.emailVerified) {
        setMessage('Your email is already verified!');
        setLoading(false);
        return;
      }
      
      console.log('Resend verification: Sending email to:', userToUse.email);
      console.log('Resend verification: Auth domain:', getAuth().app.options.authDomain);
      console.log('Resend verification: Project ID:', getAuth().app.options.projectId);
      
      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: false
      };
      
      console.log('Resend verification: Action code settings:', actionCodeSettings);
      
      try {
        // Try with custom settings first
        await sendEmailVerification(userToUse, actionCodeSettings);
        console.log('Resend verification: Email sent successfully with custom settings');
      } catch (customError) {
        console.warn('Custom settings failed, trying default:', customError);
        // Fallback to default settings
        await sendEmailVerification(userToUse);
        console.log('Resend verification: Email sent successfully with default settings');
      }
      
      setMessage('Verification email sent! Please check your email inbox AND your spam/junk folder. Note: It may take a few minutes to arrive.');
      
    } catch (err) {
      console.error('Resend verification error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      
      if (err.code === 'auth/too-many-requests') {
        setError('Too many verification emails sent. Please wait a few minutes before trying again.');
      } else if (err.code === 'auth/user-not-found') {
        setError('User not found. Please try registering again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address. Please contact support.');
      } else {
        setError(`Failed to send verification email: ${err.message}`);
      }
    }
    setLoading(false);
  };

  const handleCheckVerification = async () => {
    if (!user) return;
    
    setCheckingVerification(true);
    setError('');
    
    try {
      // Force reload user to get fresh verification status
      await user.reload();
      const auth = getAuth();
      const refreshedUser = auth.currentUser;
      
      if (refreshedUser && refreshedUser.emailVerified === true) {
        console.log('Manual check: Email verified, proceeding with redirect');
        handleVerifiedUser();
      } else {
        setError('Email not yet verified. Please check your email and click the verification link. Don\'t forget to check your spam folder!');
      }
    } catch (err) {
      console.error('Check verification error:', err);
      setError('Error checking verification status. Please try again.');
    }
    setCheckingVerification(false);
  };

  const handleSignOut = async () => {
    try {
      const auth = getAuth();
      await auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (initializing) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>Checking Email Verification...</h2>
          <div style={{ color: '#666' }}>Please wait while we check your verification status...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>Verify Your Email</h2>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            We've sent a verification email to <strong>{user?.email}</strong>
          </p>
        </div>

        <div style={{ 
          background: '#FFF7E6', 
          border: '1px solid #FFD700', 
          borderRadius: '8px', 
          padding: '1rem', 
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <h3 style={{ color: '#E65100', marginBottom: '0.5rem', fontSize: '1rem' }}>⚠️ Important: Check Your Spam Folder!</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
            Email verification messages sometimes end up in spam/junk folders. 
            If you don't see the email in your inbox, please check your spam folder.
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: '1.6' }}>
            Click the verification link in the email to activate your account. 
            <strong> We're automatically checking for verification every 5 seconds</strong> - 
            once verified, you'll be redirected to continue your onboarding.
          </p>
        </div>

        <div style={{ 
          background: '#E3F2FD', 
          border: '1px solid #2196F3', 
          borderRadius: '8px', 
          padding: '1rem', 
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <h3 style={{ color: '#1976D2', marginBottom: '0.5rem', fontSize: '1rem' }}>🔄 Auto-Checking Verification</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
            No need to refresh or click buttons - we're monitoring your verification status automatically. 
            Just click the link in your email when you receive it!
          </p>
        </div>

        {message && (
          <div style={{ 
            background: '#E8F5E8', 
            color: '#2E7D32', 
            padding: '1rem', 
            borderRadius: '4px', 
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ 
            background: '#FFEBEE', 
            color: '#C62828', 
            padding: '1rem', 
            borderRadius: '4px', 
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={handleCheckVerification}
            disabled={checkingVerification}
            style={{
              background: '#007B7F',
              color: '#fff',
              padding: '1rem',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '1rem',
              cursor: checkingVerification ? 'not-allowed' : 'pointer',
              opacity: checkingVerification ? 0.7 : 1
            }}
          >
            {checkingVerification ? 'Checking...' : 'I\'ve Verified My Email'}
          </button>

          <button
            onClick={handleResendVerification}
            disabled={loading}
            style={{
              background: 'transparent',
              color: '#007B7F',
              padding: '0.75rem',
              border: '2px solid #007B7F',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <button
            onClick={handleSignOut}
            style={{
              background: 'transparent',
              color: '#666',
              padding: '0.5rem',
              border: 'none',
              fontSize: '0.9rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Sign in with a different account
          </button>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: '#F5F5F5', borderRadius: '8px' }}>
          <h4 style={{ color: '#1C1C1C', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Still having trouble?</h4>
          <ul style={{ color: '#666', fontSize: '0.8rem', textAlign: 'left', margin: 0, paddingLeft: '1.2rem' }}>
            <li>Check your spam/junk folder</li>
            <li>Add noreply@lokal.com to your contacts</li>
            <li>Wait a few minutes for the email to arrive</li>
            <li>Try resending the verification email</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default EmailVerificationPage;