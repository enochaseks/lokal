import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, collectionGroup, onSnapshot } from 'firebase/firestore';
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

  const fetchStores = async (cityName) => {
    try {
      let q = query(collection(db, 'stores'), where('live', '==', true));
      const querySnapshot = await getDocs(q);
      let filtered = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(store =>
          store.storeLocation &&
          cityName &&
          store.storeLocation.toLowerCase().includes(cityName.toLowerCase())
        );
      if (userCategories && userCategories.length > 0) {
        filtered = filtered.filter(store =>
          store.category && userCategories.includes(store.category)
        );
      }
      setNearbyStores(filtered);
    } catch (err) {
      setNearbyStores([]);
    }
    setStoresLoading(false);
  };

  const name = profile?.name || '';
  const location = profile?.location || '';
  const photoURL = profile?.photoURL || '';

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
                <button style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginRight: 12, cursor: 'pointer' }}>Message</button>
                <button
                  style={{ fontWeight: 600, fontSize: '1.1rem', color: '#007B7F', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setShowFollowingModal(true)}
                  disabled={followingLoading}
                >
                  Following: {followingLoading ? '...' : followingStores.length}
                </button>
              </div>
            </div>
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
    </div>
  );
}

export default ProfilePage; 