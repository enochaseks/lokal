import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SHOP_OPTIONS = [
  'Shopping for Foods and Goods',
  'Looking for beauty products',
  'Looking for good wholesale items',
  'Looking to buy meat and poultry',
  'All of the Above',
];

function OnboardingShopTypePage() {
  const [selected, setSelected] = useState([]);
  const navigate = useNavigate();

  const handleChange = (option) => {
    if (option === 'All of the Above') {
      if (selected.includes(option)) {
        // If "All of the Above" is currently selected, uncheck everything
        setSelected([]);
      } else {
        // If "All of the Above" is not selected, check all options
        setSelected([...SHOP_OPTIONS]);
      }
    } else {
      // Handle individual options
      const newSelected = selected.includes(option)
        ? selected.filter(o => o !== option)
        : [...selected, option];
      
      // If all individual options (excluding "All of the Above") are selected, add "All of the Above"
      const individualOptions = SHOP_OPTIONS.filter(opt => opt !== 'All of the Above');
      const allIndividualSelected = individualOptions.every(opt => newSelected.includes(opt));
      
      if (allIndividualSelected && !newSelected.includes('All of the Above')) {
        setSelected([...newSelected, 'All of the Above']);
      } else if (!allIndividualSelected && newSelected.includes('All of the Above')) {
        // If not all individual options are selected, remove "All of the Above"
        setSelected(newSelected.filter(opt => opt !== 'All of the Above'));
      } else {
        setSelected(newSelected);
      }
    }
  };

  const handleContinue = async () => {
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
          onboardingStep: 'create-profile',
          shoppingPreferences: selected // Save shopping preferences
        });
      } else {
        await updateDoc(userRef, { 
          onboardingStep: 'onboarding-preferences',
          shoppingPreferences: selected // Save shopping preferences
        });
      }
    }
    navigate('/onboarding-preferences');
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#007B7F', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>&larr; Back</button>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
        <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>Click the type of shopping you are looking to do</h2>
        <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
          {SHOP_OPTIONS.map(option => (
            <label key={option} style={{ display: 'block', marginBottom: 16, fontSize: '1.1rem' }}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => handleChange(option)}
                style={{ marginRight: 10 }}
              />
              {option}
            </label>
          ))}
        </div>
        <button
          style={{ width: '100%', background: '#007B7F', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
          onClick={handleContinue}
          disabled={selected.length === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export default OnboardingShopTypePage; 