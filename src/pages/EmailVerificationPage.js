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
  const [lastEmailSent, setLastEmailSent] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [rateLimitCount, setRateLimitCount] = useState(0);
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

  // Initialize rate limiting from localStorage
  useEffect(() => {
    const now = Date.now();
    
    // Check for existing rate limit
    const rateLimitUntil = localStorage.getItem('rateLimitUntil');
    if (rateLimitUntil) {
      const rateLimitEnd = parseInt(rateLimitUntil);
      if (now < rateLimitEnd) {
        setCooldownRemaining(Math.ceil((rateLimitEnd - now) / 1000));
        setLastEmailSent(now - 60000); // Set to trigger rate limit check
        return;
      } else {
        localStorage.removeItem('rateLimitUntil');
      }
    }
    
    // Check for regular cooldown
    const storedLastEmailSent = localStorage.getItem('lastEmailSent');
    if (storedLastEmailSent) {
      const lastSent = parseInt(storedLastEmailSent);
      const timeSinceLastEmail = now - lastSent;
      const COOLDOWN_PERIOD = 60000; // 60 seconds
      
      if (timeSinceLastEmail < COOLDOWN_PERIOD) {
        setLastEmailSent(lastSent);
        setCooldownRemaining(Math.ceil((COOLDOWN_PERIOD - timeSinceLastEmail) / 1000));
      } else {
        // Clear expired timestamp
        localStorage.removeItem('lastEmailSent');
      }
    }
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    let cooldownInterval;
    if (cooldownRemaining > 0) {
      cooldownInterval = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            localStorage.removeItem('lastEmailSent');
            localStorage.removeItem('rateLimitUntil');
            setLastEmailSent(null);
            setRateLimitCount(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownInterval) clearInterval(cooldownInterval);
    };
  }, [cooldownRemaining]);

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
    // Check rate limiting - prevent requests within 60 seconds
    const now = Date.now();
    const COOLDOWN_PERIOD = 60000; // 60 seconds
    
    if (lastEmailSent && (now - lastEmailSent) < COOLDOWN_PERIOD) {
      const remainingTime = Math.ceil((COOLDOWN_PERIOD - (now - lastEmailSent)) / 1000);
      setError(`Please wait ${remainingTime} seconds before requesting another verification email.`);
      setCooldownRemaining(remainingTime);
      return;
    }

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
    setMessage('');
    
    try {
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
      
      // Set the timestamp before attempting to send
      setLastEmailSent(now);
      localStorage.setItem('lastEmailSent', now.toString());
      
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
      setCooldownRemaining(60); // Start cooldown timer
      
    } catch (err) {
      console.error('Resend verification error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      
      // Reset timestamp on error so user can try again after a short wait
      setLastEmailSent(null);
      localStorage.removeItem('lastEmailSent');
      
      if (err.code === 'auth/too-many-requests') {
        const newRateLimitCount = rateLimitCount + 1;
        setRateLimitCount(newRateLimitCount);
        
        // Exponential backoff: 5 minutes for first offense, 15 for second, 30 for third+
        const backoffMinutes = newRateLimitCount === 1 ? 5 : newRateLimitCount === 2 ? 15 : 30;
        const backoffSeconds = backoffMinutes * 60;
        
        setError(`Too many verification emails sent recently. Please wait ${backoffMinutes} minutes before trying again. Check your spam folder in the meantime.`);
        setCooldownRemaining(backoffSeconds);
        
        // Store the rate limit timestamp
        localStorage.setItem('rateLimitUntil', (Date.now() + (backoffSeconds * 1000)).toString());
      } else if (err.code === 'auth/user-not-found') {
        setError('User not found. Please try registering again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address. Please contact support.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
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

        {cooldownRemaining > 0 && (
          <div style={{ 
            background: '#FFF3E0', 
            border: '1px solid #FF9800', 
            borderRadius: '8px', 
            padding: '1rem', 
            marginBottom: '2rem',
            textAlign: 'left'
          }}>
            <h3 style={{ color: '#F57C00', marginBottom: '0.5rem', fontSize: '1rem' }}>⏱️ Rate Limit Active</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
              Please wait {cooldownRemaining} seconds before requesting another verification email. 
              This helps prevent spam and ensures reliable email delivery.
            </p>
          </div>
        )}

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
            disabled={loading || cooldownRemaining > 0}
            style={{
              background: 'transparent',
              color: cooldownRemaining > 0 ? '#999' : '#007B7F',
              padding: '0.75rem',
              border: `2px solid ${cooldownRemaining > 0 ? '#999' : '#007B7F'}`,
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: (loading || cooldownRemaining > 0) ? 'not-allowed' : 'pointer',
              opacity: (loading || cooldownRemaining > 0) ? 0.7 : 1
            }}
          >
            {loading 
              ? 'Sending...' 
              : cooldownRemaining > 0 
                ? `Wait ${cooldownRemaining}s` 
                : 'Resend Verification Email'
            }
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
            <li><strong>Check your spam/junk folder</strong> - This is the most common issue!</li>
            <li>Add <strong>noreply@lokal.com</strong> to your contacts</li>
            <li>Wait a few minutes for the email to arrive</li>
            <li>Make sure your email address is correct: <strong>{user?.email}</strong></li>
            {cooldownRemaining > 0 ? (
              <li style={{ color: '#F57C00' }}>Wait for the cooldown to end before requesting another email</li>
            ) : (
              <li>Try resending the verification email if needed</li>
            )}
          </ul>
          {cooldownRemaining > 60 && (
            <div style={{ marginTop: '10px', padding: '8px', background: '#FFF3E0', borderRadius: '4px', border: '1px solid #FF9800' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#E65100' }}>
                <strong>Extended cooldown active:</strong> While waiting, double-check your spam folder and ensure your email address is correct.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailVerificationPage;