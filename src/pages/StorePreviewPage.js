import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useCart } from '../CartContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripePaymentForm from '../components/StripePaymentForm';

// Load Stripe outside of component render
// Using the REACT_APP_STRIPE_PUBLIC_KEY from .env file
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const currencySymbols = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
  CAD: "C$",
  AUD: "A$",
  ZAR: "R",
  GHS: "₵",
  KES: "KSh",
  XOF: "CFA",
  XAF: "CFA",
  INR: "₹",
  JPY: "¥",
  CNY: "¥"
};

function getCurrencySymbol(code) {
  return currencySymbols[code] || code;
}

const currenciesWithDecimals = ["GBP", "USD", "EUR", "CAD", "AUD", "ZAR", "GHS", "KES", "INR", "CNY"];
function formatPrice(price, currency) {
  if (currenciesWithDecimals.includes(currency)) {
    return Number(price).toFixed(2);
  }
  return price;
}

function StarRating({ value, onChange, max = 5 }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[...Array(max)].map((_, i) => (
        <span
          key={i}
          style={{
            fontSize: 28,
            color: i < value ? '#FFD700' : '#ccc',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
          onClick={() => onChange(i + 1)}
          onMouseOver={e => e.target.style.color = '#FFD700'}
          onMouseOut={e => e.target.style.color = i < value ? '#FFD700' : '#ccc'}
          role="button"
          aria-label={`Rate ${i + 1} star${i === 0 ? '' : 's'}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function StorePreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [message, setMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [following, setFollowing] = useState(false);
  const [userType, setUserType] = useState('');
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = not logged in, object = logged in
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [tab, setTab] = useState('products');
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [reviews, setReviews] = useState([]);
  const { addToCart } = useCart();
  const [showAdded, setShowAdded] = useState(false);
  
  // Help/Report functionality states
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  
  // Enhanced reporting states
  const [userStoreHistory, setUserStoreHistory] = useState([]);
  const [selectedReportStore, setSelectedReportStore] = useState(null);
  const [loadingStoreHistory, setLoadingStoreHistory] = useState(false);
  
  // Store fee settings
  // Boost store functionality
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostDuration, setBoostDuration] = useState(7); // Default 7 days
  const [boostProcessing, setBoostProcessing] = useState(false);
  const [boostError, setBoostError] = useState('');
  const [boostSuccess, setBoostSuccess] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState('');
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [storeFeeSettings, setStoreFeeSettings] = useState({
    deliveryEnabled: false,
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    serviceFeeEnabled: false,
    serviceFeeType: 'percentage',
    serviceFeeRate: 2.5,
    serviceFeeAmount: 0,
    serviceFeeMax: 0,
    refundsEnabled: true
  });

  // Only declare daysOfWeek ONCE at the top of the file
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Optimize authentication and user type detection
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user || null);
      
      if (user) {
        // Use non-blocking approach for user type detection
        setTimeout(async () => {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            setUserType(userDoc.exists() ? 'buyer' : 'seller');
            
            // Add to viewed stores for buyers only (non-blocking)
            if (userDoc.exists() && id) {
              const viewedKey = `viewedStores_${user.uid}`;
              const existingViewed = JSON.parse(localStorage.getItem(viewedKey) || '[]');
              const filteredViewed = existingViewed.filter(storeId => storeId !== id);
              const updatedViewed = [id, ...filteredViewed].slice(0, 20);
              localStorage.setItem(viewedKey, JSON.stringify(updatedViewed));
            }
          } catch (error) {
            console.error('Error checking user type:', error);
            setUserType('');
          }
        }, 0); // Execute after current call stack
      } else {
        setUserType('');
      }
    });
    return () => unsubscribe();
  }, [id]);

  // Consolidate store data loading (store info + fee settings) into single listener
  useEffect(() => {
    if (!id) return;
    
    setLoading(true);
    const unsubStore = onSnapshot(doc(db, 'stores', id), (docSnap) => {
      if (docSnap.exists()) {
        const storeData = docSnap.data();
        setStore(storeData);
        
        // Handle fee settings in same listener to avoid duplicate fetching
        if (storeData.feeSettings) {
          setStoreFeeSettings({
            ...storeData.feeSettings,
            refundsEnabled: storeData.feeSettings.refundsEnabled !== false
          });
        } else {
          // Set default values if no settings found
          setStoreFeeSettings({
            deliveryEnabled: false,
            deliveryFee: 0,
            freeDeliveryThreshold: 0,
            serviceFeeEnabled: false,
            serviceFeeType: 'percentage',
            serviceFeeRate: 2.5,
            serviceFeeAmount: 0,
            serviceFeeMax: 0,
            refundsEnabled: true
          });
        }
      } else {
        setStore(null);
        // Set default fee settings for non-existent store
        setStoreFeeSettings({
          deliveryEnabled: false,
          deliveryFee: 0,
          freeDeliveryThreshold: 0,
          serviceFeeEnabled: false,
          serviceFeeType: 'percentage',
          serviceFeeRate: 2.5,
          serviceFeeAmount: 0,
          serviceFeeMax: 0,
          refundsEnabled: true
        });
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading store data:', error);
      setLoading(false);
    });
    
    const unsubItems = onSnapshot(collection(db, 'stores', id, 'items'), (querySnapshot) => {
      setItems(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => {
      unsubStore();
      unsubItems();
    };
  }, [id]);

  // Defer following status check until after initial load
  useEffect(() => {
    if (!authUser || !id || loading) return; // Wait for auth and store to load
    
    const followerRef = doc(db, 'stores', id, 'followers', authUser.uid);
    const unsub = onSnapshot(followerRef, (docSnap) => {
      setFollowing(docSnap.exists());
    });
    return () => unsub();
  }, [authUser, id, loading]); // Add loading dependency

  // Optimize reviews loading with user data caching
  useEffect(() => {
    if (!id) return;
    
    // Cache for user data to avoid repeated fetches
    const userDataCache = new Map();
    
    const unsubscribe = onSnapshot(collection(db, 'stores', id, 'reviews'), async (querySnapshot) => {
      const reviewsData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      // Calculate ratings immediately for faster UI update
      if (reviewsData.length > 0) {
        const totalRating = reviewsData.reduce((sum, review) => sum + (review.rating || 0), 0);
        const avgRating = (totalRating / reviewsData.length).toFixed(1);
        setAvgRating(parseFloat(avgRating));
        setRatingCount(reviewsData.length);
      } else {
        setAvgRating(0);
        setRatingCount(0);
      }
      
      // Set reviews with existing data first (for immediate display)
      setReviews(reviewsData);
      
      // Then enhance with user data in background (non-blocking)
      setTimeout(async () => {
        try {
          const reviewsWithUserData = await Promise.all(
            reviewsData.map(async (review) => {
              // Check cache first
              if (userDataCache.has(review.userId)) {
                const userData = userDataCache.get(review.userId);
                return {
                  ...review,
                  userName: userData.name || userData.displayName || review.userName || 'Anonymous',
                  userPhoto: userData.photoURL || userData.profilePicture || review.userPhoto || null
                };
              }
              
              try {
                // Fetch and cache user data
                const userDoc = await getDoc(doc(db, 'users', review.userId));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  userDataCache.set(review.userId, userData); // Cache the data
                  return {
                    ...review,
                    userName: userData.name || userData.displayName || review.userName || 'Anonymous',
                    userPhoto: userData.photoURL || userData.profilePicture || review.userPhoto || null
                  };
                }
                return review;
              } catch (error) {
                console.error('Error fetching user data for review:', error);
                return review;
              }
            })
          );
          
          // Update reviews with enhanced user data
          setReviews(reviewsWithUserData);
        } catch (error) {
          console.error('Error enhancing reviews with user data:', error);
        }
      }, 100); // Small delay to not block initial render
    });

    return () => unsubscribe();
  }, [id]);

  const handleFollow = async () => {
    if (!authUser || !id) return;
    const followerRef = doc(db, 'stores', id, 'followers', authUser.uid);
    await setDoc(followerRef, {
      uid: authUser.uid,
      email: authUser.email || '',
      followedAt: new Date().toISOString(),
    });
  };

  const handleUnfollow = async () => {
    if (!authUser || !id) return;
    const followerRef = doc(db, 'stores', id, 'followers', authUser.uid);
    await deleteDoc(followerRef);
  };
  
  // Handle boosting a store
  const handleBoostStore = async () => {
    if (!authUser) {
      setBoostError('You must be logged in to boost a store');
      return;
    }
    
    if (!store) {
      setBoostError('Store information not available');
      return;
    }
    
    try {
      setBoostProcessing(true);
      setBoostError('');
      
      const boostAmount = boostDuration * 1.99; // £1.99 per day
      const currency = store.currency || 'GBP';
      
      // Create a payment intent for the boost
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? process.env.REACT_APP_PRODUCTION_API_URL 
        : process.env.REACT_APP_API_URL || 'http://localhost:3001';
        
      const response = await fetch(`${apiUrl}/create-boost-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: boostAmount,
          currency: currency,
          storeId: id,
          boostDuration: boostDuration,
          userId: authUser.uid
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent for boost');
      }

      const { clientSecret, paymentIntentId } = await response.json();
      
      // Show Stripe payment form to collect card details
      setShowPaymentForm(true);
      setStripeClientSecret(clientSecret);
      setStripePaymentIntentId(paymentIntentId);
      
    } catch (error) {
      console.error('Error creating boost payment intent:', error);
      setBoostError(error.message || 'Failed to create payment intent');
      setProcessing(false);
    }
  };
  
  // Handle successful payment
  const handlePaymentSuccess = async (paymentIntentId) => {
    try {
      // Update store in Firestore with boost information
      await updateStoreWithBoost(paymentIntentId);
      
      // Show success message
      setBoostSuccess(true);
      setShowPaymentForm(false);
    } catch (error) {
      console.error('Error updating store after payment:', error);
      setBoostError(error.message || 'Payment was successful but failed to update store status');
    } finally {
      setBoostProcessing(false);
    }
  };
  
  // Handle payment error
  const handlePaymentError = (errorMessage) => {
    setBoostError(errorMessage || 'Payment failed');
    setBoostProcessing(false);
  };
  
  // Update store with boost information
  const updateStoreWithBoost = async (paymentIntentId) => {
    // Calculate boost expiration date
    const boostStartDate = new Date();
    const boostExpiryDate = new Date();
    boostExpiryDate.setDate(boostExpiryDate.getDate() + boostDuration);
    
    // Update store document
    const storeRef = doc(db, 'stores', id);
    await setDoc(storeRef, {
      isBoosted: true,
      boostExpiryDate: boostExpiryDate,
      boostStartDate: boostStartDate,
      boostDuration: boostDuration,
      boostPaymentIntentId: paymentIntentId,
      boostAmount: boostDuration * 1.99,
      lastBoostedAt: new Date()
    }, { merge: true });
    
    // Also record the boost transaction in a separate collection
    await addDoc(collection(db, 'storeBoosts'), {
      storeId: id,
      storeName: store.storeName || store.name,
      storeOwnerId: store.ownerId,
      paymentIntentId: paymentIntentId,
      boostStartDate: boostStartDate,
      boostExpiryDate: boostExpiryDate,
      boostDuration: boostDuration,
      boostAmount: boostDuration * 1.99,
      currency: store.currency || 'GBP',
      paidById: authUser.uid,
      paidByName: authUser.displayName,
      paidByEmail: authUser.email,
      createdAt: new Date()
    });
  };

  const handleCheckbox = (item) => {
    setSelectedItems(prev => {
      if (prev.some(i => i && i.id === item.id)) {
        return prev.filter(i => i && i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const total = selectedItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);

  const handleSendMessage = async () => {
    if (!authUser) {
      alert('Please log in to send a message.');
      return;
    }

    if (isStoreOwner) {
      // If user is the store owner, just navigate to messages
      navigate('/messages');
      return;
    }

    // For buyers, navigate to messages with store information to start a conversation
    if (!store || !store.ownerId) {
      alert('Store information not found.');
      return;
    }

    // Fetch customer address for delivery purposes
    let customerAddress = '';
    try {
      const userDoc = await getDoc(doc(db, 'users', authUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        customerAddress = userData.address || userData.location || '';
      }
    } catch (error) {
      console.log('Could not fetch user address:', error);
    }

    // Navigate to messages page with store info for creating a conversation
    navigate('/messages', {
      state: {
        newConversation: {
          otherUserId: store.ownerId,
          otherUserName: store.storeName || store.businessName || store.name || 'Store',
          otherUserEmail: store.email || '',
          storeAddress: store.storeLocation || store.address || '',
          customerAddress: customerAddress,
          conversationId: [authUser.uid, store.ownerId].sort().join('_')
        }
      }
    });
  };

  // Use daysOfWeek everywhere in the file for day calculations
  const today = daysOfWeek[new Date().getDay()];
  const isClosedToday = store && store.closedDays && store.closedDays.includes(today);
  const todayOpening = store && store.openingTimes && store.openingTimes[today];
  const todayClosing = store && store.closingTimes && store.closingTimes[today];
  
  function isStoreOpenForToday(store) {
    if (!store) return false;
    
    const today = daysOfWeek[new Date().getDay()];
    
    // Check if store is closed today
    if (store.closedDays && store.closedDays.includes(today)) {
      return false;
    }
    
    // Get today's opening and closing times
    const todayOpening = store.openingTimes && store.openingTimes[today];
    const todayClosing = store.closingTimes && store.closingTimes[today];
    
    // If no specific times set for today, fall back to general opening/closing times
    const opening = todayOpening || store.openingTime;
    const closing = todayClosing || store.closingTime;
    
    if (!opening || !closing) return false;
    
    const now = new Date();
    const [openH, openM] = opening.split(':').map(Number);
    const [closeH, closeM] = closing.split(':').map(Number);
    
    const openDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openH, openM);
    const closeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeH, closeM);
    
    // Handle overnight hours (e.g., 10 PM to 6 AM)
    if (closeH < openH || (closeH === openH && closeM < openM)) {
      const nextDayClose = new Date(closeDate);
      nextDayClose.setDate(nextDayClose.getDate() + 1);
      return now >= openDate || now <= nextDayClose;
    }
    
    return now >= openDate && now <= closeDate;
  }

  // Add this line to define storeIsOpen
  const storeIsOpen = isStoreOpenForToday(store);

  // Helper to check if current user is the store owner
  const isStoreOwner = authUser && store && store.ownerId && authUser.uid === store.ownerId;

  // Add to cart handler
  function handleAddToCart(item) {
    addToCart({
      storeId: id,
      storeName: store.storeName,
      itemId: item.id,
      itemName: item.name,
      price: parseFloat(item.price),
      currency: item.currency,
      quantity: 1,
      image: item.image,
      deliveryType: store.deliveryType
    });
    setShowAdded(true);
    setTimeout(() => setShowAdded(false), 1500);
  }

  // Update the existing useEffect for auth to properly handle viewed stores
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user || null);
      if (user) {
        // Check if user is a buyer or seller
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserType('buyer');
        } else {
          setUserType('seller');
        }
        
        // Add this store to viewed stores for buyers
        if (userDoc.exists() && id) {
          const viewedKey = `viewedStores_${user.uid}`;
          const existingViewed = JSON.parse(localStorage.getItem(viewedKey) || '[]');
          
          // Remove store if it already exists (to move it to front)
          const filteredViewed = existingViewed.filter(storeId => storeId !== id);
          
          // Add store to beginning of array
          const updatedViewed = [id, ...filteredViewed];
          
          // Keep only last 20 viewed stores
          const limitedViewed = updatedViewed.slice(0, 20);
          
          // Save back to localStorage
          localStorage.setItem(viewedKey, JSON.stringify(limitedViewed));
          
          console.log('Saved viewed store from StorePreviewPage:', id, 'for user:', user.uid); // Debug log
        }
      } else {
        setUserType('');
      }
    });
    return () => unsubscribe();
  }, [id]); // Add id as dependency

  // Update the handleSubmitReview function to fetch user profile data from Firestore
  const handleSubmitReview = async () => {
    if (!authUser || !id || userRating === 0) {
      alert('Please select a rating before submitting.');
      return;
    }
    
    try {
      // Fetch user profile data from Firestore
      const userDoc = await getDoc(doc(db, 'users', authUser.uid));
      let userData = {
        userName: authUser.displayName || authUser.email?.split('@')[0] || 'Anonymous',
        userPhoto: authUser.photoURL || null
      };
      
      // If user document exists in Firestore, use that data instead
      if (userDoc.exists()) {
        const firestoreUserData = userDoc.data();
        userData = {
          userName: firestoreUserData.name || firestoreUserData.displayName || authUser.displayName || authUser.email?.split('@')[0] || 'Anonymous',
          userPhoto: firestoreUserData.photoURL || firestoreUserData.profilePicture || authUser.photoURL || null
        };
      }
      
      await addDoc(collection(db, 'stores', id, 'reviews'), {
        rating: userRating,
        text: userReview.trim(),
        userId: authUser.uid,
        userName: userData.userName,
        userPhoto: userData.userPhoto,
        createdAt: serverTimestamp(),
      });
      
      setReviewSent(true);
      setTimeout(() => setReviewSent(false), 2000);
      setUserRating(0);
      setUserReview('');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    }
  };

  // Handle report submission
  const handleSubmitReport = async () => {
    if (!authUser || !reportReason.trim()) {
      alert('Please select a reason for reporting.');
      return;
    }

    setReportSubmitting(true);
    try {
      // Get user data for the report
      const userDoc = await getDoc(doc(db, 'users', authUser.uid));
      let userData = {
        userName: authUser.displayName || authUser.email?.split('@')[0] || 'Anonymous',
        userEmail: authUser.email
      };
      
      if (userDoc.exists()) {
        const firestoreUserData = userDoc.data();
        userData = {
          userName: firestoreUserData.name || firestoreUserData.displayName || userData.userName,
          userEmail: firestoreUserData.email || authUser.email
        };
      }

      // Submit the report to admin_complaints collection
      await addDoc(collection(db, 'admin_complaints'), {
        type: 'store_report',
        reason: reportReason,
        details: reportDetails.trim(),
        reportedStoreId: id,
        reportedStoreName: store.storeName,
        reportedStoreOwner: store.ownerId,
        reporterUserId: authUser.uid,
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
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    }
    setReportSubmitting(false);
  };

  // Handle contact admin functionality
  const handleContactAdmin = async () => {
    if (!authUser) {
      alert('Please log in to contact admin.');
      return;
    }

    try {
      // Get user data
      const userDoc = await getDoc(doc(db, 'users', authUser.uid));
      let userData = {
        userName: authUser.displayName || authUser.email?.split('@')[0] || 'Anonymous',
        userEmail: authUser.email
      };
      
      if (userDoc.exists()) {
        const firestoreUserData = userDoc.data();
        userData = {
          userName: firestoreUserData.name || firestoreUserData.displayName || userData.userName,
          userEmail: firestoreUserData.email || authUser.email
        };
      }

      const conversationId = `admin_${authUser.uid}`;

      // Create initial admin conversation message
      await addDoc(collection(db, 'messages'), {
        conversationId: conversationId,
        senderId: 'admin',
        senderName: 'Lokal Admin Support',
        senderEmail: 'admin@lokal.com',
        receiverId: authUser.uid,
        receiverName: userData.userName,
        receiverEmail: userData.userEmail,
        message: 'Hello! I\'m here to help you with any issues you may have. Please use the reporting form below to provide details about your concern.',
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'text',
        isAdminMessage: true
      });

      // Navigate to messages page with admin conversation setup
      navigate('/messages', {
        state: {
          newConversation: {
            otherUserId: 'admin',
            otherUserName: 'Lokal Admin Support',
            otherUserEmail: 'admin@lokal.com',
            isAdminChat: true,
            storeContext: {
              storeId: id,
              storeName: store?.storeName || 'Unknown Store',
              storeOwner: store?.ownerId || 'Unknown'
            },
            conversationId: conversationId
          }
        }
      });
    } catch (error) {
      console.error('Error setting up admin contact:', error);
      alert('Failed to contact admin. Please try again.');
    }
  };

  // Fetch user's store history for reporting
  const fetchUserStoreHistory = async () => {
    if (!authUser) return;
    
    setLoadingStoreHistory(true);
    try {
      const storeHistoryMap = new Map();
      
      // Get recently viewed stores from localStorage
      const viewedKey = `viewedStores_${authUser.uid}`;
      const recentlyViewed = JSON.parse(localStorage.getItem(viewedKey) || '[]');
      
      // Get store details for recently viewed stores
      for (const storeId of recentlyViewed.slice(0, 10)) { // Limit to last 10 viewed
        try {
          const storeDoc = await getDoc(doc(db, 'stores', storeId));
          if (storeDoc.exists()) {
            const storeData = storeDoc.data();
            storeHistoryMap.set(storeId, {
              id: storeId,
              name: storeData.storeName || storeData.businessName || 'Unknown Store',
              email: storeData.email || 'N/A',
              location: storeData.storeLocation || storeData.address || 'N/A',
              ownerId: storeData.ownerId || storeId,
              type: 'viewed',
              interactionDate: new Date() // Recent view
            });
          }
        } catch (error) {
          console.log(`Could not fetch store ${storeId}:`, error);
        }
      }

      // Get order history from user's orders
      try {
        const ordersQuery = query(
          collection(db, 'orders'),
          where('customerId', '==', authUser.uid),
          orderBy('createdAt', 'desc')
        );
        
        const ordersSnapshot = await getDocs(ordersQuery);
        const processedStores = new Set();
        
        ordersSnapshot.docs.slice(0, 20).forEach(orderDoc => { // Limit to last 20 orders
          const orderData = orderDoc.data();
          const storeId = orderData.sellerId;
          
          if (storeId && !processedStores.has(storeId)) {
            processedStores.add(storeId);
            
            // Either update existing entry or create new one
            const existingStore = storeHistoryMap.get(storeId);
            if (existingStore) {
              storeHistoryMap.set(storeId, {
                ...existingStore,
                type: 'ordered', // Upgrade from viewed to ordered
                interactionDate: orderData.createdAt?.toDate() || new Date(),
                orderCount: (existingStore.orderCount || 0) + 1
              });
            } else {
              storeHistoryMap.set(storeId, {
                id: storeId,
                name: orderData.sellerName || orderData.storeName || 'Unknown Store',
                email: orderData.sellerEmail || 'N/A',
                location: orderData.storeLocation || 'N/A',
                ownerId: storeId,
                type: 'ordered',
                interactionDate: orderData.createdAt?.toDate() || new Date(),
                orderCount: 1
              });
            }
          }
        });
      } catch (error) {
        console.log('Could not fetch order history:', error);
      }

      // Convert map to sorted array
      const storeHistoryArray = Array.from(storeHistoryMap.values())
        .sort((a, b) => {
          // Prioritize ordered stores, then by interaction date
          if (a.type === 'ordered' && b.type === 'viewed') return -1;
          if (a.type === 'viewed' && b.type === 'ordered') return 1;
          return new Date(b.interactionDate) - new Date(a.interactionDate);
        });

      setUserStoreHistory(storeHistoryArray);
    } catch (error) {
      console.error('Error fetching store history:', error);
    }
    setLoadingStoreHistory(false);
  };

  // Load store history when report modal is opened
  useEffect(() => {
    if (showReportModal && authUser && userStoreHistory.length === 0) {
      fetchUserStoreHistory();
    }
  }, [showReportModal, authUser]);

  if (loading) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
          {/* Store Header Skeleton */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 8px #B8B8B8',
            padding: '2rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: '#E5E7EB',
                animation: 'pulse 2s infinite'
              }}></div>
              <div style={{ flex: 1 }}>
                <div style={{
                  height: '2rem',
                  backgroundColor: '#E5E7EB',
                  borderRadius: '8px',
                  marginBottom: '0.5rem',
                  animation: 'pulse 2s infinite'
                }}></div>
                <div style={{
                  height: '1rem',
                  backgroundColor: '#E5E7EB',
                  borderRadius: '8px',
                  width: '60%',
                  animation: 'pulse 2s infinite'
                }}></div>
              </div>
            </div>
            
            {/* Stats Skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  height: '60px',
                  backgroundColor: '#E5E7EB',
                  borderRadius: '8px',
                  animation: 'pulse 2s infinite'
                }}></div>
              ))}
            </div>
            
            {/* Action Buttons Skeleton */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  width: '120px',
                  height: '40px',
                  backgroundColor: '#E5E7EB',
                  borderRadius: '8px',
                  animation: 'pulse 2s infinite'
                }}></div>
              ))}
            </div>
          </div>

          {/* Products Section Skeleton */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 8px #B8B8B8',
            padding: '2rem'
          }}>
            <div style={{
              height: '1.5rem',
              backgroundColor: '#E5E7EB',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              width: '150px',
              animation: 'pulse 2s infinite'
            }}></div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{
                  backgroundColor: '#E5E7EB',
                  borderRadius: '12px',
                  height: '200px',
                  animation: 'pulse 2s infinite'
                }}></div>
              ))}
            </div>
          </div>
        </div>
        
        <style>
          {`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}
        </style>
      </div>
    );
  }
  if (!store) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', marginTop: 80, color: '#D92D20' }}>Store not found.</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      {showAdded && (
        <div style={{
          position: 'fixed',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#28a745',
          color: '#fff',
          padding: '1rem 2rem',
          borderRadius: 12,
          fontWeight: 700,
          fontSize: '1.1rem',
          zIndex: 2000,
          boxShadow: '0 2px 8px #0002',
          animation: 'fadeInOut 1.5s',
        }}>
          ✓ Added to cart!
        </div>
      )}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(-50%) scale(0.95); }
          10% { opacity: 1; transform: translateX(-50%) scale(1.05); }
          80% { opacity: 1; transform: translateX(-50%) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) scale(0.95); }
        }
        @media (max-width: 600px) {
          .store-action-buttons {
            width: 100%;
            display: flex;
            flex-direction: row;
            gap: 8px;
            margin-top: 12px;
            justify-content: center;
          }
          .store-info {
            text-align: left;
            align-items: flex-start;
          }
        }
      `}</style>
      <div style={{ maxWidth: 800, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem', position: 'relative' }}>
        {/* Help Icon - Show only for authenticated buyers */}
        {userType === 'buyer' && authUser && !isStoreOwner && (
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
            <button
              onClick={() => setShowHelpModal(true)}
              style={{
                background: '#F0F9FF',
                border: '1px solid #007B7F',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#007B7F',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Get help or report this store"
            >
              ?
            </button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            {store.backgroundImg && (
              <img src={store.backgroundImg} alt="Store" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', filter: storeIsOpen ? 'none' : 'grayscale(0.7)', opacity: storeIsOpen ? 1 : 0.5, transition: 'opacity 0.3s, filter 0.3s' }} />
            )}
            {!storeIsOpen && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 60, background: 'rgba(255,255,255,0.55)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', color: '#D92D20', pointerEvents: 'none' }}>
                Closed
              </div>
            )}
          </div>
          <div className="store-info" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>{store.storeName}</div>
              {store.isBoosted && (
                <div 
                  style={{ 
                    backgroundColor: '#FFD700',
                    color: '#333', 
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    animation: 'pulse 2s infinite'
                  }}
                  title="This store is boosted"
                >
                  <span style={{ fontSize: '0.9rem' }}>⭐</span> BOOSTED
                </div>
              )}
              <style>{`
                @keyframes pulse {
                  0% { transform: scale(1); }
                  50% { transform: scale(1.05); }
                  100% { transform: scale(1); }
                }
              `}</style>
            </div>
            <div style={{ color: '#444', fontSize: '1rem' }}>{store.storeLocation}</div>
            {store.phoneNumber && (
              <div style={{ color: '#007B7F', fontSize: '1rem', marginTop: 4 }}>
                <a 
                  href={`tel:${store.phoneNumber}`}
                  style={{ 
                    color: '#007B7F', 
                    textDecoration: 'none', 
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600
                  }}
                  onMouseOver={(e) => e.target.style.color = '#005a5f'}
                  onMouseOut={(e) => e.target.style.color = '#007B7F'}
                >
                  <span>{store.phoneType === 'personal' ? '📱' : '📞'}</span>
                  <span>{store.phoneNumber}</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8, marginLeft: 2 }}>
                    ({store.phoneType === 'personal' ? 'Personal' : 'Work'})
                  </span>
                </a>
              </div>
            )}
            <div style={{ color: '#007B7F', fontSize: '1rem' }}>
              ⭐ {avgRating > 0 ? avgRating : 'No ratings'} {ratingCount > 0 && `(${ratingCount} review${ratingCount !== 1 ? 's' : ''})`}
            </div>
            <div style={{ color: '#444', fontSize: '1.05rem', marginTop: 4 }}><b>Origin:</b> {store.origin}</div>
            <div style={{ color: '#007B7F', fontSize: '1.05rem', marginTop: 2 }}><b>Delivery Type:</b> {store.deliveryType}</div>
            
            {/* Display fee information */}
            {console.log('Current storeFeeSettings:', storeFeeSettings, 'deliveryEnabled:', storeFeeSettings.deliveryEnabled, 'serviceFeeEnabled:', storeFeeSettings.serviceFeeEnabled)}
            {/* Hide delivery fee for ALL Collection orders (both Pay at Store and Card Payment) */}
            {(() => {
              const isCollectionStore = store.deliveryType === 'Collection';
              const shouldShowDeliveryFee = storeFeeSettings.deliveryEnabled && !isCollectionStore;
              const shouldShowFeeSection = shouldShowDeliveryFee || storeFeeSettings.serviceFeeEnabled;
              
              return shouldShowFeeSection && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0f9ff', borderRadius: 6, fontSize: '0.9rem' }}>
                  <div style={{ fontWeight: 600, color: '#007B7F', marginBottom: 4 }}>📋 Store Fees:</div>
                  {shouldShowDeliveryFee && (
                    <div style={{ color: '#444' }}>
                      • Delivery: {getCurrencySymbol(store.currency || 'GBP')}{formatPrice(storeFeeSettings.deliveryFee, store.currency || 'GBP')}
                      {storeFeeSettings.freeDeliveryThreshold > 0 && (
                        <span style={{ color: '#007B7F' }}> (Free over {getCurrencySymbol(store.currency || 'GBP')}{formatPrice(storeFeeSettings.freeDeliveryThreshold, store.currency || 'GBP')})</span>
                      )}
                    </div>
                  )}
                  {storeFeeSettings.serviceFeeEnabled && (
                    <div style={{ color: '#444' }}>
                      • Service fee: {storeFeeSettings.serviceFeeType === 'percentage' 
                        ? `${storeFeeSettings.serviceFeeRate}%${storeFeeSettings.serviceFeeMax > 0 ? ` (max ${getCurrencySymbol(store.currency || 'GBP')}${formatPrice(storeFeeSettings.serviceFeeMax, store.currency || 'GBP')})` : ''}`
                        : `${getCurrencySymbol(store.currency || 'GBP')}${formatPrice(storeFeeSettings.serviceFeeAmount, store.currency || 'GBP')}`}
                    </div>
                  )}
                  {isCollectionStore && storeFeeSettings.deliveryEnabled && (
                    <div style={{ color: '#666', fontSize: '0.85rem', marginTop: 4, fontStyle: 'italic' }}>
                      * Delivery fee not applicable for collection orders
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* Display refunds policy notification */}
            {!storeFeeSettings.refundsEnabled && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 6, fontSize: '0.9rem', border: '1px solid #f87171' }}>
                <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>❌ Refund Policy:</div>
                <div style={{ color: '#7f1d1d' }}>
                  This store does not offer refunds. Please review your order carefully before purchasing.
                </div>
              </div>
            )}
            
            {/* Show setup link for store owners */}
            {isStoreOwner && !storeFeeSettings.deliveryEnabled && !storeFeeSettings.serviceFeeEnabled && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef3cd', borderRadius: 6, fontSize: '0.9rem', border: '1px solid #fbbf24' }}>
                <div style={{ color: '#92400e' }}>💡 You can set up delivery and service fees in your Wallet → Fee Settings</div>
              </div>
            )}
            
            {store.paymentType && (
              <div style={{ color: '#007B7F', fontSize: '1.05rem', marginTop: 8 }}>
                <b>Payment Method:</b> {store.paymentType === 'Own Card/Bank Details' ? 'Card Payment' : (store.paymentType === 'Other' ? 'Pay at Store' : store.paymentType)}
                {/* Removed paymentInfo details for security */}
              </div>
            )}
          </div>
          {/* Store actions for buyers and sellers */}
          {!isStoreOwner && (
            <div className="store-action-buttons">
              {/* Follow button - only shown to authenticated buyers */}
              {userType === 'buyer' && authUser && (
                following ? (
                  <button onClick={handleUnfollow} style={{ background: '#ccc', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginRight: 8, cursor: 'pointer' }}>
                    Unfollow
                  </button>
                ) : (
                  <button onClick={handleFollow} style={{ background: '#D92D20', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginRight: 8, cursor: 'pointer' }}>
                    Follow
                  </button>
                )
              )}
              
              {/* Message button - shown to authenticated users (buyers and sellers) */}
              {authUser && (
                <button onClick={handleSendMessage} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                  Message
                </button>
              )}
              
              {/* Sign-in prompt for unauthenticated users */}
              {!authUser && (
                <button onClick={() => {
                  alert('Please sign in to interact with this store');
                  navigate('/login');
                }} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                  Sign In to Interact
                </button>
              )}
            </div>
          )}
          
          {/* Small Boost Store Button - Available to all logged in users */}
          {authUser && (
            <div style={{ 
              position: 'absolute',
              top: '10px',
              left: '10px',
              zIndex: 5
            }}>
              <button
                onClick={() => setShowBoostModal(true)}
                style={{ 
                  background: store.isBoosted ? '#FEF9C3' : '#FFD700',
                  color: '#333', 
                  border: 'none', 
                  borderRadius: '50%', 
                  width: '40px',
                  height: '40px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'scale(1.1)';
                  e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'none';
                  e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
                }}
                title={store.isBoosted ? 'Store is boosted' : 'Boost this store'}
                disabled={boostProcessing}
                aria-label={store.isBoosted ? 'Store is boosted' : 'Boost this store'}
              >
                <span style={{ fontSize: '1.2rem' }}>⭐</span>
              </button>
            </div>
          )}
          {/* Message button for store owners */}
          {isStoreOwner && (
            <div className="store-action-buttons">
              <button onClick={handleSendMessage} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                Messages
              </button>
            </div>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={{ background: isClosedToday ? '#fbe8e8' : (storeIsOpen ? '#e8fbe8' : '#fbe8e8'), color: isClosedToday ? '#D92D20' : (storeIsOpen ? '#3A8E3A' : '#D92D20'), borderRadius: 8, padding: '4px 16px', fontWeight: 600, fontSize: '1.1rem' }}>
            {isClosedToday ? 'Closed Today' : (storeIsOpen ? 'Open' : 'Closed')}
          </span>
          {!isClosedToday && todayOpening && todayClosing && (
            <span style={{ marginLeft: 16, color: '#007B7F', fontSize: '1rem' }}>
              {todayOpening} - {todayClosing}
            </span>
          )}
          {store && Array.isArray(store.closedDays) && store.closedDays.length > 0 && (
            <div style={{ marginTop: 8, color: '#D92D20', fontSize: '1rem', fontWeight: 500 }}>
              <span>Closed: {store.closedDays.join(', ')}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 32, borderBottom: '1.5px solid #eee', marginBottom: 24 }}>
          <button onClick={() => setTab('products')} style={{ background: 'none', border: 'none', fontWeight: tab === 'products' ? 700 : 400, fontSize: '1.1rem', color: tab === 'products' ? '#007B7F' : '#444', borderBottom: tab === 'products' ? '2.5px solid #007B7F' : 'none', padding: '0.5rem 0', cursor: 'pointer' }}>Products</button>
          <button onClick={() => setTab('reviews')} style={{ background: 'none', border: 'none', fontWeight: tab === 'reviews' ? 700 : 400, fontSize: '1.1rem', color: tab === 'reviews' ? '#007B7F' : '#444', borderBottom: tab === 'reviews' ? '2.5px solid #007B7F' : 'none', padding: '0.5rem 0', cursor: 'pointer' }}>Reviews</button>
        </div>
        {tab === 'products' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
            {items.length === 0 ? (
              <div style={{ color: '#888' }}>No items added yet.</div>
            ) : (
              items.map(item => (
                <div key={item.id} style={{ width: 220, border: '1px solid #eee', borderRadius: 8, padding: 12, background: storeIsOpen ? '#f6f6fa' : '#f6f6fa', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: storeIsOpen ? 1 : 0.5, filter: storeIsOpen ? 'none' : 'grayscale(0.7)', transition: 'opacity 0.3s, filter 0.3s' }}>
                  {item.image && <img src={item.image} alt={item.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />}
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 8 }}>{item.name}</div>
                  <div style={{ color: '#007B7F', fontWeight: 500 }}>{getCurrencySymbol(item.currency)}{formatPrice(item.price, item.currency)}</div>
                  <div style={{ color: '#666', fontSize: '0.95rem' }}>Quality: {item.quality} | Qty: {item.quantity}</div>
                  {/* Show these buttons for buyers and unauthenticated users who are not the store owner */}
                  {(userType === 'buyer' || !authUser) && !isStoreOwner && storeIsOpen && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => {
                          if (!authUser) {
                            // Redirect to login page if not signed in
                            alert('Please sign in to add items to your cart');
                            navigate('/login');
                          } else {
                            handleAddToCart(item);
                          }
                        }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            {userType === 'buyer' && selectedItems.length > 0 && storeIsOpen && (
              <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#fff', border: '2px solid #007B7F', borderRadius: 12, padding: '1rem 2rem', fontWeight: 600, fontSize: '1.1rem', color: '#007B7F', zIndex: 1000, boxShadow: '0 2px 8px #ececec' }}>
                Total: {getCurrencySymbol(selectedItems[0].currency)}{selectedItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0).toFixed(2)}
              </div>
            )}
            {!authUser && storeIsOpen && (
              <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#fff', border: '2px solid #007B7F', borderRadius: 12, padding: '1rem 2rem', fontWeight: 600, fontSize: '1.1rem', color: '#007B7F', zIndex: 1000, boxShadow: '0 2px 8px #ececec', cursor: 'pointer' }} 
                   onClick={() => {
                     alert('Please sign in to view your cart and make purchases');
                     navigate('/login');
                   }}>
                Sign in to purchase
              </div>
            )}
          </div>
        )}
        {tab === 'reviews' && (
          <div style={{ marginTop: 24 }}>
            {/* Display overall rating summary */}
            <div style={{ marginBottom: 24, padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }}>Customer Reviews</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '2rem', color: '#FFD700' }}>★</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {avgRating > 0 ? `${avgRating} out of 5` : 'No ratings yet'}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.9rem' }}>
                    {ratingCount} review{ratingCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Show message for unauthenticated users */}
            {!authUser && !isStoreOwner && (
              <div style={{ marginBottom: 24, background: '#f8f9fa', borderRadius: 8, padding: 16, textAlign: 'center', border: '1px dashed #007B7F' }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: '#007B7F' }}>Want to leave a review?</div>
                <p style={{ marginBottom: 16 }}>Please log in or register to share your experience with this store.</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                  <button 
                    onClick={() => navigate('/login')} 
                    style={{ 
                      background: '#007B7F', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: 6, 
                      padding: '0.5rem 1.2rem', 
                      fontWeight: 600, 
                      cursor: 'pointer' 
                    }}
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => navigate('/register')} 
                    style={{ 
                      background: '#fff', 
                      color: '#007B7F', 
                      border: '1px solid #007B7F', 
                      borderRadius: 6, 
                      padding: '0.5rem 1.2rem', 
                      fontWeight: 600, 
                      cursor: 'pointer' 
                    }}
                  >
                    Register
                  </button>
                </div>
              </div>
            )}
            
            {/* Only show review form for authenticated buyers who are not the store owner */}
            {userType === 'buyer' && authUser && !isStoreOwner && (
              <div style={{ marginBottom: 24, background: '#f6f6fa', borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Leave a review:</div>
                <StarRating value={userRating} onChange={setUserRating} />
                <textarea 
                  value={userReview} 
                  onChange={e => setUserReview(e.target.value)} 
                  placeholder="Share your experience with this store..." 
                  style={{ 
                    width: '100%', 
                    minHeight: 80, 
                    borderRadius: 4, 
                    border: '1px solid #ccc', 
                    padding: 12, 
                    marginTop: 12,
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }} 
                />
                <button 
                  onClick={handleSubmitReview} 
                  disabled={userRating === 0}
                  style={{ 
                    background: userRating === 0 ? '#ccc' : '#007B7F', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 6, 
                    padding: '0.5rem 1.2rem', 
                    fontWeight: 600, 
                    fontSize: '1rem', 
                    marginTop: 12, 
                    cursor: userRating === 0 ? 'not-allowed' : 'pointer' 
                  }}
                >
                  Submit Review
                </button>
                {reviewSent && (
                  <div style={{ color: '#3A8E3A', marginTop: 8, fontWeight: 600 }}>
                    ✓ Review submitted successfully!
                  </div>
                )}
              </div>
            )}
            
            {/* Reviews list */}
            <div>
              {reviews.length === 0 ? (
                <div style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>
                  No reviews yet. Be the first to review this store!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {reviews
                    .sort((a, b) => {
                      // Sort by creation date, newest first
                      if (a.createdAt && b.createdAt) {
                        return b.createdAt.toMillis() - a.createdAt.toMillis();
                      }
                      return 0;
                    })
                    .map(r => (
                      <div key={r.id} style={{ 
                        display: 'flex', 
                        gap: 12, 
                        padding: 16, 
                        border: '1px solid #eee', 
                        borderRadius: 8,
                        background: '#fafafa',
                        alignItems: 'flex-start'
                      }}>
                        <img
                          src={r.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.userName || 'Anonymous')}&background=007B7F&color=fff&size=40`}
                          alt={r.userName || 'Anonymous'}
                          style={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: '50%', 
                            objectFit: 'cover', 
                            flexShrink: 0 
                          }}
                          onError={(e) => {
                            // Prevent infinite loop by checking if already using fallback
                            if (!e.target.src.includes('ui-avatars.com')) {
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(r.userName || 'Anonymous')}&background=007B7F&color=fff&size=40`;
                            }
                          }}
                        />
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                              {r.userName || 'Anonymous'}
                            </span>
                            <div style={{ display: 'flex', gap: 2 }}>
                              {[...Array(5)].map((_, i) => (
                                <span 
                                  key={i} 
                                  style={{ 
                                    color: i < r.rating ? '#FFD700' : '#ddd',
                                    fontSize: '1rem'
                                  }}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>
                          {r.text && (
                            <div style={{ color: '#444', fontSize: '0.95rem', lineHeight: 1.4, textAlign: 'left' }}>
                              {r.text}
                            </div>
                          )}
                          {r.createdAt && (
                            <div style={{ color: '#888', fontSize: '0.8rem', marginTop: 8, textAlign: 'left' }}>
                              {new Date(r.createdAt.toMillis()).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Help Modal */}
      {showHelpModal && (
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
            background: '#fff',
            borderRadius: 16,
            padding: '2rem',
            maxWidth: 400,
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
              <h3 style={{ margin: 0, color: '#007B7F' }}>Help & Support</h3>
              <button
                onClick={() => setShowHelpModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowHelpModal(false);
                  setShowReportModal(true);
                }}
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 8,
                  padding: '1rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '1rem'
                }}
              >
                <div style={{ fontWeight: 600, color: '#DC2626', marginBottom: '0.5rem' }}>
                  🚨 Report this store
                </div>
                <div style={{ color: '#7F1D1D', fontSize: '0.9rem' }}>
                  Report inappropriate content, fake products, or other issues
                </div>
              </button>

              <button
                onClick={() => {
                  setShowHelpModal(false);
                  handleContactAdmin();
                }}
                style={{
                  background: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  borderRadius: 8,
                  padding: '1rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '1rem'
                }}
              >
                <div style={{ fontWeight: 600, color: '#0369A1', marginBottom: '0.5rem' }}>
                  � Contact Admin
                </div>
                <div style={{ color: '#1E40AF', fontSize: '0.9rem' }}>
                  Get help with store issues or platform problems
                </div>
              </button>

              <div style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                padding: '1rem',
                fontSize: '0.9rem',
                color: '#6B7280'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>ℹ️ Need more help?</div>
                <div>If you need general support or have questions about using Lokal, please contact our support team through the settings page.</div>
              </div>
            </div>
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
            background: '#fff',
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
              <h3 style={{ margin: 0, color: '#DC2626' }}>Report Store</h3>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setReportDetails('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Reason for reporting *
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  fontSize: '1rem'
                }}
              >
                <option value="">Select a reason</option>
                <option value="fake_products">Selling fake/counterfeit products</option>
                <option value="inappropriate_content">Inappropriate content or images</option>
                <option value="misleading_info">Misleading product information</option>
                <option value="poor_service">Poor customer service</option>
                <option value="not_delivering">Not delivering products</option>
                <option value="overcharging">Overcharging customers</option>
                <option value="spam">Spam or unwanted messages</option>
                <option value="scam">Suspected scam or fraudulent activity</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Additional details (optional)
              </label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Please provide any additional information that might help us understand the issue..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  fontSize: '1rem',
                  minHeight: 100,
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{
              background: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '1.5rem',
              fontSize: '0.9rem'
            }}>
              <div style={{ fontWeight: 600, color: '#92400E', marginBottom: '0.5rem' }}>
                ⚠️ Important
              </div>
              <div style={{ color: '#451A03' }}>
                Please only submit genuine reports. False reports may result in restrictions on your account. 
                All reports are reviewed by our moderation team.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setReportDetails('');
                }}
                style={{
                  background: '#F3F4F6',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
                disabled={reportSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={!reportReason.trim() || reportSubmitting}
                style={{
                  background: reportSubmitting ? '#9CA3AF' : '#DC2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0.75rem 1.5rem',
                  cursor: reportSubmitting || !reportReason.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600
                }}
              >
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Boost Store Modal */}
      {showBoostModal && (
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
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 24,
            width: '90%',
            maxWidth: 500,
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
                <span style={{ marginRight: 8 }}>⭐</span>
                Boost Store
              </h2>
              <button 
                onClick={() => setShowBoostModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ×
              </button>
            </div>

            {boostSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
                <h3 style={{ color: '#16A34A', marginBottom: 12 }}>Store Boosted Successfully!</h3>
                <p style={{ marginBottom: 24 }}>
                  {store.storeName} will now appear in the recommended section on the Explore page 
                  for {boostDuration} days.
                </p>
                <button
                  onClick={() => {
                    setShowBoostModal(false);
                    setBoostSuccess(false);
                  }}
                  style={{
                    background: '#007B7F',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 24px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 600
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p style={{ marginBottom: 24, fontSize: '1.1rem' }}>
                  Boost your store to increase visibility! Boosted stores appear in the recommended 
                  section on the Explore page.
                </p>

                {boostError && (
                  <div style={{
                    backgroundColor: '#FEF2F2',
                    color: '#B91C1C',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 16
                  }}>
                    {boostError}
                  </div>
                )}

                {showPaymentForm && stripeClientSecret ? (
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Enter Payment Details</h3>
                    <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#666' }}>
                      Your payment is processed securely through Stripe. We do not store your card details.
                    </p>
                    
                    <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                      <StripePaymentForm 
                        paymentData={{
                          total: boostDuration * 1.99,
                          currency: store.currency || 'GBP',
                          description: `Boost store for ${boostDuration} days`
                        }}
                        onPaymentSuccess={() => handlePaymentSuccess(stripePaymentIntentId)}
                        onPaymentError={handlePaymentError}
                        processing={processing}
                        setProcessing={setProcessing}
                        currentUser={authUser}
                      />
                    </Elements>
                    
                    <button
                      onClick={() => {
                        setShowPaymentForm(false);
                        setBoostProcessing(false);
                      }}
                      style={{
                        background: '#F3F4F6',
                        border: '1px solid #D1D5DB',
                        borderRadius: 8,
                        padding: '12px 24px',
                        marginTop: 16,
                        cursor: 'pointer',
                        fontSize: '1rem',
                        width: '100%'
                      }}
                      disabled={processing}
                    >
                      Cancel Payment
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 24 }}>
                      <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
                        Boost Duration:
                      </label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {[3, 7, 14, 30].map(days => (
                          <button 
                            key={days} 
                            type="button"
                            onClick={() => setBoostDuration(days)}
                            style={{
                              padding: '12px 16px',
                              border: boostDuration === days 
                                ? '2px solid #FFD700' 
                                : '1px solid #ccc',
                              borderRadius: 8,
                              background: boostDuration === days 
                                ? '#FEF9C3' 
                                : 'white',
                              fontWeight: boostDuration === days ? 600 : 400,
                              flex: 1,
                              minWidth: '70px',
                              cursor: 'pointer',
                            }}
                          >
                            {days} day{days > 1 ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#F9F9F9', borderRadius: 8 }}>
                      <div style={{ marginBottom: 8, fontWeight: 600 }}>Boost Cost:</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                        {getCurrencySymbol(store.currency || 'GBP')}{formatPrice(boostDuration * 1.99, store.currency || 'GBP')}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#555', marginTop: 4 }}>
                        {getCurrencySymbol(store.currency || 'GBP')}{formatPrice(1.99, store.currency || 'GBP')} per day for {boostDuration} days
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setShowBoostModal(false)}
                        style={{
                          background: '#F3F4F6',
                          border: '1px solid #D1D5DB',
                          borderRadius: 8,
                          padding: '12px 24px',
                          cursor: 'pointer',
                          fontSize: '1rem'
                        }}
                        disabled={boostProcessing}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBoostStore}
                        disabled={boostProcessing}
                        style={{
                          background: boostProcessing ? '#9CA3AF' : '#FFD700',
                          color: '#333',
                          border: 'none',
                          borderRadius: 8,
                          padding: '12px 24px',
                          cursor: boostProcessing ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        {boostProcessing ? (
                          <>Processing...</>
                        ) : (
                          <>
                            <span>⭐</span>
                            Boost Now
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
  }

export default StorePreviewPage;