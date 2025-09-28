import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { collection, query, where, onSnapshot, getDocs, serverTimestamp, setDoc, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import StripePaymentForm from '../components/StripePaymentForm';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// Currency helpers
const currencySymbols = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  CAD: "$",
  AUD: "$",
  ZAR: "R",
  GHS: "GH₵",
  KES: "KSh",
  INR: "₹",
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

const responsiveStyles = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .explore-controls {
    flex-direction: row !important;
    align-items: center !important;
    gap: 0.5rem !important;
  }
  .explore-bar {
    flex-direction: row !important;
    border-radius: 20px !important;
    width: 100%;
    max-width: 900px;
  }
  .explore-dropdowns {
    display: none;
  }
  .explore-bar.mobile .explore-dropdown-toggle {
    display: flex !important;
  }
  .explore-bar.mobile .explore-dropdowns {
    display: none;
  }
  .explore-bar.mobile.show-dropdowns .explore-dropdowns {
    display: flex !important;
    flex-direction: column;
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0 0 20px 20px;
    margin-top: 4px;
    z-index: 1010;
    position: absolute;
    left: 0;
    top: 100%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    animation: fadeIn 0.3s ease;
  }
  
  /* Ensure location area doesn't interfere with dropdowns */
  .explore-controls > div:first-child {
    z-index: 1;
  }
}
@media (min-width: 769px) {
  .explore-bar .explore-dropdown-toggle {
    display: none !important;
  }
  .explore-bar .explore-dropdowns {
    display: flex !important;
    flex-direction: row;
    position: static;
    background: none;
    border: none;
    border-radius: 0;
    margin-top: 0;
  }
}

/* Custom select styling */
select {
  transition: all 0.2s ease;
}

select:hover {
  background: rgba(249, 245, 238, 0.3) !important;
}

select:focus {
  background: rgba(249, 245, 238, 0.5) !important;
  box-shadow: 0 0 0 2px rgba(0, 123, 127, 0.2) !important;
}

