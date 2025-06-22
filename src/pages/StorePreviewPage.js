import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';

function StorePreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [message, setMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [following, setFollowing] = useState(false);
  const [userType, setUserType] = useState('');
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [tab, setTab] = useState('products');

  useEffect(() => {
    // Get userType from localStorage (set in onboarding)
    const type = localStorage.getItem('userType');
    setUserType(type);
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubStore = onSnapshot(doc(db, 'stores', id), (docSnap) => {
      if (docSnap.exists()) {
        setStore(docSnap.data());
      } else {
        setStore(null);
      }
      setLoading(false);
    });
    const unsubItems = onSnapshot(collection(db, 'stores', id, 'items'), (querySnapshot) => {
      setItems(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubStore();
      unsubItems();
    };
  }, [id]);

  const handleCheckbox = (item) => {
    setSelectedItems(prev => {
      if (prev.some(i => i.id === item.id)) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const total = selectedItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);

  const handleSendMessage = () => {
    setMessageSent(true);
    setTimeout(() => setMessageSent(false), 2000);
    setMessage('');
    // Here you would send the message to the seller (not implemented)
  };

  const handleFollow = () => {
    setFollowing(true);
    // Here you would update the follow status in the backend (not implemented)
  };

  const isStoreOpen = (opening, closing) => {
    if (!opening || !closing) return false;
    const now = new Date();
    const [openH, openM] = opening.split(':').map(Number);
    const [closeH, closeM] = closing.split(':').map(Number);
    const openDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openH, openM);
    const closeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeH, closeM);
    return now >= openDate && now <= closeDate;
  };

  const open = store ? isStoreOpen(store.openingTime, store.closingTime) : false;

  if (loading) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', marginTop: 80 }}>Loading store...</div>
      </div>
    );
  }
  if (!store) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', marginTop: 80, color: '#D92D20' }}>Store not found.</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 800, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
          <div style={{ position: 'relative' }}>
            {store.backgroundImg && (
              <img src={store.backgroundImg} alt="Store" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', filter: open ? 'none' : 'grayscale(0.7)', opacity: open ? 1 : 0.5, transition: 'opacity 0.3s, filter 0.3s' }} />
            )}
            {!open && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 60, background: 'rgba(255,255,255,0.55)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', color: '#D92D20', pointerEvents: 'none' }}>
                Closed
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>{store.storeName}</div>
            <div style={{ color: '#444', fontSize: '1rem' }}>{store.storeLocation}</div>
            <div style={{ color: '#007B7F', fontSize: '1rem' }}>
              ⭐ {avgRating} ({ratingCount})
            </div>
            <div style={{ color: '#444', fontSize: '1.05rem', marginTop: 4 }}><b>Origin:</b> {store.origin}</div>
            <div style={{ color: '#007B7F', fontSize: '1.05rem', marginTop: 2 }}><b>Delivery Type:</b> {store.deliveryType}</div>
            {store.paymentType && (
              <div style={{ color: '#007B7F', fontSize: '1.05rem', marginTop: 2 }}>
                <b>Payment Method:</b> {store.paymentType === 'Other' ? 'Pay at Store' : store.paymentType}
                {store.paymentInfo && typeof store.paymentInfo === 'object' && (
                  <div style={{ color: '#444', fontSize: '1rem', marginTop: 2 }}>
                    {Object.entries(store.paymentInfo).map(([key, value]) => (
                      <div key={key}><b>{key}:</b> {value}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {userType === 'buyer' && (
            <>
              <button onClick={handleFollow} disabled={following} style={{ background: following ? '#ccc' : '#D92D20', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginRight: 8, cursor: following ? 'not-allowed' : 'pointer' }}>
                {following ? 'Following' : 'Follow'}
              </button>
              <button onClick={handleSendMessage} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                Message
              </button>
            </>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={{ background: open ? '#e8fbe8' : '#fbe8e8', color: open ? '#3A8E3A' : '#D92D20', borderRadius: 8, padding: '4px 16px', fontWeight: 600, fontSize: '1.1rem' }}>
            {open ? 'Open' : 'Closed'}
          </span>
          {store && store.openingTime && store.closingTime && (
            <span style={{ marginLeft: 16, color: '#007B7F', fontSize: '1rem' }}>
              {store.openingTime} - {store.closingTime}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 32, borderBottom: '1.5px solid #eee', marginBottom: 24 }}>
          <button onClick={() => setTab('products')} style={{ background: 'none', border: 'none', fontWeight: tab === 'products' ? 700 : 400, fontSize: '1.1rem', color: tab === 'products' ? '#007B7F' : '#444', borderBottom: tab === 'products' ? '2.5px solid #007B7F' : 'none', padding: '0.5rem 0', cursor: 'pointer' }}>Products</button>
          <button onClick={() => setTab('reviews')} style={{ background: 'none', border: 'none', fontWeight: tab === 'reviews' ? 700 : 400, fontSize: '1.1rem', color: tab === 'reviews' ? '#007B7F' : '#444', borderBottom: tab === 'reviews' ? '2.5px solid #007B7F' : 'none', padding: '0.5rem 0', cursor: 'pointer' }}>Reviews</button>
        </div>
        {tab === 'products' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
            {items.length === 0 ? (
              <div style={{ color: '#888' }}>No items added yet.</div>
            ) : (
              items.map(item => (
                <div key={item.id} style={{ width: 220, border: '1px solid #eee', borderRadius: 8, padding: 12, background: open ? '#f6f6fa' : '#f6f6fa', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: open ? 1 : 0.5, filter: open ? 'none' : 'grayscale(0.7)', transition: 'opacity 0.3s, filter 0.3s' }}>
                  {item.image && <img src={item.image} alt={item.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />}
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 8 }}>{item.name}</div>
                  <div style={{ color: '#007B7F', fontWeight: 500 }}>{item.price} {item.currency}</div>
                  <div style={{ color: '#666', fontSize: '0.95rem' }}>Quality: {item.quality} | Qty: {item.quantity}</div>
                  {userType === 'buyer' && (
                    <input type="checkbox" checked={selectedItems.some(i => i.id === item.id)} onChange={() => open ? handleCheckbox(item) : null} style={{ marginTop: 8 }} disabled={!open} />
                  )}
                </div>
              ))
            )}
            {userType === 'buyer' && selectedItems.length > 0 && open && (
              <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#fff', border: '2px solid #007B7F', borderRadius: 12, padding: '1rem 2rem', fontWeight: 600, fontSize: '1.1rem', color: '#007B7F', zIndex: 1000, boxShadow: '0 2px 8px #ececec' }}>
                Total: {total.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StorePreviewPage; 