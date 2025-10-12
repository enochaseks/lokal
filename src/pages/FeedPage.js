import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAuth } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, collectionGroup, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function FeedPage() {
  const navigate = useNavigate();
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
  const [replyMenuOpen, setReplyMenuOpen] = useState({});
  const [editingReply, setEditingReply] = useState({});
  const [editReplyText, setEditReplyText] = useState({});
  const [expandedReplies, setExpandedReplies] = useState({});
  const [threadedReplyInputs, setThreadedReplyInputs] = useState({});
  const [mediaPopup, setMediaPopup] = useState({ open: false, url: '', type: 'image' });
  const [isCampaign, setIsCampaign] = useState(false);
  
  // Report functionality states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportingPostId, setReportingPostId] = useState(null);

  // Share Store Item Post states
  const [showShareItemModal, setShowShareItemModal] = useState(false);
  const [storeItems, setStoreItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [shareItemText, setShareItemText] = useState('');
  const [shareItemLoading, setShareItemLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  
  // Responsive state for mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // SEO optimization for Feed Page
  useEffect(() => {
    document.title = "Lokal - Feed";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'Stay connected with African, Caribbean & Black businesses in your community. See latest updates, offers, and news from local stores on Lokal Shops feed.'
      );
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', 'https://lokalshops.co.uk/feed');
    }

    // Update keywords for feed page
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', 
        'community feed, store updates, african stores news, caribbean stores posts, black owned businesses community, local stores feed, store offers'
      );
    }

    // Add structured data for social media feed
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Community Feed - Lokal Shops",
      "description": "Community feed showcasing updates from African, Caribbean & Black stores",
      "url": "https://lokalshops.co.uk/feed",
      "mainEntity": {
        "@type": "SocialMediaPosting",
        "headline": "African, Caribbean & Black Stores Community Feed",
        "description": "Real-time updates from local stores in the African, Caribbean and Black community"
      }
    };

    // Remove existing structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }, []);

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Initialize liked posts state based on actual database data
  useEffect(() => {
    if (!user) return;
    
    const newLikedPosts = {};
    posts.forEach(post => {
      const likes = post.likes || [];
      newLikedPosts[post.id] = likes.includes(user.uid);
    });
    
    setLikedPosts(newLikedPosts);
  }, [posts, user]);

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
  
  const handleLike = async (postId) => {
    if (!user) return;
    
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return;
      
      const postData = postSnap.data();
      const likes = postData.likes || [];
      const liked = likes.includes(user.uid);
      
      const updatedLikes = liked 
        ? likes.filter(uid => uid !== user.uid) 
        : [...likes, user.uid];
      
      // Update with timestamp for notification tracking
      const updateData = { 
        likes: updatedLikes,
        lastLikeTimestamp: serverTimestamp() // Essential for seller notifications
      };
      
      await updateDoc(postRef, updateData);
      
      // Update local state for immediate UI feedback
      setLikedPosts(prev => ({ ...prev, [postId]: !liked }));
    } catch (error) {
      console.error("Error updating like:", error);
    }
  };

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
    
    // Try stores first (store owner)
    const storeProfileSnap = await getDoc(doc(db, 'stores', user.uid));
    if (storeProfileSnap.exists()) {
      const data = storeProfileSnap.data();
      name = data.storeName || '';
      photoURL = data.backgroundImg || data.photoURL || '';
      foundProfile = !!name;
    }
    
    // If not a store owner, try users collection (buyer)
    if (!foundProfile) {
      const userProfileSnap = await getDoc(doc(db, 'users', user.uid));
      if (userProfileSnap.exists()) {
        const data = userProfileSnap.data();
        name = data.displayName || data.name || data.firstName || '';
        photoURL = data.photoURL || data.profilePicture || '';
        foundProfile = !!name;
      }
    }
    
    // Fallback to Firebase Auth data if no Firestore profile
    if (!foundProfile) {
      name = user.displayName || user.email?.split('@')[0] || 'Anonymous User';
      photoURL = user.photoURL || '';
      foundProfile = true;
    }
    
    // Use default avatar if no photo
    if (!photoURL) photoURL = 'https://via.placeholder.com/32x32/007B7F/ffffff?text=' + (name.charAt(0).toUpperCase() || 'U');
    
    const newComment = {
      uid: user.uid,
      name,
      photoURL,
      text,
      timestamp: new Date(),
      likes: []
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
          lastLikeTimestamp: serverTimestamp() // Essential for seller notifications
        };
      });
      updateDoc(doc(db, 'posts', postId), { comments });
      return { ...post, comments };
    }));
  };

  const handleReplyInput = (commentIdx, value) => {
    setReplyInputs(prev => ({ ...prev, [commentIdx]: value }));
  };

  const handleThreadedReplyInput = (replyId, value) => {
    setThreadedReplyInputs(prev => ({ ...prev, [replyId]: value }));
  };

  const handleReply = (postId, parentIdx, isReplyToReply = false, parentReplyId = null) => {
    if (isReplyToReply) {
      setReplyingTo(prev => ({ 
        ...prev, 
        [postId]: { 
          type: 'reply', 
          commentIdx: parentIdx, 
          replyId: parentReplyId 
        } 
      }));
    } else {
      setReplyingTo(prev => ({ 
        ...prev, 
        [postId]: { 
          type: 'comment', 
          commentIdx: parentIdx 
        } 
      }));
    }
  };

  const handleReplyLike = async (postId, commentIndex, replyId) => {
    if (!user) return;
    
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (postDoc.exists()) {
        const postData = postDoc.data();
        const updatedComments = [...(postData.comments || [])];
        
        // Find the reply by ID (it could be at any level)
        const comment = updatedComments[commentIndex];
        if (!comment.replies) return;
        
        const replyIndex = comment.replies.findIndex(r => r.id === replyId || (typeof replyId === 'number' && comment.replies.indexOf(r) === replyId));
        if (replyIndex === -1) return;
        
        const reply = comment.replies[replyIndex];
        if (!reply.likes) reply.likes = [];
        
        const userLiked = reply.likes.includes(user.uid);
        
        if (userLiked) {
          // Unlike
          reply.likes = reply.likes.filter(uid => uid !== user.uid);
        } else {
          // Like
          reply.likes.push(user.uid);
          reply.lastLikeTimestamp = serverTimestamp();
        }
        
        await updateDoc(postRef, { comments: updatedComments });
        
        // Update local state
        setPosts(prevPosts => prevPosts.map(p => 
          p.id === postId ? { ...p, comments: updatedComments } : p
        ));
      }
    } catch (error) {
      console.error('Error liking reply:', error);
    }
  };

  const handleAddReply = async (postId, parentIdx) => {
    const replyContext = replyingTo[postId];
    if (!replyContext || !user) return;

    let text = '';
    if (replyContext.type === 'comment') {
      text = (replyInputs[parentIdx] || '').trim();
    } else {
      text = (threadedReplyInputs[replyContext.replyId] || '').trim();
    }

    if (!text) return;

    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const postData = postSnap.data();

    let name = '';
    let photoURL = '';
    let foundProfile = false;
    
    // Try stores first (store owner)
    const storeProfileSnap = await getDoc(doc(db, 'stores', user.uid));
    if (storeProfileSnap.exists()) {
      const data = storeProfileSnap.data();
      name = data.storeName || '';
      photoURL = data.backgroundImg || data.photoURL || '';
      foundProfile = !!name;
    }
    
    // If not a store owner, try users collection (buyer)
    if (!foundProfile) {
      const userProfileSnap = await getDoc(doc(db, 'users', user.uid));
      if (userProfileSnap.exists()) {
        const data = userProfileSnap.data();
        name = data.displayName || data.name || data.firstName || '';
        photoURL = data.photoURL || data.profilePicture || '';
        foundProfile = !!name;
      }
    }
    
    // Fallback to Firebase Auth data if no Firestore profile
    if (!foundProfile) {
      name = user.displayName || user.email?.split('@')[0] || 'Anonymous User';
      photoURL = user.photoURL || '';
      foundProfile = true;
    }
    
    // Use default avatar if no photo
    if (!photoURL) photoURL = 'https://via.placeholder.com/32x32/007B7F/ffffff?text=' + (name.charAt(0).toUpperCase() || 'U');
    
    const reply = {
      id: Date.now().toString(), // Generate unique ID for the reply
      uid: user.uid,
      name,
      photoURL,
      text,
      timestamp: new Date(),
      likes: [],
      replies: [],
      parentId: replyContext.type === 'reply' ? replyContext.replyId : null // Track parent for threading
    };

    const updatedComments = [...postData.comments];
    
    if (replyContext.type === 'comment') {
      // Reply to original comment
      updatedComments[parentIdx] = {
        ...updatedComments[parentIdx],
        replies: [...(updatedComments[parentIdx].replies || []), reply]
      };
    } else {
      // Reply to a reply - add to the same comment's replies array but with parentId set
      updatedComments[replyContext.commentIdx] = {
        ...updatedComments[replyContext.commentIdx],
        replies: [...(updatedComments[replyContext.commentIdx].replies || []), reply]
      };
    }

    await updateDoc(postRef, { comments: updatedComments });
    
    // Clear inputs
    if (replyContext.type === 'comment') {
      setReplyInputs(prev => ({ ...prev, [parentIdx]: '' }));
    } else {
      setThreadedReplyInputs(prev => ({ ...prev, [replyContext.replyId]: '' }));
    }
    
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

  // Reply menu handlers
  const handleReplyMenuToggle = (postId, commentIdx, replyIdx) => {
    const key = `${postId}_${commentIdx}_${replyIdx}`;
    setReplyMenuOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEditReply = (postId, commentIdx, replyIdx, text) => {
    setEditingReply({ postId, commentIdx, replyIdx });
    setEditReplyText({ postId, commentIdx, replyIdx, text });
    const key = `${postId}_${commentIdx}_${replyIdx}`;
    setReplyMenuOpen(prev => ({ ...prev, [key]: false }));
  };

  const handleEditReplyChange = (value) => {
    setEditReplyText(prev => ({ ...prev, text: value }));
  };

  const handleEditReplySave = async (postId, commentIdx, replyIdx) => {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const postData = postSnap.data();
    const updatedComments = postData.comments.map((c, i) => {
      if (i === commentIdx) {
        const updatedReplies = c.replies.map((r, ri) =>
          ri === replyIdx ? { ...r, text: editReplyText.text } : r
        );
        return { ...c, replies: updatedReplies };
      }
      return c;
    });
    await updateDoc(postRef, { comments: updatedComments });
    setEditingReply({});
    setEditReplyText({});
  };

  const handleEditReplyCancel = () => {
    setEditingReply({});
    setEditReplyText({});
  };

  const handleDeleteReply = async (postId, commentIdx, replyIdx) => {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const postData = postSnap.data();
    const updatedComments = postData.comments.map((c, i) => {
      if (i === commentIdx) {
        const updatedReplies = c.replies.filter((_, ri) => ri !== replyIdx);
        return { ...c, replies: updatedReplies };
      }
      return c;
    });
    await updateDoc(postRef, { comments: updatedComments });
    const key = `${postId}_${commentIdx}_${replyIdx}`;
    setReplyMenuOpen(prev => ({ ...prev, [key]: false }));
  };

  const handleToggleReplies = (postId, commentIdx) => {
    const key = `${postId}_${commentIdx}`;
    setExpandedReplies(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Function to count total comments including replies
  const getTotalCommentCount = (comments) => {
    if (!comments || comments.length === 0) return 0;
    
    let totalCount = comments.length; // Count main comments
    
    // Add reply counts
    comments.forEach(comment => {
      if (comment.replies && comment.replies.length > 0) {
        totalCount += comment.replies.length;
      }
    });
    
    return totalCount;
  };

  // Helper function to organize replies into threads
  const organizeRepliesIntoThreads = (replies) => {
    if (!replies || replies.length === 0) return [];
    
    const threadsMap = new Map();
    const rootReplies = [];
    
    // First pass: separate root replies from threaded replies
    replies.forEach(reply => {
      if (!reply.parentId) {
        // Root reply (direct reply to comment)
        rootReplies.push({ ...reply, children: [] });
        threadsMap.set(reply.id, rootReplies[rootReplies.length - 1]);
      }
    });
    
    // Second pass: attach threaded replies to their parents
    replies.forEach(reply => {
      if (reply.parentId) {
        const parent = threadsMap.get(reply.parentId);
        if (parent) {
          parent.children.push({ ...reply, children: [] });
          threadsMap.set(reply.id, parent.children[parent.children.length - 1]);
        } else {
          // Parent not found, treat as root reply
          rootReplies.push({ ...reply, children: [] });
          threadsMap.set(reply.id, rootReplies[rootReplies.length - 1]);
        }
      }
    });
    
    return rootReplies;
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

  // Share Store Item functions
  const fetchStoreItems = async () => {
    if (!user || !storeProfile) return;
    
    setLoadingItems(true);
    try {
      const itemsQuery = query(
        collection(db, 'stores', user.uid, 'items'),
        orderBy('createdAt', 'desc')
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      const items = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStoreItems(items);
    } catch (error) {
      console.error("Error fetching store items:", error);
      alert("Failed to load store items. Please try again.");
    }
    setLoadingItems(false);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    // Generate default share text
    const defaultText = `Check out this amazing item from our store! 🛍️

📦 ${item.name}
💰 £${item.price}
${item.category ? `🏷️ ${item.category}` : ''}

${item.description || 'Available now at our store!'}

#${storeProfile?.storeName?.replace(/\s+/g, '') || 'Store'} #LocalBusiness #SupportLocal`;

    setShareItemText(defaultText);
  };

  const handleShareItem = async () => {
    if (!selectedItem || !shareItemText.trim()) {
      alert('Please select an item and add some text to share.');
      return;
    }

    setShareItemLoading(true);

    try {
      // Create the post with filtered data (remove undefined values)
      const itemData = {};
      if (selectedItem.id) itemData.itemId = selectedItem.id;
      if (selectedItem.name) itemData.name = selectedItem.name;
      if (selectedItem.price !== undefined) itemData.price = selectedItem.price;
      if (selectedItem.category) itemData.category = selectedItem.category;
      if (selectedItem.description) itemData.description = selectedItem.description;
      if (selectedItem.image) itemData.image = selectedItem.image;

      await addDoc(collection(db, 'posts'), {
        storeId: user.uid,
        storeName: storeProfile.storeName,
        storeAvatar: storeProfile.backgroundImg || '',
        text: shareItemText,
        media: selectedItem.image ? [{ type: 'image', url: selectedItem.image }] : [],
        timestamp: serverTimestamp(),
        likes: [],
        comments: [],
        campaign: false,
        postType: 'shared-item',
        itemData: itemData
      });

      // Reset form
      setSelectedItem(null);
      setShareItemText('');
      setShowShareItemModal(false);

      alert('Item shared successfully!');
    } catch (error) {
      console.error("Error sharing item:", error);
      alert("Failed to share item. Please try again.");
    }
    setShareItemLoading(false);
  };

  const resetShareForm = () => {
    setSelectedItem(null);
    setShareItemText('');
    setShowShareItemModal(false);
  };

  const openShareModal = () => {
    setShowShareItemModal(true);
    fetchStoreItems();
  };

  // Handle report post functionality
  const handleReportPost = (postId) => {
    setReportingPostId(postId);
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!user || !reportReason.trim() || !reportingPostId) {
      alert('Please select a reason for reporting.');
      return;
    }

    setReportSubmitting(true);
    try {
      // Get user data for the report
      let userData = {
        userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        userEmail: user.email
      };

      // Try to get better user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const firestoreUserData = userDoc.data();
        userData = {
          userName: firestoreUserData.name || firestoreUserData.displayName || userData.userName,
          userEmail: firestoreUserData.email || user.email
        };
      }

      // Get the post being reported
      const reportedPost = posts.find(post => post.id === reportingPostId);
      
      // Submit the report to admin_complaints collection
      await addDoc(collection(db, 'admin_complaints'), {
        type: 'post_report',
        reason: reportReason,
        details: reportDetails.trim(),
        reportedPostId: reportingPostId,
        reportedPostText: reportedPost?.text || '',
        reportedStoreId: reportedPost?.storeId,
        reportedStoreName: reportedPost?.storeName,
        reporterUserId: user.uid,
        reporterName: userData.userName,
        reporterEmail: userData.userEmail,
        status: 'pending_review',
        submittedAt: serverTimestamp(),
        timestamp: serverTimestamp()
      });

      alert('Report submitted successfully. Our team will review it soon.');
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
      setReportingPostId(null);
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    }
    setReportSubmitting(false);
  };

  return (
    <div style={{ background: '#F0F2F5', minHeight: '100vh', padding: 0 }}>
      <Navbar />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 16px' }}>
        {storeProfile && (
          <div style={{ 
            background: '#ffffff', 
            borderRadius: '16px', 
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', 
            padding: '24px', 
            marginBottom: '24px',
            border: '1px solid rgba(0, 0, 0, 0.05)'
          }}>
            {/* Post Creation Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '16px',
              marginBottom: '20px'
            }}>
              <img 
                src={storeProfile.backgroundImg || 'https://via.placeholder.com/48'} 
                alt="Store Avatar" 
                style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '50%', 
                  objectFit: 'cover',
                  border: '2px solid #E4E6EA'
                }} 
              />
              <div style={{ flex: 1 }}>
                <textarea 
                  value={postText} 
                  onChange={e => setPostText(e.target.value)} 
                  placeholder="What's happening in your store today?" 
                  rows={3} 
                  style={{ 
                    width: '100%',
                    border: '1px solid #E4E6EA',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    fontSize: '16px',
                    lineHeight: '1.4',
                    background: '#F8F9FA',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#007B7F';
                    e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 127, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E4E6EA';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
            
            {/* Post Actions */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #E4E6EA'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', flex: 1 }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: isMobile ? '0' : '8px',
                  padding: isMobile ? '8px' : '8px 12px',
                  border: '1px solid #E4E6EA',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: '#F8F9FA',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#606770',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#E4E6EA';
                  e.target.style.borderColor = '#BDC3C7';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#F8F9FA';
                  e.target.style.borderColor = '#E4E6EA';
                }}
                >
                  <span style={{ fontSize: '16px' }}>📷</span>
                  {!isMobile && 'Add Media'}
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    multiple 
                    style={{ display: 'none' }}
                    onChange={handleMediaChange} 
                  />
                </label>
                
                <button
                  type="button"
                  onClick={openShareModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '0' : '8px',
                    padding: isMobile ? '8px' : '8px 12px',
                    border: '1px solid #E4E6EA',
                    borderRadius: '8px',
                    background: '#F8F9FA',
                    color: '#606770',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#E4E6EA';
                    e.target.style.borderColor = '#BDC3C7';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#F8F9FA';
                    e.target.style.borderColor = '#E4E6EA';
                  }}
                  title="Share an item from your store"
                >
                  <span style={{ fontSize: '16px' }}>🛍️</span>
                  {!isMobile && 'Share Item'}
                </button>

                <button
                  type="button"
                  onClick={handleToggleCampaign}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '0' : '8px',
                    padding: isMobile ? '8px' : '8px 12px',
                    border: isCampaign ? '1px solid #FFD700' : '1px solid #E4E6EA',
                    borderRadius: '8px',
                    background: isCampaign ? '#FFF8DC' : '#F8F9FA',
                    color: isCampaign ? '#B8860B' : '#606770',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title={isCampaign ? 'Remove Campaign Tag' : 'Mark as Campaign'}
                >
                  <span style={{ fontSize: '16px' }}>📢</span>
                  {!isMobile && 'Campaign'}
                </button>
              </div>
              
              <button 
                type="button" 
                onClick={handlePost} 
                disabled={loading || (!postText.trim() && mediaFiles.length === 0)} 
                style={{ 
                  background: (!postText.trim() && mediaFiles.length === 0) ? '#BDC3C7' : '#007B7F',
                  color: '#ffffff', 
                  border: 'none', 
                  borderRadius: '8px', 
                  padding: '10px 24px', 
                  fontWeight: '600', 
                  fontSize: '14px', 
                  cursor: (!postText.trim() && mediaFiles.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                  minWidth: '80px'
                }}
                onMouseEnter={(e) => {
                  if (!loading && (postText.trim() || mediaFiles.length > 0)) {
                    e.target.style.background = '#006367';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && (postText.trim() || mediaFiles.length > 0)) {
                    e.target.style.background = '#007B7F';
                  }
                }}
              >
                {loading ? 'Posting...' : 'Post'}
              </button>
            </div>
            
            {/* Media Preview */}
            {mediaFiles.length > 0 && (
              <div style={{ 
                marginTop: '16px',
                padding: '16px',
                background: '#F8F9FA',
                border: '1px solid #E4E6EA',
                borderRadius: '12px'
              }}>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <h4 style={{ 
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1C1E21'
                  }}>
                    Selected Media ({mediaFiles.length})
                  </h4>
                  <button
                    onClick={() => setMediaFiles([])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#E41E3F',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#FFF5F5'}
                    onMouseLeave={(e) => e.target.style.background = 'none'}
                  >
                    Clear All
                  </button>
                </div>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {mediaFiles.map((file, index) => (
                    <div key={index} style={{ 
                      position: 'relative',
                      background: '#ffffff',
                      border: '1px solid #E4E6EA',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      {file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '80px',
                            objectFit: 'cover'
                          }}
                        />
                      ) : file.type.startsWith('video/') ? (
                        <div style={{ 
                          width: '100%',
                          height: '80px',
                          background: '#000000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}>
                          <video
                            src={URL.createObjectURL(file)}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            muted
                          />
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: '10px'
                          }}>
                            ▶
                          </div>
                        </div>
                      ) : (
                        <div style={{ 
                          width: '100%',
                          height: '80px',
                          background: '#F0F2F5',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '16px', marginBottom: '4px' }}>📄</div>
                          <div style={{ 
                            fontSize: '10px',
                            color: '#65676B',
                            fontWeight: '500',
                            wordBreak: 'break-all',
                            lineHeight: '1.2'
                          }}>
                            {file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name}
                          </div>
                        </div>
                      )}
                      
                      {/* Remove individual file button */}
                      <button
                        onClick={() => {
                          const newFiles = mediaFiles.filter((_, i) => i !== index);
                          setMediaFiles(newFiles);
                        }}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0, 0, 0, 0.7)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          color: '#ffffff',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}
                        title="Remove this file"
                      >
                        ×
                      </button>
                      
                      {/* File size info */}
                      <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        left: '2px',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: '#ffffff',
                        fontSize: '8px',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        fontWeight: '500'
                      }}>
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Campaign Notice */}
            {isCampaign && (
              <div style={{ 
                marginTop: '16px',
                padding: '12px 16px',
                background: '#FFF8DC',
                border: '1px solid #FFD700',
                borderRadius: '8px',
                color: '#B8860B',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>📢</span>
                This post will be marked as a promotional campaign
              </div>
            )}
          </div>
        )}

        {posts.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 24px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
            <h3 style={{ 
              color: '#1C1E21', 
              fontSize: '20px', 
              fontWeight: '600', 
              margin: '0 0 8px 0' 
            }}>
              {storeProfile ? "Share your first post" : "No posts to show"}
            </h3>
            <p style={{ 
              color: '#65676B', 
              fontSize: '16px', 
              margin: 0,
              lineHeight: '1.4'
            }}>
              {storeProfile 
                ? "Share updates, promotions, and connect with your customers." 
                : "Follow stores to see their latest updates and promotions here."
              }
            </p>
          </div>
        ) : (
          posts.map(post => {
            const storeProfileForPost = storeProfilesById[post.storeId];
            const avatarUrl = storeProfileForPost && storeProfileForPost.backgroundImg ? storeProfileForPost.backgroundImg : 'https://via.placeholder.com/48';
            return (
              <div key={post.id} style={{ 
                background: '#ffffff', 
                borderRadius: '16px', 
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', 
                marginBottom: '24px', 
                position: 'relative',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                overflow: 'hidden'
              }}>
                {/* Three dots menu */}
                {user && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                    <button 
                      onClick={() => handleMenuToggle(post.id)} 
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.9)', 
                        border: '1px solid rgba(0, 0, 0, 0.1)', 
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        fontSize: '16px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#65676B',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#F0F2F5';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                      }}
                    >
                      &#8942;
                    </button>
                    {menuOpen[post.id] && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '36px', 
                        right: '0', 
                        background: '#ffffff', 
                        border: '1px solid #E4E6EA', 
                        borderRadius: '8px', 
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)', 
                        minWidth: '120px',
                        overflow: 'hidden'
                      }}>
                        {/* Owner options */}
                        {post.storeId === user.uid ? (
                          <>
                            <button 
                              onClick={() => handleEditPost(post)} 
                              style={{ 
                                display: 'block', 
                                width: '100%', 
                                background: 'none', 
                                border: 'none', 
                                padding: '12px 16px', 
                                textAlign: 'left', 
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#1C1E21',
                                transition: 'background-color 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#F0F2F5'}
                              onMouseLeave={(e) => e.target.style.background = 'none'}
                            >
                              Edit Post
                            </button>
                            <button 
                              onClick={() => handleDeletePost(post.id)} 
                              style={{ 
                                display: 'block', 
                                width: '100%', 
                                background: 'none', 
                                border: 'none', 
                                padding: '12px 16px', 
                                textAlign: 'left', 
                                color: '#E41E3F', 
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                transition: 'background-color 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#FFF5F5'}
                              onMouseLeave={(e) => e.target.style.background = 'none'}
                            >
                              Delete Post
                            </button>
                          </>
                        ) : (
                          /* Buyer options */
                          <button 
                            onClick={() => {
                              handleReportPost(post.id);
                              setMenuOpen(prev => ({ ...prev, [post.id]: false }));
                            }} 
                            style={{ 
                              display: 'block', 
                              width: '100%', 
                              background: 'none', 
                              border: 'none', 
                              padding: '12px 16px', 
                              textAlign: 'left', 
                              color: '#E41E3F', 
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              transition: 'background-color 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#FFF5F5'}
                            onMouseLeave={(e) => e.target.style.background = 'none'}
                          >
                            <span style={{ fontSize: '12px' }}>🚩</span>
                            Report Post
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Edit mode */}
                {editingPostId === post.id ? (
                  <div style={{ padding: '24px' }}>
                    <textarea 
                      value={editText} 
                      onChange={e => setEditText(e.target.value)} 
                      rows={3} 
                      style={{ 
                        width: '100%', 
                        borderRadius: '12px', 
                        border: '1px solid #E4E6EA', 
                        padding: '14px 18px', 
                        fontSize: '16px',
                        lineHeight: '1.4',
                        marginBottom: '16px',
                        background: '#F8F9FA',
                        outline: 'none',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }} 
                    />
                    
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        border: '1px solid #E4E6EA',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: '#F8F9FA',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#606770',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#E4E6EA';
                        e.target.style.borderColor = '#BDC3C7';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#F8F9FA';
                        e.target.style.borderColor = '#E4E6EA';
                      }}
                      >
                        <span style={{ fontSize: '16px' }}>📷</span>
                        Update Media
                        <input type="file" accept="image/*,video/*" multiple onChange={handleEditMediaChange} style={{ display: 'none' }} />
                      </label>
                    </div>
                    
                    {/* Existing Media Preview */}
                    {editMediaUrls.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h5 style={{ 
                          margin: '0 0 8px 0',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#65676B'
                        }}>
                          Current Media:
                        </h5>
                        <div style={{ 
                          display: 'flex', 
                          gap: '8px', 
                          flexWrap: 'wrap'
                        }}>
                          {editMediaUrls.map((m, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <img 
                                src={m.url} 
                                alt="Current media" 
                                style={{ 
                                  width: '80px', 
                                  height: '80px', 
                                  objectFit: 'cover', 
                                  borderRadius: '8px',
                                  border: '1px solid #E4E6EA'
                                }} 
                              />
                              <button
                                onClick={() => {
                                  const newUrls = editMediaUrls.filter((_, index) => index !== i);
                                  setEditMediaUrls(newUrls);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '2px',
                                  right: '2px',
                                  background: 'rgba(0, 0, 0, 0.7)',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '16px',
                                  height: '16px',
                                  color: '#ffffff',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold'
                                }}
                                title="Remove this media"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Media Preview */}
                    {editMediaFiles.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h5 style={{ 
                          margin: '0 0 8px 0',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#65676B'
                        }}>
                          New Media to Add:
                        </h5>
                        <div style={{ 
                          display: 'flex', 
                          gap: '8px', 
                          flexWrap: 'wrap'
                        }}>
                          {editMediaFiles.map((file, index) => (
                            <div key={index} style={{ position: 'relative' }}>
                              {file.type.startsWith('image/') ? (
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`New preview ${index + 1}`}
                                  style={{
                                    width: '80px',
                                    height: '80px',
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    border: '1px solid #E4E6EA'
                                  }}
                                />
                              ) : file.type.startsWith('video/') ? (
                                <div style={{ 
                                  width: '80px',
                                  height: '80px',
                                  background: '#000000',
                                  borderRadius: '8px',
                                  border: '1px solid #E4E6EA',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}>
                                  <video
                                    src={URL.createObjectURL(file)}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                    muted
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'rgba(0, 0, 0, 0.7)',
                                    borderRadius: '50%',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    fontSize: '8px'
                                  }}>
                                    ▶
                                  </div>
                                </div>
                              ) : (
                                <div style={{ 
                                  width: '80px',
                                  height: '80px',
                                  background: '#F0F2F5',
                                  borderRadius: '8px',
                                  border: '1px solid #E4E6EA',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '4px',
                                  textAlign: 'center'
                                }}>
                                  <div style={{ fontSize: '12px', marginBottom: '2px' }}>📄</div>
                                  <div style={{ 
                                    fontSize: '8px',
                                    color: '#65676B',
                                    fontWeight: '500',
                                    wordBreak: 'break-all',
                                    lineHeight: '1.1'
                                  }}>
                                    {file.name.length > 10 ? `${file.name.substring(0, 8)}...` : file.name}
                                  </div>
                                </div>
                              )}
                              
                              <button
                                onClick={() => {
                                  const newFiles = editMediaFiles.filter((_, i) => i !== index);
                                  setEditMediaFiles(newFiles);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '2px',
                                  right: '2px',
                                  background: 'rgba(0, 0, 0, 0.7)',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '16px',
                                  height: '16px',
                                  color: '#ffffff',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold'
                                }}
                                title="Remove this file"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button 
                        onClick={() => handleEditSave(post.id)} 
                        style={{ 
                          background: '#007B7F', 
                          color: '#ffffff', 
                          border: 'none', 
                          borderRadius: '8px', 
                          padding: '10px 20px', 
                          fontWeight: '600',
                          fontSize: '14px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#006367'}
                        onMouseLeave={(e) => e.target.style.background = '#007B7F'}
                      >
                        Save Changes
                      </button>
                      <button 
                        onClick={handleEditCancel} 
                        style={{ 
                          background: '#F0F2F5', 
                          color: '#65676B', 
                          border: '1px solid #E4E6EA', 
                          borderRadius: '8px', 
                          padding: '10px 20px', 
                          fontWeight: '600',
                          fontSize: '14px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#E4E6EA';
                          e.target.style.color = '#1C1E21';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#F0F2F5';
                          e.target.style.color = '#65676B';
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Post Header */}
                    <div style={{ padding: '20px 24px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                        <img 
                          src={avatarUrl} 
                          alt={post.storeName} 
                          style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '50%', 
                            objectFit: 'cover',
                            border: '2px solid #E4E6EA'
                          }} 
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h4 style={{ 
                                fontWeight: '600',
                                fontSize: '16px',
                                color: '#1C1E21',
                                margin: 0
                              }}>
                                {post.storeName}
                              </h4>
                              {post.campaign && (
                                <span style={{
                                  background: '#FFF8DC',
                                  color: '#B8860B',
                                  fontWeight: '600',
                                  borderRadius: '12px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  border: '1px solid #FFD700'
                                }}>
                                  <span role="img" aria-label="campaign">📢</span>
                                  Campaign
                                </span>
                              )}
                            </div>
                            <div style={{ 
                              color: '#65676B', 
                              fontSize: '13px',
                              fontWeight: '400'
                            }}>
                              {post.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div style={{ 
                            color: '#65676B', 
                            fontSize: '13px',
                            fontWeight: '400',
                            marginBottom: '12px',
                            textAlign: 'left'
                          }}>
                            {post.timestamp?.toDate().toLocaleDateString('en-GB', { 
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Shared Item Badge */}
                      {post.postType === 'shared-item' && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#E6F7F7',
                          color: '#007B7F',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: '600',
                          marginBottom: '12px',
                          border: '1px solid #B8E6E6'
                        }}>
                          <span>🛍️</span>
                          Shared Store Item
                        </div>
                      )}
                      
                      {/* Post Content */}
                      {post.text && (
                        <p style={{ 
                          margin: '0',
                          fontSize: '16px',
                          lineHeight: '1.5',
                          color: '#1C1E21',
                          whiteSpace: 'pre-wrap',
                          textAlign: 'left',
                          paddingLeft: '0'
                        }}>
                          {post.text}
                        </p>
                      )}
                      
                      {/* Shared Item Details */}
                      {post.postType === 'shared-item' && post.itemData && (
                        <div style={{
                          background: '#F8F9FA',
                          border: '1px solid #E4E6EA',
                          borderRadius: '12px',
                          padding: '16px',
                          marginTop: '12px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <h4 style={{
                              margin: '0',
                              fontSize: '18px',
                              fontWeight: '700',
                              color: '#1C1E21'
                            }}>
                              {post.itemData.name}
                            </h4>
                            <span style={{
                              fontSize: '18px',
                              fontWeight: '700',
                              color: '#007B7F'
                            }}>
                              £{post.itemData.price}
                            </span>
                          </div>
                          {post.itemData.category && (
                            <div style={{
                              fontSize: '14px',
                              color: '#65676B',
                              marginBottom: '8px'
                            }}>
                              Category: {post.itemData.category}
                            </div>
                          )}
                          {post.itemData.description && (
                            <div style={{
                              fontSize: '14px',
                              color: '#65676B',
                              lineHeight: '1.4'
                            }}>
                              {post.itemData.description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {/* Post Media */}
                {post.media && post.media.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: post.media.length === 1 ? '1fr' : post.media.length === 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '8px',
                    marginBottom: '16px'
                  }}>
                    {post.media.map((m, idx) => (
                      m.type === 'image' ? (
                        <div key={idx} style={{ position: 'relative' }}>
                          <img
                            src={m.url}
                            alt="Post content"
                            style={{ 
                              width: '100%', 
                              height: post.media.length === 1 ? '400px' : '200px', 
                              objectFit: 'cover', 
                              borderRadius: '12px', 
                              cursor: 'pointer',
                              transition: 'transform 0.2s ease'
                            }}
                            onClick={() => post.postType === 'shared-item' ? navigate(`/store-preview/${post.storeId}`) : handleMediaClick(m.url, 'image')}
                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                          />
                          {/* Store redirect icon for shared items */}
                          {post.postType === 'shared-item' && (
                            <div style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              background: 'rgba(0, 0, 0, 0.7)',
                              borderRadius: '50%',
                              width: '40px',
                              height: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              zIndex: 2
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/store-preview/${post.storeId}`);
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'rgba(0, 123, 127, 0.9)';
                              e.target.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'rgba(0, 0, 0, 0.7)';
                              e.target.style.transform = 'scale(1)';
                            }}
                            title="Visit Store"
                          >
                            <span style={{ color: 'white', fontSize: '18px' }}>🛍️</span>
                          </div>
                          )}
                        </div>
                      ) : m.type === 'video' ? (
                        <video
                          key={idx}
                          src={m.url}
                          controls
                          style={{ 
                            width: '100%', 
                            height: post.media.length === 1 ? '400px' : '200px', 
                            borderRadius: '12px',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleMediaClick(m.url, 'video')}
                        />
                      ) : null
                    ))}
                  </div>
                )}
                
                {/* Post Stats */}
                <div style={{ 
                  padding: '12px 24px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  color: '#65676B',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span>
                    {(post.likes || []).length > 0 && 
                      `${(post.likes || []).length} ${(post.likes || []).length === 1 ? 'like' : 'likes'}`
                    }
                  </span>
                  <span>
                    {getTotalCommentCount(post.comments) > 0 && 
                      `${getTotalCommentCount(post.comments)} ${getTotalCommentCount(post.comments) === 1 ? 'comment' : 'comments'}`
                    }
                  </span>
                </div>
                
                {/* Post Actions */}
                <div style={{ 
                  borderTop: '1px solid #E4E6EA', 
                  display: 'flex',
                  margin: '0 24px'
                }}>
                  <button 
                    onClick={() => handleLike(post.id)} 
                    style={{ 
                      flex: 1, 
                      background: 'none', 
                      border: 'none', 
                      padding: '14px 16px', 
                      fontWeight: '600',
                      fontSize: '15px',
                      color: likedPosts[post.id] ? '#007B7F' : '#65676B', 
                      cursor: 'pointer',
                      borderRadius: '8px',
                      margin: '8px 4px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#F0F2F5';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{likedPosts[post.id] ? '❤️' : '🤍'}</span>
                    Like
                  </button>
                  <button 
                    onClick={() => handleToggleComments(post.id)} 
                    style={{ 
                      flex: 1, 
                      background: 'none', 
                      border: 'none', 
                      padding: '14px 16px', 
                      fontWeight: '600',
                      fontSize: '15px',
                      color: '#65676B', 
                      cursor: 'pointer',
                      borderRadius: '8px',
                      margin: '8px 4px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#F0F2F5';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>💬</span>
                    Comment
                  </button>
                  {/* View in Store button for shared items */}
                  {post.postType === 'shared-item' && (
                    <button 
                      onClick={() => navigate(`/store-preview/${post.storeId}`)} 
                      style={{ 
                        flex: 1, 
                        background: 'none', 
                        border: 'none', 
                        padding: '14px 16px', 
                        fontWeight: '600',
                        fontSize: '15px',
                        color: '#007B7F', 
                        cursor: 'pointer',
                        borderRadius: '8px',
                        margin: '8px 4px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#E6F7F7';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'none';
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>🛍️</span>
                      View in Store
                    </button>
                  )}
                </div>
                {/* Comments Section */}
                {openComments[post.id] && (
                  <div style={{ 
                    borderTop: '1px solid #E4E6EA',
                    background: '#F8F9FA'
                  }}>
                    <div style={{ 
                      padding: '20px 24px 16px',
                      borderBottom: '1px solid #E4E6EA',
                      background: '#ffffff'
                    }}>
                      <h4 style={{ 
                        margin: '0 0 16px 0',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1C1E21'
                      }}>
                        Comments ({getTotalCommentCount(post.comments)})
                      </h4>
                      
                      {/* Add Comment */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <img 
                          src={(() => {
                            if (!user) return 'https://via.placeholder.com/36x36/007B7F/ffffff?text=U';
                            if (storeProfile && storeProfile.backgroundImg) return storeProfile.backgroundImg;
                            if (user.photoURL) return user.photoURL;
                            const userName = user.displayName || user.email?.split('@')[0] || 'U';
                            return `https://via.placeholder.com/36x36/007B7F/ffffff?text=${userName.charAt(0).toUpperCase()}`;
                          })()}
                          alt="Your avatar"
                          style={{ 
                            width: '36px', 
                            height: '36px', 
                            borderRadius: '50%', 
                            objectFit: 'cover',
                            border: '1px solid #E4E6EA'
                          }}
                        />
                        <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={e => handleCommentInput(post.id, e.target.value)}
                            placeholder="Write a comment..."
                            style={{ 
                              flex: 1, 
                              borderRadius: '20px', 
                              border: '1px solid #E4E6EA', 
                              padding: '10px 16px',
                              fontSize: '14px',
                              outline: 'none',
                              background: '#ffffff'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#007B7F';
                              e.target.style.boxShadow = '0 0 0 2px rgba(0, 123, 127, 0.1)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#E4E6EA';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                          <button 
                            onClick={() => handleAddComment(post.id)} 
                            disabled={!(commentInputs[post.id] || '').trim()}
                            style={{ 
                              background: (commentInputs[post.id] || '').trim() ? '#007B7F' : '#BDC3C7',
                              color: '#ffffff', 
                              border: 'none', 
                              borderRadius: '20px', 
                              padding: '10px 20px', 
                              fontWeight: '600',
                              fontSize: '14px',
                              cursor: (commentInputs[post.id] || '').trim() ? 'pointer' : 'not-allowed',
                              transition: 'background-color 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              if ((commentInputs[post.id] || '').trim()) {
                                e.target.style.background = '#006367';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if ((commentInputs[post.id] || '').trim()) {
                                e.target.style.background = '#007B7F';
                              }
                            }}
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Comments List */}
                    <div style={{ padding: '16px 24px' }}>
                      {post.comments && post.comments.length > 0 ? (
                        post.comments.map((c, i) => (
                          <div key={i} style={{ 
                            marginBottom: '16px', 
                            padding: '16px', 
                            background: '#ffffff', 
                            borderRadius: '12px', 
                            border: '1px solid #E4E6EA',
                            position: 'relative'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <img 
                                src={c.photoURL || 'https://via.placeholder.com/40'} 
                                alt={c.name} 
                                style={{ 
                                  width: '40px', 
                                  height: '40px', 
                                  borderRadius: '50%', 
                                  objectFit: 'cover',
                                  border: '1px solid #E4E6EA'
                                }} 
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <span style={{ 
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    color: '#1C1E21'
                                  }}>
                                    {c.name}
                                  </span>
                                  <span style={{ 
                                    color: '#65676B', 
                                    fontSize: '12px'
                                  }}>
                                    {c.timestamp && (c.timestamp.seconds ? new Date(c.timestamp.seconds * 1000).toLocaleString() : new Date(c.timestamp).toLocaleString())}
                                  </span>
                                </div>
                                
                                {/* Comment Content */}
                                {editingComment.postId === post.id && editingComment.commentIdx === i ? (
                                  <div style={{ marginBottom: '12px' }}>
                                    <input 
                                      type="text" 
                                      value={editCommentText.text} 
                                      onChange={e => handleEditCommentChange(e.target.value)} 
                                      style={{ 
                                        width: '100%', 
                                        borderRadius: '8px', 
                                        border: '1px solid #E4E6EA', 
                                        padding: '8px 12px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        marginBottom: '8px'
                                      }} 
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <button 
                                        onClick={() => handleEditCommentSave(post.id, i)} 
                                        style={{ 
                                          background: '#007B7F', 
                                          color: '#ffffff', 
                                          border: 'none', 
                                          borderRadius: '6px', 
                                          padding: '6px 12px', 
                                          fontWeight: '600',
                                          fontSize: '12px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Save
                                      </button>
                                      <button 
                                        onClick={handleEditCommentCancel} 
                                        style={{ 
                                          background: '#F0F2F5', 
                                          color: '#65676B', 
                                          border: '1px solid #E4E6EA', 
                                          borderRadius: '6px', 
                                          padding: '6px 12px', 
                                          fontWeight: '600',
                                          fontSize: '12px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p style={{ 
                                    color: '#1C1E21', 
                                    fontSize: '14px',
                                    lineHeight: '1.4',
                                    margin: '0 0 12px 0',
                                    textAlign: 'left',
                                    paddingLeft: '0'
                                  }}>
                                    {c.text}
                                  </p>
                                )}
                                
                                {/* Comment Actions */}
                                <div style={{ display: 'flex', gap: '16px' }}>
                                  <button 
                                    onClick={() => handleCommentLike(post.id, i)} 
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      color: (c.likes || []).includes(user?.uid) ? '#007B7F' : '#65676B', 
                                      fontWeight: '600',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <span style={{ fontSize: '14px' }}>{(c.likes || []).includes(user?.uid) ? '❤️' : '🤍'}</span>
                                    Like {c.likes && c.likes.length > 0 ? `(${c.likes.length})` : ''}
                                  </button>
                                  <button 
                                    onClick={() => handleReply(post.id, i, false, null)} 
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      color: '#65676B', 
                                      fontWeight: '600',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Reply
                                  </button>
                                </div>
                                
                                {/* Reply Input */}
                                {replyingTo[post.id] && replyingTo[post.id].type === 'comment' && replyingTo[post.id].commentIdx === i && (
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <input
                                      type="text"
                                      value={replyInputs[i] || ''}
                                      onChange={e => handleReplyInput(i, e.target.value)}
                                      placeholder="Write a reply..."
                                      style={{ 
                                        flex: 1, 
                                        borderRadius: '20px', 
                                        border: '1px solid #E4E6EA', 
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        outline: 'none'
                                      }}
                                    />
                                    <button 
                                      onClick={() => handleAddReply(post.id, i)} 
                                      style={{ 
                                        background: '#007B7F', 
                                        color: '#ffffff', 
                                        border: 'none', 
                                        borderRadius: '20px', 
                                        padding: '8px 16px', 
                                        fontWeight: '600',
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Reply
                                    </button>
                                  </div>
                                )}
                                
                                {/* Replies */}
                                {c.replies && c.replies.length > 0 && (
                                  <div style={{ marginTop: '12px' }}>
                                    {/* View Replies Button */}
                                    <button
                                      onClick={() => handleToggleReplies(post.id, i)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#1877F2',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        padding: '4px 0',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <span style={{ fontSize: '10px' }}>
                                        {expandedReplies[`${post.id}_${i}`] ? '▼' : '▶'}
                                      </span>
                                      {expandedReplies[`${post.id}_${i}`] 
                                        ? `Hide ${c.replies.length} ${c.replies.length === 1 ? 'reply' : 'replies'}`
                                        : `View ${c.replies.length} ${c.replies.length === 1 ? 'reply' : 'replies'}`
                                      }
                                    </button>
                                    
                                    {/* Replies Container - Only show when expanded */}
                                    {expandedReplies[`${post.id}_${i}`] && (
                                      <div style={{ paddingLeft: '20px', borderLeft: '2px solid #E4E6EA' }}>
                                        {organizeRepliesIntoThreads(c.replies).map((threadedReply) => (
                                          <div key={threadedReply.id} style={{ 
                                            marginBottom: '8px', 
                                            padding: '8px 12px', 
                                            background: '#F8F9FA', 
                                            borderRadius: '8px'
                                          }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <img 
                                                  src={threadedReply.photoURL || 'https://via.placeholder.com/24'} 
                                                  alt={threadedReply.name} 
                                                  style={{ 
                                                    width: '24px', 
                                                    height: '24px', 
                                                    borderRadius: '50%', 
                                                    objectFit: 'cover'
                                                  }} 
                                                />
                                                <span style={{ 
                                                  fontWeight: '600',
                                                  fontSize: '12px',
                                                  color: '#1C1E21'
                                                }}>
                                                  {threadedReply.name}
                                                </span>
                                                <span style={{ 
                                                  color: '#65676B', 
                                                  fontSize: '11px'
                                                }}>
                                                  {threadedReply.timestamp && (threadedReply.timestamp.seconds ? new Date(threadedReply.timestamp.seconds * 1000).toLocaleString() : new Date(threadedReply.timestamp).toLocaleString())}
                                                </span>
                                              </div>
                                              
                                              {/* Reply Menu - Only show for reply owner */}
                                              {user && threadedReply.uid === user.uid && (
                                                <div style={{ position: 'relative' }}>
                                                  <button 
                                                    onClick={() => handleReplyMenuToggle(post.id, i, threadedReply.id)} 
                                                    style={{ 
                                                      background: 'none', 
                                                      border: 'none', 
                                                      fontSize: '14px', 
                                                      cursor: 'pointer', 
                                                      padding: '2px',
                                                      color: '#65676B',
                                                      borderRadius: '50%',
                                                      width: '20px',
                                                      height: '20px',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center'
                                                    }}
                                                  >
                                                    &#8942;
                                                  </button>
                                                  {replyMenuOpen[`${post.id}_${i}_${threadedReply.id}`] && (
                                                    <div style={{ 
                                                      position: 'absolute', 
                                                      top: '24px', 
                                                      right: '0', 
                                                      background: '#ffffff', 
                                                      border: '1px solid #E4E6EA', 
                                                      borderRadius: '8px', 
                                                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)', 
                                                      minWidth: '80px',
                                                      overflow: 'hidden',
                                                      zIndex: 1000
                                                    }}>
                                                      <button
                                                        onClick={() => handleEditReply(post.id, i, threadedReply.id, threadedReply.text)}
                                                        style={{ 
                                                          width: '100%', 
                                                          padding: '8px 12px', 
                                                          background: 'none', 
                                                          border: 'none', 
                                                          textAlign: 'left', 
                                                          cursor: 'pointer', 
                                                          fontSize: '12px',
                                                          color: '#1C1E21'
                                                        }}
                                                      >
                                                        ✏️ Edit
                                                      </button>
                                                      <button
                                                        onClick={() => handleDeleteReply(post.id, i, threadedReply.id)}
                                                        style={{ 
                                                          width: '100%', 
                                                          padding: '8px 12px', 
                                                          background: 'none', 
                                                          border: 'none', 
                                                          textAlign: 'left', 
                                                          cursor: 'pointer', 
                                                          fontSize: '12px',
                                                          color: '#E41E3F'
                                                        }}
                                                      >
                                                        🗑️ Delete
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            
                                            {/* Reply text */}
                                            <p style={{ 
                                              color: '#1C1E21', 
                                              fontSize: '12px',
                                              margin: '0 0 8px 0',
                                              lineHeight: '1.3',
                                              textAlign: 'left',
                                              paddingLeft: '0'
                                            }}>
                                              {threadedReply.text}
                                            </p>
                                            
                                            {/* Reply actions */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                                              <button 
                                                onClick={() => handleReplyLike(post.id, i, threadedReply.id)}
                                                style={{ 
                                                  background: 'none', 
                                                  border: 'none', 
                                                  color: threadedReply.likes && threadedReply.likes.includes(user?.uid) ? '#1877F2' : '#65676B', 
                                                  cursor: 'pointer', 
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '4px',
                                                  padding: '2px 4px',
                                                  borderRadius: '4px',
                                                  transition: 'background-color 0.2s ease'
                                                }}
                                                onMouseEnter={e => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                                                onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                                              >
                                                {threadedReply.likes && threadedReply.likes.includes(user?.uid) ? '❤️' : '🤍'} Like
                                                {threadedReply.likes && threadedReply.likes.length > 0 && (
                                                  <span style={{ fontSize: '10px', marginLeft: '2px' }}>
                                                    ({threadedReply.likes.length})
                                                  </span>
                                                )}
                                              </button>
                                              
                                              <button 
                                                onClick={() => handleReply(post.id, i, true, threadedReply.id)}
                                                style={{ 
                                                  background: 'none', 
                                                  border: 'none', 
                                                  color: '#65676B', 
                                                  cursor: 'pointer', 
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  padding: '2px 4px',
                                                  borderRadius: '4px',
                                                  transition: 'background-color 0.2s ease'
                                                }}
                                                onMouseEnter={e => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                                                onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                                              >
                                                💬 Reply
                                              </button>
                                            </div>
                                            
                                            {/* Threaded reply input */}
                                            {replyingTo[post.id] && replyingTo[post.id].type === 'reply' && replyingTo[post.id].replyId === threadedReply.id && (
                                              <div style={{ marginTop: '8px' }}>
                                                <textarea 
                                                  value={threadedReplyInputs[threadedReply.id] || ''}
                                                  onChange={(e) => handleThreadedReplyInput(threadedReply.id, e.target.value)}
                                                  placeholder={`Reply to ${threadedReply.name}...`}
                                                  style={{ 
                                                    width: '100%', 
                                                    minHeight: '60px',
                                                    padding: '8px', 
                                                    fontSize: '12px',
                                                    border: '1px solid #E4E6EA', 
                                                    borderRadius: '6px', 
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit'
                                                  }}
                                                />
                                                <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                                                  <button 
                                                    onClick={() => handleAddReply(post.id, i)}
                                                    style={{ 
                                                      background: '#1877F2', 
                                                      color: 'white', 
                                                      border: 'none', 
                                                      padding: '4px 12px', 
                                                      borderRadius: '4px', 
                                                      fontSize: '11px',
                                                      cursor: 'pointer'
                                                    }}
                                                  >
                                                    Reply
                                                  </button>
                                                  <button 
                                                    onClick={() => setReplyingTo(prev => ({ ...prev, [post.id]: null }))}
                                                    style={{ 
                                                      background: '#E4E6EA', 
                                                      color: '#65676B', 
                                                      border: 'none', 
                                                      padding: '4px 12px', 
                                                      borderRadius: '4px', 
                                                      fontSize: '11px',
                                                      cursor: 'pointer'
                                                    }}
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* Render child replies recursively */}
                                            {threadedReply.children && threadedReply.children.length > 0 && (
                                              <div style={{ paddingLeft: '12px', borderLeft: '1px solid #E4E6EA', marginTop: '8px' }}>
                                                {threadedReply.children.map(childReply => (
                                                  <div key={childReply.id} style={{ 
                                                    marginBottom: '6px', 
                                                    padding: '6px 10px', 
                                                    background: '#FFFFFF', 
                                                    borderRadius: '6px',
                                                    border: '1px solid #E4E6EA'
                                                  }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                      <img 
                                                        src={childReply.photoURL || 'https://via.placeholder.com/20'} 
                                                        alt={childReply.name} 
                                                        style={{ 
                                                          width: '20px', 
                                                          height: '20px', 
                                                          borderRadius: '50%', 
                                                          objectFit: 'cover'
                                                        }} 
                                                      />
                                                      <span style={{ 
                                                        fontWeight: '600',
                                                        fontSize: '11px',
                                                        color: '#1C1E21'
                                                      }}>
                                                        {childReply.name}
                                                      </span>
                                                      <span style={{ 
                                                        color: '#65676B', 
                                                        fontSize: '10px'
                                                      }}>
                                                        {childReply.timestamp && (childReply.timestamp.seconds ? new Date(childReply.timestamp.seconds * 1000).toLocaleString() : new Date(childReply.timestamp).toLocaleString())}
                                                      </span>
                                                    </div>
                                                    <p style={{ 
                                                      color: '#1C1E21', 
                                                      fontSize: '11px',
                                                      margin: '0 0 6px 0',
                                                      lineHeight: '1.3'
                                                    }}>
                                                      {childReply.text}
                                                    </p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                      <button 
                                                        onClick={() => handleReplyLike(post.id, i, childReply.id)}
                                                        style={{ 
                                                          background: 'none', 
                                                          border: 'none', 
                                                          color: childReply.likes && childReply.likes.includes(user?.uid) ? '#1877F2' : '#65676B', 
                                                          cursor: 'pointer', 
                                                          fontSize: '10px',
                                                          fontWeight: '600'
                                                        }}
                                                      >
                                                        {childReply.likes && childReply.likes.includes(user?.uid) ? '❤️' : '🤍'} Like
                                                        {childReply.likes && childReply.likes.length > 0 && ` (${childReply.likes.length})`}
                                                      </button>
                                                      <button 
                                                        onClick={() => handleReply(post.id, i, true, childReply.id)}
                                                        style={{ 
                                                          background: 'none', 
                                                          border: 'none', 
                                                          color: '#65676B', 
                                                          cursor: 'pointer', 
                                                          fontSize: '10px',
                                                          fontWeight: '600'
                                                        }}
                                                      >
                                                        💬 Reply
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                        
                                        {/* Show traditional replies if no threading structure exists */}
                                        {c.replies.filter(r => !r.id).map((r, ri) => (
                                      <div key={ri} style={{ 
                                        marginBottom: '8px', 
                                        padding: '8px 12px', 
                                        background: '#F8F9FA', 
                                        borderRadius: '8px'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img 
                                              src={r.photoURL || 'https://via.placeholder.com/24'} 
                                              alt={r.name} 
                                              style={{ 
                                                width: '24px', 
                                                height: '24px', 
                                                borderRadius: '50%', 
                                                objectFit: 'cover'
                                              }} 
                                            />
                                            <span style={{ 
                                              fontWeight: '600',
                                              fontSize: '12px',
                                              color: '#1C1E21'
                                            }}>
                                              {r.name}
                                            </span>
                                            <span style={{ 
                                              color: '#65676B', 
                                              fontSize: '11px'
                                            }}>
                                              {r.timestamp && (r.timestamp.seconds ? new Date(r.timestamp.seconds * 1000).toLocaleString() : new Date(r.timestamp).toLocaleString())}
                                            </span>
                                          </div>
                                          
                                          {/* Reply Menu - Only show for reply owner */}
                                          {user && r.uid === user.uid && (
                                            <div style={{ position: 'relative' }}>
                                              <button 
                                                onClick={() => handleReplyMenuToggle(post.id, i, ri)} 
                                                style={{ 
                                                  background: 'none', 
                                                  border: 'none', 
                                                  fontSize: '14px', 
                                                  cursor: 'pointer', 
                                                  padding: '2px',
                                                  color: '#65676B',
                                                  borderRadius: '50%',
                                                  width: '20px',
                                                  height: '20px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center'
                                                }}
                                              >
                                                &#8942;
                                              </button>
                                              {replyMenuOpen[`${post.id}_${i}_${ri}`] && (
                                                <div style={{ 
                                                  position: 'absolute', 
                                                  top: '24px', 
                                                  right: '0', 
                                                  background: '#ffffff', 
                                                  border: '1px solid #E4E6EA', 
                                                  borderRadius: '8px', 
                                                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)', 
                                                  minWidth: '80px',
                                                  overflow: 'hidden',
                                                  zIndex: 1000
                                                }}>
                                                  <button
                                                    onClick={() => handleEditReply(post.id, i, ri, r.text)}
                                                    style={{ 
                                                      width: '100%', 
                                                      padding: '8px 12px', 
                                                      background: 'none', 
                                                      border: 'none', 
                                                      textAlign: 'left', 
                                                      cursor: 'pointer', 
                                                      fontSize: '12px',
                                                      color: '#1C1E21'
                                                    }}
                                                  >
                                                    ✏️ Edit
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteReply(post.id, i, ri)}
                                                    style={{ 
                                                      width: '100%', 
                                                      padding: '8px 12px', 
                                                      background: 'none', 
                                                      border: 'none', 
                                                      textAlign: 'left', 
                                                      cursor: 'pointer', 
                                                      fontSize: '12px',
                                                      color: '#E41E3F'
                                                    }}
                                                  >
                                                    🗑️ Delete
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        {/* Reply text or edit input */}
                                        {editingReply.postId === post.id && editingReply.commentIdx === i && editingReply.replyIdx === ri ? (
                                          <div style={{ margin: '0 0 8px 0' }}>
                                            <textarea 
                                              value={editReplyText.text || ''}
                                              onChange={(e) => handleEditReplyChange(e.target.value)}
                                              style={{ 
                                                width: '100%', 
                                                minHeight: '60px',
                                                padding: '8px', 
                                                fontSize: '12px',
                                                border: '1px solid #E4E6EA', 
                                                borderRadius: '6px', 
                                                resize: 'vertical',
                                                fontFamily: 'inherit'
                                              }}
                                            />
                                            <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                                              <button 
                                                onClick={() => handleEditReplySave(post.id, i, ri)}
                                                style={{ 
                                                  background: '#1877F2', 
                                                  color: 'white', 
                                                  border: 'none', 
                                                  padding: '4px 12px', 
                                                  borderRadius: '4px', 
                                                  fontSize: '11px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                Save
                                              </button>
                                              <button 
                                                onClick={handleEditReplyCancel}
                                                style={{ 
                                                  background: '#E4E6EA', 
                                                  color: '#65676B', 
                                                  border: 'none', 
                                                  padding: '4px 12px', 
                                                  borderRadius: '4px', 
                                                  fontSize: '11px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <p style={{ 
                                            color: '#1C1E21', 
                                            fontSize: '12px',
                                            margin: '0 0 8px 0',
                                            lineHeight: '1.3',
                                            textAlign: 'left',
                                            paddingLeft: '0'
                                          }}>
                                            {r.text}
                                          </p>
                                        )}
                                        
                                        {/* Reply actions */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                                          <button 
                                            onClick={() => handleReplyLike(post.id, i, ri)}
                                            style={{ 
                                              background: 'none', 
                                              border: 'none', 
                                              color: r.likes && r.likes.includes(user?.uid) ? '#1877F2' : '#65676B', 
                                              cursor: 'pointer', 
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              padding: '2px 4px',
                                              borderRadius: '4px',
                                              transition: 'background-color 0.2s ease'
                                            }}
                                            onMouseEnter={e => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                                            onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                                          >
                                            {r.likes && r.likes.includes(user?.uid) ? '❤️' : '🤍'} Like
                                            {r.likes && r.likes.length > 0 && (
                                              <span style={{ fontSize: '10px', marginLeft: '2px' }}>
                                                ({r.likes.length})
                                              </span>
                                            )}
                                          </button>
                                          
                                          <button 
                                            onClick={() => {
                                              // Set up reply to reply functionality if needed
                                              // For now, we'll use the same reply mechanism
                                              handleReply(post.id, i);
                                            }}
                                            style={{ 
                                              background: 'none', 
                                              border: 'none', 
                                              color: '#65676B', 
                                              cursor: 'pointer', 
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              padding: '2px 4px',
                                              borderRadius: '4px',
                                              transition: 'background-color 0.2s ease'
                                            }}
                                            onMouseEnter={e => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                                            onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                                          >
                                            💬 Reply
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* Comment Menu */}
                              {user && c.uid === user.uid && (
                                <div style={{ position: 'relative' }}>
                                  <button 
                                    onClick={() => handleCommentMenuToggle(post.id, i)} 
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      fontSize: '16px', 
                                      cursor: 'pointer', 
                                      padding: '4px',
                                      color: '#65676B',
                                      borderRadius: '50%',
                                      width: '24px',
                                      height: '24px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    &#8942;
                                  </button>
                                  {commentMenuOpen[`${post.id}_${i}`] && (
                                    <div style={{ 
                                      position: 'absolute', 
                                      top: '28px', 
                                      right: '0', 
                                      background: '#ffffff', 
                                      border: '1px solid #E4E6EA', 
                                      borderRadius: '8px', 
                                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)', 
                                      minWidth: '100px',
                                      overflow: 'hidden',
                                      zIndex: 100
                                    }}>
                                      <button 
                                        onClick={() => handleEditComment(post.id, i, c.text)} 
                                        style={{ 
                                          display: 'block', 
                                          width: '100%', 
                                          background: 'none', 
                                          border: 'none', 
                                          padding: '8px 12px', 
                                          textAlign: 'left', 
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          fontWeight: '500',
                                          color: '#1C1E21'
                                        }}
                                      >
                                        Edit
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteComment(post.id, i)} 
                                        style={{ 
                                          display: 'block', 
                                          width: '100%', 
                                          background: 'none', 
                                          border: 'none', 
                                          padding: '8px 12px', 
                                          textAlign: 'left', 
                                          color: '#E41E3F', 
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          fontWeight: '500'
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ 
                          textAlign: 'center',
                          padding: '40px 20px',
                          color: '#65676B',
                          fontSize: '14px'
                        }}>
                          <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
                          <p style={{ margin: 0 }}>No comments yet. Be the first to comment!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Media Popup Modal */}
      {mediaPopup.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }} onClick={handleClosePopup}>
          <div style={{ 
            position: 'relative', 
            maxWidth: '95vw', 
            maxHeight: '95vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={handleClosePopup} 
              style={{ 
                position: 'absolute', 
                top: '-40px', 
                right: '0px', 
                background: 'rgba(255, 255, 255, 0.9)', 
                border: 'none', 
                borderRadius: '50%', 
                width: '36px', 
                height: '36px', 
                fontSize: '20px', 
                cursor: 'pointer', 
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1C1E21',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#ffffff';
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                e.target.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
            {mediaPopup.type === 'image' ? (
              <img 
                src={mediaPopup.url} 
                alt="Full size view" 
                style={{ 
                  maxWidth: '95vw', 
                  maxHeight: '95vh', 
                  borderRadius: '12px', 
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  objectFit: 'contain'
                }} 
              />
            ) : (
              <video 
                src={mediaPopup.url} 
                controls 
                autoPlay 
                style={{ 
                  maxWidth: '95vw', 
                  maxHeight: '95vh', 
                  borderRadius: '12px', 
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                }} 
              />
            )}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '2rem',
            maxWidth: 500,
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ margin: 0, color: '#E41E3F', fontSize: '18px', fontWeight: '600' }}>
                Report Post
              </h3>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setReportDetails('');
                  setReportingPostId(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#65676B',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.target.style.background = '#F0F2F5'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#1C1E21',
                fontSize: '14px'
              }}>
                Reason for reporting *
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E4E6EA',
                  borderRadius: 8,
                  fontSize: '14px',
                  background: '#ffffff',
                  outline: 'none'
                }}
              >
                <option value="">Select a reason</option>
                <option value="inappropriate_content">Inappropriate or offensive content</option>
                <option value="spam">Spam or unwanted promotional content</option>
                <option value="misleading_info">False or misleading information</option>
                <option value="harassment">Harassment or bullying</option>
                <option value="hate_speech">Hate speech or discrimination</option>
                <option value="violence">Violence or dangerous content</option>
                <option value="copyright">Copyright infringement</option>
                <option value="scam">Scam or fraudulent activity</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#1C1E21',
                fontSize: '14px'
              }}>
                Additional details (optional)
              </label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Please provide any additional information that might help us understand the issue..."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E4E6EA',
                  borderRadius: 8,
                  fontSize: '14px',
                  minHeight: 100,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{
              background: '#FFF8DC',
              border: '1px solid #FFD700',
              borderRadius: 8,
              padding: '16px',
              marginBottom: '1.5rem',
              fontSize: '14px'
            }}>
              <div style={{ 
                fontWeight: '600', 
                color: '#B8860B', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                ⚠️ Important Notice
              </div>
              <div style={{ color: '#8B7355', lineHeight: '1.4' }}>
                Please only submit genuine reports. False reports may result in restrictions on your account. 
                All reports are reviewed by our moderation team within 24-48 hours.
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setReportDetails('');
                  setReportingPostId(null);
                }}
                style={{
                  background: '#F0F2F5',
                  color: '#65676B',
                  border: '1px solid #E4E6EA',
                  borderRadius: 8,
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#E4E6EA';
                  e.target.style.color = '#1C1E21';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#F0F2F5';
                  e.target.style.color = '#65676B';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={reportSubmitting || !reportReason.trim()}
                style={{
                  background: (!reportReason.trim() || reportSubmitting) ? '#BDC3C7' : '#E41E3F',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (!reportReason.trim() || reportSubmitting) ? 'not-allowed' : 'pointer',
                  opacity: reportSubmitting ? 0.7 : 1,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (reportReason.trim() && !reportSubmitting) {
                    e.target.style.background = '#C53030';
                  }
                }}
                onMouseLeave={(e) => {
                  if (reportReason.trim() && !reportSubmitting) {
                    e.target.style.background = '#E41E3F';
                  }
                }}
              >
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Store Item Modal */}
      {showShareItemModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: 20,
            padding: '2rem',
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #f0f0f0'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '1.5rem', 
                fontWeight: '700',
                color: '#1C1E21',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🛍️ Share Store Item
              </h3>
              <button
                onClick={resetShareForm}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#65676B',
                  padding: '4px',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f0f0f0'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                ×
              </button>
            </div>

            {!selectedItem ? (
              <>
                {/* Store Items List */}
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ 
                    margin: '0 0 1rem 0', 
                    fontSize: '1.1rem', 
                    fontWeight: '600',
                    color: '#1C1E21'
                  }}>
                    Select an item from your store:
                  </h4>
                  
                  {loadingItems ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '2rem',
                      color: '#65676B'
                    }}>
                      Loading your store items...
                    </div>
                  ) : storeItems.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '2rem',
                      color: '#65676B',
                      background: '#F8F9FA',
                      borderRadius: '8px',
                      border: '2px dashed #E4E6EA'
                    }}>
                      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📦</div>
                      <h4 style={{ margin: '0 0 0.5rem 0' }}>No items found</h4>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        Add items to your store inventory first, then come back to share them on your feed!
                      </p>
                    </div>
                  ) : (
                    <div style={{ 
                      maxHeight: '400px', 
                      overflowY: 'auto',
                      border: '1px solid #E4E6EA',
                      borderRadius: '8px'
                    }}>
                      {storeItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            borderBottom: '1px solid #F0F2F5',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#F8F9FA'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              style={{
                                width: '60px',
                                height: '60px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                background: '#F0F2F5'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '60px',
                              height: '60px',
                              background: '#F0F2F5',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.5rem'
                            }}>
                              📦
                            </div>
                          )}
                          
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontWeight: '600', 
                              fontSize: '1rem',
                              color: '#1C1E21',
                              marginBottom: '4px'
                            }}>
                              {item.name}
                            </div>
                            <div style={{ 
                              color: '#007B7F', 
                              fontWeight: '600',
                              fontSize: '0.9rem',
                              marginBottom: '2px'
                            }}>
                              £{item.price}
                            </div>
                            {item.category && (
                              <div style={{ 
                                color: '#65676B', 
                                fontSize: '0.8rem'
                              }}>
                                {item.category}
                              </div>
                            )}
                          </div>
                          
                          <div style={{
                            color: '#007B7F',
                            fontSize: '1.2rem'
                          }}>
                            →
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Selected Item Preview & Post Composer */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '1rem'
                  }}>
                    <button
                      onClick={() => setSelectedItem(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#65676B',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '4px'
                      }}
                    >
                      ← Back
                    </button>
                    <h4 style={{ margin: 0, color: '#1C1E21' }}>
                      Sharing: {selectedItem.name}
                    </h4>
                  </div>

                  {/* Item Preview */}
                  <div style={{
                    background: '#F8F9FA',
                    border: '1px solid #E4E6EA',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {selectedItem.image ? (
                        <img
                          src={selectedItem.image}
                          alt={selectedItem.name}
                          style={{
                            width: '80px',
                            height: '80px',
                            objectFit: 'cover',
                            borderRadius: '8px'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '80px',
                          height: '80px',
                          background: '#E4E6EA',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2rem'
                        }}>
                          📦
                        </div>
                      )}
                      
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '4px' }}>
                          {selectedItem.name}
                        </div>
                        <div style={{ color: '#007B7F', fontWeight: '600', marginBottom: '2px' }}>
                          £{selectedItem.price}
                        </div>
                        {selectedItem.category && (
                          <div style={{ color: '#65676B', fontSize: '0.9rem' }}>
                            {selectedItem.category}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Post Text */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1C1E21'
                    }}>
                      Your post text:
                    </label>
                    <textarea
                      value={shareItemText}
                      onChange={(e) => setShareItemText(e.target.value)}
                      placeholder="Write something about this item..."
                      rows={6}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #E4E6EA',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
                
                {/* Share Button */}
                <div style={{ 
                  display: 'flex', 
                  gap: '1rem',
                  justifyContent: 'flex-end',
                  paddingTop: '1rem',
                  borderTop: '1px solid #E4E6EA'
                }}>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    disabled={shareItemLoading}
                    style={{
                      background: '#F0F2F5',
                      color: shareItemLoading ? '#BDC3C7' : '#65676B',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: shareItemLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleShareItem}
                    disabled={shareItemLoading || !shareItemText.trim()}
                    style={{
                      background: (shareItemLoading || !shareItemText.trim()) ? '#BDC3C7' : '#007B7F',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: (shareItemLoading || !shareItemText.trim()) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '120px'
                    }}
                  >
                    {shareItemLoading ? 'Sharing...' : 'Share Item'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FeedPage; 