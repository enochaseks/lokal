import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useCart } from '../CartContext';

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
  
  // Quick pay states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState({
    subtotal: 0,
    deliveryFee: 0,
    serviceFee: 0,
    total: 0,
    currency: 'GBP',
    item: null
  });
  
  // Card form states
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    billingAddress: {
      address1: '',
      address2: '',
      city: '',
      state: '',
      postalCode: '',
      country: ''
    }
  });
  const [cardErrors, setCardErrors] = useState({});
  const [showCardForm, setShowCardForm] = useState(false);
  
  // Store fee settings
  const [storeFeeSettings, setStoreFeeSettings] = useState({
    deliveryEnabled: false,
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    serviceFeeEnabled: false,
    serviceFeeType: 'percentage',
    serviceFeeRate: 2.5,
    serviceFeeAmount: 0,
    serviceFeeMax: 0
  });

  // Only declare daysOfWeek ONCE at the top of the file
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Payment methods by region/currency
  const getPaymentMethods = (currency) => {
    const baseMethods = [
      { id: 'card', name: 'Credit/Debit Card', icon: '💳', description: 'Visa, Mastercard, American Express' }
    ];

    switch (currency) {
      case 'USD':
        return [
          ...baseMethods,
          { id: 'apple_pay', name: 'Apple Pay', icon: '🍎', description: 'Quick and secure' },
          { id: 'google_pay', name: 'Google Pay', icon: '📱', description: 'Pay with Google' },
          { id: 'paypal', name: 'PayPal', icon: '🅿️', description: 'PayPal wallet' },
          { id: 'venmo', name: 'Venmo', icon: '💙', description: 'Social payments' }
        ];
      case 'GBP':
        return [
          ...baseMethods,
          { id: 'apple_pay', name: 'Apple Pay', icon: '🍎', description: 'Quick and secure' },
          { id: 'google_pay', name: 'Google Pay', icon: '📱', description: 'Pay with Google' },
          { id: 'paypal', name: 'PayPal', icon: '🅿️', description: 'PayPal wallet' }
        ];
      case 'NGN':
        return [
          ...baseMethods,
          { id: 'flutterwave', name: 'Flutterwave', icon: '🦋', description: 'Bank transfer, cards' },
          { id: 'paystack', name: 'Paystack', icon: '📊', description: 'Popular in Nigeria' }
        ];
      default:
        return baseMethods;
    }
  };

  // Card validation functions
  const formatCardNumber = (value) => {
    // Remove all non-digits
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    // Add spaces every 4 digits
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const validateCard = () => {
    const errors = {};
    
    // Card number validation
    const cardNumber = cardForm.cardNumber.replace(/\s/g, '');
    if (!cardNumber) {
      errors.cardNumber = 'Card number is required';
    } else if (cardNumber.length < 13 || cardNumber.length > 19) {
      errors.cardNumber = 'Please enter a valid card number';
    } else if (!luhnCheck(cardNumber)) {
      errors.cardNumber = 'Please enter a valid card number';
    }

    // Expiry date validation
    if (!cardForm.expiryDate) {
      errors.expiryDate = 'Expiry date is required';
    } else {
      const [month, year] = cardForm.expiryDate.split('/');
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear() % 100;
      const currentMonth = currentDate.getMonth() + 1;
      
      if (!month || !year || month < 1 || month > 12) {
        errors.expiryDate = 'Please enter a valid expiry date';
      } else if (parseInt(year) < currentYear || (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
        errors.expiryDate = 'Card has expired';
      }
    }

    // CVV validation
    if (!cardForm.cvv) {
      errors.cvv = 'CVV is required';
    } else if (cardForm.cvv.length < 3 || cardForm.cvv.length > 4) {
      errors.cvv = 'Please enter a valid CVV';
    }

    // Cardholder name validation
    if (!cardForm.cardholderName.trim()) {
      errors.cardholderName = 'Cardholder name is required';
    }

    // Billing address validation (basic)
    if (!cardForm.billingAddress.address1.trim()) {
      errors.address1 = 'Address is required';
    }
    if (!cardForm.billingAddress.city.trim()) {
      errors.city = 'City is required';
    }
    if (!cardForm.billingAddress.postalCode.trim()) {
      errors.postalCode = 'Postal code is required';
    }
    if (!cardForm.billingAddress.country.trim()) {
      errors.country = 'Country is required';
    }

    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Luhn algorithm for card validation
  const luhnCheck = (cardNumber) => {
    let sum = 0;
    let alternate = false;
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let n = parseInt(cardNumber.charAt(i), 10);
      if (alternate) {
        n *= 2;
        if (n > 9) {
          n = (n % 10) + 1;
        }
      }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 === 0;
  };

  // Get card type from number
  const getCardType = (cardNumber) => {
    const number = cardNumber.replace(/\s/g, '');
    if (/^4/.test(number)) return 'Visa';
    if (/^5[1-5]/.test(number)) return 'Mastercard';
    if (/^3[47]/.test(number)) return 'American Express';
    if (/^6/.test(number)) return 'Discover';
    return 'Unknown';
  };

  // Handle card form input changes
  const handleCardInputChange = (field, value) => {
    let formattedValue = value;
    
    if (field === 'cardNumber') {
      formattedValue = formatCardNumber(value);
    } else if (field === 'expiryDate') {
      formattedValue = formatExpiryDate(value);
    } else if (field === 'cvv') {
      formattedValue = value.replace(/\D/g, '').substring(0, 4);
    } else if (field === 'cardholderName') {
      formattedValue = value.replace(/[^a-zA-Z\s]/g, '');
    }

    if (field.startsWith('billingAddress.')) {
      const addressField = field.split('.')[1];
      setCardForm(prev => ({
        ...prev,
        billingAddress: {
          ...prev.billingAddress,
          [addressField]: formattedValue
        }
      }));
    } else {
      setCardForm(prev => ({
        ...prev,
        [field]: formattedValue
      }));
    }

    // Clear specific error when user starts typing
    if (cardErrors[field] || cardErrors[field.split('.')[1]]) {
      setCardErrors(prev => ({
        ...prev,
        [field]: undefined,
        [field.split('.')[1]]: undefined
      }));
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user || null);
      if (user) {
        try {
          // Check if user is a buyer or seller
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserType('buyer');
            
            // Add this store to viewed stores for buyers only
            if (id) {
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
              
              console.log('Saved viewed store from StorePreviewPage:', id, 'for user:', user.uid);
            }
          } else {
            setUserType('seller');
          }
        } catch (error) {
          console.error('Error checking user type:', error);
          setUserType('');
        }
      } else {
        setUserType('');
      }
    });
    return () => unsubscribe();
  }, [id]); // Add id as dependency

  useEffect(() => {
    setLoading(true);
    const unsubStore = onSnapshot(doc(db, 'stores', id), (docSnap) => {
      if (docSnap.exists()) {
        setStore(docSnap.data());
      } else {
        setStore(null);
      }
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

  // Load store fee settings with real-time updates
  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(doc(db, 'stores', id), (docSnap) => {
      if (docSnap.exists()) {
        const storeData = docSnap.data();
        console.log('Store data updated:', storeData);
        
        if (storeData.feeSettings) {
          console.log('Fee settings found:', storeData.feeSettings);
          setStoreFeeSettings(storeData.feeSettings);
        } else {
          console.log('No fee settings found in store data, using defaults');
          // Set default values if no settings found
          setStoreFeeSettings({
            deliveryEnabled: false,
            deliveryFee: 0,
            freeDeliveryThreshold: 0,
            serviceFeeEnabled: false,
            serviceFeeType: 'percentage',
            serviceFeeRate: 2.5,
            serviceFeeAmount: 0,
            serviceFeeMax: 0
          });
        }
      } else {
        console.log('Store document does not exist');
        // Set default values if store doesn't exist
        setStoreFeeSettings({
          deliveryEnabled: false,
          deliveryFee: 0,
          freeDeliveryThreshold: 0,
          serviceFeeEnabled: false,
          serviceFeeType: 'percentage',
          serviceFeeRate: 2.5,
          serviceFeeAmount: 0,
          serviceFeeMax: 0
        });
      }
    }, (error) => {
      console.error('Error loading store data:', error);
      // Set default values on error
      setStoreFeeSettings({
        deliveryEnabled: false,
        deliveryFee: 0,
        freeDeliveryThreshold: 0,
        serviceFeeEnabled: false,
        serviceFeeType: 'percentage',
        serviceFeeRate: 2.5,
        serviceFeeAmount: 0,
        serviceFeeMax: 0
      });
    });

    return () => unsubscribe();
  }, [id]);

  // Check if already following
  useEffect(() => {
    if (!authUser || !id) return;
    const followerRef = doc(db, 'stores', id, 'followers', authUser.uid);
    const unsub = onSnapshot(followerRef, (docSnap) => {
      setFollowing(docSnap.exists());
    });
    return () => unsub();
  }, [authUser, id]);

  // Add useEffect to load and calculate ratings with enhanced user data fetching
  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(collection(db, 'stores', id, 'reviews'), async (querySnapshot) => {
      const reviewsData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      // Fetch current user data for each review
      const reviewsWithCurrentUserData = await Promise.all(
        reviewsData.map(async (review) => {
          try {
            // Try to fetch current user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', review.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                ...review,
                userName: userData.name || userData.displayName || review.userName || 'Anonymous',
                userPhoto: userData.photoURL || userData.profilePicture || review.userPhoto || null
              };
            }
            // If user document doesn't exist, keep original review data
            return review;
          } catch (error) {
            console.error('Error fetching user data for review:', error);
            // If there's an error, keep original review data
            return review;
          }
        })
      );
      
      setReviews(reviewsWithCurrentUserData);
      
      // Calculate average rating and count
      if (reviewsData.length > 0) {
        const totalRating = reviewsData.reduce((sum, review) => sum + (review.rating || 0), 0);
        const avgRating = (totalRating / reviewsData.length).toFixed(1);
        setAvgRating(parseFloat(avgRating));
        setRatingCount(reviewsData.length);
      } else {
        setAvgRating(0);
        setRatingCount(0);
      }
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

  const handleSendMessage = () => {
    setMessageSent(true);
    setTimeout(() => setMessageSent(false), 2000);
    setMessage('');
    // Here you would send the message to the seller (not implemented)
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

  // Quick pay handler
  const handleQuickPay = async (item) => {
    if (!authUser) {
      alert('Please log in to make a purchase');
      return;
    }

    // Calculate payment details for single item
    const subtotal = parseFloat(item.price);
    let deliveryFee = 0;
    let serviceFee = 0;

    // Apply store fee settings
    // For collection/pay at store, only apply service fee (no delivery fee)
    if (store.deliveryType !== 'Collection' && store.deliveryType !== 'Pay at Store') {
      if (storeFeeSettings.deliveryEnabled && subtotal < storeFeeSettings.freeDeliveryThreshold) {
        deliveryFee = storeFeeSettings.deliveryFee;
      }
    }

    if (storeFeeSettings.serviceFeeEnabled) {
      if (storeFeeSettings.serviceFeeType === 'percentage') {
        serviceFee = (subtotal * storeFeeSettings.serviceFeeRate) / 100;
        if (storeFeeSettings.serviceFeeMax > 0) {
          serviceFee = Math.min(serviceFee, storeFeeSettings.serviceFeeMax);
        }
      } else {
        serviceFee = storeFeeSettings.serviceFeeAmount;
      }
    }

    const total = subtotal + deliveryFee + serviceFee;

    setPaymentData({
      subtotal,
      deliveryFee,
      serviceFee,
      total,
      currency: item.currency,
      item: {
        ...item,
        quantity: 1,
        storeId: id,
        storeName: store.storeName
      }
    });
    setSelectedPaymentMethod('');
    setShowPaymentModal(true);
  };

  // Process payment
  const processPayment = async () => {
    if (!selectedPaymentMethod) {
      alert('Please select a payment method');
      return;
    }

    // Validate card details if card payment is selected
    if (selectedPaymentMethod === 'card') {
      if (!validateCard()) {
        alert('Please fill in all required card details correctly');
        return;
      }
    }

    setPaymentProcessing(true);
    
    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create order record (never store actual card details)
      await addDoc(collection(db, 'orders'), {
        buyerId: authUser.uid,
        buyerEmail: authUser.email,
        storeId: id,
        storeName: store.storeName,
        items: [paymentData.item],
        subtotal: paymentData.subtotal,
        deliveryFee: paymentData.deliveryFee,
        serviceFee: paymentData.serviceFee,
        total: paymentData.total,
        currency: paymentData.currency,
        paymentMethod: selectedPaymentMethod,
        // Store only masked card info for display purposes
        paymentDetails: selectedPaymentMethod === 'card' ? {
          cardType: getCardType(cardForm.cardNumber),
          lastFourDigits: cardForm.cardNumber.replace(/\s/g, '').slice(-4),
          cardholderName: cardForm.cardholderName
        } : null,
        status: 'paid',
        createdAt: serverTimestamp()
      });

      alert(`Payment successful! You've purchased ${paymentData.item.name} for ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}`);
      
      // Reset forms
      setCardForm({
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: '',
        billingAddress: {
          address1: '',
          address2: '',
          city: '',
          state: '',
          postalCode: '',
          country: ''
        }
      });
      setCardErrors({});
      setShowCardForm(false);
      setShowPaymentModal(false);
      
    } catch (error) {
      console.error('Payment failed:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setPaymentProcessing(false);
    }
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

  if (loading) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', marginTop: 80 }}>Loading store...</div>
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
            <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>{store.storeName}</div>
            <div style={{ color: '#444', fontSize: '1rem' }}>{store.storeLocation}</div>
            <div style={{ color: '#007B7F', fontSize: '1rem' }}>
              ⭐ {avgRating > 0 ? avgRating : 'No ratings'} {ratingCount > 0 && `(${ratingCount} review${ratingCount !== 1 ? 's' : ''})`}
            </div>
            <div style={{ color: '#444', fontSize: '1.05rem', marginTop: 4 }}><b>Origin:</b> {store.origin}</div>
            <div style={{ color: '#007B7F', fontSize: '1.05rem', marginTop: 2 }}><b>Delivery Type:</b> {store.deliveryType}</div>
            
            {/* Display fee information */}
            {console.log('Current storeFeeSettings:', storeFeeSettings, 'deliveryEnabled:', storeFeeSettings.deliveryEnabled, 'serviceFeeEnabled:', storeFeeSettings.serviceFeeEnabled)}
            {(storeFeeSettings.deliveryEnabled || storeFeeSettings.serviceFeeEnabled) && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0f9ff', borderRadius: 6, fontSize: '0.9rem' }}>
                <div style={{ fontWeight: 600, color: '#007B7F', marginBottom: 4 }}>📋 Store Fees:</div>
                {storeFeeSettings.deliveryEnabled && (
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
          {userType === 'buyer' && !isStoreOwner && (
            <div className="store-action-buttons">
              {following ? (
                <button onClick={handleUnfollow} style={{ background: '#ccc', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginRight: 8, cursor: 'pointer' }}>
                  Unfollow
                </button>
              ) : (
                <button onClick={handleFollow} style={{ background: '#D92D20', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginRight: 8, cursor: 'pointer' }}>
                  Follow
                </button>
              )}
              <button onClick={handleSendMessage} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                Message
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
                  {/* Only show these buttons for buyers/customers who are not the store owner */}
                  {userType === 'buyer' && !isStoreOwner && storeIsOpen && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => handleAddToCart(item)}
                      >
                        Add to Cart
                      </button>
                      <button
                        style={{ background: '#FF6B35', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => handleQuickPay(item)}
                      >
                        Quick Pay
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

            {/* Only show review form for buyers who are not the store owner */}
            {userType === 'buyer' && !isStoreOwner && (
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

      {/* Payment Modal */}
      {showPaymentModal && (
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
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: '2rem',
            maxWidth: 500,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: '#007B7F' }}>Quick Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Order Summary */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#374151' }}>Order Summary</h4>
              {paymentData.item && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {paymentData.item.image && (
                    <img src={paymentData.item.image} alt={paymentData.item.name} 
                         style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{paymentData.item.name}</div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>
                      {getCurrencySymbol(paymentData.currency)}{formatPrice(paymentData.item.price, paymentData.currency)} × 1
                    </div>
                  </div>
                </div>
              )}
              
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Subtotal:</span>
                  <span>{getCurrencySymbol(paymentData.currency)}{formatPrice(paymentData.subtotal, paymentData.currency)}</span>
                </div>
                {paymentData.deliveryFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#666' }}>
                    <span>Delivery Fee:</span>
                    <span>{getCurrencySymbol(paymentData.currency)}{formatPrice(paymentData.deliveryFee, paymentData.currency)}</span>
                  </div>
                )}
                {paymentData.serviceFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#666' }}>
                    <span>Service Fee:</span>
                    <span>{getCurrencySymbol(paymentData.currency)}{formatPrice(paymentData.serviceFee, paymentData.currency)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '1.1rem', borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 8 }}>
                  <span>Total:</span>
                  <span style={{ color: '#007B7F' }}>{getCurrencySymbol(paymentData.currency)}{formatPrice(paymentData.total, paymentData.currency)}</span>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#374151' }}>Choose Payment Method</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {getPaymentMethods(paymentData.currency).map(method => (
                  <label key={method.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px',
                    border: `2px solid ${selectedPaymentMethod === method.id ? '#007B7F' : '#e5e7eb'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={selectedPaymentMethod === method.id}
                      onChange={(e) => {
                        setSelectedPaymentMethod(e.target.value);
                        setShowCardForm(e.target.value === 'card');
                      }}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontSize: '1.5rem' }}>{method.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{method.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>{method.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Card Details Form */}
            {showCardForm && selectedPaymentMethod === 'card' && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#374151' }}>Card Details</h4>
                
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {/* Card Number */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                      Card Number *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={cardForm.cardNumber}
                        onChange={(e) => handleCardInputChange('cardNumber', e.target.value)}
                        placeholder="1234 5678 9012 3456"
                        maxLength="19"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: `1px solid ${cardErrors.cardNumber ? '#ef4444' : '#d1d5db'}`,
                          borderRadius: '6px',
                          fontSize: '1rem',
                          fontFamily: 'monospace',
                          letterSpacing: '0.1em'
                        }}
                      />
                      {cardForm.cardNumber && (
                        <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: '#666' }}>
                          {getCardType(cardForm.cardNumber)}
                        </div>
                      )}
                    </div>
                    {cardErrors.cardNumber && (
                      <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {cardErrors.cardNumber}
                      </div>
                    )}
                  </div>

                  {/* Expiry Date and CVV */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                        Expiry Date *
                      </label>
                      <input
                        type="text"
                        value={cardForm.expiryDate}
                        onChange={(e) => handleCardInputChange('expiryDate', e.target.value)}
                        placeholder="MM/YY"
                        maxLength="5"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: `1px solid ${cardErrors.expiryDate ? '#ef4444' : '#d1d5db'}`,
                          borderRadius: '6px',
                          fontSize: '1rem',
                          fontFamily: 'monospace'
                        }}
                      />
                      {cardErrors.expiryDate && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          {cardErrors.expiryDate}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                        CVV *
                      </label>
                      <input
                        type="password"
                        value={cardForm.cvv}
                        onChange={(e) => handleCardInputChange('cvv', e.target.value)}
                        placeholder="123"
                        maxLength="4"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: `1px solid ${cardErrors.cvv ? '#ef4444' : '#d1d5db'}`,
                          borderRadius: '6px',
                          fontSize: '1rem',
                          fontFamily: 'monospace'
                        }}
                      />
                      {cardErrors.cvv && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          {cardErrors.cvv}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cardholder Name */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                      Cardholder Name *
                    </label>
                    <input
                      type="text"
                      value={cardForm.cardholderName}
                      onChange={(e) => handleCardInputChange('cardholderName', e.target.value)}
                      placeholder="John Doe"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${cardErrors.cardholderName ? '#ef4444' : '#d1d5db'}`,
                        borderRadius: '6px',
                        fontSize: '1rem',
                        textTransform: 'uppercase'
                      }}
                    />
                    {cardErrors.cardholderName && (
                      <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {cardErrors.cardholderName}
                      </div>
                    )}
                  </div>

                  {/* Billing Address */}
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                    <h5 style={{ margin: '0 0 1rem 0', color: '#374151' }}>Billing Address</h5>
                    
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                          Address Line 1 *
                        </label>
                        <input
                          type="text"
                          value={cardForm.billingAddress.address1}
                          onChange={(e) => handleCardInputChange('billingAddress.address1', e.target.value)}
                          placeholder="123 Main Street"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${cardErrors.address1 ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '1rem'
                          }}
                        />
                        {cardErrors.address1 && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {cardErrors.address1}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                          Address Line 2
                        </label>
                        <input
                          type="text"
                          value={cardForm.billingAddress.address2}
                          onChange={(e) => handleCardInputChange('billingAddress.address2', e.target.value)}
                          placeholder="Apartment, suite, etc. (optional)"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '1rem'
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                            City *
                          </label>
                          <input
                            type="text"
                            value={cardForm.billingAddress.city}
                            onChange={(e) => handleCardInputChange('billingAddress.city', e.target.value)}
                            placeholder="London"
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: `1px solid ${cardErrors.city ? '#ef4444' : '#d1d5db'}`,
                              borderRadius: '6px',
                              fontSize: '1rem'
                            }}
                          />
                          {cardErrors.city && (
                            <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                              {cardErrors.city}
                            </div>
                          )}
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                            State/Province
                          </label>
                          <input
                            type="text"
                            value={cardForm.billingAddress.state}
                            onChange={(e) => handleCardInputChange('billingAddress.state', e.target.value)}
                            placeholder="Optional"
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '1rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                            Postal Code *
                          </label>
                          <input
                            type="text"
                            value={cardForm.billingAddress.postalCode}
                            onChange={(e) => handleCardInputChange('billingAddress.postalCode', e.target.value)}
                            placeholder="SW1A 1AA"
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: `1px solid ${cardErrors.postalCode ? '#ef4444' : '#d1d5db'}`,
                              borderRadius: '6px',
                              fontSize: '1rem',
                              textTransform: 'uppercase'
                            }}
                          />
                          {cardErrors.postalCode && (
                            <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                              {cardErrors.postalCode}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                          Country *
                        </label>
                        <select
                          value={cardForm.billingAddress.country}
                          onChange={(e) => handleCardInputChange('billingAddress.country', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${cardErrors.country ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '1rem',
                            backgroundColor: '#fff'
                          }}
                        >
                          <option value="">Select Country</option>
                          <option value="GB">United Kingdom</option>
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                          <option value="AU">Australia</option>
                          <option value="NG">Nigeria</option>
                          <option value="GH">Ghana</option>
                          <option value="KE">Kenya</option>
                          <option value="ZA">South Africa</option>
                          <option value="IN">India</option>
                          <option value="DE">Germany</option>
                          <option value="FR">France</option>
                          <option value="IT">Italy</option>
                          <option value="ES">Spain</option>
                          <option value="NL">Netherlands</option>
                          <option value="JP">Japan</option>
                          <option value="CN">China</option>
                        </select>
                        {cardErrors.country && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {cardErrors.country}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Button */}
            <button
              onClick={processPayment}
              disabled={!selectedPaymentMethod || paymentProcessing}
              style={{
                width: '100%',
                background: !selectedPaymentMethod || paymentProcessing ? '#ccc' : '#007B7F',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '1rem',
                fontSize: '1.1rem',
                fontWeight: 600,
                cursor: !selectedPaymentMethod || paymentProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              {paymentProcessing ? 'Processing...' : `Pay ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StorePreviewPage;