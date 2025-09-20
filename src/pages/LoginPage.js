import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { app } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = getAuth(app);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check if user is deactivated or deleted in Firestore
      let userDocSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userDocSnap.exists()) {
        // Try as seller
        userDocSnap = await getDoc(doc(db, 'stores', user.uid));
      }
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        
        // Check if account was deleted by admin
        if (userData.deleted || userData.accountStatus === 'deleted') {
          await auth.signOut();
          setError('Your account has been permanently deleted by an administrator. Please contact support if you believe this is an error.');
          setLoading(false);
          return;
        }
        
        // Check if account is deactivated
        if (userData.deactivated) {
          await auth.signOut();
          setError('Your account has been deactivated. Please contact support.');
          setLoading(false);
          return;
        }
        
        // Onboarding progress check
        const onboardingStep = userData.onboardingStep;
        if (onboardingStep && onboardingStep !== 'complete') {
          navigate('/' + onboardingStep);
          setLoading(false);
          return;
        }
      }
      navigate('/explore');
    } catch (err) {
      setError('Invalid email or password.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetError('Please enter your email address.');
      return;
    }

    setResetError('');
    setResetMessage('');
    setResetLoading(true);

    try {
      const auth = getAuth(app);
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Password reset email sent! Check your inbox and follow the instructions to reset your password.');
      setResetEmail('');
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setResetError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setResetError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setResetError('Too many reset attempts. Please try again later.');
      } else {
        setResetError('Failed to send reset email. Please try again.');
      }
    }
    setResetLoading(false);
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setResetEmail('');
    setResetMessage('');
    setResetError('');
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 400, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8' }}>
        <h2 style={{ color: '#D92D20', marginBottom: '1rem' }}>Login</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  paddingRight: '2.5rem',
                  border: '1px solid #B8B8B8', 
                  borderRadius: 4,
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }} 
                required 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: '#666',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  lineHeight: '1',
                  zIndex: 1
                }}
                onMouseOver={(e) => e.target.style.color = '#333'}
                onMouseOut={(e) => e.target.style.color = '#666'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#007B7F',
                  fontSize: '0.9rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Forgot Password?
              </button>
            </div>
          </div>
          {error && <div style={{ color: '#D92D20', marginBottom: '1rem' }}>{error}</div>}
          <button type="submit" style={{ width: '100%', background: '#D92D20', color: '#fff', padding: '0.75rem', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: '1rem' }} disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <span style={{ color: '#1C1C1C' }}>Don't have an account? </span>
          <a href="/register" style={{ color: '#007B7F', fontWeight: 'bold', textDecoration: 'none' }}>Sign up</a>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            padding: '2rem',
            maxWidth: '90vw',
            width: 400,
            position: 'relative'
          }}>
            {/* Close button */}
            <button
              onClick={closeForgotPasswordModal}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#f0f0f0';
                e.target.style.color = '#333';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#666';
              }}
            >
              ×
            </button>

            <h2 style={{ color: '#D92D20', marginBottom: '1rem', fontSize: '1.3rem' }}>
              Reset Password
            </h2>
            
            <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.4' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleForgotPassword}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email address"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #B8B8B8',
                    borderRadius: 6,
                    fontSize: '1rem'
                  }}
                  required
                />
              </div>

              {resetError && (
                <div style={{
                  color: '#D92D20',
                  marginBottom: '1rem',
                  padding: '0.5rem',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 4,
                  fontSize: '0.9rem'
                }}>
                  {resetError}
                </div>
              )}

              {resetMessage && (
                <div style={{
                  color: '#059669',
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 4,
                  fontSize: '0.9rem',
                  lineHeight: '1.4'
                }}>
                  {resetMessage}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeForgotPasswordModal}
                  style={{
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 6,
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{
                    background: resetLoading ? '#9ca3af' : '#D92D20',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: resetLoading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (!resetLoading) e.target.style.backgroundColor = '#b91c1c';
                  }}
                  onMouseOut={(e) => {
                    if (!resetLoading) e.target.style.backgroundColor = '#D92D20';
                  }}
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage; 