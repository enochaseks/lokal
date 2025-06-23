import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { getAuth } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function CreateProfilePage() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
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
      // Save profile to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name,
        location,
        photoURL,
        uid: user.uid,
        email: user.email || '',
        createdAt: new Date().toISOString(),
      });
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
            <label style={{ fontWeight: 600 }}>Location (optional)</label><br />
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
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