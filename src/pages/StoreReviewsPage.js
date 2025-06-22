import React, { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, collection, onSnapshot, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import Navbar from '../components/Navbar';

function StoreReviewsPage() {
  const [user, setUser] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [replyTexts, setReplyTexts] = useState({});
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState('');
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [reviewSent, setReviewSent] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    setUser(auth.currentUser);
    setUserType(localStorage.getItem('userType'));
  }, []);

  useEffect(() => {
    if (!user) return;
    // For sellers, use their own store; for buyers, use a selected store or fallback (for demo, use their uid)
    setStoreId(user.uid); // You can adjust this logic to select a store for buyers
  }, [user]);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'stores', storeId, 'reviews'), (querySnapshot) => {
      setReviews(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [storeId]);

  const handleReplyChange = (reviewId, value) => {
    setReplyTexts(prev => ({ ...prev, [reviewId]: value }));
  };

  const handleReplySubmit = async (reviewId) => {
    if (!replyTexts[reviewId]) return;
    const reviewRef = doc(db, 'stores', storeId, 'reviews', reviewId);
    await updateDoc(reviewRef, { reply: replyTexts[reviewId] });
    setReplyTexts(prev => ({ ...prev, [reviewId]: '' }));
  };

  const handleSubmitReview = async () => {
    if (!userRating || !userReview) return;
    await addDoc(collection(db, 'stores', storeId, 'reviews'), {
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
  if (!user) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ marginTop: 80, color: '#D92D20', fontWeight: 600, fontSize: '1.2rem', textAlign: 'center' }}>You must be logged in to view this page.</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 24 }}>Store Reviews</h2>
        {userType === 'buyer' && (
          <div style={{ marginBottom: 24, background: '#f6f6fa', borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Leave a review:</div>
            <input type="number" min="1" max="5" value={userRating} onChange={e => setUserRating(Number(e.target.value))} placeholder="Rating (1-5)" style={{ width: 80, marginRight: 8, borderRadius: 4, border: '1px solid #ccc', padding: 4 }} />
            <textarea value={userReview} onChange={e => setUserReview(e.target.value)} placeholder="Your review..." style={{ width: '100%', minHeight: 40, borderRadius: 4, border: '1px solid #ccc', padding: 6, marginTop: 8 }} />
            <button onClick={handleSubmitReview} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginTop: 8, cursor: 'pointer' }}>Submit</button>
            {reviewSent && <div style={{ color: '#3A8E3A', marginTop: 8 }}>Review submitted!</div>}
          </div>
        )}
        {loading ? (
          <div>Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div style={{ color: '#888' }}>No reviews yet.</div>
        ) : (
          reviews.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds).map(r => (
            <div key={r.id} style={{ borderBottom: '1px solid #eee', marginBottom: 18, paddingBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>⭐ {r.rating} - {r.userName || 'Anonymous'}</div>
              <div style={{ color: '#444', marginBottom: 6 }}>{r.text}</div>
              {r.reply && <div style={{ color: '#007B7F', fontStyle: 'italic', marginBottom: 6 }}>Reply: {r.reply}</div>}
              {userType === 'seller' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
    </div>
  );
}

export default StoreReviewsPage; 