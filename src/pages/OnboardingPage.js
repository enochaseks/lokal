import React from 'react';
import { useNavigate } from 'react-router';

function OnboardingPage() {
  const navigate = useNavigate();
  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#007B7F', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>&larr; Back</button>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
        <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>Why are you on Lokal?</h2>
        <button style={{ width: '100%', background: '#D92D20', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', cursor: 'pointer' }}
          onClick={() => navigate('/onboarding-sell-category')}
        >
          I want to sell
        </button>
        <button style={{ width: '100%', background: '#007B7F', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
          onClick={() => navigate('/onboarding-shop-type')}
        >
          I am looking to shop around
        </button>
      </div>
    </div>
  );
}

export default OnboardingPage; 