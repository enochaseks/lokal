import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getAuth } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, collectionGroup } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function FeedPage() {
  const [postText, setPostText] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [storeProfile, setStoreProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState({});
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user is a store owner
        const storeRef = doc(db, 'stores', currentUser.uid);
        const storeSnap = await getDoc(storeRef);
        if (storeSnap.exists()) {
          setStoreProfile(storeSnap.data());
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    let postQuery;

    if (storeProfile) {
      // Store owner sees their own posts
      postQuery = query(collection(db, 'posts'), where('storeId', '==', user.uid), orderBy('timestamp', 'desc'));
    } else {
      // Buyer sees posts from followed stores
      const followedStoresQuery = query(collectionGroup(db, 'followers'), where('uid', '==', user.uid));
      onSnapshot(followedStoresQuery, async (snapshot) => {
        const followedStoreIds = snapshot.docs.map(doc => doc.ref.parent.parent.id);
        if (followedStoreIds.length > 0) {
          postQuery = query(collection(db, 'posts'), where('storeId', 'in', followedStoreIds), orderBy('timestamp', 'desc'));
          const unsubscribePosts = onSnapshot(postQuery, (postSnapshot) => {
            setPosts(postSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          });
          return () => unsubscribePosts();
        } else {
          setPosts([]);
        }
      });
      return; // Handled by inner snapshot
    }

    const unsubscribe = onSnapshot(postQuery, (snapshot) => {
      setPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubscribe();
  }, [user, storeProfile]);


  const handleMediaChange = (e) => setMediaFiles(Array.from(e.target.files));
  
  const handleLike = (postId) => setLikedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));

  const handlePost = async (e) => {
    e.preventDefault();
    if (!postText.trim() && mediaFiles.length === 0) return;
    setLoading(true);

    try {
      const mediaUrls = await Promise.all(
        mediaFiles.map(async (file) => {
          const fileRef = ref(storage, `posts/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          return getDownloadURL(fileRef);
        })
      );

      await addDoc(collection(db, 'posts'), {
        storeId: user.uid,
        storeName: storeProfile.storeName,
        storeAvatar: storeProfile.backgroundImg || '',
        text: postText,
        media: mediaUrls.map(url => ({ type: 'image', url })), // Simple type, adjust if handling videos differently
        timestamp: serverTimestamp(),
        likes: [],
        comments: [],
      });

      setPostText('');
      setMediaFiles([]);
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
    }
    setLoading(false);
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
              <button type="button" onClick={handlePost} disabled={loading} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'Posting...' : 'Post'}</button>
            </div>
          </div>
        )}

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', fontSize: '1.1rem', marginTop: 40 }}>
            {storeProfile ? "You have no posts yet. Your posts will appear here." : "No posts yet. Follow stores to see their updates here."}
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.2)', marginBottom: 20 }}>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <img src={post.storeAvatar || 'https://via.placeholder.com/40'} alt={post.storeName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{post.storeName}</div>
                    <div style={{ color: '#888', fontSize: '0.9rem' }}>{post.timestamp?.toDate().toLocaleString()}</div>
                  </div>
                </div>
                <p style={{ margin: '8px 0' }}>{post.text}</p>
              </div>
              {post.media && post.media.length > 0 && post.media[0].url && (
                <img src={post.media[0].url} alt="post media" style={{ width: '100%', maxHeight: 500, objectFit: 'cover' }} />
              )}
              <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', color: '#65676B' }}>
                <span>{post.likes.length + (likedPosts[post.id] ? 1 : 0)} Likes</span>
                <span>{post.comments.length} Comments</span>
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