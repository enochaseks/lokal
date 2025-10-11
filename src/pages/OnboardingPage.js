import React from 'react';
import { useNavigate } from 'react-router-dom';

function OnboardingPage() {
  const navigate = useNavigate();

  const handleSell = async () => {
    const { getAuth } = await import('firebase/auth');
    const { doc, updateDoc, getDoc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          createdAt: new Date().toISOString(),
          onboardingStep: 'onboarding-sell-category',
          userType: 'seller', // Explicitly set user type
        });
      } else {
        await updateDoc(userRef, { 
          onboardingStep: 'onboarding-sell-category',
          userType: 'seller' // Ensure user type is set
        });
      }
      
      // Clear user type cache to force fresh detection
      const cacheKey = `userType_${user.uid}`;
      localStorage.removeItem(cacheKey);
    }
    navigate('/onboarding-sell-category');
  };

  const handleShop = async () => {
    const { getAuth } = await import('firebase/auth');
    const { doc, updateDoc, getDoc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          createdAt: new Date().toISOString(),
          onboardingStep: 'onboarding-shop-type',
          userType: 'buyer', // Explicitly set user type
        });
      } else {
        await updateDoc(userRef, { 
          onboardingStep: 'onboarding-shop-type',
          userType: 'buyer' // Ensure user type is set
        });
      }
      
      // Clear user type cache to force fresh detection
      const cacheKey = `userType_${user.uid}`;
      localStorage.removeItem(cacheKey);
    }
    navigate('/onboarding-shop-type');
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#007B7F', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>&larr; Back</button>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
        <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>Why are you on Lokal?</h2>
        <button style={{ width: '100%', background: '#D92D20', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', cursor: 'pointer' }}
          onClick={handleSell}
        >
          I want to sell
        </button>
        <button style={{ width: '100%', background: '#007B7F', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
          onClick={handleShop}
        >
          I am looking to shop around
        </button>
      </div>
    </div>
  );
}

export default OnboardingPage; 