import React, { useState } from 'react';
import { useNavigate } from 'react-router';

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
    if (selected.includes(option)) {
      setSelected(selected.filter(o => o !== option));
    } else {
      setSelected([...selected, option]);
    }
  };

  const handleContinue = () => {
    // TODO: Save selected options to user profile or context if needed
    navigate('/create-profile'); // Go to Create Profile page after selection
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#007B7F', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>&larr; Back</button>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
        <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>Click the type of shopping you are looking to do</h2>
        <form style={{ textAlign: 'left', marginBottom: '2rem' }}>
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
        </form>
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