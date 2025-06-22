import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, getDoc, collection, addDoc, getDocs, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function StoreProfilePage() {
  const location = useLocation();
  const data = location.state || {};
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [storeItems, setStoreItems] = useState([]);
  const [itemImage, setItemImage] = useState(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCurrency, setItemCurrency] = useState('GBP');
  const [itemQuality, setItemQuality] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [followers, setFollowers] = useState(0);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editThumbnail, setEditThumbnail] = useState(null);
  const [editDeliveryType, setEditDeliveryType] = useState('');
  const [editOpeningTime, setEditOpeningTime] = useState('');
  const [editClosingTime, setEditClosingTime] = useState('');

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError('Not logged in');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const docRef = doc(db, 'stores', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
          setEditName(docSnap.data().storeName || '');
          setEditLocation(docSnap.data().storeLocation || '');
          setEditOrigin(docSnap.data().origin || '');
          setEditDeliveryType(docSnap.data().deliveryType || '');
          setEditOpeningTime(docSnap.data().openingTime || '');
          setEditClosingTime(docSnap.data().closingTime || '');
        } else {
          setError('Store profile not found.');
        }
        // Fetch items
        const itemsCol = collection(db, 'stores', user.uid, 'items');
        const itemsSnap = await getDocs(itemsCol);
        setStoreItems(itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!itemName || !itemPrice || !itemQuality || !itemQuantity) return;
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      let imageUrl = '';
      if (itemImage) {
        const imgRef = ref(storage, `storeItems/${user.uid}_${Date.now()}_${itemImage.name}`);
        await uploadBytes(imgRef, itemImage);
        imageUrl = await getDownloadURL(imgRef);
      }
      const itemData = {
        name: itemName,
        price: itemPrice,
        currency: itemCurrency,
        quality: itemQuality,
        quantity: itemQuantity,
        image: imageUrl,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'stores', user.uid, 'items'), itemData);
      setShowAddModal(false);
      setItemImage(null);
      setItemName('');
      setItemPrice('');
      setItemCurrency('GBP');
      setItemQuality('');
      setItemQuantity('');
      // Re-fetch items
      const itemsCol = collection(db, 'stores', user.uid, 'items');
      const itemsSnap = await getDocs(itemsCol);
      setStoreItems(itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      alert('Error adding item: ' + err.message);
    }
    setLoading(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      let thumbnailUrl = profile.backgroundImg || '';
      if (editThumbnail) {
        const imgRef = ref(storage, `storeBanners/${user.uid}_${editThumbnail.name}`);
        await uploadBytes(imgRef, editThumbnail);
        thumbnailUrl = await getDownloadURL(imgRef);
      }
      const docRef = doc(db, 'stores', user.uid);
      await updateDoc(docRef, {
        storeName: editName,
        storeLocation: editLocation,
        origin: editOrigin,
        backgroundImg: thumbnailUrl,
        deliveryType: editDeliveryType,
        openingTime: editOpeningTime,
        closingTime: editClosingTime,
      });
      setShowEditProfile(false);
      // Re-fetch profile
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setProfile(docSnap.data());
    } catch (err) {
      alert('Error updating profile: ' + err.message);
    }
    setLoading(false);
  };

  // Helper to show image preview if file exists
  const renderImage = (file) => {
    if (!file) return null;
    if (typeof file === 'string') {
      return <img src={file} alt="" style={{ maxWidth: 180, maxHeight: 180, borderRadius: 12, marginBottom: 16, objectFit: 'cover' }} />;
    }
    return <img src={URL.createObjectURL(file)} alt="" style={{ maxWidth: 180, maxHeight: 180, borderRadius: 12, marginBottom: 16, objectFit: 'cover' }} />;
  };

  // Add a helper to check if the store can go live
  const canGoLive =
    profile &&
    profile.backgroundImg &&
    profile.storeName &&
    profile.storeLocation &&
    profile.origin &&
    profile.deliveryType &&
    storeItems.length > 0;

  const handleGoLive = async () => {
    if (!canGoLive) return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const docRef = doc(db, 'stores', user.uid);
    await updateDoc(docRef, { live: true });
    setProfile(prev => ({ ...prev, live: true }));
  };

  const handleGoOffline = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const docRef = doc(db, 'stores', user.uid);
    await updateDoc(docRef, { live: false });
    setProfile(prev => ({ ...prev, live: false }));
  };

  if (loading) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', marginTop: 80 }}>Loading profile...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', marginTop: 80, color: '#D92D20' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {/* Banner: show backgroundImg if present, else colored banner */}
        <div style={{ width: '100%', height: 180, background: profile.backgroundImg ? 'none' : '#cfc6f7', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {profile.backgroundImg ? (
            <img src={profile.backgroundImg} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
          {/* Go live or live/offline button on the right */}
          {profile.live ? (
            <button
              style={{ position: 'absolute', right: 24, top: 24, background: '#D92D20', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', zIndex: 2 }}
              onClick={handleGoOffline}
              title="Click to go offline"
            >
              Store is live (Turn off)
            </button>
          ) : (
            <button
              style={{ position: 'absolute', right: 24, top: 24, background: canGoLive ? '#D92D20' : '#ccc', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem', fontWeight: 700, fontSize: '1rem', cursor: canGoLive ? 'pointer' : 'not-allowed', zIndex: 2 }}
              onClick={handleGoLive}
              disabled={!canGoLive}
              title={canGoLive ? '' : 'Add all required info and at least one item to go live'}
            >
              Go live
            </button>
          )}
        </div>
        {/* Title and details below banner */}
        <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.2rem 1.2rem 1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginTop: -30, marginBottom: 24, position: 'relative' }}>
          {/* Title and origin in the same row, title left, origin right */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: '1.1rem', color: '#222', letterSpacing: '0.2px' }}>{profile.storeName || 'Store Profile'}</span>
            {profile.origin && (
              <span style={{ fontSize: '0.92rem', color: '#888', fontWeight: 500 }}>Origin: {profile.origin}</span>
            )}
            {/* Edit Button */}
            <button
              style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 1rem', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', marginLeft: 10 }}
              onClick={() => setShowEditProfile(true)}
            >
              Edit
            </button>
          </div>
          {/* Location */}
          {profile.storeLocation && (
            <div style={{ width: '100%', textAlign: 'left', fontSize: '0.95rem', color: '#444', marginBottom: 4, wordBreak: 'break-word' }}>
              <span style={{ fontWeight: 500 }}>Location:</span> {profile.storeLocation}
            </div>
          )}
          {/* Opening/Closing Time and Status */}
          <div style={{ width: '100%', fontSize: '0.98rem', color: '#007B7F', marginBottom: 8 }}>
            <b>Opening Time:</b> {profile.openingTime || '--:--'} &nbsp; <b>Closing Time:</b> {profile.closingTime || '--:--'}
            <span style={{ marginLeft: 16, fontWeight: 600, color: isStoreOpen(profile.openingTime, profile.closingTime) ? '#3A8E3A' : '#D92D20' }}>
              {isStoreOpen(profile.openingTime, profile.closingTime) ? 'Open Now' : 'Closed Now'}
            </span>
          </div>
          {/* Messages and Followers row */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 8px 0' }}>
            <button style={{ background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <span role="img" aria-label="messages">💬</span> Messages
            </button>
            <button style={{ background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => setFollowers(followers + 1)}>
              <span role="img" aria-label="followers">👥</span> Followers ({followers})
            </button>
          </div>
          {/* Store item tab/button */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', gap: 8, marginTop: 32 }}>
            <button style={{ flex: 1, background: '#f6f6fa', border: 'none', borderRadius: 12, padding: '1rem', fontSize: '1rem', color: '#007B7F', fontWeight: 600, boxShadow: '0 1px 4px #ececec', cursor: 'pointer', letterSpacing: '0.5px' }}>Store item</button>
            <button onClick={() => setShowAddModal(true)} style={{ background: '#fff', border: '1.5px solid #007B7F', borderRadius: 12, padding: '1rem 1.2rem', fontSize: '1rem', color: '#007B7F', fontWeight: 600, boxShadow: '0 1px 4px #ececec', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span role="img" aria-label="add">➕</span> Add items
            </button>
          </div>
          {/* Store items list */}
          {storeItems.length > 0 && (
            <div style={{ width: '100%', marginTop: 24 }}>
              <h4 style={{ fontSize: '1rem', color: '#222', marginBottom: 10 }}>Store Items</h4>
              {storeItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, background: '#f6f6fa', borderRadius: 10, padding: '0.7rem 1rem' }}>
                  {item.image && <img src={item.image} alt="item" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.98rem', color: '#222' }}>{item.name}</div>
                    <div style={{ fontSize: '0.95rem', color: '#444' }}>{item.price} {item.currency}</div>
                    <div style={{ fontSize: '0.92rem', color: '#666' }}>Quality: {item.quality} | Quantity: {item.quantity}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Delivery Info Box */}
          {profile.deliveryType && (
            <div style={{ width: '100%', background: '#f6f6fa', borderRadius: 10, padding: '0.7rem 1rem', color: '#007B7F', fontSize: '0.98rem', marginTop: 18, marginBottom: 0 }}>
              <b>Delivery Type:</b> {profile.deliveryType}
            </div>
          )}
        </div>
        {/* Add Item Modal */}
        {showAddModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>Add Store Item</h3>
              <form onSubmit={handleAddItem}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Image</label>
                  <input type="file" accept="image/*" onChange={e => setItemImage(e.target.files[0])} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Item Name</label>
                  <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Price</label>
                    <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required min="0" step="0.01" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Currency</label>
                    <select value={itemCurrency} onChange={e => setItemCurrency(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}>
                      <option value="GBP">£ (GBP)</option>
                      <option value="NGN">₦ (NGN)</option>
                      <option value="EUR">€ (EUR)</option>
                      <option value="USD">$ (USD)</option>
                      <option value="CAD">C$ (CAD)</option>
                      <option value="AUD">A$ (AUD)</option>
                      <option value="ZAR">R (ZAR)</option>
                      <option value="GHS">₵ (GHS)</option>
                      <option value="KES">KSh (KES)</option>
                      <option value="XOF">CFA (XOF)</option>
                      <option value="XAF">CFA (XAF)</option>
                      <option value="INR">₹ (INR)</option>
                      <option value="JPY">¥ (JPY)</option>
                      <option value="CNY">¥ (CNY)</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Quality</label>
                  <select value={itemQuality} onChange={e => setItemQuality(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                    <option value="" disabled>Select quality</option>
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Quantity</label>
                  <select value={itemQuantity} onChange={e => setItemQuantity(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                    <option value="" disabled>Select quantity</option>
                    {[...Array(100)].map((_, i) => (
                      <option key={i+1} value={i+1}>{i+1}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ background: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Add</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showEditProfile && profile && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>Edit Store Profile</h3>
              <form onSubmit={handleSaveProfile}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Store Name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Location</label>
                  <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Origin</label>
                  <input type="text" value={editOrigin} onChange={e => setEditOrigin(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Delivery Type</label>
                  <select
                    value={editDeliveryType}
                    onChange={e => setEditDeliveryType(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}
                    required
                  >
                    <option value="">Select delivery type</option>
                    <option value="Collection">Collection</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Opening Time</label>
                  <input type="time" value={editOpeningTime} onChange={e => setEditOpeningTime(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Closing Time</label>
                  <input type="time" value={editClosingTime} onChange={e => setEditClosingTime(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Thumbnail</label>
                  <input type="file" accept="image/*" onChange={e => setEditThumbnail(e.target.files[0])} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button type="button" onClick={() => setShowEditProfile(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ background: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function isStoreOpen(opening, closing) {
  if (!opening || !closing) return false;
  const now = new Date();
  const [openH, openM] = opening.split(':').map(Number);
  const [closeH, closeM] = closing.split(':').map(Number);
  const openDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openH, openM);
  const closeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeH, closeM);
  return now >= openDate && now <= closeDate;
}

export default StoreProfilePage; 