/* Input placeholder styling */
input::placeholder {
  color: #9CA3AF !important;
  font-weight: 400;
}
`;

function isStoreOpen(opening, closing) {
  if (!opening || !closing) return false;
  const now = new Date();
  const [openH, openM] = opening.split(':').map(Number);
  const [closeH, closeM] = closing.split(':').map(Number);
  const openDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openH, openM);
  const closeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeH, closeM);
  return now >= openDate && now <= closeDate;
}

const categories = [
  'Foods & Goods',
  'Meat & Poultry',
  'Wholesale',
  'Beauty & Hair',
];

// Add Haversine distance function
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

function ExplorePage() {
  const [userLocation, setUserLocation] = useState(null);
  const [city, setCity] = useState('');
  const [showDropdowns, setShowDropdowns] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [shops, setShops] = useState([]);
  const [boostedShops, setBoostedShops] = useState([]);
  const [recentlyViewedShops, setRecentlyViewedShops] = useState([]);
  const [previouslyPurchasedItems, setPreviouslyPurchasedItems] = useState([]);
  const [purchasedFromStores, setPurchasedFromStores] = useState([]);
  const [ratings, setRatings] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterBy, setFilterBy] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchRadius, setSearchRadius] = useState(30);
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState('');
  const [userCountry, setUserCountry] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [locationDetected, setLocationDetected] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [userType, setUserType] = useState('');
  const [sellerStore, setSellerStore] = useState(null);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostDuration, setBoostDuration] = useState(7);
  const [boostProcessing, setBoostProcessing] = useState(false);
  const [boostError, setBoostError] = useState(null);
  const [stripeClientSecret, setStripeClientSecret] = useState('');
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [boostSuccess, setBoostSuccess] = useState(false);

  // Fix the useEffect to properly set currentUser
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // First check if user is a seller (has a store)
          const storesQuery = query(
            collection(db, 'stores'),
            where('ownerId', '==', user.uid)
          );
          
          const storeSnapshot = await getDocs(storesQuery);
          if (!storeSnapshot.empty) {
            // User has a store, so they're a seller
            setUserType('seller');
            const storeDoc = storeSnapshot.docs[0];
            setSellerStore({
              id: storeDoc.id,
              ...storeDoc.data()
            });
            console.log("User is a seller with store:", storeDoc.data().storeName);
          } else {
            // Check if user exists in the 'users' collection (buyer)
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              setProfile(userDoc.data());
              setUserType('buyer');
              console.log("User is a buyer");
            } else {
              // Fallback - treat as buyer if we can't determine
              setUserType('buyer');
              console.log("User type undetermined, defaulting to buyer");
            }
          }
          
          // Fetch recently viewed stores when user is authenticated
          const viewHistoryRef = collection(db, 'users', user.uid, 'viewHistory');
          const viewHistorySnap = await getDocs(viewHistoryRef);
          
          if (!viewHistorySnap.empty) {
            const storeIds = viewHistorySnap.docs.map(doc => doc.data().storeId);
            const recentlyViewedStorePromises = storeIds.slice(0, 5).map(storeId => 
              getDoc(doc(db, 'stores', storeId))
            );
            
            const recentlyViewedResults = await Promise.all(recentlyViewedStorePromises);
            const validRecentlyViewedStores = recentlyViewedResults
              .filter(docSnap => docSnap.exists())
              .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            
            setRecentlyViewedShops(validRecentlyViewedStores);
          }
          
          // Fetch user's purchase history
          const purchaseStores = new Map(); // To track unique stores the user has purchased from
          const purchasedItems = new Map(); // To track unique items the user has purchased
          
          // First check the orders collection
          const ordersQuery = query(
            collection(db, 'orders'),
            where('buyerId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          
          const ordersSnapshot = await getDocs(ordersQuery);
          
          if (!ordersSnapshot.empty) {
            console.log(`Found ${ordersSnapshot.size} orders for user`);
            
            // Process each order
            for (const orderDoc of ordersSnapshot.docs) {
              const orderData = orderDoc.data();
              
              // Add the store to our purchase history if we have the storeId
              if (orderData.sellerId) {
                try {
                  const storeDoc = await getDoc(doc(db, 'stores', orderData.sellerId));
                  if (storeDoc.exists() && !purchaseStores.has(orderData.sellerId)) {
                    purchaseStores.set(orderData.sellerId, { 
                      id: orderData.sellerId, 
                      ...storeDoc.data(),
                      purchaseCount: 1  
                    });
                  } else if (purchaseStores.has(orderData.sellerId)) {
                    // Increment purchase count for this store
                    const storeData = purchaseStores.get(orderData.sellerId);
                    storeData.purchaseCount += 1;
                    purchaseStores.set(orderData.sellerId, storeData);
                  }
                } catch (error) {
                  console.error('Error fetching store data:', error);
                }
              }
              
              // Process each item in the order
              if (orderData.items && Array.isArray(orderData.items)) {
                orderData.items.forEach(item => {
                  if (item.id && !purchasedItems.has(item.id)) {
                    purchasedItems.set(item.id, { 
                      ...item, 
                      storeId: orderData.sellerId,
                      storeName: orderData.storeName || 'Store'
                    });
                  }
                });
              }
            }
            
            // Set the purchased stores and items
            setPurchasedFromStores(Array.from(purchaseStores.values()));
            setPreviouslyPurchasedItems(Array.from(purchasedItems.values()));
            
            console.log(`Found ${purchaseStores.size} unique stores and ${purchasedItems.size} unique items from purchase history`);
          } else {
            console.log('No orders found for user');
          }
          
          // Also check transactions collection for more purchase history
          const transactionsQuery = query(
            collection(db, 'transactions'),
            where('buyerId', '==', user.uid),
            where('type', '==', 'purchase'),
            orderBy('timestamp', 'desc')
          );
          
          const transactionsSnapshot = await getDocs(transactionsQuery);
          
          if (!transactionsSnapshot.empty) {
            console.log(`Found ${transactionsSnapshot.size} purchase transactions for user`);
            
            // Process each transaction similar to orders
            for (const transDoc of transactionsSnapshot.docs) {
              const transData = transDoc.data();
              
              // Add the store to our purchase history if we have the storeId
              if (transData.sellerId && !purchaseStores.has(transData.sellerId)) {
                try {
                  const storeDoc = await getDoc(doc(db, 'stores', transData.sellerId));
                  if (storeDoc.exists()) {
                    purchaseStores.set(transData.sellerId, { 
                      id: transData.sellerId, 
                      ...storeDoc.data(),
                      purchaseCount: (purchaseStores.get(transData.sellerId)?.purchaseCount || 0) + 1  
                    });
                  }
                } catch (error) {
                  console.error('Error fetching store data from transaction:', error);
                }
              }
              
              // Process each item in the transaction
              if (transData.items && Array.isArray(transData.items)) {
                transData.items.forEach(item => {
                  if (item.id && !purchasedItems.has(item.id)) {
                    purchasedItems.set(item.id, { 
                      ...item, 
                      storeId: transData.sellerId,
                      storeName: transData.storeName || transData.sellerName || 'Store'
                    });
                  }
                });
              }
            }
            
            // Update the purchased stores and items
            setPurchasedFromStores(Array.from(purchaseStores.values()));
            setPreviouslyPurchasedItems(Array.from(purchasedItems.values()));
            
            console.log(`Updated to ${purchaseStores.size} unique stores and ${purchasedItems.size} unique items from all purchase history`);
          }
          
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    });
    return () => unsubscribe();
  }, []);
  
  // Handle boosting a store
  const handleBoostStore = async () => {
    if (!currentUser) {
      setBoostError('You must be logged in to boost a store');
      return;
    }
    
    if (!sellerStore) {
      setBoostError('Store information not available');
      return;
    }
    
    try {
      setBoostProcessing(true);
      setBoostError('');
      
      const boostAmount = boostDuration * 1.99; // £1.99 per day
      const currency = sellerStore.currency || 'GBP';
      
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
          storeId: sellerStore.id,
          boostDuration: boostDuration,
          userId: currentUser.uid
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
    const storeRef = doc(db, 'stores', sellerStore.id);
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
      storeId: sellerStore.id,
      storeName: sellerStore.storeName || sellerStore.name,
      storeOwnerId: sellerStore.ownerId,
      paymentIntentId: paymentIntentId,
      boostStartDate: boostStartDate,
      boostExpiryDate: boostExpiryDate,
      boostDuration: boostDuration,
      boostAmount: boostDuration * 1.99,
      currency: sellerStore.currency || 'GBP',
      paidById: currentUser.uid,
      paidByName: currentUser.displayName,
      paidByEmail: currentUser.email,
      createdAt: new Date()
    });
    
    // Update local state
    setSellerStore({
      ...sellerStore,
      isBoosted: true,
      boostExpiryDate: boostExpiryDate,
      boostStartDate: boostStartDate,
      boostDuration: boostDuration
    });
    
    // Refresh boosted stores if needed
    fetchBoostedStores();
  };
  
  // Fetch boosted stores
  useEffect(() => {
    const fetchBoostedStores = async () => {
      try {
        // Query for stores with active boost
        const now = new Date();
        const boostedStoresQuery = query(
          collection(db, 'stores'),
          where('isBoosted', '==', true),
          where('boostExpiryDate', '>', now)
        );
        
        const boostedStoresSnap = await getDocs(boostedStoresQuery);
        const boostedStoresData = boostedStoresSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort by boost amount (higher boosted stores first)
        boostedStoresData.sort((a, b) => (b.boostAmount || 0) - (a.boostAmount || 0));
        
        setBoostedShops(boostedStoresData);
      } catch (error) {
        console.error('Error fetching boosted stores:', error);
      }
    };
    
    fetchBoostedStores();
  }, []);
  
  // Function to make fetchBoostedStores accessible
  const fetchBoostedStores = async () => {
    try {
      const now = new Date();
      const boostedStoresQuery = query(
        collection(db, 'stores'),
        where('isBoosted', '==', true),
        where('boostExpiryDate', '>', now)
      );
      
      const boostedStoresSnap = await getDocs(boostedStoresQuery);
      const boostedStoresData = boostedStoresSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      boostedStoresData.sort((a, b) => (b.boostAmount || 0) - (a.boostAmount || 0));
      setBoostedShops(boostedStoresData);
    } catch (error) {
      console.error('Error fetching boosted stores:', error);
    }
  };

  // Separate location detection useEffect that only runs once when profile is first loaded
  useEffect(() => {
    if (locationDetected) return; // Don't run if location already detected

    async function setInitialLocation() {
      setLocationLoading(true);
      setLocationError(null);
      
      try {
        // If profile location exists, geocode it
        if (profile && profile.location) {
          console.log('Using profile location:', profile.location);
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(profile.location)}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
              setUserLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
              const detectedCity = data[0].address?.city ||
                data[0].address?.town ||
                data[0].address?.village ||
                data[0].address?.suburb ||
                'Unknown City';
              setCity(detectedCity);
              setUserCountry(data[0].address?.country || '');
              setLocationDetected(true);
              setLocationLoading(false);
              return;
            }
          } catch (error) {
            console.warn('Profile location geocoding failed:', error);
            // Continue to browser geolocation fallback
          }
        }
        
        // Fallback to browser geolocation with improved options
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setUserLocation(coords);
              
              try {
                // Use a faster reverse geocoding approach with a timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
                
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=10`,
                  { signal: controller.signal }
                );
                clearTimeout(timeoutId);
                
                const data = await res.json();
                const detectedCity = data.address?.city ||
                  data.address?.town ||
                  data.address?.village ||
                  data.address?.suburb ||
                  data.display_name?.split(',')[0] ||
                  'Unknown City';
                setCity(detectedCity);
                setUserCountry(data.address?.country || '');
              } catch (error) {
                console.warn('Reverse geocoding failed:', error);
                // Set location anyway, city will show as "Unknown City"
                setCity('Unknown City');
              }
              setLocationDetected(true);
              setLocationLoading(false);
            },
            (error) => {
              console.error('Geolocation error:', error);
              let errorMessage = 'Location unavailable';
              
              switch(error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = 'Location access denied';
                  setLocationError('Permission denied. Click the pin to try again or allow location access.');
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = 'Location unavailable';
                  setLocationError('Location data unavailable. Click the pin to retry.');
                  break;
                case error.TIMEOUT:
                  errorMessage = 'Location timeout';
                  setLocationError('Location request timed out. Click the pin to retry.');
                  break;
                default:
                  setLocationError('Unable to get location. Click the pin to try again.');
              }
              
              setCity(errorMessage);
              setLocationDetected(true);
              setLocationLoading(false);
            },
            {
              timeout: 8000, // Reduced from 10s to 8s for faster fallback
              enableHighAccuracy: false, // Use false for faster detection
              maximumAge: 300000 // 5 minutes cache
            }
          );
        } else {
          setCity('Geolocation not supported');
          setLocationError('Your browser doesn\'t support location services.');
          setLocationDetected(true);
          setLocationLoading(false);
        }
      } catch (error) {
        console.error('Location detection error:', error);
        setCity('Location error');
        setLocationError('Something went wrong. Click the pin to retry.');
        setLocationDetected(true);
        setLocationLoading(false);
      }
    }

    // Only run location detection when we have a user (logged in) and haven't detected location yet
    if (currentUser !== null) {
      setInitialLocation();
    }
  }, [profile, currentUser, locationDetected]);

  // Handle window resize separately
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Add automatic location refresh when page becomes visible (helpful for mobile users)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && locationError && locationError.includes('denied')) {
        // Only auto-retry if location was denied and page becomes visible
        // This helps when user grants permission in another tab
        console.log('Page became visible, retrying location detection...');
        setTimeout(() => {
          if (locationError && locationError.includes('denied')) {
            refreshLocation();
          }
        }, 1000); // Small delay to avoid immediate retry
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [locationError]);

  // Add a periodic location check (only if location failed initially)
  useEffect(() => {
    if (locationError && !locationLoading) {
      const intervalId = setInterval(() => {
        // Only auto-retry if there's an error and we're not already loading
        if (locationError && !locationLoading && navigator.geolocation) {
          console.log('Periodic location retry...');
          refreshLocation();
        }
      }, 60000); // Retry every 60 seconds

      return () => clearInterval(intervalId);
    }
  }, [locationError, locationLoading]);

  useEffect(() => {
    let q;
    if (selectedCategory) {
      q = query(
        collection(db, 'stores'),
        where('live', '==', true),
        where('category', '==', selectedCategory)
      );
    } else {
      q = query(
        collection(db, 'stores'),
        where('live', '==', true)
      );
    }
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      // Filter out disabled and deleted stores on the client side
      const filteredShops = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(shop => !shop.disabled && !shop.deleted);
      
      setShops(filteredShops);
    });
    return () => unsubscribe();
  }, [selectedCategory]);

  useEffect(() => {
    // Fetch ratings for all shops
    const fetchRatings = async () => {
      const ratingsObj = {};
      for (const shop of shops) {
        const reviewsSnap = await getDocs(collection(db, 'stores', shop.id, 'reviews'));
        const reviews = reviewsSnap.docs.map(doc => doc.data());
        const count = reviews.length;
        const avg = count ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / count).toFixed(1) : '0.0';
        ratingsObj[shop.id] = { avg, count };
      }
      setRatings(ratingsObj);
    };
    if (shops.length > 0) fetchRatings();
  }, [shops]);

  useEffect(() => {
    const checkOnboarding = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const onboardingStep = userDoc.data().onboardingStep;
        if (onboardingStep && onboardingStep !== 'complete') {
          navigate('/' + onboardingStep);
        }
      }
    };
    checkOnboarding();
  }, [navigate]);

  // Only filter by distance from user location
  let displayedShops = [...shops];

  // Search filter
  if (searchTerm.trim() !== '') {
    const term = searchTerm.trim().toLowerCase();
    displayedShops = displayedShops.filter(shop => {
      const name = (shop.storeName || '').toLowerCase();
      const location = (shop.storeLocation || '').toLowerCase();
      const postCode = (shop.postCode || '').toLowerCase();
      return name.includes(term) || location.includes(term) || postCode.includes(term);
    });
  }

  // Filter By
  if (filterBy === 'Open Now') {
    displayedShops = displayedShops.filter(shop => isStoreOpen(shop.openingTime, shop.closingTime));
  } else if (filterBy === 'Top Rated') {
    displayedShops
      .map(shop => ({ ...shop, avgRating: parseFloat(ratings[shop.id]?.avg || 0), ratingCount: ratings[shop.id]?.count || 0 }))
      .filter(shop => shop.ratingCount >= 10)
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 5);
  }

  // Sort By
  if (sortBy === 'Newest') {
    displayedShops = displayedShops.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sortBy === 'Oldest') {
    displayedShops = displayedShops.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sortBy === 'Rating') {
    displayedShops = displayedShops
      .map(shop => ({ ...shop, avgRating: parseFloat(ratings[shop.id]?.avg || 0), ratingCount: ratings[shop.id]?.count || 0 }))
      .filter(shop => shop.ratingCount >= 10)
      .sort((a, b) => b.avgRating - a.avgRating);
  }

  // Filter displayedShops by selectedCity
  if (selectedCity) {
    displayedShops = displayedShops.filter(shop =>
      (shop.city && shop.city === selectedCity) ||
      (shop.storeLocation && shop.storeLocation.includes(selectedCity))
    );
  }

  // FINAL: Filter by distance (radius) LAST
  const filteredShops = displayedShops.filter(shop => {
    if (!shop.latitude || !shop.longitude || !userLocation) return false;
    const distance = getDistanceFromLatLonInKm(
      Number(userLocation.lat), Number(userLocation.lng),
      Number(shop.latitude), Number(shop.longitude)
    );
    return distance <= searchRadius;
  });

  // Define allCities after shops is set and before render logic
  const allCities = Array.from(new Set(filteredShops
    .map(shop => {
      if (shop.city) return shop.city;
      if (shop.storeLocation) {
        const parts = shop.storeLocation.split(',');
        return parts.length > 1 ? parts[1].trim() : '';
      }
      return '';
    })
  )).filter(Boolean);

  // Function to handle store click and add to viewed stores
  const handleStoreClick = (storeId) => {
    if (currentUser) {
      // Get existing viewed stores from localStorage
      const viewedKey = `viewedStores_${currentUser.uid}`;
      const existingViewed = JSON.parse(localStorage.getItem(viewedKey) || '[]');
      
      // Remove store if it already exists (to move it to front)
      const filteredViewed = existingViewed.filter(id => id !== storeId);
      
      // Add store to beginning of array
      const updatedViewed = [storeId, ...filteredViewed];
      
      // Keep only last 20 viewed stores
      const limitedViewed = updatedViewed.slice(0, 20);
      
      // Save back to localStorage
      localStorage.setItem(viewedKey, JSON.stringify(limitedViewed));
      
      // Also save to Firestore for cross-device persistence
      try {
        const viewHistoryRef = doc(db, 'users', currentUser.uid, 'viewHistory', storeId);
        setDoc(viewHistoryRef, {
          storeId: storeId,
          timestamp: serverTimestamp()
        }, { merge: true });
        
        console.log('Saved viewed store to Firestore:', storeId, 'for user:', currentUser.uid);
      } catch (error) {
        console.error('Error saving view history to Firestore:', error);
      }
      
      console.log('Saved viewed store to localStorage:', storeId, 'for user:', currentUser.uid);
    }
    
    // Navigate to store page
    navigate(`/store-preview/${storeId}`);
  };

  // Add function to refresh location
  const refreshLocation = () => {
    setLocationDetected(false);
    setLocationLoading(true);
    setLocationError(null);
    setCity('Detecting location...');
    setUserLocation(null);
    
    // Force location detection to run again with improved settings
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          
          try {
            // Use a faster reverse geocoding approach with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=10`,
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            
            const data = await res.json();
            const detectedCity = data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.suburb ||
              data.display_name?.split(',')[0] ||
              'Unknown City';
            setCity(detectedCity);
            setUserCountry(data.address?.country || '');
            setLocationError(null);
          } catch (error) {
            console.error('Error reverse geocoding:', error);
            setCity('Unknown City');
            setLocationError('Couldn\'t determine city name, but location detected');
          }
          setLocationDetected(true);
          setLocationLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMessage = 'Location unavailable';
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied';
              setLocationError('Please allow location access in your browser settings and try again.');
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location unavailable';
              setLocationError('Location services unavailable. Please check your device settings.');
              break;
            case error.TIMEOUT:
              errorMessage = 'Location timeout';
              setLocationError('Location request timed out. Please try again.');
              break;
            default:
              setLocationError('Unable to detect location. Please try again or check your device settings.');
          }
          
          setCity(errorMessage);
          setLocationDetected(true);
          setLocationLoading(false);
        },
        {
          timeout: 6000, // Faster timeout for manual refresh
          enableHighAccuracy: true, // Use high accuracy for manual refresh
          maximumAge: 0 // Don't use cached location for manual refresh
        }
      );
    } else {
      setCity('Geolocation not supported');
      setLocationError('Your browser doesn\'t support location services.');
      setLocationDetected(true);
      setLocationLoading(false);
    }
  };

  // Function to handle manual location input
  const setManualLocationHandler = async (locationName) => {
    if (!locationName.trim()) return;
    
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName.trim())}&limit=1`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        setUserLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        const detectedCity = data[0].address?.city ||
          data[0].address?.town ||
          data[0].address?.village ||
          data[0].address?.suburb ||
          data[0].display_name?.split(',')[0] ||
          locationName.trim();
        setCity(detectedCity);
        setUserCountry(data[0].address?.country || '');
        setLocationDetected(true);
        setShowManualLocation(false);
        setManualLocation('');
        setLocationError(null);
      } else {
        setLocationError(`Couldn't find "${locationName}". Please try a different city or area name.`);
      }
    } catch (error) {
      console.error('Manual location lookup failed:', error);
      setLocationError('Failed to lookup location. Please check your connection and try again.');
    }
    
    setLocationLoading(false);
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100dvh' }}>
      <style>{responsiveStyles}</style>
      <Navbar />
      {/* Fixed Desktop Layout */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        padding: '1rem', 
        gap: '1rem', 
        background: '#F9F5EE',
        position: 'relative'
      }}>
        {/* Location Display - Top Left */}
        <div style={{ 
          width: '100%', 
          maxWidth: '900px',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-start', 
          marginBottom: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span 
              onClick={refreshLocation}
              style={{ 
                fontSize: '1rem', 
                marginRight: '0.3rem', 
                cursor: 'pointer',
                transition: 'transform 0.2s ease',
                userSelect: 'none',
                animation: locationLoading ? 'spin 1s linear infinite' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!locationLoading) e.target.style.transform = 'scale(1.2)';
              }}
              onMouseLeave={(e) => {
                if (!locationLoading) e.target.style.transform = 'scale(1)';
              }}
              title={locationLoading ? "Detecting location..." : "Click to refresh location"}
              aria-label="Refresh location"
            >
              {locationLoading ? '🔄' : '📍'}
            </span>
            <span style={{ 
              fontSize: '1.2rem', 
              color: locationError ? '#D92D20' : '#007B7F',
              fontWeight: '700',
              textShadow: '0px 1px 1px rgba(0, 0, 0, 0.05)'
            }}>
              {locationLoading 
                ? 'Detecting location...' 
                : city || (locationDetected ? 'Location unavailable' : 'Detecting city...')
              }
            </span>
            {locationError && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '0.9rem',
                color: '#B91C1C',
                marginTop: '4px',
                zIndex: 10,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>⚠️ Location Issue</div>
                <div style={{ marginBottom: '8px' }}>{locationError}</div>
                {locationError.includes('denied') && (
                  <div style={{ fontSize: '0.8rem', color: '#7F1D1D', marginBottom: '8px' }}>
                    💡 <strong>Why we need location:</strong> To show you nearby stores and calculate accurate delivery times.
                    <br />
                    📱 <strong>How to enable:</strong> Look for the location icon in your browser's address bar or check your browser settings.
                  </div>
                )}
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #FECACA' }}>
                  <button
                    onClick={() => setShowManualLocation(!showManualLocation)}
                    style={{
                      background: '#007B7F',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    {showManualLocation ? 'Cancel' : 'Enter Location Manually'}
                  </button>
                  {showManualLocation && (
                    <div style={{ marginTop: '8px' }}>
                      <input
                        type="text"
                        placeholder="Enter your city or area"
                        value={manualLocation}
                        onChange={(e) => setManualLocation(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            setManualLocationHandler(manualLocation);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          marginBottom: '4px'
                        }}
                      />
                      <button
                        onClick={() => setManualLocationHandler(manualLocation)}
                        disabled={!manualLocation.trim() || locationLoading}
                        style={{
                          background: manualLocation.trim() && !locationLoading ? '#007B7F' : '#9CA3AF',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '0.8rem',
                          cursor: manualLocation.trim() && !locationLoading ? 'pointer' : 'not-allowed'
                        }}
                      >
                        {locationLoading ? 'Setting...' : 'Set Location'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Search Controls Row 1: Search Bar - Shown to buyers and unauthenticated users */}
        {!isMobile && (userType === 'buyer' || !currentUser) && (
          <div style={{ 
            display: 'flex', 
            width: '100%', 
            maxWidth: '900px',
            marginBottom: '10px'
          }}>
            <div style={{ 
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.9)', 
              backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              borderRadius: '20px', 
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}>
              <input
                type="text"
                placeholder="🔍 Search stores, products..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  padding: '1rem 1.25rem',
                  fontSize: '1rem',
                  border: 'none',
                  outline: 'none',
                  color: '#1F2937',
                  background: 'transparent',
                  borderRadius: '20px',
                  fontWeight: '500',
                }}
              />
            </div>
          </div>
        )}

        {/* Desktop Search Controls Row 2: All Dropdowns - Shown to buyers and unauthenticated users */}
        {!isMobile && (userType === 'buyer' || !currentUser) && (
          <div style={{ 
            display: 'flex',
            width: '100%', 
            maxWidth: '900px',
            marginBottom: '16px',
            gap: '10px'
          }}>
            {/* Category Dropdown - Shown to buyers and unauthenticated users */}
            <div style={{ 
              flex: '1 1 0',
              background: 'rgba(255, 255, 255, 0.9)', 
              backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              borderRadius: '12px', 
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{ 
                width: '100%',
                padding: '0.75rem 2.5rem 0.75rem 1rem', 
                fontSize: '1rem', 
                border: 'none', 
                color: '#1F2937', 
                background: 'transparent', 
                outline: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
              }}
            >
              <option value="">📂 Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

            {/* Filter By Dropdown */}
            <div style={{ 
              flex: '1 1 0',
              background: 'rgba(255, 255, 255, 0.9)', 
              backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              borderRadius: '12px', 
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}>
              <select
                value={filterBy}
                onChange={e => setFilterBy(e.target.value)}
                style={{ 
                  width: '100%',
                  padding: '0.75rem 2.5rem 0.75rem 1rem', 
                  fontSize: '1rem', 
                  border: 'none', 
                  color: '#1F2937', 
                  background: 'transparent', 
                  outline: 'none',
                  fontWeight: '500',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem',
                }}
              >
                <option value="">🔍 Filter By</option>
                <option value="Open Now">🟢 Open Now</option>
                <option value="Top Rated">⭐ Top Rated</option>
              </select>
            </div>

            {/* Sort By Dropdown */}
            <div style={{ 
              flex: '1 1 0',
              background: 'rgba(255, 255, 255, 0.9)', 
              backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              borderRadius: '12px', 
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ 
                  width: '100%',
                  padding: '0.75rem 2.5rem 0.75rem 1rem', 
                  fontSize: '1rem', 
                  border: 'none', 
                  color: '#1F2937', 
                  background: 'transparent', 
                  outline: 'none',
                  fontWeight: '500',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem',
                }}
              >
                <option value="">📊 Sort By</option>
                <option value="Newest">🆕 Newest</option>
                <option value="Oldest">📅 Oldest</option>
                <option value="Rating">⭐ Rating</option>
              </select>
            </div>
          </div>
        )}

        {/* Mobile Search Bar with All Controls - Shown to buyers and unauthenticated users */}
        {isMobile && (userType === 'buyer' || !currentUser) && (
        <div className={`explore-bar mobile${showDropdowns ? ' show-dropdowns' : ''}`} style={{ 
          display: 'flex', 
          background: 'rgba(255, 255, 255, 0.9)', 
          backdropFilter: 'blur(10px)', 
          border: '1px solid rgba(255, 255, 255, 0.2)', 
          borderRadius: '20px', 
          overflow: 'visible', 
          width: '100%', 
          position: 'relative',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease',
          zIndex: showDropdowns ? 1010 : 'auto'
        }}>
          <input
            type="text"
            placeholder="🔍 Search stores, products..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '1rem 1.25rem',
              fontSize: '1rem',
              border: 'none',
              outline: 'none',
              color: '#1F2937',
              background: 'transparent',
              borderRadius: '20px 0 0 20px',
              fontWeight: '500',
              '::placeholder': {
                color: '#9CA3AF',
                fontSize: '1rem'
              }
            }}
            onFocus={e => {
              e.target.parentElement.style.transform = 'translateY(-2px)';
              e.target.parentElement.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
              e.target.style.background = 'rgba(249, 245, 238, 0.5)';
            }}
            onBlur={e => {
              e.target.parentElement.style.transform = 'translateY(0)';
              e.target.parentElement.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
              e.target.style.background = 'transparent';
            }}
          />
          <button
            type="button"
            className="explore-dropdown-toggle"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 123, 127, 0.1)',
              border: 'none',
              padding: '0 1rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: '#007B7F',
              outline: 'none',
              borderRadius: '0 20px 20px 0',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setShowDropdowns((prev) => !prev)}
            onMouseEnter={e => {
              e.target.style.background = 'rgba(0, 123, 127, 0.2)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(0, 123, 127, 0.1)';
              e.target.style.transform = 'scale(1)';
            }}
            aria-label="Show filters"
          >
            {showDropdowns ? '▲' : '▼'}
          </button>
          <div className="explore-dropdowns" style={{ 
            display: showDropdowns ? 'flex' : 'none',
            flexDirection: 'column',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.95)', 
            backdropFilter: 'blur(10px)',
            position: 'absolute',
            left: 0, 
            top: '100%', 
            zIndex: 10, 
            border: '1px solid rgba(255, 255, 255, 0.2)', 
            borderRadius: '0 0 20px 20px',
            marginTop: '4px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            overflow: 'visible'
          }}>
            {/* Category Dropdown - Only shown to buyers on mobile */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ 
                padding: '1rem 2.5rem 1rem 1.25rem', 
                fontSize: '1rem', 
                border: 'none', 
                color: '#1F2937', 
                background: 'transparent', 
                outline: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                borderRight: isMobile ? 'none' : '1px solid rgba(0, 123, 127, 0.2)',
                borderRadius: isMobile ? '0' : '0',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                minWidth: '140px'
              }}
            >
              <option value="">📂 Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filterBy}
              onChange={e => setFilterBy(e.target.value)}
              style={{ 
                padding: '1rem 2.5rem 1rem 1.25rem', 
                fontSize: '1rem', 
                border: 'none', 
                color: '#1F2937', 
                background: 'transparent', 
                outline: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                borderRight: isMobile ? 'none' : '1px solid rgba(0, 123, 127, 0.2)',
                borderRadius: '0',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                minWidth: '120px'
              }}
            >
              <option value="">🔍 Filter By</option>
              <option value="Open Now">🟢 Open Now</option>
              <option value="Top Rated">⭐ Top Rated</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ 
                padding: '1rem 2.5rem 1rem 1.25rem', 
                fontSize: '1rem', 
                border: 'none', 
                color: '#1F2937', 
                background: 'transparent', 
                outline: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                borderRadius: isMobile ? '0' : '0 20px 20px 0',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                minWidth: '140px',
                flex: '0 0 140px',
                flexShrink: 0
              }}
            >
              <option value="">📊 Sort By</option>
              <option value="Newest">🆕 Newest</option>
              <option value="Oldest">📅 Oldest</option>
              <option value="Rating">⭐ Rating</option>
            </select>
          </div>
        </div>
      )}
      </div>
        
      {/* Compact City Selector - Left Aligned */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        margin: '1rem 0 0 1rem',
        position: 'relative',
        zIndex: 100
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          transition: 'all 0.2s ease',
          width: 'fit-content',
          position: 'relative',
          zIndex: 100
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.08)';
        }}>
          <span style={{ 
            fontSize: '0.9rem',
            fontWeight: '600',
            color: '#1F2937',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            🏙️ City:
          </span>
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            style={{ 
              padding: '0.4rem 2rem 0.4rem 0.75rem', 
              fontSize: '0.9rem', 
              border: 'none', 
              borderRadius: '8px',
              background: 'rgba(249, 245, 238, 0.5)',
              color: '#1F2937',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '0.8rem',
              transition: 'all 0.2s ease',
              minWidth: '120px',
              position: 'relative',
              zIndex: 100
            }}
            onFocus={e => {
              e.target.style.background = 'rgba(249, 245, 238, 0.8)';
              e.target.style.boxShadow = '0 0 0 2px rgba(0, 123, 127, 0.2)';
              e.target.style.zIndex = '101';
            }}
            onBlur={e => {
              e.target.style.background = 'rgba(249, 245, 238, 0.5)';
              e.target.style.boxShadow = 'none';
              e.target.style.zIndex = '100';
            }}
          >
            <option value=''>All Cities</option>
            {allCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Boosters Section - For promoting stores - Only visible to sellers */}
      {currentUser && userType === 'seller' && (
        <>
          <h2 style={{ 
            margin: '2rem 0 1rem 1rem', 
            color: '#007B7F', 
            fontWeight: '800', 
            fontSize: '1.8rem', 
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)'
          }}>
            🚀 Boosters
            <span style={{ 
              background: '#e9f7ff', 
              color: '#0284c7', 
              borderRadius: '12px', 
              padding: '2px 8px', 
              fontSize: '0.9rem',
              fontWeight: '500',
              border: '1px solid #0284c7'
            }}>
              {boostedShops.length}
            </span>
            
            {/* Boost button for sellers */}
            {sellerStore && (
          <button
            onClick={() => setShowBoostModal(true)}
            style={{
              marginLeft: 'auto',
              marginRight: '1rem',
              background: sellerStore.isBoosted ? '#6366f1' : '#0284c7',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = sellerStore.isBoosted ? '#4f46e5' : '#0369a1'}
            onMouseLeave={(e) => e.target.style.background = sellerStore.isBoosted ? '#6366f1' : '#0284c7'}
          >
            {sellerStore.isBoosted ? (
              <>🔄 Manage Boost</>
            ) : (
              <>⚡ Boost Your Store</>
            )}
          </button>
        )}
      </h2>

      {boostedShops.length === 0 ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem 1rem',
          background: '#f0f9ff',
          borderRadius: '12px',
          margin: '0 1rem 2rem',
          border: '2px dashed #0284c7'
        }}>
          <div style={{
            textAlign: 'center',
            color: '#0369a1'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚀</div>
            <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              No boosted stores available
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {currentUser && userType === 'seller' ? 
                'Be the first to boost your store and gain more visibility!' :
                'Sellers can boost their stores to appear in this section'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '0 1rem 2rem', scrollbarWidth: 'thin' }}>
          {boostedShops.map(shop => {
            // Use the same store card logic from spotlight section
            const today = daysOfWeek[new Date().getDay()];
            const isClosedToday = shop.closedDays && shop.closedDays.includes(today);
            const todayOpening = shop.openingTimes && shop.openingTimes[today];
            const todayClosing = shop.closingTimes && shop.closingTimes[today];
            
            function isStoreOpenForToday(shop) {
              if (!shop) return false;
              
              const today = daysOfWeek[new Date().getDay()];
              
              // Check if store is closed today
              if (shop.closedDays && shop.closedDays.includes(today)) {
                return false;
              }
              
              // Get today's opening and closing times
              const todayOpening = shop.openingTimes && shop.openingTimes[today];
              const todayClosing = shop.closingTimes && shop.closingTimes[today];
              
              // If no specific times set for today, fall back to general opening/closing times
              const opening = todayOpening || shop.openingTime;
              const closing = todayClosing || shop.closingTime;
              
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
            
            const open = isStoreOpenForToday(shop);
            const storeRating = ratings[shop.id];
            const boostDaysLeft = shop.boostExpiryDate ? 
              Math.max(0, Math.ceil((shop.boostExpiryDate.toDate() - new Date()) / (1000 * 60 * 60 * 24))) : 0;
            
            return (
              <div
                key={shop.id}
                onClick={() => {
                  handleStoreClick(shop.id);
                  navigate(`/store-preview/${shop.id}`);
                }}
                style={{
                  width: 260,
                  height: 320,
                  border: '2px solid #0284c7',
                  borderRadius: 16,
                  background: '#f0f9ff',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  opacity: open ? 1 : 0.7,
                  filter: open ? 'none' : 'grayscale(0.3)',
                  transition: 'all 0.3s ease, transform 0.2s ease',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                }}
              >
                {/* Boost badge */}
                <div style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  background: '#0284c7',
                  color: 'white',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  zIndex: 2,
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  ⚡ BOOSTED {boostDaysLeft > 0 ? `• ${boostDaysLeft}d` : ''}
                </div>
                
                <div style={{ 
                  height: 150, 
                  position: 'relative',
                  overflow: 'hidden',
                  borderTopLeftRadius: '14px',
                  borderTopRightRadius: '14px',
                }}>
                  <img 
                    src={shop.storePhotoURL || 'https://via.placeholder.com/300x150?text=Store'} 
                    alt={shop.storeName} 
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/300x150?text=Store';
                    }}
                  />
                  {!open && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-15deg)',
                      background: 'rgba(239, 68, 68, 0.85)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      zIndex: 1,
                      letterSpacing: '0.05rem',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                    }}>
                      CLOSED
                    </div>
                  )}
                </div>
                
                <div style={{ 
                  padding: '10px 15px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  flexGrow: 1
                }}>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                  }}>
                    <h3 style={{ 
                      margin: 0,
                      fontSize: '1.1rem',
                      color: '#1e293b',
                      fontWeight: '700',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      display: '-webkit-box'
                    }}>
                      {shop.storeName || 'Store'}
                    </h3>
                    
                    {storeRating && (
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        background: '#fffbeb',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        border: '1px solid #fcd34d'
                      }}>
                        <span style={{ color: '#f59e0b', marginRight: '2px', fontSize: '0.8rem' }}>⭐</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#92400e' }}>
                          {Number(storeRating.avg).toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div style={{
                    color: '#64748b',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '3px'
                  }}>
                    <span style={{ color: '#0284c7', fontSize: '0.9rem' }}>📍</span>
                    <span style={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: '500'
                    }}>
                      {shop.storeLocation || shop.storeAddress || 'Location not set'}
                    </span>
                  </div>
                  
                  <div style={{ 
                    fontSize: '0.8rem',
                    color: '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    display: '-webkit-box',
                    flexGrow: 1
                  }}>
                    {shop.storeDescription || 'No description available'}
                  </div>
                  
                  <div style={{ 
                    marginTop: 'auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    color: open ? '#059669' : '#dc2626',
                    fontWeight: '600',
                  }}>
                    <span>
                      {open ? '🟢 OPEN NOW' : '🔴 CLOSED'}
                    </span>
                    {shop.category && (
                      <span style={{ 
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: '600'
                      }}>
                        {shop.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
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
                  {sellerStore.storeName} will now appear in the recommended section on the Explore page 
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
                          currency: sellerStore.currency || 'GBP',
                          description: `Boost store for ${boostDuration} days`
                        }}
                        onPaymentSuccess={() => handlePaymentSuccess(stripePaymentIntentId)}
                        onPaymentError={handlePaymentError}
                        processing={processing}
                        setProcessing={setProcessing}
                        currentUser={currentUser}
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
                        {getCurrencySymbol(sellerStore.currency || 'GBP')}{formatPrice(boostDuration * 1.99, sellerStore.currency || 'GBP')}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#555', marginTop: 4 }}>
                        {getCurrencySymbol(sellerStore.currency || 'GBP')}{formatPrice(1.99, sellerStore.currency || 'GBP')} per day for {boostDuration} days
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

      {/* Recommended Stores Section */}
      {/* Only show Recommended section for buyers (authenticated) */}
      {currentUser && userType === 'buyer' && (
        <>
          <h2 style={{ 
            margin: '2rem 0 0.5rem 1rem', 
            color: '#007B7F', 
            fontWeight: '800', 
            fontSize: '1.8rem',
            textShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)', 
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ⭐ Recommended For You
          </h2>
          
          <div style={{
            display: 'flex',
            overflowX: 'auto',
            padding: '0.5rem 1rem 1rem 1rem',
            gap: '1rem',
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE and Edge
            WebkitOverflowScrolling: 'touch',
          }}>
            <style>{`
              /* Hide scrollbar for Chrome, Safari and Opera */
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            
            {boostedShops.length === 0 && recentlyViewedShops.length === 0 && purchasedFromStores.length === 0 && previouslyPurchasedItems.length === 0 ? (
              <div style={{
                width: '100%',
                padding: '2rem',
                textAlign: 'center',
                color: '#6B7280',
                background: 'rgba(255,255,255,0.7)',
                borderRadius: '12px',
                border: '2px dashed #E5E7EB',
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <h3 style={{ marginBottom: '0.5rem', fontWeight: '600' }}>No recommendations yet</h3>
                <p>Browse more stores and products to get personalized recommendations</p>
              </div>
            ) : (
              <>
                {/* Combine and deduplicate boosted, purchased from, and recently viewed shops */}
                {[...boostedShops, ...purchasedFromStores, ...recentlyViewedShops]
                  // Filter out duplicates by keeping the first occurrence of each store ID
                  .filter((shop, index, self) => 
                    shop && shop.id && index === self.findIndex((s) => s && s.id === shop.id)
                  )
                  // Limit to 10 shops max
                  .slice(0, 10)
                  .map(shop => (
                    <div 
                      key={shop.id}
                      onClick={() => handleStoreClick(shop.id)}
                      style={{
                        minWidth: '240px',
                        maxWidth: '260px',
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        position: 'relative',
                        flex: '0 0 auto'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 15px rgba(0, 0, 0, 0.1)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
                      }}
                    >
                      {/* Shop image or placeholder */}
                      <div style={{ height: '120px', background: '#f4f4f4', overflow: 'hidden' }}>
                        {shop.backgroundImg ? (
                          <img 
                            src={shop.backgroundImg} 
                            alt={shop.storeName || shop.businessName || shop.name || 'Shop'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ 
                            height: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: '#e8f2f2',
                            color: '#007B7F'
                          }}>
                            {shop.storeName?.charAt(0) || shop.businessName?.charAt(0) || 'L'}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ padding: '12px' }}>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '1.1rem', 
                          marginBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {shop.storeName || shop.businessName || shop.name || 'Shop'}
                        </div>
                        <div style={{ 
                          fontSize: '0.85rem',
                          color: '#555',
                          marginBottom: '8px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {shop.storeLocation || 'Location not available'}
                        </div>
                        
                        {shop.isBoosted && (
                          <div style={{ 
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: '#FFD700',
                            color: '#333',
                            borderRadius: '20px',
                            padding: '2px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <span>⭐</span> BOOSTED
                          </div>
                        )}
                        
                        {/* Show badge for purchased from stores */}
                        {shop.purchaseCount && (
                          <div style={{ 
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            background: '#10B981',
                            color: 'white',
                            borderRadius: '20px',
                            padding: '2px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <span>🛒</span> PURCHASED
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                
                {/* Display purchased items if available */}
                {previouslyPurchasedItems.length > 0 && previouslyPurchasedItems
                  .slice(0, 5) // Limit to 5 items
                  .map(item => (
                    <div 
                      key={`item-${item.id}`}
                      onClick={() => item.storeId && handleStoreClick(item.storeId)}
                      style={{
                        minWidth: '200px',
                        maxWidth: '220px',
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        position: 'relative',
                        flex: '0 0 auto'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 15px rgba(0, 0, 0, 0.1)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
                      }}
                    >
                      {/* Item image or placeholder */}
                      <div style={{ height: '120px', background: '#f4f4f4', overflow: 'hidden' }}>
                        {item.imageURL ? (
                          <img 
                            src={item.imageURL} 
                            alt={item.name || 'Product'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ 
                            height: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: '#f0f9f9',
                            color: '#007B7F'
                          }}>
                            {item.name?.charAt(0) || 'P'}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ padding: '12px' }}>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '1rem', 
                          marginBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.name || 'Product'}
                        </div>
                        <div style={{ 
                          fontSize: '0.85rem',
                          color: '#555',
                          marginBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.storeName || 'Store'}
                        </div>
                        {item.price && (
                          <div style={{ 
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: '#007B7F'
                          }}>
                            £{typeof item.price === 'number' ? item.price.toFixed(2) : item.price}
                          </div>
                        )}
                        
                        <div style={{ 
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: '#3B82F6',
                          color: 'white',
                          borderRadius: '20px',
                          padding: '2px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <span>🔄</span> BUY AGAIN
                        </div>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </>
      )}

      <h2 style={{ 
        margin: '3rem 0 1rem 1rem', 
        color: '#007B7F', 
        fontWeight: '800', 
        fontSize: '1.8rem', 
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)'
      }}>
        {(userType === 'buyer' || !currentUser) ? (
          <>
            📍 Shops Near You
            <span style={{ 
              background: '#f0f9f9', 
              color: '#007B7F', 
              borderRadius: '12px', 
              padding: '2px 8px', 
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              {filteredShops.length}
            </span>
          </>
        ) : (
          <>
            🏪 Your Store
          </>
        )}
      </h2>
      
      {userType === 'seller' && sellerStore ? (
        // Show seller's own store
        <div style={{
          display: 'flex',
          padding: '0 1rem 1rem',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div
            onClick={() => navigate(`/store-preview/${sellerStore.id}`)}
            style={{
              minWidth: 200,
              border: '1px solid #007B7F',
              borderRadius: 16,
              background: '#fff',
              cursor: 'pointer',
              boxShadow: '0 4px 8px -1px rgba(0, 123, 127, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              transition: 'all 0.3s ease, transform 0.2s ease',
              overflow: 'hidden'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px -1px rgba(0, 123, 127, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 8px -1px rgba(0, 123, 127, 0.2)';
            }}
          >
            <div style={{ height: 120, overflow: 'hidden', position: 'relative' }}>
              {sellerStore.backgroundImg ? (
                <img 
                  src={sellerStore.backgroundImg} 
                  alt={sellerStore.storeName} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  loading="lazy"
                />
              ) : (
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  background: 'linear-gradient(45deg, #e6f7f8, #dcf2f2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '2rem' }}>🏪</span>
                </div>
              )}
              
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: '#007B7F',
                color: 'white',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
              }}>
                MANAGE
              </div>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1a202c' }}>
                {sellerStore.storeName || 'My Store'}
              </div>
              
              <div style={{ fontSize: '0.875rem', color: '#4a5568', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#007B7F', fontSize: '1rem' }}>📍</span>
                {sellerStore.storeLocation || sellerStore.storeAddress || (
                  <span style={{ 
                    color: '#D92D20', 
                    fontStyle: 'italic',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    Location not set
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Show filtered shops for buyers
        filteredShops.length === 0 ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '3rem 1rem',
            background: '#f8fafc',
            borderRadius: '12px',
            margin: '0 1rem',
            border: '2px dashed #e2e8f0'
          }}>
            <div style={{
              textAlign: 'center',
              color: '#64748b'
        
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
            <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              No stores available
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Check back later for new stores near you
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '0 1rem 1rem' }}>
        {filteredShops.map(shop => {
          // New logic for open/closed status
          const today = daysOfWeek[new Date().getDay()];
          const isClosedToday = shop.closedDays && shop.closedDays.includes(today);
          const todayOpening = shop.openingTimes && shop.openingTimes[today];
          const todayClosing = shop.closingTimes && shop.closingTimes[today];
          
          function isStoreOpenForToday(shop) {
            if (!shop) return false;
            
            const today = daysOfWeek[new Date().getDay()];
            
            // Check if store is closed today
            if (shop.closedDays && shop.closedDays.includes(today)) {
              return false;
            }
            
            // Get today's opening and closing times
            const todayOpening = shop.openingTimes && shop.openingTimes[today];
            const todayClosing = shop.closingTimes && shop.closingTimes[today];
            
            // If no specific times set for today, fall back to general opening/closing times
            const opening = todayOpening || shop.openingTime;
            const closing = todayClosing || shop.closingTime;
            
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
          
          const open = isStoreOpenForToday(shop);
          let distance = null;
          if (userLocation && shop.latitude && shop.longitude) {
            const distanceKm = getDistanceFromLatLonInKm(
              Number(userLocation.lat), Number(userLocation.lng),
              Number(shop.latitude), Number(shop.longitude)
            );
            
            // More accurate distance formatting
            if (distanceKm < 0.01) {
              // For distances less than 10 meters, show as "Here"
              distance = "Here";
            } else if (distanceKm < 0.1) {
              // Convert to yards for very close distances (10m - 100m)
              const distanceYards = Math.round(distanceKm * 1093.61);
              distance = `${distanceYards} yds`;
            } else if (distanceKm < 1) {
              // Show in meters for close distances (100m - 1km)
              distance = `${Math.round(distanceKm * 1000)} m`;
            } else if (distanceKm < 10) {
              // Show 1 decimal place for medium distances (1-10km)
              distance = `${distanceKm.toFixed(1)} km`;
            } else {
              // Round to nearest km for longer distances (10km+)
              distance = `${Math.round(distanceKm)} km`;
            }
          }
          return (
            <div
              key={shop.id}
              onClick={() => {
                handleStoreClick(shop.id);
                navigate(`/store-preview/${shop.id}`);
              }}
              style={{
                minWidth: 260,
                width: '100%',
                height: 320,
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                background: '#fff',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                opacity: open ? 1 : 0.7,
                filter: open ? 'none' : 'grayscale(0.3)',
                transition: 'all 0.3s ease, transform 0.2s ease',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-4px)';
                e.target.style.boxShadow = '0 10px 25px -3px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              }}
            >
              <div style={{ width: '100%', position: 'relative' }}>
                <img
                  src={shop.backgroundImg || 'https://via.placeholder.com/400x200?text=Store+Image'}
                  alt={shop.storeName}
                  style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
                />
                
                <div style={{ 
                  position: 'absolute', 
                  top: 12, 
                  right: 12, 
                  background: 'rgba(255, 255, 255, 0.95)', 
                  backdropFilter: 'blur(8px)',
                  borderRadius: 12, 
                  padding: '4px 8px', 
                  fontWeight: 600, 
                  color: '#007B7F', 
                  fontSize: '0.9rem', 
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  ⭐ {ratings[shop.id]?.avg || '0.0'} ({ratings[shop.id]?.count || 0})
                </div>
                
                <div style={{ 
                  position: 'absolute', 
                  top: 12, 
                  left: 12, 
                  background: isClosedToday ? 'rgba(239, 68, 68, 0.95)' : (open ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)'), 
                  backdropFilter: 'blur(8px)',
                  borderRadius: 12, 
                  padding: '4px 8px', 
                  fontWeight: 600, 
                  color: 'white', 
                  fontSize: '0.9rem', 
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  border: isClosedToday ? '1px solid rgba(239, 68, 68, 0.3)' : (open ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)')
                }}>
                  {isClosedToday ? 'Closed Today' : (open ? 'Open' : 'Closed')}
                </div>
                
                {distance !== null && (
                  <div style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 20,
                    padding: '4px 12px',
                    fontWeight: 600,
                    color: '#007B7F',
                    fontSize: '0.9rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    {distance}
                  </div>
                )}
                
                {!open && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    background: 'rgba(255,255,255,0.8)', 
                    borderRadius: '16px 16px 0 0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700, 
                    fontSize: '1.1rem', 
                    color: '#ef4444', 
                    pointerEvents: 'none',
                    backdropFilter: 'blur(2px)'
                  }}>
                    {isClosedToday ? 'Closed Today' : 'Closed'}
                  </div>
                )}
              </div>
              <div style={{ padding: '1rem', width: '100%' }}>
                <div style={{ 
                  fontWeight: 700, 
                  fontSize: '1.1rem', 
                  color: '#1f2937',
                  marginBottom: '0.5rem',
                  lineHeight: '1.3'
                }}>
                  {shop.storeName}
                </div>
                <div style={{ 
                  fontSize: '0.95rem', 
                  color: '#6b7280',
                  marginBottom: '0.5rem',
                  lineHeight: '1.4',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ color: '#007B7F', fontSize: '1rem' }}>📍</span>
                  {shop.storeLocation || shop.storeAddress || 'Location not set'}
                </div>
                {!isClosedToday && todayOpening && todayClosing && (
                  <div style={{ 
                    fontSize: '0.9rem', 
                    color: '#007B7F', 
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    🕒 {todayOpening} - {todayClosing}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      ))}
      
      {/* Spotlight Store Section */}
      <h2 style={{ 
        margin: '3rem 0 1rem 1rem', 
        color: '#007B7F', 
        fontWeight: '800', 
        fontSize: '1.8rem', 
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)'
      }}>
        ✨ Spotlight Store
        <span style={{ 
          background: '#fff9e6', 
          color: '#FFD700', 
          borderRadius: '12px', 
          padding: '2px 8px', 
          fontSize: '0.9rem',
          fontWeight: '500',
          border: '1px solid #FFD700'
        }}>
          {filteredShops.filter(s => {
            const rating = ratings[s.id];
            return rating && parseFloat(rating.avg) >= 4.8 && rating.count >= 8;
          }).length}
        </span>
      </h2>

      {filteredShops.filter(s => {
        const rating = ratings[s.id];
        return rating && parseFloat(rating.avg) >= 4.8 && rating.count >= 8;
      }).length === 0 ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem 1rem',
          background: '#fffdf0',
          borderRadius: '12px',
          margin: '0 1rem',
          border: '2px dashed #fbbf24'
        }}>
          <div style={{
            textAlign: 'center',
            color: '#a16207'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⭐</div>
            <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              No spotlight stores available
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Stores need 4.8+ stars and 8+ reviews to be featured
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '0 1rem 1rem' }}>
          {filteredShops
            .filter(s => {
              const rating = ratings[s.id];
              return rating && parseFloat(rating.avg) >= 4.8 && rating.count >= 8;
            })
            .sort((a, b) => {
              const ratingA = ratings[a.id];
              const ratingB = ratings[b.id];
              // Sort by rating first (highest first), then by review count (most first)
              if (parseFloat(ratingB.avg) !== parseFloat(ratingA.avg)) {
                return parseFloat(ratingB.avg) - parseFloat(ratingA.avg);
              }
              return ratingB.count - ratingA.count;
            })
            .slice(0, 5)
            .map(shop => {
              // Use the same improved logic
              const today = daysOfWeek[new Date().getDay()];
              const isClosedToday = shop.closedDays && shop.closedDays.includes(today);
              const todayOpening = shop.openingTimes && shop.openingTimes[today];
              const todayClosing = shop.closingTimes && shop.closingTimes[today];
              
              function isStoreOpenForToday(shop) {
                if (!shop) return false;
                
                const today = daysOfWeek[new Date().getDay()];
                
                // Check if store is closed today
                if (shop.closedDays && shop.closedDays.includes(today)) {
                  return false;
                }
                
                // Get today's opening and closing times
                const todayOpening = shop.openingTimes && shop.openingTimes[today];
                const todayClosing = shop.closingTimes && shop.closingTimes[today];
                
                // If no specific times set for today, fall back to general opening/closing times
                const opening = todayOpening || shop.openingTime;
                const closing = todayClosing || shop.closingTime;
                
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
              
              const open = isStoreOpenForToday(shop);
              const storeRating = ratings[shop.id];
              return (
                <div
                  key={shop.id}
                  onClick={() => {
                    handleStoreClick(shop.id);
                    navigate(`/store-preview/${shop.id}`);
                  }}
                  style={{
                    minWidth: 200,
                    border: '2px solid #FFD700',
                    borderRadius: 16,
                    background: '#fffbeb',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    opacity: open ? 1 : 0.7,
                    filter: open ? 'none' : 'grayscale(0.3)',
                    transition: 'all 0.3s ease, transform 0.2s ease',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-4px)';
                    e.target.style.boxShadow = '0 10px 25px -3px rgba(255, 215, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  }}
                >
                  <div style={{ width: '100%', position: 'relative' }}>
                    <img
                      src={shop.backgroundImg}
                      alt={shop.storeName}
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: '16px 16px 0 0' }}
                    />
                    
                    <div style={{ 
                      position: 'absolute', 
                      top: 12, 
                      right: 12, 
                      background: 'rgba(255, 215, 0, 0.95)', 
                      backdropFilter: 'blur(8px)',
                      borderRadius: 12, 
                      padding: '4px 8px', 
                      fontWeight: 600, 
                      color: 'white', 
                      fontSize: '0.9rem', 
                      boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)',
                      border: '1px solid rgba(255, 215, 0, 0.3)'
                    }}>
                      ⭐ {storeRating.avg} ({storeRating.count})
                    </div>
                    
                    <div style={{ 
                      position: 'absolute', 
                      top: 12, 
                      left: 12, 
                      background: isClosedToday ? 'rgba(239, 68, 68, 0.95)' : (open ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)'), 
                      backdropFilter: 'blur(8px)',
                      borderRadius: 12, 
                      padding: '4px 8px', 
                      fontWeight: 600, 
                      color: 'white', 
                      fontSize: '0.9rem', 
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      border: isClosedToday ? '1px solid rgba(239, 68, 68, 0.3)' : (open ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)')
                    }}>
                      {isClosedToday ? 'Closed Today' : (open ? 'Open' : 'Closed')}
                    </div>
                    
                    {/* Spotlight badge */}
                    <div style={{ 
                      position: 'absolute', 
                      bottom: 12, 
                      left: 12, 
                      background: 'linear-gradient(135deg, #FFD700, #FFA500)', 
                      borderRadius: 20, 
                      padding: '6px 12px', 
                      fontWeight: 700, 
                      color: 'white', 
                      fontSize: '0.8rem', 
                      boxShadow: '0 4px 12px rgba(255, 215, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      backdropFilter: 'blur(8px)'
                    }}>
                      ✨ SPOTLIGHT
                    </div>
                    
                    {!open && (
                      <div style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        background: 'rgba(255,255,255,0.8)', 
                        borderRadius: '16px 16px 0 0', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontWeight: 700, 
                        fontSize: '1.1rem', 
                        color: '#ef4444', 
                        pointerEvents: 'none',
                        backdropFilter: 'blur(2px)'
                      }}>
                        {isClosedToday ? 'Closed Today' : 'Closed'}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '1rem', width: '100%' }}>
                    <div style={{ 
                      fontWeight: 700, 
                      fontSize: '1.1rem', 
                      color: '#1f2937',
                      marginBottom: '0.5rem',
                      lineHeight: '1.3'
                    }}>
                      {shop.storeName}
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#6b7280',
                      marginBottom: '0.5rem',
                      lineHeight: '1.4'
                    }}>
                      {shop.storeLocation}
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#FFD700', 
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {parseFloat(storeRating.avg) === 5.0 ? '⭐ Perfect Rating!' : `⭐ ${storeRating.avg} Star Rating`}
                    </div>
                    {!isClosedToday && todayOpening && todayClosing && (
                      <div style={{ 
                        fontSize: '0.9rem', 
                        color: '#007B7F', 
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🕒 {todayOpening} - {todayClosing}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Categories Section - Each category as its own main section - Only shown to buyers */}
      {(userType === 'buyer' || !currentUser) && categories.map(category => {
        const categoryShops = filteredShops.filter(shop => shop.category === category);
        
        return (
          <div key={category} style={{ marginBottom: '3rem' }}>
            <h2 style={{ 
              margin: '3rem 0 1rem 1rem', 
              color: '#007B7F', 
              fontWeight: '800', 
              fontSize: '1.8rem', 
              textAlign: 'left',
              textShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {category === 'Foods & Goods' && '🍎'}
              {category === 'Meat & Poultry' && '🥩'}
              {category === 'Wholesale' && '📦'}
              {category === 'Beauty & Hair' && '💄'}
              {category}
              <span style={{ 
                background: '#f0f9f9', 
                color: '#007B7F', 
                borderRadius: '12px', 
                padding: '2px 8px', 
                fontSize: '0.9rem',
                fontWeight: '500'
              }}>
                {categoryShops.length}
              </span>
            </h2>
            
            {categoryShops.length === 0 ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '3rem 1rem',
                background: '#f8fafc',
                borderRadius: '12px',
                margin: '0 1rem',
                border: '2px dashed #e2e8f0'
              }}>
                <div style={{
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
                  <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                    No stores available
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    Check back later for new stores in this category
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '0 1rem 1rem' }}>
                  {categoryShops.slice(0, 10).map(shop => {
                    // Same logic for open/closed status
                    const today = daysOfWeek[new Date().getDay()];
                    const isClosedToday = shop.closedDays && shop.closedDays.includes(today);
                    const todayOpening = shop.openingTimes && shop.openingTimes[today];
                    const todayClosing = shop.closingTimes && shop.closingTimes[today];
                    
                    function isStoreOpenForToday(shop) {
                      if (!shop) return false;
                      
                      const today = daysOfWeek[new Date().getDay()];
                      
                      // Check if store is closed today
                      if (shop.closedDays && shop.closedDays.includes(today)) {
                        return false;
                      }
                      
                      // Get today's opening and closing times
                      const todayOpening = shop.openingTimes && shop.openingTimes[today];
                      const todayClosing = shop.closingTimes && shop.closingTimes[today];
                      
                      // If no specific times set for today, fall back to general opening/closing times
                      const opening = todayOpening || shop.openingTime;
                      const closing = todayClosing || shop.closingTime;
                      
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
                    
                    const open = isStoreOpenForToday(shop);
                    const storeRating = ratings[shop.id];
                    let distance = null;
                    if (userLocation && shop.latitude && shop.longitude) {
                      const distanceKm = getDistanceFromLatLonInKm(
                        Number(userLocation.lat), Number(userLocation.lng),
                        Number(shop.latitude), Number(shop.longitude)
                      );
                      
                      // More accurate distance formatting
                      if (distanceKm < 0.01) {
                        distance = "Here";
                      } else if (distanceKm < 0.1) {
                        const distanceYards = Math.round(distanceKm * 1093.61);
                        distance = `${distanceYards} yds`;
                      } else if (distanceKm < 1) {
                        distance = `${Math.round(distanceKm * 1000)} m`;
                      } else if (distanceKm < 10) {
                        distance = `${distanceKm.toFixed(1)} km`;
                      } else {
                        distance = `${Math.round(distanceKm)} km`;
                      }
                    }
                    
                    return (
                      <div
                        key={shop.id}
                        onClick={() => handleStoreClick(shop.id)}
                        style={{
                          minWidth: 200,
                          border: '1px solid #e0e0e0',
                          borderRadius: 12,
                          background: '#fff',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative',
                          opacity: open ? 1 : 0.6,
                          transition: 'opacity 0.3s, transform 0.2s, box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                        }}
                      >
                        <div style={{ width: '100%', position: 'relative' }}>
                          <img
                            src={shop.backgroundImg}
                            alt={shop.storeName}
                            style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
                          />
                          <div style={{ 
                            position: 'absolute', 
                            top: 6, 
                            left: 8, 
                            background: isClosedToday ? '#fee2e2' : (open ? '#dcfce7' : '#fee2e2'), 
                            borderRadius: 6, 
                            padding: '2px 8px', 
                            fontWeight: 600, 
                            color: isClosedToday ? '#dc2626' : (open ? '#16a34a' : '#dc2626'), 
                            fontSize: '0.8rem', 
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)' 
                          }}>
                            {isClosedToday ? 'Closed Today' : (open ? 'Open' : 'Closed')}
                          </div>
                          {storeRating && (
                            <div style={{ 
                              position: 'absolute', 
                              top: 6, 
                              right: 8, 
                              background: '#fff', 
                              borderRadius: 6, 
                              padding: '2px 8px', 
                              fontWeight: 600, 
                              color: '#f59e0b', 
                              fontSize: '0.8rem', 
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              ⭐ {storeRating.avg}
                            </div>
                          )}
                          {distance && (
                            <div style={{ 
                              position: 'absolute', 
                              bottom: 6, 
                              right: 8, 
                              background: '#007B7F', 
                              borderRadius: 6, 
                              padding: '2px 8px', 
                              fontWeight: 600, 
                              color: '#fff', 
                              fontSize: '0.8rem', 
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)' 
                            }}>
                              {distance}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '0.75rem', width: '100%' }}>
                          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#222', marginBottom: '4px' }}>
                            {shop.storeName}
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '6px' }}>
                            {shop.storeLocation}
                          </div>
                          {!isClosedToday && todayOpening && todayClosing && (
                            <div style={{ fontSize: '0.85rem', color: '#007B7F', fontWeight: 500 }}>
                              {todayOpening} - {todayClosing}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {categoryShops.length > 10 && (
                  <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                    <button
                      onClick={() => {
                        setSelectedCategory(category);
                        setSearchTerm('');
                        setFilterBy('');
                        setSortBy('');
                        // Scroll to top to show filtered results
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        background: '#007B7F',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#006666'}
                      onMouseLeave={(e) => e.target.style.background = '#007B7F'}
                    >
                      View All {category} ({categoryShops.length})
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ExplorePage;