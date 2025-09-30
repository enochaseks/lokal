import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Navbar from '../components/Navbar';

function StoreReviewPreviewPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [isStoreOwner, setIsStoreOwner] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchStoreAndReviews = async () => {
      setLoading(true);
      const storeRef = doc(db, 'stores', storeId);
      const storeSnap = await getDoc(storeRef);
      if (storeSnap.exists()) {
        const storeData = { id: storeSnap.id, ...storeSnap.data() };
        setStore(storeData);
        if (authUser && storeData.ownerId && authUser.uid === storeData.ownerId) {
          setIsStoreOwner(true);
        } else {
          setIsStoreOwner(false);
        }
        const reviewsSnap = await getDocs(collection(db, 'stores', storeId, 'reviews'));
        const reviewsArr = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by newest first
        reviewsArr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setReviews(reviewsArr);
      } else {
        setStore(null);
        setReviews([]);
      }
      setLoading(false);
    };
    fetchStoreAndReviews();
  }, [storeId, authUser]);

  return (
    <div style={{ background: 'linear-gradient(135deg, #F9F5EE 0%, #F0F8FF 100%)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ 
        maxWidth: window.innerWidth <= 768 ? '95%' : 700, 
        margin: '2rem auto', 
        background: 'rgba(255, 255, 255, 0.95)', 
        borderRadius: 20, 
        boxShadow: '0 10px 30px rgba(0, 123, 127, 0.1), 0 1px 8px rgba(0, 0, 0, 0.05)', 
        padding: window.innerWidth <= 768 ? '1.5rem' : '2.5rem',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <style>{`
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
        
        <button 
          onClick={() => navigate(-1)} 
          className="hover-lift"
          style={{ 
            marginBottom: 24, 
            background: 'linear-gradient(135deg, #007B7F 0%, #00A8AC 100%)', 
            color: '#fff',
            border: 'none', 
            borderRadius: 12,
            padding: '0.8rem 1.5rem',
            fontWeight: 700, 
            fontSize: '1rem', 
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 123, 127, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
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
          ← Back to Reviews
        </button>
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
            Loading store reviews...
          </div>
        ) : !store ? (
          <div style={{ 
            textAlign: 'center',
            padding: '3rem',
            color: '#EF4444',
            fontSize: '1.1rem',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)',
            borderRadius: 16,
            border: '2px dashed #F87171'
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>❌</span>
            Store not found.
          </div>
        ) : (
          <>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              marginBottom: 32,
              padding: '2rem',
              background: 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)',
              borderRadius: 20,
              border: '1px solid rgba(0, 123, 127, 0.1)'
            }}>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <img
                  src={store.backgroundImg || 'https://via.placeholder.com/100'}
                  alt="Store Thumbnail"
                  style={{ 
                    width: 100, 
                    height: 100, 
                    borderRadius: '50%', 
                    objectFit: 'cover', 
                    border: '4px solid #fff',
                    boxShadow: '0 8px 25px rgba(0, 123, 127, 0.2)'
                  }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: 5,
                  right: 5,
                  background: 'linear-gradient(135deg, #007B7F 0%, #FFD700 100%)',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  boxShadow: '0 2px 8px rgba(0, 123, 127, 0.3)'
                }}>🏪</span>
              </div>
              
              <h2 style={{ 
                fontWeight: 800, 
                fontSize: window.innerWidth <= 768 ? '1.6rem' : '1.8rem', 
                marginBottom: 8,
                background: 'linear-gradient(135deg, #007B7F 0%, #00A8AC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textAlign: 'center'
              }}>
                {store.storeName || 'Unnamed Store'}
              </h2>
              
              <div style={{ 
                color: '#065F46', 
                fontWeight: 600, 
                marginBottom: 8,
                padding: '0.4rem 1rem',
                background: 'rgba(6, 95, 70, 0.1)',
                borderRadius: 20,
                fontSize: '0.9rem'
              }}>
                📍 {store.category || 'No category'}
              </div>
              
              <div style={{ 
                color: '#007B7F', 
                fontWeight: 600, 
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0.5rem 1.2rem',
                background: 'rgba(0, 123, 127, 0.1)',
                borderRadius: 20
              }}>
                <span style={{ fontSize: 18 }}>⭐</span>
                {reviews.length > 0 ? `${reviews.length} Review${reviews.length > 1 ? 's' : ''}` : 'No reviews yet'}
              </div>
            </div>
            <h3 style={{ 
              fontWeight: 800, 
              fontSize: window.innerWidth <= 768 ? '1.3rem' : '1.5rem', 
              marginBottom: 24,
              color: '#007B7F',
              position: 'relative',
              display: 'inline-block'
            }}>
              Customer Reviews
              <span style={{
                position: 'absolute',
                bottom: -4,
                left: 0,
                width: '60%',
                height: 3,
                background: 'linear-gradient(90deg, #007B7F, #FFD700)',
                borderRadius: 2
              }}></span>
            </h3>
            
            {reviews.length === 0 ? (
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
                <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>💬</span>
                No reviews for this store yet.
              </div>
            ) : (
              reviews.map((r, index) => (
                <div 
                  key={r.id} 
                  className="modern-card hover-lift"
                  style={{ 
                    borderBottom: index === reviews.length - 1 ? 'none' : '1px solid rgba(0, 123, 127, 0.1)', 
                    marginBottom: 20, 
                    paddingBottom: 20,
                    background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FFFE 100%)',
                    borderRadius: 16,
                    padding: '1.5rem',
                    boxShadow: '0 4px 15px rgba(0, 123, 127, 0.08)',
                    border: '1px solid rgba(0, 123, 127, 0.05)',
                    animationDelay: `${index * 0.1}s`
                  }}
                >
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                      color: '#fff',
                      padding: '0.4rem 1rem',
                      borderRadius: 20,
                      fontSize: '0.9rem',
                      fontWeight: 700,
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
                    color: '#374151', 
                    marginBottom: 12,
                    fontSize: '1rem',
                    lineHeight: 1.6,
                    fontWeight: 500
                  }}>
                    "{r.text}"
                  </div>
                  
                  {r.reply && (
                    <div style={{ 
                      color: '#007B7F',
                      background: 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)',
                      padding: '1rem',
                      borderRadius: 12,
                      marginTop: 12,
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      border: '1px solid rgba(0, 123, 127, 0.2)',
                      position: 'relative'
                    }}>
                      <span style={{ fontWeight: 700, color: '#065F46' }}>💬 Store Reply:</span> {r.reply}
                    </div>
                  )}
                  
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#999',
                    marginTop: 12,
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
            {/* If you want to add a review form for buyers, add it here and check !isStoreOwner */}
          </>
        )}
      </div>
    </div>
  );
}

export default StoreReviewPreviewPage; 