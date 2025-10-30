import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { app, db } from '../firebase';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, collectionGroup, or } from 'firebase/firestore';
import { useCart } from '../CartContext';
import { useMessage } from '../MessageContext';

function Navbar() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [adminCode, setAdminCode] = useState('');
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [adminCodeError, setAdminCodeError] = useState('');
  const [feedNotificationCount, setFeedNotificationCount] = useState(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const { cart, clearCart } = useCart();
  const { unreadMessageCount } = useMessage();
  const location = useLocation();

  const isExplorePage = location.pathname === '/explore' || location.pathname === '/';
  const showBanner = (!user || userType === 'buyer') && isExplorePage;
  const bannerHeight = 150;

  // Add custom scrollbar styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .sidebar-scrollable::-webkit-scrollbar {
        width: 6px;
      }
      .sidebar-scrollable::-webkit-scrollbar-track {
        background: transparent;
      }
      .sidebar-scrollable::-webkit-scrollbar-thumb {
        background: rgba(0, 123, 127, 0.3);
        border-radius: 3px;
      }
      .sidebar-scrollable::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 123, 127, 0.5);
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Handle window resize to detect mobile devices
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Call handler right away so state gets updated with initial window size
    handleResize();
    
    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          // More robust user type detection
          await determineUserType(u.uid);
          
          // Onboarding guard - only redirect if email is verified
          if (u.emailVerified) {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            const onboardingStepValue = userDoc.exists() ? userDoc.data().onboardingStep : null;
            setOnboardingStep(onboardingStepValue);
            if (onboardingStepValue && onboardingStepValue !== 'complete') {
              navigate('/' + onboardingStepValue);
            }
          }
        } catch (error) {
          console.error('Error during user authentication setup:', error);
          // Fallback: try simple detection
          try {
            const storeDoc = await getDoc(doc(db, 'stores', u.uid));
            setUserType(storeDoc.exists() ? 'seller' : 'buyer');
            console.log('👤 Fallback user type detection used');
          } catch (fallbackError) {
            console.error('Fallback user type detection failed:', fallbackError);
            setUserType('buyer'); // Default to buyer if all else fails
          }
        }
      } else {
        setUserType('');
        setOnboardingStep('');
        // Clear notifications when user logs out
        setFeedNotificationCount(0);
        setNotifications([]);
        console.log('👤 User logged out, notifications cleared');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Enhanced user type determination function
  const determineUserType = async (uid) => {
    // CRITICAL: Clear old cache to fix buyer/seller detection bug
    // This ensures all users get the corrected logic
    const cacheKey = `userType_${uid}`;
    const fixVersion = localStorage.getItem('userTypeFix_v2');
    if (!fixVersion) {
      localStorage.removeItem(cacheKey);
      localStorage.setItem('userTypeFix_v2', 'applied');
      console.log('👤 Cleared old user type cache for bug fix');
    }
    
    // Check cache first (stored in localStorage with timestamp)
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { userType: cachedType, timestamp } = JSON.parse(cached);
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        if (timestamp > fiveMinutesAgo) {
          setUserType(cachedType);
          console.log('👤 User type loaded from cache:', cachedType);
          return;
        }
      } catch (e) {
        // Invalid cache, continue with fresh detection
        localStorage.removeItem(cacheKey);
      }
    }

    // Parallel fetching for better performance
    const [userDocSnap, storeDocSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'stores', uid))
    ]);

    let detectedType = 'buyer'; // Safe default

    // CRITICAL FIX: User type should ONLY be determined by store existence
    // Having onboarding data (category, storeName, etc.) doesn't make someone a seller
    // Only actually creating a store makes them a seller
    
    if (storeDocSnap.exists()) {
      detectedType = 'seller';
      console.log('👤 User type: SELLER (has active store)');
    }
    else if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      
      // Only check explicit userType field, ignore onboarding data
      if (userData.userType === 'seller') {
        // Double-check: if explicitly marked as seller but no store, they're actually a buyer
        detectedType = 'buyer';
        console.log('👤 User type: BUYER (marked as seller but no store exists)');
      } else {
        // Default to buyer - this covers all cases including incomplete onboarding
        detectedType = 'buyer';
        console.log('👤 User type: BUYER (no store document)');
      }
    }
    else {
      // No user document found - default to buyer
      detectedType = 'buyer';
      console.log('👤 User type: BUYER (no user document found)');
    }

    // Cache the result
    localStorage.setItem(cacheKey, JSON.stringify({
      userType: detectedType,
      timestamp: Date.now()
    }));

    setUserType(detectedType);
    console.log('👤 Final user type set to:', detectedType);
  };

  // Track feed notifications for buyers
  useEffect(() => {
    if (!user || userType !== 'buyer') {
      setFeedNotificationCount(0);
      setNotifications([]);
      return;
    }

    console.log('🛒 Setting up buyer notifications for:', user.email);

    // Query all stores the user follows using collectionGroup (same as FeedPage.js)
    const followedStoresQuery = query(
      collectionGroup(db, 'followers'), 
      where('uid', '==', user.uid)
    );

    const unsubscribeFollows = onSnapshot(followedStoresQuery, async (followSnapshot) => {
      const followedStoreIds = followSnapshot.docs.map(doc => doc.ref.parent.parent.id);
      
      // Listen for posts from followed stores AND buyer's own posts
      const postsQuery = query(
        collection(db, 'posts'),
        or(
          followedStoreIds.length > 0 
            ? where('storeId', 'in', followedStoreIds.slice(0, 9)) // Leave room for buyer's posts
            : where('storeId', '==', 'nonexistent'), // Placeholder if no follows
          where('userId', '==', user.uid) // Buyer's own posts
        )
      );

      const unsubscribePosts = onSnapshot(postsQuery, (postsSnapshot) => {
        let newInteractions = 0;
        const notificationsList = [];
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        postsSnapshot.docs.forEach(doc => {
          const post = doc.data();
          const postId = doc.id;
          const postTimestamp = post.timestamp?.toDate();
          const storeProfile = post.storeName || 'Unknown Store';
          
          // Add new posts from followed stores
          if (postTimestamp && postTimestamp >= oneDayAgo) {
            newInteractions++;
            notificationsList.push({
              id: `post_${postId}`,
              type: 'new_post',
              title: `New post from ${storeProfile}`,
              content: post.text?.substring(0, 80) + (post.text?.length > 80 ? '...' : '') || 'New media post',
              timestamp: postTimestamp,
              postId: postId,
              storeId: post.storeId,
              storeName: storeProfile,
              avatar: post.storeAvatar || null,
              isRead: false
            });
          }
          
          // Track interactions on buyer's own posts
          if (post.userId === user.uid) {
            // Check for likes on buyer's posts
            if (post.likes && post.likes.length > 0) {
              const likesTimestamp = post.lastLikeTimestamp?.toDate() || postTimestamp;
              // Count as new if within 24 hours
              if (likesTimestamp && likesTimestamp >= oneDayAgo) {
                newInteractions++;
              }
              // Show all likes regardless of age
              notificationsList.push({
                id: `buyer_post_likes_${postId}`,
                type: 'post_likes',
                title: `❤️ ${post.likes.length} ${post.likes.length === 1 ? 'person liked' : 'people liked'} your post`,
                content: post.text ? post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '') : 'Your post',
                timestamp: likesTimestamp,
                postId: postId,
                storeId: post.storeId,
                avatar: null,
                isRead: false,
                isNew: likesTimestamp && likesTimestamp >= oneDayAgo
              });
            }
          }
          
          // Add comments on posts user interacted with (show all, count new ones)
          if (post.comments) {
            post.comments.forEach((comment, commentIndex) => {
              const commentTime = comment.timestamp?.toDate() || new Date(comment.timestamp);
              
              // Skip if this is the user's own comment
              if (comment.uid === user.uid) return;
              
              // Check if this is user's own comment to track likes on it
              if (comment.uid === user.uid) {
                // Track likes on user's comments
                if (comment.likes && comment.likes.length > 0) {
                  const commentLikesTimestamp = comment.lastLikeTimestamp?.toDate() || commentTime;
                  // Count as new if within 24 hours
                  if (commentLikesTimestamp && commentLikesTimestamp >= oneDayAgo) {
                    newInteractions++;
                  }
                  // Show all comment likes regardless of age
                  notificationsList.push({
                    id: `buyer_comment_likes_${postId}_${commentIndex}`,
                    type: 'comment_likes',
                    title: `❤️ ${comment.likes.length} ${comment.likes.length === 1 ? 'person liked' : 'people liked'} ${comment.name}'s comment`,
                    content: `On comment: "${comment.text?.substring(0, 80) + (comment.text?.length > 80 ? '...' : '')}"`,
                    timestamp: commentLikesTimestamp,
                    postId: postId,
                    storeId: post.storeId,
                    avatar: null,
                    isRead: false,
                    isNew: commentLikesTimestamp && commentLikesTimestamp >= oneDayAgo
                  });
                }
                return; // Skip other checks for user's own comment
              }
              
              // Check if this is a reply to user's comment or mentions user
              const isReplyToUser = comment.text?.includes(`@${user.displayName}`) || 
                                  comment.text?.includes(`@${user.email?.split('@')[0]}`);
              
              // Check if user has commented on this post before
              const userHasCommented = post.comments.some(c => c.uid === user.uid);
              
              if (isReplyToUser || userHasCommented) {
                // Count as new if within 24 hours
                if (commentTime && commentTime >= oneDayAgo) {
                  newInteractions++;
                }
                // But show all relevant comments regardless of age
                notificationsList.push({
                  id: `comment_${postId}_${commentIndex}`,
                  type: isReplyToUser ? 'mention' : 'comment_on_post',
                  title: isReplyToUser 
                    ? `${comment.name} mentioned you` 
                    : `${comment.name} commented on a post you engaged with`,
                  content: comment.text?.substring(0, 80) + (comment.text?.length > 80 ? '...' : ''),
                  timestamp: commentTime,
                  postId: postId,
                  storeId: post.storeId,
                  storeName: storeProfile,
                  avatar: comment.photoURL || null,
                  commenterName: comment.name,
                  isRead: false,
                  isNew: commentTime && commentTime >= oneDayAgo
                });
              }
              
              // Check for replies to user's comments (including threaded replies)
              if (comment.replies) {
                comment.replies.forEach((reply, replyIndex) => {
                  const replyTime = reply.timestamp?.toDate() || new Date(reply.timestamp);
                  
                  // Check if this is user's own reply to track likes on it
                  if (reply.uid === user.uid) {
                    // Track likes on user's replies
                    if (reply.likes && reply.likes.length > 0 && reply.likes.some(likeUid => likeUid !== user.uid)) {
                      const replyLikesTimestamp = reply.lastLikeTimestamp?.toDate() || replyTime;
                      // Count as new if within 24 hours
                      if (replyLikesTimestamp && replyLikesTimestamp >= oneDayAgo) {
                        newInteractions++;
                      }
                      // Show likes on user's own replies
                      notificationsList.push({
                        id: `buyer_reply_likes_${postId}_${commentIndex}_${reply.id || replyIndex}`,
                        type: 'reply_likes',
                        title: `❤️ ${reply.likes.length} ${reply.likes.length === 1 ? 'person liked' : 'people liked'} your reply`,
                        content: `Your reply: "${reply.text?.substring(0, 80) + (reply.text?.length > 80 ? '...' : '')}"`,
                        timestamp: replyLikesTimestamp,
                        postId: postId,
                        storeId: post.storeId,
                        storeName: storeProfile,
                        avatar: null,
                        isRead: false,
                        isNew: replyLikesTimestamp && replyLikesTimestamp >= oneDayAgo
                      });
                    }
                    return; // Skip other checks for user's own reply
                  }
                  
                  // Check if this is a direct reply to the user's comment
                  if (comment.uid === user.uid && reply.uid !== user.uid && !reply.parentId) {
                    // Count as new if within 24 hours
                    if (replyTime && replyTime >= oneDayAgo) {
                      newInteractions++;
                    }
                    // But show all replies regardless of age
                    notificationsList.push({
                      id: `reply_${postId}_${commentIndex}_${reply.id || replyIndex}`,
                      type: 'reply',
                      title: `${reply.name} replied to your comment`,
                      content: reply.text?.substring(0, 80) + (reply.text?.length > 80 ? '...' : ''),
                      timestamp: replyTime,
                      postId: postId,
                      storeId: post.storeId,
                      storeName: storeProfile,
                      avatar: reply.photoURL || null,
                      commenterName: reply.name,
                      isRead: false,
                      isNew: replyTime && replyTime >= oneDayAgo
                    });
                  }
                  
                  // Check if this is a threaded reply to user's reply
                  if (reply.parentId && reply.uid !== user.uid) {
                    // Find the parent reply to see if it belongs to the user
                    const parentReply = comment.replies.find(r => r.id === reply.parentId);
                    if (parentReply && parentReply.uid === user.uid) {
                      // Count as new if within 24 hours
                      if (replyTime && replyTime >= oneDayAgo) {
                        newInteractions++;
                      }
                      // Show threaded reply notification
                      notificationsList.push({
                        id: `threaded_reply_${postId}_${commentIndex}_${reply.id || replyIndex}`,
                        type: 'threaded_reply',
                        title: `${reply.name} replied to your reply`,
                        content: reply.text?.substring(0, 80) + (reply.text?.length > 80 ? '...' : ''),
                        timestamp: replyTime,
                        postId: postId,
                        storeId: post.storeId,
                        storeName: storeProfile,
                        avatar: reply.photoURL || null,
                        commenterName: reply.name,
                        isRead: false,
                        isNew: replyTime && replyTime >= oneDayAgo
                      });
                    }
                  }
                });
              }
            });
          }
        });

        // Sort notifications by timestamp (newest first)
        notificationsList.sort((a, b) => b.timestamp - a.timestamp);
        
        console.log(`🛒 Buyer notifications: ${newInteractions} new, ${notificationsList.length} total`);
        setFeedNotificationCount(newInteractions);
        setNotifications(notificationsList);
      });

      return () => unsubscribePosts();
    });

    return () => unsubscribeFollows();
  }, [user, userType]);

  // Track feed notifications for sellers
  useEffect(() => {
    if (!user || userType !== 'seller') {
      setFeedNotificationCount(0);
      setNotifications([]);
      return;
    }

    console.log('🏪 Setting up seller notifications for:', user.email);

    // Listen for interactions on seller's posts
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', user.uid) // Posts by this seller
    );

    const unsubscribePosts = onSnapshot(postsQuery, (postsSnapshot) => {
      let newInteractions = 0;
      const notificationsList = [];
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // Still use for counting "new" interactions

      postsSnapshot.docs.forEach(postDoc => {
        const post = postDoc.data();
        const postId = postDoc.id;

        // Check for likes (show all likes, count new ones)
        if (post.likes && post.likes.length > 0) {
          const likesTimestamp = post.lastLikeTimestamp?.toDate() || post.timestamp?.toDate();
          // Count as new if within 24 hours
          if (likesTimestamp && likesTimestamp >= oneDayAgo) {
            newInteractions++;
          }
          // But show all likes regardless of age
          notificationsList.push({
            id: `likes_${postId}`,
            type: 'likes',
            title: `❤️ ${post.likes.length} ${post.likes.length === 1 ? 'person liked' : 'people liked'} your post`,
            content: post.text ? post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '') : 'Your post',
            timestamp: likesTimestamp,
            postId: postId,
            storeId: post.storeId,
            avatar: null,
            isNew: likesTimestamp && likesTimestamp >= oneDayAgo
          });
        }

        // Check for comments (show all comments, count new ones)
        if (post.comments && post.comments.length > 0) {
          post.comments.forEach((comment, commentIndex) => {
            // Skip if this is the seller's own comment
            if (comment.uid === user.uid) return;

            const commentTime = comment.timestamp?.toDate() || new Date(comment.timestamp);
            // Count as new if within 24 hours
            if (commentTime && commentTime >= oneDayAgo) {
              newInteractions++;
            }
            // But show all comments regardless of age
            notificationsList.push({
              id: `comment_${postId}_${commentIndex}`,
              type: 'comment',
              title: `💬 ${comment.name} commented on your post`,
              content: comment.text?.substring(0, 100) + (comment.text?.length > 100 ? '...' : ''),
              timestamp: commentTime,
              postId: postId,
              storeId: post.storeId,
              avatar: comment.photoURL || null,
              isNew: commentTime && commentTime >= oneDayAgo
            });

            // Check for likes on comments
            if (comment.likes && comment.likes.length > 0) {
              const commentLikesTimestamp = comment.lastLikeTimestamp?.toDate() || commentTime;
              // Count as new if within 24 hours
              if (commentLikesTimestamp && commentLikesTimestamp >= oneDayAgo) {
                newInteractions++;
              }
              // Show all comment likes regardless of age
              notificationsList.push({
                id: `comment_likes_${postId}_${commentIndex}`,
                type: 'comment_likes',
                title: `❤️ ${comment.likes.length} ${comment.likes.length === 1 ? 'person liked' : 'people liked'} ${comment.name}'s comment`,
                content: `On comment: "${comment.text?.substring(0, 80) + (comment.text?.length > 80 ? '...' : '')}"`,
                timestamp: commentLikesTimestamp,
                postId: postId,
                storeId: post.storeId,
                avatar: null,
                isNew: commentLikesTimestamp && commentLikesTimestamp >= oneDayAgo
              });
            }

            // Check for replies to comments (show all replies, count new ones)
            if (comment.replies && comment.replies.length > 0) {
              comment.replies.forEach((reply, replyIndex) => {
                const replyTime = reply.timestamp?.toDate() || new Date(reply.timestamp);
                
                // Check if this reply is relevant to the seller
                let isRelevantToSeller = false;
                let replyTitle = '';
                let notificationType = 'reply';
                
                // Skip if this is the seller's own reply, but still process for threaded replies to seller's content
                if (reply.uid === user.uid) {
                  // This is seller's own reply, don't notify about it, but check for likes
                  if (reply.likes && reply.likes.length > 0 && reply.likes.some(likeUid => likeUid !== user.uid)) {
                    const replyLikesTimestamp = reply.lastLikeTimestamp?.toDate() || replyTime;
                    // Count as new if within 24 hours
                    if (replyLikesTimestamp && replyLikesTimestamp >= oneDayAgo) {
                      newInteractions++;
                    }
                    // Show likes on seller's own replies
                    notificationsList.push({
                      id: `seller_reply_likes_${postId}_${commentIndex}_${reply.id || replyIndex}`,
                      type: 'seller_reply_likes',
                      title: `❤️ ${reply.likes.length} ${reply.likes.length === 1 ? 'person liked' : 'people liked'} your reply`,
                      content: `Your reply: "${reply.text?.substring(0, 80) + (reply.text?.length > 80 ? '...' : '')}"`,
                      timestamp: replyLikesTimestamp,
                      postId: postId,
                      storeId: post.storeId,
                      avatar: null,
                      isNew: replyLikesTimestamp && replyLikesTimestamp >= oneDayAgo
                    });
                  }
                  return; // Skip notification for seller's own reply
                }

                // Determine notification type based on reply structure
                if (!reply.parentId) {
                  // Direct reply to comment
                  const isReplyToSeller = comment.uid === user.uid;
                  if (isReplyToSeller) {
                    replyTitle = `↩️ ${reply.name} replied to your comment`;
                    isRelevantToSeller = true;
                  } else {
                    replyTitle = `↩️ ${reply.name} replied to a comment on your post`;
                    isRelevantToSeller = true; // Still relevant as it's on seller's post
                  }
                } else {
                  // Threaded reply - find the parent
                  const parentReply = comment.replies.find(r => r.id === reply.parentId);
                  if (parentReply && parentReply.uid === user.uid) {
                    replyTitle = `🔗 ${reply.name} replied to your reply`;
                    notificationType = 'threaded_reply';
                    isRelevantToSeller = true;
                  } else if (parentReply) {
                    replyTitle = `🔗 ${reply.name} replied in a thread on your post`;
                    notificationType = 'thread_activity';
                    isRelevantToSeller = true; // Still relevant as it's activity on seller's post
                  }
                }
                
                if (isRelevantToSeller) {
                  // Count as new if within 24 hours
                  if (replyTime && replyTime >= oneDayAgo) {
                    newInteractions++;
                  }
                  
                  // Show all relevant replies regardless of age
                  notificationsList.push({
                    id: `${notificationType}_${postId}_${commentIndex}_${reply.id || replyIndex}`,
                    type: notificationType,
                    title: replyTitle,
                    content: reply.text?.substring(0, 100) + (reply.text?.length > 100 ? '...' : ''),
                    timestamp: replyTime,
                    postId: postId,
                    storeId: post.storeId,
                    avatar: reply.photoURL || null,
                    isNew: replyTime && replyTime >= oneDayAgo
                  });
                }

                // Check for likes on replies (whether seller's or others')
                if (reply.likes && reply.likes.length > 0) {
                  const replyLikesTimestamp = reply.lastLikeTimestamp?.toDate() || replyTime;
                  // Count as new if within 24 hours
                  if (replyLikesTimestamp && replyLikesTimestamp >= oneDayAgo) {
                    newInteractions++;
                  }
                  // Show all reply likes regardless of age
                  notificationsList.push({
                    id: `reply_likes_${postId}_${commentIndex}_${reply.id || replyIndex}`,
                    type: 'reply_likes',
                    title: `❤️ ${reply.likes.length} ${reply.likes.length === 1 ? 'person liked' : 'people liked'} ${reply.name}'s reply`,
                    content: `On reply: "${reply.text?.substring(0, 80) + (reply.text?.length > 80 ? '...' : '')}"`,
                    timestamp: replyLikesTimestamp,
                    postId: postId,
                    storeId: post.storeId,
                    avatar: null,
                    isNew: replyLikesTimestamp && replyLikesTimestamp >= oneDayAgo
                  });
                }
              });
            }
          });
        }
      });

      // Sort notifications by timestamp (newest first)
      notificationsList.sort((a, b) => {
        const timeA = a.timestamp || new Date(0);
        const timeB = b.timestamp || new Date(0);
        return timeB - timeA;
      });

      console.log(`🏪 Seller notifications: ${newInteractions} new, ${notificationsList.length} total`);
      setFeedNotificationCount(newInteractions);
      setNotifications(notificationsList);
    });

    return () => unsubscribePosts();
  }, [user, userType]);

  const handleLogout = async () => {
    try {
      clearCart();
      await signOut(getAuth(app));
      navigate('/explore');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };
  
  // Function to handle admin access code validation
  const handleAdminAccess = (e) => {
    e.preventDefault();
    setSidebarOpen(false);
    setShowAdminCodeModal(true);
  };
  
  // Function to verify admin code and grant access to admin portal
  const verifyAdminCode = () => {
    // Check if code matches the secret code
    if (adminCode === '109826') {
      setAdminCodeError('');
      setAdminCode('');
      setShowAdminCodeModal(false);
      
      // Show success message
      const successModal = document.createElement('div');
      successModal.style.position = 'fixed';
      successModal.style.top = '0';
      successModal.style.left = '0';
      successModal.style.right = '0';
      successModal.style.bottom = '0';
      successModal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      successModal.style.display = 'flex';
      successModal.style.justifyContent = 'center';
      successModal.style.alignItems = 'center';
      successModal.style.zIndex = '10000';
      
      const successContent = document.createElement('div');
      successContent.style.backgroundColor = 'white';
      successContent.style.borderRadius = '8px';
      successContent.style.padding = '2rem';
      successContent.style.width = '90%';
      successContent.style.maxWidth = '400px';
      successContent.style.textAlign = 'center';
      
      const icon = document.createElement('div');
      icon.innerHTML = '✅';
      icon.style.fontSize = '3rem';
      icon.style.marginBottom = '1rem';
      icon.style.color = '#10B981';
      
      const title = document.createElement('h2');
      title.innerText = 'Access Granted';
      title.style.fontSize = '1.5rem';
      title.style.marginBottom = '1rem';
      title.style.fontWeight = 'bold';
      
      const message = document.createElement('p');
      message.innerText = 'You have been verified. Redirecting to the admin portal...';
      message.style.marginBottom = '1.5rem';
      message.style.color = '#4B5563';
      
      successContent.appendChild(icon);
      successContent.appendChild(title);
      successContent.appendChild(message);
      successModal.appendChild(successContent);
      document.body.appendChild(successModal);
      
      // Redirect to admin dashboard after a short delay
      setTimeout(() => {
        document.body.removeChild(successModal);
        navigate('/admin-login');
      }, 1500);
      
    } else {
      // Show error message for incorrect code
      setAdminCodeError('Invalid access code. Please try again.');
    }
  };

  // Utility function to clear user type cache (can be called when user type changes)
  const clearUserTypeCache = (uid) => {
    if (uid) {
      const cacheKey = `userType_${uid}`;
      localStorage.removeItem(cacheKey);
      console.log('👤 User type cache cleared for:', uid);
    }
  };

  // Only show cart if userType is 'buyer' and onboardingStep is 'complete' and user is logged in
  const showCart = user && userType === 'buyer' && onboardingStep === 'complete';
  const showNotificationBell = user && userType && (userType === 'buyer' || userType === 'seller') && onboardingStep === 'complete';
  
  console.log('🔔 Notification bell visibility:', {
    user: !!user,
    userType,
    onboardingStep,
    showNotificationBell,
    feedNotificationCount
  });

  return (
    <>
      <nav style={{ 
        position: 'relative',
        width: '100%',
        zIndex: 1,
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '0 1rem', 
        background: 'rgba(255, 255, 255, 0.98)', 
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        transition: 'all 0.3s ease',
        height: '60px',
        width: '100%',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
        margin: 0
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Modern Hamburger menu - moved to left */}
        <button
          onClick={() => setSidebarOpen(true)}
          style={{ 
            background: 'rgba(0, 123, 127, 0.1)', 
            border: 'none', 
            cursor: 'pointer', 
            padding: '6px', 
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={e => {
            e.target.style.background = 'rgba(0, 123, 127, 0.2)';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={e => {
            e.target.style.background = 'rgba(0, 123, 127, 0.1)';
            e.target.style.transform = 'scale(1)';
          }}
          aria-label="Open menu"
        >
          <div style={{ width: 20, height: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ height: 2.5, background: '#007B7F', borderRadius: 2 }}></div>
            <div style={{ height: 2.5, background: '#007B7F', borderRadius: 2 }}></div>
            <div style={{ height: 2.5, background: '#007B7F', borderRadius: 2 }}></div>
          </div>
        </button>
        
        {/* Logo - moved to right of hamburger menu */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <a href="/" style={{ display: 'inline-block', border: 'none', background: 'none' }}>
            <img 
              src={process.env.PUBLIC_URL + '/images/logo png.png'} 
              alt="Lokal Logo" 
              style={{ 
                maxHeight: '45px', 
                verticalAlign: 'middle',
                transition: 'transform 0.2s ease'
              }} 
              onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            />
          </a>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {!user ? (
          <>
            <a 
              href="/login" 
              style={{ 
                color: '#007B7F', 
                textDecoration: 'none', 
                fontWeight: '600', 
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                background: 'rgba(0, 123, 127, 0.1)',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem'
              }}
              onMouseEnter={e => {
                e.target.style.background = 'rgba(0, 123, 127, 0.2)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Login
            </a>
            <a 
              href="/register" 
              style={{ 
                color: 'white', 
                textDecoration: 'none', 
                fontWeight: '600',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #007B7F, #00A3A8)',
                boxShadow: '0 3px 10px rgba(0, 123, 127, 0.3)',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem'
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 6px 20px rgba(0, 123, 127, 0.4)';
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.3)';
              }}
            >
              Register
            </a>
          </>
        ) : (
          <>
            {userType === 'buyer' ? (
              <>
                <a 
                  href="/profile" 
                  style={{ 
                    color: '#007B7F', 
                    textDecoration: 'none', 
                    fontWeight: 'bold', 
                    fontSize: '1.2rem', 
                    padding: '6px',
                    borderRadius: '8px',
                    background: 'rgba(0, 123, 127, 0.1)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }} 
                  title="Profile"
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.2)';
                    e.target.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  <span role="img" aria-label="profile">👤</span>
                </a>

                {showCart && (
                  <button
                    onClick={() => navigate('/shop-cart')}
                    style={{ 
                      background: 'rgba(0, 123, 127, 0.1)', 
                      border: 'none', 
                      padding: '6px', 
                      position: 'relative', 
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.2)';
                      e.target.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'scale(1)';
                    }}
                    aria-label="Cart"
                  >
                    <img src={process.env.PUBLIC_URL + '/images/cart.png'} alt="Cart" style={{ width: 18, height: 18 }} />
                    {cart && cart.length > 0 && (
                      <span style={{ 
                        position: 'absolute', 
                        top: -4, 
                        right: -4, 
                        background: 'linear-gradient(135deg, #DC2626, #EF4444)', 
                        color: '#fff', 
                        borderRadius: '50%', 
                        padding: '2px 6px', 
                        fontSize: '12px', 
                        fontWeight: '700',
                        minWidth: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)'
                      }}>
                        {cart.length}
                      </span>
                    )}
                  </button>
                )}
              </>
            ) : (
              <a 
                href="/store-profile" 
                style={{ 
                  color: '#007B7F', 
                  textDecoration: 'none', 
                  fontWeight: 'bold', 
                  fontSize: '1.2rem', 
                  padding: '6px',
                  borderRadius: '8px',
                  background: 'rgba(0, 123, 127, 0.1)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }} 
                title="Store Profile"
                onMouseEnter={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.2)';
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                <span role="img" aria-label="profile">👤</span>
              </a>
            )}

            {/* Feed Notifications Bell - Shows for both buyers and sellers */}
            {showNotificationBell && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowNotificationDropdown(!showNotificationDropdown);
                    if (!showNotificationDropdown) {
                      // Reset notification count when opening dropdown
                      setFeedNotificationCount(0);
                    }
                  }}
                  style={{ 
                    background: 'rgba(102, 126, 234, 0.1)', 
                    border: 'none', 
                    padding: '6px', 
                    position: 'relative', 
                    cursor: 'pointer',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(102, 126, 234, 0.2)';
                    e.target.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                    e.target.style.transform = 'scale(1)';
                  }}
                  title={userType === 'buyer' ? 'Feed Notifications' : 'Post Notifications'}
                  aria-label={userType === 'buyer' ? 'Feed Notifications' : 'Post Notifications'}
                >
                  <span style={{ fontSize: '16px' }}>🔔</span>
                  {feedNotificationCount > 0 && (
                    <span style={{ 
                      position: 'absolute', 
                      top: -4, 
                      right: -4, 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                      color: '#fff', 
                      borderRadius: '50%', 
                      padding: '2px 6px', 
                      fontSize: '12px', 
                      fontWeight: '700',
                      minWidth: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
                      animation: 'pulse 2s infinite'
                    }}>
                      {feedNotificationCount > 99 ? '99+' : feedNotificationCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <>
                    {/* Backdrop */}
                    <div 
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 1000,
                      }}
                      onClick={() => setShowNotificationDropdown(false)}
                    />
                    
                    {/* Dropdown Content */}
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      width: '350px',
                      maxWidth: '90vw',
                      maxHeight: '400px',
                      background: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      zIndex: 1001,
                      overflow: 'hidden'
                    }}>
                      {/* Header */}
                      <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #E5E7EB',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                            🔔 {userType === 'buyer' ? 'Feed Notifications' : 'Post Interactions'}
                          </h3>
                          <button
                            onClick={() => navigate('/feed')}
                            style={{
                              background: 'rgba(255,255,255,0.2)',
                              border: 'none',
                              color: 'white',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            {userType === 'buyer' ? 'View Feed' : 'Manage Posts'}
                          </button>
                        </div>
                      </div>

                      {/* Notifications List */}
                      <div style={{
                        maxHeight: '320px',
                        overflowY: 'auto'
                      }}>
                        {notifications.length === 0 ? (
                          <div style={{
                            padding: '40px 20px',
                            textAlign: 'center',
                            color: '#6B7280'
                          }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔕</div>
                            <div style={{ fontSize: '14px', fontWeight: '500' }}>No new notifications</div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>
                              {userType === 'buyer' 
                                ? "We'll notify you when someone interacts with your followed posts"
                                : "We'll notify you when someone interacts with your posts"
                              }
                            </div>
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <div
                              key={notification.id}
                              onClick={() => {
                                setShowNotificationDropdown(false);
                                navigate(`/feed?post=${notification.postId}`);
                              }}
                              style={{
                                padding: '12px 20px',
                                borderBottom: '1px solid #F3F4F6',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                background: notification.isNew ? 'rgba(102, 126, 234, 0.05)' : 'transparent',
                                position: 'relative'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = notification.isNew ? 'rgba(102, 126, 234, 0.1)' : '#F9FAFB'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = notification.isNew ? 'rgba(102, 126, 234, 0.05)' : 'transparent'}
                            >
                              {/* New indicator dot */}
                              {notification.isNew && (
                                <div style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: '#667eea',
                                  boxShadow: '0 0 0 2px white'
                                }} />
                              )}
                              {/* Avatar */}
                              <img
                                src={notification.avatar || 'https://via.placeholder.com/32x32/667eea/ffffff?text=👤'}
                                alt="Avatar"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '1px solid #E5E7EB'
                                }}
                              />
                              
                              {/* Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#1F2937',
                                  marginBottom: '2px',
                                  lineHeight: '1.4'
                                }}>
                                  {notification.title}
                                </div>
                                
                                <div style={{
                                  fontSize: '13px',
                                  color: '#6B7280',
                                  marginBottom: '4px',
                                  lineHeight: '1.4'
                                }}>
                                  {notification.content}
                                </div>
                                
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <span style={{
                                    fontSize: '11px',
                                    color: '#9CA3AF'
                                  }}>
                                    {notification.timestamp ? new Date(notification.timestamp).toLocaleString() : 'Recently'}
                                  </span>
                                  
                                  <span style={{
                                    fontSize: '10px',
                                    color: notification.isNew ? '#667eea' : '#9CA3AF',
                                    fontWeight: '500',
                                    backgroundColor: notification.isNew ? '#EEF2FF' : '#F3F4F6',
                                    padding: '2px 6px',
                                    borderRadius: '10px'
                                  }}>
                                    {notification.type === 'new_post' ? '📝 New Post' :
                                     notification.type === 'mention' ? '🏷️ Mention' :
                                     notification.type === 'reply' ? '↩️ Reply' :
                                     notification.type === 'comment_on_post' ? '💬 Comment' :
                                     notification.type === 'comment' ? '💬 Comment' :
                                     notification.type === 'likes' ? '❤️ Post Likes' :
                                     notification.type === 'reply_likes' ? '❤️ Reply Likes' : '🔔'}
                                    {notification.isNew && ' • NEW'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <button 
              onClick={handleLogout} 
              style={{ 
                background: 'rgba(220, 38, 38, 0.1)', 
                border: 'none', 
                color: '#DC2626', 
                fontWeight: '600', 
                cursor: 'pointer', 
                fontSize: '0.85rem',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.target.style.background = 'rgba(220, 38, 38, 0.2)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'rgba(220, 38, 38, 0.1)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(4px)',
              zIndex: 1999,
              animation: 'fadeIn 0.3s ease'
            }}
            onClick={() => setSidebarOpen(false)}
          />
          {/* Modern Sidebar */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 280,
            height: '100vh',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '4px 0 30px rgba(0, 0, 0, 0.15)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem 0',
            animation: 'slideIn 0.3s ease'
          }}>
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '0 2rem',
              marginBottom: '2rem' 
            }}>
              <h3 style={{ 
                color: '#1F2937', 
                margin: 0, 
                fontSize: '1.2rem', 
                fontWeight: '700' 
              }}>
                Menu
              </h3>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ 
                  background: 'rgba(220, 38, 38, 0.1)', 
                  border: 'none', 
                  borderRadius: '12px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px', 
                  cursor: 'pointer', 
                  color: '#DC2626',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.target.style.background = 'rgba(220, 38, 38, 0.2)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'rgba(220, 38, 38, 0.1)';
                  e.target.style.transform = 'scale(1)';
                }}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            {/* Menu Items */}
            <div 
              className="sidebar-scrollable"
              style={{ 
                flex: 1, 
                padding: '0 1rem',
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 120px)',
                paddingRight: '0.5rem',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0, 123, 127, 0.3) transparent'
              }}>
              <button 
                onClick={() => { setSidebarOpen(false); navigate('/my-reviews'); }} 
                style={{ 
                  color: '#1F2937', 
                  background: 'rgba(0, 123, 127, 0.05)', 
                  border: '1px solid rgba(0, 123, 127, 0.1)', 
                  fontWeight: '600', 
                  fontSize: '1rem', 
                  width: '100%',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.5rem', 
                  cursor: 'pointer',
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                  e.target.style.transform = 'translateX(4px)';
                  e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                  e.target.style.transform = 'translateX(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>⭐</span>
                My Reviews
              </button>
              
              {user && (
                <button 
                  onClick={() => { setSidebarOpen(false); navigate('/messages'); }} 
                  style={{ 
                    color: '#1F2937', 
                    background: 'rgba(0, 123, 127, 0.05)', 
                    border: '1px solid rgba(0, 123, 127, 0.1)', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    width: '100%',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    position: 'relative'
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.target.style.transform = 'translateX(4px)';
                    e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                    e.target.style.transform = 'translateX(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>💬</span>
                  Messages
                  {unreadMessageCount > 0 && (
                    <span style={{ 
                      position: 'absolute', 
                      top: '8px', 
                      right: '12px', 
                      background: 'linear-gradient(135deg, #DC2626, #EF4444)', 
                      color: '#fff', 
                      borderRadius: '50%', 
                      padding: '2px 6px', 
                      fontSize: '11px', 
                      fontWeight: '700',
                      minWidth: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                    }}>
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </span>
                  )}
                </button>
              )}
              
              {user && userType === 'buyer' && (
                <button 
                  onClick={() => { setSidebarOpen(false); navigate('/receipts'); }} 
                  style={{ 
                    color: '#1F2937', 
                    background: 'rgba(0, 123, 127, 0.05)', 
                    border: '1px solid rgba(0, 123, 127, 0.1)', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    width: '100%',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.target.style.transform = 'translateX(4px)';
                    e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                    e.target.style.transform = 'translateX(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>🧾</span>
                  Receipts
                </button>
              )}              {user && userType === 'seller' && (
                <button 
                  onClick={() => { setSidebarOpen(false); navigate('/reports'); }} 
                  style={{ 
                    color: '#1F2937', 
                    background: 'rgba(0, 123, 127, 0.05)', 
                    border: '1px solid rgba(0, 123, 127, 0.1)', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    width: '100%',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem', 
                    cursor: 'pointer',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.target.style.transform = 'translateX(4px)';
                    e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                    e.target.style.transform = 'translateX(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>📊</span>
                  Reports
                </button>
              )}
              
              {/* Help Center - visible for all users */}
              <a 
                href="/help-center" 
                onClick={() => setSidebarOpen(false)}
                style={{ 
                  color: '#1F2937', 
                  textDecoration: 'none', 
                  fontWeight: '600', 
                  fontSize: '1rem',
                  width: '100%',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.5rem',
                  borderRadius: '12px',
                  background: 'rgba(0, 123, 127, 0.05)',
                  border: '1px solid rgba(0, 123, 127, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                  e.target.style.transform = 'translateX(4px)';
                  e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                  e.target.style.transform = 'translateX(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📚</span>
                Help Center
              </a>



              {!user ? (
                <>
                  <a 
                    href="/about" 
                    onClick={() => setSidebarOpen(false)}
                    style={{ 
                      color: '#1F2937', 
                      textDecoration: 'none', 
                      fontWeight: '600', 
                      fontSize: '1rem',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem',
                      borderRadius: '12px',
                      background: 'rgba(0, 123, 127, 0.05)',
                      border: '1px solid rgba(0, 123, 127, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'translateX(4px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                      e.target.style.transform = 'translateX(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                    About
                  </a>
                  
                  {/* Only show Admin Login on non-mobile devices */}
                  {!isMobile && (
                    <button 
                      onClick={handleAdminAccess}
                      style={{ 
                        color: '#DC2626', 
                        textDecoration: 'none', 
                        fontWeight: '600', 
                        fontSize: '1rem',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        marginBottom: '0.5rem',
                        borderRadius: '12px',
                        background: 'rgba(220, 38, 38, 0.05)',
                        border: '1px solid rgba(220, 38, 38, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => {
                        e.target.style.background = 'rgba(220, 38, 38, 0.1)';
                        e.target.style.transform = 'translateX(4px)';
                        e.target.style.boxShadow = '0 4px 15px rgba(220, 38, 38, 0.1)';
                      }}
                      onMouseLeave={e => {
                        e.target.style.background = 'rgba(220, 38, 38, 0.05)';
                        e.target.style.transform = 'translateX(0)';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>🔒</span>
                      Admin Portal
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setSidebarOpen(false); navigate('/explore'); }}
                    style={{ 
                      color: '#1F2937', 
                      background: 'rgba(0, 123, 127, 0.05)', 
                      border: '1px solid rgba(0, 123, 127, 0.1)', 
                      fontWeight: '600', 
                      fontSize: '1rem', 
                      width: '100%',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem', 
                      cursor: 'pointer',
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'translateX(4px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                      e.target.style.transform = 'translateX(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>🔍</span>
                    Explore
                  </button>
                  <button
                    onClick={() => { setSidebarOpen(false); navigate('/feed'); }}
                    style={{ 
                      color: '#1F2937', 
                      background: 'rgba(0, 123, 127, 0.05)', 
                      border: '1px solid rgba(0, 123, 127, 0.1)', 
                      fontWeight: '600', 
                      fontSize: '1rem', 
                      width: '100%',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem', 
                      cursor: 'pointer',
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'translateX(4px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                      e.target.style.transform = 'translateX(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>📱</span>
                    Feed
                  </button>
                  <a 
                    href="/settings" 
                    onClick={() => setSidebarOpen(false)}
                    style={{ 
                      color: '#1F2937', 
                      textDecoration: 'none', 
                      fontWeight: '600', 
                      fontSize: '1rem',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem',
                      borderRadius: '12px',
                      background: 'rgba(0, 123, 127, 0.05)',
                      border: '1px solid rgba(0, 123, 127, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'translateX(4px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                      e.target.style.transform = 'translateX(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>⚙️</span>
                    Settings
                  </a>
                </>
              )}
              
              {/* Social Media & Community Links */}
              <div style={{ 
                marginTop: '1.5rem', 
                paddingTop: '1.5rem', 
                borderTop: '1px solid #E5E7EB' 
              }}>
                {/* WhatsApp Community & Support */}
                <a 
                  href="https://wa.me/447377834081?text=Hi! I'd like to join the Lokal community and get support." 
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSidebarOpen(false)}
                  style={{ 
                    color: '#25D366', 
                    textDecoration: 'none', 
                    fontWeight: '600', 
                    fontSize: '1rem',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem',
                    borderRadius: '12px',
                    background: 'rgba(37, 211, 102, 0.05)',
                    border: '1px solid rgba(37, 211, 102, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(37, 211, 102, 0.1)';
                    e.target.style.transform = 'translateX(4px)';
                    e.target.style.boxShadow = '0 4px 15px rgba(37, 211, 102, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(37, 211, 102, 0.05)';
                    e.target.style.transform = 'translateX(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>💬</span>
                  WhatsApp Community
                </a>
                
                {/* Social Media Icons Row */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '0.75rem', 
                  marginTop: '1rem',
                  marginBottom: '1rem'
                }}>
                  {/* Instagram */}
                  <a 
                    href="https://instagram.com/lokallshops" 
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSidebarOpen(false)}
                    style={{ 
                      textDecoration: 'none',
                      padding: '0.5rem',
                      borderRadius: '50%',
                      background: 'linear-gradient(45deg, #f09433  0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                      width: '40px',
                      height: '40px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={e => {
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }}
                    title="Follow us on Instagram @lokallshops"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                  
                  {/* TikTok */}
                  <a 
                    href="https://tiktok.com/@lokalshops" 
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSidebarOpen(false)}
                    style={{ 
                      textDecoration: 'none',
                      padding: '0.5rem',
                      borderRadius: '50%',
                      background: '#000000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                      width: '40px',
                      height: '40px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={e => {
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }}
                    title="Follow us on TikTok @lokalshops"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1.68 13.22c2.76 0 5-2.24 5-5V9.26a8.84 8.84 0 0 0 4.41 1.2V7.14a4.86 4.86 0 0 1-1.98-.45z"/>
                    </svg>
                  </a>
                  
                  {/* Admin Support */}
                  <a 
                    href="https://instagram.com/lokaladmin" 
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSidebarOpen(false)}
                    style={{ 
                      textDecoration: 'none',
                      padding: '0.5rem',
                      borderRadius: '50%',
                      background: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                      width: '40px',
                      height: '40px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={e => {
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.boxShadow = '0 4px 15px rgba(220, 38, 38, 0.3)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }}
                    title="Admin Support @lokaladmin"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                    </svg>
                  </a>
                </div>
                
                <p style={{ 
                  color: '#6B7280', 
                  fontSize: '0.875rem', 
                  textAlign: 'center',
                  marginTop: '0.5rem'
                }}>
                  Follow us & get support
                </p>
              </div>
            </div>
          </div>
          <style>
            {`
              @keyframes slideIn {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
              }
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
              }
            `}
          </style>
        </>
      )}
      
      {/* Admin Code Modal */}
      {showAdminCodeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Admin Portal Access
              </h2>
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Enter the access code (109826) to verify your identity and access the admin portal.
              </p>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.5rem' }}>
                Access Code
              </label>
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="Enter 6-digit access code"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  marginBottom: adminCodeError ? '0.5rem' : '0'
                }}
              />
              {adminCodeError && (
                <p style={{ color: '#DC2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {adminCodeError}
                </p>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAdminCodeModal(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: '#f3f4f6',
                  color: '#1f2937',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={verifyAdminCode}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: '#DC2626',
                  color: 'white',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1rem' }}>�</span>
                Verify Access Code
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
    </>
  );
}

export default Navbar;