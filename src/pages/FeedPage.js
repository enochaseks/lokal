import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

function FeedPage() {
  const [postText, setPostText] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [storeProfile, setStoreProfile] = useState(null);
  const [posts, setPosts] = useState([]); // Initialize with empty array
  const [likedPosts, setLikedPosts] = useState({});

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const fetchStoreProfile = async () => {
        const storeRef = doc(db, 'stores', user.uid);
        const storeSnap = await getDoc(storeRef);
        if (storeSnap.exists()) {
          setStoreProfile(storeSnap.data());
        }
      };
      fetchStoreProfile();
      // In a real app, you would fetch posts from followed stores here and call setPosts
    }
  }, []);

  const handleMediaChange = (e) => setMediaFiles(Array.from(e.target.files));
  
  const handleLike = (postId) => {
    setLikedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handlePost = (e) => {
    e.preventDefault();
    // Here you would upload media, then save the post to Firestore
    console.log('Posting:', { postText, mediaFiles });
    setPostText('');
    setMediaFiles([]);
  };

  return (
    <div style={{ background: '#F0F2F5', minHeight: '100vh', padding: 0 }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 8px' }}>
        {storeProfile && (
          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.2)', padding: '1.5rem', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={storeProfile.backgroundImg || 'https://via.placeholder.com/44'} alt="avatar" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
              <textarea value={postText} onChange={e => setPostText(e.target.value)} placeholder="What's on your mind?" rows={2} style={{ flex: 1, borderRadius: 22, border: '1px solid #ccd0d5', padding: '12px 18px', fontSize: '1.1rem', background: '#F0F2F5', resize: 'vertical', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <input type="file" accept="image/*,video/*" multiple onChange={handleMediaChange} style={{ flex: 1 }} />
              <button type="button" onClick={handlePost} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}>Post</button>
            </div>
          </div>
        )}

        {posts.length === 0 ? (
          storeProfile ? (
            <div style={{ textAlign: 'center', color: '#888', fontSize: '1.1rem', marginTop: 40 }}>
              You have no posts yet. Your posts will appear here.
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#888', fontSize: '1.1rem', marginTop: 40 }}>
              No posts yet. Follow stores to see their updates here.
            </div>
          )
        ) : (
          posts.map(post => (
            <div key={post.id} style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.2)', marginBottom: 20 }}>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <img src={post.storeAvatar} alt={post.storeName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{post.storeName}</div>
                    <div style={{ color: '#888', fontSize: '0.9rem' }}>{new Date(post.timestamp).toLocaleString()}</div>
                  </div>
                </div>
                <p style={{ margin: '8px 0' }}>{post.text}</p>
              </div>
              {post.media && post.media.length > 0 && post.media[0].url && (
                <img src={post.media[0].url} alt="post media" style={{ width: '100%', maxHeight: 500, objectFit: 'cover' }} />
              )}
              <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', color: '#65676B' }}>
                <span>{post.likes + (likedPosts[post.id] ? 1 : 0)} Likes</span>
                <span>{post.comments && post.comments.length} Comments</span>
              </div>
              <div style={{ borderTop: '1px solid #E4E6EB', margin: '0 16px', display: 'flex' }}>
                <button onClick={() => handleLike(post.id)} style={{ flex: 1, background: 'none', border: 'none', padding: '10px', fontWeight: 'bold', color: likedPosts[post.id] ? '#007B7F' : '#65676B', cursor: 'pointer' }}>Like</button>
                <button style={{ flex: 1, background: 'none', border: 'none', padding: '10px', fontWeight: 'bold', color: '#65676B', cursor: 'pointer' }}>Comment</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FeedPage; 