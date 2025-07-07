import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { app } from '../firebase';
import { useNavigate } from 'react-router';
import { getDocs, collection, query, where, setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && user.emailVerified) {
        // Check onboardingStep
        const { doc, getDoc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const onboardingStep = userDoc.data().onboardingStep;
          if (onboardingStep && onboardingStep !== 'complete') {
            navigate('/' + onboardingStep);
            return;
          }
        }
        navigate('/onboarding');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setVerificationSent(false);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    // Age validation
    const today = new Date();
    const dobDate = new Date(dob);
    const age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    const isBirthdayPassed = m > 0 || (m === 0 && today.getDate() >= dobDate.getDate());
    const actualAge = isBirthdayPassed ? age : age - 1;
    if (actualAge < 16) {
      setError('You must be at least 16 years old to sign up.');
      return;
    }
    try {
      // Check if email is deactivated in users or stores
      const usersQuery = query(collection(db, 'users'), where('email', '==', email), where('deactivated', '==', true));
      const usersSnap = await getDocs(usersQuery);
      const storesQuery = query(collection(db, 'stores'), where('email', '==', email), where('deactivated', '==', true));
      const storesSnap = await getDocs(storesQuery);
      if (!usersSnap.empty || !storesSnap.empty) {
        setError('This email is associated with a deactivated account. Please contact support.');
        return;
      }
      const auth = getAuth(app);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { setDoc, doc, getDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email,
          createdAt: new Date().toISOString(),
          onboardingStep: 'onboarding',
        });
      }
      await sendEmailVerification(userCredential.user);
      setVerificationSent(true);
      setSuccess('Account created! Please check your email to verify your account.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 400, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8' }}>
        <h2 style={{ color: '#D92D20', marginBottom: '1rem' }}>Register</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Date of Birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
          </div>
          {error && <div style={{ color: '#D92D20', marginBottom: '1rem' }}>{error}</div>}
          {success && <div style={{ color: '#3A8E3A', marginBottom: '1rem' }}>{success}</div>}
          <button type="submit" style={{ width: '100%', background: '#D92D20', color: '#fff', padding: '0.75rem', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: '1rem' }} disabled={verificationSent}>Register</button>
        </form>
        {verificationSent && (
          <div style={{ color: '#007B7F', marginTop: '1rem', textAlign: 'center' }}>
            Please verify your email to continue. Refresh this page after verification.
          </div>
        )}
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <span style={{ color: '#1C1C1C' }}>Already have an account? </span>
          <a href="/login" style={{ color: '#007B7F', fontWeight: 'bold', textDecoration: 'none' }}>Login</a>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage; 