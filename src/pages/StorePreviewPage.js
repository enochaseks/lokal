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
        try {
          // Check if user is a buyer or seller
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserType('buyer');
            
            // Add this store to viewed stores for buyers only
            if (id) {
              const viewedKey = `viewedStores_${user.uid}`;
              const existingViewed = JSON.parse(localStorage.getItem(viewedKey) || '[]');
              
              // Remove store if it already exists (to move it to front)
              const filteredViewed = existingViewed.filter(storeId => storeId !== id);
              
              // Add store to beginning of array
              const updatedViewed = [id, ...filteredViewed];
              
              // Keep only last 20 viewed stores
              const limitedViewed = updatedViewed.slice(0, 20);
              
              // Save back to localStorage
              localStorage.setItem(viewedKey, JSON.stringify(limitedViewed));
              
              console.log('Saved viewed store from StorePreviewPage:', id, 'for user:', user.uid);
            }
          } else {
            setUserType('seller');
          }
        } catch (error) {
          console.error('Error checking user type:', error);
          setUserType('');
        }
      } else {
        setUserType('');
      }
    });
    return () => unsubscribe();
  }, [id]); // Add id as dependency

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

  // Add useEffect to load and calculate ratings with enhanced user data fetching
  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(collection(db, 'stores', id, 'reviews'), async (querySnapshot) => {
      const reviewsData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      // Fetch current user data for each review
      const reviewsWithCurrentUserData = await Promise.all(
        reviewsData.map(async (review) => {
          try {
            // Try to fetch current user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', review.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                ...review,
                userName: userData.name || userData.displayName || review.userName || 'Anonymous',
                userPhoto: userData.photoURL || userData.profilePicture || review.userPhoto || null
              };
            }
            // If user document doesn't exist, keep original review data
            return review;
          } catch (error) {
            console.error('Error fetching user data for review:', error);
            // If there's an error, keep original review data
            return review;
          }
        })
      );
      
      setReviews(reviewsWithCurrentUserData);
      
      // Calculate average rating and count
      if (reviewsData.length > 0) {
        const totalRating = reviewsData.reduce((sum, review) => sum + (review.rating || 0), 0);
        const avgRating = (totalRating / reviewsData.length).toFixed(1);
        setAvgRating(parseFloat(avgRating));
        setRatingCount(reviewsData.length);
      } else {
        setAvgRating(0);
        setRatingCount(0);
      }
    });

    return () => unsubscribe();
  }, [id]);

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
    // First check if the store is closed today - this overrides any opening times
    if (isClosedToday) return false;
    
    if (!opening || !closing) return false;
    const now = new Date();
    const [openH, openM] = opening.split(':').map(Number);
    const [closeH, closeM] = closing.split(':').map(Number);
    const openDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openH, openM);
    const closeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeH, closeM);
    
    // Handle case where closing time is after midnight (next day)
    if (closeH < openH || (closeH === openH && closeM < openM)) {
      closeDate.setDate(closeDate.getDate() + 1);
    }
    
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

  // Update the existing useEffect for auth to properly handle viewed stores
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
        
        // Add this store to viewed stores for buyers
        if (userDoc.exists() && id) {
          const viewedKey = `viewedStores_${user.uid}`;
          const existingViewed = JSON.parse(localStorage.getItem(viewedKey) || '[]');
          
          // Remove store if it already exists (to move it to front)
          const filteredViewed = existingViewed.filter(storeId => storeId !== id);
          
          // Add store to beginning of array
          const updatedViewed = [id, ...filteredViewed];
          
          // Keep only last 20 viewed stores
          const limitedViewed = updatedViewed.slice(0, 20);
          
          // Save back to localStorage
          localStorage.setItem(viewedKey, JSON.stringify(limitedViewed));
          
          console.log('Saved viewed store from StorePreviewPage:', id, 'for user:', user.uid); // Debug log
        }
      } else {
        setUserType('');
      }
    });
    return () => unsubscribe();
  }, [id]); // Add id as dependency

  // Update the handleSubmitReview function to fetch user profile data from Firestore
  const handleSubmitReview = async () => {
    if (!authUser || !id || userRating === 0) {
      alert('Please select a rating before submitting.');
      return;
    }
    
    try {
      // Fetch user profile data from Firestore
      const userDoc = await getDoc(doc(db, 'users', authUser.uid));
      let userData = {
        userName: authUser.displayName || authUser.email?.split('@')[0] || 'Anonymous',
        userPhoto: authUser.photoURL || null
      };
      
      // If user document exists in Firestore, use that data instead
      if (userDoc.exists()) {
        const firestoreUserData = userDoc.data();
        userData = {
          userName: firestoreUserData.name || firestoreUserData.displayName || authUser.displayName || authUser.email?.split('@')[0] || 'Anonymous',
          userPhoto: firestoreUserData.photoURL || firestoreUserData.profilePicture || authUser.photoURL || null
        };
      }
      
      await addDoc(collection(db, 'stores', id, 'reviews'), {
        rating: userRating,
        text: userReview.trim(),
        userId: authUser.uid,
        userName: userData.userName,
        userPhoto: userData.userPhoto,
        createdAt: serverTimestamp(),
      });
      
      setReviewSent(true);
      setTimeout(() => setReviewSent(false), 2000);
      setUserRating(0);
      setUserReview('');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    }
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
        @media (max-width: 600px) {
          .store-action-buttons {
            width: 100%;
            display: flex;
            flex-direction: row;
            gap: 8px;
            margin-top: 12px;
            justify-content: center;
          }
          .store-info {
            text-align: left;
            align-items: flex-start;
          }
        }
      `}</style>
      <div style={{ maxWidth: 800, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
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
          <div className="store-info" style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>{store.storeName}</div>
            <div style={{ color: '#444', fontSize: '1rem' }}>{store.storeLocation}</div>
            <div style={{ color: '#007B7F', fontSize: '1rem' }}>
              ⭐ {avgRating > 0 ? avgRating : 'No ratings'} {ratingCount > 0 && `(${ratingCount} review${ratingCount !== 1 ? 's' : ''})`}
            </div>
            <div style={{ color: '#444', fontSize: '1.05rem', marginTop: 4 }}><b>Origin:</b> {store.origin}</div>
            <div style={{ color: '#007B7F', fontSize: '1.05rem', marginTop: 2 }}><b>Delivery Type:</b> {store.deliveryType}</div>
            {store.paymentType && (
              <div style={{ color: '#007B7F', fontSize: '1.05rem', marginTop: 2 }}>
                <b>Payment Method:</b> {store.paymentType === 'Own Card/Bank Details' ? 'Card Payment' : (store.paymentType === 'Other' ? 'Pay at Store' : store.paymentType)}
                {/* Removed paymentInfo details for security */}
              </div>
            )}
          </div>
          {userType === 'buyer' && (
            <div className="store-action-buttons">
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
            </div>
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
            {/* Display overall rating summary */}
            <div style={{ marginBottom: 24, padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }}>Customer Reviews</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '2rem', color: '#FFD700' }}>★</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {avgRating > 0 ? `${avgRating} out of 5` : 'No ratings yet'}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.9rem' }}>
                    {ratingCount} review{ratingCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Only show review form for buyers who are not the store owner */}
            {userType === 'buyer' && !isStoreOwner && (
              <div style={{ marginBottom: 24, background: '#f6f6fa', borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Leave a review:</div>
                <StarRating value={userRating} onChange={setUserRating} />
                <textarea 
                  value={userReview} 
                  onChange={e => setUserReview(e.target.value)} 
                  placeholder="Share your experience with this store..." 
                  style={{ 
                    width: '100%', 
                    minHeight: 80, 
                    borderRadius: 4, 
                    border: '1px solid #ccc', 
                    padding: 12, 
                    marginTop: 12,
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }} 
                />
                <button 
                  onClick={handleSubmitReview} 
                  disabled={userRating === 0}
                  style={{ 
                    background: userRating === 0 ? '#ccc' : '#007B7F', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 6, 
                    padding: '0.5rem 1.2rem', 
                    fontWeight: 600, 
                    fontSize: '1rem', 
                    marginTop: 12, 
                    cursor: userRating === 0 ? 'not-allowed' : 'pointer' 
                  }}
                >
                  Submit Review
                </button>
                {reviewSent && (
                  <div style={{ color: '#3A8E3A', marginTop: 8, fontWeight: 600 }}>
                    ✓ Review submitted successfully!
                  </div>
                )}
              </div>
            )}
            
            {/* Reviews list */}
            <div>
              {reviews.length === 0 ? (
                <div style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>
                  No reviews yet. Be the first to review this store!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {reviews
                    .sort((a, b) => {
                      // Sort by creation date, newest first
                      if (a.createdAt && b.createdAt) {
                        return b.createdAt.toMillis() - a.createdAt.toMillis();
                      }
                      return 0;
                    })
                    .map(r => (
                      <div key={r.id} style={{ 
                        display: 'flex', 
                        gap: 12, 
                        padding: 16, 
                        border: '1px solid #eee', 
                        borderRadius: 8,
                        background: '#fafafa',
                        alignItems: 'flex-start'
                      }}>
                        <img
                          src={r.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.userName || 'Anonymous')}&background=007B7F&color=fff&size=40`}
                          alt={r.userName || 'Anonymous'}
                          style={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: '50%', 
                            objectFit: 'cover', 
                            flexShrink: 0 
                          }}
                          onError={(e) => {
                            // Prevent infinite loop by checking if already using fallback
                            if (!e.target.src.includes('ui-avatars.com')) {
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(r.userName || 'Anonymous')}&background=007B7F&color=fff&size=40`;
                            }
                          }}
                        />
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                              {r.userName || 'Anonymous'}
                            </span>
                            <div style={{ display: 'flex', gap: 2 }}>
                              {[...Array(5)].map((_, i) => (
                                <span 
                                  key={i} 
                                  style={{ 
                                    color: i < r.rating ? '#FFD700' : '#ddd',
                                    fontSize: '1rem'
                                  }}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>
                          {r.text && (
                            <div style={{ color: '#444', fontSize: '0.95rem', lineHeight: 1.4, textAlign: 'left' }}>
                              {r.text}
                            </div>
                          )}
                          {r.createdAt && (
                            <div style={{ color: '#888', fontSize: '0.8rem', marginTop: 8, textAlign: 'left' }}>
                              {new Date(r.createdAt.toMillis()).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StorePreviewPage;