import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Dietary preferences relevant to African/Caribbean communities
const DIETARY_OPTIONS = [
  'Halal',
  'Vegetarian', 
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Diabetic-Friendly',
  'No dietary restrictions'
];

// Cultural/Regional preferences for African & Caribbean business products
const CULTURAL_PREFERENCES = [
  'West African products (Nigerian, Ghanaian, Senegalese)',
  'East African products (Ethiopian, Kenyan, Somali)',
  'Central African products (Cameroon, Congo)',
  'Caribbean products (Jamaican, Trinidadian, Barbadian)',
  'South African products',
  'North African products (Moroccan, Egyptian)',
  'Mixed African & Caribbean',
  'No specific regional preference'
];

// Budget ranges for typical African/Caribbean store purchases
const BUDGET_RANGES = [
  'Budget-conscious (Under £20 per shop)',
  'Moderate spending (£20-50 per shop)', 
  'Regular shopper (£50-100 per shop)',
  'Premium buyer (£100+ per shop)',
  'Special occasions only',
  'No budget preference'
];

// Shopping habits specific to African/Caribbean stores
const SHOPPING_HABITS = [
  'Weekly grocery essentials',
  'Monthly bulk buying (rice, oil, spices)',
  'Special occasion shopping (parties, celebrations)',
  'Beauty & hair care products',
  'Traditional medicine & herbs',
  'Fabrics & cultural items',
  'Wholesale for reselling',
  'Seasonal festival shopping'
];

// Delivery preferences
const DELIVERY_PREFERENCES = [
  'Same day delivery preferred',
  'Next day delivery is fine',
  'Weekend delivery preferred',
  'Collection from store preferred',
  'Flexible - whatever works',
  'Evening delivery preferred'
];



// Age ranges for better product recommendations
const AGE_RANGES = [
  '18-25', '26-35', '36-45', '46-55', '56-65', '65+'
];

function OnboardingPreferencesPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [dietaryPreferences, setDietaryPreferences] = useState([]);
  const [culturalPreferences, setCulturalPreferences] = useState([]);
  const [budgetRange, setBudgetRange] = useState('');
  const [shoppingHabits, setShoppingHabits] = useState([]);
  const [deliveryPreference, setDeliveryPreference] = useState('');
  const [ageRange, setAgeRange] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  
  const totalSteps = 6;

  const handleMultiSelect = (value, currentArray, setter) => {
    if (currentArray.includes(value)) {
      setter(currentArray.filter(item => item !== value));
    } else {
      setter([...currentArray, value]);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    const { getAuth } = await import('firebase/auth');
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        onboardingStep: 'create-profile',
        preferences: {
          dietary: dietaryPreferences,
          cultural: culturalPreferences,
          budget: budgetRange,
          shoppingHabits: shoppingHabits,
          delivery: deliveryPreference,
          ageRange: ageRange,
          completedAt: new Date().toISOString()
        }
      });
    }
    
    navigate('/create-profile');
  };

  const renderProgressBar = () => (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.9rem', color: '#666' }}>Step {currentStep} of {totalSteps}</span>
        <span style={{ fontSize: '0.9rem', color: '#666' }}>{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
      </div>
      <div style={{ width: '100%', height: '8px', backgroundColor: '#E5E5E5', borderRadius: '4px' }}>
        <div 
          style={{ 
            width: `${(currentStep / totalSteps) * 100}%`, 
            height: '100%', 
            backgroundColor: '#007B7F', 
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} 
        />
      </div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>Any dietary preferences we should know about?</h2>
            <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.95rem' }}>
              This helps us show you the right food products and ingredients.
            </p>
            <div style={{ textAlign: 'left' }}>
              {DIETARY_OPTIONS.map(option => (
                <label key={option} style={{ display: 'block', marginBottom: 16, fontSize: '1rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={dietaryPreferences.includes(option)}
                    onChange={() => handleMultiSelect(option, dietaryPreferences, setDietaryPreferences)}
                    style={{ marginRight: 12 }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>What regional products are you most interested in?</h2>
            <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.95rem' }}>
              We'll prioritize showing you stores that specialize in these products.
            </p>
            <div style={{ textAlign: 'left' }}>
              {CULTURAL_PREFERENCES.map(option => (
                <label key={option} style={{ display: 'block', marginBottom: 16, fontSize: '1rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={culturalPreferences.includes(option)}
                    onChange={() => handleMultiSelect(option, culturalPreferences, setCulturalPreferences)}
                    style={{ marginRight: 12 }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>What's your typical shopping budget?</h2>
            <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.95rem' }}>
              This helps us show you stores and deals that match your budget.
            </p>
            <div style={{ textAlign: 'left' }}>
              {BUDGET_RANGES.map(option => (
                <label key={option} style={{ display: 'block', marginBottom: 16, fontSize: '1rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="budget"
                    checked={budgetRange === option}
                    onChange={() => setBudgetRange(option)}
                    style={{ marginRight: 12 }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>What do you typically shop for?</h2>
            <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.95rem' }}>
              Select all that apply - this helps us recommend the right stores.
            </p>
            <div style={{ textAlign: 'left' }}>
              {SHOPPING_HABITS.map(option => (
                <label key={option} style={{ display: 'block', marginBottom: 16, fontSize: '1rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shoppingHabits.includes(option)}
                    onChange={() => handleMultiSelect(option, shoppingHabits, setShoppingHabits)}
                    style={{ marginRight: 12 }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>How do you prefer to receive your orders?</h2>
            <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.95rem' }}>
              We'll show you stores that match your delivery preferences.
            </p>
            <div style={{ textAlign: 'left' }}>
              {DELIVERY_PREFERENCES.map(option => (
                <label key={option} style={{ display: 'block', marginBottom: 16, fontSize: '1rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryPreference === option}
                    onChange={() => setDeliveryPreference(option)}
                    style={{ marginRight: 12 }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>What's your age range?</h2>
            <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.95rem' }}>
              This helps us show you the most relevant products and recommendations.
            </p>
            <div style={{ textAlign: 'left' }}>
              {AGE_RANGES.map(option => (
                <label key={option} style={{ display: 'block', marginBottom: 16, fontSize: '1rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="age"
                    checked={ageRange === option}
                    onChange={() => setAgeRange(option)}
                    style={{ marginRight: 12 }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button 
        onClick={() => navigate(-1)} 
        style={{ 
          position: 'absolute', 
          top: 20, 
          left: 20, 
          background: 'none', 
          border: 'none', 
          color: '#007B7F', 
          fontWeight: 'bold', 
          fontSize: '1.2rem', 
          cursor: 'pointer' 
        }}
      >
        &larr; Back
      </button>
      
      <div style={{ 
        maxWidth: 600, 
        margin: '2rem auto', 
        background: '#fff', 
        padding: '2rem', 
        borderRadius: '8px', 
        boxShadow: '0 2px 8px #B8B8B8' 
      }}>
        {renderProgressBar()}
        
        <div style={{ textAlign: 'left', marginBottom: '3rem', minHeight: '400px' }}>
          {renderStep()}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            style={{
              background: currentStep === 1 ? '#E5E5E5' : '#fff',
              color: currentStep === 1 ? '#999' : '#007B7F',
              padding: '0.75rem 1.5rem',
              border: '2px solid #007B7F',
              borderRadius: 8,
              fontWeight: 'bold',
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 1 ? 0.5 : 1
            }}
          >
            Previous
          </button>
          
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              color: '#999',
              border: 'none',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Skip this step
          </button>
          
          <button
            onClick={handleNext}
            style={{
              background: '#007B7F',
              color: '#fff',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {currentStep === totalSteps ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingPreferencesPage;