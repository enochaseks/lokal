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
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem' }}>
        <button onClick={() => navigate(-1)} style={{ marginBottom: 18, background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>{'< Back'}</button>
        {loading ? (
          <div>Loading store reviews...</div>
        ) : !store ? (
          <div style={{ color: '#D92D20', fontWeight: 600 }}>Store not found.</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
              <img
                src={store.backgroundImg || 'https://via.placeholder.com/80'}
                alt="Store Thumbnail"
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 10, border: '2px solid #eee' }}
              />
              <h2 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: 8 }}>{store.storeName || 'Unnamed Store'}</h2>
              <div style={{ color: '#007B7F', fontWeight: 500, marginBottom: 4 }}>{store.category || 'No category'}</div>
              <div style={{ color: '#444', fontWeight: 500, marginBottom: 12 }}>
                {reviews.length > 0 ? `${reviews.length} Rating${reviews.length > 1 ? 's' : ''}` : 'No ratings yet'}
              </div>
            </div>
            <h3 style={{ fontWeight: 600, fontSize: '1.15rem', marginBottom: 16 }}>Reviews</h3>
            {reviews.length === 0 ? (
              <div style={{ color: '#888' }}>No reviews for this store yet.</div>
            ) : (
              reviews.map(r => (
                <div key={r.id} style={{ borderBottom: '1px solid #eee', marginBottom: 14, paddingBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>⭐ {r.rating} - {r.userName || 'Anonymous'}</div>
                  <div style={{ color: '#444', marginBottom: 6 }}>{r.text}</div>
                  {r.reply && <div style={{ color: '#007B7F', fontStyle: 'italic', marginBottom: 6 }}>Reply: {r.reply}</div>}
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