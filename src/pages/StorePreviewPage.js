import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useCart } from '../CartContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripePaymentForm from '../components/StripePaymentForm';

// Load Stripe outside of component render
// Using the REACT_APP_STRIPE_PUBLIC_KEY from .env file
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

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
  const [followLoading, setFollowLoading] = useState(false);
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
  
  // Alcohol ID verification states
  const [showIdVerificationModal, setShowIdVerificationModal] = useState(false);
  const [pendingAlcoholItem, setPendingAlcoholItem] = useState(null);
  const [idImage, setIdImage] = useState(null);
  const [idUploading, setIdUploading] = useState(false);
  const [boostSuccess, setBoostSuccess] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState('');
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Social sharing states
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  
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
    const unsubStore = onSnapshot(doc(db, 'stores', id), async (docSnap) => {
      if (docSnap.exists()) {
        // Check if current user is blocked by this store
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        if (currentUser) {
          try {
            const blockedRef = doc(db, 'stores', id, 'blocked', currentUser.uid);
            const blockedDoc = await getDoc(blockedRef);
            
            if (blockedDoc.exists()) {
              // User is blocked - redirect or show access denied
              setStore(null);
              setLoading(false);
              // Optionally show a message or redirect
              console.log('Access denied: You have been blocked by this store');
              navigate('/explore'); // Redirect to explore page
              return;
            }
          } catch (error) {
            console.error('Error checking if user is blocked:', error);
          }
        }
        const storeData = docSnap.data();
        setStore(storeData);
        
        // SEO optimization for individual store pages
        if (storeData) {
          const storeName = storeData.businessName || storeData.storeName || 'Business';
          const storeCategory = storeData.category || 'African, Caribbean & Black Business';
          const storeLocation = storeData.city || storeData.address || 'UK';
          
          document.title = `${storeName} - ${storeCategory} | Lokal Shops`;
          
          const metaDescription = document.querySelector('meta[name="description"]');
          if (metaDescription) {
            metaDescription.setAttribute('content', 
              `Shop at ${storeName}, a trusted ${storeCategory.toLowerCase()} business in ${storeLocation}. ${storeData.description || 'Authentic products and excellent service from an African, Caribbean or Black-owned business.'}`
            );
          }

          const canonicalLink = document.querySelector('link[rel="canonical"]');
          if (canonicalLink) {
            canonicalLink.setAttribute('href', `https://lokalshops.co.uk/store/${id}`);
          }

          // Update keywords for store page
          let metaKeywords = document.querySelector('meta[name="keywords"]');
          if (metaKeywords) {
            metaKeywords.setAttribute('content', 
              `${storeName}, ${storeCategory}, ${storeLocation} business, african business, caribbean business, black owned business, authentic products`
            );
          }

          // Add structured data for local business
          const structuredData = {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": storeName,
            "description": storeData.description || `${storeCategory} business serving authentic products`,
            "url": `https://lokalshops.co.uk/store/${id}`,
            "telephone": storeData.phone,
            "email": storeData.email,
            "address": {
              "@type": "PostalAddress",
              "streetAddress": storeData.address,
              "addressLocality": storeData.city || storeLocation,
              "addressCountry": "GB"
            },
            "geo": storeData.coordinates ? {
              "@type": "GeoCoordinates",
              "latitude": storeData.coordinates.latitude,
              "longitude": storeData.coordinates.longitude
            } : undefined,
            "openingHours": storeData.operatingHours ? Object.entries(storeData.operatingHours).map(([day, hours]) => 
              hours.open && hours.close ? `${day.substring(0,2)} ${hours.open}-${hours.close}` : null
            ).filter(Boolean) : undefined,
            "priceRange": storeData.priceRange || "$$",
            "servesCuisine": storeCategory.includes('Food') ? storeCategory : undefined,
            "hasMenu": items.length > 0 ? `https://lokalshops.co.uk/store/${id}` : undefined
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
        }
        
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
    if (!authUser || !id || following || followLoading) return; // Prevent if already following or loading
    
    setFollowLoading(true);
    try {
      // First check if already following to prevent duplicates
      const followerRef = doc(db, 'stores', id, 'followers', authUser.uid);
      const followerDoc = await getDoc(followerRef);
      
      if (followerDoc.exists()) {
        console.log('User is already following this store');
        setFollowing(true); // Update local state
        return;
      }
      
      // Create follower document with merge option to prevent overwriting
      await setDoc(followerRef, {
        uid: authUser.uid,
        email: authUser.email || '',
        followedAt: new Date().toISOString(),
      }, { merge: true });
      
      console.log('Successfully followed store');
    } catch (error) {
      console.error('Error following store:', error);
      alert('Failed to follow store. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!authUser || !id || !following || followLoading) return; // Prevent if not following or loading
    
    setFollowLoading(true);
    try {
      const followerRef = doc(db, 'stores', id, 'followers', authUser.uid);
      
      // Check if document exists before trying to delete
      const followerDoc = await getDoc(followerRef);
      if (followerDoc.exists()) {
        await deleteDoc(followerRef);
        console.log('Successfully unfollowed store');
      } else {
        console.log('User was not following this store');
        setFollowing(false); // Update local state
      }
    } catch (error) {
      console.error('Error unfollowing store:', error);
      alert('Failed to unfollow store. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };
  
  // Helper function to check if store is open
  const isStoreOpen = () => {
    if (!store) return false;
    return isStoreOpenForToday(store);
  };

  // Social sharing functions
  const generateShareableStoreCard = (store) => {
    const storeUrl = `${window.location.origin}/store-preview/${store.id}`;
    return {
      title: `Check out ${store.storeName || store.businessName} on Lokal!`,
      description: `Discover amazing local ${store.category || 'products'} in ${store.storeLocation}. ${isStoreOpen() ? 'Open now!' : 'Visit when they reopen!'}`,
      image: store.backgroundImg || store.logoImg,
      url: storeUrl,
      hashtags: ['#LokalUK', '#LocalBusiness', '#SupportLocal', `#${(store.category || '').replace(/\s+/g, '')}`]
    };
  };

  const handleShareToInstagram = () => {
    const shareData = generateShareableStoreCard(store);
    
    // Instagram Stories sharing
    const instagramText = `${shareData.title}\n\n${shareData.description}\n\n${shareData.hashtags.join(' ')}\n\n${shareData.url}`;
    
    // Copy to clipboard for Instagram
    navigator.clipboard.writeText(instagramText).then(() => {
      // Open Instagram
      window.open('https://instagram.com/stories/camera/', '_blank');
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    });
  };

  const handleShareToFacebook = () => {
    const shareData = generateShareableStoreCard(store);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}&quote=${encodeURIComponent(shareData.title + ' - ' + shareData.description)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 3000);
  };

  const handleShareToSnapchat = () => {
    const shareData = generateShareableStoreCard(store);
    const snapchatText = `${shareData.title}\n${shareData.description}\n${shareData.url}`;
    
    // Copy to clipboard for Snapchat
    navigator.clipboard.writeText(snapchatText).then(() => {
      // Try to open Snapchat web or mobile app
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = 'snapchat://';
      } else {
        window.open('https://web.snapchat.com/', '_blank');
      }
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    });
  };

  const handleShareToTikTok = () => {
    const shareData = generateShareableStoreCard(store);
    const tiktokText = `${shareData.title}\n${shareData.description}\n${shareData.hashtags.join(' ')}\n${shareData.url}`;
    
    // Copy to clipboard for TikTok
    navigator.clipboard.writeText(tiktokText).then(() => {
      // Try to open TikTok
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = 'tiktok://';
      } else {
        window.open('https://www.tiktok.com/', '_blank');
      }
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    });
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      const shareData = generateShareableStoreCard(store);
      try {
        await navigator.share({
          title: shareData.title,
          text: shareData.description,
          url: shareData.url
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    } else {
      setShowShareModal(true);
    }
  };
  
  // Handle boosting a store
  const handleBoostStore = async () => {
    if (!authUser) {
      setBoostError('You must be logged in to boost a store');
      return;
    }
    
    // Ensure only sellers can boost stores
    if (userType !== 'seller') {
      setBoostError('Only sellers can boost stores');
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
  
  // Check if store is both live and open for purchases
  const canPurchase = store && store.live && storeIsOpen;

  // Helper to check if current user is the store owner
  const isStoreOwner = authUser && store && store.ownerId && authUser.uid === store.ownerId;

  // Add to cart handler
  function handleAddToCart(item) {
    // Check if store is live before allowing purchases
    if (!store.live) {
      alert('This store is currently offline and not accepting orders. Please try again later.');
      return;
    }
    
    // Check if store is open
    if (!storeIsOpen) {
      alert('This store is currently closed. Please check the opening hours and try again later.');
      return;
    }
    
    // Check if item is alcohol and requires ID verification
    if (item.isAlcohol === 'yes') {
      setPendingAlcoholItem(item);
      setShowIdVerificationModal(true);
      return;
    }
    
    // Add non-alcohol item directly to cart
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

  // ID verification handlers
  const handleIdVerification = async () => {
    if (!idImage || !pendingAlcoholItem) {
      alert('Please upload your ID first');
      return;
    }

    setIdUploading(true);
    try {
      const storage = getStorage();
      const idRef = ref(storage, `alcoholPurchaseIds/${authUser.uid}/${Date.now()}-${idImage.name}`);
      
      // Upload ID image to Firebase Storage
      await uploadBytes(idRef, idImage);
      const idUrl = await getDownloadURL(idRef);
      
      // Save ID verification record to Firestore
      await addDoc(collection(db, 'alcoholIdVerifications'), {
        buyerId: authUser.uid,
        storeId: id,
        itemId: pendingAlcoholItem.id,
        itemName: pendingAlcoholItem.name,
        idImageUrl: idUrl,
        timestamp: serverTimestamp(),
        verified: false, // Admin will verify later
        storeName: store.storeName
      });
      
      // Add item to cart after ID is uploaded
      addToCart({
        storeId: id,
        storeName: store.storeName,
        itemId: pendingAlcoholItem.id,
        itemName: pendingAlcoholItem.name,
        price: parseFloat(pendingAlcoholItem.price),
        currency: pendingAlcoholItem.currency,
        quantity: 1,
        image: pendingAlcoholItem.image,
        deliveryType: store.deliveryType,
        requiresIdVerification: true // Flag for alcohol items
      });
      
      // Close modal and show success
      setShowIdVerificationModal(false);
      setPendingAlcoholItem(null);
      setIdImage(null);
      setShowAdded(true);
      setTimeout(() => setShowAdded(false), 1500);
      
      alert('ID uploaded successfully! Your alcohol purchase has been added to cart. ID verification may be required before checkout.');
      
    } catch (error) {
      console.error('Error uploading ID:', error);
      alert('Error uploading ID. Please try again.');
    } finally {
      setIdUploading(false);
    }
  };

  const handleIdImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type (images only)
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      
      setIdImage(file);
    }
  };

  const closeIdVerificationModal = () => {
    setShowIdVerificationModal(false);
    setPendingAlcoholItem(null);
    setIdImage(null);
    setIdUploading(false);
  };

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
    <div className="page-container">
      <Navbar />
      {showAdded && (
        <div className="add-to-cart-notification">
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
        
        /* Modern Store Preview Styles */
        
        /* Reviews Section Styles */
        .reviews-tab {
          margin-top: 16px;
        }
        
        .rating-summary {
          margin-bottom: 24px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .rating-title {
          font-weight: 700;
          font-size: 1.2rem;
          margin-bottom: 12px;
          color: #333;
        }
        
        .rating-display {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .rating-star {
          font-size: 2.2rem;
          color: #FFD700;
          line-height: 1;
        }
        
        .auth-prompt {
          margin-bottom: 24px;
          background: #f0f9ff;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          border: 1px dashed #007B7F;
        }
        
        .prompt-heading {
          font-weight: 600;
          margin-bottom: 10px;
          color: #007B7F;
        }
        
        .auth-buttons {
          display: flex;
          justify-content: center;
          gap: 12px;
        }
        
        .login-button, .register-button {
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        
        .login-button {
          background: #007B7F;
          color: #fff;
          border: none;
        }
        
        .login-button:hover {
          background: #006366;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .register-button {
          background: white;
          color: #007B7F;
          border: 1px solid #007B7F;
        }
        
        .register-button:hover {
          background: #f0f9ff;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .review-form {
          margin-bottom: 24px;
          background: #f6f6fa;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .review-form-title {
          font-weight: 600;
          margin-bottom: 12px;
          color: #333;
        }
        
        .review-textarea {
          width: 100%;
          min-height: 100px;
          border-radius: 8px;
          border: 1px solid #ddd;
          padding: 12px;
          margin-top: 12px;
          font-family: inherit;
          font-size: 1rem;
          resize: vertical;
          transition: border-color 0.2s ease;
        }
        
        .review-textarea:focus {
          outline: none;
          border-color: #007B7F;
          box-shadow: 0 0 0 2px rgba(0,123,127,0.2);
        }
        
        .submit-review {
          background: #007B7F;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 1rem;
          margin-top: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .submit-review:hover:not(:disabled) {
          background: #006366;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .submit-review:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .review-success {
          color: #3A8E3A;
          margin-top: 8px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .reviews-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .review-item {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border: 1px solid #eee;
          transition: transform 0.2s ease;
        }
        
        .review-item:hover {
          transform: translateY(-2px);
        }
        
        .reviewer-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        
        .reviewer-name {
          font-weight: 600;
          color: #333;
        }
        
        .review-date {
          color: #888;
          font-size: 0.9rem;
        }
        
        .review-stars {
          display: flex;
          gap: 2px;
          margin-bottom: 8px;
          color: #FFD700;
        }
        
        .review-text {
          color: #444;
          line-height: 1.4;
        }
        
        .no-reviews {
          color: #888;
          text-align: center;
          padding: 3rem 1rem;
          background: #f9f9f9;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        
        .no-reviews-icon {
          font-size: 2.5rem;
        }
        
        .no-reviews-text {
          font-size: 1.1rem;
        }
        .page-container {
          background: #F9F5EE;
          min-height: 100vh;
          padding-bottom: 2rem;
        }
        
        .add-to-cart-notification {
          position: fixed;
          top: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: #28a745;
          color: #fff;
          padding: 1rem 2rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 1.1rem;
          z-index: 2000;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          animation: fadeInOut 1.5s;
        }
        
        .store-preview-container {
          max-width: 800px;
          margin: 2rem auto;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          padding: 2rem;
          position: relative;
        }
        
        .help-button {
          background: transparent;
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1.2rem;
          color: #007B7F;
          transition: all 0.2s ease;
          margin-left: 10px;
        }
        
        .help-button:hover {
          background: rgba(0, 123, 127, 0.1);
          transform: translateY(-2px) scale(1.05);
        }
        
        .store-header {
          display: flex;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        
        .store-logo-container {
          position: relative;
        }
        
        .store-logo {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
        }
        
        .store-closed-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 70px;
          height: 70px;
          background: rgba(255,255,255,0.7);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          color: #D92D20;
          pointer-events: none;
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
      <div className="store-preview-container">
        {/* Help Icon removed from here and moved near Message button */}
        <div className="store-header">
          <div className="store-logo-container">
            {store.backgroundImg && (
              <img 
                src={store.backgroundImg} 
                alt="Store" 
                className="store-logo"
                style={{ 
                  filter: storeIsOpen ? 'none' : 'grayscale(0.7)', 
                  opacity: storeIsOpen ? 1 : 0.5 
                }} 
              />
            )}
            {!storeIsOpen && (
              <div className="store-closed-overlay">
                Closed
              </div>
            )}
          </div>
          <div className="store-info-container">
            <div className="store-title-section">
              <div className="store-name-container">
                <h1 className="store-name">{store.storeName}</h1>
                {store.isBoosted && (
                  <div className="boosted-badge" title="This store is boosted">
                    <span className="boosted-icon">⭐</span> BOOSTED
                  </div>
                )}
                {isStoreOwner && (
                  <button 
                    onClick={() => navigate('/store-profile')}
                    className="edit-store-button"
                    title="Edit Store Information"
                  >
                    ⚙️ Edit Store
                  </button>
                )}
              </div>
              <div className="store-location">{store.storeLocation}</div>
              {store.phoneNumber && (
                <a href={`tel:${store.phoneNumber}`} className="phone-link">
                  <span className="phone-icon">
                    {store.phoneType === 'personal' ? '📱' : '📞'}
                  </span>
                  <span className="phone-number">{store.phoneNumber}</span>
                  <span className="phone-type">
                    ({store.phoneType === 'personal' ? 'Personal' : 'Work'})
                  </span>
                </a>
              )}
            </div>
            <style>{`
              @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
              }
              
              .store-info-container {
                flex: 1;
              }
              
              .store-title-section {
                display: flex;
                flex-direction: column;
                gap: 6px;
              }
              
              .store-name-container {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
              }
              
              .store-name {
                font-weight: 700;
                font-size: 1.4rem;
                margin: 0;
                color: #222;
              }
              
              .boosted-badge {
                background-color: #FFD700;
                color: #333;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                animation: pulse 2s infinite;
              }
              
              .boosted-icon {
                font-size: 0.9rem;
              }
              
              .edit-store-button {
                background: linear-gradient(135deg, #007B7F 0%, #005a5d 100%);
                color: white;
                border: none;
                border-radius: 12px;
                padding: 8px 16px;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 2px 8px rgba(0, 123, 127, 0.2);
              }
              
              .edit-store-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 123, 127, 0.3);
                background: linear-gradient(135deg, #005a5d 0%, #007B7F 100%);
              }
              
              .store-location {
                color: #444;
                font-size: 1rem;
              }
              
              .phone-link {
                color: #007B7F;
                text-decoration: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-weight: 600;
                margin-top: 4px;
                transition: all 0.2s ease;
              }
              
              .phone-link:hover {
                color: #005a5f;
                transform: translateY(-1px);
              }
              
              .phone-icon {
                font-size: 1rem;
              }
              
              .phone-number {
                font-size: 1rem;
              }
              
              .phone-type {
                font-size: 0.8rem;
                opacity: 0.8;
                margin-left: 2px;
              }
            `}</style>
            <div className="store-rating">
              <div className="rating-icon">⭐</div>
              <div className="rating-text">
                {avgRating > 0 ? avgRating : 'No ratings'} 
                {ratingCount > 0 && <span className="review-count">({ratingCount} review{ratingCount !== 1 ? 's' : ''})</span>}
              </div>
            </div>
            
            {/* Perishable Food Verification Banner */}
            {store.sellsPerishableFood === 'yes' && (store.foodHygieneProof || store.foodHygiene) && (
              <div className="perishable-food-banner">
                <div className="verification-badge">
                  <span className="verification-icon">🏅</span>
                  <div className="verification-text">
                    <div className="verification-title">Verified Fresh Food Seller</div>
                    <div className="verification-subtitle">Certified to sell perishable food items safely</div>
                  </div>
                </div>
              </div>
            )}

            {/* Alcohol License Verification Banner */}
            {store.sellsAlcohol === 'yes' && store.alcoholLicense && (
              <div className="alcohol-license-banner">
                <div className="verification-badge">
                  <span className="verification-icon">🍷</span>
                  <div className="verification-text">
                    <div className="verification-title">Licensed Alcohol Seller</div>
                    <div className="verification-subtitle">Authorized to sell alcoholic beverages</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="store-details">
              <div className="detail-item origin">
                <span className="detail-label">Origin:</span> 
                <span className="detail-value">{store.origin}</span>
              </div>
              
              <div className="detail-item delivery">
                <span className="detail-label">Delivery Type:</span>
                <span className="detail-value delivery-value">{store.deliveryType}</span>
              </div>
            </div>
            
            {/* Compact Social Media and Website Icons */}
            {((store.socialLinks && store.socialLinks.length > 0) || 
              (store.websiteLinks && store.websiteLinks.length > 0) ||
              (store.platform && store.socialHandle) ||
              store.websiteLink) && (
              <div className="social-icons-container">
                <div className="social-icons-wrapper">
                  {/* Display new format social links */}
                  {store.socialLinks && store.socialLinks.length > 0 && 
                    store.socialLinks.map((link, index) => (
                      <a
                        key={`social-${index}`}
                        href={
                          link.platform === 'Instagram' ? `https://instagram.com/${link.handle.replace('@', '')}` :
                          link.platform === 'Facebook' ? `https://facebook.com/${link.handle.replace('@', '')}` :
                          link.platform === 'Twitter' ? `https://twitter.com/${link.handle.replace('@', '')}` :
                          link.platform === 'TikTok' ? `https://tiktok.com/@${link.handle.replace('@', '')}` :
                          link.platform === 'LinkedIn' ? `https://linkedin.com/in/${link.handle.replace('@', '')}` :
                          link.platform === 'YouTube' ? `https://youtube.com/@${link.handle.replace('@', '')}` :
                          link.platform === 'WhatsApp' ? `https://wa.me/${link.handle.replace(/[^0-9]/g, '')}` :
                          link.handle.startsWith('http') ? link.handle : `https://${link.handle}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-icon-link"
                        title={`${link.platform}: ${link.handle.startsWith('@') ? link.handle : '@' + link.handle}`}
                      >
                        <div className={`social-icon-circle ${link.platform.toLowerCase()}-icon`}>
                          {link.platform === 'Instagram' ? 'IG' :
                           link.platform === 'Facebook' ? 'f' :
                           link.platform === 'Twitter' ? '𝕏' :
                           link.platform === 'TikTok' ? '♪' :
                           link.platform === 'LinkedIn' ? 'in' :
                           link.platform === 'YouTube' ? '▶' :
                           link.platform === 'WhatsApp' ? 'W' :
                           '🔗'}
                        </div>
                      </a>
                    ))
                  }
                  
                  {/* Display legacy format social link if no new format exists */}
                  {(!store.socialLinks || store.socialLinks.length === 0) && 
                   store.platform && store.socialHandle && (
                    <a
                      href={
                        store.platform === 'Instagram' ? `https://instagram.com/${store.socialHandle.replace('@', '')}` :
                        store.platform === 'Facebook' ? `https://facebook.com/${store.socialHandle.replace('@', '')}` :
                        store.platform === 'Twitter' ? `https://twitter.com/${store.socialHandle.replace('@', '')}` :
                        store.platform === 'TikTok' ? `https://tiktok.com/@${store.socialHandle.replace('@', '')}` :
                        store.platform === 'WhatsApp' ? `https://wa.me/${store.socialHandle.replace(/[^0-9]/g, '')}` :
                        store.socialHandle.startsWith('http') ? store.socialHandle : `https://${store.socialHandle}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-link"
                      title={`${store.platform}: ${store.socialHandle.startsWith('@') ? store.socialHandle : '@' + store.socialHandle}`}
                    >
                      <div className={`social-icon-circle ${store.platform.toLowerCase()}-icon`}>
                        {store.platform === 'Instagram' ? 'IG' :
                         store.platform === 'Facebook' ? 'f' :
                         store.platform === 'Twitter' ? '𝕏' :
                         store.platform === 'TikTok' ? '♪' :
                         store.platform === 'WhatsApp' ? 'W' :
                         '🔗'}
                      </div>
                    </a>
                  )}
                  
                  {/* Display new format website links */}
                  {store.websiteLinks && store.websiteLinks.length > 0 && 
                    store.websiteLinks.map((link, index) => (
                      <a
                        key={`website-${index}`}
                        href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-icon-link"
                        title={link.name || 'Website'}
                      >
                        <div className="social-icon-circle website-icon">
                          WWW
                        </div>
                      </a>
                    ))
                  }
                  
                  {/* Display legacy format website link if no new format exists */}
                  {(!store.websiteLinks || store.websiteLinks.length === 0) && 
                   store.websiteLink && (
                    <a
                      href={store.websiteLink.startsWith('http') ? store.websiteLink : `https://${store.websiteLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-link"
                      title="Website"
                    >
                      <div className="social-icon-circle website-icon">
                        WWW
                      </div>
                    </a>
                  )}
                </div>
              </div>
            )}
            
            {/* Display fee information */}
            {console.log('Current storeFeeSettings:', storeFeeSettings, 'deliveryEnabled:', storeFeeSettings.deliveryEnabled, 'serviceFeeEnabled:', storeFeeSettings.serviceFeeEnabled)}
            {/* Hide delivery fee for ALL Collection orders (both Pay at Store and Card Payment) */}
            {(() => {
              const isCollectionStore = store.deliveryType === 'Collection';
              const shouldShowDeliveryFee = storeFeeSettings.deliveryEnabled && !isCollectionStore;
              const shouldShowFeeSection = shouldShowDeliveryFee || storeFeeSettings.serviceFeeEnabled;
              
              return shouldShowFeeSection && (
                <div className="fees-container">
                  <div className="fees-header">📋 Store Fees:</div>
                  {shouldShowDeliveryFee && (
                    <div className="fee-item">
                      <span className="fee-bullet">•</span>
                      <span className="fee-text">
                        Delivery: {getCurrencySymbol(store.currency || 'GBP')}{formatPrice(storeFeeSettings.deliveryFee, store.currency || 'GBP')}
                        {storeFeeSettings.freeDeliveryThreshold > 0 && (
                          <span className="free-delivery-note"> (Free over {getCurrencySymbol(store.currency || 'GBP')}{formatPrice(storeFeeSettings.freeDeliveryThreshold, store.currency || 'GBP')})</span>
                        )}
                      </span>
                    </div>
                  )}
                  {storeFeeSettings.serviceFeeEnabled && (
                    <div className="fee-item">
                      <span className="fee-bullet">•</span>
                      <span className="fee-text">
                        Service fee: {storeFeeSettings.serviceFeeType === 'percentage' 
                          ? `${storeFeeSettings.serviceFeeRate}%${storeFeeSettings.serviceFeeMax > 0 ? ` (max ${getCurrencySymbol(store.currency || 'GBP')}${formatPrice(storeFeeSettings.serviceFeeMax, store.currency || 'GBP')})` : ''}`
                          : `${getCurrencySymbol(store.currency || 'GBP')}${formatPrice(storeFeeSettings.serviceFeeAmount, store.currency || 'GBP')}`}
                      </span>
                    </div>
                  )}
                  {isCollectionStore && storeFeeSettings.deliveryEnabled && (
                    <div className="collection-note">
                      * Delivery fee not applicable for collection orders
                    </div>
                  )}
                </div>
              );
            })()}
            
            <style>{`
              .store-rating {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-top: 8px;
                color: #007B7F;
                font-size: 1rem;
              }
              
              .rating-icon {
                color: #FFD700;
              }
              
              .rating-text {
                font-weight: 500;
              }
              
              .review-count {
                margin-left: 4px;
                font-weight: normal;
              }
              
              .perishable-food-banner {
                margin-top: 12px;
                padding: 0;
              }

              .alcohol-license-banner {
                margin-top: 12px;
                padding: 0;
              }
              
              .verification-badge {
                background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                border-radius: 12px;
                padding: 10px 14px;
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: 0 3px 12px rgba(16, 185, 129, 0.2);
                border: 2px solid #34D399;
              }

              .alcohol-license-banner .verification-badge {
                background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
                box-shadow: 0 3px 12px rgba(139, 92, 246, 0.2);
                border: 2px solid #A78BFA;
              }
              
              .verification-icon {
                font-size: 1.5rem;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
              }
              
              .verification-text {
                flex: 1;
              }
              
              .verification-title {
                color: white;
                font-weight: 700;
                font-size: 0.95rem;
                margin: 0;
                line-height: 1.2;
              }
              
              .verification-subtitle {
                color: rgba(255, 255, 255, 0.9);
                font-size: 0.8rem;
                margin: 2px 0 0 0;
                line-height: 1.2;
              }
              
              .store-details {
                margin-top: 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
              }
              
              .detail-item {
                font-size: 1.05rem;
              }
              
              .detail-label {
                font-weight: 600;
                margin-right: 5px;
              }
              
              .detail-value {
                color: #444;
              }
              
              .delivery-value {
                color: #007B7F;
              }
              
              .fees-container {
                margin-top: 12px;
                padding: 12px 16px;
                background: #f0f9ff;
                border-radius: 10px;
                font-size: 0.9rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
              }
              
              .fees-header {
                font-weight: 600;
                color: #007B7F;
                margin-bottom: 6px;
              }
              
              .fee-item {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                color: #444;
                margin-bottom: 4px;
              }
              
              .fee-bullet {
                color: #007B7F;
              }
              
              .free-delivery-note {
                color: #007B7F;
                font-weight: 500;
              }
              
              .collection-note {
                color: #666;
                font-size: 0.85rem;
                margin-top: 6px;
                font-style: italic;
              }
              
              .social-icons-container {
                margin-top: 8px;
              }
              
              .social-icons-wrapper {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
              }
              
              .social-icon-link {
                text-decoration: none;
                transition: all 0.2s ease;
              }
              
              .social-icon-link:hover {
                transform: translateY(-2px);
              }
              
              .social-icon-circle {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.9rem;
                font-weight: bold;
                color: white;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
                background: linear-gradient(135deg, #007B7F, #005a5f);
                box-shadow: 0 2px 6px rgba(0,123,127,0.3);
              }
              
              /* Instagram brand colors */
              .instagram-icon {
                background: linear-gradient(135deg, #E4405F, #833AB4, #F77737) !important;
                box-shadow: 0 2px 6px rgba(228,64,95,0.4) !important;
                font-size: 0.7rem !important;
                letter-spacing: -0.5px;
              }
              
              /* Facebook brand colors */
              .facebook-icon {
                background: linear-gradient(135deg, #1877F2, #0C5FB8) !important;
                box-shadow: 0 2px 6px rgba(24,119,242,0.4) !important;
                font-size: 1.1rem !important;
                font-family: 'Times New Roman', serif;
              }
              
              /* Twitter/X brand colors */
              .twitter-icon {
                background: linear-gradient(135deg, #000000, #333333) !important;
                box-shadow: 0 2px 6px rgba(0,0,0,0.4) !important;
                font-size: 1rem !important;
                font-weight: 900;
              }
              
              /* TikTok brand colors */
              .tiktok-icon {
                background: linear-gradient(135deg, #000000, #FF0050, #00F2EA) !important;
                box-shadow: 0 2px 6px rgba(255,0,80,0.4) !important;
                font-size: 1.1rem !important;
              }
              
              /* LinkedIn brand colors */
              .linkedin-icon {
                background: linear-gradient(135deg, #0A66C2, #084A94) !important;
                box-shadow: 0 2px 6px rgba(10,102,194,0.4) !important;
                font-size: 0.7rem !important;
                font-weight: bold;
              }
              
              /* YouTube brand colors */
              .youtube-icon {
                background: linear-gradient(135deg, #FF0000, #CC0000) !important;
                box-shadow: 0 2px 6px rgba(255,0,0,0.4) !important;
                font-size: 0.9rem !important;
              }
              
              /* WhatsApp brand colors */
              .whatsapp-icon {
                background: linear-gradient(135deg, #25D366, #1EBE57) !important;
                box-shadow: 0 2px 6px rgba(37,211,102,0.4) !important;
                font-size: 1rem !important;
                font-weight: bold;
              }
              
              .social-icon-circle::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
                border-radius: 50%;
                transition: opacity 0.3s ease;
                opacity: 0;
              }
              
              .social-icon-link:hover .social-icon-circle {
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(0,123,127,0.4);
              }
              
              .social-icon-link:hover .social-icon-circle::before {
                opacity: 1;
              }
              
              .website-icon {
                background: linear-gradient(135deg, #28A745, #20693e) !important;
                box-shadow: 0 2px 6px rgba(40,167,69,0.3) !important;
                font-size: 0.6rem !important;
                font-weight: bold;
                letter-spacing: -0.5px;
              }
              
              .social-icon-link:hover .website-icon {
                box-shadow: 0 4px 12px rgba(40,167,69,0.4) !important;
              }
              
              /* Hover effects for each platform */
              .social-icon-link:hover .instagram-icon {
                box-shadow: 0 4px 12px rgba(228,64,95,0.5) !important;
              }
              
              .social-icon-link:hover .facebook-icon {
                box-shadow: 0 4px 12px rgba(24,119,242,0.5) !important;
              }
              
              .social-icon-link:hover .twitter-icon {
                box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
              }
              
              .social-icon-link:hover .tiktok-icon {
                box-shadow: 0 4px 12px rgba(255,0,80,0.5) !important;
              }
              
              .social-icon-link:hover .linkedin-icon {
                box-shadow: 0 4px 12px rgba(10,102,194,0.5) !important;
              }
              
              .social-icon-link:hover .youtube-icon {
                box-shadow: 0 4px 12px rgba(255,0,0,0.5) !important;
              }
              
              .social-icon-link:hover .whatsapp-icon {
                box-shadow: 0 4px 12px rgba(37,211,102,0.5) !important;
              }
              
              /* Responsive design for social icons */
              @media (max-width: 768px) {
                .social-icon-circle {
                  width: 28px;
                  height: 28px;
                  font-size: 0.9rem;
                }
                
                .social-icons-wrapper {
                  gap: 6px;
                }
              }
              
              @media (max-width: 480px) {
                .social-icon-circle {
                  width: 26px;
                  height: 26px;
                  font-size: 0.8rem;
                }
                
                .social-icons-wrapper {
                  gap: 5px;
                }
                
                .verification-badge {
                  padding: 8px 12px;
                  gap: 8px;
                }
                
                .verification-icon {
                  font-size: 1.3rem;
                }
                
                .verification-title {
                  font-size: 0.9rem;
                }
                
                .verification-subtitle {
                  font-size: 0.75rem;
                }
              }
              }
            `}</style>
            
            {/* Display refunds policy notification */}
            {!storeFeeSettings.refundsEnabled && (
              <div className="refunds-notification">
                <div className="refunds-header">❌ Refund Policy:</div>
                <div className="refunds-message">
                  This store does not offer refunds. Please review your order carefully before purchasing.
                </div>
              </div>
            )}
            
            {/* Show setup link for store owners */}
            {isStoreOwner && !storeFeeSettings.deliveryEnabled && !storeFeeSettings.serviceFeeEnabled && (
              <div className="setup-notification">
                <div className="setup-message">💡 You can set up delivery and service fees in your Wallet → Fee Settings</div>
              </div>
            )}
            
            {store.paymentType && (
              <div className="payment-method">
                <span className="payment-label">Payment Method:</span> 
                <span className="payment-value">
                  {store.paymentType === 'Own Card/Bank Details' ? 'Card Payment' : 
                   (store.paymentType === 'Other' ? 'Pay at Store' : store.paymentType)}
                </span>
              </div>
            )}
            
            <style>{`
              .refunds-notification {
                margin-top: 12px;
                padding: 12px 16px;
                background: #fef2f2;
                border-radius: 10px;
                font-size: 0.9rem;
                border: 1px solid #f87171;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
              }
              
              .refunds-header {
                font-weight: 600;
                color: #dc2626;
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 6px;
              }
              
              .refunds-message {
                color: #7f1d1d;
              }
              
              .setup-notification {
                margin-top: 12px;
                padding: 12px 16px;
                background: #fef3cd;
                border-radius: 10px;
                font-size: 0.9rem;
                border: 1px solid #fbbf24;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
              }
              
              .setup-message {
                color: #92400e;
              }
              
              .payment-method {
                color: #007B7F;
                font-size: 1.05rem;
                margin-top: 12px;
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
              }
              
              .payment-label {
                font-weight: 600;
              }
              
              .payment-value {
                font-weight: 500;
              }
            `}</style>
          </div>
          {/* Store actions for buyers and sellers */}
          {!isStoreOwner && (
            <div className="store-action-buttons">
              {/* Follow button - only shown to authenticated buyers */}
              {userType === 'buyer' && authUser && (
                following ? (
                  <button 
                    onClick={handleUnfollow} 
                    className="action-button unfollow-button"
                    title="Unfollow store"
                    disabled={followLoading}
                    style={{ opacity: followLoading ? 0.6 : 1 }}
                  >
                    {followLoading ? '⏳' : '❤️'}
                  </button>
                ) : (
                  <button 
                    onClick={handleFollow} 
                    className="action-button follow-button"
                    title="Follow store"
                    disabled={followLoading}
                    style={{ opacity: followLoading ? 0.6 : 1 }}
                  >
                    {followLoading ? '⏳' : '🤍'}
                  </button>
                )
              )}
              
              {/* Share button - shown to all users */}
              <button 
                onClick={handleNativeShare}
                className="action-button share-button"
                title="Share this store"
              >
                📤
              </button>
              
              <style>{`
                .store-action-buttons {
                  display: flex;
                  gap: 10px;
                  flex-wrap: wrap;
                }
                
                @media (max-width: 640px) {
                  .store-action-buttons {
                    gap: 8px;
                  }
                  
                  .action-button {
                    padding: 10px 14px;
                    font-size: 0.9rem;
                    min-width: 100px;
                  }
                }
                
                .action-button {
                  border: none;
                  border-radius: 8px;
                  padding: 8px 16px;
                  font-weight: 600;
                  font-size: 1rem;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                }
                
                .action-button:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                
                .follow-button {
                  background: transparent;
                  color: #D92D20;
                  border: none;
                  width: 44px;
                  height: 44px;
                  border-radius: 50%;
                  padding: 0;
                  font-size: 1.4rem;
                  min-width: unset;
                }
                
                .follow-button:hover {
                  background: rgba(217, 45, 32, 0.1);
                  color: #b91c1c;
                }
                
                .unfollow-button {
                  background: transparent;
                  color: #6b7280;
                  border: none;
                  width: 44px;
                  height: 44px;
                  border-radius: 50%;
                  padding: 0;
                  font-size: 1.4rem;
                  min-width: unset;
                }
                
                .unfollow-button:hover {
                  background: rgba(107, 114, 128, 0.1);
                  color: #4b5563;
                }
                
                .share-button {
                  background: transparent;
                  color: #667eea;
                  border: none;
                  width: 44px;
                  height: 44px;
                  border-radius: 50%;
                  padding: 0;
                  font-size: 1.2rem;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-width: unset;
                  transition: all 0.2s ease;
                }
                
                .share-button:hover {
                  background: rgba(102, 126, 234, 0.1);
                  color: #5a67d8;
                  transform: translateY(-2px) scale(1.05);
                }
                
                .message-button {
                  background: transparent;
                  color: #007B7F;
                  border: none;
                  width: 44px;
                  height: 44px;
                  border-radius: 50%;
                  padding: 0;
                  font-size: 1.3rem;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-width: unset;
                  transition: all 0.2s ease;
                  cursor: pointer;
                }
                
                .message-button:hover {
                  background: rgba(0, 123, 127, 0.1);
                  color: #005a5d;
                  transform: translateY(-2px) scale(1.05);
                }
                
                .boost-button {
                  background: transparent;
                  color: #FFD700;
                  border: none;
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  padding: 0;
                  font-size: 1.3rem;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  cursor: pointer;
                  transition: all 0.2s ease;
                }
                
                .boost-button:hover {
                  background: rgba(255, 215, 0, 0.1);
                  transform: translateY(-2px) scale(1.05);
                }
              `}</style>
              
              {/* Message button - shown to authenticated users (buyers and sellers) */}
              {authUser && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button 
                    onClick={handleSendMessage} 
                    className="message-button"
                    title="Send message to store"
                  >
                    💬
                  </button>
                  
                  {/* Help Icon for desktop buyers */}
                  {userType === 'buyer' && !isStoreOwner && (
                    <button 
                      onClick={() => setShowHelpModal(true)}
                      className="help-button"
                      title="Get help or report this store"
                    >
                      ?
                    </button>
                  )}
                </div>
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
          
          {/* Small Boost Store Button - Available only to sellers */}
          {authUser && userType === 'seller' && (
            <div style={{ 
              position: 'absolute',
              top: '10px',
              left: '10px',
              zIndex: 5
            }}>
              <button
                onClick={() => setShowBoostModal(true)}
                className="boost-button"
                title={store.isBoosted ? 'Store is boosted' : 'Boost your store'}
              >
                {store.isBoosted ? '⭐' : '🚀'}
              </button>
            </div>
          )}
          {/* Message button for store owners */}
          {isStoreOwner && (
            <div className="store-action-buttons">
              <button 
                onClick={handleSendMessage} 
                className="message-button"
                title="View messages"
              >
                💬
              </button>
            </div>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          {!store.live ? (
            <span style={{ 
              background: '#fbe8e8', 
              color: '#D92D20', 
              borderRadius: 8, 
              padding: '4px 16px', 
              fontWeight: 600, 
              fontSize: '1.1rem',
              marginRight: '8px'
            }}>
              🚫 Store Offline
            </span>
          ) : (
            <span style={{ background: isClosedToday ? '#fbe8e8' : (storeIsOpen ? '#e8fbe8' : '#fbe8e8'), color: isClosedToday ? '#D92D20' : (storeIsOpen ? '#3A8E3A' : '#D92D20'), borderRadius: 8, padding: '4px 16px', fontWeight: 600, fontSize: '1.1rem' }}>
              {isClosedToday ? 'Closed Today' : (storeIsOpen ? 'Open' : 'Closed')}
            </span>
          )}
          {!isClosedToday && todayOpening && todayClosing && (
            <div className="store-hours">
              <div className="hours-icon">🕒</div>
              <div className="hours-text">{todayOpening} - {todayClosing}</div>
            </div>
          )}
          {store && Array.isArray(store.closedDays) && store.closedDays.length > 0 && (
            <div className="closed-days">
              <div className="closed-icon">📅</div>
              <div className="closed-text">Closed: {store.closedDays.join(', ')}</div>
            </div>
          )}
          
          <style>{`
            .store-hours {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-top: 12px;
              color: #007B7F;
              font-size: 1rem;
              background-color: #e6f7f0;
              padding: 6px 12px;
              border-radius: 8px;
              width: fit-content;
            }
            
            .hours-icon {
              font-size: 1.1rem;
            }
            
            .hours-text {
              font-weight: 500;
            }
            
            .closed-days {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-top: 10px;
              color: #D92D20;
              font-size: 1rem;
              font-weight: 500;
              background-color: #fef2f2;
              padding: 6px 12px;
              border-radius: 8px;
              width: fit-content;
            }
            
            .closed-icon {
              font-size: 1.1rem;
            }
          `}</style>
        </div>
        
        {/* Store Owner Dashboard */}
        {isStoreOwner && (
          <div className="owner-dashboard">
            <h3 className="owner-dashboard-title">🎛️ Store Management</h3>
            <div className="owner-dashboard-actions">
              <button 
                onClick={() => navigate('/store-profile')}
                className="dashboard-button primary"
              >
                ⚙️ Store Settings
              </button>
              <button 
                onClick={() => navigate('/store-profile?addItem=true')}
                className="dashboard-button secondary"
              >
                ➕ Add New Item
              </button>
              <button 
                onClick={() => navigate('/messages')}
                className="dashboard-button secondary"
              >
                💬 View Messages
              </button>
              <button 
                onClick={() => navigate('/reports')}
                className="dashboard-button secondary"
              >
                📊 View Analytics
              </button>
            </div>
          </div>
        )}
        
        <div className="tab-navigation">
          <button 
            onClick={() => setTab('products')} 
            className={`tab-button ${tab === 'products' ? 'active' : ''}`}
          >
            Products
          </button>
          <button 
            onClick={() => setTab('reviews')} 
            className={`tab-button ${tab === 'reviews' ? 'active' : ''}`}
          >
            Reviews
          </button>
        </div>
        
        <style>{`
          .owner-dashboard {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 1.5rem;
            margin: 20px 0;
            box-shadow: 0 4px 12px rgba(0, 123, 127, 0.1);
          }
          
          .owner-dashboard-title {
            margin: 0 0 1rem 0;
            color: #1e293b;
            font-size: 1.2rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .owner-dashboard-actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
          }
          
          .dashboard-button {
            border: none;
            border-radius: 12px;
            padding: 12px 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 0.95rem;
          }
          
          .dashboard-button.primary {
            background: linear-gradient(135deg, #007B7F 0%, #005a5d 100%);
            color: white;
            box-shadow: 0 2px 8px rgba(0, 123, 127, 0.2);
          }
          
          .dashboard-button.primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 123, 127, 0.3);
          }
          
          .dashboard-button.secondary {
            background: white;
            color: #374151;
            border: 1px solid #d1d5db;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .dashboard-button.secondary:hover {
            background: #f9fafb;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }
          
          .tab-navigation {
            display: flex;
            gap: 16px;
            border-bottom: 1.5px solid #eee;
            margin: 24px 0;
            padding-bottom: 2px;
          }
          
          .tab-button {
            background: none;
            border: none;
            font-size: 1.1rem;
            padding: 0.6rem 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            border-bottom: 3px solid transparent;
          }
          
          .tab-button:hover:not(.active) {
            background-color: #f6f6fa;
            border-radius: 8px 8px 0 0;
          }
          
          .tab-button.active {
            font-weight: 700;
            color: #007B7F;
            border-bottom: 3px solid #007B7F;
          }
        `}</style>
        {tab === 'products' && (
          <div className="product-grid">
            {items.length === 0 ? (
              <div className="no-items-message">
                <div className="no-items-icon">📦</div>
                <div className="no-items-text">No items added yet</div>
              </div>
            ) : (
              items.map(item => (
                <div 
                  key={item.id} 
                  className="product-card"
                  style={{ 
                    opacity: canPurchase && (!item.stock || item.stock === 'in-stock') ? 1 : 0.5, 
                    filter: canPurchase && (!item.stock || item.stock === 'in-stock') ? 'none' : 'grayscale(0.7)',
                    background: item.stock === 'out-of-stock' ? '#ffebee' : item.stock === 'low-stock' ? '#fff8e1' : '',
                    border: item.stock === 'out-of-stock' ? '1px solid #ffcdd2' : item.stock === 'low-stock' ? '1px solid #ffecb3' : '',
                    position: 'relative'
                  }}
                >
                  {/* Alcohol indicator overlay */}
                  {item.isAlcohol === 'yes' && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      padding: '3px 8px',
                      borderRadius: 6,
                      zIndex: 1,
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      🍷 ALCOHOL
                    </div>
                  )}

                  {/* Stock status overlay */}
                  {item.stock && item.stock !== 'in-stock' && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      background: item.stock === 'out-of-stock' ? '#f44336' : '#ff9800',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      padding: '3px 8px',
                      borderRadius: 6,
                      zIndex: 1,
                      textTransform: 'uppercase'
                    }}>
                      {item.stock === 'out-of-stock' ? 'Out of Stock' : 'Low Stock'}
                    </div>
                  )}

                  {item.image && 
                    <div className="product-image-container">
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="product-image"
                        style={{
                          opacity: item.stock === 'out-of-stock' ? 0.6 : 1
                        }}
                      />
                    </div>
                  }
                  <div className="product-details">
                    <div 
                      className="product-name"
                      style={{
                        color: item.stock === 'out-of-stock' ? '#999' : ''
                      }}
                    >
                      {item.name}
                    </div>
                    <div 
                      className="product-price"
                      style={{
                        color: item.stock === 'out-of-stock' ? '#999' : ''
                      }}
                    >
                      {getCurrencySymbol(item.currency)}{formatPrice(item.price, item.currency)}
                    </div>
                    <div className="product-meta">
                      <span className="product-quality">Quality: {item.quality}</span> 
                      <span className="product-divider">|</span>
                      <span className="product-quantity">Qty: {item.quantity}</span>
                      {/* Alcohol indicator in meta */}
                      {item.isAlcohol === 'yes' && (
                        <>
                          <span className="product-divider">|</span>
                          <span 
                            style={{
                              color: '#8B5CF6',
                              fontWeight: 'bold',
                              fontSize: '0.8rem'
                            }}
                          >
                            🍷 Alcohol
                          </span>
                        </>
                      )}
                      {/* Stock status in meta */}
                      {item.stock && item.stock !== 'in-stock' && (
                        <>
                          <span className="product-divider">|</span>
                          <span 
                            style={{
                              color: item.stock === 'out-of-stock' ? '#f44336' : '#ff9800',
                              fontWeight: 'bold',
                              fontSize: '0.8rem'
                            }}
                          >
                            {item.stock === 'out-of-stock' ? 'Out of Stock' : 'Low Stock'}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {/* Show these buttons for buyers and unauthenticated users who are not the store owner */}
                    {(userType === 'buyer' || !authUser) && !isStoreOwner && canPurchase && (
                      <div className="product-actions">
                        <button
                          className="add-to-cart-button"
                          disabled={item.stock === 'out-of-stock' || !store.live || !storeIsOpen}
                          style={{
                            opacity: (item.stock === 'out-of-stock' || !store.live || !storeIsOpen) ? 0.5 : 1,
                            cursor: (item.stock === 'out-of-stock' || !store.live || !storeIsOpen) ? 'not-allowed' : 'pointer',
                            background: (item.stock === 'out-of-stock' || !store.live || !storeIsOpen) ? '#ccc' : ''
                          }}
                          onClick={() => {
                            if (item.stock === 'out-of-stock') {
                              alert('This item is currently out of stock');
                              return;
                            }
                            if (!authUser) {
                              // Redirect to login page if not signed in
                              alert('Please sign in to add items to your cart');
                              navigate('/login');
                            } else {
                              handleAddToCart(item);
                            }
                          }}
                        >
                          {!store.live ? 'Store Offline' : 
                           !storeIsOpen ? 'Store Closed' :
                           item.stock === 'out-of-stock' ? 'Out of Stock' : 
                           'Add to Cart'}
                        </button>
                      </div>
                    )}
                    
                    {/* Show edit functionality for store owners */}
                    {isStoreOwner && (
                      <div className="product-owner-actions">
                        <button
                          className="edit-item-button"
                          onClick={() => navigate(`/store-profile?editItem=${item.id}`)}
                          title="Edit this item"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="manage-item-button"
                          onClick={() => navigate('/store-profile')}
                          title="Go to Store Management"
                        >
                          📊 Manage
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            <style>{`
              .product-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 16px;
                margin-top: 16px;
              }
              
              .no-items-message {
                grid-column: 1 / -1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 3rem 1rem;
                background: #f9f9f9;
                border-radius: 12px;
                color: #888;
              }
              
              .no-items-icon {
                font-size: 2.5rem;
                margin-bottom: 1rem;
              }
              
              .no-items-text {
                font-size: 1.1rem;
              }
              
              .product-card {
                display: flex;
                flex-direction: column;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                background: #fff;
                transition: all 0.3s ease;
                height: 100%;
                border: 1px solid #eee;
              }
              
              .product-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 16px rgba(0,0,0,0.1);
              }
              
              .product-image-container {
                height: 140px;
                width: 100%;
                overflow: hidden;
              }
              
              .product-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
              }
              
              .product-card:hover .product-image {
                transform: scale(1.05);
              }
              
              .product-details {
                padding: 12px;
                display: flex;
                flex-direction: column;
                flex: 1;
              }
              
              .product-name {
                font-weight: 600;
                font-size: 1rem;
                color: #333;
                margin-bottom: 4px;
              }
              
              .product-price {
                color: #007B7F;
                font-weight: 600;
                font-size: 1.1rem;
                margin-bottom: 6px;
              }
              
              .product-meta {
                color: #666;
                font-size: 0.9rem;
                display: flex;
                gap: 6px;
                margin-bottom: 12px;
              }
              
              .product-divider {
                color: #ddd;
              }
              
              .product-actions {
                margin-top: auto;
              }
              
              .add-to-cart-button {
                width: 100%;
                background: #007B7F;
                color: #fff;
                border: none;
                border-radius: 6px;
                padding: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              
              .add-to-cart-button:hover {
                background: #006366;
                transform: translateY(-2px);
              }
              
              .product-owner-actions {
                margin-top: auto;
                display: flex;
                gap: 8px;
              }
              
              .edit-item-button, .manage-item-button {
                flex: 1;
                border: none;
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
              }
              
              .edit-item-button {
                background: linear-gradient(135deg, #007B7F 0%, #005a5d 100%);
                color: white;
              }
              
              .edit-item-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 123, 127, 0.3);
              }
              
              .manage-item-button {
                background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
                color: #374151;
                border: 1px solid #d1d5db;
              }
              
              .manage-item-button:hover {
                background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
              }
            `}</style>
            {userType === 'buyer' && selectedItems.length > 0 && canPurchase && (
              <div className="cart-total-floating">
                <div className="cart-total-amount">
                  Total: {getCurrencySymbol(selectedItems[0].currency)}
                  {selectedItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0).toFixed(2)}
                </div>
              </div>
            )}
            {!authUser && canPurchase && (
              <div className="cart-total-floating sign-in-prompt" onClick={() => {
                
              <style>{`
                .cart-total-floating {
                  position: fixed;
                  bottom: 24px;
                  right: 24px;
                  background: white;
                  border-radius: 16px;
                  padding: 12px 24px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                  z-index: 1000;
                  transition: all 0.3s ease;
                  border: 2px solid #007B7F;
                }
                
                .cart-total-amount {
                  font-weight: 600;
                  font-size: 1.1rem;
                  color: #007B7F;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                }
                
                .sign-in-prompt {
                  cursor: pointer;
                }
                
                .sign-in-prompt:hover {
                  background: #f0f9ff;
                  transform: translateY(-4px);
                  box-shadow: 0 8px 24px rgba(0,123,127,0.15);
                }
              `}</style>
                     alert('Please sign in to view your cart and make purchases');
                     navigate('/login');
                   }}>
                Sign in to purchase
              </div>
            )}
          </div>
        )}
        {tab === 'reviews' && (
          <div className="reviews-tab">
            {/* Display overall rating summary */}
            <div className="rating-summary">
              <div className="rating-title">Customer Reviews</div>
              <div className="rating-display">
                <div className="rating-star">★</div>
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
              <div className="auth-prompt">
                <div className="prompt-heading">Want to leave a review?</div>
                <p style={{ marginBottom: 16 }}>Please log in or register to share your experience with this store.</p>
                <div className="auth-buttons">
                  <button 
                    onClick={() => navigate('/login')} 
                    className="login-button"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => navigate('/register')} 
                    className="register-button"
                  >
                    Register
                  </button>
                </div>
              </div>
            )}
            
            <style>{`
              .reviews-container {
                margin-top: 16px;
              }
              
              .rating-summary {
                margin-bottom: 24px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
              }
              
              .rating-heading {
                font-weight: 700;
                font-size: 1.2rem;
                margin-bottom: 12px;
                color: #333;
              }
              
              .rating-display {
                display: flex;
                align-items: center;
                gap: 16px;
              }
              
              .rating-star {
                font-size: 2.2rem;
                color: #FFD700;
                line-height: 1;
              }
              
              .rating-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
              }
              
              .rating-value {
                font-weight: 600;
                font-size: 1.1rem;
                color: #333;
              }
              
              .rating-count {
                color: #666;
                font-size: 0.9rem;
              }
              
              .auth-prompt {
                margin-bottom: 24px;
                background: #f0f9ff;
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                border: 1px dashed #007B7F;
                box-shadow: 0 2px 8px rgba(0,123,127,0.08);
              }
              
              .prompt-heading {
                font-weight: 600;
                margin-bottom: 10px;
                color: #007B7F;
                font-size: 1.1rem;
              }
              
              .prompt-text {
                margin-bottom: 16px;
                color: #444;
              }
              
              .auth-actions {
                display: flex;
                justify-content: center;
                gap: 12px;
              }
              
              .login-button, .register-button {
                border-radius: 8px;
                padding: 8px 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              
              .login-button {
                background: #007B7F;
                color: #fff;
                border: none;
              }
              
              .login-button:hover {
                background: #006366;
                transform: translateY(-2px);
              }
              
              .register-button {
                background: #fff;
                color: #007B7F;
                border: 1px solid #007B7F;
              }
              
              .register-button:hover {
                background: #f0f9ff;
                transform: translateY(-2px);
              }
            `}</style>
            
            {/* Show message for unauthenticated users */}
            {!authUser && !isStoreOwner && (
              <div className="auth-prompt">
                <div className="prompt-heading">Want to leave a review?</div>
                <p style={{ marginBottom: 16 }}>Please log in or register to share your experience with this store.</p>
                <div className="auth-buttons">
                  <button 
                    onClick={() => navigate('/login')} 
                    className="login-button"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => navigate('/register')} 
                    className="register-button"
                  >
                    Register
                  </button>
                </div>
              </div>
            )}
            
            {/* Only show review form for authenticated buyers who are not the store owner */}
            {userType === 'buyer' && authUser && !isStoreOwner && (
              <div className="review-form">
                <div className="review-form-title">Leave a review:</div>
                <StarRating value={userRating} onChange={setUserRating} />
                <textarea 
                  value={userReview} 
                  onChange={e => setUserReview(e.target.value)} 
                  placeholder="Share your experience with this store..." 
                  className="review-textarea"
                />
                <button 
                  onClick={handleSubmitReview} 
                  disabled={userRating === 0}
                  className="submit-review"
                >
                  Submit Review
                </button>
                {reviewSent && (
                  <div className="review-success">
                    <span>✓</span> Review submitted successfully!
                  </div>
                )}
              </div>
            )}
            
            {/* Reviews list */}
            <div>
              {reviews.length === 0 ? (
                <div className="no-reviews">
                  <div className="no-reviews-icon">💬</div>
                  <div className="no-reviews-text">No reviews yet. Be the first to review this store!</div>
                </div>
              ) : (
                <div className="reviews-list">
                  {reviews
                    .sort((a, b) => {
                      // Sort by creation date, newest first
                      if (a.createdAt && b.createdAt) {
                        return b.createdAt.toMillis() - a.createdAt.toMillis();
                      }
                      return 0;
                    })
                    .map(r => (
                      <div key={r.id} className="review-item">
                        <img
                          src={r.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.userName || 'Anonymous')}&background=007B7F&color=fff&size=40`}
                          alt={r.userName || 'Anonymous'}
                          style={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: '50%', 
                            objectFit: 'cover', 
                            flexShrink: 0,
                            float: 'left',
                            marginRight: '12px'
                          }}
                          onError={(e) => {
                            // Prevent infinite loop by checking if already using fallback
                            if (!e.target.src.includes('ui-avatars.com')) {
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(r.userName || 'Anonymous')}&background=007B7F&color=fff&size=40`;
                            }
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div className="reviewer-info">
                            <span className="reviewer-name">
                              {r.userName || 'Anonymous'}
                            </span>
                            {r.createdAt && (
                              <span className="review-date">
                                {new Date(r.createdAt.toMillis()).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="review-stars">
                            {[...Array(5)].map((_, i) => (
                              <span 
                                key={i} 
                                style={{ color: i < r.rating ? '#FFD700' : '#ddd' }}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          {r.text && (
                            <div className="review-text">
                              {r.text}
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
      {showBoostModal && userType === 'seller' && (
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

      {/* ID Verification Modal for Alcohol Purchases */}
      {showIdVerificationModal && pendingAlcoholItem && (
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
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#8B5CF6' }}>
                <span style={{ marginRight: 8 }}>🆔</span>
                ID Verification Required
              </h2>
              <button 
                onClick={closeIdVerificationModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
                disabled={idUploading}
              >
                ×
              </button>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
              color: 'white',
              padding: 16,
              borderRadius: 8,
              marginBottom: 20,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🍷</div>
              <h3 style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Alcohol Purchase</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
                You're purchasing: <strong>{pendingAlcoholItem.name}</strong>
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ marginBottom: 16, fontSize: '1rem', lineHeight: 1.5 }}>
                🔒 <strong>Age verification required:</strong> To purchase alcohol products, 
                please upload a clear photo of your government-issued ID (driver's license, 
                passport, or national ID card).
              </p>
              
              <div style={{
                background: '#FEF9C3',
                border: '1px solid #FDE047',
                borderRadius: 8,
                padding: 12,
                marginBottom: 16
              }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#92400E' }}>
                  ⚠️ <strong>Important:</strong> Your ID will be reviewed for age verification only. 
                  We protect your privacy and comply with data protection regulations.
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ 
                  display: 'block', 
                  fontWeight: 600, 
                  marginBottom: 8,
                  color: '#374151'
                }}>
                  Upload ID Document *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIdImageChange}
                  disabled={idUploading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px dashed #8B5CF6',
                    borderRadius: 8,
                    background: '#F9FAFB',
                    cursor: idUploading ? 'not-allowed' : 'pointer'
                  }}
                />
                {idImage && (
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    fontSize: '0.9rem', 
                    color: '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    ✅ {idImage.name} selected
                  </p>
                )}
              </div>

              <div style={{ 
                fontSize: '0.8rem', 
                color: '#6B7280', 
                marginBottom: 20,
                padding: 12,
                background: '#F3F4F6',
                borderRadius: 6
              }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  <strong>Accepted formats:</strong> JPG, PNG, WEBP (max 5MB)
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Requirements:</strong> Clear, legible photo showing full document
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={closeIdVerificationModal}
                disabled={idUploading}
                style={{
                  background: '#F3F4F6',
                  color: '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  padding: '12px 24px',
                  cursor: idUploading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleIdVerification}
                disabled={idUploading || !idImage}
                style={{
                  background: idUploading || !idImage ? '#9CA3AF' : 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  cursor: (idUploading || !idImage) ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {idUploading ? (
                  <>⏳ Uploading...</>
                ) : (
                  <>
                    <span>🆔</span>
                    Verify & Add to Cart
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 20,
            padding: '2.5rem',
            maxWidth: 450,
            width: '90%',
            color: 'white',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
                📤 Share {store?.storeName || 'Store'}
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 35,
                  height: 35,
                  color: 'white',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            <p style={{ 
              margin: '0 0 2rem 0', 
              opacity: 0.9,
              fontSize: '1rem',
              lineHeight: 1.5
            }}>
              Share this amazing local store with your friends and help support the community!
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <button
                onClick={handleShareToInstagram}
                style={{
                  background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
                  border: 'none',
                  borderRadius: 15,
                  padding: '1rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                📸 Instagram
              </button>

              <button
                onClick={handleShareToFacebook}
                style={{
                  background: '#1877F2',
                  border: 'none',
                  borderRadius: 15,
                  padding: '1rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                👥 Facebook
              </button>

              <button
                onClick={handleShareToSnapchat}
                style={{
                  background: '#FFFC00',
                  border: 'none',
                  borderRadius: 15,
                  padding: '1rem',
                  color: '#000',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                👻 Snapchat
              </button>

              <button
                onClick={handleShareToTikTok}
                style={{
                  background: 'linear-gradient(45deg, #ff0050, #ff0050 50%, #000 50%, #000)',
                  border: 'none',
                  borderRadius: 15,
                  padding: '1rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                🎵 TikTok
              </button>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '1rem',
              marginTop: '1rem',
              backdropFilter: 'blur(10px)'
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: '0.9rem', 
                opacity: 0.8,
                lineHeight: 1.4
              }}>
                💡 Tip: Text will be copied to your clipboard for easy sharing on Instagram and Snapchat Stories!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Share Success Message */}
      {shareSuccess && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: 'linear-gradient(135deg, #10B981, #059669)',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: 12,
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <span style={{ fontSize: '1.2rem' }}>✅</span>
          <span style={{ fontWeight: '600' }}>Ready to share! Link copied to clipboard</span>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
  }

export default StorePreviewPage;