import React, { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, collection, onSnapshot, updateDoc, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';

// Reminder: Add a route for StoreReviewPreviewPage in your main router, e.g.:
// <Route path="/store-review-preview/:storeId" element={<StoreReviewPreviewPage />} />
// import StoreReviewPreviewPage from './pages/StoreReviewPreviewPage';

const ALL_CATEGORIES = [
  'Foods & Goods',
  'Meat & Poultry',
  'Wholesale',
  'Beauty & Hair',
];

function StoreReviewsPage() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState('');
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [allReviews, setAllReviews] = useState([]); // [{storeId, storeName, reviews: [], category}]
  const [loading, setLoading] = useState(true);
  const [replyTexts, setReplyTexts] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('');
  const [sortBy, setSortBy] = useState('Newest');
  const [categories, setCategories] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user is a buyer or seller (copy logic from Navbar.js)
        const userDoc = await import('../firebase').then(({ db }) => import('firebase/firestore').then(({ doc, getDoc }) => getDoc(doc(db, 'users', currentUser.uid))));
        if (userDoc && userDoc.exists && userDoc.exists()) {
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
    // Fetch all stores and their reviews
    const fetchAllReviews = async () => {
      setLoading(true);
      const storesSnap = await getDocs(collection(db, 'stores'));
      const stores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Collect unique categories
      const uniqueCategories = Array.from(new Set(stores.map(s => s.category).filter(Boolean)));
      setCategories(uniqueCategories);
      const reviewsByStore = [];
      for (const store of stores) {
        const reviewsSnap = await getDocs(collection(db, 'stores', store.id, 'reviews'));
        const reviews = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reviewsByStore.push({ storeId: store.id, storeName: store.storeName, reviews, category: store.category });
      }
      setAllReviews(reviewsByStore);
      setLoading(false);
    };
    fetchAllReviews();
  }, []);

  const handleReplyChange = (storeId, reviewId, value) => {
    setReplyTexts(prev => ({ ...prev, [`${storeId}_${reviewId}`]: value }));
  };

  const handleReplySubmit = async (storeId, reviewId) => {
    if (!replyTexts[`${storeId}_${reviewId}`]) return;
    const reviewRef = doc(db, 'stores', storeId, 'reviews', reviewId);
    await updateDoc(reviewRef, { reply: replyTexts[`${storeId}_${reviewId}`] });
    setReplyTexts(prev => ({ ...prev, [`${storeId}_${reviewId}`]: '' }));
  };

  // Filter stores by search term and category (case-insensitive)
  let filteredReviews = allReviews.filter(store => {
    const nameMatch = (store.storeName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatch = !filterBy || filterBy === '' || filterBy === 'All Categories' || (store.category && store.category.toLowerCase() === filterBy.toLowerCase());
    return nameMatch && categoryMatch;
  });

  // Sort reviews for each store
  const getSortedReviews = (reviews) => {
    if (sortBy === 'Newest') {
      return reviews.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } else if (sortBy === 'Oldest') {
      return reviews.slice().sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    } else if (sortBy === 'Top Rated') {
      return reviews.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return reviews;
  };

  // Add handleSubmitReview for review creation
  const handleSubmitReview = async (e) => {
    e.preventDefault && e.preventDefault();
    if (!userRating || !userReview || !selectedStoreId) return;
    await addDoc(collection(db, 'stores', selectedStoreId, 'reviews'), {
      rating: userRating,
      text: userReview,
      userName: user?.displayName || 'Anonymous',
      createdAt: serverTimestamp(),
    });
    setUserRating(0);
    setUserReview('');
    setReviewSent(true);
    setTimeout(() => setReviewSent(false), 2000);
  };

  if (user === undefined) {
    // Still loading user
    return null;
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 16
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #007B7F 60%, #FFD700 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px #B8B8B8',
            fontSize: 36,
            color: '#fff',
            fontWeight: 700,
            letterSpacing: 1
          }}>
            <span role="img" aria-label="pin" style={{ marginRight: 4, color: '#FFD700', fontSize: 36, filter: 'drop-shadow(0 1px 2px #888)' }}>📍</span>
            <span style={{ fontSize: 28 }}>R</span>
          </div>
        </div>
        {userType === 'seller' ? (
          <SellerReviewsSection user={user} />
        ) : (
          <>
            <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 24 }}>My Reviews</h2>
            {userType === 'buyer' && user && (
              <button
                style={{
                  background: '#007B7F',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0.7rem 1.5rem',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  marginBottom: 24
                }}
                onClick={() => setReviewModalOpen(true)}
              >
                Leave a Review
              </button>
            )}
            {!user && (
              <div style={{ color: '#007B7F', marginBottom: 24 }}>
                Please <a href="/login">log in</a> or <a href="/register">register</a> to leave a review.
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search stores by name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ flex: 2, minWidth: 180, padding: '0.7rem 1rem', fontSize: '1rem', borderRadius: 8, border: '1px solid #ccc' }}
              />
              <select
                value={filterBy}
                onChange={e => setFilterBy(e.target.value)}
                style={{ flex: 1, minWidth: 120, padding: '0.7rem 1rem', fontSize: '1rem', borderRadius: 8, border: '1px solid #ccc' }}
              >
                <option value="All Categories">All Categories</option>
                {ALL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ flex: 1, minWidth: 120, padding: '0.7rem 1rem', fontSize: '1rem', borderRadius: 8, border: '1px solid #ccc' }}
              >
                <option value="Newest">Newest</option>
                <option value="Oldest">Oldest</option>
                <option value="Top Rated">Top Rated</option>
              </select>
            </div>
            {loading ? (
              <div>Loading reviews...</div>
            ) : filteredReviews.length === 0 ? (
              <div style={{ color: '#888' }}>No stores found.</div>
            ) : (
              filteredReviews.map(store => (
                <div key={store.storeId} style={{ marginBottom: 32 }}>
                  <div
                    style={{ fontWeight: 700, fontSize: '1.15rem', color: '#007B7F', marginBottom: 10, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => navigate(`/store-review-preview/${store.storeId}`)}
                    title={`View all reviews for ${store.storeName}`}
                  >
                    {store.storeName || 'Unnamed Store'}
                  </div>
                  {store.reviews.length === 0 ? (
                    <div style={{ color: '#aaa', marginBottom: 12 }}>No reviews for this store.</div>
                  ) : (
                    getSortedReviews(store.reviews).map(r => (
                      <div key={r.id} style={{ borderBottom: '1px solid #eee', marginBottom: 14, paddingBottom: 10 }}>
                        <div style={{ fontWeight: 600 }}>⭐ {r.rating} - {r.userName || 'Anonymous'}</div>
                        <div style={{ color: '#444', marginBottom: 6 }}>{r.text}</div>
                        {r.reply && <div style={{ color: '#007B7F', fontStyle: 'italic', marginBottom: 6 }}>Reply: {r.reply}</div>}
                        {userType === 'seller' && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="text"
                              placeholder="Reply..."
                              value={replyTexts[`${store.storeId}_${r.id}`] || ''}
                              onChange={e => handleReplyChange(store.storeId, r.id, e.target.value)}
                              style={{ flex: 1, borderRadius: 4, border: '1px solid #ccc', padding: 4 }}
                            />
                            <button onClick={() => handleReplySubmit(store.storeId, r.id)} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 0.8rem', cursor: 'pointer' }}>Reply</button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ))
            )}
            {reviewModalOpen && userType === 'buyer' && (
              <div style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
              }}>
                <div style={{
                  background: '#fff', borderRadius: 12, padding: 32, minWidth: 340, maxWidth: 400, boxShadow: '0 2px 16px #0008', position: 'relative'
                }}>
                  <button
                    onClick={() => setReviewModalOpen(false)}
                    style={{
                      position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: 24, color: '#007B7F', cursor: 'pointer'
                    }}
                    aria-label="Close"
                  >×</button>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '1.2rem', textAlign: 'center' }}>Leave a review:</div>
                  <Select
                    options={filteredReviews.map(store => ({
                      value: store.storeId,
                      label: store.storeName || 'Unnamed Store'
                    }))}
                    value={filteredReviews.find(store => store.storeId === selectedStoreId)}
                    onChange={option => setSelectedStoreId(option ? option.value : '')}
                    placeholder="Select a store to review"
                    isClearable
                    styles={{ container: base => ({ ...base, marginBottom: 12 }) }}
                  />
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={userRating}
                    onChange={e => setUserRating(Number(e.target.value))}
                    placeholder="Rating (1-5)"
                    style={{ width: '100%', marginBottom: 8, borderRadius: 4, border: '1px solid #ccc', padding: 4 }}
                  />
                  <textarea
                    value={userReview}
                    onChange={e => setUserReview(e.target.value)}
                    placeholder="Your review..."
                    style={{ width: '100%', minHeight: 40, borderRadius: 4, border: '1px solid #ccc', padding: 6, marginBottom: 8 }}
                  />
                  <button
                    onClick={async (e) => {
                      await handleSubmitReview(e);
                      setReviewModalOpen(false); // Optionally close modal on submit
                    }}
                    style={{
                      background: '#007B7F',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '0.5rem 1.2rem',
                      fontWeight: 600,
                      fontSize: '1rem',
                      width: '100%',
                      cursor: 'pointer'
                    }}
                  >
                    Submit
                  </button>
                  {reviewSent && <div style={{ color: '#3A8E3A', marginTop: 8, textAlign: 'center' }}>Review submitted!</div>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// SellerReviewsSection component
function SellerReviewsSection({ user }) {
  const [store, setStore] = React.useState(null);
  const [reviews, setReviews] = React.useState([]);
  const [replyTexts, setReplyTexts] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [avgRating, setAvgRating] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    const fetchStoreAndReviews = async () => {
      setLoading(true);
      const storeDoc = await import('../firebase').then(({ db }) => import('firebase/firestore').then(({ doc, getDoc, collection, getDocs }) => getDoc(doc(db, 'stores', user.uid)).then(async (storeSnap) => {
        if (storeSnap.exists()) {
          setStore(storeSnap.data());
          // Fetch reviews
          const reviewsSnap = await getDocs(collection(db, 'stores', user.uid, 'reviews'));
          const reviewsArr = reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setReviews(reviewsArr);
          // Calculate average rating
          if (reviewsArr.length > 0) {
            const avg = reviewsArr.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsArr.length;
            setAvgRating(avg.toFixed(2));
          } else {
            setAvgRating(0);
          }
        } else {
          setStore(null);
          setReviews([]);
          setAvgRating(0);
        }
        setLoading(false);
      })));
    };
    fetchStoreAndReviews();
  }, [user]);

  const handleReplyChange = (reviewId, value) => {
    setReplyTexts(prev => ({ ...prev, [reviewId]: value }));
  };

  const handleReplySubmit = async (reviewId) => {
    if (!replyTexts[reviewId]) return;
    const { db } = await import('../firebase');
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'stores', user.uid, 'reviews', reviewId), { reply: replyTexts[reviewId] });
    setReplyTexts(prev => ({ ...prev, [reviewId]: '' }));
    // Refresh reviews
    const { getDocs, collection } = await import('firebase/firestore');
    const reviewsSnap = await getDocs(collection(db, 'stores', user.uid, 'reviews'));
    setReviews(reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  if (loading) return <div>Loading your store reviews...</div>;
  if (!store) return <div>No store found for your account.</div>;

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 16 }}>Reviews for Your Store</h2>
      <div style={{ fontWeight: 600, marginBottom: 16 }}>Average Rating: {avgRating} ⭐</div>
      {reviews.length === 0 ? (
        <div style={{ color: '#888' }}>No reviews yet.</div>
      ) : (
        reviews.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(r => (
          <div key={r.id} style={{ borderBottom: '1px solid #eee', marginBottom: 14, paddingBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>⭐ {r.rating} - {r.userName || 'Anonymous'}</div>
            <div style={{ color: '#444', marginBottom: 6 }}>{r.text}</div>
            {r.reply ? (
              <div style={{ color: '#007B7F', fontStyle: 'italic', marginBottom: 6 }}>Reply: {r.reply}</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input
                  type="text"
                  placeholder="Reply..."
                  value={replyTexts[r.id] || ''}
                  onChange={e => handleReplyChange(r.id, e.target.value)}
                  style={{ flex: 1, borderRadius: 4, border: '1px solid #ccc', padding: 4 }}
                />
                <button onClick={() => handleReplySubmit(r.id)} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 0.8rem', cursor: 'pointer' }}>Reply</button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default StoreReviewsPage; 