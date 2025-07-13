import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useCart } from '../CartContext';

const currencySymbols = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
  CAD: "C$",
  AUD: "A$",
  ZAR: "R",
  GHS: "₵",
  KES: "KSh",
  XOF: "CFA",
  XAF: "CFA",
  INR: "₹",
  JPY: "¥",
  CNY: "¥"
};

function getCurrencySymbol(code) {
  return currencySymbols[code] || code;
}

const currenciesWithDecimals = ["GBP", "USD", "EUR", "CAD", "AUD", "ZAR", "GHS", "KES", "INR", "CNY"];
function formatPrice(price, currency) {
  if (currenciesWithDecimals.includes(currency)) {
    return Number(price).toFixed(2);
  }
  return price;
}

function StarRating({ value, onChange, max = 5 }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[...Array(max)].map((_, i) => (
        <span
          key={i}
          style={{
            fontSize: 28,
            color: i < value ? '#FFD700' : '#ccc',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
          onClick={() => onChange(i + 1)}
          onMouseOver={e => e.target.style.color = '#FFD700'}
          onMouseOut={e => e.target.style.color = i < value ? '#FFD700' : '#ccc'}
          role="button"
          aria-label={`Rate ${i + 1} star${i === 0 ? '' : 's'}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

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
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = not logged in, object = logged in
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [tab, setTab] = useState('products');
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [reviews, setReviews] = useState([]);
  const { addToCart } = useCart();
  const [showAdded, setShowAdded] = useState(false);

  // Only declare daysOfWeek ONCE at the top of the file
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user || null);
      if (user) {
        // Check if user is a buyer or seller
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserType('buyer');
        } else {
          setUserType('seller');
        }
      } else {
        setUserType('');
      }
    });
    return () => unsubscribe();
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

  // Check if already following
  useEffect(() => {
    if (!authUser || !id) return;
    const followerRef = doc(db, 'stores', id, 'followers', authUser.uid);
    const unsub = onSnapshot(followerRef, (docSnap) => {
      setFollowing(docSnap.exists());
    });
    return () => unsub();
  }, [authUser, id]);

  const handleFollow = async () => {
    if (!authUser || !id) return;
    const followerRef = doc(db, 'stores', id, 'followers', authUser.uid);
    await setDoc(followerRef, {
      uid: authUser.uid,
      email: authUser.email || '',
      followedAt: new Date().toISOString(),
    });
  };

  const handleUnfollow = async () => {
    if (!authUser || !id) return;
    const followerRef = doc(db, 'stores', id, 'followers', authUser.uid);
    await deleteDoc(followerRef);
  };

  const handleCheckbox = (item) => {
    setSelectedItems(prev => {
      if (prev.some(i => i && i.id === item.id)) {
        return prev.filter(i => i && i.id !== item.id);
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

  // Use daysOfWeek everywhere in the file for day calculations
  const today = daysOfWeek[new Date().getDay()];
  const isClosedToday = store && store.closedDays && store.closedDays.includes(today);
  const todayOpening = store && store.openingTimes && store.openingTimes[today];
  const todayClosing = store && store.closingTimes && store.closingTimes[today];
  function isStoreOpenForToday(opening, closing) {
    if (!opening || !closing) return false;
    const now = new Date();
    const [openH, openM] = opening.split(':').map(Number);
    const [closeH, closeM] = closing.split(':').map(Number);
    const openDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openH, openM);
    const closeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeH, closeM);
    return now >= openDate && now <= closeDate;
  }

  // Helper to check if current user is the store owner
  const isStoreOwner = authUser && store && store.ownerId && authUser.uid === store.ownerId;

  // Add to cart handler
  function handleAddToCart(item) {
    addToCart({
      storeId: id,
      storeName: store.storeName,
      itemId: item.id,
      itemName: item.name,
      price: parseFloat(item.price),
      currency: item.currency,
      quantity: 1,
      image: item.image,
      deliveryType: store.deliveryType
    });
    setShowAdded(true);
    setTimeout(() => setShowAdded(false), 1500);
  }

  // Make sure handleSubmitReview is defined (already present in your code)
  const handleSubmitReview = async () => {
    if (!authUser || !id) return;
    const reviewRef = await addDoc(collection(db, 'stores', id, 'reviews'), {
      rating: userRating,
      text: userReview,
      userId: authUser.uid,
      userName: authUser.displayName || authUser.email,
      userPhoto: authUser.photoURL,
      createdAt: serverTimestamp(),
    });
    setReviewSent(true);
    setTimeout(() => setReviewSent(false), 2000);
    setUserRating(0);
    setUserReview('');
  };

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
      {showAdded && (
        <div style={{
          position: 'fixed',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#28a745',
          color: '#fff',
          padding: '1rem 2rem',
          borderRadius: 12,
          fontWeight: 700,
          fontSize: '1.1rem',
          zIndex: 2000,
          boxShadow: '0 2px 8px #0002',
          animation: 'fadeInOut 1.5s',
        }}>
          ✓ Added to cart!
        </div>
      )}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(-50%) scale(0.95); }
          10% { opacity: 1; transform: translateX(-50%) scale(1.05); }
          80% { opacity: 1; transform: translateX(-50%) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) scale(0.95); }
        }
      `}</style>
      <div style={{ maxWidth: 800, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
          <div style={{ position: 'relative' }}>
            {store.backgroundImg && (
              <img src={store.backgroundImg} alt="Store" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', filter: isStoreOpenForToday(todayOpening, todayClosing) ? 'none' : 'grayscale(0.7)', opacity: isStoreOpenForToday(todayOpening, todayClosing) ? 1 : 0.5, transition: 'opacity 0.3s, filter 0.3s' }} />
            )}
            {!isStoreOpenForToday(todayOpening, todayClosing) && (
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
                {/* Removed paymentInfo details for security */}
              </div>
            )}
          </div>
          {userType === 'buyer' && (
            <>
              {following ? (
                <button onClick={handleUnfollow} style={{ background: '#ccc', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginRight: 8, cursor: 'pointer' }}>
                  Unfollow
                </button>
              ) : (
                <button onClick={handleFollow} style={{ background: '#D92D20', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginRight: 8, cursor: 'pointer' }}>
                  Follow
                </button>
              )}
              <button onClick={handleSendMessage} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                Message
              </button>
            </>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={{ background: isClosedToday ? '#fbe8e8' : (isStoreOpenForToday(todayOpening, todayClosing) ? '#e8fbe8' : '#fbe8e8'), color: isClosedToday ? '#D92D20' : (isStoreOpenForToday(todayOpening, todayClosing) ? '#3A8E3A' : '#D92D20'), borderRadius: 8, padding: '4px 16px', fontWeight: 600, fontSize: '1.1rem' }}>
            {isClosedToday ? 'Closed Today' : (isStoreOpenForToday(todayOpening, todayClosing) ? 'Open' : 'Closed')}
          </span>
          {!isClosedToday && todayOpening && todayClosing && (
            <span style={{ marginLeft: 16, color: '#007B7F', fontSize: '1rem' }}>
              {todayOpening} - {todayClosing}
            </span>
          )}
          {store && Array.isArray(store.closedDays) && store.closedDays.length > 0 && (
            <div style={{ marginTop: 8, color: '#D92D20', fontSize: '1rem', fontWeight: 500 }}>
              <span>Closed: {store.closedDays.join(', ')}</span>
            </div>
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
                <div key={item.id} style={{ width: 220, border: '1px solid #eee', borderRadius: 8, padding: 12, background: isStoreOpenForToday(todayOpening, todayClosing) ? '#f6f6fa' : '#f6f6fa', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isStoreOpenForToday(todayOpening, todayClosing) ? 1 : 0.5, filter: isStoreOpenForToday(todayOpening, todayClosing) ? 'none' : 'grayscale(0.7)', transition: 'opacity 0.3s, filter 0.3s' }}>
                  {item.image && <img src={item.image} alt={item.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />}
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 8 }}>{item.name}</div>
                  <div style={{ color: '#007B7F', fontWeight: 500 }}>{getCurrencySymbol(item.currency)}{formatPrice(item.price, item.currency)}</div>
                  <div style={{ color: '#666', fontSize: '0.95rem' }}>Quality: {item.quality} | Qty: {item.quantity}</div>
                  {/* Only show these buttons for buyers/customers who are not the store owner */}
                  {userType === 'buyer' && !isStoreOwner && isStoreOpenForToday(todayOpening, todayClosing) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => handleAddToCart(item)}
                      >
                        Add to Cart
                      </button>
                      <button
                        style={{ background: '#D92D20', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => {
                          handleAddToCart(item);
                          navigate('/cart');
                        }}
                      >
                        Buy Now
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            {userType === 'buyer' && selectedItems.length > 0 && isStoreOpenForToday(todayOpening, todayClosing) && (
              <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#fff', border: '2px solid #007B7F', borderRadius: 12, padding: '1rem 2rem', fontWeight: 600, fontSize: '1.1rem', color: '#007B7F', zIndex: 1000, boxShadow: '0 2px 8px #ececec' }}>
                Total: {getCurrencySymbol(selectedItems[0].currency)}{selectedItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0).toFixed(2)}
              </div>
            )}
          </div>
        )}
        {tab === 'reviews' && (
          <div style={{ marginTop: 24 }}>
            {/* Only show review form for buyers who are not the store owner */}
            {userType === 'buyer' && !isStoreOwner && (
              <div style={{ marginBottom: 24, background: '#f6f6fa', borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Leave a review:</div>
                <StarRating value={userRating} onChange={setUserRating} />
                <textarea value={userReview} onChange={e => setUserReview(e.target.value)} placeholder="Your review..." style={{ width: '100%', minHeight: 40, borderRadius: 4, border: '1px solid #ccc', padding: 6, marginTop: 8 }} />
                <button onClick={handleSubmitReview} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginTop: 8, cursor: 'pointer' }}>Submit</button>
                {reviewSent && <div style={{ color: '#3A8E3A', marginTop: 8 }}>Review submitted!</div>}
              </div>
            )}
            <div>
              {reviews.length === 0 ? (
                <div style={{ color: '#888' }}>No reviews yet.</div>
              ) : (
                reviews.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <img
                      src={r.userPhoto || 'https://via.placeholder.com/32'}
                      alt={r.userName || 'Anonymous'}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', marginRight: 10 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        <span style={{ color: '#FFD700', marginRight: 4 }}>★</span>
                        {r.rating} - {r.userName || 'Anonymous'}
                      </div>
                      <div style={{ color: '#444' }}>{r.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StorePreviewPage; 