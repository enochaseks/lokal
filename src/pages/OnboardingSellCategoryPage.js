import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const categories = [
  'Foods & Goods',
  'Meat & Poultry',
  'Wholesale',
  'Beauty & Hair',
];

function OnboardingSellCategoryPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFoodQuestion, setShowFoodQuestion] = useState(false);
  const [sellsPerishableFood, setSellsPerishableFood] = useState('');
  const [foodHygieneProof, setFoodHygieneProof] = useState(null);
  const [formError, setFormError] = useState('');

  const handleCategory = (cat) => {
    if (cat === 'Foods & Goods') {
      setSelectedCategory(cat);
      setShowFoodQuestion(true);
    } else {
      proceedWithCategory(cat);
    }
  };

  const proceedWithCategory = async (cat) => {
    const { getAuth } = await import('firebase/auth');
    const { doc, updateDoc, getDoc, setDoc } = await import('firebase/firestore');
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { db, storage } = await import('../firebase');
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const updateData = {
        onboardingStep: 'onboarding-sell-location',
        category: cat,
      };
      
      // Add food-related data if applicable
      if (cat === 'Foods & Goods') {
        updateData.sellsPerishableFood = sellsPerishableFood;
        
        // Upload food hygiene proof if it's a file
        if (foodHygieneProof && typeof foodHygieneProof !== 'string') {
          const foodHygieneRef = ref(storage, `foodHygieneProofs/${user.uid}_${foodHygieneProof.name}`);
          await uploadBytes(foodHygieneRef, foodHygieneProof);
          const foodHygieneUrl = await getDownloadURL(foodHygieneRef);
          updateData.foodHygieneProof = foodHygieneUrl;
        } else {
          updateData.foodHygieneProof = foodHygieneProof;
        }
      }
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          createdAt: new Date().toISOString(),
          ...updateData,
        });
      } else {
        await updateDoc(userRef, updateData);
      }
    }
    navigate('/onboarding-sell-location', { 
      state: { 
        category: cat,
        sellsPerishableFood: sellsPerishableFood,
        foodHygieneProof: foodHygieneProof
      } 
    });
  };

  const handleFoodQuestionSubmit = () => {
    setFormError('');
    
    if (sellsPerishableFood === 'yes' && !foodHygieneProof) {
      setFormError('You must upload proof of food hygiene certification to sell perishable food items.');
      return;
    }
    
    proceedWithCategory(selectedCategory);
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#007B7F', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>&larr; Back</button>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
        {!showFoodQuestion ? (
          <>
            <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>What are you looking to sell?</h2>
            {categories.map((cat) => (
              <button
                key={cat}
                style={{ width: '100%', background: '#007B7F', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', cursor: 'pointer' }}
                onClick={() => handleCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </>
        ) : (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>Food Safety Information</h2>
            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Do you sell meat, chicken, fish, or other food items that could easily spoil at your store?
              </label>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="perishableFood"
                    value="yes"
                    checked={sellsPerishableFood === 'yes'}
                    onChange={(e) => setSellsPerishableFood(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Yes, I sell perishable food items
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="perishableFood"
                    value="no"
                    checked={sellsPerishableFood === 'no'}
                    onChange={(e) => setSellsPerishableFood(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  No, I only sell non-perishable food items
                </label>
              </div>
            </div>
            
            {sellsPerishableFood === 'yes' && (
              <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                <label style={{ color: '#1C1C1C', display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Food Hygiene Certificate/Proof (Required)
                </label>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Please upload your food hygiene certificate or any relevant document showing you can safely sell perishable food items and your products are fresh.
                </p>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFoodHygieneProof(e.target.files[0])}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}
                />
              </div>
            )}
            
            {formError && (
              <div style={{ color: '#D92D20', marginBottom: '1rem', textAlign: 'left' }}>
                {formError}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowFoodQuestion(false);
                  setSelectedCategory('');
                  setSellsPerishableFood('');
                  setFoodHygieneProof(null);
                  setFormError('');
                }}
                style={{ flex: 1, background: '#B8B8B8', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={handleFoodQuestionSubmit}
                disabled={!sellsPerishableFood}
                style={{ 
                  flex: 1, 
                  background: sellsPerishableFood ? '#007B7F' : '#B8B8B8', 
                  color: '#fff', 
                  padding: '1rem', 
                  border: 'none', 
                  borderRadius: 8, 
                  fontWeight: 'bold', 
                  fontSize: '1rem', 
                  cursor: sellsPerishableFood ? 'pointer' : 'not-allowed' 
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingSellCategoryPage; 