import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectUserCountry } from '../utils/countryDetection';
import { getCountrySpecificRequirements, getFoodBusinessTypes, getCountryFoodSafetyInfo, getPerishableFoodExamples, getPerishableFoodRequirements } from '../utils/foodHandlingRequirements';

const categories = [
  'Foods & Goods',
  'Meat & Poultry',
  'Wholesale',
  'Beauty & Hair',
];

// Dietary options that stores can offer
const DIETARY_OPTIONS = [
  'Halal',
  'Vegetarian', 
  'Vegan',
  'Kosher',
  'Gluten-free',
  'Organic',
  'No specific dietary options'
];

function OnboardingSellCategoryPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFoodQuestion, setShowFoodQuestion] = useState(false);
  const [showFoodHandlingQuestion, setShowFoodHandlingQuestion] = useState(false);
  const [showDietaryQuestion, setShowDietaryQuestion] = useState(false);
  const [handlesFoodPreparation, setHandlesFoodPreparation] = useState('');
  const [sellsPerishableFood, setSellsPerishableFood] = useState('');
  const [dietaryOptions, setDietaryOptions] = useState([]);
  const [foodHygieneProof, setFoodHygieneProof] = useState(null);
  const [perishableFoodProof, setPerishableFoodProof] = useState(null);
  const [councilRegistrationForm, setCouncilRegistrationForm] = useState({
    businessName: '',
    businessAddress: '',
    contactPerson: '',
    phoneNumber: '',
    emailAddress: '',
    typeOfFoodBusiness: '',
    operatingHours: '',
    numberOfEmployees: '',
    foodSafetyOfficer: '',
    dateOfApplication: ''
  });
  const [formError, setFormError] = useState('');
  const [userCountry, setUserCountry] = useState(null);
  const [countryRequirements, setCountryRequirements] = useState(null);
  const [foodBusinessTypes, setFoodBusinessTypes] = useState([]);
  const [foodSafetyInfo, setFoodSafetyInfo] = useState(null);
  const [perishableExamples, setPerishableExamples] = useState([]);
  const [perishableFoodRequirements, setPerishableFoodRequirements] = useState(null);

  // Detect user's country and set requirements on component mount
  useEffect(() => {
    const detectCountryAndSetRequirements = async () => {
      try {
        const country = await detectUserCountry();
        console.log('🌍 Detected country for food handling:', country);
        
        setUserCountry(country);
        const requirements = getCountrySpecificRequirements(country);
        const businessTypes = getFoodBusinessTypes(country);
        
        setCountryRequirements(requirements);
        setFoodBusinessTypes(businessTypes);
        
        // Get country-specific food safety information
        const safetyInfo = getCountryFoodSafetyInfo(country);
        const perishableFood = getPerishableFoodExamples(country);
        const perishableReqs = getPerishableFoodRequirements(country);
        setFoodSafetyInfo(safetyInfo);
        setPerishableExamples(perishableFood);
        setPerishableFoodRequirements(perishableReqs);
        
        // Initialize form with country-specific fields
        const initialForm = {};
        Object.keys(requirements.formFields).forEach(fieldKey => {
          initialForm[fieldKey] = '';
        });
        setCouncilRegistrationForm(initialForm);
        
        console.log('📋 Set country-specific requirements:', {
          country,
          certificateName: requirements.certificateName,
          registrationFormName: requirements.registrationFormName,
          authority: safetyInfo.authority
        });
      } catch (error) {
        console.error('Error detecting country for food handling:', error);
        // Fallback to default requirements
        const defaultRequirements = getCountrySpecificRequirements('GB'); // Default to UK
        setCountryRequirements(defaultRequirements);
        setFoodBusinessTypes(getFoodBusinessTypes('GB'));
      }
    };

    detectCountryAndSetRequirements();
  }, []);

  // Helper function to check if category requires food handling questions
  const isFoodRelatedCategory = (category) => {
    return category === 'Foods & Goods' || category === 'Meat & Poultry' || category === 'Wholesale';
  };

  const handleCategory = (cat) => {
    if (isFoodRelatedCategory(cat)) {
      setSelectedCategory(cat);
      setShowFoodHandlingQuestion(true);
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
      if (isFoodRelatedCategory(cat)) {
        updateData.handlesFoodPreparation = handlesFoodPreparation;
        updateData.sellsPerishableFood = sellsPerishableFood;
        updateData.dietaryOptions = dietaryOptions;
        
        // Upload food hygiene proof if it's a file
        if (foodHygieneProof && typeof foodHygieneProof !== 'string') {
          const foodHygieneRef = ref(storage, `foodHygieneProofs/${user.uid}_${foodHygieneProof.name}`);
          await uploadBytes(foodHygieneRef, foodHygieneProof);
          const foodHygieneUrl = await getDownloadURL(foodHygieneRef);
          updateData.foodHygieneProof = foodHygieneUrl;
        } else {
          updateData.foodHygieneProof = foodHygieneProof;
        }

        // Upload perishable food proof if it's a file
        if (perishableFoodProof && typeof perishableFoodProof !== 'string') {
          const perishableRef = ref(storage, `perishableFoodProofs/${user.uid}_${perishableFoodProof.name}`);
          await uploadBytes(perishableRef, perishableFoodProof);
          const perishableUrl = await getDownloadURL(perishableRef);
          updateData.perishableFoodProof = perishableUrl;
        } else {
          updateData.perishableFoodProof = perishableFoodProof;
        }

        // Save council registration form data
        updateData.councilRegistrationForm = councilRegistrationForm;
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
        handlesFoodPreparation: handlesFoodPreparation,
        sellsPerishableFood: sellsPerishableFood,
        dietaryOptions: dietaryOptions,
        foodHygieneProof: foodHygieneProof,
        perishableFoodProof: perishableFoodProof,
        councilRegistrationForm: councilRegistrationForm
      } 
    });
  };

  const handleFoodHandlingSubmit = () => {
    setFormError('');
    
    if (handlesFoodPreparation === 'yes') {
      if (!foodHygieneProof) {
        const certificateName = countryRequirements?.certificateName || 'Food Safety Certificate';
        setFormError(`You must upload ${certificateName} to handle food preparation.`);
        return;
      }
      
      // Check if council registration form is completed using country-specific requirements
      if (countryRequirements) {
        const requiredFields = Object.keys(countryRequirements.formFields)
          .filter(fieldKey => countryRequirements.formFields[fieldKey].required);
        const missingFields = requiredFields.filter(field => !councilRegistrationForm[field] || councilRegistrationForm[field].trim() === '');
        
        if (missingFields.length > 0) {
          setFormError(`Please complete all required fields in the ${countryRequirements.registrationFormName}.`);
          return;
        }
      }
    }
    
    if (handlesFoodPreparation === 'no') {
      setShowFoodHandlingQuestion(false);
      setShowFoodQuestion(true);
    } else {
      setShowFoodHandlingQuestion(false);
      setShowDietaryQuestion(true);
    }
  };

  const handleFoodQuestionSubmit = () => {
    setFormError('');
    
    if (sellsPerishableFood === 'yes' && !perishableFoodProof) {
      const docType = perishableFoodRequirements?.documentType || 'cold storage documentation';
      setFormError(`You must upload ${docType.toLowerCase()} to sell perishable food items.`);
      return;
    }
    
    setShowFoodQuestion(false);
    setShowDietaryQuestion(true);
  };

  const handleDietarySubmit = () => {
    proceedWithCategory(selectedCategory);
  };

  const handleDietaryToggle = (option) => {
    setDietaryOptions(prev => {
      if (prev.includes(option)) {
        return prev.filter(item => item !== option);
      } else {
        return [...prev, option];
      }
    });
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#007B7F', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>&larr; Back</button>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
        {!showFoodHandlingQuestion && !showFoodQuestion && !showDietaryQuestion ? (
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
        ) : showFoodHandlingQuestion ? (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>Food Handling Information</h2>
            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Do you handle food items (cutting, cooking, preparation, etc.) at your store?
              </label>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="handlesFoodPreparation"
                    value="yes"
                    checked={handlesFoodPreparation === 'yes'}
                    onChange={(e) => setHandlesFoodPreparation(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Yes, I handle/prepare food items (cutting, cooking, etc.)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="handlesFoodPreparation"
                    value="no"
                    checked={handlesFoodPreparation === 'no'}
                    onChange={(e) => setHandlesFoodPreparation(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  No, I only sell pre-packaged food items
                </label>
              </div>
            </div>
            
            {handlesFoodPreparation === 'yes' && (
              <>
                <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                  <label style={{ color: '#1C1C1C', display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    {countryRequirements?.certificateName || 'Food Safety Certificate'} (Required)
                  </label>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Please upload your {countryRequirements?.certificateDescription || 'food safety certificate'} as you handle food preparation.
                    {userCountry && countryRequirements && (
                      <span style={{ display: 'block', marginTop: '0.5rem', fontStyle: 'italic', color: '#007B7F' }}>
                        Requirements for {countryRequirements.countryName}
                      </span>
                    )}
                  </p>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFoodHygieneProof(e.target.files[0])}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}
                  />
                </div>
                
                <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                  <label style={{ color: '#1C1C1C', display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    {countryRequirements?.registrationFormName || 'Food Business Registration'} (Required)
                  </label>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Please fill out the registration form for food preparation activities.
                    {userCountry && countryRequirements && (
                      <span style={{ display: 'block', marginTop: '0.5rem', fontStyle: 'italic', color: '#007B7F' }}>
                        Form requirements for {countryRequirements.countryName}
                      </span>
                    )}
                  </p>
                  
                  <div style={{ border: '1px solid #B8B8B8', borderRadius: 8, padding: '1.5rem', backgroundColor: '#f9f9f9' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                      {countryRequirements && Object.entries(countryRequirements.formFields).map(([fieldKey, fieldConfig]) => {
                        if (fieldKey === 'typeOfFoodBusiness') {
                          return (
                            <div key={fieldKey}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                                {fieldConfig.label} {fieldConfig.required ? '*' : ''}
                              </label>
                              <select
                                value={councilRegistrationForm[fieldKey] || ''}
                                onChange={(e) => setCouncilRegistrationForm({...councilRegistrationForm, [fieldKey]: e.target.value})}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.9rem' }}
                              >
                                <option value="">Select business type</option>
                                {foodBusinessTypes.map(type => (
                                  <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                              </select>
                            </div>
                          );
                        } else if (fieldKey === 'businessAddress') {
                          return (
                            <div key={fieldKey}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                                {fieldConfig.label} {fieldConfig.required ? '*' : ''}
                              </label>
                              <textarea
                                value={councilRegistrationForm[fieldKey] || ''}
                                onChange={(e) => setCouncilRegistrationForm({...councilRegistrationForm, [fieldKey]: e.target.value})}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.9rem', minHeight: '60px', resize: 'vertical' }}
                                placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                              />
                            </div>
                          );
                        } else if (fieldKey === 'numberOfEmployees') {
                          return (
                            <div key={fieldKey}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                                {fieldConfig.label} {fieldConfig.required ? '*' : ''}
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={councilRegistrationForm[fieldKey] || ''}
                                onChange={(e) => setCouncilRegistrationForm({...councilRegistrationForm, [fieldKey]: e.target.value})}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.9rem' }}
                                placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                              />
                            </div>
                          );
                        } else if (fieldKey === 'phoneNumber') {
                          return (
                            <div key={fieldKey}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                                {fieldConfig.label} {fieldConfig.required ? '*' : ''}
                              </label>
                              <input
                                type="tel"
                                value={councilRegistrationForm[fieldKey] || ''}
                                onChange={(e) => setCouncilRegistrationForm({...councilRegistrationForm, [fieldKey]: e.target.value})}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.9rem' }}
                                placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                              />
                            </div>
                          );
                        } else if (fieldKey === 'emailAddress') {
                          return (
                            <div key={fieldKey}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                                {fieldConfig.label} {fieldConfig.required ? '*' : ''}
                              </label>
                              <input
                                type="email"
                                value={councilRegistrationForm[fieldKey] || ''}
                                onChange={(e) => setCouncilRegistrationForm({...councilRegistrationForm, [fieldKey]: e.target.value})}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.9rem' }}
                                placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                              />
                            </div>
                          );
                        } else {
                          return (
                            <div key={fieldKey}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                                {fieldConfig.label} {fieldConfig.required ? '*' : ''}
                              </label>
                              <input
                                type="text"
                                value={councilRegistrationForm[fieldKey] || ''}
                                onChange={(e) => setCouncilRegistrationForm({...councilRegistrationForm, [fieldKey]: e.target.value})}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.9rem' }}
                                placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                              />
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {formError && (
              <div style={{ color: '#D92D20', marginBottom: '1rem', textAlign: 'left' }}>
                {formError}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowFoodHandlingQuestion(false);
                  setSelectedCategory('');
                  setHandlesFoodPreparation('');
                  setFoodHygieneProof(null);
                  setPerishableFoodProof(null);
                  setCouncilRegistrationForm({
                    businessName: '',
                    businessAddress: '',
                    contactPerson: '',
                    phoneNumber: '',
                    emailAddress: '',
                    typeOfFoodBusiness: '',
                    operatingHours: '',
                    numberOfEmployees: '',
                    foodSafetyOfficer: '',
                    dateOfApplication: ''
                  });
                  setFormError('');
                }}
                style={{ flex: 1, background: '#B8B8B8', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={handleFoodHandlingSubmit}
                disabled={!handlesFoodPreparation}
                style={{ 
                  flex: 1, 
                  background: handlesFoodPreparation ? '#007B7F' : '#B8B8B8', 
                  color: '#fff', 
                  padding: '1rem', 
                  border: 'none', 
                  borderRadius: 8, 
                  fontWeight: 'bold', 
                  fontSize: '1rem', 
                  cursor: handlesFoodPreparation ? 'pointer' : 'not-allowed' 
                }}
              >
                Continue
              </button>
            </div>
          </div>
        ) : showFoodQuestion ? (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>
              {countryRequirements ? `Food Safety Requirements - ${countryRequirements.countryName}` : 'Food Safety Information'}
            </h2>
            
            {countryRequirements && userCountry && (
              <div style={{ 
                background: '#e3f2fd', 
                border: '1px solid #2196f3', 
                borderRadius: '8px', 
                padding: '1rem', 
                marginBottom: '1.5rem',
                fontSize: '0.9rem'
              }}>
                <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: 'bold', color: '#1565c0' }}>
                  📍 Requirements for {countryRequirements.countryName}:
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#1976d2' }}>
                  <li>Food businesses must have a valid <strong>{countryRequirements.certificateName}</strong></li>
                  <li>Registration with local authorities through <strong>{countryRequirements.registrationFormName}</strong></li>
                  <li>Compliance with {countryRequirements.countryName} food safety standards and regulations</li>
                  {countryRequirements.formFields.foodSafetyOfficer && (
                    <li>Designated Food Safety Officer required for your establishment</li>
                  )}
                  {countryRequirements.formFields.publicHealthOfficer && (
                    <li>Public Health Officer contact and approval required</li>
                  )}
                  {countryRequirements.formFields.healthInspector && (
                    <li>Health Inspector contact and regular inspections required</li>
                  )}
                </ul>
              </div>
            )}
            
            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Do you sell meat, chicken, fish, or other perishable food items that require special storage and handling?
              </label>
              
              {countryRequirements && foodSafetyInfo && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                    In {countryRequirements.countryName}, businesses selling perishable foods must comply with <strong>{foodSafetyInfo.authority}</strong> requirements.
                  </p>
                  {perishableExamples.length > 0 && (
                    <div style={{ 
                      background: '#f8f9fa', 
                      border: '1px solid #dee2e6', 
                      borderRadius: '6px', 
                      padding: '0.75rem',
                      fontSize: '0.85rem'
                    }}>
                      <strong style={{ color: '#495057' }}>Common perishable foods in {countryRequirements.countryName}:</strong>
                      <div style={{ marginTop: '0.25rem', color: '#6c757d' }}>
                        {perishableExamples.join(' • ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #f39c12', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  marginBottom: '1rem'
                }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#e67e22', fontSize: '1rem' }}>
                    ⚠️ Perishable Food Safety Requirements
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#d68910' }}>
                    Since you're selling perishable foods, you must meet additional safety requirements to protect public health.
                  </p>
                </div>
                
                <label style={{ color: '#1C1C1C', display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {perishableFoodRequirements?.documentType || 'Cold Storage Documentation'} (Required)
                </label>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {perishableFoodRequirements ? (
                    <>
                      Please upload your <strong>{perishableFoodRequirements.description}</strong> to demonstrate proper cold storage capabilities for perishable foods.
                      <br/>
                      <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#888' }}>
                        This shows you have adequate refrigeration facilities to maintain food safety standards for perishable items.
                      </span>
                    </>
                  ) : (
                    'Please upload documentation showing you have proper cold storage facilities for perishable food items.'
                  )}
                </p>
                
                {perishableFoodRequirements && (
                  <div style={{ 
                    background: '#f8f9fa', 
                    border: '1px solid #dee2e6', 
                    borderRadius: '6px', 
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}>
                    <strong style={{ color: '#495057' }}>✅ Acceptable Documentation:</strong>
                    <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', color: '#6c757d' }}>
                      {perishableFoodRequirements.alternativeOptions.map((option, index) => (
                        <li key={index}>{option}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setPerishableFoodProof(e.target.files[0])}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}
                />
                
                {countryRequirements && foodSafetyInfo && (
                  <div>
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '0.75rem', 
                      background: '#f0f8ff', 
                      border: '1px solid #b3d9ff', 
                      borderRadius: '6px',
                      fontSize: '0.85rem'
                    }}>
                      <strong style={{ color: '#2c5aa0' }}>💡 {countryRequirements.countryName} Specific Requirements:</strong>
                      <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', color: '#2c5aa0' }}>
                        <li>Certificate must be issued by recognized authorities in {countryRequirements.countryName}</li>
                        <li>Valid certification for handling perishable foods (meat, fish, dairy, etc.)</li>
                        <li>Compliance with local health department standards</li>
                        {userCountry === 'NG' && <li>NAFDAC approval required for food business operations</li>}
                        {userCountry === 'GH' && <li>FDA Ghana certification for food safety compliance</li>}
                        {userCountry === 'JM' && <li>Ministry of Health Jamaica food handler permit required</li>}
                        {userCountry === 'TT' && <li>Municipal Corporation health clearance needed</li>}
                        {userCountry === 'ZA' && <li>Municipal health department approval required</li>}
                        {userCountry === 'KE' && <li>County Public Health Officer clearance needed</li>}
                      </ul>
                    </div>
                    
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '1rem', 
                      background: '#fff8e1', 
                      border: '1px solid #ffb74d', 
                      borderRadius: '8px',
                      fontSize: '0.9rem'
                    }}>
                      <h4 style={{ margin: '0 0 0.75rem 0', color: '#f57c00', fontSize: '1rem' }}>
                        📊 {countryRequirements.countryName} Food Safety Standards
                      </h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div>
                          <strong style={{ color: '#e65100' }}>🌡️ Temperature Requirements:</strong>
                          <p style={{ margin: '0.25rem 0', color: '#bf360c' }}>{foodSafetyInfo.temperatureRequirements}</p>
                        </div>
                        <div>
                          <strong style={{ color: '#e65100' }}>🔍 Inspection Frequency:</strong>
                          <p style={{ margin: '0.25rem 0', color: '#bf360c' }}>{foodSafetyInfo.inspectionFrequency}</p>
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ color: '#e65100' }}>📋 Key Requirements:</strong>
                        <ul style={{ margin: '0.25rem 0', paddingLeft: '1.2rem', color: '#d84315' }}>
                          {foodSafetyInfo.keyRequirements.map((req, index) => (
                            <li key={index}>{req}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div style={{ 
                        padding: '0.5rem', 
                        background: '#ffccbc', 
                        borderRadius: '4px',
                        fontSize: '0.85rem'
                      }}>
                        <strong style={{ color: '#d84315' }}>⚖️ Penalties for Non-Compliance:</strong>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#bf360c' }}>{foodSafetyInfo.penalties}</p>
                      </div>
                    </div>
                  </div>
                )}
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
                  setShowFoodHandlingQuestion(false);
                  setSelectedCategory('');
                  setSellsPerishableFood('');
                  setHandlesFoodPreparation('');
                  setFoodHygieneProof(null);
                  setPerishableFoodProof(null);
                  setCouncilRegistrationForm({
                    businessName: '',
                    businessAddress: '',
                    contactPerson: '',
                    phoneNumber: '',
                    emailAddress: '',
                    typeOfFoodBusiness: '',
                    operatingHours: '',
                    numberOfEmployees: '',
                    foodSafetyOfficer: '',
                    dateOfApplication: ''
                  });
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
        ) : showDietaryQuestion ? (
          <div>
            <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>What dietary options does your store offer?</h2>
            <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '2rem', textAlign: 'left' }}>
              Select all dietary options that your store can accommodate. This helps customers find stores that match their dietary preferences.
            </p>
            
            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
              {DIETARY_OPTIONS.map(option => (
                <label 
                  key={option} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '0.75rem', 
                    cursor: 'pointer',
                    padding: '0.75rem',
                    border: dietaryOptions.includes(option) ? '2px solid #007B7F' : '2px solid #E5E5E5',
                    borderRadius: '8px',
                    backgroundColor: dietaryOptions.includes(option) ? '#F0F9F9' : '#fff',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={dietaryOptions.includes(option)}
                    onChange={() => handleDietaryToggle(option)}
                    style={{ 
                      marginRight: '0.75rem',
                      width: '18px',
                      height: '18px',
                      accentColor: '#007B7F'
                    }}
                  />
                  <span style={{ 
                    fontWeight: dietaryOptions.includes(option) ? '600' : '400',
                    color: dietaryOptions.includes(option) ? '#007B7F' : '#1C1C1C'
                  }}>
                    {option}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowDietaryQuestion(false);
                  setShowFoodQuestion(true);
                  setDietaryOptions([]);
                }}
                style={{ 
                  flex: 1, 
                  background: '#B8B8B8', 
                  color: '#fff', 
                  padding: '1rem', 
                  border: 'none', 
                  borderRadius: 8, 
                  fontWeight: 'bold', 
                  fontSize: '1rem', 
                  cursor: 'pointer' 
                }}
              >
                Back
              </button>
              <button
                onClick={handleDietarySubmit}
                style={{ 
                  flex: 1, 
                  background: '#007B7F', 
                  color: '#fff', 
                  padding: '1rem', 
                  border: 'none', 
                  borderRadius: 8, 
                  fontWeight: 'bold', 
                  fontSize: '1rem', 
                  cursor: 'pointer' 
                }}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default OnboardingSellCategoryPage; 