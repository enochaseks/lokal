import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function CreateProfilePage() {
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    setProfilePic(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreview('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!street.trim() || !city.trim() || !country.trim()) {
      setError('Full address is required.');
      return;
    }
    if (!profilePic) {
      setError('Profile picture is required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      // Upload profile picture
      const picRef = ref(storage, `userProfiles/${user.uid}/${profilePic.name}`);
      await uploadBytes(picRef, profilePic);
      const photoURL = await getDownloadURL(picRef);
      // Combine address fields
      const fullAddress = `${street}, ${city}, ${stateRegion}, ${zip}, ${country}`;
      // Geocode address
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
      // Get existing user data to preserve preferences and shopping data
      const { getDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', user.uid);
      const existingData = await getDoc(userRef);
      const userData = existingData.exists() ? existingData.data() : {};
      
      // Save complete profile to Firestore (preserving existing data)
      await setDoc(userRef, {
        ...userData, // Preserve existing data (preferences, shoppingPreferences, etc.)
        name,
        location: fullAddress,
        latitude: lat,
        longitude: lon,
        photoURL,
        uid: user.uid,
        email: user.email || '',
        createdAt: userData.createdAt || new Date().toISOString(),
        profileCompletedAt: new Date().toISOString(),
        userType: 'buyer', // Explicitly maintain buyer type
        onboardingStep: 'complete'
      });
      
      // Clear user type cache to force fresh detection
      const cacheKey = `userType_${user.uid}`;
      localStorage.removeItem(cacheKey);
      setLoading(false);
      navigate('/profile');
    } catch (err) {
      setLoading(false);
      setError('Error creating profile: ' + err.message);
    }
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#007B7F', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>&larr; Back</button>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
        <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>Create Your Profile</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>Profile Picture *</label><br />
            <input type="file" accept="image/*" onChange={handlePicChange} />
            {preview && <img src={preview} alt="preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginTop: 10 }} />}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>Name *</label><br />
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>Street Address *</label><br />
            <input type="text" value={street} onChange={e => setStreet(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>City *</label><br />
            <input type="text" value={city} onChange={e => setCity(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>State/Province/Region</label><br />
            <input type="text" value={stateRegion} onChange={e => setStateRegion(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>Zip/Postal Code</label><br />
            <input type="text" value={zip} onChange={e => setZip(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>Country *</label><br />
            <input type="text" value={country} onChange={e => setCountry(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} required />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
          <button type="submit" style={{ width: '100%', background: '#007B7F', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.1rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateProfilePage; 