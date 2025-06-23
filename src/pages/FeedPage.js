import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getAuth } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, collectionGroup, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function FeedPage() {
  const [postText, setPostText] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [storeProfile, setStoreProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState({});
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [storeProfilesById, setStoreProfilesById] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [menuOpen, setMenuOpen] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editMediaFiles, setEditMediaFiles] = useState([]);
  const [editMediaUrls, setEditMediaUrls] = useState([]);
  const [commentLikes, setCommentLikes] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [replyingTo, setReplyingTo] = useState({});
  const [commentMenuOpen, setCommentMenuOpen] = useState({});
  const [editingComment, setEditingComment] = useState({});
  const [editCommentText, setEditCommentText] = useState({});
  const [mediaPopup, setMediaPopup] = useState({ open: false, url: '', type: 'image' });
  const [isCampaign, setIsCampaign] = useState(false);

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

    // Query all stores the user follows
    const followedStoresQuery = query(collectionGroup(db, 'followers'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(followedStoresQuery, async (snapshot) => {
      let followedStoreIds = snapshot.docs.map(doc => doc.ref.parent.parent.id);

      // If the user is a seller, add their own storeId
      if (storeProfile) {
        if (!followedStoreIds.includes(user.uid)) {
          followedStoreIds.push(user.uid);
        }
      }

      if (followedStoreIds.length > 0) {
        // Query posts from all followed stores (and own posts if seller)
        const postQuery = query(
          collection(db, 'posts'),
          where('storeId', 'in', followedStoreIds),
          orderBy('timestamp', 'desc')
        );
        const unsubscribePosts = onSnapshot(postQuery, (postSnapshot) => {
          setPosts(postSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubscribePosts();
      } else {
        setPosts([]);
      }
    });

    return () => unsubscribe();
  }, [user, storeProfile]);

  // Fetch current store profiles for all posts
  useEffect(() => {
    // Get unique storeIds from posts
    const storeIds = Array.from(new Set(posts.map(post => post.storeId)));
    // Only fetch profiles that are not already in storeProfilesById
    const missingIds = storeIds.filter(id => !storeProfilesById[id]);
    if (missingIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const newProfiles = {};
      for (const id of missingIds) {
        try {
          const storeRef = doc(db, 'stores', id);
          const storeSnap = await getDoc(storeRef);
          if (storeSnap.exists()) {
            newProfiles[id] = storeSnap.data();
          } else {
            newProfiles[id] = null;
          }
        } catch {
          newProfiles[id] = null;
        }
      }
      if (!cancelled && Object.keys(newProfiles).length > 0) {
        setStoreProfilesById(prev => ({ ...prev, ...newProfiles }));
      }
    })();
    return () => { cancelled = true; };
  }, [posts, storeProfilesById]);

  // Listen for comments for each open post
  useEffect(() => {
    const unsubscribes = [];
    Object.keys(openComments).forEach(postId => {
      if (openComments[postId]) {
        const postRef = doc(db, 'posts', postId);
        const unsubscribe = onSnapshot(postRef, (docSnap) => {
          if (docSnap.exists()) {
            setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, comments: docSnap.data().comments || [] } : p));
          }
        });
        unsubscribes.push(unsubscribe);
      }
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [openComments]);

  const handleMediaChange = (e) => setMediaFiles(Array.from(e.target.files));
  
  const handleLike = (postId) => setLikedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));

  const handleToggleComments = (postId) => {
    setOpenComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleCommentInput = (postId, value) => {
    setCommentInputs(prev => ({ ...prev, [postId]: value }));
  };

  const handleAddComment = async (postId) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text || !user) return;
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const postData = postSnap.data();
    let name = '';
    let photoURL = '';
    let foundProfile = false;
    // Always fetch from Firestore, do not fallback to displayName/email/uid
    // Try stores first (store owner)
    const storeProfileSnap = await getDoc(doc(db, 'stores', user.uid));
    if (storeProfileSnap.exists()) {
      const data = storeProfileSnap.data();
      name = data.storeName || '';
      photoURL = data.backgroundImg || '';
      foundProfile = !!name;
    } else {
      // Try users collection (buyer)
      const userProfileSnap = await getDoc(doc(db, 'users', user.uid));
      if (userProfileSnap.exists()) {
        const data = userProfileSnap.data();
        name = data.displayName || data.name || '';
        photoURL = data.photoURL || '';
        foundProfile = !!name;
      }
    }
    // If no profile, do not allow comment and alert user
    if (!foundProfile) {
      alert('You must set up your profile (name and photo) in your account before commenting.');
      return;
    }
    if (!photoURL) photoURL = 'https://via.placeholder.com/32';
    const newComment = {
      uid: user.uid,
      name,
      photoURL,
      text,
      timestamp: new Date(),
    };
    const updatedComments = [...(postData.comments || []), newComment];
    await updateDoc(postRef, { comments: updatedComments });
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

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
        campaign: isCampaign,
      });

      setPostText('');
      setMediaFiles([]);
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
    }
    setLoading(false);
  };

  const handleMenuToggle = (postId) => {
    setMenuOpen(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleDeletePost = async (postId) => {
    await deleteDoc(doc(db, 'posts', postId));
    setMenuOpen(prev => ({ ...prev, [postId]: false }));
  };

  const handleEditPost = (post) => {
    setEditingPostId(post.id);
    setEditText(post.text);
    setEditMediaUrls(post.media || []);
    setEditMediaFiles([]);
    setMenuOpen(prev => ({ ...prev, [post.id]: false }));
  };

  const handleEditMediaChange = (e) => {
    setEditMediaFiles(Array.from(e.target.files));
  };

  const handleEditSave = async (postId) => {
    let mediaUrls = editMediaUrls;
    if (editMediaFiles.length > 0) {
      mediaUrls = await Promise.all(
        editMediaFiles.map(async (file) => {
          const fileRef = ref(storage, `posts/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          return { type: 'image', url: await getDownloadURL(fileRef) };
        })
      );
    }
    await updateDoc(doc(db, 'posts', postId), {
      text: editText,
      media: mediaUrls,
    });
    setEditingPostId(null);
    setEditText('');
    setEditMediaFiles([]);
    setEditMediaUrls([]);
  };

  const handleEditCancel = () => {
    setEditingPostId(null);
    setEditText('');
    setEditMediaFiles([]);
    setEditMediaUrls([]);
  };

  const handleCommentLike = (postId, commentIdx) => {
    setPosts(prevPosts => prevPosts.map(post => {
      if (post.id !== postId) return post;
      const comments = post.comments.map((c, i) => {
        if (i !== commentIdx) return c;
        const likes = c.likes || [];
        const liked = likes.includes(user.uid);
        return {
          ...c,
          likes: liked ? likes.filter(uid => uid !== user.uid) : [...likes, user.uid],
        };
      });
      updateDoc(doc(db, 'posts', postId), { comments });
      return { ...post, comments };
    }));
  };

  const handleReplyInput = (commentIdx, value) => {
    setReplyInputs(prev => ({ ...prev, [commentIdx]: value }));
  };

  const handleReply = (postId, parentIdx) => {
    setReplyingTo(prev => ({ ...prev, [postId]: parentIdx }));
  };

  const handleAddReply = async (postId, parentIdx) => {
    const text = (replyInputs[parentIdx] || '').trim();
    if (!text || !user) return;
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const postData = postSnap.data();
    const parentComment = postData.comments[parentIdx];
    let name = '';
    let photoURL = '';
    let foundProfile = false;
    const storeProfileSnap = await getDoc(doc(db, 'stores', user.uid));
    if (storeProfileSnap.exists()) {
      const data = storeProfileSnap.data();
      name = data.storeName || '';
      photoURL = data.backgroundImg || '';
      foundProfile = !!name;
    } else {
      const userProfileSnap = await getDoc(doc(db, 'users', user.uid));
      if (userProfileSnap.exists()) {
        const data = userProfileSnap.data();
        name = data.displayName || data.name || '';
        photoURL = data.photoURL || '';
        foundProfile = !!name;
      }
    }
    if (!foundProfile) {
      alert('You must set up your profile (name and photo) in your account before replying.');
      return;
    }
    if (!photoURL) photoURL = 'https://via.placeholder.com/32';
    const reply = {
      uid: user.uid,
      name,
      photoURL,
      text,
      timestamp: new Date(),
      likes: [],
      replies: [],
    };
    const updatedComments = postData.comments.map((c, i) =>
      i === parentIdx ? { ...c, replies: [...(c.replies || []), reply] } : c
    );
    await updateDoc(postRef, { comments: updatedComments });
    setReplyInputs(prev => ({ ...prev, [parentIdx]: '' }));
    setReplyingTo(prev => ({ ...prev, [postId]: null }));
  };

  const handleCommentMenuToggle = (postId, commentIdx) => {
    setCommentMenuOpen(prev => ({ ...prev, [`${postId}_${commentIdx}`]: !prev[`${postId}_${commentIdx}`] }));
  };

  const handleEditComment = (postId, commentIdx, text) => {
    setEditingComment({ postId, commentIdx });
    setEditCommentText({ postId, commentIdx, text });
    setCommentMenuOpen(prev => ({ ...prev, [`${postId}_${commentIdx}`]: false }));
  };

  const handleEditCommentChange = (value) => {
    setEditCommentText(prev => ({ ...prev, text: value }));
  };

  const handleEditCommentSave = async (postId, commentIdx) => {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const postData = postSnap.data();
    const updatedComments = postData.comments.map((c, i) =>
      i === commentIdx ? { ...c, text: editCommentText.text } : c
    );
    await updateDoc(postRef, { comments: updatedComments });
    setEditingComment({});
    setEditCommentText({});
  };

  const handleEditCommentCancel = () => {
    setEditingComment({});
    setEditCommentText({});
  };

  const handleDeleteComment = async (postId, commentIdx) => {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const postData = postSnap.data();
    const updatedComments = postData.comments.filter((_, i) => i !== commentIdx);
    await updateDoc(postRef, { comments: updatedComments });
    setCommentMenuOpen(prev => ({ ...prev, [`${postId}_${commentIdx}`]: false }));
  };

  const handleMediaClick = (url, type) => {
    setMediaPopup({ open: true, url, type });
  };

  const handleClosePopup = () => {
    setMediaPopup({ open: false, url: '', type: 'image' });
  };

  const handleToggleCampaign = () => {
    setIsCampaign(prev => !prev);
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
              <input type="file" accept="image/*,video/*" multiple capture style={{ flex: 1 }} onChange={handleMediaChange} />
              <button type="button" onClick={handlePost} disabled={loading} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'Posting...' : 'Post'}</button>
            </div>
            {/* Campaign icon/button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={handleToggleCampaign}
                style={{
                  background: isCampaign ? '#FFD700' : '#eee',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0.5rem 1rem',
                  color: isCampaign ? '#222' : '#888',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title={isCampaign ? 'Unset as Campaign' : 'Set as Campaign'}
              >
                <span role="img" aria-label="campaign">📢</span>
                {isCampaign ? 'Campaign Post' : 'Set as Campaign'}
              </button>
              {isCampaign && <span style={{ color: '#FFD700', fontWeight: 600 }}>This post will be marked as a campaign</span>}
            </div>
          </div>
        )}

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', fontSize: '1.1rem', marginTop: 40 }}>
            {storeProfile ? "You have no posts yet. Your posts will appear here." : "No posts yet. Follow stores to see their updates here."}
          </div>
        ) : (
          posts.map(post => {
            const storeProfileForPost = storeProfilesById[post.storeId];
            const avatarUrl = storeProfileForPost && storeProfileForPost.backgroundImg ? storeProfileForPost.backgroundImg : 'https://via.placeholder.com/40';
            return (
              <div key={post.id} style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.2)', marginBottom: 20, position: 'relative' }}>
                {/* Three dots menu */}
                {user && post.storeId === user.uid && (
                  <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 10 }}>
                    <button onClick={() => handleMenuToggle(post.id)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4 }}>
                      &#8942;
                    </button>
                    {menuOpen[post.id] && (
                      <div style={{ position: 'absolute', top: 28, right: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 8, boxShadow: '0 2px 8px #ccc', minWidth: 100 }}>
                        <button onClick={() => handleEditPost(post)} style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '8px 12px', textAlign: 'left', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleDeletePost(post.id)} style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '8px 12px', textAlign: 'left', color: '#D92D20', cursor: 'pointer' }}>Delete</button>
                      </div>
                    )}
                  </div>
                )}
                {/* Edit mode */}
                {editingPostId === post.id ? (
                  <div style={{ padding: '12px 16px' }}>
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} style={{ width: '100%', borderRadius: 8, border: '1px solid #ccd0d5', padding: '10px', fontSize: '1.1rem', marginBottom: 8 }} />
                    <div style={{ marginBottom: 8 }}>
                      <input type="file" accept="image/*,video/*" multiple onChange={handleEditMediaChange} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      {editMediaUrls.map((m, i) => (
                        <img key={i} src={m.url} alt="media" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} />
                      ))}
                    </div>
                    <button onClick={() => handleEditSave(post.id)} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, marginRight: 8, cursor: 'pointer' }}>Save</button>
                    <button onClick={handleEditCancel} style={{ background: '#eee', color: '#444', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <img src={avatarUrl} alt={post.storeName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 600 }}>{post.storeName}</div>
                        {post.campaign && (
                          <span style={{
                            background: '#FFD700',
                            color: '#222',
                            fontWeight: 700,
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: '0.95em',
                            marginLeft: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <span role="img" aria-label="campaign">📢</span> Campaign
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ color: '#888', fontSize: '0.9rem' }}>{post.timestamp?.toDate().toLocaleString()}</div>
                    <p style={{ margin: '8px 0', textAlign: 'left' }}>{post.text}</p>
                  </div>
                )}
                {post.media && post.media.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: post.media.length === 1 ? '1fr' : post.media.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
                    gap: 8,
                    marginBottom: 8
                  }}>
                    {post.media.map((m, idx) => (
                      m.type === 'image' ? (
                        <img
                          key={idx}
                          src={m.url}
                          alt="post media"
                          style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                          onClick={() => handleMediaClick(m.url, 'image')}
                        />
                      ) : m.type === 'video' ? (
                        <video
                          key={idx}
                          src={m.url}
                          controls
                          style={{ width: '100%', height: 180, borderRadius: 8, cursor: 'pointer' }}
                          onClick={() => handleMediaClick(m.url, 'video')}
                        />
                      ) : null
                    ))}
              </div>
              )}
              <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', color: '#65676B' }}>
                <span>{post.likes.length + (likedPosts[post.id] ? 1 : 0)} Likes</span>
                <span>{post.comments.length} Comments</span>
              </div>
              <div style={{ borderTop: '1px solid #E4E6EB', margin: '0 16px', display: 'flex' }}>
                <button onClick={() => handleLike(post.id)} style={{ flex: 1, background: 'none', border: 'none', padding: '10px', fontWeight: 'bold', color: likedPosts[post.id] ? '#007B7F' : '#65676B', cursor: 'pointer' }}>Like</button>
                  <button onClick={() => handleToggleComments(post.id)} style={{ flex: 1, background: 'none', border: 'none', padding: '10px', fontWeight: 'bold', color: '#65676B', cursor: 'pointer' }}>Comment</button>
                </div>
                {openComments[post.id] && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #eee', background: '#fafbfc' }}>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>Comments</div>
                    {post.comments && post.comments.length > 0 ? (
                      post.comments.map((c, i) => (
                        <div key={i} style={{ marginBottom: 8, padding: 8, background: '#fff', borderRadius: 6, boxShadow: '0 1px 2px #eee', textAlign: 'left', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={c.photoURL || 'https://via.placeholder.com/32'} alt={c.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                            <span style={{ fontWeight: 500 }}>{c.name}</span>
                            <span style={{ color: '#888', fontSize: '0.85em' }}>
                              {c.timestamp && (c.timestamp.seconds ? new Date(c.timestamp.seconds * 1000).toLocaleString() : new Date(c.timestamp).toLocaleString())}
                            </span>
                            {/* Three dots menu for comment owner */}
                            {user && c.uid === user.uid && (
                              <div style={{ marginLeft: 'auto', position: 'relative' }}>
                                <button onClick={() => handleCommentMenuToggle(post.id, i)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 2 }}>&#8942;</button>
                                {commentMenuOpen[`${post.id}_${i}`] && (
                                  <div style={{ position: 'absolute', top: 24, right: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 8, boxShadow: '0 2px 8px #ccc', minWidth: 80 }}>
                                    <button onClick={() => handleEditComment(post.id, i, c.text)} style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '6px 10px', textAlign: 'left', cursor: 'pointer' }}>Edit</button>
                                    <button onClick={() => handleDeleteComment(post.id, i)} style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '6px 10px', textAlign: 'left', color: '#D92D20', cursor: 'pointer' }}>Delete</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Edit mode for comment */}
                          {editingComment.postId === post.id && editingComment.commentIdx === i ? (
                            <div style={{ marginTop: 6 }}>
                              <input type="text" value={editCommentText.text} onChange={e => handleEditCommentChange(e.target.value)} style={{ width: '100%', borderRadius: 6, border: '1px solid #ccc', padding: 6 }} />
                              <button onClick={() => handleEditCommentSave(post.id, i)} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.8rem', fontWeight: 600, marginRight: 6, cursor: 'pointer' }}>Save</button>
                              <button onClick={handleEditCommentCancel} style={{ background: '#eee', color: '#444', border: 'none', borderRadius: 6, padding: '0.3rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ color: '#444', marginTop: 4 }}>{c.text}</div>
                          )}
                          {/* Like and Reply actions */}
                          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                            <button onClick={() => handleCommentLike(post.id, i)} style={{ background: 'none', border: 'none', color: (c.likes || []).includes(user?.uid) ? '#007B7F' : '#888', fontWeight: 600, cursor: 'pointer' }}>
                              Like{c.likes && c.likes.length > 0 ? ` (${c.likes.length})` : ''}
                            </button>
                            <button onClick={() => handleReply(post.id, i)} style={{ background: 'none', border: 'none', color: '#888', fontWeight: 600, cursor: 'pointer' }}>Reply</button>
                          </div>
                          {/* Reply input */}
                          {replyingTo[post.id] === i && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                              <input
                                type="text"
                                value={replyInputs[i] || ''}
                                onChange={e => handleReplyInput(i, e.target.value)}
                                placeholder="Write a reply..."
                                style={{ flex: 1, borderRadius: 6, border: '1px solid #ccc', padding: 6 }}
                              />
                              <button onClick={() => handleAddReply(post.id, i)} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}>Post</button>
                            </div>
                          )}
                          {/* Render replies */}
                          {c.replies && c.replies.length > 0 && (
                            <div style={{ marginLeft: 32, marginTop: 8 }}>
                              {c.replies.map((r, ri) => (
                                <div key={ri} style={{ marginBottom: 6, padding: 6, background: '#f6f6fa', borderRadius: 6, boxShadow: '0 1px 2px #eee', textAlign: 'left', position: 'relative' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <img src={r.photoURL || 'https://via.placeholder.com/32'} alt={r.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                                    <span style={{ fontWeight: 500 }}>{r.name}</span>
                                    <span style={{ color: '#888', fontSize: '0.8em' }}>
                                      {r.timestamp && (r.timestamp.seconds ? new Date(r.timestamp.seconds * 1000).toLocaleString() : new Date(r.timestamp).toLocaleString())}
                                    </span>
                                  </div>
                                  <div style={{ color: '#444', marginTop: 2 }}>{r.text}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#888', marginBottom: 8 }}>No comments yet.</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        type="text"
                        value={commentInputs[post.id] || ''}
                        onChange={e => handleCommentInput(post.id, e.target.value)}
                        placeholder="Write a comment..."
                        style={{ flex: 1, borderRadius: 6, border: '1px solid #ccc', padding: 8 }}
                      />
                      <button onClick={() => handleAddComment(post.id)} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Post</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Media popup modal */}
      {mediaPopup.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={handleClosePopup}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button onClick={handleClosePopup} style={{ position: 'absolute', top: 8, right: 8, background: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 20, cursor: 'pointer', zIndex: 2 }}>×</button>
            {mediaPopup.type === 'image' ? (
              <img src={mediaPopup.url} alt="popup" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 2px 16px #0008' }} />
            ) : (
              <video src={mediaPopup.url} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 2px 16px #0008' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FeedPage; 