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
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');
  const [addressError, setAddressError] = useState('');
  const navigate = useNavigate();

  const handleChange = (option) => {
    if (selected.includes(option)) {
      setSelected(selected.filter(o => o !== option));
    } else {
      setSelected([...selected, option]);
    }
  };

  const handleContinue = async () => {
    if (!street.trim() || !city.trim() || !country.trim()) {
      setAddressError('Full address is required.');
      return;
    }
    setAddressError('');
    // Geocode address
    const fullAddress = `${street}, ${city}, ${stateRegion}, ${zip}, ${country}`;
    let lat = null, lon = null;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          lat = data[0].lat;
          lon = data[0].lon;
        }
      }
    } catch {}
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
        });
      }
      await updateDoc(userRef, { onboardingStep: 'create-profile' });
    }
    navigate('/create-profile', { state: { fullAddress, latitude: lat, longitude: lon } });
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
          <div style={{ marginTop: 24 }}>
            <label>Street Address *</label>
            <input type="text" value={street} onChange={e => setStreet(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} required />
          </div>
          <div style={{ marginTop: 12 }}>
            <label>City *</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} required />
          </div>
          <div style={{ marginTop: 12 }}>
            <label>State/Province/Region</label>
            <input type="text" value={stateRegion} onChange={e => setStateRegion(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Zip/Postal Code</label>
            <input type="text" value={zip} onChange={e => setZip(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Country *</label>
            <input type="text" value={country} onChange={e => setCountry(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} required />
          </div>
          {addressError && <div style={{ color: 'red', marginTop: 8 }}>{addressError}</div>}
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