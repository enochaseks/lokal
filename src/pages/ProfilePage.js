import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getAuth, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, collectionGroup, onSnapshot, updateDoc } from 'firebase/firestore';
import Navbar from '../components/Navbar';

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [city, setCity] = useState('');
  const [userCategories, setUserCategories] = useState([]);
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = not logged in, object = logged in
  const [followingStores, setFollowingStores] = useState([]);
  const [followingLoading, setFollowingLoading] = useState(true);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authUser === undefined) return; // Wait for auth to load
    if (!authUser) {
      setLoading(false);
      setError('Not logged in');
      return;
    }
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const docRef = doc(db, 'users', authUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
          if (docSnap.data().categories) setUserCategories(docSnap.data().categories);
        } else {
          setError('Profile not found.');
        }
      } catch (err) {
        setError('Error loading profile: ' + err.message);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [authUser]);

  useEffect(() => {
    // Real-time following list
    if (!authUser) return;
    setFollowingLoading(true);
    const q = query(collectionGroup(db, 'followers'), where('uid', '==', authUser.uid));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const storeIds = snap.docs.map(doc => doc.ref.parent.parent.id);
      const stores = [];
      for (const id of storeIds) {
        const storeDoc = await getDoc(doc(db, 'stores', id));
        if (storeDoc.exists()) {
          stores.push({ id, ...storeDoc.data() });
        }
      }
      setFollowingStores(stores);
      setFollowingLoading(false);
    });
    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!profile || !authUser) return;
    if (!localStorage.getItem('shownNearbyStoresModal')) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`
            )
              .then((res) => res.json())
              .then((data) => {
                const cityName =
                  data.address.city ||
                  data.address.town ||
                  data.address.village ||
                  data.address.state ||
                  '';
                setCity(cityName);
                setShowModal(true);
                setStoresLoading(true);
                fetchStores(cityName);
                localStorage.setItem('shownNearbyStoresModal', 'true');
              });
          },
          (error) => {
            if (profile.location) {
              setCity(profile.location);
              setShowModal(true);
              setStoresLoading(true);
              fetchStores(profile.location);
              localStorage.setItem('shownNearbyStoresModal', 'true');
            }
          }
        );
      } else if (profile.location) {
        setCity(profile.location);
        setShowModal(true);
        setStoresLoading(true);
        fetchStores(profile.location);
        localStorage.setItem('shownNearbyStoresModal', 'true');
      }
    }
    // eslint-disable-next-line
  }, [profile, authUser]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditLocation(profile.location || '');
      setEditPhoto(profile.photoURL || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!showEditModal || !editLocation) {
      setLocationSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(editLocation)}`)
        .then(res => res.json())
        .then(data => {
          setLocationSuggestions(data.map(place => place.display_name));
        });
    }, 300); // debounce
    return () => clearTimeout(timeout);
  }, [editLocation, showEditModal]);

  // Haversine formula to calculate distance between two lat/lon points
  function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  // Geocode a location string to lat/lon using Nominatim
  async function geocodeLocation(location) {
    if (!location) return null;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  }

  const fetchStores = async (cityName) => {
    try {
      let q = query(collection(db, 'stores'), where('live', '==', true));
      const querySnapshot = await getDocs(q);
      let filtered = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Geocode buyer's location
      const buyerLoc = await geocodeLocation(profile?.location || cityName);
      if (!buyerLoc) {
        setNearbyStores([]);
        setStoresLoading(false);
        return;
      }
      // For each store, use lat/lon if present, else geocode, and filter by 30 KM
      const storesWithin30km = [];
      for (const store of filtered) {
        let storeLat = store.latitude, storeLon = store.longitude;
        let storeLoc = null;
        if (storeLat == null || storeLon == null) {
          // Geocode if missing
          storeLoc = await geocodeLocation(store.storeLocation);
          if (!storeLoc) continue;
          storeLat = storeLoc.lat;
          storeLon = storeLoc.lon;
        }
        const dist = getDistanceFromLatLonInKm(buyerLoc.lat, buyerLoc.lon, storeLat, storeLon);
        if (dist <= 30) {
          storesWithin30km.push({ ...store, distance: dist });
        }
      }
      // Optionally sort by distance
      storesWithin30km.sort((a, b) => a.distance - b.distance);
      setNearbyStores(storesWithin30km);
    } catch (err) {
      setNearbyStores([]);
    }
    setStoresLoading(false);
  };

  const name = profile?.name || '';
  const location = profile?.location || '';
  const photoURL = profile?.photoURL || '';

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditError('Name is required.');
      return;
    }
    if (!editLocation.trim()) {
      setEditError('Location is required.');
      return;
    }
    setEditError('');
    setEditLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      await updateDoc(doc(db, 'users', user.uid), {
        name: editName,
        location: editLocation,
      });
      await updateProfile(user, { displayName: editName });
      setProfile(prev => ({ ...prev, name: editName, location: editLocation }));
      setShowEditModal(false);
    } catch (err) {
      setEditError('Error updating profile: ' + err.message);
    }
    setEditLoading(false);
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center' }}>
        <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>Your Profile</h2>
        {authUser === undefined || loading ? (
          <div style={{ color: '#888', margin: '2rem 0' }}>Loading...</div>
        ) : error ? (
          <div style={{ color: 'red', margin: '2rem 0' }}>{`Error loading profile: ${error}`}</div>
        ) : (
          <>
            {photoURL ? (
              <img src={photoURL} alt="profile" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 20 }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#eee', margin: '0 auto 20px' }} />
            )}
            <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 10 }}>{name || 'No name set'}</div>
            <div style={{ color: '#888', fontSize: '1rem', marginBottom: 10 }}>{location || 'No location set'}</div>
            {/* Message and Following section */}
            <div style={{ margin: '1.5rem 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div>
                <button
                  style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginRight: 12, cursor: 'pointer' }}
                  onClick={() => navigate('/messages')}
                >
                  Messages
                </button>
                <button
                  style={{ fontWeight: 600, fontSize: '1.1rem', color: '#007B7F', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setShowFollowingModal(true)}
                  disabled={followingLoading}
                >
                  Following: {followingLoading ? '...' : followingStores.length}
                </button>
              </div>
            </div>
            <button
              style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginBottom: 16, cursor: 'pointer' }}
              onClick={handleEditProfile}
            >
              Edit Profile
            </button>
          </>
        )}
      </div>
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px #0008', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: 8, right: 8, background: '#eee', border: 'none', borderRadius: '50%', width: 28, height: 28, fontSize: 18, cursor: 'pointer' }}>×</button>
            <h3 style={{ marginBottom: 18, color: '#007B7F' }}>Nearby Stores</h3>
            {storesLoading ? (
              <div style={{ color: '#888' }}>Loading stores...</div>
            ) : nearbyStores.length === 0 ? (
              <div style={{ color: '#888' }}>No stores found near your location.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {nearbyStores.map(store => (
                  <li key={store.id} style={{ marginBottom: 14, padding: 10, border: '1px solid #eee', borderRadius: 8, background: '#fafbfc', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>{store.storeName}</div>
                    <div style={{ color: '#888', fontSize: '0.95em' }}>{store.storeLocation}</div>
                    <button onClick={() => navigate(`/store-preview/${store.id}`)} style={{ marginTop: 6, background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.8rem', fontWeight: 600, cursor: 'pointer', fontSize: '1em' }}>View Store</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {/* Modal for following stores */}
      {showFollowingModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px #0008', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowFollowingModal(false)} style={{ position: 'absolute', top: 8, right: 8, background: '#eee', border: 'none', borderRadius: '50%', width: 28, height: 28, fontSize: 18, cursor: 'pointer' }}>×</button>
            <h3 style={{ marginBottom: 18, color: '#007B7F' }}>Following Stores</h3>
            {followingLoading ? (
              <div style={{ color: '#888' }}>Loading...</div>
            ) : followingStores.length === 0 ? (
              <div style={{ color: '#888' }}>You are not following any stores.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {followingStores.map(store => (
                  <li key={store.id} style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      onClick={() => { setShowFollowingModal(false); navigate(`/store-preview/${store.id}`); }}>
                    <img src={store.backgroundImg || 'https://via.placeholder.com/40'} alt={store.storeName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontWeight: 600 }}>{store.storeName}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw', textAlign: 'center', position: 'relative' }}>
            <h3 style={{ marginBottom: 18, color: '#007B7F' }}>Edit Profile</h3>
            <form onSubmit={handleEditSave}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600 }}>Name *</label><br />
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} required />
              </div>
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <label style={{ fontWeight: 600 }}>Location *</label><br />
                <input
                  type="text"
                  value={editLocation}
                  onChange={e => {
                    setEditLocation(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => setShowSuggestions(true)}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  required
                  autoComplete="off"
                />
                {showSuggestions && locationSuggestions.length > 0 && (
                  <ul style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 56,
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    maxHeight: 180,
                    overflowY: 'auto',
                    zIndex: 10,
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    boxShadow: '0 2px 8px #0002'
                  }}>
                    {locationSuggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        onMouseDown={() => {
                          setEditLocation(suggestion);
                          setShowSuggestions(false);
                        }}
                        style={{ cursor: 'pointer', padding: 8, borderBottom: idx !== locationSuggestions.length - 1 ? '1px solid #eee' : 'none', background: '#fff' }}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {editError && <div style={{ color: 'red', marginBottom: 12 }}>{editError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }} disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage; 