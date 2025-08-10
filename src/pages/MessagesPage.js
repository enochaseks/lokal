import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripePaymentForm from '../components/StripePaymentForm';
import StripeApplePayButton from '../components/StripeApplePayButton';

function MessagesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('messages');
  
  // Stripe Promise
  const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
  
  const [search, setSearch] = useState('');
  const [isSeller, setIsSeller] = useState(false);
  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState({
    balance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
    transactions: []
  });
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Messaging states
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Store items states
  const [showStoreItems, setShowStoreItems] = useState(false);
  const [storeItems, setStoreItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [storeInfo, setStoreInfo] = useState(null);

  // Cart states
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  
  // Collapsible sections state
  const [cartSectionsCollapsed, setCartSectionsCollapsed] = useState({
    items: false,
    calculation: false
  });
  
  // Order workflow states
  const [orderStatus, setOrderStatus] = useState('shopping'); // 'shopping', 'done_adding', 'bagging', 'ready_for_payment', 'completed'
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [persistedOrderItems, setPersistedOrderItems] = useState([]);
  
  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState({
    subtotal: 0,
    deliveryFee: 0,
    serviceFee: 0,
    total: 0,
    currency: 'GBP',
    orderId: null
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
  
  // Apple Pay states
  const [showApplePayModal, setShowApplePayModal] = useState(false);
  const [applePayProcessing, setApplePayProcessing] = useState(false);
  const [applePayStep, setApplePayStep] = useState('auth'); // 'auth', 'processing', 'success'
  
  // Fee settings states (for sellers)
  const [showFeeSettings, setShowFeeSettings] = useState(false);
  const [feeSettings, setFeeSettings] = useState({
    deliveryEnabled: false,
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    serviceFeeEnabled: false,
    serviceFeeType: 'percentage', // 'percentage' or 'fixed'
    serviceFeeRate: 2.5, // percentage
    serviceFeeAmount: 0, // fixed amount
    serviceFeeMax: 0 // max cap for percentage
  });

  // Delivery states
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showDeliveryConfirmModal, setShowDeliveryConfirmModal] = useState(false);
  const [pendingDeliveryOrder, setPendingDeliveryOrder] = useState(null);
  const [deliverySettings, setDeliverySettings] = useState({
    deliveryType: 'immediate', // 'immediate', 'scheduled', 'next_day'
    scheduledDate: '',
    scheduledTime: '',
    timeSlot: 'morning', // 'morning', 'afternoon', 'evening'
    deliveryAddress: '',
    specialInstructions: ''
  });
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState(null);

  // Store operating hours (you can make this configurable per store)
  const storeHours = {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: { open: '10:00', close: '16:00' },
    sunday: { open: '11:00', close: '15:00' }
  };

  // Delivery pricing for next day delivery
  const deliveryPricing = {
    morning: 1.50,   // 9:00-12:00
    afternoon: 3.90, // 12:00-17:00
    evening: 5.60    // 17:00-20:00
  };

  // Currency symbols
  const currencySymbols = {
    GBP: "£", USD: "$", EUR: "€", NGN: "₦", CAD: "C$", AUD: "A$",
    ZAR: "R", GHS: "₵", KES: "KSh", XOF: "CFA", XAF: "CFA",
    INR: "₹", JPY: "¥", CNY: "¥"
  };

  const getCurrencySymbol = (code) => currencySymbols[code] || code;
  const currenciesWithDecimals = ["GBP", "USD", "EUR", "CAD", "AUD", "ZAR", "GHS", "KES", "INR", "CNY"];

  const formatPrice = (price, currency) => {
    if (currenciesWithDecimals.includes(currency)) {
      return Number(price).toFixed(2);
    }
    return price;
  };

  // Payment methods by region/currency
  const getPaymentMethods = (currency) => {
    const baseMethods = [
      { id: 'card', name: 'Credit/Debit Card', icon: '💳', description: 'Visa, Mastercard, American Express' }
    ];

    switch (currency) {
      case 'USD':
        return [
          ...baseMethods,
          { id: 'apple_pay', name: 'Apple Pay', icon: '🍎', description: 'Quick and secure payment' },
          { id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' },
          { id: 'paypal', name: 'PayPal', icon: '💙', description: 'Pay with PayPal balance or card' },
          { id: 'venmo', name: 'Venmo', icon: '📱', description: 'Split with friends' }
        ];
      case 'GBP':
        return [
          ...baseMethods,
          { id: 'apple_pay', name: 'Apple Pay', icon: '🍎', description: 'Quick and secure payment' },
          { id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' },
          { id: 'paypal', name: 'PayPal', icon: '💙', description: 'Pay with PayPal balance or card' },
          { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Direct bank transfer' }
        ];
      case 'EUR':
        return [
          ...baseMethods,
          { id: 'apple_pay', name: 'Apple Pay', icon: '🍎', description: 'Quick and secure payment' },
          { id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' },
          { id: 'paypal', name: 'PayPal', icon: '💙', description: 'Pay with PayPal balance or card' },
          { id: 'sepa', name: 'SEPA Transfer', icon: '🏦', description: 'European bank transfer' },
          { id: 'klarna', name: 'Klarna', icon: '🛡️', description: 'Buy now, pay later' }
        ];
      case 'NGN':
        return [
          ...baseMethods,
          { id: 'flutterwave', name: 'Flutterwave', icon: '💳', description: 'Pay with Flutterwave' },
          { id: 'paystack', name: 'Paystack', icon: '⚡', description: 'Quick Nigerian payments' },
          { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Nigerian bank transfer' },
          { id: 'ussd', name: 'USSD', icon: '📞', description: 'Dial *code# to pay' }
        ];
      case 'KES':
        return [
          ...baseMethods,
          { id: 'mpesa', name: 'M-Pesa', icon: '📱', description: 'Kenya mobile money' },
          { id: 'airtel_money', name: 'Airtel Money', icon: '📲', description: 'Airtel mobile money' },
          { id: 'flutterwave', name: 'Flutterwave', icon: '💳', description: 'Pay with Flutterwave' }
        ];
      case 'GHS':
        return [
          ...baseMethods,
          { id: 'momo', name: 'Mobile Money', icon: '📱', description: 'MTN, Vodafone, AirtelTigo' },
          { id: 'flutterwave', name: 'Flutterwave', icon: '💳', description: 'Pay with Flutterwave' },
          { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Ghana bank transfer' }
        ];
      case 'ZAR':
        return [
          ...baseMethods,
          { id: 'payfast', name: 'PayFast', icon: '⚡', description: 'South African payments' },
          { id: 'eft', name: 'EFT', icon: '🏦', description: 'Electronic funds transfer' },
          { id: 'instant_eft', name: 'Instant EFT', icon: '⚡', description: 'Instant bank payment' }
        ];
      case 'INR':
        return [
          ...baseMethods,
          { id: 'upi', name: 'UPI', icon: '📱', description: 'PhonePe, GPay, Paytm' },
          { id: 'razorpay', name: 'Razorpay', icon: '💙', description: 'Multiple payment options' },
          { id: 'paytm', name: 'Paytm', icon: '💳', description: 'Paytm wallet & more' },
          { id: 'netbanking', name: 'Net Banking', icon: '🏦', description: 'All major banks' }
        ];
      case 'CNY':
        return [
          ...baseMethods,
          { id: 'alipay', name: 'Alipay', icon: '💙', description: 'Ant Financial payment' },
          { id: 'wechat_pay', name: 'WeChat Pay', icon: '💬', description: 'Tencent mobile payment' },
          { id: 'unionpay', name: 'UnionPay', icon: '🏦', description: 'China UnionPay cards' }
        ];
      case 'JPY':
        return [
          ...baseMethods,
          { id: 'apple_pay', name: 'Apple Pay', icon: '🍎', description: 'Quick and secure payment' },
          { id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' },
          { id: 'konbini', name: 'Konbini', icon: '🏪', description: 'Pay at convenience store' },
          { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Japanese bank transfer' }
        ];
      default:
        return [
          ...baseMethods,
          { id: 'apple_pay', name: 'Apple Pay', icon: '🍎', description: 'Quick and secure payment' },
          { id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' },
          { id: 'paypal', name: 'PayPal', icon: '💙', description: 'Pay with PayPal balance or card' }
        ];
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

  // Toggle collapse state for cart sections
  const toggleCartSection = (section) => {
    setCartSectionsCollapsed(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const storeDocRef = doc(db, 'stores', user.uid);
          const storeDocSnap = await getDoc(storeDocRef);
          setIsSeller(storeDocSnap.exists());
          
          // Check for persisted order state
          const orderStateDocRef = doc(db, 'orderStates', user.uid);
          const orderStateSnap = await getDoc(orderStateDocRef);
          if (orderStateSnap.exists()) {
            const orderState = orderStateSnap.data();
            setOrderStatus(orderState.status || 'shopping');
            setCurrentOrderId(orderState.orderId || null);
            setPersistedOrderItems(orderState.items || []);
            
            // If user had items locked, clear the cart but keep the persisted items
            if (orderState.status === 'done_adding' || orderState.status === 'bagging') {
              setCart([]);
            }
          }
        } catch (error) {
          console.error('Error checking seller status:', error);
          setIsSeller(false);
        }
      } else {
        setIsSeller(false);
        setOrderStatus('shopping');
        setCurrentOrderId(null);
        setPersistedOrderItems([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle navigation state (for wallet tab redirect)
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Clear the state after using it
      window.history.replaceState(null, '');
    }
  }, [location.state]);

  // Fetch conversations
  useEffect(() => {
    if (!currentUser) return;

    // For sellers, we need to fetch both sent and received messages to see all conversations
    const messagesQuery = isSeller 
      ? query(
          collection(db, 'messages'),
          orderBy('timestamp', 'desc')
        )
      : query(
          collection(db, 'messages'),
          where('senderId', '==', currentUser.uid),
          orderBy('timestamp', 'desc')
        );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const conversationMap = new Map();
      
      snapshot.docs.forEach(doc => {
        const message = { id: doc.id, ...doc.data() };
        
        // For sellers, include conversations where they are either sender or receiver
        // For customers, only include conversations where they are the sender
        let shouldInclude = false;
        let otherUserId, otherUserName, otherUserEmail, conversationId;
        
        if (isSeller) {
          if (message.receiverId === currentUser.uid) {
            // Seller receiving a message (customer to seller)
            shouldInclude = true;
            otherUserId = message.senderId;
            otherUserName = message.senderName;
            otherUserEmail = message.senderEmail;
            conversationId = message.conversationId;
          } else if (message.senderId === currentUser.uid) {
            // Seller sending a message (seller to customer)
            shouldInclude = true;
            otherUserId = message.receiverId;
            otherUserName = message.receiverName;
            otherUserEmail = message.receiverEmail;
            conversationId = message.conversationId;
          }
        } else {
          // Customer logic (unchanged)
          if (message.senderId === currentUser.uid) {
            shouldInclude = true;
            otherUserId = message.receiverId;
            otherUserName = message.receiverName;
            otherUserEmail = message.receiverEmail;
            conversationId = message.conversationId;
          }
        }
        
        if (shouldInclude) {
          // Always update or create the conversation with the latest message details
          const existingConversation = conversationMap.get(conversationId);
          
          // Only update if this message is newer than the existing one, or if conversation doesn't exist
          if (!existingConversation || 
              !existingConversation.lastMessageTime || 
              message.timestamp > existingConversation.lastMessageTime) {
            conversationMap.set(conversationId, {
              id: conversationId,
              otherUserId,
              otherUserName,
              otherUserEmail,
              lastMessage: message.message,
              lastMessageTime: message.timestamp,
              isRead: message.isRead,
              messageType: message.messageType
            });
          }
        }
      });

      setConversations(Array.from(conversationMap.values()));
    }, (error) => {
      console.error('Error fetching conversations:', error);
    });

    return () => unsubscribe();
  }, [currentUser, isSeller]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation || !currentUser) return;

    setLoadingMessages(true);
    
    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', selectedConversation.id),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messagesList);
      setLoadingMessages(false);

      // Mark messages as read if they are received by current user
      snapshot.docs.forEach(doc => {
        const message = doc.data();
        if (!message.isRead && message.receiverId === currentUser.uid) {
          updateDoc(doc.ref, { isRead: true }).catch(error => {
            console.error('Error marking message as read:', error);
          });
        }
      });
    }, (error) => {
      console.error('Error fetching messages:', error);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [selectedConversation, currentUser]);

  // Fetch store info when conversation is selected (for displaying correct email)
  useEffect(() => {
    if (!selectedConversation || isSeller) return;

    const fetchStoreInfo = async () => {
      try {
        const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
        if (storeDoc.exists()) {
          setStoreInfo(storeDoc.data());
        }
      } catch (error) {
        console.error('Error fetching store info:', error);
      }
    };

    fetchStoreInfo();
  }, [selectedConversation, isSeller]);

  // Fetch store items and info when showing items
  useEffect(() => {
    if (!showStoreItems || !selectedConversation || isSeller) return;

    const fetchStoreData = async () => {
      setLoadingItems(true);
      try {
        const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
        if (storeDoc.exists()) {
          setStoreInfo(storeDoc.data());
        }

        const itemsQuery = query(
          collection(db, 'stores', selectedConversation.otherUserId, 'items'),
          orderBy('name', 'asc')
        );
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStoreItems(items);
      } catch (error) {
        console.error('Error fetching store data:', error);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchStoreData();
  }, [showStoreItems, selectedConversation, isSeller]);

  // Fetch wallet data for sellers
  useEffect(() => {
    if (!isSeller || !currentUser) return;

    setLoadingWallet(true);

    const walletDocRef = doc(db, 'wallets', currentUser.uid);
    const unsubscribeWallet = onSnapshot(walletDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const walletInfo = docSnap.data();
        setWalletData(prev => ({
          ...prev,
          balance: walletInfo.balance || 0,
          pendingBalance: walletInfo.pendingBalance || 0,
          totalEarnings: walletInfo.totalEarnings || 0
        }));
      } else {
        setWalletData(prev => ({
          ...prev,
          balance: 0,
          pendingBalance: 0,
          totalEarnings: 0
        }));
      }
    }, (error) => {
      console.error('Error fetching wallet data:', error);
      setLoadingWallet(false);
    });

    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('sellerId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWalletData(prev => ({
        ...prev,
        transactions
      }));
      setLoadingWallet(false);
    }, (error) => {
      console.error('Error fetching transactions:', error);
      setLoadingWallet(false);
    });

    return () => {
      unsubscribeWallet();
      unsubscribeTransactions();
    };
  }, [isSeller, currentUser]);

  useEffect(() => {
    if (!isSeller && activeTab === 'wallet') {
      setActiveTab('messages');
    }
  }, [isSeller, activeTab]);

  // Load fee settings when seller status changes
  useEffect(() => {
    if (isSeller && currentUser) {
      loadFeeSettings();
    }
  }, [isSeller, currentUser]);

  // Check for delivery reminders every 30 seconds
  useEffect(() => {
    if (!isSeller || !currentUser || !messages.length) return;

    const checkReminders = () => {
      const now = new Date();
      console.log('Checking for delivery reminders at:', now);
      
      messages.forEach(msg => {
        if ((msg.messageType === 'delivery_scheduled' || msg.messageType === 'delivery_rescheduled') && 
            msg.receiverId === currentUser.uid && 
            !isDeliveryInProgress(msg.orderData?.orderId) && 
            !isDeliveryCompleted(msg.orderData?.orderId) && 
            !isDeliveryCancelled(msg.orderData?.orderId)) {
          
          console.log('Found delivery message for reminder check:', {
            orderId: msg.orderData?.orderId,
            scheduledDateTime: msg.orderData?.scheduledDateTime,
            messageType: msg.messageType
          });
          
          // Check for scheduled deliveries approaching (within 15 minutes)
          if (msg.orderData?.scheduledDateTime) {
            const scheduledTime = new Date(msg.orderData.scheduledDateTime);
            const timeDiff = scheduledTime.getTime() - now.getTime();
            
            console.log('Time until delivery:', Math.round(timeDiff / (1000 * 60)), 'minutes');
            
            // Send reminder 15 minutes before scheduled time
            if (timeDiff <= 15 * 60 * 1000 && timeDiff > 0) {
              console.log('Should send reminder for order:', msg.orderData?.orderId);
              // Check if reminder was already sent (to avoid spam)
              const reminderAlreadySent = messages.some(reminderMsg => 
                reminderMsg.messageType === 'delivery_reminder' && 
                reminderMsg.orderData?.orderId === msg.orderData?.orderId &&
                reminderMsg.timestamp?.toDate() > new Date(now.getTime() - 20 * 60 * 1000) // Within last 20 minutes
              );
              
              if (!reminderAlreadySent) {
                console.log('Sending delivery reminder for order:', msg.orderData?.orderId);
                sendDeliveryReminder(msg.orderData);
              } else {
                console.log('Reminder already sent for order:', msg.orderData?.orderId);
              }
            }
          }
          
          // Also check time slot based deliveries (next_day)
          if (shouldSendSellerReminder(msg.orderData?.deliverySettings, msg.orderData?.scheduledDateTime)) {
            console.log('Should send seller reminder for next-day delivery:', msg.orderData?.orderId);
            // Check if reminder was already sent (to avoid spam)
            const reminderAlreadySent = messages.some(reminderMsg => 
              reminderMsg.messageType === 'delivery_reminder' && 
              reminderMsg.orderData?.orderId === msg.orderData?.orderId
            );
            
            if (!reminderAlreadySent) {
              console.log('Sending next-day delivery reminder for order:', msg.orderData?.orderId);
              sendDeliveryReminder(msg.orderData);
            } else {
              console.log('Next-day reminder already sent for order:', msg.orderData?.orderId);
            }
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 30000); // Check every 30 seconds
    checkReminders(); // Check immediately

    return () => clearInterval(interval);
  }, [isSeller, currentUser, messages]);

  // Reset order status when switching conversations (fix for browse button in new order conversations)
  useEffect(() => {
    if (!selectedConversation || isSeller || !currentUser) return;
    
    // For customers: Check if there's a persisted order state for this conversation
    const checkOrderStateForConversation = async () => {
      try {
        const orderStateDocRef = doc(db, 'orderStates', currentUser.uid);
        const orderStateSnap = await getDoc(orderStateDocRef);
        
        if (orderStateSnap.exists()) {
          const orderState = orderStateSnap.data();
          
          // Check if the persisted order state is for the current conversation
          // Use the same fallback logic as when saving the order state
          const persistedConversationId = orderState.conversationId;
          const currentConversationId = selectedConversation.id || `${currentUser.uid}_${selectedConversation.otherUserId}`;
          
          if (persistedConversationId === currentConversationId) {
            // This conversation has a persisted order state - restore it
            setOrderStatus(orderState.status || 'shopping');
            setCurrentOrderId(orderState.orderId || null);
            setPersistedOrderItems(orderState.items || []);
            
            // If order is locked (done_adding/bagging), clear cart but keep persisted items
            if (orderState.status === 'done_adding' || orderState.status === 'bagging') {
              setCart([]);
            }
          } else {
            // Different conversation - reset to shopping state
            setOrderStatus('shopping');
            setCurrentOrderId(null);
            setPersistedOrderItems([]);
            setCart([]); // Clear cart when switching conversations
          }
        } else {
          // No persisted order state - reset to shopping
          setOrderStatus('shopping');
          setCurrentOrderId(null);
          setPersistedOrderItems([]);
          setCart([]); // Clear cart when switching conversations
        }
      } catch (error) {
        console.error('Error checking order state for conversation:', error);
        // Fallback to shopping state
        setOrderStatus('shopping');
        setCurrentOrderId(null);
        setPersistedOrderItems([]);
        setCart([]);
      }
    };
    
    checkOrderStateForConversation();
  }, [selectedConversation?.id, isSeller, currentUser]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    try {
      await addDoc(collection(db, 'messages'), {
        conversationId: selectedConversation.id,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'text'
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  // Delete message function
  const deleteMessage = async (messageId) => {
    if (!messageId || !currentUser) return;

    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await updateDoc(doc(db, 'messages', messageId), {
          deleted: true,
          deletedBy: currentUser.uid,
          deletedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message. Please try again.');
      }
    }
  };

  // Calculate cart totals
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  // Calculate payment details
  const calculatePaymentDetails = async (items, currency = 'GBP', storeId = null, isCollection = false) => {
    console.log('Calculating payment for items:', items, 'currency:', currency, 'storeId:', storeId, 'isCollection:', isCollection);
    
    // Ensure items is an array and validate item data
    if (!Array.isArray(items) || items.length === 0) {
      console.warn('Invalid items array:', items);
      return {
        subtotal: 0,
        deliveryFee: 0,
        serviceFee: 0,
        total: 0,
        currency
      };
    }

    const subtotal = items.reduce((total, item) => {
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 1;
      const itemTotal = price * quantity;
      console.log(`Item: ${item.name}, Price: ${price}, Quantity: ${quantity}, Total: ${itemTotal}`);
      return total + itemTotal;
    }, 0);
    
    console.log('Calculated subtotal:', subtotal);
    
    // Initialize fees
    let deliveryFee = 0;
    let serviceFee = 0;
    
    // Fetch store-specific fee settings if storeId is provided
    if (storeId) {
      try {
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
          const storeData = storeDoc.data();
          const feeSettings = storeData.feeSettings || {};
          
          console.log('Store fee settings:', feeSettings);
          
          // For collection/pay at store, only apply service fee (no delivery fee)
          if (isCollection) {
            deliveryFee = 0; // No delivery fee for collection
          } else {
            // Calculate delivery fee based on store settings
            if (feeSettings.deliveryEnabled) {
              if (feeSettings.freeDeliveryThreshold && subtotal >= feeSettings.freeDeliveryThreshold) {
                deliveryFee = 0;
              } else {
                deliveryFee = parseFloat(feeSettings.deliveryFee) || 0;
              }
            }
          }
          
          // Calculate service fee based on store settings (applies to both delivery and collection)
          if (feeSettings.serviceFeeEnabled) {
            if (feeSettings.serviceFeeType === 'percentage') {
              serviceFee = subtotal * (parseFloat(feeSettings.serviceFeeRate) / 100 || 0);
              // Cap service fee if specified
              if (feeSettings.serviceFeeMax) {
                serviceFee = Math.min(serviceFee, parseFloat(feeSettings.serviceFeeMax));
              }
            } else if (feeSettings.serviceFeeType === 'fixed') {
              serviceFee = parseFloat(feeSettings.serviceFeeAmount) || 0;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching store fee settings:', error);
        // Fallback to default behavior if store settings can't be fetched
      }
    }
    
    // If no store-specific settings found, use default logic (but only if explicitly enabled)
    if (!storeId || (deliveryFee === 0 && serviceFee === 0)) {
      console.log('Using default fee calculation (store settings not found or fees disabled)');
      // Keep fees at 0 unless store has specifically configured them
    }
    
    const total = subtotal + deliveryFee + serviceFee;
    
    console.log('Payment calculation result:', {
      subtotal,
      deliveryFee,
      serviceFee,
      total,
      currency
    });
    
    return {
      subtotal,
      deliveryFee,
      serviceFee,
      total,
      currency,
      feeBreakdown: {
        deliveryEnabled: deliveryFee > 0,
        serviceFeeEnabled: serviceFee > 0
      }
    };
  };

  // Open payment modal
  const openPaymentModal = async (orderData = null) => {
    console.log('Opening payment modal with orderData:', orderData);
    console.log('Current cart:', cart);
    
    let itemsToCalculate = [];
    let currency = 'GBP';
    let orderId = null;
    let storeId = selectedConversation?.otherUserId;

    if (orderData) {
      // Payment from message order data
      console.log('Using order data for payment');
      itemsToCalculate = orderData.items || [];
      currency = orderData.currency || 'GBP';
      orderId = orderData.orderId;
      
      // If no items in orderData, try to get from other sources
      if (itemsToCalculate.length === 0) {
        console.log('No items in orderData, checking cart and persisted items');
        itemsToCalculate = [...cart, ...persistedOrderItems];
        currency = cart[0]?.currency || persistedOrderItems[0]?.currency || 'GBP';
      }
    } else {
      // Payment from current cart
      console.log('Using cart for payment');
      itemsToCalculate = cart;
      currency = cart[0]?.currency || 'GBP';
      orderId = currentOrderId;
    }

    // Validate and clean up items data
    itemsToCalculate = itemsToCalculate.map(item => ({
      ...item,
      // Handle different property names for item name
      name: item.name || item.itemName || 'Unknown Item',
      // Handle different property names for price  
      price: parseFloat(item.price) || parseFloat(item.subtotal / (item.quantity || 1)) || 0,
      quantity: parseInt(item.quantity) || 1,
      // Preserve original properties
      currency: item.currency || currency
    })).filter(item => item.price > 0 && item.quantity > 0);

    console.log('Items to calculate:', itemsToCalculate);
    console.log('Currency:', currency);
    console.log('Store ID:', storeId);

    // Check if we have valid items
    if (itemsToCalculate.length === 0) {
      alert('No items found for payment. Please add items to your cart first.');
      return;
    }

    // Calculate payment details with store-specific fees
    // Check if any items are collection/pay at store based on delivery type
    const isCollection = itemsToCalculate.some(item => item.deliveryType === 'Collection' || item.deliveryType === 'Pay at Store');
    const paymentDetails = await calculatePaymentDetails(itemsToCalculate, currency, storeId, isCollection);
    console.log('Payment details calculated:', paymentDetails);
    
    setPaymentData({
      ...paymentDetails,
      orderId,
      items: itemsToCalculate
    });
    setSelectedPaymentMethod('');
    setShowPaymentModal(true);
  };

  // Generate pickup verification code
  const generatePickupCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  // Apple Pay authentication simulation
  const processApplePay = async () => {
    setShowApplePayModal(true);
    setApplePayStep('auth');
    setApplePayProcessing(false);
  };

  const authenticateApplePay = async () => {
    setApplePayProcessing(true);
    setApplePayStep('processing');
    
    try {
      // Simulate biometric authentication delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful authentication
      setApplePayStep('success');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close Apple Pay modal and proceed with payment
      setShowApplePayModal(false);
      setApplePayProcessing(false);
      setApplePayStep('auth');
      
      // Now process the actual payment
      await processPayment();
      
    } catch (error) {
      console.error('Apple Pay authentication failed:', error);
      alert('Apple Pay authentication failed. Please try again.');
      setApplePayProcessing(false);
      setApplePayStep('auth');
    }
  };

  const cancelApplePay = () => {
    setShowApplePayModal(false);
    setApplePayProcessing(false);
    setApplePayStep('auth');
  };

  // Process payment - PRODUCTION-READY WITH STRIPE ELEMENTS
  const processPayment = async (stripePaymentData = null) => {
    console.log('🔄 processPayment called with:', {
      selectedPaymentMethod,
      stripePaymentData,
      hasStripeData: !!stripePaymentData
    });

    if (!selectedPaymentMethod) {
      alert('Please select a payment method');
      return;
    }

    setPaymentProcessing(true);
    
    try {
      // Generate unique pickup verification code
      const pickupCode = generatePickupCode();
      const sellerId = selectedConversation?.otherUserId;
      
      let paymentDetails = {
        method: selectedPaymentMethod,
        amount: paymentData.total,
        currency: paymentData.currency,
        orderId: paymentData.orderId,
        pickupCode: pickupCode
      };

      let paymentIntentId = `default_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // Initialize with default value

      if (selectedPaymentMethod === 'card' && stripePaymentData) {
        // Real Stripe payment from Stripe Elements
        paymentIntentId = stripePaymentData.paymentIntentId || `backup_${Date.now()}`;
        paymentDetails.cardInfo = stripePaymentData.cardInfo;
        console.log('✅ Using Real Stripe Elements payment:', paymentIntentId);

      } else if (selectedPaymentMethod === 'apple_pay' && stripePaymentData) {
        // Real Apple Pay payment from Stripe
        paymentIntentId = stripePaymentData.paymentIntentId || `backup_apple_${Date.now()}`;
        paymentDetails.applePayInfo = stripePaymentData.applePayInfo;
        console.log('✅ Using Real Apple Pay payment:', paymentIntentId);

      } else if (selectedPaymentMethod === 'card') {
        // Fallback for custom card form (validate first)
        console.log('⚠️ Using Legacy Card Form (simulated payment)');
        if (!validateCard()) {
          alert('Please fill in all required card details correctly');
          setPaymentProcessing(false);
          return;
        }

        // Create a simulated payment for custom card form
        paymentIntentId = `sim_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        paymentDetails.cardInfo = {
          last4: cardForm.cardNumber.replace(/\s/g, '').slice(-4),
          cardType: getCardType(cardForm.cardNumber),
          expiryMonth: cardForm.expiryDate.split('/')[0],
          expiryYear: '20' + cardForm.expiryDate.split('/')[1]
        };

      } else if (selectedPaymentMethod === 'apple_pay') {
        // Handle Apple Pay simulation
        console.log('⚠️ Using Simulated Apple Pay');
        paymentIntentId = `sim_apple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        paymentDetails.applePayInfo = {
          deviceAccount: 'Apple Pay Device ****1234',
          transactionId: `apple_pay_${Date.now()}`
        };

      } else {
        // For other payment methods, create a simulated payment
        console.log('⚠️ Using Simulated Payment for method:', selectedPaymentMethod);
        paymentIntentId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Calculate seller's earnings (deduct platform fees if applicable)
      const platformFeeRate = 0.03; // 3% platform fee
      const platformFee = paymentData.total * platformFeeRate;
      const sellerEarnings = paymentData.total - platformFee;

      // Update seller's wallet
      const sellerWalletRef = doc(db, 'wallets', sellerId);
      const sellerWalletSnap = await getDoc(sellerWalletRef);
      
      if (sellerWalletSnap.exists()) {
        const currentData = sellerWalletSnap.data();
        await updateDoc(sellerWalletRef, {
          balance: (currentData.balance || 0) + sellerEarnings,
          totalEarnings: (currentData.totalEarnings || 0) + sellerEarnings,
          lastUpdated: serverTimestamp()
        });
      } else {
        await setDoc(sellerWalletRef, {
          balance: sellerEarnings,
          pendingBalance: 0,
          totalEarnings: sellerEarnings,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }

      // Create transaction record for seller
      await addDoc(collection(db, 'transactions'), {
        sellerId: sellerId,
        orderId: paymentData.orderId,
        customerId: currentUser.uid,
        customerName: currentUser.displayName || currentUser.email,
        type: 'sale',
        amount: sellerEarnings,
        platformFee: platformFee,
        grossAmount: paymentData.total,
        currency: paymentData.currency,
        paymentMethod: selectedPaymentMethod,
        stripePaymentIntentId: paymentIntentId || `fallback_${Date.now()}`, // Ensure never undefined
        description: `Sale: ${paymentData.items?.map(item => item.name).join(', ') || 'Order items'}`,
        status: 'completed',
        pickupCode: pickupCode,
        pickupStatus: 'pending',
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp()
      });

      // Create payment record in Firestore
      const paymentRecord = {
        orderId: paymentData.orderId,
        customerId: currentUser.uid,
        customerName: currentUser.displayName || currentUser.email,
        sellerId: sellerId,
        amount: paymentData.total,
        sellerEarnings: sellerEarnings,
        platformFee: platformFee,
        currency: paymentData.currency,
        paymentMethod: selectedPaymentMethod,
        stripePaymentIntentId: paymentIntentId || `fallback_${Date.now()}`, // Ensure never undefined
        status: 'completed',
        pickupCode: pickupCode,
        pickupStatus: 'pending',
        items: paymentData.items,
        breakdown: {
          subtotal: paymentData.subtotal,
          deliveryFee: paymentData.deliveryFee,
          serviceFee: paymentData.serviceFee,
          platformFee: platformFee
        },
        ...(selectedPaymentMethod === 'card' && paymentDetails.cardInfo && {
          cardInfo: paymentDetails.cardInfo
        }),
        ...(selectedPaymentMethod === 'apple_pay' && paymentDetails.applePayInfo && {
          applePayInfo: paymentDetails.applePayInfo
        }),
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'payments'), paymentRecord);

      // Fetch buyer's complete information from Firestore
      let buyerName = currentUser.displayName || currentUser.email;
      let buyerEmail = currentUser.email;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          buyerName = userData.displayName || userData.name || buyerName;
          buyerEmail = userData.email || buyerEmail;
        }
      } catch (error) {
        console.warn('Could not fetch user details:', error);
      }

      // Send payment confirmation message to conversation
      const paymentMessage = {
        conversationId: selectedConversation.id,
        senderId: currentUser.uid,
        senderName: buyerName,
        senderEmail: buyerEmail,
        receiverId: selectedConversation?.otherUserId,
        receiverName: selectedConversation?.otherUserName,
        message: `✅ Payment Completed!\n\nOrder: ${paymentData.orderId?.slice(-8) || 'N/A'}\nAmount: ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}\nMethod: ${getPaymentMethods(paymentData.currency).find(m => m.id === selectedPaymentMethod)?.name}${
          selectedPaymentMethod === 'card' && paymentDetails.cardInfo ? ` (****${paymentDetails.cardInfo.last4})` : 
          selectedPaymentMethod === 'apple_pay' && paymentDetails.applePayInfo ? ` (${paymentDetails.applePayInfo.deviceAccount})` : ''
        }\n\n🎫 PICKUP CODE: ${pickupCode}\n\nPlease provide this code to the seller when collecting your order.\n\nSeller has been credited ${getCurrencySymbol(paymentData.currency)}${formatPrice(sellerEarnings, paymentData.currency)} to their wallet.`,
        messageType: 'payment_completed',
        timestamp: serverTimestamp(),
        paymentData: {
          ...paymentRecord,
          displayInfo: {
            orderId: paymentData.orderId,
            amount: paymentData.total,
            currency: paymentData.currency,
            pickupCode: pickupCode,
            paymentMethod: selectedPaymentMethod
          }
        }
      };

      await addDoc(collection(db, 'messages'), paymentMessage);

      // Format order items for display
      const orderDetails = paymentData.items?.map(item => 
        `• ${item.name} x${item.quantity} - ${getCurrencySymbol(paymentData.currency)}${formatPrice((item.price * item.quantity), paymentData.currency)}`
      ).join('\n') || 'Order items not available';

      // Send notification to seller about new payment
      const sellerNotificationMessage = {
        conversationId: selectedConversation.id,
        senderId: currentUser.uid,
        senderName: buyerName,
        senderEmail: buyerEmail,
        receiverId: sellerId,
        receiverName: selectedConversation?.otherUserName,
        message: `💰 Payment Received!\n\nYou've received a payment of ${getCurrencySymbol(paymentData.currency)}${formatPrice(sellerEarnings, paymentData.currency)}\n\nOrder: ${paymentData.orderId?.slice(-8) || 'N/A'}\nCustomer: ${buyerName}\nPickup Code: ${pickupCode}\nPayment Method: ${getPaymentMethods(paymentData.currency).find(m => m.id === selectedPaymentMethod)?.name}\nPayment ID: ${paymentIntentId}\n\n📦 ITEMS ORDERED:\n${orderDetails}\n\nTotal Paid: ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}\nYour Earnings: ${getCurrencySymbol(paymentData.currency)}${formatPrice(sellerEarnings, paymentData.currency)}\nPlatform Fee: ${getCurrencySymbol(paymentData.currency)}${formatPrice(platformFee, paymentData.currency)}\n\nFunds have been added to your wallet. \n\n📱 TO VALIDATE PICKUP:\nGo to your Wallet tab and enter the pickup code when the customer arrives to collect their order.`,
        messageType: 'payment_notification',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          orderId: paymentData.orderId,
          items: paymentData.items,
          totalAmount: paymentData.total,
          currency: paymentData.currency,
          pickupCode: pickupCode
        },
        paymentData: {
          ...paymentRecord,
          displayInfo: {
            orderId: paymentData.orderId,
            amount: paymentData.total,
            currency: paymentData.currency,
            pickupCode: pickupCode
          }
        }
      };

      await addDoc(collection(db, 'messages'), sellerNotificationMessage);

      // Update order status
      setOrderStatus('paid');
      
      // Clear payment modal and cart
      setShowPaymentModal(false);
      setCart([]);
      setCurrentOrderId(null);
      
      // Clear card form for security
      if (selectedPaymentMethod === 'card') {
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
      }
      
      // Clear persisted order state
      try {
        await setDoc(doc(db, 'orderStates', currentUser.uid), {
          status: 'shopping',
          orderId: null,
          items: [],
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.warn('Could not clear order state:', error);
      }

      // Show success message with pickup code
      alert(`Payment successful! 🎉\n\nYour pickup code is: ${pickupCode}\n\nPlease save this code and provide it to the seller when collecting your order.\n\nThe seller has been credited ${getCurrencySymbol(paymentData.currency)}${formatPrice(sellerEarnings, paymentData.currency)} to their wallet.\n\nPayment ID: ${paymentIntentId || 'N/A'}`);
      
    } catch (error) {
      console.error('Payment processing error:', error);
      alert(`Payment failed: ${error.message}\n\nPlease try again.`);
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Handle successful Stripe payment
  const handleStripePaymentSuccess = (stripeData) => {
    processPayment(stripeData);
  };

  // Handle Stripe payment error
  const handleStripePaymentError = (errorMessage) => {
    alert(`Payment failed: ${errorMessage}\n\nPlease try again.`);
    setPaymentProcessing(false);
  };

  // Handle successful Apple Pay payment
  const handleApplePaySuccess = (applePayData) => {
    processPayment(applePayData);
  };

  // Handle Apple Pay error
  const handleApplePayError = (errorMessage) => {
    alert(`Apple Pay failed: ${errorMessage}\n\nPlease try again.`);
    setPaymentProcessing(false);
  };

  // Validate pickup code (for sellers)
  const validatePickupCode = async (inputCode) => {
    if (!inputCode || !currentUser || !isSeller) {
      alert('Invalid pickup code or user not authorized');
      return;
    }

    try {
      // Search for transaction with matching pickup code
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('sellerId', '==', currentUser.uid),
        where('pickupCode', '==', inputCode.toUpperCase()),
        where('pickupStatus', '==', 'pending')
      );

      const transactionSnap = await getDocs(transactionsQuery);
      
      if (transactionSnap.empty) {
        alert('❌ Invalid pickup code or order already collected.');
        return;
      }

      const transactionDoc = transactionSnap.docs[0];
      const transactionData = transactionDoc.data();

      // Confirm pickup with seller
      const confirmPickup = window.confirm(
        `Confirm order pickup?\n\nOrder ID: ${transactionData.orderId}\nCustomer: ${transactionData.customerName}\nAmount: ${getCurrencySymbol(transactionData.currency)}${formatPrice(transactionData.amount, transactionData.currency)}\nPickup Code: ${inputCode.toUpperCase()}\n\nClick OK to mark as collected.`
      );

      if (!confirmPickup) return;

      // Update transaction status
      await updateDoc(doc(db, 'transactions', transactionDoc.id), {
        pickupStatus: 'collected',
        collectedAt: serverTimestamp(),
        collectedBy: currentUser.uid
      });

      // Update payment record
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('orderId', '==', transactionData.orderId),
        where('pickupCode', '==', inputCode.toUpperCase())
      );

      const paymentSnap = await getDocs(paymentsQuery);
      if (!paymentSnap.empty) {
        await updateDoc(doc(db, 'payments', paymentSnap.docs[0].id), {
          pickupStatus: 'collected',
          collectedAt: serverTimestamp()
        });
      }

      // Update order status in orders collection
      const ordersQuery = query(
        collection(db, 'orders'),
        where('buyerId', '==', transactionData.customerId),
        where('storeId', '==', currentUser.uid)
      );

      const ordersSnap = await getDocs(ordersQuery);
      for (const orderDoc of ordersSnap.docs) {
        const orderData = orderDoc.data();
        // Find the order that matches this transaction
        if (orderData.createdAt && transactionData.createdAt) {
          const timeDiff = Math.abs(orderData.createdAt.toMillis() - transactionData.createdAt.toMillis());
          // If orders were created within 1 minute of each other, consider them the same order
          if (timeDiff < 60000) {
            await updateDoc(doc(db, 'orders', orderDoc.id), {
              status: 'delivered',
              deliveredAt: serverTimestamp(),
              pickupCode: inputCode.toUpperCase()
            });
            break;
          }
        }
      }

      // Find the order data for completing delivery in chat
      const messagesQuery = query(
        collection(db, 'messages'),
        where('messageType', 'in', ['payment_completed', 'payment_notification']),
        where('orderData.orderId', '==', transactionData.orderId)
      );

      const messagesSnap = await getDocs(messagesQuery);
      let orderDataForDelivery = null;

      if (!messagesSnap.empty) {
        // Get order data from the payment message
        const paymentMessage = messagesSnap.docs[0].data();
        orderDataForDelivery = paymentMessage.orderData;
      }

      // If we have order data, complete the delivery in chat
      if (orderDataForDelivery) {
        // Try both possible conversation ID formats
        const conversationId1 = `${currentUser.uid}_${transactionData.customerId}`;
        const conversationId2 = `${transactionData.customerId}_${currentUser.uid}`;
        
        // First try to find with seller_customer format
        let conversationsQuery = query(
          collection(db, 'messages'),
          where('conversationId', '==', conversationId1)
        );

        let convSnap = await getDocs(conversationsQuery);
        let correctConversationId = conversationId1;
        
        // If not found, try customer_seller format
        if (convSnap.empty) {
          conversationsQuery = query(
            collection(db, 'messages'),
            where('conversationId', '==', conversationId2)
          );
          convSnap = await getDocs(conversationsQuery);
          correctConversationId = conversationId2;
        }

        if (!convSnap.empty) {
          // Set up the conversation context for delivery completion
          const tempSelectedConversation = {
            id: correctConversationId,
            otherUserId: transactionData.customerId,
            otherUserName: transactionData.customerName,
            otherUserEmail: transactionData.customerEmail || ''
          };

          // Create delivery completion message manually since completeDelivery needs selectedConversation
          const completionOrderDetails = orderDataForDelivery.items?.map(item => 
            `• ${item.name || item.itemName} x${item.quantity} - ${getCurrencySymbol(orderDataForDelivery.currency)}${formatPrice((item.price || item.subtotal) * (item.quantity || 1), orderDataForDelivery.currency)}`
          ).join('\n') || 'Order items not available';

          const completionMessage = {
            conversationId: correctConversationId,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email,
            senderEmail: currentUser.email,
            receiverId: tempSelectedConversation.otherUserId,
            receiverName: tempSelectedConversation.otherUserName,
            receiverEmail: tempSelectedConversation.otherUserEmail,
            message: `✅ DELIVERY COMPLETED!\n\nOrder ID: ${orderDataForDelivery.orderId}\n\n📦 DELIVERED ITEMS:\n${completionOrderDetails}\n\nTotal: ${getCurrencySymbol(orderDataForDelivery.currency)}${formatPrice(orderDataForDelivery.totalAmount, orderDataForDelivery.currency)}\n\nYour order has been delivered successfully!\n\nPickup Code: ${inputCode.toUpperCase()}\nCollected: ${new Date().toLocaleString()}\n\nThank you for your business. We hope you enjoy your order!`,
            messageType: 'delivery_completed',
            timestamp: serverTimestamp(),
            isRead: false,
            orderData: {
              ...orderDataForDelivery,
              deliveryCompleted: new Date().toISOString(),
              pickupCodeValidated: inputCode.toUpperCase()
            }
          };

          await addDoc(collection(db, 'messages'), completionMessage);

          // Update delivery record
          const deliveriesQuery = query(
            collection(db, 'deliveries'),
            where('orderId', '==', orderDataForDelivery.orderId),
            where('sellerId', '==', currentUser.uid)
          );

          const deliverySnapshot = await getDocs(deliveriesQuery);
          if (!deliverySnapshot.empty) {
            const deliveryDoc = deliverySnapshot.docs[0];
            await updateDoc(doc(db, 'deliveries', deliveryDoc.id), {
              status: 'completed',
              completedAt: serverTimestamp(),
              pickupCodeValidated: inputCode.toUpperCase()
            });
          }
        } else {
          console.log('No conversation found for delivery completion');
        }
      }

      // Send confirmation message to customer using the same conversation ID detection logic
      let confirmationConversationId = `${currentUser.uid}_${transactionData.customerId}`;
      
      // Check if conversation exists with this format
      const confirmQuery1 = query(
        collection(db, 'messages'),
        where('conversationId', '==', confirmationConversationId)
      );
      const confirmSnap1 = await getDocs(confirmQuery1);
      
      // If not found, try the other format
      if (confirmSnap1.empty) {
        confirmationConversationId = `${transactionData.customerId}_${currentUser.uid}`;
      }

      const confirmationMessage = {
        conversationId: confirmationConversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: transactionData.customerId,
        receiverName: transactionData.customerName,
        message: `✅ Order Collected!\n\nYour order has been successfully collected.\n\nOrder ID: ${transactionData.orderId}\nPickup Code: ${inputCode.toUpperCase()}\nCollected: ${new Date().toLocaleString()}\n\nThank you for shopping with us!`,
        messageType: 'pickup_confirmation',
        timestamp: serverTimestamp(),
        isRead: false
      };

      await addDoc(collection(db, 'messages'), confirmationMessage);

      alert(`✅ Order successfully collected and delivery completed!\n\nOrder ID: ${transactionData.orderId}\nCustomer: ${transactionData.customerName}\nAmount: ${getCurrencySymbol(transactionData.currency)}${formatPrice(transactionData.amount, transactionData.currency)}\nPickup Code: ${inputCode.toUpperCase()}\n\nThe order has been marked as delivered in all systems.`);

    } catch (error) {
      console.error('Error validating pickup code:', error);
      alert('Error validating pickup code. Please try again.');
    }
  };

  // Load fee settings for sellers
  const loadFeeSettings = async () => {
    if (!currentUser || !isSeller) return;
    
    try {
      const storeDoc = await getDoc(doc(db, 'stores', currentUser.uid));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        const savedSettings = storeData.feeSettings || {};
        setFeeSettings(prev => ({
          ...prev,
          ...savedSettings
        }));
      }
    } catch (error) {
      console.error('Error loading fee settings:', error);
    }
  };

  // Save fee settings for sellers
  const saveFeeSettings = async () => {
    if (!currentUser || !isSeller) return;
    
    try {
      await updateDoc(doc(db, 'stores', currentUser.uid), {
        feeSettings: feeSettings
      });
      
      setShowFeeSettings(false);
      
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Fee settings saved successfully!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22C55E;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error saving fee settings:', error);
      alert('Failed to save fee settings. Please try again.');
    }
  };

  // Add item to cart
  const addItemToCart = (item) => {
    // Check if order is locked
    if (orderStatus === 'done_adding' || orderStatus === 'bagging') {
      alert('Order is locked. Cannot add more items. Please wait for seller to process your order.');
      return;
    }

    setCart(prev => {
      const existingItem = prev.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        return [...prev, { ...item, quantity: 1 }];
      }
    });

    // Show success notification
    const notification = document.createElement('div');
    notification.innerHTML = `✅ "${item.name}" added to cart!`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #22C55E;
      color: white;
      padding: 1rem;
      border-radius: 8px;
      z-index: 1000;
      font-weight: 600;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 2000);
  };

  // Remove item from cart
  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  // Update item quantity in cart
  const updateCartQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Reset order state (for starting new orders)
  const resetOrderState = async () => {
    if (!currentUser) return;

    try {
      await setDoc(doc(db, 'orderStates', currentUser.uid), {
        status: 'shopping',
        orderId: null,
        items: [],
        timestamp: serverTimestamp()
      });

      setOrderStatus('shopping');
      setCurrentOrderId(null);
      setPersistedOrderItems([]);
      clearCart();

      const notification = document.createElement('div');
      notification.innerHTML = `🛒 Ready for new order!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #3B82F6;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 2000);

    } catch (error) {
      console.error('Error resetting order state:', error);
    }
  };

  // Send cart as order
  const sendCartAsOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    if (!selectedConversation || !currentUser) {
      alert('Cannot send order - conversation not found.');
      return;
    }

    // Create NEW unique conversation ID for each order request (not reusing existing conversation)
    const timestamp = Date.now();
    const conversationId = `order_${timestamp}_${currentUser.uid}_${selectedConversation.otherUserId}`;

    const orderDetails = cart.map(item => 
      `• ${item.name} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.price * item.quantity, item.currency)}`
    ).join('\n');

    const totalPrice = getCartTotal();
    const orderMessage = `🛒 ORDER REQUEST:

${orderDetails}

Total: ${getCurrencySymbol(cart[0]?.currency || 'GBP')}${formatPrice(totalPrice, cart[0]?.currency || 'GBP')}
Items: ${getCartItemCount()}

Please confirm this order and provide delivery details.`;

    try {
      const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
      const storeData = storeDoc.exists() ? storeDoc.data() : {};

      // Prepare message data with proper validation
      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'Customer',
        senderEmail: currentUser.email || '',
        receiverId: selectedConversation.otherUserId,
        receiverName: storeData.businessName || selectedConversation.otherUserName || 'Store Owner',
        message: orderMessage,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'order_request',
        orderData: {
          orderId: `order_${timestamp}_${Math.random().toString(36).substr(2, 5)}_${currentUser.uid.slice(-4)}`,
          items: cart.map(item => ({
            itemId: item.id,
            itemName: item.name,
            name: item.name, // Add for compatibility
            price: item.price,
            currency: item.currency,
            quantity: item.quantity,
            subtotal: item.price * item.quantity
          })),
          totalAmount: totalPrice,
          totalItems: getCartItemCount(),
          currency: cart[0]?.currency || 'GBP'
        }
      };

      // Only add receiverEmail if it exists and is not empty
      const receiverEmail = storeData.email || selectedConversation.otherUserEmail;
      if (receiverEmail) {
        messageData.receiverEmail = receiverEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);

      clearCart();
      setShowCart(false);

      const notification = document.createElement('div');
      notification.innerHTML = `✅ Order sent successfully!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22C55E;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

    } catch (error) {
      console.error('Error sending order:', error);
      alert('Failed to send order. Please try again.');
    }
  };

  // Signal done adding items from message (for customers)
  const signalDoneAddingFromMessage = async (orderData) => {
    if (!selectedConversation || !currentUser) {
      alert('Cannot proceed - conversation not found.');
      return;
    }

    // Get all current items from cart AND any previously added items from ALL messages
    const allOrderItems = [];
    
    // Add current cart items
    cart.forEach(cartItem => {
      allOrderItems.push({
        itemId: cartItem.id,
        itemName: cartItem.name,
        price: Number(cartItem.price) || 0,
        currency: cartItem.currency || 'GBP',
        quantity: Number(cartItem.quantity) || 1,
        subtotal: Number(cartItem.price) * Number(cartItem.quantity) || 0,
        source: 'cart'
      });
    });

    // Get ALL order messages from this conversation to combine all previous orders
    const allOrderMessages = messages.filter(msg => 
      msg.messageType === 'order_request' && 
      msg.senderId === currentUser.uid && 
      msg.orderData && 
      msg.orderData.items
    );

    // Add items from ALL order messages (not just the current one)
    allOrderMessages.forEach(message => {
      if (message.orderData && message.orderData.items) {
        message.orderData.items.forEach(messageItem => {
          const existingItem = allOrderItems.find(item => item.itemId === (messageItem.itemId || messageItem.id));
          if (existingItem) {
            // Combine quantities if same item
            existingItem.quantity += Number(messageItem.quantity) || 1;
            existingItem.subtotal = existingItem.price * existingItem.quantity;
          } else {
            allOrderItems.push({
              itemId: messageItem.itemId || messageItem.id,
              itemName: messageItem.itemName || messageItem.name,
              price: Number(messageItem.price) || 0,
              currency: messageItem.currency || 'GBP',
              quantity: Number(messageItem.quantity) || 1,
              subtotal: Number(messageItem.subtotal) || (Number(messageItem.price) * Number(messageItem.quantity)) || 0,
              source: 'message'
            });
          }
        });
      }
    });

    // Add any previously persisted items (from earlier message orders)
    persistedOrderItems.forEach(persistedItem => {
      const existingItem = allOrderItems.find(item => item.itemId === persistedItem.itemId);
      if (existingItem) {
        // Combine quantities if same item
        existingItem.quantity += Number(persistedItem.quantity) || 1;
        existingItem.subtotal = existingItem.price * existingItem.quantity;
      } else {
        allOrderItems.push({
          ...persistedItem,
          source: 'persisted'
        });
      }
    });

    if (allOrderItems.length === 0) {
      alert('No items to finalize. Please add items first.');
      return;
    }

    // Create consistent conversation ID
    const conversationId = selectedConversation.id || 
      [currentUser.uid, selectedConversation.otherUserId].sort().join('_');
    const orderId = currentOrderId || `order_${Date.now()}_${currentUser.uid}`;

    // Calculate totals
    const subtotal = allOrderItems.reduce((total, item) => total + item.subtotal, 0);
    const totalItems = allOrderItems.reduce((total, item) => total + item.quantity, 0);
    const currency = allOrderItems[0]?.currency || 'GBP';

    // Calculate fees using seller's settings
    let deliveryFee = 0;
    let serviceFee = 0;
    
    try {
      const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        const feeSettings = storeData.feeSettings || {};

        // Calculate delivery fee (assuming delivery if not specified)
        if (feeSettings.deliveryEnabled) {
          if (feeSettings.freeDeliveryThreshold && subtotal >= feeSettings.freeDeliveryThreshold) {
            deliveryFee = 0; // Free delivery threshold met
          } else {
            deliveryFee = feeSettings.deliveryFee || 0;
          }
        }

        // Calculate service fee
        if (feeSettings.serviceFeeEnabled) {
          if (feeSettings.serviceFeeType === 'percentage') {
            serviceFee = subtotal * ((feeSettings.serviceFeeRate || 0) / 100);
            if (feeSettings.serviceFeeMax && serviceFee > feeSettings.serviceFeeMax) {
              serviceFee = feeSettings.serviceFeeMax;
            }
          } else {
            serviceFee = feeSettings.serviceFeeAmount || 0;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching fee settings:', error);
    }

    const totalAmount = subtotal + deliveryFee + serviceFee;

    // Create fee breakdown text
    let feeBreakdown = '';
    if (deliveryFee > 0 || serviceFee > 0) {
      feeBreakdown = `\n💰 Cost Breakdown:
Subtotal: ${getCurrencySymbol(currency)}${formatPrice(subtotal, currency)}`;
      
      if (deliveryFee > 0) {
        feeBreakdown += `\nDelivery Fee: ${getCurrencySymbol(currency)}${formatPrice(deliveryFee, currency)}`;
      }
      
      if (serviceFee > 0) {
        feeBreakdown += `\nService Fee: ${getCurrencySymbol(currency)}${formatPrice(serviceFee, currency)}`;
      }
      
      feeBreakdown += `\nTotal: ${getCurrencySymbol(currency)}${formatPrice(totalAmount, currency)}`;
    }

    const doneMessage = `✅ DONE ADDING ITEMS

Order ID: ${orderId}

${allOrderItems.map(item => 
  `• ${item.itemName} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.subtotal, item.currency)}`
).join('\n')}

${feeBreakdown || `Total: ${getCurrencySymbol(currency)}${formatPrice(totalAmount, currency)}`}
Items: ${totalItems}

Customer is done adding items. Please prepare and bag these items.`;

    try {
      const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
      const storeData = storeDoc.exists() ? storeDoc.data() : {};

      // Save order state to Firebase for persistence
      await setDoc(doc(db, 'orderStates', currentUser.uid), {
        status: 'done_adding',
        orderId: orderId,
        items: allOrderItems,
        conversationId: conversationId,
        sellerId: selectedConversation.otherUserId,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        serviceFee: serviceFee,
        totalAmount: totalAmount,
        totalItems: totalItems,
        currency: currency,
        timestamp: serverTimestamp()
      });

      // Prepare message data with proper validation for receiverEmail
      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: storeData.businessName || selectedConversation.otherUserName || 'Store Owner',
        message: doneMessage,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'done_adding',
        orderData: {
          orderId: orderId,
          items: allOrderItems,
          subtotal: Number(subtotal),
          deliveryFee: Number(deliveryFee),
          serviceFee: Number(serviceFee),
          totalAmount: Number(totalAmount),
          totalItems: Number(totalItems),
          currency: currency,
          status: 'done_adding'
        }
      };

      // Only add receiverEmail if it exists and is not empty
      const receiverEmail = storeData.email || selectedConversation.otherUserEmail;
      if (receiverEmail) {
        messageData.receiverEmail = receiverEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);

      setOrderStatus('done_adding');
      setCurrentOrderId(orderId);
      setPersistedOrderItems(allOrderItems);
      setShowStoreItems(false);
      clearCart(); // Clear the cart since order is finalized

      const notification = document.createElement('div');
      notification.innerHTML = `✅ Order finalized! Cart locked. Waiting for seller to prepare items.`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22C55E;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

    } catch (error) {
      console.error('Error signaling done adding:', error);
      alert('Failed to finalize order. Please try again.');
    }
  };

  // Signal done adding items (for customers)
  const signalDoneAdding = async () => {
    if (cart.length === 0 && persistedOrderItems.length === 0) {
      alert('Please add items to your cart first!');
      return;
    }

    if (!selectedConversation || !currentUser) {
      alert('Cannot proceed - conversation not found.');
      return;
    }

    // Combine cart items with any persisted items
    const allOrderItems = [];
    
    // Add current cart items
    cart.forEach(cartItem => {
      allOrderItems.push({
        itemId: cartItem.id,
        itemName: cartItem.name,
        price: Number(cartItem.price) || 0,
        currency: cartItem.currency || 'GBP',
        quantity: Number(cartItem.quantity) || 1,
        subtotal: Number(cartItem.price) * Number(cartItem.quantity) || 0,
        source: 'cart'
      });
    });

    // Add persisted items (from previous message orders)
    persistedOrderItems.forEach(persistedItem => {
      const existingItem = allOrderItems.find(item => item.itemId === persistedItem.itemId);
      if (existingItem) {
        // Combine quantities if same item
        existingItem.quantity += Number(persistedItem.quantity) || 1;
        existingItem.subtotal = existingItem.price * existingItem.quantity;
      } else {
        allOrderItems.push({
          ...persistedItem,
          source: 'persisted'
        });
      }
    });

    const conversationId = selectedConversation.id || `${currentUser.uid}_${selectedConversation.otherUserId}`;
    const orderId = currentOrderId || `order_${Date.now()}_${currentUser.uid}`;

    const subtotal = allOrderItems.reduce((total, item) => total + item.subtotal, 0);
    const totalItems = allOrderItems.reduce((total, item) => total + item.quantity, 0);
    const currency = allOrderItems[0]?.currency || 'GBP';

    // Calculate fees using seller's settings
    let deliveryFee = 0;
    let serviceFee = 0;
    
    try {
      const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        const feeSettings = storeData.feeSettings || {};

        // Calculate delivery fee (assuming delivery if not specified)
        if (feeSettings.deliveryEnabled) {
          if (feeSettings.freeDeliveryThreshold && subtotal >= feeSettings.freeDeliveryThreshold) {
            deliveryFee = 0; // Free delivery threshold met
          } else {
            deliveryFee = feeSettings.deliveryFee || 0;
          }
        }

        // Calculate service fee
        if (feeSettings.serviceFeeEnabled) {
          if (feeSettings.serviceFeeType === 'percentage') {
            serviceFee = subtotal * ((feeSettings.serviceFeeRate || 0) / 100);
            if (feeSettings.serviceFeeMax && serviceFee > feeSettings.serviceFeeMax) {
              serviceFee = feeSettings.serviceFeeMax;
            }
          } else {
            serviceFee = feeSettings.serviceFeeAmount || 0;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching fee settings:', error);
    }

    const totalAmount = subtotal + deliveryFee + serviceFee;

    const orderDetails = allOrderItems.map(item => 
      `• ${item.itemName} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.subtotal, item.currency)}`
    ).join('\n');

    // Create fee breakdown text
    let feeBreakdown = '';
    if (deliveryFee > 0 || serviceFee > 0) {
      feeBreakdown = `\n💰 Cost Breakdown:
Subtotal: ${getCurrencySymbol(currency)}${formatPrice(subtotal, currency)}`;
      
      if (deliveryFee > 0) {
        feeBreakdown += `\nDelivery Fee: ${getCurrencySymbol(currency)}${formatPrice(deliveryFee, currency)}`;
      }
      
      if (serviceFee > 0) {
        feeBreakdown += `\nService Fee: ${getCurrencySymbol(currency)}${formatPrice(serviceFee, currency)}`;
      }
      
      feeBreakdown += `\nTotal: ${getCurrencySymbol(currency)}${formatPrice(totalAmount, currency)}`;
    }

    const doneMessage = `✅ DONE ADDING ITEMS

Order ID: ${orderId}

${orderDetails}

${feeBreakdown || `Total: ${getCurrencySymbol(currency)}${formatPrice(totalAmount, currency)}`}
Items: ${totalItems}

Customer is done adding items. Please prepare and bag these items.`;

    try {
      const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
      const storeData = storeDoc.exists() ? storeDoc.data() : {};

      // Save order state to Firebase for persistence
      await setDoc(doc(db, 'orderStates', currentUser.uid), {
        status: 'done_adding',
        orderId: orderId,
        items: allOrderItems,
        conversationId: conversationId,
        sellerId: selectedConversation.otherUserId,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        serviceFee: serviceFee,
        totalAmount: totalAmount,
        totalItems: totalItems,
        currency: currency,
        timestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'messages'), {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: storeData.businessName || selectedConversation.otherUserName || 'Store Owner',
        receiverEmail: storeData.email || selectedConversation.otherUserEmail,
        message: doneMessage,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'done_adding',
        orderData: {
          orderId: orderId,
          items: allOrderItems,
          subtotal: Number(subtotal),
          deliveryFee: Number(deliveryFee),
          serviceFee: Number(serviceFee),
          totalAmount: Number(totalAmount),
          totalItems: Number(totalItems),
          currency: currency,
          status: 'done_adding'
        }
      });

      setOrderStatus('done_adding');
      setCurrentOrderId(orderId);
      setPersistedOrderItems(allOrderItems);
      setShowStoreItems(false);
      clearCart(); // Clear cart since order is locked

      const notification = document.createElement('div');
      notification.innerHTML = `✅ Order finalized! Waiting for seller to prepare items.`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22C55E;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

    } catch (error) {
      console.error('Error signaling done adding:', error);
      alert('Failed to finalize order. Please try again.');
    }
  };

  // Helper function to check if an order has already been bagged
  const isOrderAlreadyBagged = (orderId) => {
    if (!orderId) return false;
    return messages.some(msg => 
      msg.messageType === 'items_bagged' && 
      msg.orderData?.orderId === orderId
    );
  };

  // Helper function to check if an order has payment completed
  const isOrderPaid = (orderId) => {
    if (!orderId) return false;
    return messages.some(msg => 
      (msg.messageType === 'payment_completed' || msg.messageType === 'payment_notification') && 
      msg.paymentData?.orderId === orderId
    );
  };

  // Helper function to check if delivery is already in progress
  const isDeliveryInProgress = (orderId) => {
    if (!orderId) return false;
    
    // Check if there's an active delivery (started but not completed/cancelled)
    const deliveryStarted = messages.filter(msg => 
      msg.messageType === 'delivery_started' && 
      msg.orderData?.orderId === orderId
    );
    
    const deliveryCompleted = messages.some(msg => 
      msg.messageType === 'delivery_completed' && 
      msg.orderData?.orderId === orderId
    );
    
    const deliveryCancelled = messages.some(msg => 
      msg.messageType === 'delivery_cancelled' && 
      msg.orderData?.orderId === orderId
    );
    
    // If delivery was completed or cancelled, it's not in progress
    if (deliveryCompleted || deliveryCancelled) {
      return false;
    }
    
    // Check for truly active delivery (started but not finished)
    return deliveryStarted.length > 0;
  };

  // Helper function to check if delivery is completed
  const isDeliveryCompleted = (orderId) => {
    if (!orderId) return false;
    return messages.some(msg => 
      msg.messageType === 'delivery_completed' && 
      msg.orderData?.orderId === orderId
    );
  };

  // Helper function to check if delivery is cancelled
  const isDeliveryCancelled = (orderId) => {
    if (!orderId) return false;
    return messages.some(msg => 
      msg.messageType === 'delivery_cancelled' && 
      msg.orderData?.orderId === orderId
    );
  };

  // Helper function to check if refund is requested
  const isRefundRequested = (orderId) => {
    if (!orderId) return false;
    return messages.some(msg => 
      msg.messageType === 'refund_requested' && 
      msg.orderData?.orderId === orderId
    );
  };

  // Helper function to check if current time is within delivery window
  const isWithinDeliveryWindow = (deliverySettings, scheduledDateTime) => {
    if (!deliverySettings) return false;
    
    const now = new Date();
    
    if (deliverySettings.deliveryType === 'immediate') {
      return true; // Always available for immediate delivery
    }
    
    if (deliverySettings.deliveryType === 'scheduled' && scheduledDateTime) {
      const scheduledTime = new Date(scheduledDateTime);
      const timeDiff = Math.abs(now.getTime() - scheduledTime.getTime());
      // Allow delivery within 2 hours of scheduled time (more flexible)
      return timeDiff <= 120 * 60 * 1000; 
    }
    
    if (deliverySettings.deliveryType === 'next_day') {
      // For next day, check if it's the scheduled day (not necessarily tomorrow from now)
      const scheduledDate = new Date(deliverySettings.scheduledDate || new Date());
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      
      // Check if current date matches the delivery date
      if (now.toDateString() !== scheduledDate.toDateString()) {
        return false;
      }
      
      // Check if within time slot
      let startHour, endHour;
      switch (deliverySettings.timeSlot) {
        case 'morning':
          startHour = 9; endHour = 12;
          break;
        case 'afternoon':
          startHour = 12; endHour = 17;
          break;
        case 'evening':
          startHour = 17; endHour = 20;
          break;
        default:
          return false;
      }
      
      const currentHour = now.getHours();
      return currentHour >= startHour && currentHour < endHour;
    }
    
    return false;
  };

  // Helper function to check if seller reminder should be sent
  const shouldSendSellerReminder = (deliverySettings, scheduledDateTime) => {
    if (!deliverySettings) return false;
    
    const now = new Date();
    
    if (deliverySettings.deliveryType === 'scheduled' && scheduledDateTime) {
      const scheduledTime = new Date(scheduledDateTime);
      const timeDiff = scheduledTime.getTime() - now.getTime();
      return timeDiff <= 15 * 60 * 1000 && timeDiff > 0; // 15 minutes before
    }
    
    if (deliverySettings.deliveryType === 'next_day') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (now.toDateString() !== tomorrow.toDateString()) {
        return false;
      }
      
      let startHour;
      switch (deliverySettings.timeSlot) {
        case 'morning': startHour = 9; break;
        case 'afternoon': startHour = 12; break;
        case 'evening': startHour = 17; break;
        default: return false;
      }
      
      const timeUntilSlot = new Date(now);
      timeUntilSlot.setHours(startHour, 0, 0, 0);
      const timeDiff = timeUntilSlot.getTime() - now.getTime();
      
      return timeDiff <= 15 * 60 * 1000 && timeDiff > 0; // 15 minutes before slot
    }
    
    return false;
  };

  // Generate available time slots for today within store hours
  const getAvailableTimeSlots = () => {
    const now = new Date();
    const today = now.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[today];
    
    const todayHours = storeHours[todayName];
    if (!todayHours) return [];

    const slots = [];
    
    // Parse store hours for today
    const [openHour, openMinute] = todayHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = todayHours.close.split(':').map(Number);

    // Start from the next 30-minute slot after current time
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    let startHour = currentHour;
    let startMinutes;
    
    // Find next 30-minute slot
    if (currentMinutes < 30) {
      startMinutes = 30;
    } else {
      startMinutes = 0;
      startHour = currentHour + 1;
    }
    
    // Make sure we don't start before store opens
    if (startHour < openHour || (startHour === openHour && startMinutes < openMinute)) {
      startHour = openHour;
      startMinutes = openMinute;
      // Round up to next 30-minute slot if needed
      if (startMinutes > 0 && startMinutes <= 30) {
        startMinutes = 30;
      } else if (startMinutes > 30) {
        startMinutes = 0;
        startHour = startHour + 1;
      }
    }
    
    // Generate slots from start time until store closes
    let currentSlotHour = startHour;
    let currentSlotMinutes = startMinutes;
    
    while (currentSlotHour < closeHour || (currentSlotHour === closeHour && currentSlotMinutes < closeMinute)) {
      const timeString = `${currentSlotHour.toString().padStart(2, '0')}:${currentSlotMinutes.toString().padStart(2, '0')}`;
      
      // Create display string in 12-hour format
      const tempDate = new Date();
      tempDate.setHours(currentSlotHour, currentSlotMinutes, 0, 0);
      const displayString = tempDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      
      slots.push({
        time: timeString,
        display: displayString
      });
      
      // Move to next 30-minute slot
      if (currentSlotMinutes === 0) {
        currentSlotMinutes = 30;
      } else {
        currentSlotMinutes = 0;
        currentSlotHour = currentSlotHour + 1;
      }
    }

    // If no slots available today, return some default slots
    if (slots.length === 0) {
      return [
        { time: "10:00", display: "10:00 AM" },
        { time: "10:30", display: "10:30 AM" },
        { time: "11:00", display: "11:00 AM" },
        { time: "11:30", display: "11:30 AM" },
        { time: "12:00", display: "12:00 PM" }
      ];
    }

    return slots;
  };

  // Start immediate delivery
  const startDelivery = async (orderData) => {
    if (!selectedConversation || !currentUser || !isSeller) {
      alert('Cannot start delivery - invalid session.');
      return;
    }

    if (!orderData || !orderData.orderId) {
      alert('Invalid order data for delivery.');
      return;
    }

    // Check if delivery is already in progress using improved logic
    if (isDeliveryInProgress(orderData.orderId)) {
      alert('Delivery is already in progress for this order.');
      return;
    }

    try {
      // Find the pickup code from payment messages for this order
      let pickupCode = null;
      const paymentMessage = messages.find(msg => 
        (msg.messageType === 'payment_completed' || msg.messageType === 'payment_notification') &&
        msg.paymentData?.orderId === orderData.orderId &&
        msg.paymentData?.pickupCode
      );
      
      if (paymentMessage) {
        pickupCode = paymentMessage.paymentData.pickupCode;
      }

      // Format order items for delivery message
      const orderDetails = orderData.items?.map(item => 
        `• ${item.name || item.itemName} x${item.quantity} - ${getCurrencySymbol(orderData.currency)}${formatPrice((item.price || item.subtotal) * (item.quantity || 1), orderData.currency)}`
      ).join('\n') || 'Order items not available';

      const conversationId = selectedConversation.id || 
        [selectedConversation.otherUserId, currentUser.uid].sort().join('_');

      // Enhanced message to customer with pickup code reminder and order details
      const customerMessage = pickupCode 
        ? `🚚 DELIVERY STARTED!\n\nOrder ID: ${orderData.orderId}\n\n📦 YOUR ORDER:\n${orderDetails}\n\nTotal: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}\n\nYour order is now on the way!\n\nEstimated delivery time: 15-30 minutes\n\n🎫 IMPORTANT REMINDER:\nYour pickup code is: ${pickupCode}\n\n⚠️ PLEASE HAVE THIS CODE READY when the delivery arrives. You MUST provide this code to the seller before receiving your order.\n\n📱 Save this code or take a screenshot for easy access when the delivery arrives.`
        : `🚚 DELIVERY STARTED!\n\nOrder ID: ${orderData.orderId}\n\n📦 YOUR ORDER:\n${orderDetails}\n\nTotal: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}\n\nYour order is now on the way!\n\nEstimated delivery time: 15-30 minutes\n\nYou'll receive a notification when the delivery arrives.`;

      const deliveryMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        receiverEmail: selectedConversation.otherUserEmail,
        message: customerMessage,
        messageType: 'delivery_started',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...orderData,
          deliveryType: 'immediate',
          deliveryStarted: new Date().toISOString(),
          estimatedArrival: new Date(Date.now() + 25 * 60 * 1000).toISOString(), // 25 min estimate
          pickupCode: pickupCode
        }
      };

      await addDoc(collection(db, 'messages'), deliveryMessage);

      // Send reminder message to seller about pickup code verification
      if (pickupCode) {
        const sellerReminderMessage = {
          conversationId: conversationId,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          senderEmail: currentUser.email,
          receiverId: currentUser.uid, // Send to seller (self)
          receiverName: currentUser.displayName || currentUser.email,
          message: `🚚 DELIVERY REMINDER FOR YOU:\n\nOrder ID: ${orderData.orderId}\nCustomer: ${selectedConversation.otherUserName}\nPickup Code: ${pickupCode}\n\n⚠️ IMPORTANT:\n• Customer will provide the pickup code: ${pickupCode}\n• DO NOT hand over the order without receiving this code\n• Verify the code matches before giving the order\n• Go to Wallet tab to validate the pickup code when customer arrives\n\n📱 The customer has been reminded to have their pickup code ready.`,
          messageType: 'seller_delivery_reminder',
          timestamp: serverTimestamp(),
          isRead: false,
          orderData: {
            ...orderData,
            pickupCode: pickupCode,
            reminderType: 'pickup_code_verification'
          }
        };

        await addDoc(collection(db, 'messages'), sellerReminderMessage);
      }

      // Update delivery status in database if needed
      const deliveryRecord = {
        orderId: orderData.orderId,
        sellerId: currentUser.uid,
        customerId: selectedConversation.otherUserId,
        status: 'in_progress',
        deliveryType: 'immediate',
        startedAt: serverTimestamp(),
        estimatedArrival: new Date(Date.now() + 25 * 60 * 1000),
        pickupCode: pickupCode
      };

      await addDoc(collection(db, 'deliveries'), deliveryRecord);

      const deliveryOrderDetails = orderData.items?.map(item => 
        `${item.name || item.itemName} x${item.quantity}`
      ).join(', ') || 'Order items';

      const notification = document.createElement('div');
      notification.innerHTML = pickupCode 
        ? `🚚 Delivery started! Customer reminded about pickup code: ${pickupCode}<br>Order: ${deliveryOrderDetails}`
        : `🚚 Delivery started! Customer has been notified.<br>Order: ${deliveryOrderDetails}`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22C55E;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 5000);

    } catch (error) {
      console.error('Error starting delivery:', error);
      alert('Failed to start delivery. Please try again.');
    }
  };

  // Open delivery scheduling modal
  const openDeliveryModal = (orderData) => {
    setSelectedOrderForDelivery(orderData);
    setDeliverySettings({
      deliveryType: 'immediate',
      scheduledDate: new Date().toISOString().split('T')[0], // Set today's date as default
      scheduledTime: '',
      timeSlot: 'morning',
      deliveryAddress: '',
      specialInstructions: ''
    });
    setShowDeliveryModal(true);
  };

  // Schedule delivery
  const scheduleDelivery = async () => {
    if (!selectedOrderForDelivery || !selectedConversation || !currentUser) {
      alert('Cannot schedule delivery - invalid data.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Check if this is a reschedule (after cancellation)
      const isReschedule = isDeliveryCancelled(selectedOrderForDelivery.orderId);

      // Format order items for scheduling message
      const schedulingOrderDetails = selectedOrderForDelivery.items?.map(item => 
        `• ${item.name || item.itemName} x${item.quantity} - ${getCurrencySymbol(selectedOrderForDelivery.currency)}${formatPrice((item.price || item.subtotal) * (item.quantity || 1), selectedOrderForDelivery.currency)}`
      ).join('\n') || 'Order items not available';

      let deliveryFee = 0;
      let deliveryMessage = '';
      let scheduledDateTime = null;

      const messagePrefix = isReschedule ? '🔄 DELIVERY RESCHEDULED' : '📋 DELIVERY SCHEDULED';

      if (deliverySettings.deliveryType === 'immediate') {
        deliveryMessage = `${messagePrefix}\n\nOrder ID: ${selectedOrderForDelivery.orderId}\n\n📦 ORDER ITEMS:\n${schedulingOrderDetails}\n\nTotal: ${getCurrencySymbol(selectedOrderForDelivery.currency)}${formatPrice(selectedOrderForDelivery.totalAmount, selectedOrderForDelivery.currency)}\n\n${isReschedule ? 'Customer has rescheduled delivery.\n\n' : ''}Delivery Type: Immediate delivery requested\n\nThe seller will start delivery as soon as possible.\n\nEstimated time: 15-30 minutes`;
      } else if (deliverySettings.deliveryType === 'scheduled') {
        const scheduledDate = new Date(deliverySettings.scheduledDate);
        const [hour, minute] = deliverySettings.scheduledTime.split(':');
        scheduledDate.setHours(parseInt(hour), parseInt(minute));
        scheduledDateTime = scheduledDate.toISOString();

        deliveryMessage = `${messagePrefix}\n\nOrder ID: ${selectedOrderForDelivery.orderId}\n\n📦 ORDER ITEMS:\n${schedulingOrderDetails}\n\nTotal: ${getCurrencySymbol(selectedOrderForDelivery.currency)}${formatPrice(selectedOrderForDelivery.totalAmount, selectedOrderForDelivery.currency)}\n\n${isReschedule ? 'Customer has rescheduled delivery.\n\n' : ''}Scheduled for: ${scheduledDate.toLocaleDateString()} at ${deliverySettings.scheduledTime}\n\nDelivery Fee: FREE (same day)\n\nThe seller will deliver at the scheduled time.`;
      } else if (deliverySettings.deliveryType === 'next_day') {
        deliveryFee = deliveryPricing[deliverySettings.timeSlot];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let timeRange = '';
        switch (deliverySettings.timeSlot) {
          case 'morning':
            timeRange = '9:00 AM - 12:00 PM';
            break;
          case 'afternoon':
            timeRange = '12:00 PM - 5:00 PM';
            break;
          case 'evening':
            timeRange = '5:00 PM - 8:00 PM';
            break;
        }

        deliveryMessage = `${messagePrefix}\n\nOrder ID: ${selectedOrderForDelivery.orderId}\n\n📦 ORDER ITEMS:\n${schedulingOrderDetails}\n\nTotal: ${getCurrencySymbol(selectedOrderForDelivery.currency)}${formatPrice(selectedOrderForDelivery.totalAmount, selectedOrderForDelivery.currency)}\n\n${isReschedule ? 'Customer has rescheduled delivery.\n\n' : ''}Next Day Delivery\nDate: ${tomorrow.toLocaleDateString()}\nTime: ${timeRange}\n\nDelivery Fee: ${getCurrencySymbol('GBP')}${deliveryFee.toFixed(2)}\n\nThe seller will deliver during the selected time window.`;
      }

      if (deliverySettings.deliveryAddress) {
        deliveryMessage += `\n\nDelivery Address: ${deliverySettings.deliveryAddress}`;
      }

      if (deliverySettings.specialInstructions) {
        deliveryMessage += `\n\nSpecial Instructions: ${deliverySettings.specialInstructions}`;
      }

      const message = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: deliveryMessage,
        messageType: isReschedule ? 'delivery_rescheduled' : 'delivery_scheduled',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...selectedOrderForDelivery,
          deliverySettings: deliverySettings,
          deliveryFee: deliveryFee,
          scheduledDateTime: scheduledDateTime,
          isReschedule: isReschedule
        }
      };

      // Only add receiverEmail if it exists and is not empty
      if (selectedConversation.otherUserEmail) {
        message.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), message);

      setShowDeliveryModal(false);
      setSelectedOrderForDelivery(null);

      const notification = document.createElement('div');
      notification.innerHTML = isReschedule ? `🔄 Delivery rescheduled successfully!` : `📋 Delivery scheduled successfully!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22C55E;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

    } catch (error) {
      console.error('Error scheduling delivery:', error);
      alert('Failed to schedule delivery. Please try again.');
    }
  };

  // Show delivery confirmation popup
  const showDeliveryConfirmation = (orderData) => {
    setPendingDeliveryOrder(orderData);
    setShowDeliveryConfirmModal(true);
  };

  // Handle confirming delivery and redirect to wallet
  const confirmDeliveryAndRedirect = () => {
    setShowDeliveryConfirmModal(false);
    setPendingDeliveryOrder(null);
    // Navigate to wallet tab for code validation
    navigate('/messages', { state: { activeTab: 'wallet' } });
    setActiveTab('wallet');
  };

  // Complete delivery (for sellers)
  const completeDelivery = async (orderData) => {
    if (!selectedConversation || !currentUser || !isSeller) {
      alert('Cannot complete delivery - invalid session.');
      return;
    }

    if (!orderData || !orderData.orderId) {
      alert('Invalid order data for delivery completion.');
      return;
    }

    // Check if delivery is already completed
    if (isDeliveryCompleted(orderData.orderId)) {
      alert('Delivery is already completed for this order.');
      return;
    }

    try {
      // Format order items for completion message
      const completionOrderDetails = orderData.items?.map(item => 
        `• ${item.name || item.itemName} x${item.quantity} - ${getCurrencySymbol(orderData.currency)}${formatPrice((item.price || item.subtotal) * (item.quantity || 1), orderData.currency)}`
      ).join('\n') || 'Order items not available';

      const conversationId = selectedConversation.id || 
        [selectedConversation.otherUserId, currentUser.uid].sort().join('_');

      const completionMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        receiverEmail: selectedConversation.otherUserEmail,
        message: `✅ DELIVERY COMPLETED!\n\nOrder ID: ${orderData.orderId}\n\n📦 DELIVERED ITEMS:\n${completionOrderDetails}\n\nTotal: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}\n\nYour order has been delivered successfully!\n\nThank you for your business. We hope you enjoy your order!`,
        messageType: 'delivery_completed',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...orderData,
          deliveryCompleted: new Date().toISOString()
        }
      };

      await addDoc(collection(db, 'messages'), completionMessage);

      // Update delivery record
      const deliveriesQuery = query(
        collection(db, 'deliveries'),
        where('orderId', '==', orderData.orderId),
        where('sellerId', '==', currentUser.uid)
      );

      const deliverySnapshot = await getDocs(deliveriesQuery);
      if (!deliverySnapshot.empty) {
        const deliveryDoc = deliverySnapshot.docs[0];
        await updateDoc(doc(db, 'deliveries', deliveryDoc.id), {
          status: 'completed',
          completedAt: serverTimestamp()
        });
      }

      const notification = document.createElement('div');
      notification.innerHTML = `✅ Delivery marked as completed!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22C55E;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

    } catch (error) {
      console.error('Error completing delivery:', error);
      alert('Failed to complete delivery. Please try again.');
    }
  };

  // Cancel delivery and allow rescheduling (for customers)
  const cancelDelivery = async (orderData) => {
    if (!selectedConversation || !currentUser || isSeller) {
      alert('Cannot cancel delivery - invalid session.');
      return;
    }

    if (!orderData || !orderData.orderId) {
      alert('Invalid order data for delivery cancellation.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const cancelMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: `❌ DELIVERY CANCELLED\n\nOrder ID: ${orderData.orderId}\n\nCustomer has cancelled the current delivery.\n\nPlease wait for customer to reschedule or request a refund.`,
        messageType: 'delivery_cancelled',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...orderData,
          deliveryCancelledAt: new Date().toISOString()
        }
      };

      // Only add receiverEmail if it exists and is not empty
      if (selectedConversation.otherUserEmail) {
        cancelMessage.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), cancelMessage);

      // Update delivery status in database
      const deliveriesQuery = query(
        collection(db, 'deliveries'),
        where('orderId', '==', orderData.orderId),
        where('status', '==', 'in_progress')
      );
      
      const deliveriesSnapshot = await getDocs(deliveriesQuery);
      deliveriesSnapshot.docs.forEach(async (deliveryDoc) => {
        await updateDoc(deliveryDoc.ref, {
          status: 'cancelled',
          cancelledAt: serverTimestamp()
        });
      });

      const notification = document.createElement('div');
      notification.innerHTML = `❌ Delivery cancelled. Opening reschedule options...`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #F59E0B;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 2000);

      // Open the delivery scheduling modal after successful cancellation
      setTimeout(() => {
        openDeliveryModal(orderData);
      }, 500);

    } catch (error) {
      console.error('Error cancelling delivery:', error);
      alert('Failed to cancel delivery. Please try again.');
    }
  };

  // Request refund (for customers)
  const requestRefund = async (orderData) => {
    if (!selectedConversation || !currentUser || isSeller) {
      alert('Cannot request refund - invalid session.');
      return;
    }

    if (!orderData || !orderData.orderId) {
      alert('Invalid order data for refund request.');
      return;
    }

    const reason = prompt('Please provide a reason for the refund request:');
    if (!reason) return;

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const refundMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        receiverEmail: selectedConversation.otherUserEmail,
        message: `💰 REFUND REQUESTED\n\nOrder ID: ${orderData.orderId}\nReason: ${reason}\n\nCustomer has requested a refund for this order.\n\nPlease review and process the refund request.`,
        messageType: 'refund_requested',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...orderData,
          refundReason: reason,
          refundRequestedAt: new Date().toISOString()
        }
      };

      await addDoc(collection(db, 'messages'), refundMessage);

      const notification = document.createElement('div');
      notification.innerHTML = `💰 Refund request sent to seller.`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #3B82F6;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

    } catch (error) {
      console.error('Error requesting refund:', error);
      alert('Failed to request refund. Please try again.');
    }
  };

  // Send delivery reminder to seller
  const sendDeliveryReminder = async (orderData) => {
    if (!selectedConversation || !currentUser) return;
    
    try {
      // Format order items for reminder message
      const reminderOrderDetails = orderData.items?.map(item => 
        `• ${item.name || item.itemName} x${item.quantity}`
      ).join('\n') || 'Order items not available';

      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const reminderMessage = {
        conversationId: conversationId,
        senderId: 'system',
        senderName: 'Delivery System',
        receiverId: currentUser.uid, // Send to the current user (seller who needs the reminder)
        receiverName: currentUser.displayName || currentUser.email,
        message: `🔔 DELIVERY REMINDER\n\nOrder ID: ${orderData.orderId}\n\n📦 ORDER TO DELIVER:\n${reminderOrderDetails}\n\nTotal: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}\n\nScheduled delivery time is approaching!\n\nPlease prepare for delivery within the next 15 minutes.\n\nClick "Deliver Now" when you start the delivery.`,
        messageType: 'delivery_reminder',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: orderData
      };

      // Add seller email if available
      if (currentUser.email) {
        reminderMessage.receiverEmail = currentUser.email;
      }

      await addDoc(collection(db, 'messages'), reminderMessage);
    } catch (error) {
      console.error('Error sending delivery reminder:', error);
    }
  };

  // Send delivery notification to customer when seller starts delivery
  const sendDeliveryNotification = async (orderData) => {
    if (!selectedConversation || !currentUser) return;
    
    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const notificationMessage = {
        conversationId: conversationId,
        senderId: 'system',
        senderName: 'Delivery System',
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: `📱 DELIVERY UPDATE\n\nOrder ID: ${orderData.orderId}\n\nYour seller is now preparing your delivery!\n\nExpected delivery time: 15-30 minutes\n\nYou'll receive another notification when your order is on the way.`,
        messageType: 'delivery_notification',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: orderData
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        notificationMessage.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), notificationMessage);
    } catch (error) {
      console.error('Error sending delivery notification:', error);
    }
  };

  // Signal items bagged (for sellers)
  const signalItemsBagged = async (orderData) => {
    if (!selectedConversation || !currentUser) {
      alert('Cannot proceed - conversation not found.');
      return;
    }

    // Validate orderData
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      alert('Invalid order data. Please try again.');
      return;
    }

    // Check if order has already been bagged
    if (isOrderAlreadyBagged(orderData.orderId)) {
      alert('This order has already been bagged and processed.');
      return;
    }

    // Create consistent conversation ID
    const conversationId = selectedConversation.id || 
      [selectedConversation.otherUserId, currentUser.uid].sort().join('_');

    // Ensure all values are properly defined
    const validItems = orderData.items.map(item => ({
      itemId: item.itemId || item.id || `item_${Date.now()}_${Math.random()}`,
      itemName: item.itemName || item.name || 'Unknown Item',
      name: item.itemName || item.name || 'Unknown Item', // Duplicate for compatibility
      price: Number(item.price) || (Number(item.subtotal) / Number(item.quantity)) || 0,
      quantity: Number(item.quantity) || 1,
      currency: item.currency || 'GBP',
      subtotal: Number(item.subtotal) || (Number(item.price) * Number(item.quantity)) || 0
    }));

    const totalAmount = Number(orderData.totalAmount) || validItems.reduce((total, item) => total + item.subtotal, 0);
    const currency = orderData.currency || validItems[0]?.currency || 'GBP';
    const orderId = orderData.orderId || `order_${Date.now()}`;

    // Calculate subtotal from items
    const subtotal = validItems.reduce((total, item) => total + item.subtotal, 0);

    // Calculate fees using seller's settings
    let deliveryFee = 0;
    let serviceFee = 0;
    
    try {
      const storeDoc = await getDoc(doc(db, 'stores', currentUser.uid));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        const feeSettings = storeData.feeSettings || {};

        // Calculate delivery fee (assuming delivery if not specified)
        if (feeSettings.deliveryEnabled) {
          if (feeSettings.freeDeliveryThreshold && subtotal >= feeSettings.freeDeliveryThreshold) {
            deliveryFee = 0; // Free delivery threshold met
          } else {
            deliveryFee = feeSettings.deliveryFee || 0;
          }
        }

        // Calculate service fee
        if (feeSettings.serviceFeeEnabled) {
          if (feeSettings.serviceFeeType === 'percentage') {
            serviceFee = subtotal * ((feeSettings.serviceFeeRate || 0) / 100);
            if (feeSettings.serviceFeeMax && serviceFee > feeSettings.serviceFeeMax) {
              serviceFee = feeSettings.serviceFeeMax;
            }
          } else {
            serviceFee = feeSettings.serviceFeeAmount || 0;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching fee settings:', error);
    }

    const finalTotalAmount = subtotal + deliveryFee + serviceFee;

    // Create fee breakdown text
    let feeBreakdown = '';
    if (deliveryFee > 0 || serviceFee > 0) {
      feeBreakdown = `\n💰 Cost Breakdown:
Subtotal: ${getCurrencySymbol(currency)}${formatPrice(subtotal, currency)}`;
      
      if (deliveryFee > 0) {
        feeBreakdown += `\nDelivery Fee: ${getCurrencySymbol(currency)}${formatPrice(deliveryFee, currency)}`;
      }
      
      if (serviceFee > 0) {
        feeBreakdown += `\nService Fee: ${getCurrencySymbol(currency)}${formatPrice(serviceFee, currency)}`;
      }
      
      feeBreakdown += `\nTotal: ${getCurrencySymbol(currency)}${formatPrice(finalTotalAmount, currency)}`;
    }

    const baggedMessage = `📦 ITEMS BAGGED

Order ID: ${orderId}

Your order has been prepared and bagged:

${validItems.map(item => 
  `• ${item.itemName} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.subtotal, item.currency)}`
).join('\n')}

${feeBreakdown || `Total Amount: ${getCurrencySymbol(currency)}${formatPrice(finalTotalAmount, currency)}`}

Please proceed with payment to complete your order.`;

    try {
      await addDoc(collection(db, 'messages'), {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        receiverEmail: selectedConversation.otherUserEmail,
        message: baggedMessage,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'items_bagged',
        orderData: {
          orderId: orderId,
          items: validItems,
          subtotal: Number(subtotal),
          deliveryFee: Number(deliveryFee),
          serviceFee: Number(serviceFee),
          totalAmount: Number(finalTotalAmount),
          currency: currency,
          status: 'ready_for_payment'
        }
      });

      const notification = document.createElement('div');
      notification.innerHTML = `✅ Customer notified that items are ready for payment!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22C55E;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

    } catch (error) {
      console.error('Error signaling items bagged:', error);
      alert('Failed to notify customer. Please try again.');
    }
  };

  // Updated addItemToOrder function - accumulates items for later finalization
  const addItemToOrder = async (item) => {
    // Check if order is already locked
    if (orderStatus === 'done_adding' || orderStatus === 'bagging') {
      alert('Order is locked. Cannot add more items.');
      return;
    }

    // Add to persisted order items instead of cart
    setPersistedOrderItems(prev => {
      const existingItem = prev.find(orderItem => orderItem.itemId === item.id);
      if (existingItem) {
        return prev.map(orderItem =>
          orderItem.itemId === item.id
            ? { ...orderItem, quantity: orderItem.quantity + 1, subtotal: orderItem.price * (orderItem.quantity + 1) }
            : orderItem
        );
      } else {
        return [...prev, {
          itemId: item.id,
          itemName: item.name,
          price: Number(item.price) || 0,
          currency: item.currency || 'GBP',
          quantity: 1,
          subtotal: Number(item.price) || 0,
          source: 'message'
        }];
      }
    });

    // Show success notification
    const notification = document.createElement('div');
    notification.innerHTML = `✅ "${item.name}" added to order! Click "Done Adding Items" when ready.`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #22C55E;
      color: white;
      padding: 1rem;
      border-radius: 8px;
      z-index: 1000;
      font-weight: 600;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  };

  // Helper functions
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    }
    
    // Less than 7 days
    if (diff < 604800000) {
      return `${Math.floor(diff / 86400000)}d ago`;
    }
    
    // Older than 7 days
    return date.toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return `£${Number(amount || 0).toFixed(2)}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'sale': return '💰';
      case 'withdrawal': return '🏦';
      case 'refund': return '↩️';
      default: return '💳';
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'sale': return '#22C55E';
      case 'withdrawal': return '#EF4444';
      case 'refund': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const filteredConversations = conversations
    .filter(conv =>
      conv.otherUserName?.toLowerCase().includes(search.toLowerCase()) ||
      conv.otherUserEmail?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by most recent message timestamp (newest first)
      const aTime = a.lastMessageTime?.toDate ? a.lastMessageTime.toDate() : new Date(a.lastMessageTime);
      const bTime = b.lastMessageTime?.toDate ? b.lastMessageTime.toDate() : new Date(b.lastMessageTime);
      return bTime - aTime;
    });

  if (loading) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <div className="messages-container" style={{ 
        height: 'calc(100vh - 80px)', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div className="messages-tabs">
          <button
            onClick={() => setActiveTab('messages')}
            className={`tab-button ${activeTab === 'messages' ? 'active' : ''}`}
            style={{ flex: isSeller ? 1 : '1' }}
          >
            Messages
          </button>
          {isSeller && (
            <button
              onClick={() => setActiveTab('wallet')}
              className={`tab-button ${activeTab === 'wallet' ? 'active' : ''}`}
            >
              Wallet
            </button>
          )}
        </div>

        {activeTab === 'messages' && (
          <div className="messages-content" style={{
            flex: 1,
            display: 'flex',
            height: 'calc(100vh - 140px)',
            overflow: 'hidden'
          }}>
            {/* Mobile: Show conversations or chat, not both */}
            <div className={`conversations-panel ${selectedConversation ? 'mobile-hidden' : ''}`}>
              <input
                type="text"
                placeholder={isSeller ? "Search customers" : "Search conversations"}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input"
              />
              
              {selectedConversation && (
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    setShowStoreItems(false);
                    setShowCart(false);
                  }}
                  className="back-button mobile-only"
                >
                  ← Back to conversations
                </button>
              )}

              {filteredConversations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <div className="empty-title">No conversations yet</div>
                  <div className="empty-subtitle">
                    {isSeller 
                      ? "Customer orders will appear here" 
                      : "Your conversations with vendors will appear here"
                    }
                  </div>
                </div>
              ) : (
                <div className="conversations-list">
                  {filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`conversation-item ${selectedConversation?.id === conversation.id ? 'selected' : ''}`}
                    >
                      <div className="conversation-content">
                        <div className="conversation-main">
                          <div className="conversation-name">
                            {conversation.otherUserName}
                          </div>
                          <div className="conversation-email">
                            {conversation.otherUserEmail && conversation.otherUserEmail !== 'store@example.com' ? conversation.otherUserEmail : ''}
                          </div>
                          <div className="conversation-preview">
                            {conversation.messageType === 'order_request' && '🛒 '}
                            {conversation.messageType === 'item_request' && '➕ '}
                            {conversation.lastMessage.substring(0, 60)}
                            {conversation.lastMessage.length > 60 ? '...' : ''}
                          </div>
                        </div>
                        <div className="conversation-meta">
                          <div className="conversation-time">
                            {formatMessageTime(conversation.lastMessageTime)}
                          </div>
                          {!conversation.isRead && <div className="unread-indicator" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Area */}
            {selectedConversation && (
              <div className={`chat-area ${selectedConversation ? 'mobile-visible' : 'mobile-hidden'}`}>
                <div className="chat-header">
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      setShowStoreItems(false);
                      setShowCart(false);
                    }}
                    className="back-button mobile-only"
                  >
                    ← Back
                  </button>
                  <div className="chat-user-info">
                    <div className="chat-user-name">
                      {selectedConversation.otherUserName}
                    </div>
                    <div className="chat-user-email">
                      {(() => {
                        const email = storeInfo?.email || selectedConversation.otherUserEmail;
                        return (email && email !== 'store@example.com') ? email : '';
                      })()}
                    </div>
                  </div>
                  
                  {!isSeller && (
                    <div className="header-buttons">
                      <button
                        onClick={() => setShowStoreItems(!showStoreItems)}
                        className={`browse-items-btn ${showStoreItems ? 'active' : ''} ${orderStatus !== 'shopping' ? 'disabled' : ''}`}
                        disabled={orderStatus !== 'shopping'}
                      >
                        {showStoreItems ? 'Hide Items' : '🛍️ Browse'}
                        {orderStatus !== 'shopping' && ' (Order Finalized)'}
                      </button>
                      
                      {cart.length > 0 && (
                        <button
                          onClick={() => setShowCart(!showCart)}
                          className={`cart-btn ${showCart ? 'active' : ''}`}
                        >
                          🛒 Cart ({getCartItemCount()})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="chat-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  <div className={`messages-area ${(showStoreItems || showCart) ? 'with-sidebar' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div className="messages-list" style={{
                      flex: 1,
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      height: '100%',
                      maxHeight: 'calc(100vh - 200px)',
                      padding: '1rem'
                    }}>
                      {loadingMessages ? (
                        <div className="loading-state">Loading messages...</div>
                      ) : (
                        messages
                          .filter(message => !message.deleted) // Filter out deleted messages
                          .map((message) => (
                          <div
                            key={message.id}
                            className={`message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`}
                          >
                            <div className="message-bubble">
                              <div className="message-content">
                                <div className="message-text">
                                  {message.message}
                                </div>
                                {message.senderId === currentUser.uid && (
                                  <button
                                    onClick={() => deleteMessage(message.id)}
                                    className="delete-message-btn"
                                    title="Delete message"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                              
                              {/* Special handling for order workflow messages */}
                              {message.messageType === 'order_request' && message.senderId === currentUser.uid && !isSeller && orderStatus === 'shopping' && (
                                <div className="message-actions">
                                  <button
                                    onClick={() => signalDoneAddingFromMessage(message.orderData)}
                                    className="action-btn done-message-btn"
                                    disabled={orderStatus !== 'shopping'}
                                  >
                                    ✅ Done Adding Items
                                  </button>
                                </div>
                              )}
                              
                              {message.messageType === 'done_adding' && message.receiverId === currentUser.uid && isSeller && (
                                <div className="message-actions">
                                  <button
                                    onClick={() => signalItemsBagged(message.orderData)}
                                    className={`action-btn bag-items-btn ${isOrderAlreadyBagged(message.orderData?.orderId) ? 'disabled' : ''}`}
                                    disabled={isOrderAlreadyBagged(message.orderData?.orderId)}
                                  >
                                    {isOrderAlreadyBagged(message.orderData?.orderId) ? '✅ Items Already Bagged' : '📦 Items Bagged & Ready'}
                                  </button>
                                </div>
                              )}
                              
                              {message.messageType === 'items_bagged' && message.receiverId === currentUser.uid && !isSeller && (
                                <div className="message-actions">
                                  <button 
                                    className="action-btn payment-btn"
                                    onClick={() => openPaymentModal(message.orderData)}
                                  >
                                    💳 Proceed to Payment
                                  </button>
                                </div>
                              )}

                              {/* Delivery buttons for sellers after payment notification */}
                              {message.messageType === 'payment_notification' && message.receiverId === currentUser?.uid && isSeller && (
                                <div className="message-actions">
                                  <button 
                                    className={`action-btn deliver-btn ${isDeliveryInProgress(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) || isDeliveryCompleted(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) ? 'disabled' : ''}`}
                                    disabled={isDeliveryInProgress(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) || isDeliveryCompleted(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId)}
                                    onClick={() => startDelivery(message.orderData || { orderId: message.paymentData?.displayInfo?.orderId, ...message.paymentData?.displayInfo })}
                                  >
                                    {isDeliveryInProgress(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) ? '🚚 Delivery in Progress' : 
                                     isDeliveryCompleted(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) ? '✅ Delivered' : '🚚 Deliver Now'}
                                  </button>
                                </div>
                              )}

                              {/* Delivery scheduling for customers after payment completion - only show if delivery not started */}
                              {message.messageType === 'payment_completed' && message.senderId === currentUser.uid && !isSeller && 
                               !isDeliveryInProgress(message.paymentData?.orderId) && !isDeliveryCompleted(message.paymentData?.orderId) && 
                               !isDeliveryCancelled(message.paymentData?.orderId) && (
                                <div className="message-actions">
                                  <button 
                                    className="action-btn schedule-delivery-btn"
                                    onClick={() => openDeliveryModal(message.paymentData)}
                                  >
                                    📋 Schedule Delivery
                                  </button>
                                </div>
                              )}

                              {/* Customer options after delivery cancellation - show reschedule option */}
                              {message.messageType === 'payment_completed' && message.senderId === currentUser.uid && !isSeller && 
                               isDeliveryCancelled(message.paymentData?.orderId) && !isDeliveryCompleted(message.paymentData?.orderId) && (
                                <div className="message-actions">
                                  <div className="delivery-status-info">
                                    ❌ <strong>Delivery Cancelled</strong> - You can reschedule below
                                  </div>
                                  <div className="delivery-actions">
                                    <button 
                                      className="action-btn schedule-delivery-btn"
                                      onClick={() => openDeliveryModal(message.paymentData)}
                                    >
                                      📋 Reschedule Delivery
                                    </button>
                                    <button 
                                      className="action-btn refund-btn"
                                      onClick={() => requestRefund(message.paymentData)}
                                      disabled={isRefundRequested(message.paymentData?.orderId)}
                                    >
                                      {isRefundRequested(message.paymentData?.orderId) ? '💰 Refund Requested' : '💰 Request Refund'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Show delivery status messages */}
                              {(message.messageType === 'delivery_started' || message.messageType === 'delivery_scheduled') && (
                                <div className="delivery-status">
                                  <div className="delivery-info">
                                    {message.messageType === 'delivery_started' && (
                                      (() => {
                                        // Check if this specific delivery was completed
                                        const thisDeliveryCompleted = isDeliveryCompleted(message.orderData?.orderId);
                                        
                                        // Check if there's a newer delivery_started message for this order
                                        const newerDeliveryStarted = messages.find(msg => 
                                          msg.messageType === 'delivery_started' && 
                                          msg.orderData?.orderId === message.orderData?.orderId &&
                                          msg.timestamp && message.timestamp &&
                                          msg.timestamp.toMillis() > message.timestamp.toMillis()
                                        );
                                        
                                        // If there's a newer delivery started, this one was superseded (cancelled for reschedule)
                                        if (newerDeliveryStarted) {
                                          return '❌ Delivery cancelled (rescheduled)';
                                        }
                                        
                                        // If this delivery was completed, show completed
                                        if (thisDeliveryCompleted) {
                                          return '✅ Delivery completed';
                                        }
                                        
                                        // Otherwise, this is the active delivery in progress
                                        return '🚚 Delivery in progress';
                                      })()
                                    )}
                                    {message.messageType === 'delivery_scheduled' && '📋 Delivery scheduled'}
                                  </div>
                                  
                                  {/* Customer action buttons for delivery_started messages - only show for current active delivery */}
                                  {message.messageType === 'delivery_started' && message.receiverId === currentUser.uid && !isSeller && 
                                   !isDeliveryCompleted(message.orderData?.orderId) && 
                                   (() => {
                                     // Only show buttons if this is the CURRENT active delivery (no newer delivery_started for this order)
                                     const newerDeliveryStarted = messages.find(msg => 
                                       msg.messageType === 'delivery_started' && 
                                       msg.orderData?.orderId === message.orderData?.orderId &&
                                       msg.timestamp && message.timestamp &&
                                       msg.timestamp.toMillis() > message.timestamp.toMillis()
                                     );
                                     return !newerDeliveryStarted;
                                   })() && (
                                    <div className="message-actions">
                                      <div className="delivery-actions">
                                        <button 
                                          className="action-btn cancel-delivery-btn"
                                          onClick={() => cancelDelivery(message.orderData)}
                                        >
                                          ❌ Cancel & Reschedule
                                        </button>
                                        <button 
                                          className="action-btn refund-btn"
                                          onClick={() => requestRefund(message.orderData)}
                                          disabled={isRefundRequested(message.orderData?.orderId)}
                                        >
                                          {isRefundRequested(message.orderData?.orderId) ? '💰 Refund Requested' : '💰 Request Refund'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Complete delivery button for sellers when delivery is in progress and not cancelled */}
                              {message.messageType === 'delivery_started' && message.senderId === currentUser.uid && isSeller && 
                               !isDeliveryCompleted(message.orderData?.orderId) && 
                               (() => {
                                 // Only show button if this is the CURRENT active delivery (no newer delivery_started for this order)
                                 const newerDeliveryStarted = messages.find(msg => 
                                   msg.messageType === 'delivery_started' && 
                                   msg.orderData?.orderId === message.orderData?.orderId &&
                                   msg.timestamp && message.timestamp &&
                                   msg.timestamp.toMillis() > message.timestamp.toMillis()
                                 );
                                 return !newerDeliveryStarted;
                               })() && (
                                <div className="message-actions">
                                  <button 
                                    className="action-btn deliver-btn"
                                    onClick={() => showDeliveryConfirmation(message.orderData)}
                                  >
                                    ✅ Mark as Delivered
                                  </button>
                                </div>
                              )}

                              {/* Deliver Now button for scheduled deliveries */}
                              {(message.messageType === 'delivery_scheduled' || message.messageType === 'delivery_rescheduled') && 
                               isSeller && (
                                <div className="message-actions">
                                  {(() => {
                                    const now = new Date();
                                    let canDeliver = true;
                                    let buttonClass = "action-btn deliver-btn";
                                    let buttonText = "🚚 Deliver Now";
                                    
                                    // Check if it's a scheduled delivery with a specific time
                                    if (message.orderData?.deliverySettings?.deliveryType === 'scheduled' && 
                                        message.orderData?.scheduledDateTime) {
                                      const scheduledTime = new Date(message.orderData.scheduledDateTime);
                                      const timeDiff = scheduledTime.getTime() - now.getTime();
                                      
                                      if (timeDiff > 0) {
                                        canDeliver = false;
                                        buttonClass += " faded";
                                        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                                        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                                        if (hours > 0) {
                                          buttonText = `⏰ Available in ${hours}h ${minutes}m`;
                                        } else {
                                          buttonText = `⏰ Available in ${minutes}m`;
                                        }
                                      } else {
                                        // Time has passed, can deliver now
                                        buttonText = "🚚 Deliver Now";
                                        buttonClass += " pulsing";
                                      }
                                    }
                                    
                                    return (
                                      <button 
                                        className={buttonClass}
                                        onClick={() => {
                                          if (canDeliver) {
                                            startDelivery(message.orderData);
                                          } else {
                                            alert('Delivery can only be started at the scheduled time.');
                                          }
                                        }}
                                        disabled={!canDeliver}
                                      >
                                        {buttonText}
                                      </button>
                                    );
                                  })()}
                                </div>
                              )}
                              
                              <div className="message-time">
                                {formatMessageTime(message.timestamp)}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="message-input-area">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type your message..."
                        className="message-input"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className="send-button"
                      >
                        Send
                      </button>
                      
                      {!isSeller && (
                        <div className="mobile-action-buttons">
                          <button
                            onClick={() => setShowStoreItems(!showStoreItems)}
                            className={`mobile-browse-btn ${showStoreItems ? 'active' : ''} ${orderStatus !== 'shopping' ? 'disabled' : ''}`}
                            disabled={orderStatus !== 'shopping'}
                          >
                            {showStoreItems ? 'Hide Items' : '🛍️ Browse'}
                            {orderStatus !== 'shopping' && ' (Order Finalized)'}
                          </button>
                          
                          {cart.length > 0 && (
                            <button
                              onClick={() => setShowCart(!showCart)}
                              className={`mobile-cart-btn ${showCart ? 'active' : ''}`}
                            >
                              🛒 Cart ({getCartItemCount()})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shopping Cart Sidebar - Enhanced with better pricing display */}
                  {showCart && !isSeller && (
                    <div className="cart-sidebar">
                      <div className="cart-header">
                        <div className="cart-header-top">
                          <h3>🛒 Shopping Cart</h3>
                          <div className="cart-header-buttons">
                            <button 
                              className="collapse-all-btn"
                              onClick={() => {
                                const allCollapsed = Object.values(cartSectionsCollapsed).every(val => val);
                                setCartSectionsCollapsed({
                                  items: !allCollapsed,
                                  calculation: !allCollapsed
                                });
                              }}
                            >
                              {Object.values(cartSectionsCollapsed).every(val => val) ? '📖 Expand All' : '📕 Collapse All'}
                            </button>
                            <button 
                              className="close-cart-btn"
                              onClick={() => setShowCart(false)}
                              title="Close Cart"
                            >
                              ✕ Close Cart
                            </button>
                          </div>
                        </div>
                        {orderStatus !== 'shopping' && (
                          <div className="cart-locked-indicator">
                            🔒 Cart Locked - Order Finalized
                          </div>
                        )}
                        <div className="cart-summary">
                          <div className="cart-item-count">
                            {getCartItemCount()} {getCartItemCount() === 1 ? 'Item' : 'Items'}
                          </div>
                          <div className="cart-total-large">
                            {getCurrencySymbol(cart[0]?.currency || 'GBP')}{formatPrice(getCartTotal(), cart[0]?.currency || 'GBP')}
                          </div>
                        </div>
                        <div className="payment-methods-preview">
                          <span className="payment-preview-label">Payment options:</span>
                          <div className="payment-icons-preview">
                            {getPaymentMethods(cart[0]?.currency || 'GBP').slice(0, 4).map((method) => (
                              <span key={method.id} className="payment-icon-small" title={method.name}>
                                {method.icon}
                              </span>
                            ))}
                            {getPaymentMethods(cart[0]?.currency || 'GBP').length > 4 && (
                              <span className="payment-more">+{getPaymentMethods(cart[0]?.currency || 'GBP').length - 4}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {cart.length === 0 ? (
                        <div className="empty-state">
                          <div className="empty-icon">🛒</div>
                          <div className="empty-title">Your cart is empty</div>
                          <div className="empty-subtitle">Add items from the store to get started</div>
                        </div>
                      ) : (
                        <>
                          <div className="cart-content-wrapper">
                            <div className="cart-section">
                              <div 
                                className="cart-section-header" 
                                onClick={() => toggleCartSection('items')}
                              >
                                <span>Cart Items ({cart.length})</span>
                                <span className="collapse-icon">
                                  {cartSectionsCollapsed.items ? '▼' : '▲'}
                                </span>
                              </div>
                              {!cartSectionsCollapsed.items && (
                                <div className="cart-items">
                                  {cart.map(item => (
                                  <div key={item.id} className="cart-item">
                                    <div className="cart-item-content">
                                      {item.image && (
                                        <img 
                                          src={item.image} 
                                          alt={item.name}
                                          className="cart-item-image"
                                        />
                                      )}
                                      <div className="cart-item-details">
                                        <div className="cart-item-name">{item.name}</div>
                                        <div className="cart-item-price">
                                          {getCurrencySymbol(item.currency)}{formatPrice(item.price, item.currency)} each
                                        </div>
                                        <div className="cart-item-subtotal">
                                          Subtotal: {getCurrencySymbol(item.currency)}{formatPrice(item.price * item.quantity, item.currency)}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="cart-item-controls">
                                      <div className="quantity-controls">
                                        <button
                                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                          className="quantity-btn"
                                          disabled={item.quantity <= 1 || orderStatus !== 'shopping'}
                                        >
                                          -
                                        </button>
                                        <span className="quantity">{item.quantity}</span>
                                        <button
                                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                          className="quantity-btn"
                                          disabled={item.quantity >= item.availableQuantity || orderStatus !== 'shopping'}
                                        >
                                          +
                                        </button>
                                      </div>
                                      {/* REMOVE BUTTON - What you specifically asked for */}
                                      <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="remove-btn"
                                        title="Remove item from cart"
                                        disabled={orderStatus !== 'shopping'}
                                      >
                                        🗑️ Remove
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Price Breakdown Section */}
                          <div className="cart-section">
                            <div 
                              className="cart-section-header" 
                              onClick={() => toggleCartSection('calculation')}
                            >
                              <span>Order Summary</span>
                              <span className="collapse-icon">
                                {cartSectionsCollapsed.calculation ? '▼' : '▲'}
                              </span>
                            </div>
                            {!cartSectionsCollapsed.calculation && (
                              <div className="cart-calculation">
                                <div className="calculation-row">
                                  <span>Items ({getCartItemCount()}):</span>
                                  <span>{getCurrencySymbol(cart[0]?.currency || 'GBP')}{formatPrice(getCartTotal(), cart[0]?.currency || 'GBP')}</span>
                                </div>
                                <div className="calculation-row">
                                  <span>Delivery:</span>
                                  <span>TBD</span>
                                </div>
                                <div className="calculation-divider"></div>
                                <div className="calculation-row total">
                                  <span>Total:</span>
                                  <span>{getCurrencySymbol(cart[0]?.currency || 'GBP')}{formatPrice(getCartTotal(), cart[0]?.currency || 'GBP')}</span>
                                </div>
                              </div>
                            )}
                          </div>
                          </div>

                          <div className="cart-actions">
                            {orderStatus === 'shopping' ? (
                              <>
                                <button
                                  onClick={clearCart}
                                  className="clear-cart-btn"
                                  disabled={orderStatus !== 'shopping'}
                                >
                                  Clear All
                                </button>
                                <button
                                  onClick={sendCartAsOrder}
                                  className="send-order-btn"
                                  disabled={orderStatus !== 'shopping'}
                                >
                                  Send Order
                                </button>
                                <button
                                  onClick={() => openPaymentModal()}
                                  className="quick-pay-btn"
                                  disabled={orderStatus !== 'shopping' || cart.length === 0}
                                >
                                  💳 Quick Pay
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={resetOrderState}
                                className="new-order-btn"
                                style={{
                                  width: '100%',
                                  padding: '1rem',
                                  backgroundColor: '#3B82F6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '1rem',
                                  fontWeight: '600'
                                }}
                              >
                                🛒 Start New Order
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Store Items Sidebar - Updated */}
                  {showStoreItems && !isSeller && (
                    <div className="items-sidebar">
                      <div className="items-header">
                        Available Items
                        {cart.length > 0 && (
                          <div className="cart-indicator">
                            Cart: {getCartItemCount()} items
                          </div>
                        )}
                        {orderStatus === 'done_adding' && (
                          <div className="status-indicator done">
                            ✅ Order finalized - No more items can be added
                            <button
                              onClick={resetOrderState}
                              className="new-order-btn"
                              style={{
                                marginLeft: '1rem',
                                padding: '0.5rem 1rem',
                                backgroundColor: '#3B82F6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                              }}
                            >
                              🛒 Start New Order
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {loadingItems ? (
                        <div className="loading-state">Loading items...</div>
                      ) : storeItems.length === 0 ? (
                        <div className="empty-state">
                          <div className="empty-icon">📦</div>
                          <div className="empty-title">No items available</div>
                        </div>
                      ) : (
                        <div className="items-list">
                          {storeItems.map(item => {
                            const cartItem = cart.find(cartItem => cartItem.id === item.id);
                            const inCart = cartItem ? cartItem.quantity : 0;
                            
                            return (
                              <div
                                key={item.id}
                                className="item-card"
                              >
                                <div className="item-content">
                                  {item.image && (
                                    <img 
                                      src={item.image} 
                                      alt={item.name}
                                      className="item-image"
                                    />
                                  )}
                                  <div className="item-details">
                                    <div className="item-name">{item.name}</div>
                                    <div className="item-price">
                                      {getCurrencySymbol(item.currency)}{formatPrice(item.price, item.currency)}
                                    </div>
                                    <div className="item-meta">
                                      Quality: {item.quality}
                                    </div>
                                    <div className="item-meta">
                                      Available: {item.quantity}
                                    </div>
                                    {inCart > 0 && (
                                      <div className="item-in-cart">
                                        In cart: {inCart}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => addItemToCart(item)}
                                  className="add-to-cart-btn"
                                  disabled={inCart >= item.quantity || orderStatus !== 'shopping'}
                                >
                                  {orderStatus !== 'shopping' ? 'Order Locked' : 
                                   inCart >= item.quantity ? 'Max Added' : 'Add to Cart'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'wallet' && isSeller && (
          <div className="wallet-content">
            {loadingWallet ? (
              <div className="loading-state">Loading wallet...</div>
            ) : (
              <>
                <div className="wallet-overview">
                  <div className="wallet-header">
                    <h3 className="section-title">Wallet Overview</h3>
                    <button
                      onClick={() => setShowFeeSettings(true)}
                      className="fee-settings-btn"
                    >
                      ⚙️ Fee Settings
                    </button>
                  </div>
                  
                  <div className="balance-cards">
                    <div className="balance-card available">
                      <div className="balance-label">Available Balance</div>
                      <div className="balance-amount">
                        {formatCurrency(walletData.balance)}
                      </div>
                    </div>

                    <div className="balance-card pending">
                      <div className="balance-label">Pending</div>
                      <div className="balance-amount">
                        {formatCurrency(walletData.pendingBalance)}
                      </div>
                    </div>

                    <div className="balance-card total">
                      <div className="balance-label">Total Earnings</div>
                      <div className="balance-amount">
                        {formatCurrency(walletData.totalEarnings)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (walletData.balance > 0) {
                        alert('Withdrawal functionality will be implemented soon!');
                      } else {
                        alert('No available balance to withdraw');
                      }
                    }}
                    disabled={walletData.balance <= 0}
                    className="withdraw-button"
                  >
                    Withdraw Available Balance
                  </button>

                  {/* Pickup Code Validation Section */}
                  <div className="pickup-validation-section">
                    <h4 className="pickup-title">🎫 Validate Pickup Code</h4>
                    <p className="pickup-description">
                      Enter the customer's pickup code to confirm order collection
                    </p>
                    <div className="pickup-input-section">
                      <input
                        type="text"
                        placeholder="Enter 6-digit pickup code"
                        maxLength={6}
                        className="pickup-code-input"
                        onInput={(e) => {
                          // Auto-uppercase and limit to alphanumeric
                          e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const code = e.target.value.trim();
                            if (code.length === 6) {
                              validatePickupCode(code);
                              e.target.value = '';
                            } else {
                              alert('Please enter a complete 6-digit pickup code');
                            }
                          }
                        }}
                      />
                      <button
                        className="validate-pickup-btn"
                        onClick={(e) => {
                          const input = e.target.parentElement.querySelector('.pickup-code-input');
                          const code = input.value.trim();
                          if (code.length === 6) {
                            validatePickupCode(code);
                            input.value = '';
                          } else {
                            alert('Please enter a complete 6-digit pickup code');
                          }
                        }}
                      >
                        Validate
                      </button>
                    </div>
                  </div>
                </div>

                <div className="transactions-section">
                  <h3 className="section-title">Recent Transactions</h3>
                  
                  {walletData.transactions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">💳</div>
                      <div className="empty-title">No transactions yet</div>
                      <div className="empty-subtitle">Your sales and earnings will appear here</div>
                    </div>
                  ) : (
                    <div className="transactions-list">
                      {walletData.transactions.map((transaction) => (
                        <div key={transaction.id} className="transaction-item">
                          <div className="transaction-info">
                            <div className="transaction-icon">
                              {getTransactionIcon(transaction.type)}
                            </div>
                            <div className="transaction-details">
                              <div className="transaction-description">
                                {transaction.description || `${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)} Transaction`}
                              </div>
                              <div className="transaction-date">
                                {formatDate(transaction.createdAt)}
                              </div>
                              {transaction.orderId && (
                                <div className="transaction-order">
                                  Order: {transaction.orderId.slice(-8)}
                                </div>
                              )}
                              {transaction.pickupCode && (
                                <div className="transaction-pickup">
                                  <span className="pickup-code-label">Pickup Code: </span>
                                  <span className="pickup-code">{transaction.pickupCode}</span>
                                  <span className={`pickup-status ${transaction.pickupStatus || 'pending'}`}>
                                    {transaction.pickupStatus === 'collected' ? '✅ Collected' : '⏳ Pending'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="transaction-right">
                            <div
                              className="transaction-amount"
                              style={{ color: getTransactionColor(transaction.type) }}
                            >
                              {transaction.type === 'withdrawal' ? '-' : '+'}
                              {formatCurrency(Math.abs(transaction.amount))}
                            </div>
                            {transaction.pickupCode && transaction.pickupStatus === 'pending' && (
                              <button
                                className="quick-validate-btn"
                                onClick={() => validatePickupCode(transaction.pickupCode)}
                                title="Quick validate this pickup code"
                              >
                                Validate
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="payment-modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h2>Complete Your Payment</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowPaymentModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-content">
              {/* Debug Info - can be removed in production */}
              {process.env.NODE_ENV === 'development' && (
                <div style={{ 
                  background: '#f0f0f0', 
                  padding: '0.5rem', 
                  borderRadius: '4px', 
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                  fontFamily: 'monospace'
                }}>
                  <strong>Debug Info:</strong><br/>
                  Items: {paymentData.items?.length || 0}<br/>
                  Currency: {paymentData.currency}<br/>
                  Subtotal: {paymentData.subtotal}<br/>
                  Total: {paymentData.total}
                </div>
              )}

              {/* Order Summary */}
              <div className="payment-section">
                <h3>Order Summary</h3>
                <div className="order-summary">
                  {paymentData.items && paymentData.items.length > 0 ? (
                    paymentData.items.map((item, index) => (
                      <div key={index} className="summary-item">
                        <span className="item-name">
                          {item.name || 'Unknown Item'} × {item.quantity || 1}
                        </span>
                        <span className="item-total">
                          {getCurrencySymbol(paymentData.currency)}
                          {formatPrice((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1), paymentData.currency)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="summary-item">
                      <span>No items found</span>
                      <span>—</span>
                    </div>
                  )}
                  
                  <div className="summary-breakdown">
                    <div className="breakdown-row">
                      <span>Subtotal:</span>
                      <span>
                        {getCurrencySymbol(paymentData.currency)}
                        {formatPrice(paymentData.subtotal || 0, paymentData.currency)}
                      </span>
                    </div>
                    {paymentData.feeBreakdown?.deliveryEnabled && (
                      <div className="breakdown-row">
                        <span>Delivery Fee:</span>
                        <span>
                          {(paymentData.deliveryFee || 0) === 0 ? 'FREE' : 
                           `${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.deliveryFee || 0, paymentData.currency)}`}
                        </span>
                      </div>
                    )}
                    {paymentData.feeBreakdown?.serviceFeeEnabled && (
                      <div className="breakdown-row">
                        <span>Service Fee:</span>
                        <span>
                          {getCurrencySymbol(paymentData.currency)}
                          {formatPrice(paymentData.serviceFee || 0, paymentData.currency)}
                        </span>
                      </div>
                    )}
                    {!paymentData.feeBreakdown?.deliveryEnabled && !paymentData.feeBreakdown?.serviceFeeEnabled && (
                      <div className="breakdown-row no-fees">
                        <span style={{ color: '#22c55e', fontSize: '0.85rem' }}>
                          🎉 No additional fees! Store hasn't configured delivery or service fees.
                        </span>
                      </div>
                    )}
                    <div className="breakdown-total">
                      <span>Total:</span>
                      <span>
                        {getCurrencySymbol(paymentData.currency)}
                        {formatPrice(paymentData.total || 0, paymentData.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="payment-section">
                <h3>Choose Payment Method</h3>
                <div className="payment-methods">
                  {getPaymentMethods(paymentData.currency).map((method) => (
                    <div 
                      key={method.id}
                      className={`payment-method ${selectedPaymentMethod === method.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedPaymentMethod(method.id);
                        if (method.id === 'apple_pay') {
                          // Show Apple Pay form immediately when selected
                          setShowCardForm(false);
                        } else if (method.id === 'card') {
                          // Default to Stripe Elements (showCardForm = false)
                          setShowCardForm(false);
                        } else {
                          setShowCardForm(false);
                        }
                      }}
                    >
                      <div className="method-icon">{method.icon}</div>
                      <div className="method-details">
                        <div className="method-name">{method.name}</div>
                        <div className="method-description">{method.description}</div>
                      </div>
                      <div className="method-radio">
                        {selectedPaymentMethod === method.id && <div className="radio-selected"></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Form - Show when card payment is selected */}
              {selectedPaymentMethod === 'card' && (
                <div className="payment-section card-form-section">
                  {/* Stripe Elements - Production Ready */}
                  <Elements stripe={stripePromise}>
                    <StripePaymentForm
                      paymentData={paymentData}
                      onPaymentSuccess={handleStripePaymentSuccess}
                      onPaymentError={handleStripePaymentError}
                      processing={paymentProcessing}
                      setProcessing={setPaymentProcessing}
                      currentUser={currentUser}
                      selectedConversation={selectedConversation}
                    />
                  </Elements>
                </div>
              )}

              {/* Apple Pay Form - Show when Apple Pay is selected */}
              {selectedPaymentMethod === 'apple_pay' && (
                <div className="payment-section apple-pay-section">
                  <Elements stripe={stripePromise}>
                    <StripeApplePayButton
                      paymentData={paymentData}
                      onPaymentSuccess={handleApplePaySuccess}
                      onPaymentError={handleApplePayError}
                      processing={paymentProcessing}
                      setProcessing={setPaymentProcessing}
                      currentUser={currentUser}
                      selectedConversation={selectedConversation}
                    />
                  </Elements>
                  
                  {/* Fallback for devices that don't support Apple Pay */}
                  <div style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '14px', color: '#666', textAlign: 'center' }}>
                      If Apple Pay is not working, you can:
                    </p>
                    <button
                      onClick={() => {
                        setShowApplePayModal(true);
                        setApplePayStep('auth');
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#007AFF',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        marginTop: '8px'
                      }}
                      disabled={paymentProcessing}
                    >
                      Use Simulated Apple Pay (for testing)
                    </button>
                  </div>
                </div>
              )}

              {/* Security Notice */}
              <div className="security-notice">
                <div className="security-icon">🔒</div>
                <div className="security-text">
                  Your payment information is encrypted and secure. We never store your card details.
                </div>
              </div>
            </div>

            <div className="payment-footer">
              <button 
                className="cancel-payment-btn"
                onClick={() => setShowPaymentModal(false)}
                disabled={paymentProcessing}
              >
                Cancel
              </button>
              {/* Only show Pay button for non-card/non-apple-pay payments or legacy forms */}
              {((selectedPaymentMethod !== 'card' && selectedPaymentMethod !== 'apple_pay') || 
                (selectedPaymentMethod === 'card' && showCardForm)) && (
                <button 
                  className="confirm-payment-btn"
                  onClick={processPayment}
                  disabled={!selectedPaymentMethod || paymentProcessing}
                >
                  {paymentProcessing ? 'Processing...' : 
                   `Pay ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total || 0, paymentData.currency)}`}
                </button>
              )}
              {/* Note for Stripe Elements */}
              {((selectedPaymentMethod === 'card' && !showCardForm) || selectedPaymentMethod === 'apple_pay') && (
                <p style={{ 
                  fontSize: '14px', 
                  color: '#666', 
                  textAlign: 'center', 
                  margin: '8px 0 0 0' 
                }}>
                  Use the Pay button in the {selectedPaymentMethod === 'apple_pay' ? 'Apple Pay' : 'card'} form above
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apple Pay Authentication Modal */}
      {showApplePayModal && (
        <div className="apple-pay-modal-overlay">
          <div className="apple-pay-modal">
            <div className="apple-pay-header">
              <h2>Apple Pay</h2>
              <button 
                className="close-modal-btn"
                onClick={cancelApplePay}
                disabled={applePayProcessing}
              >
                ✕
              </button>
            </div>

            <div className="apple-pay-content">
              {applePayStep === 'auth' && (
                <div className="apple-pay-auth">
                  <div className="apple-pay-icon">🍎</div>
                  <h3>Pay with Apple Pay</h3>
                  <div className="payment-summary">
                    <div className="payment-amount">
                      {getCurrencySymbol(paymentData.currency)}{formatPrice(paymentData.total, paymentData.currency)}
                    </div>
                    <div className="payment-merchant">Lokal Marketplace</div>
                  </div>
                  <button 
                    className="apple-pay-auth-btn"
                    onClick={authenticateApplePay}
                    disabled={applePayProcessing}
                  >
                    <span className="touch-id-icon">👆</span>
                    Pay with Touch ID
                  </button>
                  <div className="apple-pay-footer">
                    <p>Use Touch ID to authorize this payment</p>
                  </div>
                </div>
              )}

              {applePayStep === 'processing' && (
                <div className="apple-pay-processing">
                  <div className="apple-pay-spinner"></div>
                  <h3>Processing Payment...</h3>
                  <p>Please wait while we process your Apple Pay payment</p>
                </div>
              )}

              {applePayStep === 'success' && (
                <div className="apple-pay-success">
                  <div className="success-icon">✅</div>
                  <h3>Payment Authorized</h3>
                  <p>Your payment has been authorized with Apple Pay</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delivery Scheduling Modal */}
      {showDeliveryModal && (
        <div className="payment-modal-overlay" onClick={() => setShowDeliveryModal(false)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h2>Schedule Delivery</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowDeliveryModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-content">
              <div className="delivery-options">
                <h3>Delivery Options</h3>
                
                <div className="delivery-option">
                  <label className="delivery-radio-label">
                    <input
                      type="radio"
                      name="deliveryType"
                      value="immediate"
                      checked={deliverySettings.deliveryType === 'immediate'}
                      onChange={(e) => setDeliverySettings(prev => ({ ...prev, deliveryType: e.target.value }))}
                    />
                    <div className="radio-content">
                      <div className="option-title">🚚 Immediate Delivery (FREE)</div>
                      <div className="option-desc">Request delivery as soon as possible (15-30 minutes)</div>
                    </div>
                  </label>
                </div>

                <div className="delivery-option">
                  <label className="delivery-radio-label">
                    <input
                      type="radio"
                      name="deliveryType"
                      value="scheduled"
                      checked={deliverySettings.deliveryType === 'scheduled'}
                      onChange={(e) => setDeliverySettings(prev => ({ ...prev, deliveryType: e.target.value }))}
                    />
                    <div className="radio-content">
                      <div className="option-title">📅 Schedule for Today (FREE)</div>
                      <div className="option-desc">Choose a specific time within store hours</div>
                    </div>
                  </label>
                  
                  {deliverySettings.deliveryType === 'scheduled' && (
                    <div className="schedule-inputs">
                      <input
                        type="date"
                        value={deliverySettings.scheduledDate}
                        min={new Date().toISOString().split('T')[0]}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setDeliverySettings(prev => ({ ...prev, scheduledDate: e.target.value }))}
                        className="delivery-input"
                      />
                      <select
                        value={deliverySettings.scheduledTime}
                        onChange={(e) => setDeliverySettings(prev => ({ ...prev, scheduledTime: e.target.value }))}
                        className="delivery-input"
                      >
                        <option value="">Select time</option>
                        <option value="09:00">9:00 AM</option>
                        <option value="09:30">9:30 AM</option>
                        <option value="10:00">10:00 AM</option>
                        <option value="10:30">10:30 AM</option>
                        <option value="11:00">11:00 AM</option>
                        <option value="11:30">11:30 AM</option>
                        <option value="12:00">12:00 PM</option>
                        <option value="12:30">12:30 PM</option>
                        <option value="13:00">1:00 PM</option>
                        <option value="13:30">1:30 PM</option>
                        <option value="14:00">2:00 PM</option>
                        <option value="14:30">2:30 PM</option>
                        <option value="15:00">3:00 PM</option>
                        <option value="15:30">3:30 PM</option>
                        <option value="16:00">4:00 PM</option>
                        <option value="16:30">4:30 PM</option>
                        <option value="17:00">5:00 PM</option>
                        <option value="17:30">5:30 PM</option>
                        <option value="18:00">6:00 PM</option>
                        <option value="18:30">6:30 PM</option>
                        <option value="19:00">7:00 PM</option>
                        <option value="19:30">7:30 PM</option>
                        <option value="20:00">8:00 PM</option>
                        <option value="20:30">8:30 PM</option>
                        <option value="21:00">9:00 PM</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="delivery-option">
                  <label className="delivery-radio-label">
                    <input
                      type="radio"
                      name="deliveryType"
                      value="next_day"
                      checked={deliverySettings.deliveryType === 'next_day'}
                      onChange={(e) => setDeliverySettings(prev => ({ ...prev, deliveryType: e.target.value }))}
                    />
                    <div className="radio-content">
                      <div className="option-title">📦 Next Day Delivery</div>
                      <div className="option-desc">Choose a time slot for tomorrow</div>
                    </div>
                  </label>
                  
                  {deliverySettings.deliveryType === 'next_day' && (
                    <div className="time-slots">
                      <label className="time-slot-label">
                        <input
                          type="radio"
                          name="timeSlot"
                          value="morning"
                          checked={deliverySettings.timeSlot === 'morning'}
                          onChange={(e) => setDeliverySettings(prev => ({ ...prev, timeSlot: e.target.value }))}
                        />
                        <div className="slot-content">
                          <div className="slot-time">🌅 Morning (9:00 AM - 12:00 PM)</div>
                          <div className="slot-price">£{deliveryPricing.morning.toFixed(2)}</div>
                        </div>
                      </label>
                      
                      <label className="time-slot-label">
                        <input
                          type="radio"
                          name="timeSlot"
                          value="afternoon"
                          checked={deliverySettings.timeSlot === 'afternoon'}
                          onChange={(e) => setDeliverySettings(prev => ({ ...prev, timeSlot: e.target.value }))}
                        />
                        <div className="slot-content">
                          <div className="slot-time">☀️ Afternoon (12:00 PM - 5:00 PM)</div>
                          <div className="slot-price">£{deliveryPricing.afternoon.toFixed(2)}</div>
                        </div>
                      </label>
                      
                      <label className="time-slot-label">
                        <input
                          type="radio"
                          name="timeSlot"
                          value="evening"
                          checked={deliverySettings.timeSlot === 'evening'}
                          onChange={(e) => setDeliverySettings(prev => ({ ...prev, timeSlot: e.target.value }))}
                        />
                        <div className="slot-content">
                          <div className="slot-time">🌆 Evening (5:00 PM - 8:00 PM)</div>
                          <div className="slot-price">£{deliveryPricing.evening.toFixed(2)}</div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="delivery-details">
                <h3>Delivery Details</h3>
                <textarea
                  placeholder="Delivery address (optional if already provided)"
                  value={deliverySettings.deliveryAddress}
                  onChange={(e) => setDeliverySettings(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                  className="delivery-textarea"
                  rows="2"
                />
                <textarea
                  placeholder="Special delivery instructions (optional)"
                  value={deliverySettings.specialInstructions}
                  onChange={(e) => setDeliverySettings(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  className="delivery-textarea"
                  rows="2"
                />
              </div>

              <div className="delivery-summary">
                <div className="summary-line">
                  <span>Delivery Fee:</span>
                  <span>
                    {deliverySettings.deliveryType === 'next_day' 
                      ? `£${deliveryPricing[deliverySettings.timeSlot].toFixed(2)}` 
                      : 'FREE'}
                  </span>
                </div>
              </div>

              <button
                onClick={scheduleDelivery}
                className="main-pay-btn"
                disabled={
                  (deliverySettings.deliveryType === 'scheduled' && (!deliverySettings.scheduledDate || !deliverySettings.scheduledTime))
                }
              >
                Schedule Delivery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fee Settings Modal (for sellers) */}
      {showFeeSettings && isSeller && (
        <div className="payment-modal-overlay" onClick={() => setShowFeeSettings(false)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h2>Fee Settings</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowFeeSettings(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-content">
              {/* Delivery Fee Settings */}
              <div className="payment-section">
                <h3>Delivery Fee</h3>
                <div className="fee-setting-group">
                  <label className="fee-checkbox">
                    <input
                      type="checkbox"
                      checked={feeSettings.deliveryEnabled}
                      onChange={(e) => setFeeSettings(prev => ({
                        ...prev,
                        deliveryEnabled: e.target.checked
                      }))}
                    />
                    Enable delivery fee
                  </label>

                  {feeSettings.deliveryEnabled && (
                    <div className="fee-inputs">
                      <div className="fee-input-group">
                        <label>Delivery Fee Amount:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={feeSettings.deliveryFee}
                          onChange={(e) => setFeeSettings(prev => ({
                            ...prev,
                            deliveryFee: parseFloat(e.target.value) || 0
                          }))}
                          className="fee-input"
                        />
                      </div>
                      <div className="fee-input-group">
                        <label>Free delivery threshold (0 = no free delivery):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={feeSettings.freeDeliveryThreshold}
                          onChange={(e) => setFeeSettings(prev => ({
                            ...prev,
                            freeDeliveryThreshold: parseFloat(e.target.value) || 0
                          }))}
                          className="fee-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Fee Settings */}
              <div className="payment-section">
                <h3>Service Fee</h3>
                <div className="fee-setting-group">
                  <label className="fee-checkbox">
                    <input
                      type="checkbox"
                      checked={feeSettings.serviceFeeEnabled}
                      onChange={(e) => setFeeSettings(prev => ({
                        ...prev,
                        serviceFeeEnabled: e.target.checked
                      }))}
                    />
                    Enable service fee
                  </label>

                  {feeSettings.serviceFeeEnabled && (
                    <div className="fee-inputs">
                      <div className="fee-input-group">
                        <label>Service Fee Type:</label>
                        <select
                          value={feeSettings.serviceFeeType}
                          onChange={(e) => setFeeSettings(prev => ({
                            ...prev,
                            serviceFeeType: e.target.value
                          }))}
                          className="fee-input"
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed Amount</option>
                        </select>
                      </div>

                      {feeSettings.serviceFeeType === 'percentage' ? (
                        <>
                          <div className="fee-input-group">
                            <label>Service Fee Percentage (%):</label>
                            <input
                              type="number"
                              step="0.1"
                              value={feeSettings.serviceFeeRate}
                              onChange={(e) => setFeeSettings(prev => ({
                                ...prev,
                                serviceFeeRate: parseFloat(e.target.value) || 0
                              }))}
                              className="fee-input"
                            />
                          </div>
                          <div className="fee-input-group">
                            <label>Maximum Service Fee (0 = no cap):</label>
                            <input
                              type="number"
                              step="0.01"
                              value={feeSettings.serviceFeeMax}
                              onChange={(e) => setFeeSettings(prev => ({
                                ...prev,
                                serviceFeeMax: parseFloat(e.target.value) || 0
                              }))}
                              className="fee-input"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="fee-input-group">
                          <label>Fixed Service Fee Amount:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={feeSettings.serviceFeeAmount}
                            onChange={(e) => setFeeSettings(prev => ({
                              ...prev,
                              serviceFeeAmount: parseFloat(e.target.value) || 0
                            }))}
                            className="fee-input"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="payment-section">
                <h3>Preview</h3>
                <div className="fee-preview">
                  <p><strong>Example order: £35.00</strong></p>
                  <div className="preview-breakdown">
                    <div>Subtotal: £35.00</div>
                    {feeSettings.deliveryEnabled && (
                      <div>
                        Delivery: {
                          feeSettings.freeDeliveryThreshold > 0 && 35 >= feeSettings.freeDeliveryThreshold 
                            ? 'FREE' 
                            : `£${feeSettings.deliveryFee.toFixed(2)}`
                        }
                      </div>
                    )}
                    {feeSettings.serviceFeeEnabled && (
                      <div>
                        Service Fee: £{
                          feeSettings.serviceFeeType === 'percentage'
                            ? Math.min(
                                35 * (feeSettings.serviceFeeRate / 100),
                                feeSettings.serviceFeeMax || 999999
                              ).toFixed(2)
                            : feeSettings.serviceFeeAmount.toFixed(2)
                        }
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', fontWeight: 'bold' }}>
                      Total: £{(
                        35 + 
                        (feeSettings.deliveryEnabled && !(feeSettings.freeDeliveryThreshold > 0 && 35 >= feeSettings.freeDeliveryThreshold) ? feeSettings.deliveryFee : 0) +
                        (feeSettings.serviceFeeEnabled ? 
                          (feeSettings.serviceFeeType === 'percentage' 
                            ? Math.min(35 * (feeSettings.serviceFeeRate / 100), feeSettings.serviceFeeMax || 999999)
                            : feeSettings.serviceFeeAmount
                          ) : 0)
                      ).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="payment-footer">
              <button 
                className="cancel-payment-btn"
                onClick={() => setShowFeeSettings(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-payment-btn"
                onClick={saveFeeSettings}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Confirmation Modal */}
      {showDeliveryConfirmModal && (
        <div className="payment-modal-overlay" onClick={() => setShowDeliveryConfirmModal(false)}>
          <div className="payment-modal delivery-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h2>🎫 Confirm Order Code</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowDeliveryConfirmModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-content">
              <div className="delivery-confirmation-content">
                <div className="confirmation-icon">
                  🚚✅
                </div>
                <h3>Ready to Complete Delivery?</h3>
                <p>
                  To mark this order as delivered, you'll need to validate the customer's pickup code 
                  in your Wallet section.
                </p>
                
                {pendingDeliveryOrder && (
                  <div className="order-summary-box">
                    <h4>Order Details:</h4>
                    <p><strong>Order ID:</strong> {pendingDeliveryOrder.orderId}</p>
                    <p><strong>Total:</strong> {getCurrencySymbol(pendingDeliveryOrder.currency)}{formatPrice(pendingDeliveryOrder.totalAmount, pendingDeliveryOrder.currency)}</p>
                  </div>
                )}

                <div className="confirmation-actions">
                  <button 
                    className="cancel-btn"
                    onClick={() => setShowDeliveryConfirmModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="confirm-payment-btn wallet-redirect-btn"
                    onClick={confirmDeliveryAndRedirect}
                  >
                    📱 Go to Wallet to Validate Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .messages-container {
          max-width: 1200px;
          margin: 2rem auto;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(184, 184, 184, 0.3);
          overflow: hidden;
          min-height: calc(100vh - 6rem);
        }

        .messages-tabs {
          display: flex;
          border-bottom: 2px solid #eee;
        }

        .tab-button {
          flex: 1;
          padding: 1rem;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: #888;
          font-weight: 700;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-button.active {
          background: #F9F5EE;
          border-bottom-color: #007B7F;
          color: #007B7F;
        }

        .messages-content {
          display: flex;
          height: calc(100vh - 12rem);
        }

        .conversations-panel {
          width: 320px;
          border-right: 1px solid #eee;
          display: flex;
          flex-direction: column;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem;
          border: 1.5px solid #B8B8B8;
          border-radius: 6px;
          margin: 1rem;
          margin-bottom: 0.5rem;
          width: calc(100% - 2rem);
          font-size: 0.95rem;
          outline: none;
          box-sizing: border-box;
        }

        .back-button {
          width: calc(100% - 2rem);
          margin: 0.5rem 1rem;
          padding: 0.5rem;
          background: #eee;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .mobile-only {
          display: none;
        }

        .conversations-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem 1rem;
        }

        .conversation-item {
          padding: 0.75rem;
          border: 1px solid #eee;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          background: #fafafa;
          cursor: pointer;
          transition: background 0.2s;
        }

        .conversation-item:hover {
          background: #f0f9ff;
        }

        .conversation-item.selected {
          background: #F0F9FF;
          border-left: 4px solid #007B7F;
        }

        .conversation-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .conversation-main {
          flex: 1;
          min-width: 0;
        }

        .conversation-name {
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
        }

        .conversation-email {
          font-size: 0.8rem;
          color: #666;
          margin-bottom: 0.5rem;
        }

        .conversation-preview {
          font-size: 0.8rem;
          color: #444;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .conversation-meta {
          margin-left: 0.5rem;
          text-align: right;
        }

        .conversation-time {
          font-size: 0.75rem;
          color: #888;
          margin-bottom: 0.5rem;
        }

        .unread-indicator {
          width: 8px;
          height: 8px;
          background: #007B7F;
          border-radius: 50%;
          margin-left: auto;
        }

        .chat-area {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .chat-header {
          padding: 1rem;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fff;
        }

        .chat-user-info {
          flex: 1;
        }

        .chat-user-name {
          font-weight: 600;
          font-size: 1.1rem;
        }

        .chat-user-email {
          font-size: 0.9rem;
          color: #666;
        }

        .browse-items-btn {
          padding: 0.5rem 1rem;
          background: #f1f1f1;
          color: #007B7F;
          border: 1px solid #007B7F;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .browse-items-btn.active {
          background: #007B7F;
          color: #fff;
          border-color: #007B7F;
        }

        .chat-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .messages-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }

        .messages-area.with-sidebar {
          border-right: 1px solid #eee;
        }

        .messages-list {
          flex: 1;
          overflow-y: scroll !important;
          padding: 1rem;
          height: calc(100vh - 350px) !important;
          max-height: calc(100vh - 350px) !important;
          scrollbar-width: auto !important;
          -webkit-overflow-scrolling: touch;
        }

        .messages-list::-webkit-scrollbar {
          width: 12px !important;
        }

        .messages-list::-webkit-scrollbar-track {
          background: #f1f1f1 !important;
        }

        .messages-list::-webkit-scrollbar-thumb {
          background: #888 !important;
          border-radius: 6px !important;
        }

        .messages-list::-webkit-scrollbar-thumb:hover {
          background: #555 !important;
        }

        .message {
          margin-bottom: 1rem;
          display: flex;
        }

        .message.sent {
          justify-content: flex-end;
        }

        .message.received {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 80%;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          word-wrap: break-word;
        }

        .message.sent .message-bubble {
          background: #007B7F;
          color: #fff;
        }

        .message.received .message-bubble {
          background: #f1f1f1;
          color: #333;
        }

        .message-text {
          font-size: 0.95rem;
          white-space: pre-wrap;
          line-height: 1.4;
        }

        .message-time {
          font-size: 0.75rem;
          margin-top: 0.5rem;
          opacity: 0.8;
        }

        .message-input-area {
          display: flex !important;
          gap: 0.5rem;
          align-items: center;
          padding: 1rem !important;
          border-top: 1px solid #eee !important;
          background: #fff !important;
          flex-wrap: wrap;
          position: sticky !important;
          bottom: 0 !important;
          z-index: 10 !important;
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1) !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        .message-input {
          flex: 1 !important;
          padding: 0.75rem !important;
          border: 1px solid #ccc !important;
          border-radius: 8px !important;
          outline: none !important;
          font-size: 0.95rem !important;
          min-width: 200px !important;
          background: #fff !important;
        }

        .send-button {
          padding: 0.75rem 1.5rem !important;
          background: #007B7F !important;
          color: #fff !important;
          border: none !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          font-weight: 600 !important;
          transition: background 0.2s !important;
        }

        .send-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .mobile-action-buttons {
          display: none;
          width: 100%;
          gap: 0.75rem;
          margin-top: 0.75rem;
          padding: 0.5rem 0;
        }

        .mobile-browse-btn, .mobile-cart-btn {
          flex: 1;
          padding: 0.75rem 1rem;
          background: #f1f1f1;
          color: #007B7F;
          border: 2px solid #007B7F;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-browse-btn.active, .mobile-cart-btn.active {
          background: #007B7F;
          color: #fff;
        }

        .mobile-browse-btn.disabled {
          background: #f5f5f5;
          color: #999;
          border-color: #ddd;
          cursor: not-allowed;
        }

        .done-button {
          padding: 0.75rem 1.5rem;
          background: #22C55E;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
          margin-left: 0.5rem;
        }

        .done-button:hover {
          background: #16A34A;
        }

        .order-status-indicator {
          padding: 0.75rem 1rem;
          background: #FEF3C7;
          color: #92400E;
          border: 2px solid #FCD34D;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-left: 0.5rem;
          white-space: nowrap;
        }

        .items-sidebar {
          width: 300px;
          background: #fafafa;
          border-left: 1px solid #eee;
          display: flex;
          flex-direction: column;
        }

        .items-header {
          font-weight: 600;
          font-size: 1.1rem;
          padding: 1rem;
          border-bottom: 1px solid #eee;
          background: #fff;
          position: sticky;
          top: 0;
        }

        .items-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .item-card {
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .item-card:hover {
          background: #f0f9ff;
          transform: translateY(-1px);
        }

        .item-content {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }

        .item-image {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          object-fit: cover;
          flex-shrink: 0;
        }

        .item-details {
          flex: 1;
          min-width: 0;
        }

        .item-name {
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-price {
          color: #007B7F;
          font-weight: 500;
          font-size: 0.85rem;
          margin-bottom: 0.25rem;
        }

        .item-meta {
          font-size: 0.75rem;
          color: #666;
          line-height: 1.3;
        }

        .item-action {
          display: none;
        }

        .wallet-content {
          padding: 2rem;
          height: calc(100vh - 140px);
          overflow-y: auto;
        }

        .wallet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .fee-settings-btn {
          padding: 0.5rem 1rem;
          background: #007B7F;
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
          transition: all 0.2s;
        }

        .fee-settings-btn:hover {
          background: #005a5d;
          transform: translateY(-1px);
        }

        /* Fee Settings Styles */
        .fee-setting-group {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
        }

        .fee-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          margin-bottom: 1rem;
          cursor: pointer;
        }

        .fee-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .fee-inputs {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-left: 1.5rem;
        }

        .fee-input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .fee-input-group label {
          font-weight: 500;
          color: #374151;
          font-size: 0.9rem;
        }

        .fee-input {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.9rem;
          transition: border-color 0.2s;
        }

        .fee-input:focus {
          outline: none;
          border-color: #007B7F;
          box-shadow: 0 0 0 3px rgba(0, 123, 127, 0.1);
        }

        .fee-preview {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 1rem;
        }

        .preview-breakdown {
          margin-top: 0.5rem;
          font-family: monospace;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .section-title {
          margin: 0 0 1rem 0;
          color: #1C1C1C;
          font-size: 1.3rem;
        }

        .balance-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .balance-card {
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
          border: 2px solid;
        }

        .balance-card.available {
          background: #F0FDF4;
          border-color: #22C55E;
        }

        .balance-card.pending {
          background: #FFF7ED;
          border-color: #F59E0B;
        }

        .balance-card.total {
          background: #F0F9FF;
          border-color: #007B7F;
        }

        .balance-label {
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .balance-card.available .balance-label { color: #16A34A; }
        .balance-card.pending .balance-label { color: #D97706; }
        .balance-card.total .balance-label { color: #007B7F; }

        .balance-amount {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .balance-card.available .balance-amount { color: #15803D; }
        .balance-card.pending .balance-amount { color: #B45309; }
        .balance-card.total .balance-amount { color: #005a5d; }

        .withdraw-button {
          width: 100%;
          padding: 0.75rem;
          background: #007B7F;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          margin-bottom: 2rem;
        }

        .withdraw-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .withdraw-button:hover:not(:disabled) {
          background: #005a5d;
        }

        /* Pickup Code Validation Styles */
        .pickup-validation-section {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .pickup-title {
          margin: 0 0 0.5rem 0;
          color: #1f2937;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .pickup-description {
          color: #6b7280;
          font-size: 0.9rem;
          margin: 0 0 1rem 0;
          line-height: 1.4;
        }

        .pickup-input-section {
          display: flex;
          gap: 0.75rem;
          align-items: stretch;
        }

        .pickup-code-input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
          font-family: 'Courier New', monospace;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-align: center;
          background: #ffffff;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .pickup-code-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .pickup-code-input::placeholder {
          font-family: inherit;
          letter-spacing: normal;
          text-align: center;
        }

        .validate-pickup-btn {
          padding: 0.75rem 1.5rem;
          background: #16a34a;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }

        .validate-pickup-btn:hover {
          background: #15803d;
        }

        .validate-pickup-btn:active {
          background: #166534;
        }

        .transactions-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .transaction-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border: 1px solid #eee;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          background: #fafafa;
        }

        .transaction-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .transaction-icon {
          font-size: 1.5rem;
        }

        .transaction-description {
          font-weight: 600;
          color: #1C1C1C;
          font-size: 0.95rem;
        }

        .transaction-date {
          font-size: 0.8rem;
          color: #666;
        }

        .transaction-order {
          font-size: 0.8rem;
          color: #888;
        }

        .transaction-amount {
          font-weight: bold;
          font-size: 1rem;
        }

        .transaction-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
        }

        .transaction-pickup {
          font-size: 0.8rem;
          margin-top: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .pickup-code-label {
          color: #6b7280;
        }

        .pickup-code {
          font-family: 'Courier New', monospace;
          background: #f3f4f6;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        .pickup-status {
          font-size: 0.75rem;
          padding: 0.2rem 0.4rem;
          border-radius: 12px;
          font-weight: 500;
        }

        .pickup-status.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .pickup-status.collected {
          background: #d1fae5;
          color: #065f46;
        }

        .quick-validate-btn {
          padding: 0.25rem 0.5rem;
          background: #16a34a;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .quick-validate-btn:hover {
          background: #15803d;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #888;
        }

        .empty-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .empty-title {
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .empty-subtitle {
          font-size: 0.9rem;
        }

        .loading-state {
          text-align: center;
          padding: 2rem;
          color: #888;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .messages-container {
            margin: 0.5rem;
            border-radius: 6px;
            min-height: calc(100vh - 5rem);
          }

          .messages-content {
            height: calc(100vh - 10rem);
          }

          .conversations-panel {
            width: 100%;
          }

          .chat-area {
            width: 100%;
          }

          .mobile-hidden {
            display: none !important;
          }

          .mobile-visible {
            display: flex !important;
          }

          .mobile-only {
            display: block !important;
          }

          .chat-body {
            flex-direction: column;
          }

          .items-sidebar {
            width: 100%;
            max-height: 300px;
            order: -1;
          }

          .message-bubble {
            max-width: 85%;
          }

          .balance-cards {
            grid-template-columns: 1fr;
          }

          .conversation-preview {
            font-size: 0.8rem;
            max-width: 200px;
          }

          .browse-items-btn {
            font-size: 0.8rem;
            padding: 0.4rem 0.8rem;
          }

          .wallet-content {
            padding: 1rem;
          }

          .wallet-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .fee-settings-btn {
            width: 100%;
            text-align: center;
          }

          .fee-inputs {
            padding-left: 0;
          }

          .search-input {
            margin: 0.5rem;
            width: calc(100% - 1rem);
          }

          .back-button {
            margin: 0.5rem;
            width: calc(100% - 1rem);
          }

          .message-input-area {
            flex-wrap: wrap;
          }

          .mobile-action-buttons {
            display: flex !important;
          }

          .done-button, .order-status-indicator {
            margin-left: 0;
            margin-top: 0.5rem;
            flex: 1;
            min-width: 120px;
          }
        }

        @media (max-width: 480px) {
          .messages-container {
            margin: 0.25rem;
            border-radius: 4px;
          }

          .tab-button {
            font-size: 1rem;
            padding: 0.8rem;
          }

          .conversation-name {
            font-size: 0.85rem;
          }

          .conversation-email {
            font-size: 0.75rem;
          }

          .message-text {
            font-size: 0.9rem;
          }

          .chat-user-name {
            font-size: 1rem;
          }

          .browse-items-btn {
            display: none;
          }

          .item-card {
            padding: 0.5rem;
          }

          .item-name {
            font-size: 0.85rem;
          }
        }

        .header-buttons {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .cart-btn {
          padding: 0.5rem 1rem;
          background: #f1f1f1;
          color: #007B7F;
          border: 1px solid #007B7F;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .cart-btn.active {
          background: #007B7F;
          color: #fff;
          border-color: #007B7F;
        }

        .cart-sidebar {
          width: 380px;
          background: #ffffff;
          border-left: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          max-height: 100%;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .cart-header {
          padding: 1.25rem;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
          position: sticky;
          top: 0;
        }

        .cart-header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .cart-header h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
          color: #1f2937;
        }

        .collapse-all-btn {
          padding: 0.4rem 0.8rem;
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .collapse-all-btn:hover {
          background: #e5e7eb;
          border-color: #9ca3af;
        }

        .cart-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          padding: 0.75rem;
          background: #f8fafc;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .cart-item-count {
          font-size: 0.95rem;
          color: #6b7280;
          font-weight: 500;
        }

        .cart-total-large {
          font-size: 1.25rem;
          font-weight: 700;
          color: #007B7F;
        }

        .payment-methods-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 0.75rem;
          padding: 0.5rem;
          background: #f0f9ff;
          border-radius: 4px;
          border: 1px solid #e0f2fe;
        }

        .payment-preview-label {
          font-size: 0.8rem;
          color: #0891b2;
          font-weight: 500;
        }

        .payment-icons-preview {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .payment-icon-small {
          font-size: 0.9rem;
          padding: 0.15rem;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 3px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
        }

        .payment-more {
          font-size: 0.75rem;
          color: #6b7280;
          font-weight: 500;
          margin-left: 0.25rem;
        }

        .cart-locked-indicator {
          background: #fef3c7;
          color: #92400e;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 500;
          text-align: center;
          margin: 0.75rem 0;
          border: 1px solid #fcd34d;
        }

        .clear-cart-btn:disabled {
          background: #f3f4f6;
          color: #9ca3af;
          cursor: not-allowed;
          border-color: #d1d5db;
        }

        .cart-content-wrapper {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .cart-content-wrapper::-webkit-scrollbar {
          width: 6px;
        }

        .cart-content-wrapper::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .cart-content-wrapper::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .cart-content-wrapper::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .cart-items {
          overflow-y: auto;
          padding: 0.75rem;
          background: #ffffff;
          max-height: 250px;
        }

        .cart-items::-webkit-scrollbar {
          width: 4px;
        }

        .cart-items::-webkit-scrollbar-track {
          background: #f8fafc;
        }

        .cart-items::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }

        .cart-items::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .cart-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 0.75rem;
          background: #ffffff;
          transition: all 0.2s ease;
        }

        .cart-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border-color: #007B7F;
        }

        .cart-item-content {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          align-items: flex-start;
        }

        .cart-item-image {
          width: 50px;
          height: 50px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid #e5e7eb;
        }

        .cart-item-details {
          flex: 1;
          min-width: 0;
        }

        .cart-item-name {
          font-weight: 600;
          font-size: 0.95rem;
          margin-bottom: 0.4rem;
          color: #1f2937;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cart-item-price {
          font-size: 0.85rem;
          color: #6b7280;
          margin-bottom: 0.3rem;
        }

        .cart-item-subtotal {
          font-size: 0.9rem;
          font-weight: 600;
          color: #007B7F;
        }

        .cart-item-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.5rem;
        }

        .quantity-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f8fafc;
          padding: 0.25rem;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .quantity-btn {
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 4px;
          background: #ffffff;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #374151;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .quantity-btn:hover:not(:disabled) {
          background: #007B7F;
          color: #ffffff;
          transform: scale(1.05);
        }

        .quantity-btn:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
          opacity: 0.5;
          color: #9ca3af;
        }

        .quantity {
          font-weight: 600;
          min-width: 24px;
          text-align: center;
          font-size: 0.9rem;
          color: #374151;
        }

        .remove-btn {
          background: #ef4444;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          padding: 0.4rem 0.6rem;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .remove-btn:hover {
          background: #dc2626;
          transform: translateY(-1px);
        }

        .cart-actions {
          padding: 1rem;
          border-top: 1px solid #e5e7eb;
          background: #ffffff;
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .clear-cart-btn {
          flex: 1;
          min-width: 80px;
          padding: 0.75rem;
          background: #f8fafc;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .clear-cart-btn:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
          color: #666;
          border: 1px solid #ccc;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .send-order-btn {
          flex: 1;
          min-width: 100px;
          padding: 0.75rem;
          background: #007B7F;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }

        .send-order-btn:hover {
          background: #005a5d;
          transform: translateY(-1px);
        }

        /* Message Action Buttons */
        .action-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          transition: all 0.2s ease;
          margin: 0.5rem 0;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .done-message-btn {
          background: #22c55e;
          color: #ffffff;
        }

        .done-message-btn:hover {
          background: #16a34a;
          transform: translateY(-1px);
        }

        .bag-items-btn {
          background: #3b82f6;
          color: #ffffff;
        }

        .bag-items-btn:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }

        .bag-items-btn.disabled,
        .bag-items-btn:disabled {
          background: #9ca3af;
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .bag-items-btn.disabled:hover,
        .bag-items-btn:disabled:hover {
          background: #9ca3af;
          transform: none;
        }

        .payment-btn {
          background: #007B7F;
          color: #ffffff;
        }

        .payment-btn:hover {
          background: #005a5d;
          transform: translateY(-1px);
        }

        .deliver-btn {
          background: #f59e0b;
          color: #ffffff;
        }

        .deliver-btn:hover {
          background: #d97706;
          transform: translateY(-1px);
        }

        .deliver-btn.disabled,
        .deliver-btn:disabled {
          background: #9ca3af;
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .deliver-btn.disabled:hover,
        .deliver-btn:disabled:hover {
          background: #9ca3af;
          transform: none;
        }

        .deliver-btn.faded {
          opacity: 0.4;
          background: #94a3b8;
          cursor: not-allowed;
          filter: grayscale(50%);
        }

        .deliver-btn.faded:hover {
          background: #94a3b8;
          transform: none;
        }

        .deliver-btn.pulsing {
          animation: pulse-green 2s infinite;
        }

        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }

        .schedule-delivery-btn {
          background: #8b5cf6;
          color: #ffffff;
        }

        .schedule-delivery-btn:hover {
          background: #7c3aed;
          transform: translateY(-1px);
        }

        .cancel-delivery-btn {
          background: #f59e0b;
          color: #ffffff;
        }

        .cancel-delivery-btn:hover {
          background: #d97706;
          transform: translateY(-1px);
        }

        .refund-btn {
          background: #3b82f6;
          color: #ffffff;
        }

        .refund-btn:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }

        .refund-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
          transform: none;
        }

        .delivery-status-info {
          margin: 0.5rem 0;
          padding: 0.75rem;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          text-align: center;
          font-weight: 600;
          color: #92400e;
        }

        .delivery-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.5rem;
        }

        .delivery-actions .action-btn {
          flex: 1;
          min-width: 140px;
        }

        .delivery-time-info {
          margin: 0.5rem 0;
          padding: 0.75rem;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          text-align: center;
        }

        .waiting-time {
          color: #6b7280;
          font-weight: 500;
          font-size: 0.9rem;
        }

        .delivery-status {
          margin: 0.5rem 0;
          padding: 0.5rem;
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
        }

        .delivery-info {
          font-size: 0.9rem;
          color: #0369a1;
          font-weight: 500;
        }

        .quick-pay-btn {
          flex: 1;
          padding: 0.75rem;
          background: #22c55e;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }

        .quick-pay-btn:hover:not(:disabled) {
          background: #16a34a;
          transform: translateY(-1px);
        }

        .quick-pay-btn:disabled {
          background: #d1d5db;
          color: #9ca3af;
          cursor: not-allowed;
          transform: none;
        }

        /* Collapsible cart sections */
        .cart-section {
          border-bottom: 1px solid #e5e7eb;
          position: relative;
        }

        .cart-section:last-child {
          border-bottom: none;
        }

        .cart-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          color: #374151;
          transition: background-color 0.2s ease;
        }

        .cart-section-header:hover {
          background: #f1f5f9;
        }

        .collapse-icon {
          font-size: 0.8rem;
          color: #6b7280;
          transition: transform 0.2s ease;
        }

        /* Cart calculation styles */
        .cart-calculation {
          padding: 1rem;
          background: #f8fafc;
          margin: 0;
        }

        .calculation-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.4rem 0;
          font-size: 0.9rem;
          color: #374151;
        }

        .calculation-row.total {
          font-weight: 700;
          font-size: 1.1rem;
          color: #007B7F;
          padding-top: 0.6rem;
          border-top: 2px solid #e5e7eb;
          margin-top: 0.6rem;
        }

        .calculation-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 0.5rem 0;
        }

        /* Message delete button styles */
        .message-content {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          position: relative;
        }

        .message-text {
          flex: 1;
        }

        .delete-message-btn {
          background: transparent;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 0.8rem;
          padding: 0.2rem;
          border-radius: 3px;
          opacity: 0;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .message:hover .delete-message-btn {
          opacity: 1;
        }

        .delete-message-btn:hover {
          background: #ff4444;
          color: #fff;
          transform: scale(1.1);
        }

        /* Mobile responsive updates */
        @media (max-width: 768px) {
          .messages-container {
            height: 100vh;
            overflow: hidden;
          }

          .messages-content {
            height: calc(100vh - 8rem);
            flex-direction: column;
          }

          .conversations-panel {
            width: 100%;
            max-height: 40vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            border-right: none;
            border-bottom: 1px solid #eee;
          }

          .chat-area {
            flex: 1;
            min-height: 0;
          }

          .chat-body {
            flex: 1;
            overflow: hidden;
          }

          .messages-area {
            height: 100%;
          }

          .messages-list {
            flex: 1 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            padding: 0.5rem;
            scroll-behavior: smooth;
            height: calc(100vh - 200px) !important;
            max-height: calc(100vh - 200px) !important;
            min-height: 200px !important;
            position: relative !important;
            padding-bottom: 1rem !important;
          }

          .header-buttons {
            flex-direction: column;
            gap: 0.25rem;
          }

          .cart-btn, .browse-items-btn {
            font-size: 0.8rem;
            padding: 0.4rem 0.8rem;
          }

          .cart-sidebar {
            width: 100%;
            max-height: 50vh;
            order: -1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .cart-content-wrapper {
            max-height: 40vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .cart-items {
            max-height: 25vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .cart-actions {
            flex-direction: column;
            gap: 0.5rem;
          }

          .clear-cart-btn,
          .send-order-btn,
          .quick-pay-btn {
            flex: 1;
            width: 100%;
          }

          /* Improve message bubbles on mobile */
          .message-bubble {
            max-width: 85%;
            word-wrap: break-word;
          }

          /* Ensure input area doesn't get hidden */
          .message-input-area {
            position: sticky !important;
            bottom: 0 !important;
            background: #fff !important;
            border-top: 2px solid #007B7F !important;
            padding: 1rem !important;
            z-index: 1000 !important;
            box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15) !important;
            display: flex !important;
            gap: 0.75rem !important;
            align-items: center !important;
            margin: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }

          .message-input {
            flex: 1 !important;
            padding: 0.75rem !important;
            border: 2px solid #007B7F !important;
            border-radius: 8px !important;
            font-size: 16px !important;
            min-height: 44px !important;
            background: #fff !important;
            box-sizing: border-box !important;
          }

          .send-button {
            padding: 0.75rem 1.5rem !important;
            background: #007B7F !important;
            color: #fff !important;
            border: none !important;
            border-radius: 8px !important;
            font-weight: 600 !important;
            font-size: 16px !important;
            min-height: 44px !important;
            cursor: pointer !important;
            white-space: nowrap !important;
          }

          /* Add padding to bottom of messages to account for fixed input */
          .messages-list {
            padding-bottom: 100px !important;
          }
        }

        @media (max-width: 480px) {
          .messages-container {
            height: 100vh;
            overflow: hidden;
          }

          .conversations-panel {
            max-height: 35vh;
          }

          .messages-list {
            padding: 0.25rem;
            font-size: 0.9rem;
            height: calc(100vh - 200px) !important;
            max-height: calc(100vh - 200px) !important;
            min-height: 150px !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }

          .message-bubble {
            max-width: 90%;
            padding: 0.5rem;
          }

          .cart-btn {
            display: none;
          }

          .cart-sidebar {
            max-height: 45vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .cart-content-wrapper {
            max-height: 35vh;
          }

          .cart-items {
            max-height: 20vh;
          }

          /* Improve touch scrolling */
          .conversations-list,
          .messages-list,
          .cart-sidebar,
          .cart-content-wrapper,
          .cart-items {
            -webkit-overflow-scrolling: touch;
            scroll-behavior: smooth;
          }

          /* Prevent zoom on input focus */
          .message-input,
          .search-input {
            font-size: 16px;
          }
        }

        /* Force mobile scrolling for all devices */
        @media (max-width: 1024px) {
          .messages-list {
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            height: calc(100vh - 180px) !important;
            max-height: calc(100vh - 180px) !important;
            position: relative !important;
          }
          
          .messages-area {
            height: 100% !important;
            max-height: calc(100vh - 120px) !important;
          }
          
          .chat-body {
            height: calc(100vh - 160px) !important;
            overflow: hidden !important;
          }
        }

        /* Payment Modal Styles */
        .payment-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 1rem;
        }

        .payment-modal {
          background: #ffffff;
          border-radius: 12px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          animation: modalSlideIn 0.3s ease-out;
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .payment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
          border-radius: 12px 12px 0 0;
        }

        .payment-header h2 {
          margin: 0;
          color: #1f2937;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .close-modal-btn {
          background: #f3f4f6;
          border: none;
          border-radius: 6px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.2s ease;
        }

        .close-modal-btn:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .payment-content {
          padding: 1.5rem;
        }

        .payment-section {
          margin-bottom: 2rem;
        }

        .payment-section h3 {
          margin: 0 0 1rem 0;
          color: #1f2937;
          font-size: 1.2rem;
          font-weight: 600;
        }

        .order-summary {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .summary-item:last-child {
          border-bottom: none;
        }

        .item-name {
          color: #374151;
          font-weight: 500;
        }

        .item-total {
          color: #007B7F;
          font-weight: 600;
        }

        .summary-breakdown {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 2px solid #e5e7eb;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.4rem 0;
          color: #6b7280;
          font-size: 0.9rem;
        }

        .breakdown-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          margin-top: 0.5rem;
          border-top: 2px solid #007B7F;
          font-weight: 700;
          font-size: 1.1rem;
          color: #007B7F;
        }

        .payment-methods {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .payment-method {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #ffffff;
        }

        .payment-method:hover {
          border-color: #007B7F;
          background: #f0f9ff;
        }

        .payment-method.selected {
          border-color: #007B7F;
          background: #f0f9ff;
          box-shadow: 0 0 0 3px rgba(0, 123, 127, 0.1);
        }

        .method-icon {
          font-size: 1.5rem;
          width: 40px;
          text-align: center;
        }

        .method-details {
          flex: 1;
        }

        .method-name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 0.25rem;
        }

        .method-description {
          font-size: 0.85rem;
          color: #6b7280;
        }

        .method-radio {
          width: 20px;
          height: 20px;
          border: 2px solid #d1d5db;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.2s ease;
        }

        .payment-method.selected .method-radio {
          border-color: #007B7F;
        }

        .radio-selected {
          width: 10px;
          height: 10px;
          background: #007B7F;
          border-radius: 50%;
        }

        .security-notice {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          margin-top: 1rem;
        }

        .security-icon {
          font-size: 1.25rem;
          color: #16a34a;
        }

        .security-text {
          font-size: 0.85rem;
          color: #15803d;
          line-height: 1.4;
        }

        /* Card Form Styles */
        .card-form-section {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          background: #ffffff;
        }

        .card-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-row {
          display: flex;
          gap: 1rem;
          width: 100%;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .form-group.full-width {
          flex: 1 1 100%;
        }

        .form-group label {
          font-size: 0.9rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.5rem;
        }

        .form-group input,
        .form-group select {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
          transition: border-color 0.2s, box-shadow 0.2s;
          background: #ffffff;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group input.error,
        .form-group select.error {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .card-input-wrapper {
          position: relative;
        }

        .card-type-indicator {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.8rem;
          color: #6b7280;
          font-weight: 500;
          background: #f9fafb;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
        }

        .billing-address-section {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e5e7eb;
        }

        .billing-address-section h4 {
          margin: 0 0 1rem 0;
          color: #374151;
          font-size: 1rem;
          font-weight: 600;
        }

        .error-message {
          font-size: 0.8rem;
          color: #ef4444;
          margin-top: 0.25rem;
          display: block;
        }

        /* Delivery Modal Styles */
        .delivery-options {
          margin-bottom: 1.5rem;
        }

        .delivery-option {
          margin-bottom: 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          transition: border-color 0.2s ease;
        }

        .delivery-option:hover {
          border-color: #d1d5db;
        }

        .delivery-radio-label {
          display: block;
          padding: 1rem;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .delivery-radio-label:hover {
          background-color: #f9fafb;
        }

        .delivery-radio-label input[type="radio"] {
          margin-right: 0.75rem;
          transform: scale(1.2);
        }

        .delivery-radio-label input[type="radio"]:checked + .radio-content {
          color: #1f2937;
        }

        .delivery-option:has(input[type="radio"]:checked) {
          border-color: #3b82f6;
          background-color: #eff6ff;
        }

        .radio-content {
          display: inline-block;
          width: calc(100% - 2rem);
        }

        .option-title {
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 0.25rem;
          color: #1f2937;
        }

        .option-desc {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .schedule-inputs {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
          padding: 0 1rem 1rem 2.75rem;
        }

        .delivery-input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .time-slots {
          padding: 0 1rem 1rem 2.75rem;
        }

        .time-slot-label {
          display: block;
          padding: 0.75rem;
          margin: 0.5rem 0;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .time-slot-label:hover {
          border-color: #d1d5db;
          background-color: #f9fafb;
        }

        .time-slot-label:has(input[type="radio"]:checked) {
          border-color: #3b82f6;
          background-color: #eff6ff;
        }

        .time-slot-label input[type="radio"] {
          margin-right: 0.5rem;
        }

        .slot-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: calc(100% - 1.5rem);
          display: inline-flex;
        }

        .slot-time {
          font-weight: 500;
          color: #1f2937;
        }

        .slot-price {
          font-weight: 600;
          color: #059669;
          font-size: 1rem;
        }

        .delivery-details {
          margin-bottom: 1.5rem;
        }

        .delivery-textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          resize: vertical;
          margin-bottom: 0.5rem;
          font-family: inherit;
        }

        .delivery-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .delivery-summary {
          padding: 1rem;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .summary-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          color: #1f2937;
        }

        /* Delivery Modal Responsive Styles */
        @media (max-width: 768px) {
          .schedule-inputs {
            flex-direction: column;
          }
          
          .delivery-option {
            margin-bottom: 0.75rem;
          }
          
          .delivery-radio-label {
            padding: 0.75rem;
          }
          
          .time-slots {
            padding: 0 0.75rem 0.75rem 2rem;
          }
          
          .time-slot-label {
            padding: 0.5rem;
          }
          
          .slot-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
          }
          
          .delivery-textarea {
            padding: 0.5rem;
            font-size: 1rem; /* Better for mobile input */
          }
        }

        /* Responsive card form */
        @media (max-width: 768px) {
          .card-form-section {
            padding: 1rem;
          }

          .form-row {
            flex-direction: column;
            gap: 0.75rem;
          }

          .form-group {
            flex: 1 1 100%;
          }

          .billing-address-section {
            margin-top: 1rem;
            padding-top: 1rem;
          }
        }

        .payment-footer {
          display: flex;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f8fafc;
          border-radius: 0 0 12px 12px;
        }

        .cancel-payment-btn {
          flex: 1;
          padding: 0.75rem 1.5rem;
          background: #ffffff;
          color: #6b7280;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .cancel-payment-btn:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .cancel-payment-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .confirm-payment-btn {
          flex: 2;
          padding: 0.75rem 1.5rem;
          background: #007B7F;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 1rem;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .confirm-payment-btn:hover:not(:disabled) {
          background: #005a5d;
          transform: translateY(-1px);
        }

        .confirm-payment-btn:disabled {
          background: #d1d5db;
          color: #9ca3af;
          cursor: not-allowed;
          transform: none;
        }

        .payment-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #ffffff;
          border-top: 2px solid transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Apple Pay Modal Styles */
        .apple-pay-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
          animation: fadeIn 0.3s ease-out;
        }

        .apple-pay-modal {
          background: #000000;
          border-radius: 20px;
          width: 100%;
          max-width: 400px;
          color: #ffffff;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          animation: modalSlideIn 0.3s ease-out;
          overflow: hidden;
        }

        .apple-pay-header {
          padding: 1.5rem 1.5rem 1rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #333;
        }

        .apple-pay-header h2 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
          color: #ffffff;
        }

        .apple-pay-content {
          padding: 2rem 1.5rem;
          text-align: center;
        }

        .apple-pay-auth {
          text-align: center;
        }

        .apple-pay-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
          opacity: 0.9;
        }

        .apple-pay-auth h3 {
          margin: 0 0 1.5rem 0;
          font-size: 1.3rem;
          font-weight: 500;
          color: #ffffff;
        }

        .payment-summary {
          background: #1a1a1a;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          border: 1px solid #333;
        }

        .payment-amount {
          font-size: 2rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }

        .payment-merchant {
          color: #999;
          font-size: 1rem;
        }

        .apple-pay-auth-btn {
          background: linear-gradient(135deg, #007aff, #0051d2);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          padding: 1rem 2rem;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
          margin-bottom: 1rem;
        }

        .apple-pay-auth-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #0056b3, #003d99);
          transform: translateY(-1px);
        }

        .apple-pay-auth-btn:disabled {
          background: #333;
          color: #666;
          cursor: not-allowed;
          transform: none;
        }

        .touch-id-icon {
          font-size: 1.5rem;
        }

        .apple-pay-footer p {
          color: #999;
          font-size: 0.9rem;
          margin: 0;
        }

        .apple-pay-processing {
          text-align: center;
        }

        .apple-pay-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #333;
          border-top: 3px solid #007aff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem auto;
        }

        .apple-pay-processing h3 {
          margin: 0 0 1rem 0;
          font-size: 1.3rem;
          font-weight: 500;
          color: #ffffff;
        }

        .apple-pay-processing p {
          color: #999;
          margin: 0;
        }

        .apple-pay-success {
          text-align: center;
        }

        .success-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
          color: #34c759;
        }

        .apple-pay-success h3 {
          margin: 0 0 1rem 0;
          font-size: 1.3rem;
          font-weight: 500;
          color: #ffffff;
        }

        .apple-pay-success p {
          color: #999;
          margin: 0;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Mobile Responsive for Payment Modal */
        @media (max-width: 768px) {
          .payment-modal-overlay {
            padding: 0.5rem;
          }

          .payment-modal {
            max-height: 95vh;
          }

          .payment-header {
            padding: 1rem;
          }

          .payment-header h2 {
            font-size: 1.25rem;
          }

          .payment-content {
            padding: 1rem;
          }

          .payment-section {
            margin-bottom: 1.5rem;
          }

          .payment-method {
            padding: 0.75rem;
          }

          .method-icon {
            font-size: 1.25rem;
            width: 35px;
          }

          .payment-footer {
            padding: 1rem;
            flex-direction: column;
          }

          .cancel-payment-btn,
          .confirm-payment-btn {
            flex: 1;
          }
        }

        @media (max-width: 480px) {
          .payment-modal-overlay {
            padding: 0.25rem;
          }

          .payment-header {
            padding: 0.75rem;
          }

          .payment-content {
            padding: 0.75rem;
          }

          .payment-method {
            padding: 0.5rem;
            gap: 0.75rem;
          }

          .method-details {
            min-width: 0;
          }

          .method-name {
            font-size: 0.9rem;
          }

          .method-description {
            font-size: 0.8rem;
          }
        }

        /* Delivery Confirmation Modal Styles */
        .delivery-confirm-modal {
          max-width: 500px;
          width: 90%;
        }

        .delivery-confirmation-content {
          text-align: center;
          padding: 1rem 0;
        }

        .confirmation-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .delivery-confirmation-content h3 {
          color: #1f2937;
          margin-bottom: 1rem;
          font-size: 1.25rem;
        }

        .delivery-confirmation-content p {
          color: #6b7280;
          line-height: 1.5;
          margin-bottom: 1.5rem;
        }

        .order-summary-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
          margin: 1.5rem 0;
          text-align: left;
        }

        .order-summary-box h4 {
          margin: 0 0 0.5rem 0;
          color: #1f2937;
          font-size: 1rem;
        }

        .order-summary-box p {
          margin: 0.25rem 0;
          color: #4b5563;
          font-size: 0.9rem;
        }

        .confirmation-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-top: 2rem;
        }

        .cancel-btn {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn:hover {
          background: #e5e7eb;
          transform: translateY(-1px);
        }

        .wallet-redirect-btn {
          background: #007B7F;
          color: white;
          font-size: 1rem;
          padding: 0.75rem 1.5rem;
          min-width: 220px;
        }

        .wallet-redirect-btn:hover {
          background: #005a5d;
        }

        @media (max-width: 640px) {
          .confirmation-actions {
            flex-direction: column;
            gap: 0.75rem;
          }
          
          .cancel-btn,
          .wallet-redirect-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default MessagesPage;