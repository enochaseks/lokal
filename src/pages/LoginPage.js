import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
          </div>
          {error && <div style={{ color: '#D92D20', marginBottom: '1rem' }}>{error}</div>}
          <button type="submit" style={{ width: '100%', background: '#D92D20', color: '#fff', padding: '0.75rem', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: '1rem' }} disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <span style={{ color: '#1C1C1C' }}>Don't have an account? </span>
          <a href="/register" style={{ color: '#007B7F', fontWeight: 'bold', textDecoration: 'none' }}>Sign up</a>
        </div>
      </div>
    </div>
  );
}

export default LoginPage; 