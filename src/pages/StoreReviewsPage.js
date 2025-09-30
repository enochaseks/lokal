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
        // FIX: Use the same logic as Navbar.js to determine if user is seller or buyer
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const storeDoc = await getDoc(doc(db, 'stores', currentUser.uid));
        if (storeDoc.exists()) {
          setUserType('seller');
        } else {
          setUserType('buyer');
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
    <div style={{ background: 'linear-gradient(135deg, #F9F5EE 0%, #F0F8FF 100%)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ 
        maxWidth: window.innerWidth <= 768 ? '95%' : 800, 
        margin: '2rem auto', 
        background: 'rgba(255, 255, 255, 0.95)', 
        borderRadius: 20, 
        boxShadow: '0 10px 30px rgba(0, 123, 127, 0.1), 0 1px 8px rgba(0, 0, 0, 0.05)', 
        padding: window.innerWidth <= 768 ? '1.5rem' : '2.5rem',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 24
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #007B7F 0%, #00A8AC 50%, #FFD700 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(0, 123, 127, 0.3), 0 3px 10px rgba(0, 0, 0, 0.1)',
            fontSize: 42,
            color: '#fff',
            fontWeight: 800,
            letterSpacing: 1,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <span style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
              transform: 'translateX(-100%)',
              animation: 'shimmer 2s infinite'
            }}></span>
            <span role="img" aria-label="review" style={{ 
              fontSize: 32,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}>⭐</span>
          </div>
        </div>

        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .modern-card {
            animation: fadeIn 0.6s ease-out;
          }
          .hover-lift {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .hover-lift:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(0, 123, 127, 0.15), 0 5px 15px rgba(0, 0, 0, 0.08);
          }
        `}</style>

        {userType === 'seller' ? (
          <SellerReviewsSection user={user} />
        ) : (
          <>
            <h2 style={{ 
              fontWeight: 800, 
              fontSize: window.innerWidth <= 768 ? '1.4rem' : '1.6rem', 
              marginBottom: 16,
              color: '#007B7F',
              position: 'relative',
              display: 'inline-block',
              textAlign: 'center',
              width: '100%'
            }}>
              My Reviews
              <span style={{
                position: 'absolute',
                bottom: -4,
                left: '20%',
                width: '60%',
                height: 3,
                background: 'linear-gradient(90deg, #007B7F, #FFD700)',
                borderRadius: 2
              }}></span>
            </h2>
            
            <p style={{
              textAlign: 'center',
              color: '#555',
              marginBottom: 40,
              fontSize: window.innerWidth <= 768 ? 16 : 18,
              fontWeight: 500,
              lineHeight: 1.6
            }}>Discover what our community says about your favourite African or Caribbean Stores</p>
            {userType === 'buyer' && user && (
              <button
                className="hover-lift"
                style={{
                  background: 'linear-gradient(135deg, #007B7F 0%, #00A8AC 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '0.9rem 2rem',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  marginBottom: 32,
                  boxShadow: '0 6px 20px rgba(0, 123, 127, 0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onClick={() => setReviewModalOpen(true)}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 25px rgba(0, 123, 127, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 6px 20px rgba(0, 123, 127, 0.3)';
                }}
              >
                ✨ Leave a Review
              </button>
            )}
            {!user && (
              <div style={{ color: '#007B7F', marginBottom: 24 }}>
                Please <a href="/login">log in</a> or <a href="/register">register</a> to leave a review.
              </div>
            )}
            <div style={{ 
              display: 'flex', 
              gap: 16, 
              marginBottom: 32, 
              flexWrap: 'wrap',
              alignItems: 'center' 
            }}>
              <div style={{ flex: 2, minWidth: 200, position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 18,
                  color: '#999'
                }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search stores by name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '0.9rem 1rem 0.9rem 3rem', 
                    fontSize: '1rem', 
                    borderRadius: 12, 
                    border: '2px solid #E5E7EB',
                    background: '#FAFAFA',
                    transition: 'all 0.3s ease',
                    outline: 'none',
                    fontWeight: 500
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '2px solid #007B7F';
                    e.target.style.background = '#fff';
                    e.target.style.boxShadow = '0 4px 12px rgba(0, 123, 127, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '2px solid #E5E7EB';
                    e.target.style.background = '#FAFAFA';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              <select
                value={filterBy}
                onChange={e => setFilterBy(e.target.value)}
                style={{ 
                  flex: 1, 
                  minWidth: 150, 
                  padding: '0.9rem 1rem', 
                  fontSize: '1rem', 
                  borderRadius: 12, 
                  border: '2px solid #E5E7EB',
                  background: '#FAFAFA',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.target.style.border = '2px solid #007B7F';
                  e.target.style.background = '#fff';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 123, 127, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.border = '2px solid #E5E7EB';
                  e.target.style.background = '#FAFAFA';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="All Categories">All Categories</option>
                {ALL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ 
                  flex: 1, 
                  minWidth: 140, 
                  padding: '0.9rem 1rem', 
                  fontSize: '1rem', 
                  borderRadius: 12, 
                  border: '2px solid #E5E7EB',
                  background: '#FAFAFA',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.target.style.border = '2px solid #007B7F';
                  e.target.style.background = '#fff';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 123, 127, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.border = '2px solid #E5E7EB';
                  e.target.style.background = '#FAFAFA';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="Newest">Newest</option>
                <option value="Oldest">Oldest</option>
                <option value="Top Rated">Top Rated</option>
              </select>
            </div>
            {loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                fontSize: '1.1rem',
                color: '#007B7F',
                fontWeight: 600
              }}>
                <span style={{ marginRight: 12, fontSize: 24 }}>⏳</span>
                Loading reviews...
              </div>
            ) : filteredReviews.length === 0 ? (
              <div style={{ 
                textAlign: 'center',
                padding: '3rem',
                color: '#666',
                fontSize: '1.1rem',
                fontWeight: 500,
                background: 'linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%)',
                borderRadius: 16,
                border: '2px dashed #DEE2E6'
              }}>
                <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🔍</span>
                No stores found matching your criteria.
              </div>
            ) : (
              filteredReviews.map((store, index) => (
                <div 
                  key={store.storeId} 
                  className="modern-card hover-lift"
                  style={{ 
                    marginBottom: 24,
                    background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FFFE 100%)',
                    borderRadius: 20,
                    padding: '1.5rem',
                    boxShadow: '0 8px 25px rgba(0, 123, 127, 0.08), 0 3px 10px rgba(0, 0, 0, 0.03)',
                    border: '1px solid rgba(0, 123, 127, 0.1)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    animationDelay: `${index * 0.1}s`
                  }}
                >
                  <div
                    style={{ 
                      fontWeight: 800, 
                      fontSize: '1.25rem', 
                      background: 'linear-gradient(135deg, #007B7F 0%, #00A8AC 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      marginBottom: 16, 
                      cursor: 'pointer',
                      display: 'inline-block',
                      transition: 'all 0.3s ease',
                      position: 'relative'
                    }}
                    onClick={() => navigate(`/store-review-preview/${store.storeId}`)}
                    title={`View all reviews for ${store.storeName}`}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateX(5px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateX(0)';
                    }}
                  >
                    🏪 {store.storeName || 'Unnamed Store'}
                    <span style={{
                      position: 'absolute',
                      right: -20,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 14,
                      opacity: 0.7,
                      transition: 'all 0.3s ease'
                    }}>→</span>
                  </div>
                  {store.reviews.length === 0 ? (
                    <div style={{ 
                      color: '#999', 
                      marginBottom: 12,
                      fontStyle: 'italic',
                      padding: '1rem',
                      background: '#F8F9FA',
                      borderRadius: 12,
                      textAlign: 'center'
                    }}>
                      📝 No reviews for this store yet.
                    </div>
                  ) : (
                    getSortedReviews(store.reviews).map((r, reviewIndex) => (
                      <div 
                        key={r.id} 
                        style={{ 
                          borderBottom: reviewIndex === store.reviews.length - 1 ? 'none' : '1px solid rgba(0, 123, 127, 0.1)', 
                          marginBottom: 16, 
                          paddingBottom: 16,
                          background: 'rgba(248, 250, 252, 0.5)',
                          borderRadius: 12,
                          padding: '1rem',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <div style={{ 
                          fontWeight: 700,
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8
                        }}>
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                            color: '#fff',
                            padding: '0.3rem 0.8rem',
                            borderRadius: 20,
                            fontSize: '0.9rem',
                            boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)'
                          }}>
                            {'⭐'.repeat(r.rating)} {r.rating}
                          </span>
                          <span style={{ 
                            color: '#007B7F', 
                            fontWeight: 600,
                            fontSize: '0.95rem'
                          }}>
                            👤 {r.userName || 'Anonymous'}
                          </span>
                        </div>
                        <div style={{ 
                          color: '#2D3748', 
                          marginBottom: 12,
                          fontSize: '1rem',
                          lineHeight: 1.6,
                          padding: '0.5rem 0',
                          fontWeight: 500
                        }}>
                          "{r.text}"
                        </div>
                        {r.reply && (
                          <div style={{ 
                            color: '#007B7F',
                            background: 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)',
                            padding: '0.8rem 1rem',
                            borderRadius: 12,
                            marginBottom: 8,
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            border: '1px solid rgba(0, 123, 127, 0.2)',
                            position: 'relative'
                          }}>
                            <span style={{ fontWeight: 700, color: '#065F46' }}>💬 Store Reply:</span> {r.reply}
                          </div>
                        )}
                        {userType === 'seller' && (
                          <div style={{ 
                            display: 'flex', 
                            gap: 12, 
                            alignItems: 'center',
                            marginTop: 12,
                            padding: '1rem',
                            background: 'rgba(0, 123, 127, 0.05)',
                            borderRadius: 12,
                            border: '1px solid rgba(0, 123, 127, 0.1)'
                          }}>
                            <input
                              type="text"
                              placeholder="💬 Write a reply to this review..."
                              value={replyTexts[`${store.storeId}_${r.id}`] || ''}
                              onChange={e => handleReplyChange(store.storeId, r.id, e.target.value)}
                              style={{ 
                                flex: 1, 
                                borderRadius: 8, 
                                border: '2px solid #E5E7EB', 
                                padding: '0.6rem 1rem',
                                fontSize: '0.95rem',
                                outline: 'none',
                                transition: 'all 0.3s ease',
                                background: '#fff'
                              }}
                              onFocus={(e) => {
                                e.target.style.border = '2px solid #007B7F';
                                e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 127, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.border = '2px solid #E5E7EB';
                                e.target.style.boxShadow = 'none';
                              }}
                            />
                            <button 
                              onClick={() => handleReplySubmit(store.storeId, r.id)} 
                              style={{ 
                                background: 'linear-gradient(135deg, #007B7F 0%, #00A8AC 100%)', 
                                color: '#fff', 
                                border: 'none', 
                                borderRadius: 8, 
                                padding: '0.6rem 1.2rem', 
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(0, 123, 127, 0.3)'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 16px rgba(0, 123, 127, 0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 12px rgba(0, 123, 127, 0.3)';
                              }}
                            >
                              Send ✉️
                            </button>
                          </div>
                        )}
                        <div style={{
                          fontSize: '0.85rem',
                          color: '#999',
                          marginTop: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          📅 {r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : 'Date unavailable'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))
            )}
            {reviewModalOpen && userType === 'buyer' && (
              <div style={{
                position: 'fixed', 
                top: 0, 
                left: 0, 
                width: '100vw', 
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.6)', 
                backdropFilter: 'blur(8px)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                zIndex: 10000,
                padding: '1rem'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FFFE 100%)', 
                  borderRadius: 20, 
                  padding: window.innerWidth <= 768 ? '2rem' : '2.5rem', 
                  minWidth: window.innerWidth <= 768 ? '90%' : 420, 
                  maxWidth: window.innerWidth <= 768 ? '95%' : 500, 
                  boxShadow: '0 20px 50px rgba(0, 123, 127, 0.2), 0 10px 25px rgba(0, 0, 0, 0.1)', 
                  position: 'relative',
                  border: '1px solid rgba(0, 123, 127, 0.1)',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}>
                  <button
                    onClick={() => setReviewModalOpen(false)}
                    style={{
                      position: 'absolute', 
                      top: 16, 
                      right: 16, 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      border: 'none', 
                      borderRadius: '50%',
                      width: 40,
                      height: 40,
                      fontSize: 20, 
                      color: '#EF4444', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease'
                    }}
                    aria-label="Close"
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                      e.target.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                      e.target.style.transform = 'scale(1)';
                    }}
                  >×</button>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24
                  }}>
                    <div style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #007B7F 0%, #FFD700 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      marginRight: 16,
                      boxShadow: '0 6px 20px rgba(0, 123, 127, 0.3)'
                    }}>✨</div>
                    <div>
                      <h2 style={{ 
                        fontWeight: 800, 
                        marginBottom: 4, 
                        fontSize: '1.4rem', 
                        background: 'linear-gradient(135deg, #007B7F 0%, #00A8AC 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}>Share Your Experience</h2>
                      <p style={{ 
                        color: '#666', 
                        fontSize: '0.95rem',
                        margin: 0,
                        fontWeight: 500
                      }}>Help others discover great stores</p>
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 8, 
                      fontWeight: 600, 
                      color: '#374151',
                      fontSize: '0.95rem'
                    }}>
                      🏪 Choose Store
                    </label>
                    <Select
                      options={filteredReviews.map(store => ({
                        value: store.storeId,
                        label: store.storeName || 'Unnamed Store'
                      }))}
                      value={filteredReviews.find(store => store.storeId === selectedStoreId)}
                      onChange={option => setSelectedStoreId(option ? option.value : '')}
                      placeholder="Select a store to review..."
                      isClearable
                      styles={{ 
                        container: base => ({ ...base, marginBottom: 16 }),
                        control: (base, state) => ({
                          ...base,
                          borderRadius: 12,
                          border: `2px solid ${state.isFocused ? '#007B7F' : '#E5E7EB'}`,
                          boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 123, 127, 0.1)' : 'none',
                          padding: '0.2rem 0.5rem',
                          fontSize: '1rem'
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isSelected ? '#007B7F' : state.isFocused ? '#F0FDFA' : 'white',
                          color: state.isSelected ? 'white' : '#374151'
                        })
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 8, 
                      fontWeight: 600, 
                      color: '#374151',
                      fontSize: '0.95rem'
                    }}>
                      ⭐ Your Rating
                    </label>
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 8
                    }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setUserRating(star)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: 32,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            color: star <= userRating ? '#FFD700' : '#E5E7EB',
                            textShadow: star <= userRating ? '0 2px 4px rgba(255, 215, 0, 0.3)' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                          }}
                        >
                          ⭐
                        </button>
                      ))}
                      <span style={{ 
                        marginLeft: 12, 
                        color: '#007B7F', 
                        fontWeight: 600,
                        fontSize: '1.1rem'
                      }}>
                        {userRating ? `${userRating}/5` : 'Select rating'}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 8, 
                      fontWeight: 600, 
                      color: '#374151',
                      fontSize: '0.95rem'
                    }}>
                      💭 Your Review
                    </label>
                    <textarea
                      value={userReview}
                      onChange={e => setUserReview(e.target.value)}
                      placeholder="Share your experience with this store... What did you like? What could be improved?"
                      style={{ 
                        width: '100%', 
                        minHeight: 120, 
                        borderRadius: 12, 
                        border: '2px solid #E5E7EB', 
                        padding: '1rem', 
                        marginBottom: 8,
                        fontSize: '1rem',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        outline: 'none',
                        transition: 'all 0.3s ease',
                        background: '#FAFAFA'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '2px solid #007B7F';
                        e.target.style.background = '#fff';
                        e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 127, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.border = '2px solid #E5E7EB';
                        e.target.style.background = '#FAFAFA';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={() => setReviewModalOpen(false)}
                      style={{
                        background: 'transparent',
                        color: '#6B7280',
                        border: '2px solid #E5E7EB',
                        borderRadius: 12,
                        padding: '0.8rem 1.5rem',
                        fontWeight: 600,
                        fontSize: '1rem',
                        flex: 1,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#F3F4F6';
                        e.target.style.borderColor = '#D1D5DB';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                        e.target.style.borderColor = '#E5E7EB';
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async (e) => {
                        await handleSubmitReview(e);
                        setReviewModalOpen(false); // Optionally close modal on submit
                      }}
                      disabled={!selectedStoreId || !userRating || !userReview.trim()}
                      style={{
                        background: (!selectedStoreId || !userRating || !userReview.trim()) 
                          ? '#9CA3AF' 
                          : 'linear-gradient(135deg, #007B7F 0%, #00A8AC 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '0.8rem 1.5rem',
                        fontWeight: 700,
                        fontSize: '1rem',
                        flex: 2,
                        cursor: (!selectedStoreId || !userRating || !userReview.trim()) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: (!selectedStoreId || !userRating || !userReview.trim()) 
                          ? 'none' 
                          : '0 6px 20px rgba(0, 123, 127, 0.3)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedStoreId && userRating && userReview.trim()) {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 8px 25px rgba(0, 123, 127, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedStoreId && userRating && userReview.trim()) {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 6px 20px rgba(0, 123, 127, 0.3)';
                        }
                      }}
                    >
                      {(!selectedStoreId || !userRating || !userReview.trim()) ? '⚠️ Complete All Fields' : '🚀 Submit Review'}
                    </button>
                  </div>
                  {reviewSent && <div style={{ 
                    color: '#10B981', 
                    marginTop: 16, 
                    textAlign: 'center',
                    padding: '0.8rem',
                    background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
                    borderRadius: 12,
                    fontWeight: 600,
                    border: '1px solid #6EE7B7'
                  }}>
                    ✅ Review submitted successfully!
                  </div>}
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

  if (loading) return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem',
      fontSize: '1.1rem',
      color: '#007B7F',
      fontWeight: 600
    }}>
      <span style={{ marginRight: 12, fontSize: 24 }}>⏳</span>
      Loading your store reviews...
    </div>
  );
  
  if (!store) return (
    <div style={{ 
      textAlign: 'center',
      padding: '3rem',
      color: '#666',
      fontSize: '1.1rem',
      fontWeight: 500,
      background: 'linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%)',
      borderRadius: 16,
      border: '2px dashed #DEE2E6'
    }}>
      <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🏪</span>
      No store found for your account.
    </div>
  );

  return (
    <div>
      <h2 style={{ 
        fontWeight: 800, 
        fontSize: window.innerWidth <= 768 ? '1.4rem' : '1.6rem', 
        marginBottom: 24,
        color: '#007B7F',
        position: 'relative',
        display: 'inline-block'
      }}>
        Reviews for Your Store
        <span style={{
          position: 'absolute',
          bottom: -4,
          left: 0,
          width: '60%',
          height: 3,
          background: 'linear-gradient(90deg, #007B7F, #FFD700)',
          borderRadius: 2
        }}></span>
      </h2>
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