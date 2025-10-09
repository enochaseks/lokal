import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, getDocs, deleteDoc, setDoc, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripePaymentForm from '../components/StripePaymentForm';
import StripeGooglePayButton from '../components/StripeGooglePayButton';
import BankTransferForm from '../components/BankTransferForm';
import PaymentProviderSelector from '../components/PaymentProviderSelector';
import { useMessage } from '../MessageContext';
import { detectUserCountry, getPaymentProvider, getCountryName } from '../utils/countryDetection';
import { useToast } from '../contexts/ToastContext';

// Function to save store info to localStorage
const saveStoreInfoToLocalStorage = (conversationId, storeData) => {
  try {
    const storeInfoKey = `store_info_${conversationId}`;
    localStorage.setItem(storeInfoKey, JSON.stringify({
      ...storeData,
      savedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error saving store info to localStorage:', error);
  }
};

// Utility function to get user's IP address
const getUserIPAddress = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn('Failed to get IP from ipify, trying backup...', error);
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return data.ip;
    } catch (backupError) {
      console.error('Failed to get IP address:', backupError);
      return null;
    }
  }
};

// Function to load store info from localStorage
const loadStoreInfoFromLocalStorage = (conversationId) => {
  try {
    const storeInfoKey = `store_info_${conversationId}`;
    const savedData = localStorage.getItem(storeInfoKey);
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      // Check if data is less than 24 hours old
      const savedAt = new Date(parsedData.savedAt);
      const now = new Date();
      if ((now - savedAt) < (24 * 60 * 60 * 1000)) {
        return parsedData;
      }
    }
    return null;
  } catch (error) {
    console.error('Error loading store info from localStorage:', error);
    return null;
  }
};

// Function to get store name consistently
const getStoreName = (storeInfo, conversation) => {
  // Make sure we always return a valid string for storeName
  const name = storeInfo?.businessName || 
               storeInfo?.storeName || 
               storeInfo?.displayName || 
               conversation?.otherUserName || 
               'Unknown Store';
  
  // Ensure it's properly initialized as a string to prevent reference errors
  return String(name);
};

function MessagesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('messages');
  const { markMessagesAsRead } = useMessage();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  
  // Stripe Promise with Link disabled to force native wallets
  const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY, {
    disableLink: true,
    appearance: {
      disableAnimations: false,
    }
  });
  
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
  const [userBlockStatus, setUserBlockStatus] = useState(null); // Track if current user is blocked
  
  // Store items states
  const [showStoreItems, setShowStoreItems] = useState(false);
  const [storeItems, setStoreItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [storeInfo, setStoreInfo] = useState(null);
  const [sellerStoreData, setSellerStoreData] = useState(null); // Seller's own store data

  // Cart states
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  
  // Admin conversation states
  const [isAdminConversation, setIsAdminConversation] = useState(false);
  const [userStoreHistory, setUserStoreHistory] = useState([]);
  const [selectedReportStore, setSelectedReportStore] = useState(null);
  const [reportCategory, setReportCategory] = useState('');
  const [showFormalReportingInfo, setShowFormalReportingInfo] = useState(false);
  const [loadingStoreHistory, setLoadingStoreHistory] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editableReportText, setEditableReportText] = useState('');

  // Block request states
  const [showBlockRequestModal, setShowBlockRequestModal] = useState(false);
  const [blockRequestReason, setBlockRequestReason] = useState('');
  const [blockRequestDetails, setBlockRequestDetails] = useState('');
  const [blockRequestDuration, setBlockRequestDuration] = useState('7');
  const [submittingBlockRequest, setSubmittingBlockRequest] = useState(false);

  // Collapsible sections state
  const [cartSectionsCollapsed, setCartSectionsCollapsed] = useState({
    items: false,
    calculation: false
  });
  
  // Order workflow states
  const [orderStatus, setOrderStatus] = useState('shopping'); // 'shopping', 'done_adding', 'bagging', 'ready_for_payment', 'completed'
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [persistedOrderItems, setPersistedOrderItems] = useState([]);
  const [isOrderLockedForever, setIsOrderLockedForever] = useState(false); // Permanent lock state
  
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
  
  // Fee settings states (for sellers)
  const [showFeeSettings, setShowFeeSettings] = useState(false);
  
  // Withdrawal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawalProcessing, setWithdrawalProcessing] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    accountNumber: '',
    sortCode: '', // UK
    routingNumber: '', // US
    swiftCode: '', // International
    accountHolderName: '',
    bankName: '',
    cardNumber: '', // For card withdrawals
    expiryDate: '',
    country: 'GB',
    withdrawalMethod: 'bank_account' // 'bank_account' or 'card'
  });
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [withdrawalEligibility, setWithdrawalEligibility] = useState({
    eligible: false,
    daysOnPlatform: 0,
    monthlyWithdrawals: 0,
    lastWithdrawal: null,
    accountCreated: null
  });
  const [feeSettings, setFeeSettings] = useState({
    deliveryEnabled: false,
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    serviceFeeEnabled: false,
    serviceFeeType: 'percentage', // 'percentage' or 'fixed'
    serviceFeeRate: 2.5, // percentage
    serviceFeeAmount: 0, // fixed amount
    serviceFeeMax: 0, // max cap for percentage
    refundsEnabled: true, // allow refunds by default
    // Payment method settings
    cardPaymentsEnabled: true, // allow card payments by default
    googlePayEnabled: true, // allow Google Pay by default
    manualTransferOnly: false // false = accept all payments, true = manual transfer only
  });

  // Dynamic fee settings that can be updated based on store configuration
  const [useStoreFeeSettings, setUseStoreFeeSettings] = useState({
    deliveryEnabled: false,
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    serviceFeeEnabled: false,
    serviceFeeType: 'percentage',
    serviceFeeRate: 2.5,
    serviceFeeAmount: 0,
    serviceFeeMax: 0,
    refundsEnabled: true,
    cardPaymentsEnabled: true,
    googlePayEnabled: true,
    manualTransferOnly: false
  });

  // Delivery states
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
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

  // Refund modal states
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundDetails, setRefundDetails] = useState('');
  const [pendingRefundOrder, setPendingRefundOrder] = useState(null);

  // Stripe Connect states
  const [sellerConnectAccount, setSellerConnectAccount] = useState(null);
  const [stripeConnectBalance, setStripeConnectBalance] = useState({ available: 0, pending: 0 });
  
  // Country detection states
  const [userCountryCode, setUserCountryCode] = useState(null);
  const [userPaymentProvider, setUserPaymentProvider] = useState(null);
  const [countryDetectionLoading, setCountryDetectionLoading] = useState(true);
  
  // Refund transfer confirmation states
  const [showRefundTransferModal, setShowRefundTransferModal] = useState(false);
  const [refundTransferScreenshot, setRefundTransferScreenshot] = useState(null);
  const [pendingRefundTransfer, setPendingRefundTransfer] = useState(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  
  // Refund complaint states
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  
  // Stripe Connect setup modal
  const [showStripeConnectModal, setShowStripeConnectModal] = useState(false);
  
  // Orders marked as ready for collection
  const [ordersMarkedReady, setOrdersMarkedReady] = useState([]);
  
  // State to track collection completions that should be permanently faded out
  const [completedCollections, setCompletedCollections] = useState(() => {
    try {
      const saved = localStorage.getItem('completedCollectionOrders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error loading completed collections from localStorage:', e);
      return [];
    }
  });
  const [complaintData, setComplaintData] = useState({
    email: '',
    explanation: '',
    complaintType: 'incorrect_amount' // 'incorrect_amount', 'not_received', 'other'
  });
  const [complaintScreenshots, setComplaintScreenshots] = useState([]);
  const [pendingComplaintRefund, setPendingComplaintRefund] = useState(null);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  
  // Store refunds policy state
  const [storeRefundsEnabled, setStoreRefundsEnabled] = useState(true);
  
  // Wallet refund modal states
  const [showWalletRefundModal, setShowWalletRefundModal] = useState(false);
  const [walletRefundReason, setWalletRefundReason] = useState('');
  const [pendingWalletRefund, setPendingWalletRefund] = useState(null);
  
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

  // Country-specific withdrawal configurations
  const withdrawalConfigs = {
    GB: { // United Kingdom
      currency: 'GBP',
      minAmount: 5,
      maxAmount: 550,
      taxRate: 0.20, // 20% income tax (handled by Stripe)
      monthlyLimit: 3,
      requiredFields: ['accountNumber', 'sortCode', 'accountHolderName'],
      accountNumberLabel: 'Account Number',
      sortCodeLabel: 'Sort Code',
      bankNameRequired: true
    },
    US: { // United States
      currency: 'USD',
      minAmount: 5,
      maxAmount: 600,
      taxRate: 0.22, // 22% federal tax (handled by Stripe)
      monthlyLimit: 3,
      requiredFields: ['accountNumber', 'routingNumber', 'accountHolderName'],
      accountNumberLabel: 'Account Number',
      sortCodeLabel: 'Routing Number',
      bankNameRequired: true
    },
    NG: { // Nigeria
      currency: 'NGN',
      minAmount: 2000,
      maxAmount: 230000,
      taxRate: 0.05, // 5% withholding tax
      monthlyLimit: 3,
      requiredFields: ['accountNumber', 'bankName', 'accountHolderName'],
      accountNumberLabel: 'Account Number',
      sortCodeLabel: 'Bank Code',
      bankNameRequired: true
    },
    DE: { // Germany
      currency: 'EUR',
      minAmount: 5,
      maxAmount: 500,
      taxRate: 0.25, // 25% income tax (handled by Stripe)
      monthlyLimit: 3,
      requiredFields: ['accountNumber', 'swiftCode', 'accountHolderName'],
      accountNumberLabel: 'IBAN',
      sortCodeLabel: 'SWIFT/BIC Code',
      bankNameRequired: true
    },
    IN: { // India
      currency: 'INR',
      minAmount: 400,
      maxAmount: 42000,
      taxRate: 0.30, // 30% income tax
      monthlyLimit: 3,
      requiredFields: ['accountNumber', 'swiftCode', 'accountHolderName'],
      accountNumberLabel: 'Account Number',
      sortCodeLabel: 'IFSC Code',
      bankNameRequired: true
    },
    CA: { // Canada
      currency: 'CAD',
      minAmount: 7,
      maxAmount: 750,
      taxRate: 0.26, // 26% income tax (handled by Stripe)
      monthlyLimit: 3,
      requiredFields: ['accountNumber', 'routingNumber', 'accountHolderName'],
      accountNumberLabel: 'Account Number',
      sortCodeLabel: 'Transit Number',
      bankNameRequired: true
    }
  };

  const getCurrencySymbol = (code) => currencySymbols[code] || code;
  const currenciesWithDecimals = ["GBP", "USD", "EUR", "CAD", "AUD", "ZAR", "GHS", "KES", "INR", "CNY"];

  const formatPrice = (price, currency) => {
    if (currenciesWithDecimals.includes(currency)) {
      return Number(price).toFixed(2);
    }
    return price;
  };

  // Helper function to fetch user information from Firestore
  const fetchUserInfo = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          name: userData.displayName || userData.name || userData.username || userData.email || 'Unknown User',
          email: userData.email || 'Unknown Email'
        };
      }
      return { name: 'Unknown User', email: 'Unknown Email' };
    } catch (error) {
      console.warn('Could not fetch user details:', error);
      return { name: 'Unknown User', email: 'Unknown Email' };
    }
  };

  // Refund validation and processing helper
  const validateRefundData = (refundData) => {
    const errors = [];
    
    if (!refundData) {
      errors.push('Refund data is missing');
      return { isValid: false, errors };
    }

    if (!refundData.orderId) {
      errors.push('Order ID is required');
    }

    if (!refundData.amount || refundData.amount <= 0) {
      errors.push('Valid refund amount is required');
    }

    if (!refundData.currency) {
      errors.push('Currency is required');
    }

    if (refundData.requiresStripeRefund && !refundData.paymentIntentId) {
      errors.push('Payment Intent ID is required for Stripe refunds');
    }

    // Check if environment variables are set
    if (!process.env.REACT_APP_API_URL) {
      errors.push('Backend API URL not configured');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Enhanced refund processing with validation
  const processRefundSafely = async (refundData) => {
    const validation = validateRefundData(refundData);
    
    if (!validation.isValid) {
      console.error('❌ Refund validation failed:', validation.errors);
      alert(`Cannot process refund:\n\n${validation.errors.join('\n')}`);
      return { success: false, error: validation.errors.join(', ') };
    }

    try {
      const refundPayload = {
        paymentIntentId: refundData.paymentIntentId,
        amount: refundData.amount,
        currency: refundData.currency || 'GBP',
        reason: 'requested_by_customer'
      };

      console.log('🔄 Processing refund with payload:', refundPayload);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/process-refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(refundPayload)
      });

      const result = await response.json();
      console.log('📋 API Response:', { status: response.status, result });

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Refund processing failed');
      }

      console.log('✅ Refund processed successfully:', result.refundId);
      return { success: true, data: result };

    } catch (error) {
      console.error('❌ Refund processing error:', error);
      return { success: false, error: error.message };
    }
  };

  // Check withdrawal eligibility for sellers
  const checkWithdrawalEligibility = async () => {
    if (!currentUser || !isSeller) {
      return { eligible: false, reason: 'Not a seller account' };
    }

    try {
      // Get user creation date
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      const accountCreated = userData?.createdAt?.toDate() || new Date();
      
      // Calculate days on platform
      const now = new Date();
      const daysOnPlatform = Math.floor((now - accountCreated) / (1000 * 60 * 60 * 24));
      
      // Check if 14 days have passed
      const minimumDays = 14;
      const eligible = daysOnPlatform >= minimumDays;
      
      // Get withdrawal history for this month
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const withdrawalsRef = collection(db, 'withdrawals');
      const monthlyQuery = query(
        withdrawalsRef,
        where('sellerId', '==', currentUser.uid),
        where('status', 'in', ['completed', 'processing']),
        orderBy('createdAt', 'desc')
      );
      
      const monthlySnapshot = await getDocs(monthlyQuery);
      const monthlyWithdrawals = monthlySnapshot.docs.filter(doc => {
        const withdrawalDate = doc.data().createdAt.toDate();
        return withdrawalDate.getMonth() === currentMonth && 
               withdrawalDate.getFullYear() === currentYear;
      }).length;

      // Get last withdrawal
      const lastWithdrawalDoc = monthlySnapshot.docs[0];
      const lastWithdrawal = lastWithdrawalDoc ? lastWithdrawalDoc.data().createdAt.toDate() : null;

      const eligibilityData = {
        eligible,
        daysOnPlatform,
        monthlyWithdrawals,
        lastWithdrawal,
        accountCreated,
        reason: !eligible ? `Must wait ${minimumDays - daysOnPlatform} more days` : null
      };

      setWithdrawalEligibility(eligibilityData);
      return eligibilityData;
    } catch (error) {
      console.error('Error checking withdrawal eligibility:', error);
      return { eligible: false, reason: 'Error checking eligibility' };
    }
  };

  // Process withdrawal request
  const processWithdrawal = async () => {
    if (!withdrawalForm.amount || !withdrawalForm.accountHolderName) {
      showWarning('Please fill in all required fields');
      return;
    }

    const userCountry = withdrawalForm.country;
    const config = withdrawalConfigs[userCountry] || withdrawalConfigs.GB;
    const amount = parseFloat(withdrawalForm.amount);

    // Validate amount
    if (amount < config.minAmount || amount > config.maxAmount) {
      showWarning(`Withdrawal amount must be between ${getCurrencySymbol(config.currency)}${config.minAmount} and ${getCurrencySymbol(config.currency)}${config.maxAmount}`);
      return;
    }

    // Check monthly limit
    if (withdrawalEligibility.monthlyWithdrawals >= config.monthlyLimit) {
      showWarning(`You have reached the monthly withdrawal limit of ${config.monthlyLimit} withdrawals`);
      return;
    }

    // Check wallet balance
    if (walletData.balance < amount) {
      alert(`Insufficient balance. Available: ${getCurrencySymbol(config.currency)}${walletData.balance.toFixed(2)}`);
      return;
    }

    setWithdrawalProcessing(true);

    try {
      // Call backend to process withdrawal
      const withdrawalPayload = {
        amount: amount,
        currency: config.currency,
        country: userCountry,
        accountDetails: {
          accountNumber: withdrawalForm.accountNumber,
          sortCode: withdrawalForm.sortCode,
          routingNumber: withdrawalForm.routingNumber,
          swiftCode: withdrawalForm.swiftCode,
          accountHolderName: withdrawalForm.accountHolderName,
          bankName: withdrawalForm.bankName
        },
        sellerId: currentUser.uid,
        sellerEmail: currentUser.email,
        withdrawalMethod: withdrawalForm.withdrawalMethod
      };

      console.log('💸 Processing withdrawal:', withdrawalPayload);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/process-withdrawal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(withdrawalPayload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update local wallet balance
        const newBalance = walletData.balance - amount;
        setWalletData(prev => ({
          ...prev,
          balance: newBalance
        }));

        // Update wallet in Firestore
        const walletRef = doc(db, 'wallets', currentUser.uid);
        await updateDoc(walletRef, {
          balance: newBalance,
          lastUpdated: serverTimestamp()
        });

        // Create withdrawal record
        await addDoc(collection(db, 'withdrawals'), {
          sellerId: currentUser.uid,
          sellerEmail: currentUser.email,
          amount: amount,
          currency: config.currency,
          country: userCountry,
          accountDetails: withdrawalPayload.accountDetails,
          withdrawalMethod: withdrawalForm.withdrawalMethod,
          status: 'processing',
          stripeTransferId: result.transferId,
          createdAt: serverTimestamp(),
          estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days
        });

        // Create transaction record
        await addDoc(collection(db, 'transactions'), {
          sellerId: currentUser.uid,
          type: 'withdrawal',
          amount: -amount,
          currency: config.currency,
          paymentMethod: withdrawalForm.withdrawalMethod,
          stripeTransferId: result.transferId,
          description: `Withdrawal to ${withdrawalForm.withdrawalMethod === 'card' ? 'card' : 'bank account'}`,
          status: 'processing',
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp()
        });

        showSuccess(`Withdrawal of ${getCurrencySymbol(config.currency)}${amount.toFixed(2)} has been processed! Transfer ID: ${result.transferId}. Funds will arrive in your account within 1-2 business days.`);
        
        setShowWithdrawModal(false);
        setWithdrawalForm({
          amount: '',
          accountNumber: '',
          sortCode: '',
          routingNumber: '',
          swiftCode: '',
          accountHolderName: '',
          bankName: '',
          cardNumber: '',
          expiryDate: '',
          country: 'GB',
          withdrawalMethod: 'bank_account'
        });

        // Refresh eligibility data
        checkWithdrawalEligibility();

      } else {
        throw new Error(result.error || 'Withdrawal processing failed');
      }

    } catch (error) {
      console.error('❌ Withdrawal error:', error);
      showError(`Withdrawal failed: ${error.message}. Please check your details and try again.`);
    }

    setWithdrawalProcessing(false);
  };

  // Update seller wallet when refund is processed
  const updateSellerWalletForRefund = async (refundData, refundAmount) => {
    const paymentMethod = refundData.paymentMethod || 'unknown';
    
    // Bank transfers never go to seller wallet, so no deduction needed
    if (paymentMethod === 'bank_transfer') {
      console.log('ℹ️ Bank transfer refund - no wallet deduction needed (payment was direct to seller)');
      return;
    }

    if (!refundData.sellerId) {
      console.warn('⚠️ No seller ID provided for wallet refund deduction');
      return;
    }

    try {
      console.log(`💰 Updating seller wallet for ${paymentMethod} refund deduction...`);
      
      const sellerWalletRef = doc(db, 'wallets', refundData.sellerId);
      const sellerWalletSnap = await getDoc(sellerWalletRef);
      
      if (sellerWalletSnap.exists()) {
        const currentData = sellerWalletSnap.data();
        const currentBalance = currentData.balance || 0;
        const currentTotalEarnings = currentData.totalEarnings || 0;
        const newBalance = Math.max(0, currentBalance - refundAmount); // Prevent negative balance
        const newTotalEarnings = Math.max(0, currentTotalEarnings - refundAmount); // Also update total earnings
        
        await updateDoc(sellerWalletRef, {
          balance: newBalance,
          totalEarnings: newTotalEarnings,
          lastUpdated: serverTimestamp()
        });

        // Create refund transaction record
        const refundDescription = refundData.refundReason 
          ? `${paymentMethod.toUpperCase()} refund: "${refundData.refundReason}" (Order: ${refundData.orderId})`
          : `${paymentMethod.toUpperCase()} refund deduction for order: ${refundData.orderId}`;
          
        await addDoc(collection(db, 'transactions'), {
          sellerId: refundData.sellerId,
          orderId: refundData.orderId,
          customerId: refundData.customerId || 'unknown',
          customerName: refundData.customerName || 'Unknown Customer',
          type: 'refund_deduction',
          amount: -refundAmount, // Negative amount for deduction
          currency: refundData.currency || 'GBP',
          paymentMethod: paymentMethod,
          stripeRefundId: refundData.stripeRefundId || null,
          description: refundDescription,
          refundReason: refundData.refundReason || null,
          status: 'completed',
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp()
        });

        console.log(`💰 Seller wallet updated for ${paymentMethod}: deducted ${refundAmount} ${refundData.currency}. New balance: ${newBalance}, New total earnings: ${newTotalEarnings}`);
        
        // Special logging for digital wallet refunds
        if (['google_pay', 'apple_pay'].includes(paymentMethod)) {
          console.log(`🏦 ${paymentMethod.toUpperCase()} refund processed - customer will see refund in their ${paymentMethod.replace('_', ' ')} account within 2-5 business days`);
        }
      } else {
        console.warn('⚠️ Seller wallet not found - cannot deduct refund amount');
        
        // Create wallet with negative balance if needed (edge case)
        await setDoc(sellerWalletRef, {
          balance: Math.max(0, -refundAmount), // Prevent negative balance
          pendingBalance: 0,
          totalEarnings: 0,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
        console.log('ℹ️ Created new wallet entry for seller');
      }
    } catch (error) {
      console.error('❌ Error updating seller wallet for refund:', error);
    }
  };

  // Payment methods by region/currency
  const getPaymentMethods = (currency, storeFeeSettings = null) => {
    // Check if this store has specific payment method restrictions
    const effectiveSettings = storeFeeSettings || useStoreFeeSettings;
    
    // If manual transfer only is enabled, return only manual transfer options
    if (effectiveSettings.manualTransferOnly) {
      const manualOnlyMethods = [];
      
      // Add appropriate manual transfer method based on currency
      switch (currency) {
        case 'GBP':
          manualOnlyMethods.push({ id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Manual bank transfer required' });
          break;
        case 'EUR':
          manualOnlyMethods.push({ id: 'sepa', name: 'SEPA Transfer', icon: '🏦', description: 'Manual SEPA transfer required' });
          break;
        case 'NGN':
          manualOnlyMethods.push({ id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Manual Nigerian bank transfer required' });
          break;
        case 'USD':
          manualOnlyMethods.push({ id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Manual bank transfer required' });
          break;
        case 'GHS':
          manualOnlyMethods.push({ id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Manual Ghana bank transfer required' });
          break;
        case 'ZAR':
          manualOnlyMethods.push({ id: 'eft', name: 'EFT', icon: '🏦', description: 'Manual electronic funds transfer required' });
          break;
        default:
          manualOnlyMethods.push({ id: 'bank_transfer', name: 'Manual Transfer', icon: '🏦', description: 'Manual bank transfer required' });
          break;
      }
      return manualOnlyMethods;
    }

    // Build methods array based on enabled payment options
    const baseMethods = [];
    
    // Add card payments if enabled
    if (effectiveSettings.cardPaymentsEnabled !== false) {
      baseMethods.push({ id: 'card', name: 'Credit/Debit Card', icon: '💳', description: 'Visa, Mastercard, American Express' });
    }

    const additionalMethods = [];
    
    switch (currency) {
      case 'USD':
        // Add Google Pay if enabled
        if (effectiveSettings.googlePayEnabled !== false) {
          additionalMethods.push({ id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' });
        }
        additionalMethods.push({ id: 'venmo', name: 'Venmo', icon: '📱', description: 'Split with friends' });
        break;
      case 'GBP':
        // Add Google Pay if enabled
        if (effectiveSettings.googlePayEnabled !== false) {
          additionalMethods.push({ id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' });
        }
        additionalMethods.push({ id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Direct bank transfer' });
        break;
      case 'EUR':
        // Add Google Pay if enabled
        if (effectiveSettings.googlePayEnabled !== false) {
          additionalMethods.push({ id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' });
        }
        additionalMethods.push({ id: 'sepa', name: 'SEPA Transfer', icon: '🏦', description: 'European bank transfer' });
        additionalMethods.push({ id: 'klarna', name: 'Klarna', icon: '🛡️', description: 'Buy now, pay later' });
        break;
      case 'NGN':
        additionalMethods.push(
          { id: 'flutterwave', name: 'Flutterwave', icon: '💳', description: 'Pay with Flutterwave' },
          { id: 'paystack', name: 'Paystack', icon: '⚡', description: 'Quick Nigerian payments' },
          { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Nigerian bank transfer' },
          { id: 'ussd', name: 'USSD', icon: '📞', description: 'Dial *code# to pay' }
        );
        break;
      case 'KES':
        additionalMethods.push(
          { id: 'mpesa', name: 'M-Pesa', icon: '📱', description: 'Kenya mobile money' },
          { id: 'airtel_money', name: 'Airtel Money', icon: '📲', description: 'Airtel mobile money' },
          { id: 'flutterwave', name: 'Flutterwave', icon: '💳', description: 'Pay with Flutterwave' }
        );
        break;
      case 'GHS':
        additionalMethods.push(
          { id: 'momo', name: 'Mobile Money', icon: '📱', description: 'MTN, Vodafone, AirtelTigo' },
          { id: 'flutterwave', name: 'Flutterwave', icon: '💳', description: 'Pay with Flutterwave' },
          { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Ghana bank transfer' }
        );
        break;
      case 'ZAR':
        additionalMethods.push(
          { id: 'payfast', name: 'PayFast', icon: '⚡', description: 'South African payments' },
          { id: 'eft', name: 'EFT', icon: '🏦', description: 'Electronic funds transfer' },
          { id: 'instant_eft', name: 'Instant EFT', icon: '⚡', description: 'Instant bank payment' }
        );
        break;
      case 'INR':
        additionalMethods.push(
          { id: 'upi', name: 'UPI', icon: '📱', description: 'PhonePe, GPay, Paytm' },
          { id: 'razorpay', name: 'Razorpay', icon: '💙', description: 'Multiple payment options' },
          { id: 'paytm', name: 'Paytm', icon: '💳', description: 'Paytm wallet & more' },
          { id: 'netbanking', name: 'Net Banking', icon: '🏦', description: 'All major banks' }
        );
        break;
      case 'CNY':
        additionalMethods.push(
          { id: 'alipay', name: 'Alipay', icon: '💙', description: 'Ant Financial payment' },
          { id: 'wechat_pay', name: 'WeChat Pay', icon: '💬', description: 'Tencent mobile payment' },
          { id: 'unionpay', name: 'UnionPay', icon: '🏦', description: 'China UnionPay cards' }
        );
        break;
      case 'JPY':
        // Add Google Pay if enabled
        if (effectiveSettings.googlePayEnabled !== false) {
          additionalMethods.push({ id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' });
        }
        additionalMethods.push(
          { id: 'konbini', name: 'Konbini', icon: '🏪', description: 'Pay at convenience store' },
          { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', description: 'Japanese bank transfer' }
        );
        break;
      default:
        // Add Google Pay if enabled
        if (effectiveSettings.googlePayEnabled !== false) {
          additionalMethods.push({ id: 'google_pay', name: 'Google Pay', icon: '🌐', description: 'Pay with Google' });
        }
        break;
    }
    
    return [...baseMethods, ...additionalMethods];
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

  // Sync useStoreFeeSettings with feeSettings changes
  useEffect(() => {
    setUseStoreFeeSettings(feeSettings);
  }, [feeSettings]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const storeDocRef = doc(db, 'stores', user.uid);
          const storeDocSnap = await getDoc(storeDocRef);
          const isSellerStore = storeDocSnap.exists();
          setIsSeller(isSellerStore);
          
          // Auto-configure payment settings based on Stripe Connect status
          if (isSellerStore) {
            const storeData = storeDocSnap.data();
            const hasStripeConnect = !!(storeData.stripeConnectAccountId || storeData.hasAutomaticPayments);
            
            // Automatically set manual transfer only if no Stripe Connect
            setFeeSettings(prevSettings => ({
              ...prevSettings,
              manualTransferOnly: !hasStripeConnect,
              // If no Stripe Connect, also disable card and Google Pay
              cardPaymentsEnabled: hasStripeConnect,
              googlePayEnabled: hasStripeConnect
            }));
            
            console.log('💳 Payment settings auto-configured:', {
              hasStripeConnect,
              manualTransferOnly: !hasStripeConnect,
              stripeConnectAccountId: storeData.stripeConnectAccountId,
              hasAutomaticPayments: storeData.hasAutomaticPayments,
              storeDataKeys: Object.keys(storeData)
            });
          }
          
          // Check for persisted order state
          const orderStateDocRef = doc(db, 'orderStates', user.uid);
          const orderStateSnap = await getDoc(orderStateDocRef);
          if (orderStateSnap.exists()) {
            const orderState = orderStateSnap.data();
            setOrderStatus(orderState.status || 'shopping');
            setCurrentOrderId(orderState.orderId || null);
            setPersistedOrderItems(orderState.items || []);
            setIsOrderLockedForever(orderState.lockedForever || false); // Check permanent lock
            
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

  // Country detection effect
  useEffect(() => {
    const detectCountryAndProvider = async () => {
      try {
        setCountryDetectionLoading(true);
        const countryCode = await detectUserCountry();
        const provider = getPaymentProvider(countryCode);
        
        setUserCountryCode(countryCode);
        setUserPaymentProvider(provider);
        
        console.log('🌍 MessagesPage country detection:', {
          country: getCountryName(countryCode),
          provider: provider.provider,
          supported: provider.supported
        });
      } catch (error) {
        console.error('Error detecting country in MessagesPage:', error);
        // Default to GB/Stripe
        setUserCountryCode('GB');
        setUserPaymentProvider({
          provider: 'stripe',
          name: 'Stripe Connect',
          supported: true
        });
      } finally {
        setCountryDetectionLoading(false);
      }
    };

    detectCountryAndProvider();
  }, []);

  useEffect(() => {
    if (isSeller && currentUser) {
      checkWithdrawalEligibility();
    }
  }, [isSeller, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle navigation state (for wallet tab redirect and new conversations)
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Clear the state after using it
      window.history.replaceState(null, '');
    }
    
    // Handle new conversation from store preview
    if (location.state?.newConversation && currentUser) {
      const newConv = location.state.newConversation;
      
      // Check if this is an admin conversation
      if (newConv.isAdminChat) {
        setIsAdminConversation(true);
        setStoreInfo(null); // Clear store info for admin conversations
        const adminConversation = {
          id: newConv.conversationId,
          otherUserId: newConv.otherUserId,
          otherUserName: newConv.otherUserName,
          otherUserEmail: newConv.otherUserEmail,
          isAdminChat: true,
          storeContext: newConv.storeContext,
          lastMessage: 'Admin conversation started',
          lastMessageTime: new Date(),
          isRead: true
        };
        
        setSelectedConversation(adminConversation);
        
        // Add admin conversation to conversations list if not already there
        setConversations(prevConversations => {
          const existingIndex = prevConversations.findIndex(conv => conv.id === newConv.conversationId);
          if (existingIndex === -1) {
            return [adminConversation, ...prevConversations];
          } else {
            return prevConversations;
          }
        });
        
        // Fetch user's store history for admin reporting
        fetchUserStoreHistory();
        setShowFormalReportingInfo(true);
      } else {
        setIsAdminConversation(false);
        setSelectedConversation({
          id: newConv.conversationId,
          otherUserId: newConv.otherUserId,
          otherUserName: newConv.otherUserName,
          otherUserEmail: newConv.otherUserEmail,
          storeAddress: newConv.storeAddress,
          customerAddress: newConv.customerAddress
        });
      }
      // Clear the state after using it
      window.history.replaceState(null, '');
    }
  }, [location.state, currentUser]);

  // Fetch conversations
  useEffect(() => {
    if (!currentUser) return;

    // For sellers, we need to fetch both sent and received messages to see all conversations
    // For sellers, fetch all messages to see all conversations
    // For customers, fetch messages where they are sender OR receiver to see all their conversations
    const messagesQuery = isSeller 
      ? query(
          collection(db, 'messages'),
          orderBy('timestamp', 'desc')
        )
      : query(
          collection(db, 'messages'),
          // For customers, we'll filter by either senderId OR receiverId in the code below
          // This gets ALL messages and we'll filter them in the forEach loop
          orderBy('timestamp', 'desc')
        );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      const conversationMap = new Map();
      
      for (const docSnapshot of snapshot.docs) {
        const message = { id: docSnapshot.id, ...docSnapshot.data() };
        
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
          // Customer logic - include conversations where customer is sender OR receiver
          if (message.senderId === currentUser.uid) {
            // Customer sending a message
            shouldInclude = true;
            otherUserId = message.receiverId;
            otherUserName = message.receiverName;
            otherUserEmail = message.receiverEmail;
            conversationId = message.conversationId;
          } else if (message.receiverId === currentUser.uid) {
            // Customer receiving a message
            shouldInclude = true;
            otherUserId = message.senderId;
            otherUserName = message.senderName;
            otherUserEmail = message.senderEmail;
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
            
            // For customers talking to sellers, try to get the actual store name
            let storeName = otherUserName;
            if (!isSeller && otherUserId) {
              // Try to get store name from the store document
              try {
                const storeDoc = await getDoc(doc(db, 'stores', otherUserId));
                if (storeDoc.exists()) {
                  const storeData = storeDoc.data();
                  storeName = storeData.businessName || storeData.storeName || storeData.displayName || otherUserName;
                }
              } catch (error) {
                console.log('Could not fetch store name for conversation:', error);
              }
            }
            
            conversationMap.set(conversationId, {
              id: conversationId,
              otherUserId,
              otherUserName,
              storeName, // Add store name field
              otherUserEmail,
              lastMessage: message.message,
              lastMessageTime: message.timestamp,
              isRead: message.isRead,
              messageType: message.messageType
            });
          }
        }
      }

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

  // Check blocking status when conversation is selected
  useEffect(() => {
    const checkConversationBlockStatus = async () => {
      if (!selectedConversation || !currentUser) {
        setUserBlockStatus(null);
        return;
      }

      try {
        const blockCheck = await checkIfUserBlocked(currentUser.uid, selectedConversation.otherUserId);
        setUserBlockStatus(blockCheck);
      } catch (error) {
        console.error('Error checking block status:', error);
        setUserBlockStatus(null);
      }
    };

    checkConversationBlockStatus();
  }, [selectedConversation, currentUser]);

  // Fetch store info when conversation is selected (for displaying correct email and refunds policy)
  useEffect(() => {
    if (!selectedConversation) return;

    // Clear store info for admin conversations
    if (isAdminConversation) {
      setStoreInfo(null);
      setStoreRefundsEnabled(true);
      return;
    }

    const fetchStoreInfo = async () => {
      try {
        // For buyers, fetch store info from the other user (seller)
        // For sellers, we still need store info for refunds policy
        const storeUserId = isSeller ? currentUser.uid : selectedConversation.otherUserId;
        
        // First try to get the store document
        const storeDoc = await getDoc(doc(db, 'stores', storeUserId));
        if (storeDoc.exists()) {
          const storeData = storeDoc.data();
          
          // If store name isn't in store data, try to get it from the user's profile
          if (!storeData.businessName && !storeData.storeName) {
            const userDoc = await getDoc(doc(db, 'users', storeUserId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              storeData.businessName = userData.businessName || userData.storeName || userData.displayName;
            }
          }
          
          setStoreInfo(storeData);
          
          // Check refunds policy
          const feeSettings = storeData.feeSettings || {};
          setStoreRefundsEnabled(feeSettings.refundsEnabled !== false); // default to true
          
          // If this is a buyer and we don't have store address in selectedConversation, update it
          if (!isSeller && !selectedConversation.storeAddress && storeData.storeLocation) {
            setSelectedConversation(prev => ({
              ...prev,
              storeAddress: storeData.storeLocation
            }));
          }
        } else {
          // If store doesn't exist, default to allowing refunds
          setStoreRefundsEnabled(true);
        }

        // For sellers, fetch customer address if not already available
        if (isSeller && !selectedConversation.customerAddress) {
          const customerDoc = await getDoc(doc(db, 'users', selectedConversation.otherUserId));
          if (customerDoc.exists()) {
            const customerData = customerDoc.data();
            const customerAddress = customerData.address || customerData.location || '';
            if (customerAddress) {
              setSelectedConversation(prev => ({
                ...prev,
                customerAddress: customerAddress
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching store info:', error);
        setStoreRefundsEnabled(true); // default to allowing refunds on error
      }
    };

    fetchStoreInfo();
  }, [selectedConversation, isSeller, currentUser, isAdminConversation]);

  // Fetch store items and info when showing items
  useEffect(() => {
    if (!showStoreItems || !selectedConversation || isSeller || isAdminConversation) return;

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
  }, [showStoreItems, selectedConversation, isSeller, isAdminConversation]);

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

  // Check for Stripe Connect account and sync balance
  useEffect(() => {
    if (!isSeller || !currentUser) return;

    const checkConnectAccount = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        const hasStripeConnect = !!userData?.stripeConnectAccountId;
        
        if (hasStripeConnect) {
          setSellerConnectAccount({
            accountId: userData.stripeConnectAccountId,
            email: userData.email || currentUser.email
          });

          // Sync Stripe balance with wallet
          await syncStripeBalance(userData.stripeConnectAccountId);
        }

        // Update payment settings based on current Stripe Connect status
        setFeeSettings(prevSettings => ({
          ...prevSettings,
          manualTransferOnly: !hasStripeConnect,
          // If no Stripe Connect, also disable card and Google Pay
          cardPaymentsEnabled: hasStripeConnect,
          googlePayEnabled: hasStripeConnect
        }));

        console.log('💳 Payment settings updated based on Stripe Connect status:', {
          hasStripeConnect,
          manualTransferOnly: !hasStripeConnect,
          userData: userData ? Object.keys(userData) : 'no userData'
        });
        
      } catch (error) {
        console.error('Error checking Connect account:', error);
      }
    };

    checkConnectAccount();
  }, [isSeller, currentUser]);

  // Function to sync Stripe Connect balance with local wallet
  const syncStripeBalance = async (accountId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/stripe/account-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });

      const data = await response.json();
      if (data.success) {
        setStripeConnectBalance({
          available: data.available.amount,
          pending: data.pending.amount,
          currency: data.available.currency
        });

        // Update Firestore wallet to sync with Stripe balance
        const walletRef = doc(db, 'wallets', currentUser.uid);
        await updateDoc(walletRef, {
          stripeBalance: data.available.amount,
          stripePending: data.pending.amount,
          lastStripeSync: serverTimestamp()
        });

        console.log('💰 Synced Stripe balance:', data.available.amount);
      }
    } catch (error) {
      console.error('Error syncing Stripe balance:', error);
    }
  };

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
            setIsOrderLockedForever(orderState.lockedForever || false); // Check permanent lock
            
            // If order is locked (done_adding/bagging), clear cart but keep persisted items
            if (orderState.status === 'done_adding' || orderState.status === 'bagging') {
              setCart([]);
            }
          } else {
            // Different conversation - reset to shopping state
            setOrderStatus('shopping');
            setCurrentOrderId(null);
            setPersistedOrderItems([]);
            setIsOrderLockedForever(false); // Reset lock state
            setCart([]); // Clear cart when switching conversations
          }
        } else {
          // No persisted order state - reset to shopping
          setOrderStatus('shopping');
          setCurrentOrderId(null);
          setPersistedOrderItems([]);
          setIsOrderLockedForever(false); // Reset lock state
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

  // Fetch user's store interaction history for admin conversations
  const fetchUserStoreHistory = async () => {
    if (!currentUser) return;
    
    setLoadingStoreHistory(true);
    try {
      const storeHistory = [];

      // 1. Get recently viewed stores from localStorage (same as ProfilePage)
      const viewedData = localStorage.getItem(`viewedStores_${currentUser.uid}`);
      if (viewedData) {
        const storeIds = JSON.parse(viewedData);
        
        // Fetch store details for each viewed store ID
        for (const storeId of storeIds) {
          try {
            const storeDoc = await getDoc(doc(db, 'stores', storeId));
            if (storeDoc.exists()) {
              const storeData = storeDoc.data();
              
              // Also fetch user email from users collection
              let storeEmail = storeData.storeEmail || storeData.email || 'No email';
              try {
                const userDoc = await getDoc(doc(db, 'users', storeId));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  storeEmail = userData.email || storeEmail;
                }
              } catch (error) {
                console.log('Error fetching user email for store:', storeId);
              }
              
              storeHistory.push({
                storeId: storeId,
                storeName: storeData.storeName || 'Unknown Store',
                storeEmail: storeEmail,
                lastInteraction: 'Recently viewed',
                interactionType: 'viewed'
              });
            }
          } catch (error) {
            console.log('Error fetching recently viewed store:', error);
          }
        }
      }

      // 2. Get stores from user's orders (same as ProfilePage)
      const paymentsQuery = query(
        collection(db, 'messages'),
        where('messageType', 'in', ['payment_completed', 'payment_notification', 'order_request', 'pay_at_store_completed'])
      );
      
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const customerOrders = [];
      
      for (const doc of paymentsSnapshot.docs) {
        const message = doc.data();
        
        // If this user was the customer who made the payment
        if ((message.messageType === 'payment_completed' || message.messageType === 'pay_at_store_completed' || message.messageType === 'order_request') && message.senderId === currentUser.uid) {
          const orderId = message.paymentData?.orderId || message.orderData?.orderId;
          const storeId = message.receiverId;
          const orderStoreName = message.receiverName;
          
          if (storeId && orderStoreName && orderId) {
            // Check if we already have this store
            const existingStoreIndex = storeHistory.findIndex(store => store.storeId === storeId);
            
            if (existingStoreIndex === -1) {
              // Fetch store email from users collection
              let storeEmail = 'From order history';
              try {
                const userDoc = await getDoc(doc(db, 'users', storeId));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  storeEmail = userData.email || storeEmail;
                }
              } catch (error) {
                console.log('Error fetching user email for store:', storeId);
              }
              
              storeHistory.push({
                storeId: storeId,
                storeName: orderStoreName,
                storeEmail: storeEmail,
                lastInteraction: message.timestamp?.toDate?.()?.toLocaleDateString() || 'Recent order',
                interactionType: 'ordered'
              });
            } else {
              // Update interaction type if it was a more significant interaction
              storeHistory[existingStoreIndex].interactionType = 'ordered';
              storeHistory[existingStoreIndex].lastInteraction = message.timestamp?.toDate?.()?.toLocaleDateString() || 'Recent order';
            }
          }
        }
      }

      // Remove duplicates and sort by interaction type priority
      const uniqueStores = storeHistory.filter((store, index, self) => 
        index === self.findIndex(s => s.storeId === store.storeId)
      );
      
      // Sort: ordered stores first, then viewed stores
      uniqueStores.sort((a, b) => {
        if (a.interactionType === 'ordered' && b.interactionType === 'viewed') return -1;
        if (a.interactionType === 'viewed' && b.interactionType === 'ordered') return 1;
        return 0;
      });

      setUserStoreHistory(uniqueStores.slice(0, 10)); // Limit to 10 most relevant stores
    } catch (error) {
      console.error('Error fetching user store history:', error);
    } finally {
      setLoadingStoreHistory(false);
    }
  };

  // Check if user is blocked from messaging
  const checkIfUserBlocked = async (senderId, receiverId) => {
    try {
      // First check old system (temporary block system)
      const blockedUsersQuery = query(
        collection(db, 'blocked_users'),
        where('buyerId', '==', senderId),
        where('sellerId', '==', receiverId),
        where('isActive', '==', true)
      );
      
      const blockedSnapshot = await getDocs(blockedUsersQuery);
      
      for (const blockedDoc of blockedSnapshot.docs) {
        const blockData = blockedDoc.data();
        const blockUntil = new Date(blockData.blockedUntil);
        const now = new Date();
        
        if (now < blockUntil) {
          // Block is still active
          const remainingTime = Math.ceil((blockUntil - now) / (1000 * 60 * 60)); // hours
          return {
            isBlocked: true,
            reason: blockData.reason,
            remainingHours: remainingTime,
            blockUntil: blockUntil,
            blockType: 'temporary'
          };
        } else {
          // Block has expired, deactivate it
          await updateDoc(doc(db, 'blocked_users', blockedDoc.id), {
            isActive: false,
            expiredAt: serverTimestamp()
          });
        }
      }

      // Check for permanent store-level blocks
      // Check if sender is blocked by receiver (store owner blocking buyer)
      try {
        const storeBlockedRef = doc(db, 'stores', receiverId, 'blocked', senderId);
        const storeBlockedDoc = await getDoc(storeBlockedRef);
        
        if (storeBlockedDoc.exists()) {
          const blockData = storeBlockedDoc.data();
          return {
            isBlocked: true,
            reason: 'You have been blocked by this store owner',
            blockType: 'permanent',
            blockedAt: blockData.blockedAt,
            blockedBy: blockData.blockedBy
          };
        }
      } catch (error) {
        console.error('Error checking store-level blocks:', error);
      }

      // Check if receiver is blocked by sender's store (if sender is a store owner)
      try {
        const senderStoreBlockedRef = doc(db, 'stores', senderId, 'blocked', receiverId);
        const senderStoreBlockedDoc = await getDoc(senderStoreBlockedRef);
        
        if (senderStoreBlockedDoc.exists()) {
          const blockData = senderStoreBlockedDoc.data();
          return {
            isBlocked: true,
            reason: 'You have blocked this user from your store',
            blockType: 'permanent',
            blockedAt: blockData.blockedAt,
            blockedBy: blockData.blockedBy
          };
        }
      } catch (error) {
        console.error('Error checking sender store blocks:', error);
      }

      // Check for admin blocks
      try {
        const adminBlocksQuery = query(
          collection(db, 'admin_blocks'),
          where('userId', '==', senderId),
          where('storeId', '==', receiverId),
          where('isActive', '==', true)
        );
        
        const adminBlocksSnapshot = await getDocs(adminBlocksQuery);
        
        for (const adminBlockDoc of adminBlocksSnapshot.docs) {
          const blockData = adminBlockDoc.data();
          
          // Check if block has expired (for non-permanent blocks)
          if (blockData.expiresAt && blockData.expiresAt.toDate() < new Date()) {
            // Block has expired, deactivate it
            await updateDoc(doc(db, 'admin_blocks', adminBlockDoc.id), {
              isActive: false,
              expiredAt: serverTimestamp()
            });
            continue;
          }
          
          // Block is still active
          return {
            isBlocked: true,
            reason: `You have been suspended from this store by admin.\nReason: ${blockData.reason}`,
            blockType: 'admin_block',
            duration: blockData.duration,
            adminResponse: blockData.adminResponse,
            blockedAt: blockData.createdAt,
            expiresAt: blockData.expiresAt
          };
        }
      } catch (error) {
        console.error('Error checking admin blocks:', error);
      }

      // Check for IP blocks
      try {
        const userIP = await getUserIPAddress();
        if (userIP) {
          // Check store-specific IP blocks
          const storeIPBlocksQuery = query(
            collection(db, `stores/${receiverId}/blocked_ips`),
            where('ipAddress', '==', userIP),
            where('isActive', '==', true)
          );
          const storeIPBlocksSnapshot = await getDocs(storeIPBlocksQuery);
          
          for (const ipBlockDoc of storeIPBlocksSnapshot.docs) {
            const blockData = ipBlockDoc.data();
            // Check if block is still active (not expired)
            if (blockData.blockedUntil === 'permanent') {
              return {
                isBlocked: true,
                reason: `Your IP address has been permanently blocked from this store.\nReason: ${blockData.reason}`,
                blockType: 'ip_permanent',
                adminId: blockData.adminId,
                adminName: blockData.adminName
              };
            } else if (new Date(blockData.blockedUntil) > new Date()) {
              const remainingHours = Math.ceil((new Date(blockData.blockedUntil) - new Date()) / (1000 * 60 * 60));
              return {
                isBlocked: true,
                reason: `Your IP address has been temporarily blocked from this store.\nReason: ${blockData.reason}`,
                blockType: 'ip_temporary',
                remainingHours: remainingHours,
                blockUntil: new Date(blockData.blockedUntil),
                adminId: blockData.adminId,
                adminName: blockData.adminName
              };
            }
          }

          // Check seller-level IP blocks (blocks access to all stores owned by the seller)
          const sellerIPBlocksQuery = query(
            collection(db, `users/${receiverId}/blocked_ips`),
            where('ipAddress', '==', userIP),
            where('isActive', '==', true)
          );
          const sellerIPBlocksSnapshot = await getDocs(sellerIPBlocksQuery);
          
          for (const ipBlockDoc of sellerIPBlocksSnapshot.docs) {
            const blockData = ipBlockDoc.data();
            // Check if block is still active (not expired)
            if (blockData.blockedUntil === 'permanent') {
              return {
                isBlocked: true,
                reason: `Your IP address has been permanently blocked from all stores owned by this seller.\nReason: ${blockData.reason}`,
                blockType: 'seller_ip_permanent',
                adminId: blockData.adminId,
                adminName: blockData.adminName
              };
            } else if (new Date(blockData.blockedUntil) > new Date()) {
              const remainingHours = Math.ceil((new Date(blockData.blockedUntil) - new Date()) / (1000 * 60 * 60));
              return {
                isBlocked: true,
                reason: `Your IP address has been temporarily blocked from all stores owned by this seller.\nReason: ${blockData.reason}`,
                blockType: 'seller_ip_temporary',
                remainingHours: remainingHours,
                blockUntil: new Date(blockData.blockedUntil),
                adminId: blockData.adminId,
                adminName: blockData.adminName
              };
            }
          }
        }
      } catch (error) {
        console.error('Error checking IP blocks:', error);
      }
      
      return { isBlocked: false };
    } catch (error) {
      console.error('Error checking blocked users:', error);
      return { isBlocked: false }; // Default to allow on error
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    try {
      // Check if current user is blocked from messaging the receiver
      const blockCheck = await checkIfUserBlocked(currentUser.uid, selectedConversation.otherUserId);
      
      if (blockCheck.isBlocked) {
        if (blockCheck.blockType === 'permanent') {
          // Permanent store-level block
          if (blockCheck.reason === 'You have blocked this user from your store') {
            alert(`🚫 You have blocked this user from your store.\n\nTo send messages to them, you need to unblock them first.\n\nYou can manage blocked users in your store profile under "Manage Blocked Users".`);
          } else {
            alert(`🚫 You have been permanently blocked by this store.\n\nReason: ${blockCheck.reason}\n\nYou cannot send messages to this store. If you believe this was done in error, please contact support.`);
          }
        } else if (blockCheck.blockType === 'admin_block') {
          // Admin imposed block
          const expiryText = blockCheck.duration === 'permanent' ? 
            'This is a permanent suspension.' : 
            `This suspension will expire on ${blockCheck.expiresAt?.toDate().toLocaleDateString()}.`;
            
          alert(`🚨 You have been suspended from this store by admin.\n\n${blockCheck.reason}\n\n${expiryText}\n\nAdmin Response: ${blockCheck.adminResponse || 'No additional comments.'}\n\nIf you believe this was done in error, please contact support with your case details.`);
        } else {
          // Temporary block (old system)
          const remainingTime = blockCheck.remainingHours > 24 ? 
            `${Math.ceil(blockCheck.remainingHours / 24)} day(s)` : 
            `${blockCheck.remainingHours} hour(s)`;
            
          alert(`❌ You are temporarily blocked from messaging this seller.\n\nReason: ${blockCheck.reason}\n\nTime remaining: ${remainingTime}\n\nThis restriction was put in place to protect our sellers. If you believe this was done in error, please contact support.`);
        }
        return;
      }

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

  // Handle block request to admin
  const handleBlockRequest = async () => {
    if (!currentUser || !selectedConversation || !isSeller) return;
    
    if (!blockRequestReason.trim() || !blockRequestDetails.trim()) {
      alert('Please provide both a reason and detailed description for the block request.');
      return;
    }

    setSubmittingBlockRequest(true);
    
    try {
      // Create block request document
      const blockRequestData = {
        requesterId: currentUser.uid,
        requesterName: currentUser.displayName || currentUser.email,
        requesterStoreId: currentUser.uid, // Store ID is same as seller's user ID
        targetUserId: selectedConversation.otherUserId,
        targetUserName: selectedConversation.otherUserName,
        targetUserEmail: selectedConversation.otherUserEmail,
        reason: blockRequestReason.trim(),
        details: blockRequestDetails.trim(),
        requestedDuration: parseInt(blockRequestDuration),
        status: 'pending',
        requestType: 'seller_block_request',
        createdAt: serverTimestamp(),
        conversationId: selectedConversation.id
      };

      // Add to block_requests collection
      await addDoc(collection(db, 'block_requests'), blockRequestData);

      // Send message to admin about the block request
      const adminConversationId = `admin_${currentUser.uid}`;
      
      await addDoc(collection(db, 'messages'), {
        conversationId: adminConversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: 'admin',
        receiverName: 'Admin',
        message: `🚫 BLOCK REQUEST SUBMITTED\n\nSeller: ${currentUser.displayName || currentUser.email}\nTarget User: ${selectedConversation.otherUserName}\nEmail: ${selectedConversation.otherUserEmail}\n\nReason: ${blockRequestReason}\n\nDetails: ${blockRequestDetails}\n\nRequested Duration: ${blockRequestDuration} days\n\nStatus: Pending Admin Review\n\nPlease review this request and take appropriate action.`,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'block_request',
        blockRequestData: blockRequestData
      });

      // Create/update admin conversation
      await setDoc(doc(db, 'conversations', adminConversationId), {
        participants: [currentUser.uid, 'admin'],
        lastMessage: 'Block request submitted',
        lastMessageTime: serverTimestamp(),
        isAdminChat: true,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Reset form and close modal
      setBlockRequestReason('');
      setBlockRequestDetails('');
      setBlockRequestDuration('7');
      setShowBlockRequestModal(false);
      
      showSuccess('Block request submitted successfully! Your request has been sent to the admin for review. You will be notified once a decision is made.');
      
    } catch (error) {
      console.error('Error submitting block request:', error);
      showError('Failed to submit block request. Please try again.');
    } finally {
      setSubmittingBlockRequest(false);
    }
  };

  // Delete message function
  const deleteMessage = async (messageId) => {
    if (!messageId || !currentUser) return;

    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        // Get the message before deleting to check if it's a refund transfer confirmation
        const messageDoc = await getDoc(doc(db, 'messages', messageId));
        const messageData = messageDoc.data();
        
        await updateDoc(doc(db, 'messages', messageId), {
          deleted: true,
          deletedBy: currentUser.uid,
          deletedAt: serverTimestamp()
        });

        // If this was a refund transfer confirmation message, reset the approval states
        if (messageData && messageData.messageType === 'refund_transfer_confirmed' && messageData.orderData?.orderId) {
          const orderId = messageData.orderData.orderId;
          
          // Reset approval states in local state
          setMessages(prevMessages => {
            return prevMessages.map(msg => {
              if (msg.orderData && msg.orderData.orderId === orderId) {
                return {
                  ...msg,
                  orderData: {
                    ...msg.orderData,
                    customerApproved: false,
                    complaintFiled: false
                  }
                };
              }
              return msg;
            });
          });

          // Also update other messages in Firestore with the same orderId
          try {
            const messagesRef = collection(db, 'messages');
            const q = query(messagesRef, where('orderData.orderId', '==', orderId));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
              if (doc.id !== messageId) { // Don't update the deleted message
                updateDoc(doc.ref, {
                  'orderData.customerApproved': false,
                  'orderData.complaintFiled': false
                });
              }
            });
          } catch (error) {
            console.error("Error resetting approval states in Firestore:", error);
          }
        }
      } catch (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message. Please try again.');
      }
    }
  };

  // Handle mobile tap-to-delete (long press)
  const handleMessageLongPress = (messageId, messageText) => {
    // Only allow deletion for messages sent by current user
    const message = messages.find(msg => msg.id === messageId);
    if (!message || message.senderId !== currentUser.uid) return;

    // Show mobile-friendly confirmation
    const shouldDelete = window.confirm(
      `Delete this message?\n\n"${messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText}"\n\nThis action cannot be undone.`
    );
    
    if (shouldDelete) {
      deleteMessage(messageId);
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
    
    // Get payment methods based on store settings
    let availablePaymentMethods = getPaymentMethods(currency);
    
    // If we have store-specific settings, use them to filter payment methods
    if (storeId) {
      try {
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
          const storeData = storeDoc.data();
          const storeFeeSettings = storeData.feeSettings || {};
          availablePaymentMethods = getPaymentMethods(currency, storeFeeSettings);
        }
      } catch (error) {
        console.error('Error fetching store settings for payment methods:', error);
      }
    }

    return {
      subtotal,
      deliveryFee,
      serviceFee,
      total,
      currency,
      deliveryType: isCollection ? 'Collection' : 'Delivery',
      feeBreakdown: {
        deliveryEnabled: deliveryFee > 0,
        serviceFeeEnabled: serviceFee > 0
      },
      availablePaymentMethods
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

    // Check if this is a collection order by looking at the store's delivery type
    let isCollection = false;
    let isPayAtStore = false;
    if (storeId) {
      try {
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
          const storeData = storeDoc.data();
          isCollection = storeData.deliveryType === 'Collection';
          isPayAtStore = storeData.deliveryType === 'Collection' && storeData.paymentType === 'Other';
          console.log('Store delivery type:', storeData.deliveryType, 'paymentType:', storeData.paymentType, 'isCollection:', isCollection, 'isPayAtStore:', isPayAtStore);
        }
      } catch (error) {
        console.error('Error checking store delivery type:', error);
      }
    }

    // Calculate payment details with store-specific fees
    const paymentDetails = await calculatePaymentDetails(itemsToCalculate, currency, storeId, isCollection);
    console.log('Payment details calculated:', paymentDetails);
    
    // Handle Pay At Store - skip payment modal and send order request directly
    if (isPayAtStore) {
      await sendPayAtStoreOrderRequest(itemsToCalculate, paymentDetails, orderId, storeId);
      return;
    }
    
    setPaymentData({
      ...paymentDetails,
      orderId,
      items: itemsToCalculate
    });
    setSelectedPaymentMethod('');
    setShowPaymentModal(true);
  };

  // Send Pay At Store order request (no payment required)
  const sendPayAtStoreOrderRequest = async (items, paymentDetails, orderId, storeId) => {
    try {
      if (!selectedConversation || !currentUser) {
        alert('Cannot send order request - invalid data.');
        return;
      }

      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Format order items for display
      const orderItemsText = items.map(item => 
        `• ${item.name} x${item.quantity} - ${getCurrencySymbol(paymentDetails.currency)}${formatPrice(item.price * item.quantity, paymentDetails.currency)}`
      ).join('\n');

      const orderMessage = `📋 PAY AT STORE ORDER\n\nOrder ID: ${orderId}\n\n📦 ITEMS REQUESTED:\n${orderItemsText}\n\nSubtotal: ${getCurrencySymbol(paymentDetails.currency)}${formatPrice(paymentDetails.subtotal, paymentDetails.currency)}\nService Fee: ${getCurrencySymbol(paymentDetails.currency)}${formatPrice(paymentDetails.serviceFee, paymentDetails.currency)}\nTotal to Pay at Store: ${getCurrencySymbol(paymentDetails.currency)}${formatPrice(paymentDetails.total, paymentDetails.currency)}\n\n💳 PAYMENT: Customer will pay at store upon collection\n\nPlease confirm if you can fulfill this order.`;

      // Send order request message
      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: orderMessage,
        messageType: 'pay_at_store_request',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          orderId: orderId,
          items: items,
          totalAmount: paymentDetails.total,
          currency: paymentDetails.currency,
          deliveryType: 'Pay At Store',
          subtotal: paymentDetails.subtotal,
          serviceFee: paymentDetails.serviceFee
        }
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        messageData.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);

      // Create initial order tracking record for pay-at-store orders
      const orderTrackingData = {
        orderId: orderId,
        sellerId: selectedConversation.otherUserId,
        sellerName: selectedConversation.otherUserName,
        buyerId: currentUser.uid,
        buyerName: currentUser.displayName || currentUser.email,
        customerId: currentUser.uid,
        customerName: currentUser.displayName || currentUser.email,
        items: items,
        totalAmount: paymentDetails.total,
        currency: paymentDetails.currency,
        paymentMethod: 'Pay at Store',
        deliveryType: 'Collection',
        status: 'pending',
        type: 'pay_at_store',
        subtotal: paymentDetails.subtotal,
        serviceFee: paymentDetails.serviceFee,
        createdAt: serverTimestamp(),
        payAtStore: true,
        awaitingSellerConfirmation: true,
        storeId: selectedConversation.otherUserId
      };

      try {
        // Add to orders collection for tracking
        await addDoc(collection(db, 'orders'), orderTrackingData);
        
        // Also add a preliminary transaction record
        const transactionData = {
          ...orderTrackingData,
          transactionType: 'pay_at_store_request',
          amount: paymentDetails.total,
          grossAmount: paymentDetails.total,
          pickupStatus: 'pending',
          // No pickup code yet - will be generated when seller accepts
        };
        
        await addDoc(collection(db, 'transactions'), transactionData);
        
        console.log('✅ Created tracking records for pay-at-store order:', orderId);
      } catch (trackingError) {
        console.error('Error creating tracking records:', trackingError);
        // Don't block the main flow if tracking fails
      }

      // Clear cart and close any modals
      setCart([]);
      setCurrentOrderId(null);
      setShowPaymentModal(false);

      // Show success message
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Order request sent! You'll pay at the store when collecting.`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      }, 4000);

    } catch (error) {
      console.error('Error sending Pay At Store order request:', error);
      alert('Failed to send order request. Please try again.');
    }
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
      // Fetch fresh store information from Firestore
      let currentStoreInfo = storeInfo;
      let actualStoreName = selectedConversation.otherUserName;
      
      try {
        const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
        if (storeDoc.exists()) {
          currentStoreInfo = storeDoc.data();
          actualStoreName = currentStoreInfo.storeName || currentStoreInfo.businessName || selectedConversation.otherUserName;
        }
      } catch (error) {
        console.log('Could not fetch store info, using conversation name:', error);
      }
      
      // Save current store info to localStorage in case of page refresh
      saveStoreInfoToLocalStorage(selectedConversation.id, {
        ...currentStoreInfo,
        storeName: actualStoreName
      });

      // Fetch buyer's complete information from Firestore at the start
      const buyerInfo = await fetchUserInfo(currentUser.uid);
      const buyerName = buyerInfo.name;
      const buyerEmail = buyerInfo.email;

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
      let useConnectPayment = false;

      // Get seller info for potential Stripe Connect account
      const sellerDoc = await getDoc(doc(db, 'users', sellerId));
      const sellerData = sellerDoc.data();
      const sellerStripeAccountId = sellerData?.stripeConnectAccountId;

      // Only require Stripe Connect for card and Google Pay payments
      if ((selectedPaymentMethod === 'card' || selectedPaymentMethod === 'google_pay') && !sellerStripeAccountId) {
        throw new Error('This seller has not set up their payment account yet. Please ask them to complete their Stripe Connect setup to receive payments.');
      }

      // Set up Connect payment for card and Google Pay methods
      if (sellerStripeAccountId && (selectedPaymentMethod === 'card' || selectedPaymentMethod === 'google_pay')) {
        console.log('🔗 Using seller Connect account:', sellerStripeAccountId);
        useConnectPayment = true;
      }

      if (selectedPaymentMethod === 'card' && stripePaymentData) {
        // ALL payments go through Stripe Connect - no fallback
        const platformFeeAmount = paymentData.total * 0.025; // 2.5% platform fee
        
        const connectResponse = await fetch(`${process.env.REACT_APP_API_URL}/create-connect-payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: paymentData.total,
            currency: paymentData.currency,
            sellerStripeAccountId: sellerStripeAccountId,
            applicationFeeAmount: platformFeeAmount
          })
        });
        
        if (!connectResponse.ok) {
          throw new Error('Failed to create payment. Seller may need to complete their account setup.');
        }
        
        const connectData = await connectResponse.json();
        paymentIntentId = connectData.paymentIntentId;
        console.log('💳 Using Connect payment with real money transfer:', paymentIntentId);
        
        paymentDetails.cardInfo = stripePaymentData.cardInfo;
        console.log('✅ Using Stripe Elements payment:', paymentIntentId);

      } else if (selectedPaymentMethod === 'google_pay' && stripePaymentData) {
        // ALL Google Pay payments go through Stripe Connect
        const platformFeeAmount = paymentData.total * 0.025; // 2.5% platform fee
        
        const connectResponse = await fetch(`${process.env.REACT_APP_API_URL}/create-connect-payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: paymentData.total,
            currency: paymentData.currency,
            sellerStripeAccountId: sellerStripeAccountId,
            applicationFeeAmount: platformFeeAmount
          })
        });
        
        if (!connectResponse.ok) {
          throw new Error('Failed to create Google Pay payment. Seller may need to complete their account setup.');
        }
        
        const connectData = await connectResponse.json();
        paymentIntentId = connectData.paymentIntentId;
        console.log('💳 Using Connect Google Pay with real money transfer:', paymentIntentId);
        
        paymentDetails.googlePayInfo = stripePaymentData.googlePayInfo;

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

      } else if (selectedPaymentMethod === 'bank_transfer' && stripePaymentData) {
        // Bank Transfer payment (no platform fees)
        paymentIntentId = stripePaymentData.paymentIntentId || `bank_transfer_${Date.now()}`;
        paymentDetails.bankTransferInfo = stripePaymentData.bankTransferInfo;
        console.log('✅ Using Bank Transfer payment (no fees):', paymentIntentId);

      } else if (selectedPaymentMethod === 'google_pay') {
        // Google Pay must use StripeGooglePayButton component
        console.log('❌ Google Pay requires Stripe integration. Please use the Google Pay button.');
        alert('Google Pay payment must be processed through the Google Pay button above.');
        setPaymentProcessing(false);
        return;

      } else {
        // For other payment methods, create a simulated payment
        console.log('⚠️ Using Simulated Payment for method:', selectedPaymentMethod);
        paymentIntentId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Calculate seller's earnings (deduct platform fees if applicable)
      let platformFee = 0;
      let sellerEarnings = paymentData.total;
      
      // Only apply platform fees for card and Google Pay payments
      if (selectedPaymentMethod === 'card' || selectedPaymentMethod === 'google_pay') {
        const platformFeeRate = useConnectPayment ? 0.025 : 0.03; // 2.5% for Connect, 3% for regular
        platformFee = paymentData.total * platformFeeRate;
        sellerEarnings = paymentData.total - platformFee;
        console.log(`💰 Platform fee applied: ${platformFee} (${selectedPaymentMethod}, Connect: ${useConnectPayment})`);
      } else {
        console.log(`💰 No platform fee for: ${selectedPaymentMethod}`);
      }

      // Update seller's wallet 
      if (selectedPaymentMethod !== 'bank_transfer') {
        const sellerWalletRef = doc(db, 'wallets', sellerId);
        const sellerWalletSnap = await getDoc(sellerWalletRef);
        
        const walletUpdate = {
          totalEarnings: (sellerWalletSnap.exists() ? (sellerWalletSnap.data().totalEarnings || 0) : 0) + sellerEarnings,
          lastUpdated: serverTimestamp()
        };

        if (useConnectPayment) {
          // For Connect payments, money goes directly to Stripe - just track it
          walletUpdate.stripeEarnings = (sellerWalletSnap.exists() ? (sellerWalletSnap.data().stripeEarnings || 0) : 0) + sellerEarnings;
          walletUpdate.lastConnectPayment = serverTimestamp();
          console.log(`💳 Connect payment: ${sellerEarnings} goes directly to seller's Stripe account`);
        } else {
          // ALL payments now go through Stripe Connect - no virtual wallet
          console.log(`💰 Connect payment: ${sellerEarnings} goes directly to seller's Stripe account`);
        }
        
        if (sellerWalletSnap.exists()) {
          await updateDoc(sellerWalletRef, walletUpdate);
        } else {
          await setDoc(sellerWalletRef, {
            balance: useConnectPayment ? 0 : sellerEarnings,
            pendingBalance: 0,
            totalEarnings: sellerEarnings,
            stripeEarnings: useConnectPayment ? sellerEarnings : 0,
            createdAt: serverTimestamp(),
            ...walletUpdate
          });
        }
        
        console.log(`💰 Seller wallet updated (Connect: ${useConnectPayment})`);
      } else {
        console.log(`⏳ Bank transfer pending verification - wallet will be updated after confirmation`);
      }

      // Create transaction record for seller
      await addDoc(collection(db, 'transactions'), {
        sellerId: sellerId,
        orderId: paymentData.orderId,
        customerId: currentUser.uid,
        customerName: buyerName,
        type: 'sale',
        amount: sellerEarnings,
        platformFee: platformFee,
        grossAmount: paymentData.total,
        currency: paymentData.currency,
        paymentMethod: selectedPaymentMethod,
        stripePaymentIntentId: paymentIntentId || `fallback_${Date.now()}`, // Ensure never undefined
        description: `Sale: ${paymentData.items?.map(item => item.name).join(', ') || 'Order items'}`,
        status: selectedPaymentMethod === 'bank_transfer' ? 'pending_verification' : 'completed',
        pickupCode: pickupCode,
        pickupStatus: 'pending',
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp()
      });

      // Create payment record in Firestore
      const paymentRecord = {
        orderId: paymentData.orderId,
        customerId: currentUser.uid,
        customerName: buyerName,
        sellerId: sellerId,
        amount: paymentData.total,
        sellerEarnings: sellerEarnings,
        platformFee: platformFee,
        currency: paymentData.currency,
        paymentMethod: selectedPaymentMethod,
        stripePaymentIntentId: paymentIntentId || `fallback_${Date.now()}`, // Ensure never undefined
        status: selectedPaymentMethod === 'bank_transfer' ? 'pending_verification' : 'completed',
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
        ...(selectedPaymentMethod === 'google_pay' && paymentDetails.googlePayInfo && {
          googlePayInfo: paymentDetails.googlePayInfo
        }),
        ...(selectedPaymentMethod === 'bank_transfer' && paymentDetails.bankTransferInfo && {
          bankTransferInfo: paymentDetails.bankTransferInfo
        }),
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      // Save the payment and get the document reference which contains the ID
      const paymentDocRef = await addDoc(collection(db, 'payments'), paymentRecord);
      
      // Add the ID to the payment record
      paymentRecord.id = paymentDocRef.id;

      // Use the fresh store name we fetched from Firestore
      const displayedStoreName = actualStoreName;

      // Send payment confirmation message to conversation
      const paymentMessage = {
        conversationId: selectedConversation.id,
        senderId: currentUser.uid,
        senderName: buyerName,
        senderEmail: buyerEmail,
        receiverId: selectedConversation?.otherUserId,
        receiverName: selectedConversation?.otherUserName,
        message: selectedPaymentMethod === 'bank_transfer' 
          ? `🏦 Bank Transfer Submitted!\n\n🏪 Store: ${displayedStoreName}\nOrder: ${paymentData.orderId?.slice(-8) || 'N/A'}\nAmount: ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}\nMethod: Bank Transfer\n\n🎫 PICKUP CODE: ${pickupCode}\n\n${paymentData.deliveryType === 'Collection' ? `Please provide this code when collecting your order from ${displayedStoreName}.` : `Please provide this code to ${displayedStoreName} when they deliver your order.`}\n\nThe full amount (${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}) has been transferred directly to the seller's bank account.`
          : `✅ Payment Completed!\n\n🏪 Store: ${displayedStoreName}\nOrder: ${paymentData.orderId?.slice(-8) || 'N/A'}\nAmount: ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}\nMethod: ${getPaymentMethods(paymentData.currency).find(m => m.id === selectedPaymentMethod)?.name}${
              selectedPaymentMethod === 'card' && paymentDetails.cardInfo ? ` (****${paymentDetails.cardInfo.last4})` : 
              selectedPaymentMethod === 'google_pay' && paymentDetails.googlePayInfo ? ` (${paymentDetails.googlePayInfo.deviceAccount})` : ''
            }\n\n🎫 PICKUP CODE: ${pickupCode}\n\n${paymentData.deliveryType === 'Collection' ? 'Please provide this code when collecting your order from the store.' : 'Please provide this code to the seller when they deliver your order.'}\n\nSeller has been credited ${getCurrencySymbol(paymentData.currency)}${formatPrice(sellerEarnings, paymentData.currency)} to their wallet.`,
        messageType: 'payment_completed',
        timestamp: serverTimestamp(),
        paymentData: {
          ...paymentRecord,
          deliveryType: paymentData.deliveryType,
          displayInfo: {
            orderId: paymentData.orderId,
            amount: paymentData.total,
            currency: paymentData.currency,
            pickupCode: pickupCode,
            paymentMethod: selectedPaymentMethod,
            deliveryType: paymentData.deliveryType
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
        message: selectedPaymentMethod === 'bank_transfer'
          ? `🏦 Bank Transfer Submitted!\n\nA customer has submitted a bank transfer payment of ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}\n\nStore: ${actualStoreName}\nOrder: ${paymentData.orderId?.slice(-8) || 'N/A'}\nCustomer: ${buyerName}\nPayment Method: Bank Transfer\nPayment ID: ${paymentIntentId}\n\n📦 ITEMS ORDERED:\n${orderDetails}\n\n⚠️ VERIFICATION REQUIRED:\n• Please check your bank account for transfer\n• Click 'Verify Bank Transfer' when received\n• Amount to verify: ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}\n• Bank: ${paymentData.bankTransferInfo?.fromBank}\n• Reference: ${paymentData.bankTransferInfo?.referenceNumber}\n\n⏱️ Note: Order will be held until you verify payment.\nNo platform fees for bank transfers.\n\n📱 After verification, you can validate pickup code when customer arrives.`
          : `💰 Payment Received!\n\nYou've received a payment of ${getCurrencySymbol(paymentData.currency)}${formatPrice(sellerEarnings, paymentData.currency)}\n\nOrder: ${paymentData.orderId?.slice(-8) || 'N/A'}\nCustomer: ${buyerName}\nPayment Method: ${getPaymentMethods(paymentData.currency).find(m => m.id === selectedPaymentMethod)?.name}\nPayment ID: ${paymentIntentId}\n\n📦 ITEMS ORDERED:\n${orderDetails}\n\nTotal Paid: ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}\nYour Earnings: ${getCurrencySymbol(paymentData.currency)}${formatPrice(sellerEarnings, paymentData.currency)}\nPlatform Fee: ${getCurrencySymbol(paymentData.currency)}${formatPrice(platformFee, paymentData.currency)}\n\nFunds have been added to your wallet. \n\n📱 TO VALIDATE PICKUP:\nGo to your Wallet tab and ask the customer for their pickup code when they arrive to collect their order.`,
        messageType: selectedPaymentMethod === 'bank_transfer' ? 'bank_transfer_submitted' : 'payment_notification',
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

      // Generate receipt using the displayedStoreName variable defined earlier
      const receiptData = {
        orderId: paymentData.orderId,
        items: paymentData.items,
        total: paymentData.total,
        subtotal: paymentData.subtotal,
        serviceFee: paymentData.serviceFee,
        deliveryFee: paymentData.deliveryFee,
        buyerId: currentUser.uid,
        buyerName: buyerName,
        buyerEmail: buyerEmail,
        sellerId: selectedConversation.otherUserId,
        sellerName: selectedConversation.otherUserName,
        storeName: displayedStoreName,
        // Include store contact information at top level for easier access
        storeAddress: storeInfo?.storeLocation || 
                     storeInfo?.address || 
                     storeInfo?.businessAddress || 
                     storeInfo?.storeAddress ||
                     (storeInfo?.location?.address) || 
                     (typeof storeInfo?.location === 'string' ? storeInfo.location : '') ||
                     storeInfo?.fullAddress ||
                     storeInfo?.streetAddress ||
                     selectedConversation?.storeAddress ||
                     '',
        storePhone: storeInfo?.phoneNumber || 
                   storeInfo?.phone || 
                   storeInfo?.contactNumber || 
                   storeInfo?.businessPhone ||
                   storeInfo?.storePhone ||
                   storeInfo?.contactPhone ||
                   storeInfo?.mobile ||
                   '',
        storeEmail: storeInfo?.email || storeInfo?.contactEmail || storeInfo?.businessEmail || '',
        storeData: {
          ...storeInfo,
          storeName: displayedStoreName
        },
        storeId: selectedConversation.otherUserId, // Add store ID for future reference
        receiptType: 'order_receipt', // Add receipt type for proper display
        createdAt: serverTimestamp(),
        paymentMethod: selectedPaymentMethod,
        paymentId: paymentIntentId,
        status: 'completed',
        currency: paymentData.currency,
        deliveryType: paymentData.deliveryType,
        pickupCode
      };

      // Add to receipts collection
      const receiptRef = await addDoc(collection(db, 'receipts'), receiptData);

      // Add to reports collection
      const reportData = {
        ...receiptData,
        type: 'order',
        receiptId: receiptRef.id,
        sellerEarnings,
        platformFee
      };
      await addDoc(collection(db, 'reports'), reportData);

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
      alert(selectedPaymentMethod === 'bank_transfer'
        ? `Bank Transfer Submitted! 🏦\n\nYour pickup code is: ${pickupCode}\n\nPlease save this code and provide it to the seller when collecting your order.\n\nThe full amount (${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.total, paymentData.currency)}) has been transferred directly to the seller's bank account.\n\nPayment ID: ${paymentIntentId || 'N/A'}`
        : `Payment successful! 🎉\n\nYour pickup code is: ${pickupCode}\n\nPlease save this code and provide it to the seller when collecting your order.\n\nThe seller has been credited ${getCurrencySymbol(paymentData.currency)}${formatPrice(sellerEarnings, paymentData.currency)} to their wallet.\n\nPayment ID: ${paymentIntentId || 'N/A'}`);

      // Handle scheduling payments (collection or delivery)
      if (paymentData.serviceType === 'collection_scheduling') {
        await handleCollectionSchedulingPayment(paymentData);
      } else if (paymentData.serviceType === 'delivery_scheduling') {
        await handleDeliverySchedulingPayment(paymentData);
      }
      
    } catch (error) {
      console.error('Payment processing error:', error);
      alert(`Payment failed: ${error.message}\n\nPlease try again.`);
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Handle collection scheduling payment completion
  const handleCollectionSchedulingPayment = async (paymentData) => {
    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Use original order data for display
      const originalOrder = paymentData.originalOrderData;

      // Generate pickup code for collection
      const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Format order items for collection message
      const collectionOrderDetails = originalOrder.items?.map(item => 
        `• ${item.name || item.itemName} x${item.quantity} - ${getCurrencySymbol(originalOrder.currency)}${formatPrice((item.price || item.subtotal) * (item.quantity || 1), originalOrder.currency)}`
      ).join('\n') || 'Order items not available';

      const collectionMessage = `📋 COLLECTION SCHEDULED\n\nOrder ID: ${originalOrder.orderId}\n\n📦 ORDER ITEMS:\n${collectionOrderDetails}\n\nOriginal Order Total: ${getCurrencySymbol(originalOrder.currency)}${formatPrice(originalOrder.total || originalOrder.amount, originalOrder.currency)}\n\nCollection Time: ${paymentData.collectionTime}\nCollection Fee Paid: ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.collectionFee, paymentData.currency)}\n\n🎫 CUSTOMER PICKUP CODE: ${pickupCode}\n\n⚠️ IMPORTANT: Verify the pickup code when customer arrives for collection.\n\nCustomer will collect at the scheduled time. Please have the order ready.`;

      // Send collection scheduled message
      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: collectionMessage,
        messageType: 'collection_scheduled',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...originalOrder,
          collectionTime: paymentData.collectionTime,
          pickupCode: pickupCode,
          collectionFee: paymentData.collectionFee,
          timeSlot: paymentData.timeSlot
        }
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        messageData.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);

      // Send pickup code to customer
      const customerCodeMessage = `🎫 YOUR PICKUP CODE

Order ID: ${originalOrder.orderId}

Your collection pickup code is: ${pickupCode}

⏰ Collection Time: ${paymentData.collectionTime}

💡 IMPORTANT: Present this code when you arrive to collect your order.

Please arrive at your scheduled time and bring this code for verification.`;

      await addDoc(collection(db, 'messages'), {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: currentUser.uid,
        receiverName: currentUser.displayName || currentUser.email,
        message: customerCodeMessage,
        timestamp: serverTimestamp(),
        isRead: true,
        messageType: 'collection_pickup_code',
        orderData: {
          ...originalOrder,
          collectionTime: paymentData.collectionTime,
          pickupCode: pickupCode,
          collectionFee: paymentData.collectionFee
        }
      });

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Collection scheduled successfully!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      console.error('Error handling collection scheduling payment:', error);
    }
  };

  // Handle delivery scheduling payment completion
  const handleDeliverySchedulingPayment = async (paymentData) => {
    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Use original order data for display
      const originalOrder = paymentData.originalOrderData;

      // Format order items for delivery message
      const deliveryOrderDetails = originalOrder.items?.map(item => 
        `• ${item.name || item.itemName} x${item.quantity} - ${getCurrencySymbol(originalOrder.currency)}${formatPrice((item.price || item.subtotal) * (item.quantity || 1), originalOrder.currency)}`
      ).join('\n') || 'Order items not available';

      const messagePrefix = paymentData.isReschedule ? '🔄 DELIVERY RESCHEDULED' : '📋 DELIVERY SCHEDULED';
      let deliveryMessage = `${messagePrefix}\n\nOrder ID: ${originalOrder.orderId}\n\n📦 ORDER ITEMS:\n${deliveryOrderDetails}\n\nOriginal Order Total: ${getCurrencySymbol(originalOrder.currency)}${formatPrice(originalOrder.total || originalOrder.amount, originalOrder.currency)}\n\nDelivery Time: ${paymentData.deliveryTime}\nDelivery Fee Paid: ${getCurrencySymbol(paymentData.currency)}${formatPrice(paymentData.deliveryFee, paymentData.currency)}\n\nThe seller will deliver at the scheduled time.`;

      if (paymentData.deliverySettings?.deliveryAddress) {
        deliveryMessage += `\n\nDelivery Address: ${paymentData.deliverySettings.deliveryAddress}`;
      }

      if (paymentData.deliverySettings?.specialInstructions) {
        deliveryMessage += `\n\nSpecial Instructions: ${paymentData.deliverySettings.specialInstructions}`;
      }

      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: deliveryMessage,
        messageType: paymentData.isReschedule ? 'delivery_rescheduled' : 'delivery_scheduled',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...originalOrder,
          deliverySettings: paymentData.deliverySettings,
          deliveryFee: paymentData.deliveryFee,
          scheduledDateTime: paymentData.scheduledDateTime,
          isReschedule: paymentData.isReschedule
        }
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        messageData.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = paymentData.isReschedule ? `🔄 Delivery rescheduled successfully!` : `📋 Delivery scheduled successfully!`;
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
      console.error('Error handling delivery scheduling payment:', error);
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

  // Handle Google Pay success
  const handleGooglePaySuccess = (googlePayData) => {
    processPayment(googlePayData);
  };

  // Handle Google Pay error
  const handleGooglePayError = (errorMessage) => {
    alert(`Google Pay failed: ${errorMessage}\n\nPlease try again.`);
    setPaymentProcessing(false);
  };

  // Handle Bank Transfer success
  const handleBankTransferSuccess = (bankTransferData) => {
    processPayment(bankTransferData);
  };

  // Handle Bank Transfer error
  const handleBankTransferError = (errorMessage) => {
    alert(`Bank Transfer failed: ${errorMessage}\n\nPlease try again.`);
    setPaymentProcessing(false);
  };

  // Validate pickup code (for sellers)
  const validatePickupCode = async (inputCode) => {
    if (!inputCode || !currentUser || !isSeller) {
      alert('Invalid pickup code or user not authorized');
      return;
    }

    try {
      // Show explanation dialog to guide sellers
      if (!inputCode.trim()) {
        const codeInput = prompt('📱 Ask the customer for their pickup code\n\nPlease ask the customer to show you their pickup code from their messages, then enter it below:');
        if (!codeInput) return; // User canceled
        inputCode = codeInput;
      }

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
      const updateData = {
        pickupStatus: 'collected',
        collectedAt: serverTimestamp(),
        collectedBy: currentUser.uid
      };

      // For Pay At Store transactions, also mark payment as completed
      if (transactionData.type === 'pay_at_store') {
        updateData.status = 'completed';
        updateData.paymentReceivedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'transactions', transactionDoc.id), updateData);

      // Update payment record

      // Update payment record
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('orderId', '==', transactionData.orderId),
        where('pickupCode', '==', inputCode.toUpperCase())
      );

      const paymentSnap = await getDocs(paymentsQuery);
      if (!paymentSnap.empty) {
        const paymentData = paymentSnap.docs[0].data();
        await updateDoc(doc(db, 'payments', paymentSnap.docs[0].id), {
          pickupStatus: 'collected',
          collectedAt: serverTimestamp(),
          status: 'completed'
        });

        // Add to reports collection for tracking
        const reportData = {
          ...paymentData,
          type: 'order',
          status: 'completed',
          pickupStatus: 'collected',
          collectedAt: serverTimestamp(),
          collectedBy: currentUser.uid,
          reportType: 'order_completion',
          receiptId: paymentSnap.docs[0].id,
          updatedAt: serverTimestamp()
        };

        // Add report entry
        await addDoc(collection(db, 'reports'), reportData);
      }

      // Update order status in orders collection
      const ordersQuery = query(
        collection(db, 'orders'),
        where('orderId', '==', transactionData.orderId)
      );

      const ordersSnap = await getDocs(ordersQuery);
      if (!ordersSnap.empty) {
        const orderDoc = ordersSnap.docs[0];
        const orderData = orderDoc.data();
        const isCollectionOrder = orderData.deliveryType === 'Collection';
        await updateDoc(doc(db, 'orders', orderDoc.id), {
          status: isCollectionOrder ? 'collected' : 'delivered',
          [isCollectionOrder ? 'collectedAt' : 'deliveredAt']: serverTimestamp(),
          pickupCode: inputCode.toUpperCase()
        });
      }

      // Find the existing conversation and update the message + send completion message
      const conversationsQuery = query(
        collection(db, 'messages'),
        where('senderId', '==', transactionData.customerId),
        where('receiverId', '==', currentUser.uid),
        where('orderData.orderId', '==', transactionData.orderId)
      );

      const convSnap = await getDocs(conversationsQuery);
      
      if (!convSnap.empty) {
        // Update the existing message to show completion
        const existingMessage = convSnap.docs[0];
        const existingData = existingMessage.data();
        
        // Update the original message type and status
        await updateDoc(doc(db, 'messages', existingMessage.id), {
          messageType: 'pay_at_store_completed',
          orderData: {
            ...existingData.orderData,
            status: 'collected',
            collectedAt: serverTimestamp(),
            pickupCodeValidated: inputCode.toUpperCase()
          }
        });

        // Send completion confirmation message to customer
        const completionMessage = {
          conversationId: existingData.conversationId,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          senderEmail: currentUser.email,
          receiverId: transactionData.customerId,
          receiverName: transactionData.customerName,
          receiverEmail: transactionData.customerEmail || '',
          message: `✅ Order Collected!\n\nYour order has been successfully collected.\n\nOrder ID: ${transactionData.orderId}\nPickup Code: ${inputCode.toUpperCase()}\nCollected: ${new Date().toLocaleString()}\n\nThank you for shopping with us!`,
          messageType: 'collection_confirmation',
          timestamp: serverTimestamp(),
          isRead: false
        };

        await addDoc(collection(db, 'messages'), completionMessage);
        
        // Send receipt offer message to customer
        const receiptOfferMessage = {
          conversationId: existingData.conversationId,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          senderEmail: currentUser.email,
          receiverId: transactionData.customerId,
          receiverName: transactionData.customerName,
          receiverEmail: transactionData.customerEmail || '',
          message: `Would you like a receipt for your order?\n\nClick 'Yes' to generate a receipt with your order details.`,
          messageType: 'receipt_offer',
          timestamp: serverTimestamp(),
          isRead: false,
          orderData: {
            ...existingData.orderData,
            status: 'collected',
            collectedAt: serverTimestamp(),
            orderId: transactionData.orderId,
            pickupCode: inputCode.toUpperCase(),
            items: transactionData.items || existingData.orderData?.items || [],
            totalAmount: transactionData.amount || transactionData.grossAmount,
            currency: transactionData.currency,
            sellerName: currentUser.displayName,
            sellerId: currentUser.uid, // Add seller ID for receipt generation
            storeId: currentUser.uid, // Add store ID for receipt generation
            storeAddress: 'Store address', // We'll fetch this during receipt generation
            storePhone: '', // We'll fetch this during receipt generation
            deliveryMethod: existingData.orderData?.deliveryType || 'Collection',
            // Add payment information for complete receipt generation
            paymentMethod: transactionData.paymentMethod || existingData.orderData?.paymentMethod || 'Online Payment'
          },
          actions: [
            {
              label: 'Yes, generate receipt',
              action: 'generate_receipt',
              orderId: transactionData.orderId
            },
            {
              label: 'No, thanks',
              action: 'decline_receipt',
              orderId: transactionData.orderId
            }
          ]
        };

        await addDoc(collection(db, 'messages'), receiptOfferMessage);
      }

      // Add or update this transaction in the reports collection - Enhanced for Pay at Store
      try {
        const reportData = {
          orderId: transactionData.orderId,
          sellerId: currentUser.uid,
          sellerName: currentUser.displayName || currentUser.email,
          buyerId: transactionData.customerId,
          buyerName: transactionData.customerName,
          totalAmount: transactionData.amount || transactionData.grossAmount,
          currency: transactionData.currency || 'GBP',
          items: transactionData.items || [],
          status: 'completed',
          paymentMethod: transactionData.paymentMethod || (transactionData.type === 'pay_at_store' ? 'Pay at Store' : 'unknown'),
          deliveryType: transactionData.deliveryType || 'Collection',
          completedAt: serverTimestamp(),
          pickupCode: inputCode.toUpperCase(),
          reported: true,
          transactionType: 'order',
          reportingTimestamp: serverTimestamp(),
          type: 'order', // Ensure consistent type field
          createdAt: transactionData.createdAt || serverTimestamp(),
          // Add fields specifically for pay at store validation
          payAtStore: transactionData.type === 'pay_at_store',
          validatedAt: serverTimestamp(),
          validatedBy: currentUser.uid,
          // Additional analytics data
          customerEmail: transactionData.customerEmail,
          storeId: currentUser.uid,
          storeName: currentUser.displayName || currentUser.email
        };

        // Check if this order is already in reports
        const reportsQuery = query(
          collection(db, 'reports'),
          where('orderId', '==', transactionData.orderId),
          where('sellerId', '==', currentUser.uid)
        );
        
        const reportSnap = await getDocs(reportsQuery);
        if (reportSnap.empty) {
          // Create a new report entry
          const reportRef = await addDoc(collection(db, 'reports'), reportData);
          console.log('✅ Added new report entry for pay at store order:', reportRef.id);
        } else {
          // Update existing report entry with completion data
          const reportDoc = reportSnap.docs[0];
          await updateDoc(doc(db, 'reports', reportDoc.id), {
            status: 'completed',
            completedAt: serverTimestamp(),
            reported: true,
            payAtStore: transactionData.type === 'pay_at_store',
            validatedAt: serverTimestamp(),
            validatedBy: currentUser.uid,
            pickupCode: inputCode.toUpperCase()
          });
          console.log('✅ Updated existing report entry for pay at store order:', reportDoc.id);
        }

        // Also ensure the transaction is properly recorded for analytics
        // Update store analytics by triggering an analytics refresh
        try {
          const storeAnalyticsRef = doc(db, 'storeAnalytics', currentUser.uid);
          const analyticsDoc = await getDoc(storeAnalyticsRef);
          
          const now = new Date();
          const todayKey = now.toISOString().split('T')[0];
          
          if (analyticsDoc.exists()) {
            const analyticsData = analyticsDoc.data();
            const currentOrders = analyticsData.totalOrders || 0;
            const currentRevenue = analyticsData.totalRevenue || 0;
            const dailyData = analyticsData.dailyData || {};
            
            // Update daily data
            if (!dailyData[todayKey]) {
              dailyData[todayKey] = { orders: 0, revenue: 0 };
            }
            dailyData[todayKey].orders += 1;
            dailyData[todayKey].revenue += parseFloat(transactionData.amount || 0);
            
            await updateDoc(storeAnalyticsRef, {
              totalOrders: currentOrders + 1,
              totalRevenue: currentRevenue + parseFloat(transactionData.amount || 0),
              dailyData: dailyData,
              lastUpdated: serverTimestamp()
            });
          } else {
            // Create new analytics entry
            const dailyData = {};
            dailyData[todayKey] = { 
              orders: 1, 
              revenue: parseFloat(transactionData.amount || 0) 
            };
            
            await setDoc(storeAnalyticsRef, {
              totalOrders: 1,
              totalRevenue: parseFloat(transactionData.amount || 0),
              dailyData: dailyData,
              lastUpdated: serverTimestamp(),
              storeId: currentUser.uid
            });
          }
          console.log('✅ Updated store analytics for pay at store completion');
        } catch (analyticsError) {
          console.error('Error updating store analytics:', analyticsError);
          // Don't block the main flow if analytics update fails
        }

      } catch (reportError) {
        console.error('Error updating reports:', reportError);
        // Don't block the main flow if reports update fails
      }

      // Store this order ID in our completed collections state
      try {
        if (transactionData.orderId && !completedCollections.includes(transactionData.orderId)) {
          const updatedCompletions = [...completedCollections, transactionData.orderId];
          setCompletedCollections(updatedCompletions);
          localStorage.setItem('completedCollectionOrders', JSON.stringify(updatedCompletions));
        }
      } catch (stateError) {
        console.error('Error updating completion state:', stateError);
      }

      alert(`✅ Order successfully collected and delivery completed!\n\nOrder ID: ${transactionData.orderId}\nCustomer: ${transactionData.customerName}\nAmount: ${getCurrencySymbol(transactionData.currency)}${formatPrice(transactionData.amount, transactionData.currency)}\nPickup Code: ${inputCode.toUpperCase()}\n\nThe order has been marked as completed in all systems including Reports.`);

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
        setSellerStoreData(storeData); // Store the seller's own store data
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

  // Check if refunds are enabled for a store
  const checkStoreRefundsPolicy = async (storeId) => {
    try {
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        const feeSettings = storeData.feeSettings || {};
        return feeSettings.refundsEnabled !== false; // default to true if not set
      }
      return true; // default to allowing refunds
    } catch (error) {
      console.error('Error checking store refunds policy:', error);
      return true; // default to allowing refunds on error
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

    // Use existing conversation ID to keep orders in the same chat
    const conversationId = selectedConversation.id || 
      [currentUser.uid, selectedConversation.otherUserId].sort().join('_');
    const timestamp = Date.now();

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
          currency: cart[0]?.currency || 'GBP',
          deliveryType: (storeData && storeData.deliveryType) || 'Delivery'
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

        // Determine the effective deliveryType for this order
        const effectiveDeliveryType =
          (orderData && orderData.deliveryType) ||
          (storeData && storeData.deliveryType) ||
          'Delivery';

        // Calculate delivery fee ONLY for Delivery (never for Collection)
        if (feeSettings.deliveryEnabled && effectiveDeliveryType === 'Delivery') {
          if (feeSettings.freeDeliveryThreshold && subtotal >= feeSettings.freeDeliveryThreshold) {
            deliveryFee = 0;
          } else {
            deliveryFee = feeSettings.deliveryFee || 0;
          }
        } else {
          deliveryFee = 0; // Force zero for Collection or when delivery disabled
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

    // Get the effective delivery type for the message
    let effectiveDeliveryType = 'Delivery';
    try {
      const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        effectiveDeliveryType = (orderData && orderData.deliveryType) ||
          (storeData && storeData.deliveryType) ||
          'Delivery';
      }
    } catch (error) {
      console.error('Error fetching delivery type for message:', error);
    }

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

    const typeLine = `🚚 Delivery Type: ${effectiveDeliveryType}`;
    
    const doneMessage = `✅ DONE ADDING ITEMS

Order ID: ${orderId}

${allOrderItems.map(item => 
  `• ${item.itemName} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.subtotal, item.currency)}`
).join('\n')}

${typeLine}
${feeBreakdown || `Total: ${getCurrencySymbol(currency)}${formatPrice(totalAmount, currency)}`}
Items: ${totalItems}

Customer is done adding items. Please prepare and bag these items.`;

    try {
      const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
      const storeData = storeDoc.exists() ? storeDoc.data() : {};

      // Save order state to Firebase for persistence - PERMANENT LOCK
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
        timestamp: serverTimestamp(),
        lockedForever: true, // This order can never be modified again
        lockedAt: serverTimestamp()
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

        // Determine the effective deliveryType for this order
        const effectiveDeliveryType = (storeData && storeData.deliveryType) || 'Delivery';

        // Calculate delivery fee ONLY for Delivery (never for Collection)
        if (feeSettings.deliveryEnabled && effectiveDeliveryType === 'Delivery') {
          if (feeSettings.freeDeliveryThreshold && subtotal >= feeSettings.freeDeliveryThreshold) {
            deliveryFee = 0;
          } else {
            deliveryFee = feeSettings.deliveryFee || 0;
          }
        } else {
          deliveryFee = 0; // Force zero for Collection or when delivery disabled
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

    // Get the effective delivery type for the message
    let effectiveDeliveryType = 'Delivery';
    try {
      const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        effectiveDeliveryType = (storeData && storeData.deliveryType) || 'Delivery';
      }
    } catch (error) {
      console.error('Error fetching delivery type for done message:', error);
    }

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

    const typeLine = `🚚 Delivery Type: ${effectiveDeliveryType}`;
    
    const doneMessage = `✅ DONE ADDING ITEMS

Order ID: ${orderId}

${orderDetails}

${typeLine}
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
  
  // Helper function to check if order has been marked as ready for collection
  const isOrderMarkedReady = (orderId) => {
    if (!orderId) return false;
    return ordersMarkedReady.includes(orderId);
  };

  // Helper function to check if an order is a Pay At Store order
  const isPayAtStoreOrder = async (orderData) => {
    if (!orderData) return false;
    
    // Check if delivery type is explicitly set in orderData
    if (orderData.deliveryType === 'Pay At Store') return true;
    
    // Check store settings if delivery type not in orderData
    try {
      const storeDoc = await getDoc(doc(db, 'stores', selectedConversation?.otherUserId || ''));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        return (storeData && storeData.deliveryType) === 'Pay At Store';
      }
    } catch (error) {
      console.error('Error checking Pay At Store status:', error);
    }
    
    return false;
  };

  // Helper function to synchronously check if an order is Pay At Store (for UI)
  const isPayAtStoreOrderSync = (orderData) => {
    if (!orderData) return false;
    
    // Check if explicitly marked as Pay At Store
    if (orderData.deliveryType === 'Pay At Store') return true;
    
    // Check if Collection + Other payment type (which means Pay At Store)
    if (orderData.deliveryType === 'Collection' && orderData.paymentType === 'Other') return true;
    
    return false;
  };

  // Helper function to check if a Pay At Store order has been completed
  const isPayAtStoreCompleted = (orderId) => {
    if (!orderId) return false;
    return messages.some(msg => 
      msg.messageType === 'pay_at_store_completed' && 
      msg.orderData?.orderId === orderId
    );
  };

  // Helper function to check if customer has notified they're coming to pay
  const hasCustomerNotifiedComing = (orderId) => {
    if (!orderId) return false;
    return messages.some(msg => 
      msg.messageType === 'customer_coming_to_pay' && 
      msg.orderData?.orderId === orderId
    );
  };

  // Open refund transfer confirmation modal
  const openRefundTransferModal = (refundData) => {
    setPendingRefundTransfer(refundData);
    setRefundTransferScreenshot(null);
    setShowRefundTransferModal(true);
  };

  // Handle screenshot file selection
  const handleScreenshotSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Screenshot file size must be under 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      setRefundTransferScreenshot(file);
    }
  };

  // Confirm refund transfer with screenshot
  const confirmRefundTransfer = async () => {
    if (!refundTransferScreenshot) {
      alert('Please attach a screenshot of the transfer confirmation');
      return;
    }

    if (!pendingRefundTransfer || !selectedConversation || !currentUser) {
      alert('Cannot confirm transfer - invalid session');
      return;
    }

    try {
      setUploadingScreenshot(true);

      // Upload screenshot to Firebase Storage
      const storageRef = ref(storage, `refund-screenshots/${Date.now()}_${refundTransferScreenshot.name}`);
      const uploadTask = await uploadBytes(storageRef, refundTransferScreenshot);
      const screenshotUrl = await getDownloadURL(uploadTask.ref);

      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Send confirmation to customer with screenshot
      const transferConfirmationMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: `✅ REFUND TRANSFERRED!\n\nOrder ID: ${pendingRefundTransfer.orderId}\nRefund Amount: ${getCurrencySymbol(pendingRefundTransfer.currency)}${formatPrice(pendingRefundTransfer.amount, pendingRefundTransfer.currency)}\n\n💰 Your refund has been transferred to your bank account!\n\n📸 Transfer confirmation screenshot is attached below.\n\n⏱️ You should see the money in your account within 1-2 business days.\n\nThank you for your patience!`,
        messageType: 'refund_transfer_confirmed',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...pendingRefundTransfer,
          transferConfirmed: true,
          transferConfirmedAt: new Date().toISOString(),
          screenshotUrl: screenshotUrl,
          customerName: pendingRefundTransfer.customerName || selectedConversation.otherUserName || 'Unknown Customer'
        },
        attachments: [{
          type: 'image',
          url: screenshotUrl,
          name: 'Transfer Confirmation Screenshot'
        }]
      };

      if (selectedConversation.otherUserEmail) {
        transferConfirmationMessage.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), transferConfirmationMessage);

      // Close modal and reset states
      setShowRefundTransferModal(false);
      setPendingRefundTransfer(null);
      setRefundTransferScreenshot(null);
      setUploadingScreenshot(false);

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Refund transfer confirmed and customer notified!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      console.error('Error confirming refund transfer:', error);
      setUploadingScreenshot(false);
      
      if (error.code === 'storage/unauthorized') {
        alert('Upload failed: You do not have permission to upload screenshots. Please contact support.');
      } else if (error.code === 'storage/quota-exceeded') {
        alert('Upload failed: Storage quota exceeded. Please try again later.');
      } else if (error.code === 'storage/invalid-format') {
        alert('Upload failed: Invalid file format. Please upload an image file.');
      } else {
        alert(`Failed to confirm transfer: ${error.message || 'Unknown error'}. Please try again.`);
      }
    }
  };

  // Refund approval functions
  const approveRefundByCustomer = async (refundData) => {
    try {
      // Set customerApproved flag on the related message/orderData so buttons grey out
      if (refundData && refundData.orderId) {
        // First update the UI state immediately
        setMessages(prevMessages => {
          console.log("Updating messages in approveRefundByCustomer");
          const updatedMessages = prevMessages.map(msg => {
            if (msg.orderData && msg.orderData.orderId === refundData.orderId) {
              const updatedMsg = {
                ...msg,
                orderData: {
                  ...msg.orderData,
                  customerApproved: true
                  // Don't set complaintFiled here since this is for approvals
                }
              };
              console.log("Updated message in approveRefundByCustomer:", updatedMsg);
              return updatedMsg;
            }
            return msg;
          });
          return [...updatedMessages]; // force new array reference for re-render
        });
      }

      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Send approval confirmation message
      const approvalMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: `✅ REFUND APPROVED BY CUSTOMER\n\nOrder ID: ${refundData.orderId}\nRefund Amount: ${getCurrencySymbol(refundData.currency)}${formatPrice(refundData.amount, refundData.currency)}\n\n💚 Customer has confirmed they received the correct refund amount.\n\nRefund process completed successfully.`,
        messageType: 'refund_approved_by_customer',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...refundData,
          customerApproved: true,
          customerApprovedAt: new Date().toISOString()
        }
      };

      if (selectedConversation.otherUserEmail) {
        approvalMessage.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), approvalMessage);
      
      // Also update the existing message in Firestore to ensure both buttons stay greyed out
      try {
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, where('orderData.orderId', '==', refundData.orderId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          updateDoc(doc.ref, {
            'orderData.customerApproved': true
          });
        });
      } catch (error) {
        console.error("Error updating existing message in Firestore:", error);
      }

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Refund approved! Seller has been notified.`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      console.error('Error approving refund:', error);
      alert('Failed to approve refund. Please try again.');
    }
  };

  // Cancel complaint function
  const cancelComplaint = async (refundData) => {
    if (!refundData || !refundData.orderId) return;

    if (window.confirm('Are you sure you want to cancel your complaint? This will reset the refund approval buttons.')) {
      try {
        // Reset the approval states for this order
        setMessages(prevMessages => {
          return prevMessages.map(msg => {
            if (msg.orderData && msg.orderData.orderId === refundData.orderId) {
              return {
                ...msg,
                orderData: {
                  ...msg.orderData,
                  customerApproved: false,
                  complaintFiled: false
                }
              };
            }
            return msg;
          });
        });

        // Update Firestore to reset states
        try {
          const messagesRef = collection(db, 'messages');
          const q = query(messagesRef, where('orderData.orderId', '==', refundData.orderId));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach((doc) => {
            updateDoc(doc.ref, {
              'orderData.customerApproved': false,
              'orderData.complaintFiled': false
            });
          });
        } catch (error) {
          console.error("Error resetting complaint states in Firestore:", error);
        }

        // Show success notification
        const notification = document.createElement('div');
        notification.innerHTML = `✅ Complaint cancelled. You can now approve or file a new complaint.`;
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10B981;
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
        }, 4000);

      } catch (error) {
        console.error('Error cancelling complaint:', error);
        alert('Failed to cancel complaint. Please try again.');
      }
    }
  };

  // Close complaint modal and reset states if complaint wasn't submitted
  const closeComplaintModal = () => {
    if (pendingComplaintRefund && pendingComplaintRefund.orderId) {
      // Reset the approval states since complaint was cancelled
      setMessages(prevMessages => {
        return prevMessages.map(msg => {
          if (msg.orderData && msg.orderData.orderId === pendingComplaintRefund.orderId) {
            return {
              ...msg,
              orderData: {
                ...msg.orderData,
                customerApproved: false,
                complaintFiled: false
              }
            };
          }
          return msg;
        });
      });

      // Also reset in Firestore
      try {
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, where('orderData.orderId', '==', pendingComplaintRefund.orderId));
        getDocs(q).then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            updateDoc(doc.ref, {
              'orderData.customerApproved': false,
              'orderData.complaintFiled': false
            });
          });
        });
      } catch (error) {
        console.error("Error resetting complaint states in Firestore:", error);
      }
    }

    setShowComplaintModal(false);
    setPendingComplaintRefund(null);
    setComplaintData({
      email: '',
      explanation: '',
      complaintType: 'incorrect_amount'
    });
    setComplaintScreenshots([]);
  };

  // Open complaint modal
  const openComplaintModal = (refundData) => {
    setPendingComplaintRefund(refundData);
    setComplaintData({
      email: currentUser.email || '',
      explanation: '',
      complaintType: 'incorrect_amount'
    });
    setComplaintScreenshots([]);
    setShowComplaintModal(true);
    
    // Immediately grey out both buttons when complaint modal is opened
    if (refundData && refundData.orderId) {
      // Update the message state to grey out buttons, but only set complaintFiled
      setMessages(prevMessages => {
        return prevMessages.map(msg => {
          if (msg.orderData && msg.orderData.orderId === refundData.orderId) {
            // Create a deep copy to ensure React detects the change
            const updatedMsg = {
              ...msg,
              orderData: {
                ...msg.orderData,
                complaintFiled: true
                // Don't set customerApproved here since this is for complaints
              }
            };
            console.log("Updated message in openComplaintModal:", updatedMsg);
            return updatedMsg;
          }
          return msg;
        });
      });
      
      // Also update Firestore if needed to make the change permanent
      try {
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, where('orderData.orderId', '==', refundData.orderId));
        getDocs(q).then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            const msgData = doc.data();
            updateDoc(doc.ref, {
              'orderData.complaintFiled': true
              // Don't set customerApproved for complaints
            });
          });
        });
      } catch (error) {
        console.error("Error updating message state in Firestore:", error);
      }
    }
  };

  // Handle complaint screenshot upload
  const handleComplaintScreenshots = (event) => {
    const files = Array.from(event.target.files);
    if (files.length + complaintScreenshots.length > 5) {
      alert('You can upload maximum 5 screenshots');
      return;
    }

    // Validate files
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert(`${file.name} is too large. Maximum size is 5MB`);
        return false;
      }
      return true;
    });

    setComplaintScreenshots(prev => [...prev, ...validFiles]);
  };

  // Remove complaint screenshot
  const removeComplaintScreenshot = (index) => {
    setComplaintScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  // Submit complaint to admin
  const submitComplaint = async () => {
    if (!complaintData.email.trim()) {
      alert('Please enter your email address');
      return;
    }
    if (!complaintData.explanation.trim()) {
      alert('Please explain what happened');
      return;
    }

    try {
      setSubmittingComplaint(true);

      // Upload screenshots if any
      const screenshotUrls = [];
      for (const screenshot of complaintScreenshots) {
        const storageRef = ref(storage, `complaint-screenshots/${Date.now()}_${screenshot.name}`);
        const uploadTask = await uploadBytes(storageRef, screenshot);
        const url = await getDownloadURL(uploadTask.ref);
        screenshotUrls.push({
          url: url,
          name: screenshot.name
        });
      }

      // Fetch shop information - try multiple sources
      let shopInfo = { businessName: 'Unknown Shop', email: 'Unknown' };
      let sellerEmail = 'Unknown';
      try {
        // Always try to get seller email from users collection
        const userDoc = await getDoc(doc(db, 'users', selectedConversation.otherUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          sellerEmail = userData.email || userData.userEmail || 'Unknown';
          shopInfo = {
            businessName: userData.storeName || userData.businessName || selectedConversation.otherUserName || 'Unknown Shop',
            email: sellerEmail,
            address: userData.storeLocation || userData.address || 'Unknown'
          };
        } else {
          // Fallback to conversation data
          sellerEmail = selectedConversation.otherUserEmail || selectedConversation.receiverEmail || selectedConversation.senderEmail || 'Unknown';
          shopInfo = {
            businessName: selectedConversation.otherUserName || 'Unknown Shop',
            email: sellerEmail,
            address: 'Unknown'
          };
        }
      } catch (error) {
        sellerEmail = selectedConversation.otherUserEmail || selectedConversation.receiverEmail || selectedConversation.senderEmail || 'Unknown';
        shopInfo = {
          businessName: selectedConversation.otherUserName || 'Unknown Shop',
          email: sellerEmail,
          address: 'Unknown'
        };
      }

      // Create complaint record for admin
      const complaintRecord = {
        complaintId: `complaint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        customerId: currentUser.uid,
        customerEmail: complaintData.email,
        customerName: currentUser.displayName || currentUser.email,
        refundData: pendingComplaintRefund,
        complaintType: complaintData.complaintType,
        explanation: complaintData.explanation,
        screenshots: screenshotUrls,
        status: 'pending_review',
        submittedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        conversationId: selectedConversation.id || 
          [currentUser.uid, selectedConversation.otherUserId].sort().join('_'),
        sellerId: selectedConversation.otherUserId,
        sellerName: selectedConversation.otherUserName,
        sellerEmail: sellerEmail,
        shopInfo: shopInfo
      };

      await addDoc(collection(db, 'admin_complaints'), complaintRecord);

      // Send notification to seller about complaint
      const sellerNotification = {
        conversationId: selectedConversation.id || 
          [currentUser.uid, selectedConversation.otherUserId].sort().join('_'),
        senderId: 'system',
        senderName: 'Admin System',
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: `⚠️ REFUND COMPLAINT FILED\n\nOrder ID: ${pendingComplaintRefund.orderId}\nComplaint Type: ${complaintData.complaintType.replace('_', ' ').toUpperCase()}\n\nA customer has filed a complaint about their refund. The admin has been notified and will review this case.\n\nComplaint ID: ${complaintRecord.complaintId}`,
        messageType: 'refund_complaint_notice',
        timestamp: serverTimestamp(),
        isRead: false,
        complaintData: complaintRecord
      };

      if (selectedConversation.otherUserEmail) {
        sellerNotification.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), sellerNotification);

      // Set complaintFiled flag on the related message/orderData so buttons grey out
      if (pendingComplaintRefund && pendingComplaintRefund.orderId) {
        setMessages(prevMessages => {
          const updated = prevMessages.map(msg => {
            if (msg.orderData && msg.orderData.orderId === pendingComplaintRefund.orderId) {
              return {
                ...msg,
                orderData: {
                  ...msg.orderData,
                  complaintFiled: true
                  // Don't set customerApproved for complaints
                }
              };
            }
            return msg;
          });
          return [...updated]; // force new array reference for re-render
        });
      }

      // Close modal and reset states after successful submission
      // Don't use closeComplaintModal() here since complaint was successfully submitted
      setShowComplaintModal(false);
      setPendingComplaintRefund(null);
      setComplaintData({
        email: '',
        explanation: '',
        complaintType: 'incorrect_amount'
      });
      setComplaintScreenshots([]);
      setSubmittingComplaint(false);

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `📧 Complaint submitted to admin. You will receive an email response within 24-48 hours.`;
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
        max-width: 300px;
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 5000);

    } catch (error) {
      console.error('Error submitting complaint:', error);
      setSubmittingComplaint(false);
      
      if (error.code === 'storage/unauthorized') {
        alert('Upload failed: Storage permission denied. Please contact support.');
      } else {
        alert(`Failed to submit complaint: ${error.message || 'Unknown error'}. Please try again.`);
      }
    }
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
    console.log('🚚 Starting delivery with orderData:', orderData);
    
    if (!selectedConversation || !currentUser || !isSeller) {
      alert('Cannot start delivery - invalid session.');
      return;
    }

    if (!orderData || !orderData.orderId) {
      alert('Invalid order data for delivery.');
      return;
    }

    // Check if this is a Collection order - should not use delivery
    if (orderData.deliveryType === 'Collection') {
      alert('This is a Collection order. Please use "Mark Ready for Collection" instead.');
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

      // Format order items for delivery message - Enhanced with better data handling
      let orderDetails = 'Order items not available';
      let totalAmount = 0;
      
      if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
        orderDetails = orderData.items.map(item => {
          const itemName = item.name || item.itemName || 'Unknown Item';
          const quantity = item.quantity || 1;
          const price = item.price || (item.subtotal / quantity) || 0;
          const itemTotal = price * quantity;
          totalAmount += itemTotal;
          
          return `• ${itemName} x${quantity} - ${getCurrencySymbol(orderData.currency || 'GBP')}${formatPrice(itemTotal, orderData.currency || 'GBP')}`;
        }).join('\n');
      }
      
      // Use calculated total or fallback to orderData total
      const displayTotal = orderData.totalAmount || totalAmount || 0;
      const currency = orderData.currency || 'GBP';

      const conversationId = selectedConversation.id || 
        [selectedConversation.otherUserId, currentUser.uid].sort().join('_');

      // Enhanced message to customer with pickup code reminder and order details
      const customerMessage = pickupCode 
        ? `🚚 DELIVERY STARTED!\n\nOrder ID: ${orderData.orderId}\n\n📦 YOUR ORDER:\n${orderDetails}\n\nTotal: ${getCurrencySymbol(currency)}${formatPrice(displayTotal, currency)}\n\nYour order is now on the way!\n\nEstimated delivery time: 15-30 minutes\n\n🎫 IMPORTANT REMINDER:\nYour pickup code is: ${pickupCode}\n\n⚠️ PLEASE HAVE THIS CODE READY when the delivery arrives. You MUST provide this code to the seller before receiving your order.\n\n📱 Save this code or take a screenshot for easy access when the delivery arrives.`
        : `🚚 DELIVERY STARTED!\n\nOrder ID: ${orderData.orderId}\n\n📦 YOUR ORDER:\n${orderDetails}\n\nTotal: ${getCurrencySymbol(currency)}${formatPrice(displayTotal, currency)}\n\nYour order is now on the way!\n\nEstimated delivery time: 15-30 minutes\n\nYou'll receive a notification when the delivery arrives.`;

      const deliveryMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: customerMessage,
        messageType: 'delivery_started',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...orderData,
          totalAmount: displayTotal, // Use the calculated/validated total
          currency: currency,
          deliveryType: 'immediate',
          deliveryStarted: new Date().toISOString(),
          estimatedArrival: new Date(Date.now() + 25 * 60 * 1000).toISOString(), // 25 min estimate
          pickupCode: pickupCode
        }
      };

      // Only add receiverEmail if it exists and is not empty
      if (selectedConversation.otherUserEmail) {
        deliveryMessage.receiverEmail = selectedConversation.otherUserEmail;
      }

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

  // Open collection scheduling modal
  const openCollectionModal = (orderData) => {
    setSelectedOrderForDelivery(orderData); // Reuse the same state variable
    setDeliverySettings({
      deliveryType: 'collection',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '',
      timeSlot: 'morning',
      deliveryAddress: '',
      specialInstructions: ''
    });
    setShowCollectionModal(true); // Need to add this state
  };

  // Schedule delivery
  const scheduleDelivery = async () => {
    if (!selectedOrderForDelivery || !selectedConversation || !currentUser) {
      alert('Cannot schedule delivery - invalid data.');
      return;
    }

    try {
      // Check if this is a reschedule (after cancellation)
      const isReschedule = isDeliveryCancelled(selectedOrderForDelivery.orderId);

      let deliveryFee = 0;
      let timeDescription = '';
      let scheduledDateTime = null;

      if (deliverySettings.deliveryType === 'immediate') {
        // No fee for immediate delivery
        deliveryFee = 0;
        timeDescription = 'Immediate delivery (15-30 minutes)';
      } else if (deliverySettings.deliveryType === 'scheduled') {
        // No fee for same-day scheduled delivery
        deliveryFee = 0;
        const scheduledDate = new Date(deliverySettings.scheduledDate);
        const [hour, minute] = deliverySettings.scheduledTime.split(':');
        scheduledDate.setHours(parseInt(hour), parseInt(minute));
        scheduledDateTime = scheduledDate.toISOString();
        timeDescription = `${scheduledDate.toLocaleDateString()} at ${deliverySettings.scheduledTime}`;
      } else if (deliverySettings.deliveryType === 'next_day') {
        // Fee for next day delivery
        deliveryFee = deliveryPricing[deliverySettings.timeSlot];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        switch (deliverySettings.timeSlot) {
          case 'morning':
            timeDescription = `${tomorrow.toLocaleDateString()} - 9:00 AM - 12:00 PM`;
            break;
          case 'afternoon':
            timeDescription = `${tomorrow.toLocaleDateString()} - 12:00 PM - 5:00 PM`;
            break;
          case 'evening':
            timeDescription = `${tomorrow.toLocaleDateString()} - 5:00 PM - 8:00 PM`;
            break;
        }
      }

      // If there's a delivery fee, open payment modal
      if (deliveryFee > 0) {
        // Create payment data for ONLY the delivery scheduling fee
        const deliveryPaymentData = {
          orderId: selectedOrderForDelivery.orderId || `DELV-${Date.now()}`,
          items: [{
            name: `Delivery Scheduling - ${timeDescription}`,
            quantity: 1,
            price: deliveryFee,
            subtotal: deliveryFee
          }],
          currency: selectedOrderForDelivery.currency || 'GBP',
          total: deliveryFee,
          amount: deliveryFee,
          serviceType: 'delivery_scheduling',
          description: `Delivery Scheduling Fee - ${timeDescription}`,
          originalOrderData: selectedOrderForDelivery, // Keep reference to original order
          deliveryTime: timeDescription,
          deliverySettings: deliverySettings,
          scheduledDateTime: scheduledDateTime,
          deliveryFee: deliveryFee,
          isReschedule: isReschedule
        };

        // Close delivery modal and open payment modal
        setShowDeliveryModal(false);
        setSelectedOrderForDelivery(null);
        
        // Set payment data and open payment modal
        setPaymentData(deliveryPaymentData);
        setShowPaymentModal(true);
      } else {
        // No fee, directly schedule delivery
        const conversationId = selectedConversation.id || 
          [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

        // Format order items for scheduling message
        const schedulingOrderDetails = selectedOrderForDelivery.items?.map(item => 
          `• ${item.name || item.itemName} x${item.quantity} - ${getCurrencySymbol(selectedOrderForDelivery.currency)}${formatPrice((item.price || item.subtotal) * (item.quantity || 1), selectedOrderForDelivery.currency)}`
        ).join('\n') || 'Order items not available';

        const messagePrefix = isReschedule ? '🔄 DELIVERY RESCHEDULED' : '📋 DELIVERY SCHEDULED';
        let deliveryMessage = `${messagePrefix}\n\nOrder ID: ${selectedOrderForDelivery.orderId}\n\n📦 ORDER ITEMS:\n${schedulingOrderDetails}\n\nTotal: ${getCurrencySymbol(selectedOrderForDelivery.currency)}${formatPrice(selectedOrderForDelivery.totalAmount, selectedOrderForDelivery.currency)}\n\n${isReschedule ? 'Customer has rescheduled delivery.\n\n' : ''}Delivery Time: ${timeDescription}\nDelivery Fee: FREE\n\nThe seller will deliver at the scheduled time.`;

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
            deliveryFee: 0,
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
      }

    } catch (error) {
      console.error('Error scheduling delivery:', error);
      alert('Failed to schedule delivery. Please try again.');
    }
  };

  // Schedule Pay At Store collection (no payment required)
  const schedulePayAtStoreCollection = async () => {
    if (!selectedOrderForDelivery || !selectedConversation || !currentUser) {
      alert('Cannot schedule collection - invalid data.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Get time description based on time slot
      let timeDescription = '';
      switch (deliverySettings.timeSlot) {
        case 'morning':
          timeDescription = '9:00 AM - 12:00 PM';
          break;
        case 'afternoon':
          timeDescription = '12:00 PM - 5:00 PM';
          break;
        case 'evening':
          timeDescription = '5:00 PM - 8:00 PM';
          break;
        case 'next_day':
          timeDescription = 'Any time next day';
          break;
        default:
          timeDescription = '9:00 AM - 12:00 PM';
      }

      // Format order items for collection message
      const collectionOrderDetails = selectedOrderForDelivery.items?.map(item => 
        `• ${item.name || item.itemName} x${item.quantity} - ${getCurrencySymbol(selectedOrderForDelivery.currency)}${formatPrice((item.price || item.subtotal) * (item.quantity || 1), selectedOrderForDelivery.currency)}`
      ).join('\n') || 'Order items not available';

      // Generate pickup code for Pay At Store collection
      const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const collectionMessage = `📋 PAY AT STORE COLLECTION SCHEDULED\n\nOrder ID: ${selectedOrderForDelivery.orderId}\n\n📦 ORDER ITEMS:\n${collectionOrderDetails}\n\nCollection Time: ${timeDescription}\nTotal to Pay at Collection: ${getCurrencySymbol(selectedOrderForDelivery.currency)}${formatPrice(selectedOrderForDelivery.total || selectedOrderForDelivery.amount, selectedOrderForDelivery.currency)}\n\n🎫 CUSTOMER PICKUP CODE: ${pickupCode}\n\n💳 NO COLLECTION FEE - Customer will pay for items at store\n\n⚠️ IMPORTANT: Verify the pickup code before accepting payment and handing over items.\n\nCustomer will collect and pay at the scheduled time. Please have the order ready.`;

      // Send collection scheduled message
      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: collectionMessage,
        messageType: 'pay_at_store_collection_scheduled',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...selectedOrderForDelivery,
          collectionTime: timeDescription,
          timeSlot: deliverySettings.timeSlot,
          deliveryType: 'Pay At Store',
          pickupCode: pickupCode
        }
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        messageData.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);

      // Send pickup code to customer
      const customerCodeMessage = `🎫 YOUR PICKUP CODE

Order ID: ${selectedOrderForDelivery.orderId}

Your collection pickup code is: ${pickupCode}

⏰ Collection Time: ${timeDescription}
💳 Payment: Pay at store when collecting

💡 IMPORTANT: Present this code and payment when you arrive to collect your order.

Please arrive at your scheduled time with this code and payment method.`;

      await addDoc(collection(db, 'messages'), {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: currentUser.uid,
        receiverName: currentUser.displayName || currentUser.email,
        message: customerCodeMessage,
        timestamp: serverTimestamp(),
        isRead: true,
        messageType: 'pay_at_store_pickup_code',
        orderData: {
          ...selectedOrderForDelivery,
          collectionTime: timeDescription,
          timeSlot: deliverySettings.timeSlot,
          deliveryType: 'Pay At Store',
          pickupCode: pickupCode
        }
      });

      // Close modal and reset
      setShowCollectionModal(false);
      setSelectedOrderForDelivery(null);

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Pay At Store collection scheduled!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      console.error('Error scheduling Pay At Store collection:', error);
      alert('Failed to schedule collection. Please try again.');
    }
  };

  const markReadyForCollection = async (orderData) => {
    if (!selectedConversation || !currentUser) {
      alert('Cannot mark ready for collection - invalid data.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Send ready for collection message
      const readyMessage = `📦 ORDER READY FOR COLLECTION\n\nOrder ID: ${orderData.orderId}\n\nYour order is now ready for collection! Please collect at your scheduled time: ${orderData.collectionTime || 'as arranged'}.`;

      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: readyMessage,
        messageType: 'ready_for_collection',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: orderData
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        messageData.receiverEmail = selectedConversation.otherUserEmail;
      }

      // Add order to marked ready list to disable reschedule buttons
      setOrdersMarkedReady(prev => [...prev, orderData.orderId]);

      await addDoc(collection(db, 'messages'), messageData);

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Order marked as ready for collection!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      console.error('Error marking ready for collection:', error);
      alert('Failed to mark ready for collection. Please try again.');
    }
  };

  const completeCollection = async (orderData) => {
    if (!selectedConversation || !currentUser) {
      alert('Cannot complete collection - invalid data.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Update store item quantities
      if (orderData.items && orderData.items.length > 0) {
        for (const orderItem of orderData.items) {
          try {
            // Get all store items and find by name since ID might not match
            const storeItemsQuery = collection(db, 'stores', currentUser.uid, 'items');
            const storeItemsSnapshot = await getDocs(storeItemsQuery);
            
            for (const itemDoc of storeItemsSnapshot.docs) {
              const itemData = itemDoc.data();
              if (itemData.name === orderItem.name || itemData.name === orderItem.itemName) {
                const currentQuantity = parseInt(itemData.quantity) || 0;
                const orderedQuantity = parseInt(orderItem.quantity) || 0;
                const newQuantity = Math.max(0, currentQuantity - orderedQuantity);
                
                await updateDoc(itemDoc.ref, {
                  quantity: newQuantity
                });
                break;
              }
            }
          } catch (error) {
            console.error(`Error updating quantity for item ${orderItem.name}:`, error);
          }
        }
      }

      // Send collection completion message
      const completionMessage = `✅ COLLECTION COMPLETED\n\nOrder ID: ${orderData.orderId}\n\nThe order has been successfully collected by the customer. Transaction completed!`;

      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: completionMessage,
        messageType: 'collection_completed',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: orderData
      };
      
      // Also send a receipt offer to the customer
      const receiptOfferData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: `Would you like a receipt for your order?\n\nClick 'Yes' to generate a receipt with your order details.`,
        messageType: 'receipt_offer',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: orderData
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        messageData.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);
      
      // Send the receipt offer message right after
      if (selectedConversation.otherUserEmail) {
        receiptOfferData.receiverEmail = selectedConversation.otherUserEmail;
      }
      
      await addDoc(collection(db, 'messages'), receiptOfferData);

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Collection completed and quantities updated!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      console.error('Error completing collection:', error);
      alert('Failed to complete collection. Please try again.');
    }
  };

  // Confirm Pay At Store order (seller side)
  const confirmPayAtStoreOrder = async (orderData) => {
    if (!selectedConversation || !currentUser || !isSeller) {
      alert('Cannot confirm order - invalid session.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      // Format order items for confirmation message
      const orderItemsText = orderData.items?.map(item => 
        `• ${item.name} x${item.quantity} - ${getCurrencySymbol(orderData.currency)}${formatPrice(item.price * item.quantity, orderData.currency)}`
      ).join('\n') || 'Order items not available';

      const confirmationMessage = `✅ PAY AT STORE ORDER CONFIRMED\n\nOrder ID: ${orderData.orderId}\n\n📦 CONFIRMED ITEMS:\n${orderItemsText}\n\nTotal to Pay at Store: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}\n\n💳 Customer will pay when collecting\n\nYour order is confirmed! Please come to collect and pay at the store.`;

      // Send confirmation message
      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: confirmationMessage,
        messageType: 'pay_at_store_confirmed',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: orderData
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        messageData.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);

      // Update order tracking records when seller confirms pay-at-store order
      try {
        // Generate pickup code for the confirmed order
        const pickupCode = generatePickupCode();
        
        // Update orders collection
        const ordersQuery = query(
          collection(db, 'orders'),
          where('orderId', '==', orderData.orderId),
          where('sellerId', '==', currentUser.uid)
        );
        
        const ordersSnapshot = await getDocs(ordersQuery);
        if (!ordersSnapshot.empty) {
          const orderDoc = ordersSnapshot.docs[0];
          await updateDoc(doc(db, 'orders', orderDoc.id), {
            status: 'confirmed',
            confirmedAt: serverTimestamp(),
            pickupCode: pickupCode,
            awaitingSellerConfirmation: false,
            readyForCollection: true
          });
        }

        // Update transactions collection
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('orderId', '==', orderData.orderId),
          where('sellerId', '==', currentUser.uid)
        );
        
        const transactionsSnapshot = await getDocs(transactionsQuery);
        if (!transactionsSnapshot.empty) {
          const transactionDoc = transactionsSnapshot.docs[0];
          await updateDoc(doc(db, 'transactions', transactionDoc.id), {
            status: 'confirmed',
            confirmedAt: serverTimestamp(),
            pickupCode: pickupCode,
            pickupStatus: 'pending'
          });
        }

        // Send pickup code to customer
        const pickupCodeMessage = {
          conversationId: conversationId,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          senderEmail: currentUser.email,
          receiverId: selectedConversation.otherUserId,
          receiverName: selectedConversation.otherUserName,
          message: `🎫 PICKUP CODE FOR YOUR ORDER\n\nOrder ID: ${orderData.orderId}\nPickup Code: ${pickupCode}\n\n⚠️ IMPORTANT:\n• Present this code when collecting your order\n• You will pay ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)} at the store\n• Keep this code safe - it's required for collection\n\nYour order is ready for collection at the store!`,
          messageType: 'pickup_code_delivery',
          timestamp: serverTimestamp(),
          isRead: false,
          orderData: {
            ...orderData,
            pickupCode: pickupCode,
            status: 'confirmed'
          }
        };

        if (selectedConversation.otherUserEmail) {
          pickupCodeMessage.receiverEmail = selectedConversation.otherUserEmail;
        }

        await addDoc(collection(db, 'messages'), pickupCodeMessage);
        
        console.log('✅ Updated pay-at-store order tracking and generated pickup code:', pickupCode);
      } catch (updateError) {
        console.error('Error updating order tracking:', updateError);
        // Don't block the main flow
      }

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Pay At Store order confirmed! Pickup code sent to customer.`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      }, 4000);

    } catch (error) {
      console.error('Error confirming Pay At Store order:', error);
      alert('Failed to confirm order. Please try again.');
    }
  };

  // Mark Pay At Store order ready for collection
  const markPayAtStoreReady = async (orderData) => {
    if (!selectedConversation || !currentUser || !isSeller) {
      alert('Cannot mark ready - invalid session.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const readyMessage = `📦 PAY AT STORE ORDER READY\n\nOrder ID: ${orderData.orderId}\n\nYour order is ready for collection!\n\n💳 Please bring payment method to pay ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)} at collection.\n\nCome to the store when ready to collect and pay.`;

      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: readyMessage,
        messageType: 'pay_at_store_ready',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: orderData
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        messageData.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Customer notified order is ready for collection and payment!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      console.error('Error marking Pay At Store order ready:', error);
      alert('Failed to notify customer. Please try again.');
    }
  };

  // Complete Pay At Store transaction (seller side)
  const completePayAtStoreTransaction = async (orderData) => {
    if (!selectedConversation || !currentUser || !isSeller) {
      alert('Cannot complete transaction - invalid session.');
      return;
    }

    // Confirm payment received
    const paymentReceived = window.confirm(
      `Confirm payment received?\n\nOrder ID: ${orderData.orderId}\nAmount: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}\n\nHas the customer paid and collected their order?`
    );

    if (!paymentReceived) return;

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const completionMessage = `✅ PAY AT STORE TRANSACTION COMPLETED\n\nOrder ID: ${orderData.orderId}\nAmount Paid: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}\nCompleted at: ${new Date().toLocaleString()}\n\nThank you for your business!\n\nTransaction successfully completed.`;

      const messageData = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: completionMessage,
        messageType: 'pay_at_store_completed',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: { ...orderData, status: 'completed', completedAt: new Date().toISOString() }
      };

      // Only add receiverEmail if it exists
      if (selectedConversation.otherUserEmail) {
        messageData.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), messageData);

      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ Pay At Store transaction completed!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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
      console.error('Error completing Pay At Store transaction:', error);
      alert('Failed to complete transaction. Please try again.');
    }
  };

  // Schedule collection
  const scheduleCollection = async () => {
    if (!selectedOrderForDelivery || !selectedConversation || !currentUser) {
      alert('Cannot schedule collection - invalid data.');
      return;
    }

    try {
      // Check if this is a Pay At Store order
      if (selectedOrderForDelivery.deliveryType === 'Pay At Store') {
        await schedulePayAtStoreCollection();
        return;
      }

      // Calculate collection fee based on time slot
      let collectionFee = 0;
      let timeDescription = '';
      
      switch (deliverySettings.timeSlot) {
        case 'morning':
          collectionFee = 1.50;
          timeDescription = '9:00 AM - 12:00 PM';
          break;
        case 'afternoon':
          collectionFee = 2.00;
          timeDescription = '12:00 PM - 5:00 PM';
          break;
        case 'evening':
          collectionFee = 2.50;
          timeDescription = '5:00 PM - 8:00 PM';
          break;
        case 'next_day':
          collectionFee = 4.00;
          timeDescription = 'Any time next day';
          break;
        default:
          collectionFee = 1.50;
          timeDescription = '9:00 AM - 12:00 PM';
      }

      // Create payment data for ONLY the collection scheduling fee
      const collectionPaymentData = {
        orderId: selectedOrderForDelivery.orderId || `COLL-${Date.now()}`,
        items: [{
          name: `Collection Scheduling - ${timeDescription}`,
          quantity: 1,
          price: collectionFee,
          subtotal: collectionFee
        }],
        currency: selectedOrderForDelivery.currency || 'GBP',
        total: collectionFee,
        amount: collectionFee,
        serviceType: 'collection_scheduling',
        description: `Collection Scheduling Fee - ${timeDescription}`,
        originalOrderData: selectedOrderForDelivery, // Keep reference to original order
        collectionTime: timeDescription,
        timeSlot: deliverySettings.timeSlot,
        collectionFee: collectionFee
      };

      // Close collection modal and open payment modal
      setShowCollectionModal(false);
      setSelectedOrderForDelivery(null);
      
      // Set payment data and open payment modal
      setPaymentData(collectionPaymentData);
      setShowPaymentModal(true);

    } catch (error) {
      console.error('Error preparing collection payment:', error);
      alert('Failed to prepare collection payment. Please try again.');
    }
  };

  // Show delivery confirmation popup
  const showDeliveryConfirmation = (orderData) => {
    // Check if this is a Collection order - should not use delivery confirmation
    if (orderData?.deliveryType === 'Collection') {
      alert('This is a Collection order. Delivery confirmation is not applicable.');
      return;
    }
    
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
      // Update store item quantities
      if (orderData.items && orderData.items.length > 0) {
        for (const orderItem of orderData.items) {
          try {
            // Get all store items and find by name since ID might not match
            const storeItemsQuery = collection(db, 'stores', currentUser.uid, 'items');
            const storeItemsSnapshot = await getDocs(storeItemsQuery);
            
            for (const itemDoc of storeItemsSnapshot.docs) {
              const itemData = itemDoc.data();
              if (itemData.name === orderItem.name || itemData.name === orderItem.itemName) {
                const currentQuantity = parseInt(itemData.quantity) || 0;
                const orderedQuantity = parseInt(orderItem.quantity) || 0;
                const newQuantity = Math.max(0, currentQuantity - orderedQuantity);
                
                await updateDoc(itemDoc.ref, {
                  quantity: newQuantity
                });
                break;
              }
            }
          } catch (error) {
            console.error(`Error updating quantity for item ${orderItem.name || orderItem.itemName}:`, error);
          }
        }
      }

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
        message: `✅ DELIVERY COMPLETED!\n\nOrder ID: ${orderData.orderId}\n\n📦 DELIVERED ITEMS:\n${completionOrderDetails}\n\nTotal: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}\n\nYour order has been delivered successfully!\n\nThank you for your business. We hope you enjoy your order!`,
        messageType: 'delivery_completed',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...orderData,
          deliveryCompleted: new Date().toISOString()
        }
      };

      // Only add receiverEmail if it exists and is not empty
      if (selectedConversation.otherUserEmail) {
        completionMessage.receiverEmail = selectedConversation.otherUserEmail;
      }

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
      notification.innerHTML = `✅ Delivery completed and quantities updated!`;
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

  // === COLLECTION (PICKUP) FUNCTIONS ===
  
  // Confirm order for collection (seller side)
  const confirmOrderForCollection = async (orderData) => {
    if (!selectedConversation || !currentUser || !isSeller) {
      alert('Cannot confirm order - invalid session.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const confirmMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: `✅ ORDER CONFIRMED (Collection)

Order ID: ${orderData.orderId}

Your order has been confirmed for collection at our store.
Please wait for notification when your items are ready.

Items:
${orderData.items.map(item => `• ${item.itemName || item.name} x${item.quantity}`).join('\n')}

Total: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}

Bring your pickup code when you collect.`,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'order_confirmed_collection',
        orderData: { ...orderData, deliveryType: 'Collection' }
      };

      // Add receiverEmail if available
      if (selectedConversation.otherUserEmail) {
        confirmMessage.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), confirmMessage);

      alert('✅ Order confirmed for collection!');
    } catch (error) {
      console.error('Error confirming collection order:', error);
      alert('Failed to confirm order. Please try again.');
    }
  };

  // Generate receipt for customer
  const generateReceipt = async (orderData) => {
    if (!orderData || !orderData.orderId) {
      alert('Invalid order data for receipt generation.');
      return false;
    }
    
    try {
      // Get store information
      const storeId = orderData.sellerId || selectedConversation?.otherUserId;
      let storeData = {};
      let actualStoreName = selectedConversation?.otherUserName || orderData.sellerName || 'Store';
      
      // Try to fetch store data from stores collection
      try {
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
          storeData = storeDoc.data();
          // Use comprehensive store name fallback chain
          actualStoreName = storeData.storeName || 
                           storeData.businessName || 
                           storeData.name || 
                           storeData.displayName ||
                           selectedConversation?.otherUserName || 
                           orderData.sellerName || 
                           'Store';
          console.log('✅ Store data found:', { 
            storeId, 
            storeName: actualStoreName,
            availableFields: Object.keys(storeData)
          });
        } else {
          console.warn('⚠️ Store document not found for storeId:', storeId);
        }
      } catch (storeError) {
        console.error('❌ Error fetching store data:', storeError);
      }
      
      // If still no good store name, try to fetch from users collection
      if (actualStoreName === 'Store' && storeId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', storeId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            actualStoreName = userData.displayName || 
                             userData.businessName || 
                             userData.storeName || 
                             userData.name || 
                             actualStoreName;
            console.log('✅ Fallback store name from users collection:', actualStoreName);
          }
        } catch (userError) {
          console.error('❌ Error fetching user data for store name:', userError);
        }
      }
      
      // Get buyer information
      const buyerInfo = await fetchUserInfo(currentUser.uid);
      
      // Format receipt items
      const itemsList = orderData.items?.map(item => ({
        name: item.name || item.itemName,
        quantity: item.quantity || 1,
        price: item.price || (item.subtotal / (item.quantity || 1))
      })) || [];
      
      // Get comprehensive store information
      let storeBusinessId = storeData.businessId || '';
      let storeRegistrationNumber = '';
      let storeVatNumber = '';
      
      // Extract registration/VAT numbers if they exist in the business ID format
      if (storeBusinessId) {
        const businessIdParts = storeBusinessId.split('/');
        if (businessIdParts.length > 1) {
          storeRegistrationNumber = businessIdParts[0] || '';
          storeVatNumber = businessIdParts[1] || '';
        } else {
          storeRegistrationNumber = storeBusinessId;
        }
      }
      
      // Generate receipt
      const receiptData = {
        receiptId: `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: orderData.orderId,
        userId: currentUser.uid, // Add the userId field that the ReceiptsPage uses
        buyerId: currentUser.uid, // For compatibility with both queries
        customerId: currentUser.uid,
        customerName: buyerInfo.name || currentUser.displayName || currentUser.email,
        customerEmail: buyerInfo.email || currentUser.email,
        sellerId: storeId,
        sellerName: actualStoreName,
        storeName: actualStoreName,
        storeAddress: storeData.storeLocation || 
                     storeData.address || 
                     storeData.businessAddress || 
                     storeData.storeAddress ||
                     storeData.location?.address || 
                     (typeof storeData.location === 'string' ? storeData.location : '') ||
                     storeData.fullAddress ||
                     storeData.streetAddress ||
                     orderData.storeAddress || 
                     '',
        storePhone: storeData.phoneNumber || 
                   storeData.phone || 
                   storeData.contactNumber || 
                   storeData.businessPhone ||
                   storeData.storePhone ||
                   storeData.contactPhone ||
                   storeData.mobile ||
                   orderData.storePhone || 
                   '',
        storeEmail: storeData.email || storeData.contactEmail || storeData.businessEmail || '',
        storeRegistrationNumber: storeRegistrationNumber || '',
        storeVatNumber: storeVatNumber || '',
        storeBusinessId: storeBusinessId || '',
        items: itemsList,
        currency: orderData.currency || 'GBP',
        subtotal: orderData.subtotal || itemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        deliveryFee: orderData.deliveryFee || 0,
        serviceFee: orderData.serviceFee || 0,
        totalAmount: orderData.totalAmount || orderData.amount || 0,
        paymentMethod: orderData.paymentMethod || 'Online Payment',
        deliveryMethod: orderData.deliveryMethod || orderData.deliveryType || 'Collection',
        dateCreated: new Date().toISOString(),
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(), // Add timestamp field for proper ordering
        type: 'order',
        status: 'generated',
        regenerated: false
      };
      
      // Save receipt to receipts collection
      const receiptRef = await addDoc(collection(db, 'receipts'), receiptData);
      
      // Add or update this transaction in the reports collection
      try {
        const reportData = {
          orderId: orderData.orderId,
          receiptId: receiptData.receiptId,
          receiptRef: receiptRef.id, // Reference to the actual receipt document
          sellerId: storeId,
          sellerName: storeData.businessName || storeData.name || 'Store',
          buyerId: currentUser.uid,
          buyerName: buyerInfo.name || currentUser.displayName || currentUser.email,
          totalAmount: receiptData.totalAmount,
          currency: receiptData.currency,
          items: receiptData.items,
          status: 'completed',
          paymentMethod: receiptData.paymentMethod,
          deliveryType: receiptData.deliveryMethod,
          receiptGenerated: true,
          receiptGeneratedAt: serverTimestamp(),
          transactionType: 'order',
          reportingTimestamp: serverTimestamp()
        };
        
        // Check if this order is already in reports
        const reportsQuery = query(
          collection(db, 'reports'),
          where('orderId', '==', orderData.orderId)
        );
        
        const reportSnap = await getDocs(reportsQuery);
        if (reportSnap.empty) {
          // Create a new report entry
          await addDoc(collection(db, 'reports'), reportData);
        } else {
          // Update existing report entry
          const reportDoc = reportSnap.docs[0];
          await updateDoc(doc(db, 'reports', reportDoc.id), {
            receiptId: receiptData.receiptId,
            receiptRef: receiptRef.id,
            receiptGenerated: true,
            receiptGeneratedAt: serverTimestamp()
          });
        }
      } catch (reportError) {
        console.error('Error updating reports with receipt info:', reportError);
        // Don't block the main flow if reports update fails
      }
      
      // Send receipt confirmation message
      const receiptMessage = {
        conversationId: selectedConversation.id,
        senderId: storeId,
        senderName: actualStoreName,
        receiverId: currentUser.uid,
        receiverName: buyerInfo.name || currentUser.displayName || currentUser.email,
        receiverEmail: buyerInfo.email || currentUser.email,
        message: `🧾 Your Receipt\n\nThank you for your order!\n\nStore: ${receiptData.storeName}\n${receiptData.storeAddress ? `Address: ${receiptData.storeAddress}\n` : ''}${receiptData.storePhone ? `Phone: ${receiptData.storePhone}\n` : ''}${receiptData.storeBusinessId ? `Business ID: ${receiptData.storeBusinessId}\n` : ''}${receiptData.storeRegistrationNumber ? `Reg. No: ${receiptData.storeRegistrationNumber}\n` : ''}${receiptData.storeVatNumber ? `VAT No: ${receiptData.storeVatNumber}\n` : ''}\nOrder ID: ${orderData.orderId}\nDate: ${new Date().toLocaleDateString()}\n\nItems:\n${itemsList.map(item => `• ${item.name} x${item.quantity} - ${getCurrencySymbol(receiptData.currency)}${formatPrice(item.price * item.quantity, receiptData.currency)}`).join('\n')}\n\nSubtotal: ${getCurrencySymbol(receiptData.currency)}${formatPrice(receiptData.subtotal, receiptData.currency)}\nDelivery Fee: ${getCurrencySymbol(receiptData.currency)}${formatPrice(receiptData.deliveryFee, receiptData.currency)}\nService Fee: ${getCurrencySymbol(receiptData.currency)}${formatPrice(receiptData.serviceFee, receiptData.currency)}\nTotal: ${getCurrencySymbol(receiptData.currency)}${formatPrice(receiptData.totalAmount, receiptData.currency)}\n\nPayment Method: ${receiptData.paymentMethod}\nDelivery Method: ${receiptData.deliveryMethod}\n\nYour receipt has been saved to your Receipts page for future reference.\n\nThank you for shopping with ${receiptData.storeName}!`,
        messageType: 'receipt_generated',
        timestamp: serverTimestamp(),
        isRead: false,
        receiptData: receiptData
      };
      
      await addDoc(collection(db, 'messages'), receiptMessage);
      
      return true;
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('Failed to generate receipt. Please try again.');
      return false;
    }
  };

  // Handle receipt offer actions
  const handleReceiptAction = async (action, orderData) => {
    if (action === 'generate_receipt') {
      const success = await generateReceipt(orderData);
      if (success) {
        alert('✅ Receipt generated successfully! You can find it in your Receipts page.');
      }
    } else if (action === 'decline_receipt') {
      // Send a simple acknowledgment message
      try {
        await addDoc(collection(db, 'messages'), {
          conversationId: selectedConversation.id,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          senderEmail: currentUser.email,
          receiverId: selectedConversation.otherUserId,
          receiverName: selectedConversation.otherUserName,
          message: 'No receipt needed, thank you.',
          messageType: 'receipt_declined',
          timestamp: serverTimestamp(),
          isRead: false
        });
      } catch (error) {
        console.error('Error declining receipt:', error);
      }
    }
  };

  // Request refund (for customers) - opens modal
  const requestRefund = async (orderData) => {
    if (!selectedConversation || !currentUser || isSeller) {
      alert('Cannot request refund - invalid session.');
      return;
    }

    if (!orderData || !orderData.orderId) {
      alert('Invalid order data for refund request.');
      return;
    }

    // Check if store allows refunds
    const storeId = selectedConversation.otherUserId; // seller's ID
    const refundsAllowed = await checkStoreRefundsPolicy(storeId);
    
    if (!refundsAllowed) {
      alert('❌ Refunds Not Available\n\nThis store does not offer refunds. Please contact the seller directly if you have concerns about your order.');
      return;
    }

    // Open refund modal with order data
    // Make sure we have the correct total amount for display, accounting for different field names
    const normalizedOrderData = {
      ...orderData,
      // Ensure there's always a totalAmount field for display
      totalAmount: orderData.total || orderData.amount || orderData.totalAmount || 0
    };
    
    setPendingRefundOrder(normalizedOrderData);
    setRefundReason('');
    setRefundDetails('');
    setShowRefundModal(true);
  };

  // Process refund request from modal
  const processRefundRequest = async () => {
    if (!refundReason.trim()) {
      alert('Please select a reason for the refund.');
      return;
    }

    try {
      // Fetch buyer's complete information from Firestore
      const buyerInfo = await fetchUserInfo(currentUser.uid);
      const buyerName = buyerInfo.name;
      const buyerEmail = buyerInfo.email;

      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const refundMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: `� ORDER CANCELLED & REFUND REQUESTED\n\nOrder ID: ${pendingRefundOrder.orderId}\nReason: ${refundReason}\n${refundDetails.trim() ? `Details: ${refundDetails}\n` : ''}\nCustomer has cancelled the order and requested a refund.\n\nPlease review and process the refund request.`,
        messageType: 'refund_requested',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...pendingRefundOrder,
          refundReason: refundReason,
          refundDetails: refundDetails,
          refundRequestedAt: new Date().toISOString(),
          orderCancelled: true
        }
      };

      // Add structured refund data for UI display
      refundMessage.refundData = {
        orderId: pendingRefundOrder.orderId,
        amount: pendingRefundOrder.totalAmount || pendingRefundOrder.total || pendingRefundOrder.amount || 0,
        currency: pendingRefundOrder.currency || 'GBP',
        reason: refundReason,
        details: refundDetails,
        paymentMethod: pendingRefundOrder.paymentMethod || 
                      pendingRefundOrder.displayInfo?.paymentMethod || 
                      pendingRefundOrder.method || 
                      'unknown',
        requiresStripeRefund: (function() {
          const paymentMethod = pendingRefundOrder.paymentMethod || 
                               pendingRefundOrder.displayInfo?.paymentMethod || 
                               pendingRefundOrder.method || 
                               'unknown';
          // All digital payment methods (card, Google Pay, Apple Pay, etc.) require Stripe refund
          // Only bank transfers are manual
          const digitalPaymentMethods = ['card', 'google_pay', 'apple_pay', 'paypal', 'klarna'];
          return digitalPaymentMethods.includes(paymentMethod) || 
                 (paymentMethod !== 'bank_transfer' && paymentMethod !== 'unknown');
        })(),
        refundRequestedAt: new Date().toISOString(),
        orderCancelled: true,
        customerName: buyerName,
        customerId: currentUser.uid,
        sellerId: selectedConversation.otherUserId // Add seller ID for wallet updates
      };

      // Only add paymentIntentId if it exists and is not undefined
      const paymentIntentId = pendingRefundOrder.paymentIntentId || 
                             pendingRefundOrder.stripePaymentIntentId ||
                             pendingRefundOrder.displayInfo?.paymentIntentId;
      if (paymentIntentId) {
        refundMessage.refundData.paymentIntentId = paymentIntentId;
      }

      // Add other order data fields that exist
      Object.keys(pendingRefundOrder).forEach(key => {
        if (pendingRefundOrder[key] !== undefined && pendingRefundOrder[key] !== null && !refundMessage.refundData.hasOwnProperty(key)) {
          refundMessage.refundData[key] = pendingRefundOrder[key];
        }
      });

      // Only add receiverEmail if it exists and is not empty
      const receiverEmail = selectedConversation.otherUserEmail;
      if (receiverEmail) {
        refundMessage.receiverEmail = receiverEmail;
      }

      await addDoc(collection(db, 'messages'), refundMessage);
      
      // Now all refunds require seller approval - no automatic processing
      try {
        const conversationId = selectedConversation.id || 
          [currentUser.uid, selectedConversation.otherUserId].sort().join('_');
        
        if (refundMessage.refundData.requiresStripeRefund && refundMessage.refundData.paymentIntentId) {
          // Stripe/card payment refunds - now wait for seller approval
          console.log('� Card refund request - awaiting seller approval');
          
          // Notify customer that refund request has been sent to seller
          const cardRefundRequestNotice = {
            conversationId: conversationId,
            senderId: 'system',
            senderName: 'Refund System',
            receiverId: currentUser.uid,
            receiverName: currentUser.displayName || currentUser.email,
            message: `🔄 REFUND REQUEST SUBMITTED\n\nOrder ID: ${refundMessage.refundData.orderId}\nAmount: ${getCurrencySymbol(refundMessage.refundData.currency)}${formatPrice(refundMessage.refundData.amount, refundMessage.refundData.currency)}\n\n⏳ Your refund request has been sent to the seller for approval.\n\nOnce approved, your refund will be processed to your original payment method within 2-5 business days.`,
            messageType: 'refund_request_notice',
            timestamp: serverTimestamp(),
            isRead: false,
            orderData: {
              ...refundMessage.refundData,
              refundRequested: true,
              refundAmount: refundMessage.refundData.amount,
              refundRequestedAt: new Date().toISOString(),
              awaitingSellerApproval: true,
              customerName: refundMessage.refundData.customerName
            }
          };

          if (currentUser.email) {
            cardRefundRequestNotice.receiverEmail = currentUser.email;
          }

          await addDoc(collection(db, 'messages'), cardRefundRequestNotice);
          
          console.log('✅ Card refund request sent to seller for approval');
          alert(`✅ Refund Request Sent!\n\nYour refund request has been sent to the seller for approval.\n\nOnce approved, your refund of ${getCurrencySymbol(refundMessage.refundData.currency)}${formatPrice(refundMessage.refundData.amount, refundMessage.refundData.currency)} will be processed to your original payment method.`);
          
        } else {
          // Bank transfer - send notification to seller about manual refund
          const manualRefundNotice = {
            conversationId: conversationId,
            senderId: 'system',
            senderName: 'Refund System',
            receiverId: selectedConversation.otherUserId,
            receiverName: selectedConversation.otherUserName,
            message: `🏦 MANUAL REFUND REQUIRED\n\nOrder ID: ${refundMessage.refundData.orderId}\nRefund Amount: ${getCurrencySymbol(refundMessage.refundData.currency)}${formatPrice(refundMessage.refundData.amount, refundMessage.refundData.currency)}\nCustomer: ${buyerName}\n\n💰 Please transfer the refund amount manually from your bank account to the customer.\n\n📸 IMPORTANT: After completing the transfer, you MUST click "Refund Transferred" and attach a screenshot of the transfer confirmation as proof.\n\nThe customer will receive an approval message with your screenshot once you confirm the transfer.`,
            messageType: 'manual_refund_notice',
            timestamp: serverTimestamp(),
            isRead: false,
            orderData: {
              ...refundMessage.refundData,
              refundApproved: true,
              refundAmount: refundMessage.refundData.amount,
              manualRefundRequired: true,
              notifiedAt: new Date().toISOString(),
              awaitingTransferConfirmation: true,
              customerName: refundMessage.refundData.customerName
            }
          };

          if (selectedConversation.otherUserEmail) {
            manualRefundNotice.receiverEmail = selectedConversation.otherUserEmail;
          }

          await addDoc(collection(db, 'messages'), manualRefundNotice);

          // Also send confirmation to customer for bank transfer
          const customerNotice = {
            conversationId: conversationId,
            senderId: 'system',
            senderName: 'Refund System',
            receiverId: currentUser.uid,
            receiverName: currentUser.displayName || currentUser.email,
            message: `✅ REFUND APPROVED\n\nOrder ID: ${refundMessage.refundData.orderId}\nRefund Amount: ${getCurrencySymbol(refundMessage.refundData.currency)}${formatPrice(refundMessage.refundData.amount, refundMessage.refundData.currency)}\n\n🏦 Since this was paid by bank transfer, the seller will transfer the refund manually to your bank account.\n\n📱 You will receive an approval message with a screenshot confirmation once the seller completes the transfer.\n\nExpected timeframe: 1-2 business days`,
            messageType: 'refund_approved',
            timestamp: serverTimestamp(),
            isRead: false,
            orderData: {
              ...refundMessage.refundData,
              refundApproved: true,
              refundAmount: refundMessage.refundData.amount,
              manualRefundNotified: true,
              approvedAt: new Date().toISOString(),
              awaitingTransferConfirmation: true,
              customerName: refundMessage.refundData.customerName
            }
          };

          if (currentUser.email) {
            customerNotice.receiverEmail = currentUser.email;
          }

          await addDoc(collection(db, 'messages'), customerNotice);
        }
      } catch (autoRefundError) {
        console.error('Auto-refund processing error:', autoRefundError);
        // Continue with the original flow if auto-processing fails
      }
      
      // Close modal and reset states
      setShowRefundModal(false);
      setPendingRefundOrder(null);
      setRefundReason('');
      setRefundDetails('');

      const notification = document.createElement('div');
      notification.innerHTML = refundMessage.refundData.requiresStripeRefund 
        ? `✅ Order cancelled! Refund request sent to seller for approval.`
        : `✅ Order cancelled and seller notified to process manual refund!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
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

  // Approve refund (for sellers)
  const approveRefund = async (refundOrderData, refundAmount) => {
    if (!selectedConversation || !currentUser || !isSeller) {
      alert('Cannot approve refund - invalid session.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const isStripePayment = refundOrderData.requiresStripeRefund;
      
      if (isStripePayment) {
        // For Stripe payments, process actual refund
        console.log('🚀 Processing Stripe refund for seller approval');
        
        const refundResult = await processRefundSafely({
          ...refundOrderData,
          amount: refundAmount
        });
        
        if (refundResult.success) {
          const result = refundResult.data;
          
          // Update seller wallet for refund deduction
          await updateSellerWalletForRefund({
            ...refundOrderData,
            stripeRefundId: result.refundId,
            sellerId: currentUser.uid, // Current user is the seller approving the refund
            customerId: selectedConversation.otherUserId
          }, refundAmount);

          const refundReason = refundOrderData.refundReason ? 
            `\n\nReason: "${refundOrderData.refundReason}"` : '';

          const approvalMessage = {
            conversationId: conversationId,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email,
            senderEmail: currentUser.email,
            receiverId: selectedConversation.otherUserId,
            receiverName: selectedConversation.otherUserName,
                message: `✅ REFUND APPROVED & PROCESSED\n\nOrder ID: ${refundOrderData.orderId}\nRefund Amount: ${getCurrencySymbol(refundOrderData.currency)}${formatPrice(refundAmount, refundOrderData.currency)}${refundReason}\n\n💳 Your refund has been processed and sent to your original payment method.\n\n⏱️ NEXT STEPS:\n• Your refund will appear in your account within 2-5 business days\n• You can check your account statements for the refund transaction\n• If not received after 5 business days, please contact your bank\n• Reference this Refund ID when contacting support: ${result.refundId}`,
            messageType: 'refund_approved',
            timestamp: serverTimestamp(),
            isRead: false,
            orderData: {
              ...refundOrderData,
              refundApproved: true,
              refundAmount: refundAmount,
              refundProcessedAt: new Date().toISOString(),
              stripeRefundId: result.refundId,
              refundReason: refundOrderData.refundReason || 'Not specified',
              status: 'cancelled_and_refunded',
              cancelledAt: new Date().toISOString()
            }
          };

          // Only add receiverEmail if it exists and is not empty
          if (selectedConversation.otherUserEmail) {
            approvalMessage.receiverEmail = selectedConversation.otherUserEmail;
          }

          await addDoc(collection(db, 'messages'), approvalMessage);
          
          console.log('✅ Seller-approved Stripe refund processed successfully');
          alert(`✅ Refund Approved & Processed!\n\nRefund of ${getCurrencySymbol(refundOrderData.currency)}${formatPrice(refundAmount, refundOrderData.currency)} has been processed through Stripe.\n\nRefund ID: ${result.refundId}\n\nThe customer has been notified and will receive their money within 2-5 business days depending on their bank. They've been instructed to check their account and contact their bank if the refund doesn't appear within that timeframe.`);

        } else {
          console.error('❌ Error processing Stripe refund:', refundResult.error);
          alert(`❌ Failed to process Stripe refund:\n\n${refundResult.error}\n\nPlease try again or contact support.`);
          return;
        }

      } else {
        // For bank transfer, just send approval message
        const approvalMessage = {
          conversationId: conversationId,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          senderEmail: currentUser.email,
          receiverId: selectedConversation.otherUserId,
          receiverName: selectedConversation.otherUserName,
            message: `✅ REFUND APPROVED\n\nOrder ID: ${refundOrderData.orderId}\nRefund Amount: ${getCurrencySymbol(refundOrderData.currency)}${formatPrice(refundAmount, refundOrderData.currency)}\n\n🏦 Since this was paid by bank transfer, the seller will process this refund manually back to your account.\n\n⏱️ NEXT STEPS:\n• Your refund will be processed within 1-3 business days\n• The seller will send confirmation once the transfer is complete\n• You'll receive a notification with transfer details\n• Please check your bank account for the incoming payment`,
          messageType: 'refund_approved',
          timestamp: serverTimestamp(),
          isRead: false,
          orderData: {
            ...refundOrderData,
            refundApproved: true,
            refundAmount: refundAmount,
            refundApprovedAt: new Date().toISOString(),
            refundReason: refundOrderData.refundReason || 'Not specified',
            status: 'cancelled_and_refunded',
            cancelledAt: new Date().toISOString()
          }
        };

        // Only add receiverEmail if it exists and is not empty
        if (selectedConversation.otherUserEmail) {
          approvalMessage.receiverEmail = selectedConversation.otherUserEmail;
        }

        await addDoc(collection(db, 'messages'), approvalMessage);
        
        // Show alert to seller for bank transfer refunds
        alert(`✅ Refund Approved!\n\nYou've approved a refund of ${getCurrencySymbol(refundOrderData.currency)}${formatPrice(refundAmount, refundOrderData.currency)} for order ${refundOrderData.orderId}.\n\nNEXT STEPS:\n• Process this refund manually through your bank\n• The customer has been notified that you'll handle this refund\n• Once completed, please send them confirmation of the transfer`);
      }

      const notification = document.createElement('div');
      notification.innerHTML = `✅ Refund approved and ${isStripePayment ? 'processed automatically via Stripe' : 'awaiting your manual bank transfer'}. Customer has been notified.`;
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
      }, 4000);

    } catch (error) {
      console.error('Error approving refund:', error);
      alert('Failed to approve refund. Please try again.');
    }
  };

  // Deny refund (for sellers)
  const denyRefund = async (refundOrderData, reason) => {
    if (!selectedConversation || !currentUser || !isSeller) {
      alert('Cannot deny refund - invalid session.');
      return;
    }

    try {
      const conversationId = selectedConversation.id || 
        [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

      const denialMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        message: `❌ REFUND DENIED\n\nOrder ID: ${refundOrderData.orderId}\nReason: ${reason}\n\nYour refund request has been denied by the seller.\n\n📢 HOW TO APPEAL THIS DECISION:\nIf you disagree with this decision, you can appeal by:\n• Messaging admin support directly\n• Include your order ID and this denial message\n• Provide any additional evidence to support your case\n• Our support team will review your appeal within 48 hours`,
        messageType: 'refund_denied',
        timestamp: serverTimestamp(),
        isRead: false,
        orderData: {
          ...refundOrderData,
          refundDenied: true,
          refundDenialReason: reason,
          refundDeniedAt: new Date().toISOString(),
          status: 'cancelled',
          cancelledAt: new Date().toISOString()
        }
      };

      // Only add receiverEmail if it exists and is not empty
      if (selectedConversation.otherUserEmail) {
        denialMessage.receiverEmail = selectedConversation.otherUserEmail;
      }

      await addDoc(collection(db, 'messages'), denialMessage);

      // Alert to confirm denial details
      alert(`❌ Refund Denied\n\nYou have denied the refund request for Order ID: ${refundOrderData.orderId}\n\nReason provided: ${reason}\n\nThe customer has been notified and informed about the appeal process with admin support.`);

      const notification = document.createElement('div');
      notification.innerHTML = `❌ Refund request denied. Customer notified with appeal options.`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #EF4444;
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
      console.error('Error denying refund:', error);
      alert('Failed to deny refund. Please try again.');
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

        // Determine the effective deliveryType for this order
        const effectiveDeliveryType = (orderData && orderData.deliveryType) || 
          (storeData && storeData.deliveryType) || 'Delivery';

        // Calculate delivery fee ONLY for Delivery (never for Collection)
        if (feeSettings.deliveryEnabled && effectiveDeliveryType === 'Delivery') {
          if (feeSettings.freeDeliveryThreshold && subtotal >= feeSettings.freeDeliveryThreshold) {
            deliveryFee = 0;
          } else {
            deliveryFee = feeSettings.deliveryFee || 0;
          }
        } else {
          deliveryFee = 0; // Force zero for Collection or when delivery disabled
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

    // Get the effective delivery type for the message
    let effectiveDeliveryType = 'Delivery';
    let isPayAtStoreOrder = false;
    
    try {
      const storeDoc = await getDoc(doc(db, 'stores', currentUser.uid));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        effectiveDeliveryType = (orderData && orderData.deliveryType) || 
          (storeData && storeData.deliveryType) || 'Delivery';
          
        // Check if this is a Pay At Store order (Collection + Other payment)
        const storePaymentType = storeData.paymentType || 'Online';
        const orderPaymentType = orderData && orderData.paymentType;
        
        if (effectiveDeliveryType === 'Collection') {
          isPayAtStoreOrder = (orderPaymentType === 'Other') || 
                             (storePaymentType === 'Other' && !orderPaymentType);
        }
        
        // If it's Pay At Store, update the display type
        if (isPayAtStoreOrder) {
          effectiveDeliveryType = 'Pay At Store';
        }
      }
    } catch (error) {
      console.error('Error fetching delivery type for bagged message:', error);
    }

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

    const typeLine = `🚚 Delivery Type: ${effectiveDeliveryType}`;
    
    const baggedMessage = `📦 ITEMS BAGGED

Order ID: ${orderId}

Your order has been prepared and bagged:

${validItems.map(item => 
  `• ${item.itemName} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.subtotal, item.currency)}`
).join('\n')}

${typeLine}
${feeBreakdown || `Total Amount: ${getCurrencySymbol(currency)}${formatPrice(finalTotalAmount, currency)}`}

${isPayAtStoreOrder ? 'Your items are ready for collection. Please come to the store to complete payment and collect your order.' : 'Please proceed with payment to complete your order.'}`;

    try {
      await addDoc(collection(db, 'messages'), {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
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
      conv.storeName?.toLowerCase().includes(search.toLowerCase()) ||
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
                <div className="mobile-back-row mobile-only">
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      setShowStoreItems(false);
                      setShowCart(false);
                    }}
                    className="mobile-back-button"
                  >
                    ← Back to conversations
                  </button>
                </div>
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
                      onClick={async () => {
                        setSelectedConversation(conversation);
                        
                        // Check if current user is blocked from messaging this conversation partner
                        if (currentUser && conversation.otherUserId) {
                          const blockStatus = await checkIfUserBlocked(currentUser.uid, conversation.otherUserId);
                          setUserBlockStatus(blockStatus.isBlocked ? blockStatus : null);
                        }
                        
                        // Handle admin conversation state
                        if (conversation.isAdminChat) {
                          setIsAdminConversation(true);
                          setStoreInfo(null); // Immediately clear store info for admin conversations
                          setShowFormalReportingInfo(false); // Don't auto-show form for existing admin conversations
                          
                          // Clear any store-related data from the conversation object
                          setSelectedConversation(prev => ({
                            ...prev,
                            storeAddress: null,
                            customerAddress: null
                          }));
                        } else {
                          setIsAdminConversation(false);
                          setShowFormalReportingInfo(false);
                        }
                        
                        // Mark unread messages in this conversation as read
                        const unreadMessages = messages.filter(msg => 
                          (msg.senderId === conversation.otherUserId || msg.receiverId === conversation.otherUserId) && 
                          msg.receiverId === currentUser?.uid && 
                          !msg.isRead
                        );
                        console.log('🔔 MessagesPage - Selected conversation:', conversation.otherUserName);
                        console.log('🔔 MessagesPage - Unread messages in conversation:', unreadMessages);
                        if (unreadMessages.length > 0) {
                          const messageIds = unreadMessages.map(msg => msg.id);
                          console.log('🔔 MessagesPage - Marking as read:', messageIds);
                          markMessagesAsRead(messageIds);
                        }
                      }}
                      className={`conversation-item ${selectedConversation?.id === conversation.id ? 'selected' : ''}`}
                    >
                      <div className="conversation-content">
                        <div className="conversation-main">
                          <div className="conversation-name">
                            {isSeller 
                              ? `Customer: ${conversation.otherUserName}` 
                              : (conversation.storeName || conversation.otherUserName)
                            }
                          </div>
                          <div className="conversation-email">
                            {conversation.otherUserEmail && conversation.otherUserEmail !== 'store@example.com' ? conversation.otherUserEmail : ''}
                          </div>
                          <div className="conversation-preview">
                            {conversation.messageType === 'order_request' && '🛒 '}
                            {conversation.messageType === 'pay_at_store_request' && '💳 '}
                            {conversation.messageType === 'pay_at_store_confirmed' && '✅ '}
                            {conversation.messageType === 'pay_at_store_ready' && '📦 '}
                            {conversation.messageType === 'pay_at_store_collection_scheduled' && '📋 '}
                            {conversation.messageType === 'pay_at_store_completed' && '🎉 '}
                            {conversation.messageType === 'order_confirmed_collection' && '📦 '}
                            {conversation.messageType === 'collection_ready' && '✅ '}
                            {conversation.messageType === 'collection_completed' && '🎉 '}
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
                {/* Mobile Back Button - Separate Row */}
                <div className="mobile-back-row mobile-only">
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      setShowStoreItems(false);
                      setShowCart(false);
                    }}
                    className="mobile-back-button"
                  >
                    ← Back
                  </button>
                </div>
                
                <div className="chat-header">
                  <div className="chat-user-info">
                    <div className="chat-user-details">
                      <div className="chat-user-name">
                        {isSeller 
                          ? `Customer: ${selectedConversation.otherUserName}` 
                          : (storeInfo?.storeName || selectedConversation.storeName || selectedConversation.otherUserName || 'Store')
                        }
                      </div>
                      <div className="chat-user-email">
                        {(() => {
                          const email = storeInfo?.email || selectedConversation.otherUserEmail;
                          return (email && email !== 'store@example.com') ? email : '';
                        })()}
                      </div>
                    </div>
                    {!isSeller && selectedConversation.storeAddress && !isAdminConversation && (
                      <div 
                        className="chat-store-address"
                        onClick={() => {
                          const encodedAddress = encodeURIComponent(selectedConversation.storeAddress);
                          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                          window.open(mapsUrl, '_blank');
                        }}
                        style={{
                          color: '#007B7F',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          marginTop: '4px'
                        }}
                      >
                        📍 {selectedConversation.storeAddress}
                      </div>
                    )}
                    {!isSeller && storeInfo?.storeLocation && !selectedConversation.storeAddress && !isAdminConversation && (
                      <div 
                        className="chat-store-address"
                        onClick={() => {
                          const encodedAddress = encodeURIComponent(storeInfo.storeLocation);
                          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                          window.open(mapsUrl, '_blank');
                        }}
                        style={{
                          color: '#007B7F',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          marginTop: '4px'
                        }}
                      >
                        📍 {storeInfo.storeLocation}
                      </div>
                    )}
                    {!isSeller && !selectedConversation.storeAddress && !storeInfo?.storeLocation && storeInfo?.address && !isAdminConversation && (
                      <div 
                        className="chat-store-address"
                        onClick={() => {
                          const encodedAddress = encodeURIComponent(storeInfo.address);
                          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                          window.open(mapsUrl, '_blank');
                        }}
                        style={{
                          color: '#007B7F',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          marginTop: '4px'
                        }}
                      >
                        📍 {storeInfo.address}
                      </div>
                    )}
                    {!isSeller && storeInfo?.phoneNumber && !isAdminConversation && (
                      <div 
                        className="chat-store-phone"
                        onClick={() => {
                          window.open(`tel:${storeInfo.phoneNumber}`, '_self');
                        }}
                        style={{
                          color: '#007B7F',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{storeInfo.phoneType === 'personal' ? '📱' : '📞'}</span>
                        <span>{storeInfo.phoneNumber}</span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                          ({storeInfo.phoneType === 'personal' ? 'Personal' : 'Work'})
                        </span>
                      </div>
                    )}
                    {isSeller && selectedConversation.customerAddress && storeInfo?.deliveryType === 'Delivery' && (
                      <div 
                        className="chat-store-address"
                        onClick={() => {
                          const encodedAddress = encodeURIComponent(selectedConversation.customerAddress);
                          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                          window.open(mapsUrl, '_blank');
                        }}
                        style={{
                          color: '#007B7F',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          marginTop: '4px'
                        }}
                      >
                        🚚 {selectedConversation.customerAddress}
                      </div>
                    )}
                  </div>
                  
                  {!isSeller && (
                    <div className="header-buttons">
                      <button
                        onClick={() => !isOrderLockedForever && setShowStoreItems(!showStoreItems)}
                        className={`browse-items-btn ${showStoreItems ? 'active' : ''} ${isOrderLockedForever ? 'disabled permanently-locked' : orderStatus !== 'shopping' ? 'disabled' : ''}`}
                        disabled={isOrderLockedForever || orderStatus !== 'shopping'}
                        style={{
                          backgroundColor: isOrderLockedForever ? '#d1d5db' : '',
                          color: isOrderLockedForever ? '#6B7280' : '',
                          cursor: isOrderLockedForever ? 'not-allowed' : ''
                        }}
                      >
                        {isOrderLockedForever ? '🔒 Browsing Locked' : showStoreItems ? 'Hide Items' : '🛍️ Browse'}
                        {!isOrderLockedForever && orderStatus !== 'shopping' && ' (Order Finalized)'}
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
                  
                  {isSeller && !isAdminConversation && (
                    <div className="header-buttons">
                      <button
                        onClick={() => setShowBlockRequestModal(true)}
                        className="block-request-btn"
                        style={{
                          backgroundColor: '#EF4444',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.backgroundColor = '#DC2626';
                          e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.backgroundColor = '#EF4444';
                          e.target.style.transform = 'translateY(0)';
                        }}
                      >
                        🚫 Request Block
                      </button>
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
                            <div 
                              className="message-bubble"
                              onTouchStart={(e) => {
                                // Handle mobile long press for deletion (only for own messages)
                                if (message.senderId === currentUser.uid) {
                                  e.target.touchStartTime = Date.now();
                                }
                              }}
                              onTouchEnd={(e) => {
                                // Handle mobile long press for deletion (only for own messages)
                                if (message.senderId === currentUser.uid && e.target.touchStartTime) {
                                  const touchDuration = Date.now() - e.target.touchStartTime;
                                  if (touchDuration > 500) { // 500ms long press
                                    e.preventDefault();
                                    handleMessageLongPress(message.id, message.message);
                                  }
                                }
                              }}
                              style={{
                                cursor: message.senderId === currentUser.uid ? 'pointer' : 'default'
                              }}
                            >
                              <div className="message-content">
                                <div className="message-text" style={
                                  message.messageType === 'id_verification_rejected' ? {
                                    backgroundColor: '#FFEBEE',
                                    border: '2px solid #F44336',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    color: '#D32F2F',
                                    fontWeight: '600'
                                  } : {}
                                }>
                                  {message.message}
                                </div>

                                {/* Display alcohol ID verification for sellers when processing alcohol orders */}
                                {message.messageType === 'order_request' && message.receiverId === currentUser.uid && isSeller && 
                                 message.orderData?.hasAlcoholItems && message.orderData?.items && 
                                 message.orderData.items.some(item => item.alcoholVerification && !item.alcoholVerification.verified && !item.alcoholVerification.rejected) && (
                                  <div className="alcohol-verification-section" style={{
                                    marginTop: '15px',
                                    padding: '15px',
                                    backgroundColor: '#FFF3E0',
                                    border: '2px solid #FF9800',
                                    borderRadius: '8px'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      marginBottom: '12px',
                                      color: '#E65100',
                                      fontWeight: 'bold',
                                      fontSize: '16px'
                                    }}>
                                      🍺 ALCOHOL VERIFICATION REQUIRED
                                    </div>
                                    <div style={{
                                      backgroundColor: 'white',
                                      padding: '12px',
                                      borderRadius: '6px',
                                      border: '1px solid #FFB74D',
                                      marginBottom: '10px'
                                    }}>
                                      <div style={{ color: '#BF360C', fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>
                                        ⚠️ This order contains alcohol items. Please verify customer age before proceeding.
                                      </div>
                                      {message.orderData.items
                                        .filter(item => item.alcoholVerification && !item.alcoholVerification.verified && !item.alcoholVerification.rejected)
                                        .map((item, index) => (
                                          <div key={index} style={{
                                            marginBottom: '15px',
                                            padding: '12px',
                                            backgroundColor: '#FFF8E1',
                                            border: '1px solid #FFC107',
                                            borderRadius: '6px'
                                          }}>
                                            <div style={{
                                              fontWeight: 'bold',
                                              color: '#F57C00',
                                              marginBottom: '8px',
                                              fontSize: '14px'
                                            }}>
                                              🍺 {item.itemName} (x{item.quantity})
                                            </div>
                                            <div style={{
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: '10px'
                                            }}>
                                              <div style={{
                                                padding: '8px',
                                                backgroundColor: 'white',
                                                borderRadius: '4px',
                                                border: '1px solid #FFCC02'
                                              }}>
                                                <div style={{ 
                                                  fontSize: '13px', 
                                                  color: '#E65100', 
                                                  fontWeight: '600',
                                                  marginBottom: '6px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between'
                                                }}>
                                                  📋 Customer ID Verification:
                                                  {item.alcoholVerification?.verified ? (
                                                    <span style={{
                                                      backgroundColor: '#4CAF50',
                                                      color: 'white',
                                                      padding: '2px 6px',
                                                      borderRadius: '4px',
                                                      fontSize: '11px',
                                                      fontWeight: 'bold'
                                                    }}>
                                                      ✅ VERIFIED
                                                    </span>
                                                  ) : item.alcoholVerification?.rejected ? (
                                                    <span style={{
                                                      backgroundColor: '#F44336',
                                                      color: 'white',
                                                      padding: '2px 6px',
                                                      borderRadius: '4px',
                                                      fontSize: '11px',
                                                      fontWeight: 'bold'
                                                    }}>
                                                      ❌ REJECTED
                                                    </span>
                                                  ) : (
                                                    <span style={{
                                                      backgroundColor: '#FF9800',
                                                      color: 'white',
                                                      padding: '2px 6px',
                                                      borderRadius: '4px',
                                                      fontSize: '11px',
                                                      fontWeight: 'bold'
                                                    }}>
                                                      ⏳ PENDING
                                                    </span>
                                                  )}
                                                </div>
                                                {item.alcoholVerification.idImageUrl ? (
                                                  <div>
                                                    <img 
                                                      src={item.alcoholVerification.idImageUrl}
                                                      alt="Customer ID"
                                                      style={{
                                                        maxWidth: '200px',
                                                        maxHeight: '150px',
                                                        width: 'auto',
                                                        height: 'auto',
                                                        borderRadius: '4px',
                                                        border: '2px solid #FF9800',
                                                        cursor: 'pointer',
                                                        objectFit: 'contain'
                                                      }}
                                                      onClick={() => window.open(item.alcoholVerification.idImageUrl, '_blank')}
                                                    />
                                                    <div style={{
                                                      fontSize: '12px',
                                                      color: '#666',
                                                      marginTop: '4px'
                                                    }}>
                                                      Uploaded: {item.alcoholVerification.timestamp ? 
                                                        new Date(item.alcoholVerification.timestamp.toDate()).toLocaleString() : 
                                                        'Recently'}
                                                    </div>
                                                    <div style={{
                                                      fontSize: '12px',
                                                      color: '#E65100',
                                                      fontWeight: '600',
                                                      marginTop: '6px'
                                                    }}>
                                                      👆 Click image to view full size
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div style={{
                                                    color: '#D32F2F',
                                                    fontSize: '13px',
                                                    fontWeight: '600'
                                                  }}>
                                                    ❌ No ID verification found
                                                  </div>
                                                )}
                                              </div>
                                              
                                              {/* Age Verification Buttons - only show if not yet verified or rejected */}
                                              {!item.alcoholVerification?.verified && !item.alcoholVerification?.rejected && (
                                                <div style={{
                                                  display: 'flex',
                                                  gap: '8px',
                                                  marginTop: '10px'
                                                }}>
                                                <button
                                                  onClick={async () => {
                                                    // Handle ID verification approval
                                                    const confirmation = window.confirm(
                                                      `Are you sure the customer is 18+ years old based on their ID?\n\nThis confirms age verification for: ${item.itemName}`
                                                    );
                                                    if (confirmation) {
                                                      try {
                                                        // Find and update the ID verification record in Firestore
                                                        const idVerificationQuery = query(
                                                          collection(db, 'alcoholIdVerifications'),
                                                          where('buyerId', '==', message.senderId),
                                                          where('storeId', '==', currentUser.uid),
                                                          where('itemId', '==', item.itemId)
                                                        );
                                                        
                                                        const querySnapshot = await getDocs(idVerificationQuery);
                                                        
                                                        if (!querySnapshot.empty) {
                                                          const verificationDoc = querySnapshot.docs[0];
                                                          await updateDoc(verificationDoc.ref, {
                                                            verified: true,
                                                            verifiedAt: serverTimestamp(),
                                                            verifiedBy: currentUser.uid
                                                          });
                                                          
                                                          // Update the Firebase message document to reflect verification
                                                          const messageRef = doc(db, 'messages', message.id);
                                                          const now = new Date();
                                                          const updatedOrderData = {
                                                            ...message.orderData,
                                                            items: message.orderData.items.map(msgItem => 
                                                              msgItem.itemId === item.itemId ? {
                                                                ...msgItem,
                                                                alcoholVerification: {
                                                                  ...msgItem.alcoholVerification,
                                                                  verified: true,
                                                                  verifiedAt: now,
                                                                  verifiedBy: currentUser.uid
                                                                }
                                                              } : msgItem
                                                            )
                                                          };
                                                          
                                                          await updateDoc(messageRef, {
                                                            orderData: updatedOrderData
                                                          });
                                                          
                                                          // Update the local message state to reflect verification
                                                          item.alcoholVerification.verified = true;
                                                          
                                                          // Force component re-render by updating messages state
                                                          setMessages(prevMessages => 
                                                            prevMessages.map(msg => 
                                                              msg.id === message.id ? {
                                                                ...msg,
                                                                orderData: {
                                                                  ...msg.orderData,
                                                                  items: msg.orderData.items.map(msgItem => 
                                                                    msgItem.itemId === item.itemId ? {
                                                                      ...msgItem,
                                                                      alcoholVerification: {
                                                                        ...msgItem.alcoholVerification,
                                                                        verified: true,
                                                                        verifiedAt: new Date(),
                                                                        verifiedBy: currentUser.uid
                                                                      }
                                                                    } : msgItem
                                                                  )
                                                                }
                                                              } : msg
                                                            )
                                                          );
                                                          
                                                          // Show seller confirmation modal
                                                          const reminderModal = document.createElement('div');
                                                          reminderModal.style.cssText = `
                                                            position: fixed;
                                                            top: 0;
                                                            left: 0;
                                                            right: 0;
                                                            bottom: 0;
                                                            background-color: rgba(0, 0, 0, 0.5);
                                                            display: flex;
                                                            justify-content: center;
                                                            align-items: center;
                                                            z-index: 10000;
                                                          `;
                                                          
                                                          const closeModal = () => {
                                                            document.body.removeChild(reminderModal);
                                                            // Force a re-render to update button states
                                                            setMessages(prevMessages => [...prevMessages]);
                                                          };
                                                          
                                                          reminderModal.innerHTML = `
                                                            <div style="
                                                              background-color: white;
                                                              border-radius: 12px;
                                                              padding: 24px;
                                                              max-width: 400px;
                                                              width: 90%;
                                                              box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                                                              text-align: center;
                                                            ">
                                                              <div style="
                                                                font-size: 48px;
                                                                margin-bottom: 16px;
                                                              ">✅</div>
                                                              <h2 style="
                                                                color: #4CAF50;
                                                                font-size: 20px;
                                                                font-weight: bold;
                                                                margin: 0 0 16px 0;
                                                              ">ID Verification Approved!</h2>
                                                              <div style="
                                                                background-color: #FFF3E0;
                                                                border: 2px solid #FF9800;
                                                                border-radius: 8px;
                                                                padding: 16px;
                                                                margin-bottom: 20px;
                                                              ">
                                                                <div style="
                                                                  color: #E65100;
                                                                  font-weight: bold;
                                                                  font-size: 16px;
                                                                  margin-bottom: 8px;
                                                                ">🆔 IMPORTANT REMINDER</div>
                                                                <div style="
                                                                  color: #BF360C;
                                                                  font-size: 14px;
                                                                  line-height: 1.5;
                                                                ">
                                                                  <strong>Make sure to ask for ID when meeting this buyer!</strong>
                                                                  <br><br>
                                                                  Even though you've verified their uploaded ID, you must still check their physical ID in person to ensure it matches and confirm they are 18+ years old.
                                                                </div>
                                                              </div>
                                                              <button id="modalCloseBtn" style="
                                                                background-color: #4CAF50;
                                                                color: white;
                                                                border: none;
                                                                padding: 12px 24px;
                                                                border-radius: 6px;
                                                                font-size: 14px;
                                                                font-weight: bold;
                                                                cursor: pointer;
                                                              ">✅ I Understand</button>
                                                            </div>
                                                          `;
                                                          
                                                          document.body.appendChild(reminderModal);
                                                          
                                                          // Add event listener to close button
                                                          reminderModal.querySelector('#modalCloseBtn').addEventListener('click', closeModal);
                                                        } else {
                                                          alert('❌ Error: ID verification record not found.');
                                                        }
                                                      } catch (error) {
                                                        console.error('Error updating verification:', error);
                                                        alert('❌ Error updating verification. Please try again.');
                                                      }
                                                    }
                                                  }}
                                                  style={{
                                                    backgroundColor: '#4CAF50',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 12px',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    flex: '1',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px'
                                                  }}
                                                >
                                                  ✅ Verify 18+
                                                </button>
                                                <button
                                                  onClick={async () => {
                                                    // Handle ID verification rejection
                                                    const reason = window.prompt(
                                                      "Please provide a reason for rejecting this ID verification:"
                                                    );
                                                    if (reason && reason.trim()) {
                                                      try {
                                                        // Find and update the ID verification record in Firestore
                                                        const idVerificationQuery = query(
                                                          collection(db, 'alcoholIdVerifications'),
                                                          where('buyerId', '==', message.senderId),
                                                          where('storeId', '==', currentUser.uid),
                                                          where('itemId', '==', item.itemId)
                                                        );
                                                        
                                                        const querySnapshot = await getDocs(idVerificationQuery);
                                                        
                                                        if (!querySnapshot.empty) {
                                                          const verificationDoc = querySnapshot.docs[0];
                                                          await updateDoc(verificationDoc.ref, {
                                                            verified: false,
                                                            rejected: true,
                                                            rejectionReason: reason,
                                                            rejectedAt: serverTimestamp(),
                                                            rejectedBy: currentUser.uid
                                                          });
                                                          
                                                          // Calculate new order total without alcohol items
                                                          const nonAlcoholItems = message.orderData.items.filter(orderItem => 
                                                            orderItem.itemId !== item.itemId
                                                          );
                                                          
                                                          const newSubtotal = nonAlcoholItems.reduce((sum, orderItem) => 
                                                            sum + (orderItem.price * orderItem.quantity), 0
                                                          );
                                                          const newTotalAmount = newSubtotal + (message.orderData.deliveryFee || 0) + (message.orderData.serviceFee || 0);
                                                          
                                                          // Prepare notification message
                                                          const hasOtherItems = nonAlcoholItems.length > 0;
                                                          let notificationMessage = `🚫 ALCOHOL ID VERIFICATION REJECTED\n\nItem Removed: ${item.itemName}\nReason: ${reason}\n\n`;
                                                          
                                                          if (hasOtherItems) {
                                                            const remainingItemsList = nonAlcoholItems.map(orderItem => 
                                                              `• ${orderItem.itemName} x${orderItem.quantity} - ${message.orderData.currency || '£'}${(orderItem.price * orderItem.quantity).toFixed(2)}`
                                                            ).join('\n');
                                                            
                                                            notificationMessage += `✅ GOOD NEWS: Your other items can still be ordered!\n\n📦 REMAINING ITEMS:\n${remainingItemsList}\n\n💰 UPDATED TOTAL: ${message.orderData.currency || '£'}${newTotalAmount.toFixed(2)}\n\nYou can proceed with the remaining items in your order. The alcohol item has been removed due to ID verification issues.`;
                                                          } else {
                                                            notificationMessage += `❌ Unfortunately, this was the only item in your order, so the entire order has been cancelled.\n\nPlease provide valid ID verification if you wish to purchase alcohol items, or browse our other non-alcohol products.`;
                                                          }
                                                          
                                                          // Send notification message to buyer about rejection
                                                          const conversationId = [currentUser.uid, message.senderId].sort().join('_');
                                                          await addDoc(collection(db, 'messages'), {
                                                            conversationId: conversationId,
                                                            senderId: currentUser.uid,
                                                            senderName: 'Store',
                                                            receiverId: message.senderId,
                                                            receiverName: message.senderName,
                                                            message: notificationMessage,
                                                            timestamp: serverTimestamp(),
                                                            isRead: false,
                                                            messageType: 'id_verification_rejected',
                                                            orderData: hasOtherItems ? {
                                                              ...message.orderData,
                                                              items: nonAlcoholItems,
                                                              subtotal: newSubtotal,
                                                              totalAmount: newTotalAmount,
                                                              alcoholItemRemoved: true,
                                                              removedItem: item.itemName
                                                            } : null
                                                          });
                                                          
                                                          // Update the Firebase message document to reflect rejection
                                                          const messageRef = doc(db, 'messages', message.id);
                                                          const now = new Date();
                                                          const updatedOrderData = {
                                                            ...message.orderData,
                                                            items: message.orderData.items.map(msgItem => 
                                                              msgItem.itemId === item.itemId ? {
                                                                ...msgItem,
                                                                alcoholVerification: {
                                                                  ...msgItem.alcoholVerification,
                                                                  rejected: true,
                                                                  rejectionReason: reason,
                                                                  rejectedAt: now,
                                                                  rejectedBy: currentUser.uid
                                                                }
                                                              } : msgItem
                                                            )
                                                          };
                                                          
                                                          await updateDoc(messageRef, {
                                                            orderData: updatedOrderData
                                                          });
                                                          
                                                          // Update the local message state to reflect rejection
                                                          item.alcoholVerification.rejected = true;
                                                          item.alcoholVerification.rejectionReason = reason;
                                                          
                                                          // Force component re-render by updating messages state
                                                          setMessages(prevMessages => 
                                                            prevMessages.map(msg => 
                                                              msg.id === message.id ? {
                                                                ...msg,
                                                                orderData: {
                                                                  ...msg.orderData,
                                                                  items: msg.orderData.items.map(msgItem => 
                                                                    msgItem.itemId === item.itemId ? {
                                                                      ...msgItem,
                                                                      alcoholVerification: {
                                                                        ...msgItem.alcoholVerification,
                                                                        rejected: true,
                                                                        rejectionReason: reason,
                                                                        rejectedAt: new Date(),
                                                                        rejectedBy: currentUser.uid
                                                                      }
                                                                    } : msgItem
                                                                  )
                                                                }
                                                              } : msg
                                                            )
                                                          );
                                                          
                                                          alert(`❌ ID verification rejected. Reason: ${reason}\n\nThe customer has been notified. ${hasOtherItems ? 'They can still proceed with their other items.' : 'The order has been cancelled as it only contained the rejected alcohol item.'}`);
                                                        } else {
                                                          alert('❌ Error: ID verification record not found.');
                                                        }
                                                      } catch (error) {
                                                        console.error('Error rejecting verification:', error);
                                                        alert('❌ Error processing rejection. Please try again.');
                                                      }
                                                    }
                                                  }}
                                                  style={{
                                                    backgroundColor: '#F44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 12px',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    flex: '1',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px'
                                                  }}
                                                >
                                                  ❌ Reject ID
                                                </button>
                                                </div>
                                              )}
                                              
                                              {/* Show rejection reason if ID was rejected */}
                                              {item.alcoholVerification?.rejected && (
                                                <div style={{
                                                  backgroundColor: '#FFEBEE',
                                                  border: '1px solid #F44336',
                                                  padding: '8px',
                                                  borderRadius: '4px',
                                                  fontSize: '12px',
                                                  color: '#D32F2F',
                                                  fontWeight: '600',
                                                  marginTop: '8px'
                                                }}>
                                                  ❌ Rejection Reason: {item.alcoholVerification.rejectionReason}
                                                </div>
                                              )}
                                              
                                              <div style={{
                                                backgroundColor: '#FFE0B2',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                color: '#BF360C',
                                                fontWeight: '600',
                                                textAlign: 'center',
                                                marginTop: '8px'
                                              }}>
                                                🔍 Please verify the customer is 18+ before confirming this order
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      }
                                    </div>
                                  </div>
                                )}
                                
                                {/* Don't render image attachments here - they'll be shown after the buttons */}
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="message-attachments" style={{ marginTop: '12px' }}>
                                    {message.attachments.map((attachment, index) => (
                                      <div key={index} className="attachment">
                                        {attachment.type !== 'image' && (
                                          <div className="file-attachment">
                                            <a 
                                              href={attachment.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="attachment-link"
                                              style={{
                                                color: '#007bff',
                                                textDecoration: 'none',
                                                padding: '8px 12px',
                                                border: '1px solid #007bff',
                                                borderRadius: '4px',
                                                display: 'inline-block',
                                                marginTop: '10px'
                                              }}
                                            >
                                              📎 {attachment.name || 'Download File'}
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Desktop delete button - only show on larger screens */}
                                {message.senderId === currentUser.uid && (
                                  <button
                                    onClick={() => deleteMessage(message.id)}
                                    className="delete-message-btn desktop-only"
                                    title="Delete message"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                              
                              {/* Show order completion section when all alcohol items are verified - positioned after the message */}
                              {message.messageType === 'order_request' && message.receiverId === currentUser.uid && isSeller && 
                               message.orderData?.hasAlcoholItems && message.orderData?.items && 
                               message.orderData.items.filter(item => item.alcoholVerification).every(item => item.alcoholVerification.verified || item.alcoholVerification.rejected) &&
                               message.orderData.items.some(item => item.alcoholVerification && item.alcoholVerification.verified) && (
                                <div className="alcohol-completion-section" style={{
                                  marginTop: '15px',
                                  marginBottom: '10px',
                                  padding: '20px',
                                  backgroundColor: '#E8F5E8',
                                  border: '2px solid #4CAF50',
                                  borderRadius: '12px',
                                  boxShadow: '0 2px 8px rgba(76, 175, 80, 0.1)'
                                }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    marginBottom: '15px',
                                    color: '#2E7D32',
                                    fontWeight: 'bold',
                                    fontSize: '18px'
                                  }}>
                                    ✅ ALCOHOL VERIFICATION COMPLETE
                                  </div>
                                  <div style={{
                                    backgroundColor: 'white',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    border: '1px solid #81C784',
                                    marginBottom: '15px',
                                    textAlign: 'center'
                                  }}>
                                    <div style={{ color: '#2E7D32', fontWeight: '600', fontSize: '16px', marginBottom: '10px' }}>
                                      🎉 Age verification completed! You can now proceed with this order.
                                    </div>
                                    <div style={{ color: '#388E3C', fontSize: '14px', marginBottom: '15px' }}>
                                      Remember to check the customer's physical ID when they arrive for pickup/delivery.
                                    </div>
                                    
                                    {/* Show verified items */}
                                    {message.orderData.items.filter(item => item.alcoholVerification && item.alcoholVerification.verified).length > 0 && (
                                      <div style={{
                                        backgroundColor: '#F1F8E9',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        marginBottom: '12px'
                                      }}>
                                        <div style={{ color: '#2E7D32', fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>
                                          ✅ Verified Alcohol Items:
                                        </div>
                                        {message.orderData.items
                                          .filter(item => item.alcoholVerification && item.alcoholVerification.verified)
                                          .map((item, index) => (
                                            <div key={index} style={{
                                              color: '#388E3C',
                                              fontSize: '13px',
                                              marginBottom: '4px',
                                              fontWeight: '500'
                                            }}>
                                              🍺 {item.itemName} x{item.quantity}
                                            </div>
                                          ))
                                        }
                                      </div>
                                    )}
                                    
                                    {/* Show rejected items if any */}
                                    {message.orderData.items.filter(item => item.alcoholVerification && item.alcoholVerification.rejected).length > 0 && (
                                      <div style={{
                                        backgroundColor: '#FFEBEE',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        marginBottom: '12px'
                                      }}>
                                        <div style={{ color: '#D32F2F', fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>
                                          ❌ Rejected Items (removed from order):
                                        </div>
                                        {message.orderData.items
                                          .filter(item => item.alcoholVerification && item.alcoholVerification.rejected)
                                          .map((item, index) => (
                                            <div key={index} style={{
                                              color: '#F44336',
                                              fontSize: '13px',
                                              marginBottom: '4px',
                                              fontWeight: '500'
                                            }}>
                                              🚫 {item.itemName} x{item.quantity}
                                            </div>
                                          ))
                                        }
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Special handling for ID verification rejection messages */}
                              {message.messageType === 'id_verification_rejected' && message.receiverId === currentUser.uid && !isSeller && (
                                <div className="message-actions">
                                  <div style={{
                                    backgroundColor: '#FFEBEE',
                                    border: '1px solid #F44336',
                                    borderRadius: '6px',
                                    padding: '12px',
                                    marginBottom: '10px',
                                    textAlign: 'center'
                                  }}>
                                    <div style={{
                                      color: '#D32F2F',
                                      fontWeight: 'bold',
                                      fontSize: '14px',
                                      marginBottom: '8px'
                                    }}>
                                      🚫 Alcohol ID Verification Failed
                                    </div>
                                    {message.orderData ? (
                                      <div style={{
                                        color: '#4CAF50',
                                        fontSize: '13px',
                                        fontWeight: '600'
                                      }}>
                                        ✅ You can still proceed with your other items!
                                      </div>
                                    ) : (
                                      <div style={{
                                        color: '#F44336',
                                        fontSize: '13px',
                                        fontWeight: '600'
                                      }}>
                                        ❌ This order has been cancelled
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button
                                      onClick={() => {
                                        alert('Thank you for acknowledging. You can continue browsing or contact the store if you have questions about the ID verification process.');
                                      }}
                                      style={{
                                        backgroundColor: '#2196F3',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        flex: '1'
                                      }}
                                    >
                                      👍 I Understand
                                    </button>
                                    
                                    {message.orderData && (
                                      <button
                                        onClick={() => {
                                          // Here we could implement order continuation logic
                                          alert('Great! You can continue with your remaining items. The order total has been updated to remove the alcohol item.');
                                        }}
                                        style={{
                                          backgroundColor: '#4CAF50',
                                          color: 'white',
                                          border: 'none',
                                          padding: '8px 16px',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          flex: '1'
                                        }}
                                      >
                                        ✅ Continue with Other Items
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Special handling for order workflow messages */}
                              {message.messageType === 'order_request' && message.senderId === currentUser.uid && !isSeller && !isOrderLockedForever && (
                                <div className="message-actions">
                                  {/* Show alcohol verification status for customer */}
                                  {message.orderData?.hasAlcoholItems && message.orderData?.items && (
                                    <div style={{
                                      backgroundColor: (() => {
                                        const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                        const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                        const allVerified = alcoholItems.every(item => item.alcoholVerification?.verified);
                                        const hasPending = alcoholItems.some(item => !item.alcoholVerification?.verified && !item.alcoholVerification?.rejected);
                                        
                                        if (hasRejected) return '#FFEBEE';
                                        if (allVerified) return '#E8F5E8';
                                        if (hasPending) return '#FFF3E0';
                                        return '#FFF3E0';
                                      })(),
                                      border: (() => {
                                        const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                        const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                        const allVerified = alcoholItems.every(item => item.alcoholVerification?.verified);
                                        
                                        if (hasRejected) return '2px solid #F44336';
                                        if (allVerified) return '2px solid #4CAF50';
                                        return '2px solid #FF9800';
                                      })(),
                                      borderRadius: '8px',
                                      padding: '12px',
                                      marginBottom: '12px',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      textAlign: 'center'
                                    }}>
                                      {(() => {
                                        const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                        const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                        const allVerified = alcoholItems.every(item => item.alcoholVerification?.verified);
                                        const hasPending = alcoholItems.some(item => !item.alcoholVerification?.verified && !item.alcoholVerification?.rejected);
                                        
                                        if (hasRejected) {
                                          return (
                                            <div style={{ color: '#D32F2F' }}>
                                              ❌ <strong>Order cancelled due to rejected ID verification</strong>
                                              <br/>
                                              <span style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                                Some alcohol items were rejected. Please provide valid ID or remove alcohol items from your order.
                                              </span>
                                            </div>
                                          );
                                        }
                                        if (allVerified) {
                                          return (
                                            <div style={{ color: '#2E7D32' }}>
                                              ✅ <strong>All alcohol IDs verified!</strong>
                                              <br/>
                                              <span style={{ fontSize: '12px', marginTop: '4px', display: 'block', lineHeight: '1.4' }}>
                                                You can now finalize your order. <strong>📋 Important:</strong> The seller will check your physical ID when you arrive, so please remember to bring it with you for verification.
                                              </span>
                                            </div>
                                          );
                                        }
                                        if (hasPending) {
                                          return (
                                            <div style={{ color: '#E65100' }}>
                                              ⏳ <strong>Waiting for seller to verify your alcohol ID</strong>
                                              <br/>
                                              <span style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                                Please wait while the seller reviews your ID verification. You cannot finalize your order until verification is complete.
                                              </span>
                                            </div>
                                          );
                                        }
                                        return '';
                                      })()}
                                    </div>
                                  )}
                                  
                                  {/* Additional reminder for verified alcohol orders */}
                                  {message.orderData?.hasAlcoholItems && message.orderData?.items && 
                                   message.orderData.items.filter(item => item.alcoholVerification).every(item => item.alcoholVerification?.verified) && (
                                    <div style={{
                                      backgroundColor: '#E3F2FD',
                                      border: '2px solid #2196F3',
                                      borderRadius: '8px',
                                      padding: '12px',
                                      marginBottom: '12px',
                                      fontSize: '13px',
                                      textAlign: 'center'
                                    }}>
                                      <div style={{ 
                                        color: '#1976D2', 
                                        fontWeight: 'bold', 
                                        marginBottom: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                      }}>
                                        🆔 BRING YOUR PHYSICAL ID
                                      </div>
                                      <div style={{ 
                                        color: '#1565C0', 
                                        fontSize: '12px', 
                                        lineHeight: '1.4' 
                                      }}>
                                        The seller will verify your physical ID matches the uploaded image when you collect your order. This is required by law for alcohol purchases.
                                      </div>
                                    </div>
                                  )}
                                  
                                  <button
                                    onClick={(event) => {
                                      // Check alcohol verification status before proceeding
                                      if (message.orderData?.hasAlcoholItems && message.orderData?.items) {
                                        const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                        const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                        const hasPending = alcoholItems.some(item => !item.alcoholVerification?.verified && !item.alcoholVerification?.rejected);
                                        
                                        if (hasRejected) {
                                          alert('❌ Cannot finalize order!\n\nSome alcohol items have been rejected due to ID verification issues. Your order has been cancelled for these items.\n\nPlease provide valid ID verification or remove alcohol items to proceed.');
                                          return;
                                        }
                                        
                                        if (hasPending) {
                                          alert('⏳ Cannot finalize order yet!\n\nPlease wait for the seller to verify your alcohol ID before finalizing your order.\n\nThis ensures compliance with age verification requirements.');
                                          return;
                                        }
                                      }
                                      
                                      // Add temporary visual feedback by fading the button
                                      const btn = event.currentTarget;
                                      btn.style.opacity = '0.5';
                                      btn.style.backgroundColor = '#d1d5db';
                                      btn.style.cursor = 'not-allowed';
                                      btn.disabled = true;
                                      btn.textContent = '✅ Processing...';
                                      
                                      // Process the action
                                      signalDoneAddingFromMessage(message.orderData);
                                    }}
                                    className={`action-btn done-message-btn ${isOrderLockedForever ? 'disabled' : ''}`}
                                    disabled={(() => {
                                      if (isOrderLockedForever) return true;
                                      
                                      // Disable if there are alcohol items that need verification
                                      if (message.orderData?.hasAlcoholItems && message.orderData?.items) {
                                        const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                        const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                        const hasPending = alcoholItems.some(item => !item.alcoholVerification?.verified && !item.alcoholVerification?.rejected);
                                        
                                        return hasRejected || hasPending;
                                      }
                                      
                                      return false;
                                    })()}
                                    style={{
                                      backgroundColor: (() => {
                                        if (isOrderLockedForever) return '#d1d5db';
                                        
                                        if (message.orderData?.hasAlcoholItems && message.orderData?.items) {
                                          const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                          const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                          const hasPending = alcoholItems.some(item => !item.alcoholVerification?.verified && !item.alcoholVerification?.rejected);
                                          
                                          if (hasRejected) return '#F44336';
                                          if (hasPending) return '#FF9800';
                                        }
                                        
                                        return '#10B981';
                                      })(),
                                      color: (() => {
                                        if (isOrderLockedForever) return '#6B7280';
                                        
                                        if (message.orderData?.hasAlcoholItems && message.orderData?.items) {
                                          const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                          const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                          const hasPending = alcoholItems.some(item => !item.alcoholVerification?.verified && !item.alcoholVerification?.rejected);
                                          
                                          if (hasRejected || hasPending) return 'white';
                                        }
                                        
                                        return 'white';
                                      })(),
                                      cursor: (() => {
                                        if (isOrderLockedForever) return 'not-allowed';
                                        
                                        if (message.orderData?.hasAlcoholItems && message.orderData?.items) {
                                          const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                          const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                          const hasPending = alcoholItems.some(item => !item.alcoholVerification?.verified && !item.alcoholVerification?.rejected);
                                          
                                          if (hasRejected || hasPending) return 'not-allowed';
                                        }
                                        
                                        return 'pointer';
                                      })(),
                                      opacity: (() => {
                                        if (isOrderLockedForever) return 0.7;
                                        
                                        if (message.orderData?.hasAlcoholItems && message.orderData?.items) {
                                          const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                          const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                          const hasPending = alcoholItems.some(item => !item.alcoholVerification?.verified && !item.alcoholVerification?.rejected);
                                          
                                          if (hasRejected || hasPending) return 0.8;
                                        }
                                        
                                        return 1;
                                      })(),
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    {(() => {
                                      if (isOrderLockedForever) return '✅ Order Finalized';
                                      
                                      if (message.orderData?.hasAlcoholItems && message.orderData?.items) {
                                        const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                        const hasRejected = alcoholItems.some(item => item.alcoholVerification?.rejected);
                                        const hasPending = alcoholItems.some(item => !item.alcoholVerification?.verified && !item.alcoholVerification?.rejected);
                                        
                                        if (hasRejected) return '❌ Order Cancelled';
                                        if (hasPending) return '⏳ Awaiting ID Verification';
                                      }
                                      
                                      return '✅ Done Adding Items';
                                    })()}
                                  </button>
                                </div>
                              )}

                              {/* Seller handles order requests for Collection */}
                              {message.messageType === 'order_request' && message.receiverId === currentUser.uid && isSeller && message.orderData?.deliveryType === 'Collection' && (
                                <div className="message-actions">
                                  {message.orderData?.hasAlcoholItems && (
                                    <div style={{
                                      backgroundColor: message.orderData.items
                                        .filter(item => item.alcoholVerification)
                                        .every(item => item.alcoholVerification?.verified) ? '#E8F5E8' : '#FFF3E0',
                                      border: `1px solid ${message.orderData.items
                                        .filter(item => item.alcoholVerification)
                                        .every(item => item.alcoholVerification?.verified) ? '#4CAF50' : '#FF9800'}`,
                                      borderRadius: '4px',
                                      padding: '8px',
                                      marginBottom: '10px',
                                      fontSize: '12px',
                                      color: message.orderData.items
                                        .filter(item => item.alcoholVerification)
                                        .every(item => item.alcoholVerification?.verified) ? '#2E7D32' : '#E65100',
                                      fontWeight: '600',
                                      textAlign: 'center'
                                    }}>
                                      {message.orderData.items
                                        .filter(item => item.alcoholVerification)
                                        .every(item => item.alcoholVerification?.verified) 
                                        ? '✅ All alcohol IDs verified! You can now confirm this order.' 
                                        : '⚠️ Please verify all alcohol IDs above before confirming this order'}
                                    </div>
                                  )}
                                  <button
                                    onClick={(event) => {
                                      // Check if order contains alcohol and if verification is needed
                                      if (message.orderData?.hasAlcoholItems) {
                                        // Check if all alcohol items have been verified
                                        const alcoholItems = message.orderData.items.filter(item => item.alcoholVerification);
                                        const unverifiedItems = alcoholItems.filter(item => !item.alcoholVerification?.verified);
                                        
                                        if (unverifiedItems.length > 0) {
                                          alert(`⚠️ Cannot confirm order!\n\nPlease verify the customer's age for all alcohol items first. You must click "✅ Verify 18+" for each alcohol item before confirming the order.\n\nUnverified items: ${unverifiedItems.map(item => item.itemName).join(', ')}`);
                                          return;
                                        }
                                      }
                                      
                                      // Apply permanent fade-out effect
                                      const btn = event.currentTarget;
                                      btn.style.opacity = '0.3';
                                      btn.style.backgroundColor = '#d1d5db';
                                      btn.style.cursor = 'not-allowed';
                                      btn.disabled = true;
                                      btn.textContent = '✓ Confirmed';
                                      
                                      // Process the action
                                      confirmOrderForCollection(message.orderData);
                                    }}
                                    className="action-btn confirm-collection-btn"
                                    style={{
                                      backgroundColor: '#10B981',
                                      color: 'white',
                                      marginRight: '8px',
                                      transition: 'all 0.3s ease'
                                    }}
                                  >
                                    ✅ Confirm Order (Collection)
                                  </button>
                                </div>
                              )}

                              {/* Seller handles Pay At Store order requests */}
                              {message.messageType === 'pay_at_store_request' && message.receiverId === currentUser.uid && isSeller && (
                                <div className="message-actions">
                                  <button
                                    onClick={() => confirmPayAtStoreOrder(message.orderData)}
                                    className="action-btn confirm-pay-at-store-btn"
                                    style={{
                                      backgroundColor: '#059669',
                                      color: 'white',
                                      marginRight: '8px'
                                    }}
                                  >
                                    ✅ Confirm Pay At Store Order
                                  </button>
                                </div>
                              )}

                              {/* Seller handles customer coming to pay notification */}
                              {message.messageType === 'customer_coming_to_pay' && message.receiverId === currentUser.uid && isSeller && (
                                <div className="message-actions">
                                  <button
                                    onClick={() => {
                                      // Use existing wallet validation system
                                      const enteredCode = prompt(
                                        `🎫 PICKUP CODE VERIFICATION\n\nTo confirm payment and collection, please enter the pickup code provided by the customer:\n\nOrder ID: ${message.orderData.orderId}\nAmount: ${getCurrencySymbol(message.orderData.currency)}${formatPrice(message.orderData.totalAmount, message.orderData.currency)}\n\nThis will validate through your wallet system.`
                                      );

                                      if (enteredCode) {
                                        // Use the existing validatePickupCode function which integrates with wallet
                                        validatePickupCode(enteredCode);
                                      }
                                    }}
                                    className="action-btn confirm-payment-btn"
                                    style={{
                                      backgroundColor: '#059669',
                                      color: 'white'
                                    }}
                                  >
                                    🎫 Verify Code & Confirm Payment
                                  </button>
                                </div>
                              )}

                              {/* Seller options after confirming Pay At Store order */}
                              {message.messageType === 'pay_at_store_confirmed' && message.senderId === currentUser.uid && isSeller && (
                                <div className="message-actions">
                                  <button
                                    onClick={(event) => {
                                      // Add temporary visual feedback by fading the button
                                      const btn = event.currentTarget;
                                      btn.style.opacity = '0.3';
                                      btn.style.backgroundColor = '#d1d5db';
                                      btn.style.cursor = 'not-allowed';
                                      btn.disabled = true;
                                      btn.textContent = '✓ Order Ready';
                                      
                                      // Process the action
                                      markPayAtStoreReady(message.orderData);
                                    }}
                                    className="action-btn ready-pay-at-store-btn"
                                    style={{
                                      backgroundColor: '#0891b2',
                                      color: 'white',
                                      transition: 'all 0.3s ease'
                                    }}
                                  >
                                    📦 Mark Ready for Collection
                                  </button>
                                </div>
                              )}

                              {/* Customer options for confirmed Pay At Store order */}
                              {message.messageType === 'pay_at_store_confirmed' && message.receiverId === currentUser.uid && !isSeller && (
                                <div className="message-actions">
                                  <div className="pay-at-store-info">
                                    💳 <strong>Pay At Store Order</strong> - Pay when you collect
                                  </div>
                                  <div className="pay-at-store-actions">
                                    <button 
                                      className="action-btn schedule-collection-btn"
                                      onClick={() => {
                                        setSelectedOrderForDelivery(message.orderData);
                                        setShowCollectionModal(true);
                                      }}
                                    >
                                      📋 Schedule Collection Time
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Seller can complete Pay At Store transaction when ready */}
                              {message.messageType === 'pay_at_store_ready' && message.senderId === currentUser.uid && isSeller && (
                                <div className="message-actions">
                                  <button
                                    onClick={() => completePayAtStoreTransaction(message.orderData)}
                                    className="action-btn complete-pay-at-store-btn"
                                    style={{
                                      backgroundColor: '#dc2626',
                                      color: 'white'
                                    }}
                                  >
                                    ✅ Complete Transaction (Payment Received)
                                  </button>
                                </div>
                              )}

                              {/* Pay At Store collection scheduled message */}
                              {message.messageType === 'pay_at_store_collection_scheduled' && (
                                <div className="message-actions">
                                  <div className="collection-status-info">
                                    📋 <strong>Pay At Store Collection Scheduled</strong>
                                    <div style={{ marginTop: '8px', fontSize: '14px' }}>
                                      ⏰ Time: <strong>{message.orderData?.collectionTime}</strong>
                                      <br />
                                      💳 Payment: <strong>Pay at store when collecting</strong>
                                    </div>
                                  </div>
                                  
                                  {/* Only show reschedule button for the customer */}
                                  {message.receiverId === currentUser.uid && !isSeller && (
                                    <div style={{ marginTop: '10px' }}>
                                      <button 
                                        className="action-btn schedule-collection-btn"
                                        onClick={() => {
                                          setSelectedOrderForDelivery(message.orderData);
                                          setShowCollectionModal(true);
                                        }}
                                        disabled={isOrderMarkedReady(message.orderData?.orderId)}
                                        style={{
                                          opacity: isOrderMarkedReady(message.orderData?.orderId) ? '0.3' : '1',
                                          cursor: isOrderMarkedReady(message.orderData?.orderId) ? 'not-allowed' : 'pointer',
                                          backgroundColor: isOrderMarkedReady(message.orderData?.orderId) ? '#d1d5db' : ''
                                        }}
                                      >
                                        {isOrderMarkedReady(message.orderData?.orderId) ? '✓ Order Ready' : '📋 Reschedule Collection'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Pay At Store transaction completed status */}
                              {message.messageType === 'pay_at_store_completed' && (
                                <div className="message-actions">
                                  <div className="collection-status-info">
                                    ✅ <strong>Pay At Store Transaction Completed</strong> - Payment received and order collected
                                  </div>
                                </div>
                              )}

                              {/* Collection orders are handled elsewhere with different buttons */}
                              {/* Delivery orders use immediate delivery workflow - no scheduling modal needed */}
                              
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
                                  {(isPayAtStoreOrderSync(message.orderData) || 
                                    (message.message && message.message.includes('Pay At Store'))) ? (
                                    // Pay At Store button - sends notification to seller
                                    <button 
                                      className={`action-btn payment-btn ${hasCustomerNotifiedComing(message.orderData?.orderId) || isPayAtStoreCompleted(message.orderData?.orderId) ? 'disabled' : ''}`}
                                      disabled={hasCustomerNotifiedComing(message.orderData?.orderId) || isPayAtStoreCompleted(message.orderData?.orderId)}
                                      onClick={async () => {
                                        if (hasCustomerNotifiedComing(message.orderData?.orderId) || isPayAtStoreCompleted(message.orderData?.orderId)) {
                                          return;
                                        }

                                        try {
                                          const conversationId = selectedConversation.id || 
                                            [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

                                          // Generate pickup code for Pay At Store orders
                                          const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                                          // Send message to seller that customer is coming to pay
                                          const customerComingMessage = `💳 CUSTOMER COMING TO PAY AT STORE

Order ID: ${message.orderData.orderId}

🚶‍♂️ Customer has confirmed they are coming to the store to pay and collect their order.

📦 ORDER DETAILS:
${message.orderData.items.map(item => 
  `• ${item.itemName || item.name} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.subtotal, item.currency)}`
).join('\n')}

💰 TOTAL TO COLLECT: ${getCurrencySymbol(message.orderData.currency)}${formatPrice(message.orderData.totalAmount, message.orderData.currency)}

🎫 CUSTOMER PICKUP CODE: ${pickupCode}

⚠️ IMPORTANT: Verify the pickup code before handing over items and accepting payment.

Please have the order ready for collection and payment.`;

                                          await addDoc(collection(db, 'messages'), {
                                            conversationId: conversationId,
                                            senderId: currentUser.uid,
                                            senderName: currentUser.displayName || currentUser.email,
                                            senderEmail: currentUser.email,
                                            receiverId: selectedConversation.otherUserId,
                                            receiverName: selectedConversation.otherUserName,
                                            message: customerComingMessage,
                                            timestamp: serverTimestamp(),
                                            isRead: false,
                                            messageType: 'customer_coming_to_pay',
                                            orderData: {
                                              ...message.orderData,
                                              pickupCode: pickupCode
                                            }
                                          });

                                          // Send pickup code to customer
                                          const customerCodeMessage = `🎫 YOUR PICKUP CODE

Order ID: ${message.orderData.orderId}

Your pickup code is: ${pickupCode}

💡 IMPORTANT: Present this code to the seller when you arrive at the store to pay and collect your order.

📍 Please bring this code and your payment method to complete the transaction.`;

                                          await addDoc(collection(db, 'messages'), {
                                            conversationId: conversationId,
                                            senderId: currentUser.uid,
                                            senderName: currentUser.displayName || currentUser.email,
                                            senderEmail: currentUser.email,
                                            receiverId: currentUser.uid,
                                            receiverName: currentUser.displayName || currentUser.email,
                                            message: customerCodeMessage,
                                            timestamp: serverTimestamp(),
                                            isRead: true,
                                            messageType: 'pickup_code_generated',
                                            orderData: {
                                              ...message.orderData,
                                              pickupCode: pickupCode
                                            }
                                          });

                                          // Create transaction record for wallet validation
                                          await addDoc(collection(db, 'transactions'), {
                                            sellerId: selectedConversation.otherUserId,
                                            orderId: message.orderData.orderId,
                                            customerId: currentUser.uid,
                                            customerName: currentUser.displayName || currentUser.email,
                                            type: 'pay_at_store',
                                            amount: message.orderData.totalAmount,
                                            currency: message.orderData.currency,
                                            paymentMethod: 'pay_at_store',
                                            description: `Pay At Store: ${message.orderData.items?.map(item => item.itemName || item.name).join(', ') || 'Order items'}`,
                                            status: 'pending_payment',
                                            pickupCode: pickupCode,
                                            pickupStatus: 'pending',
                                            createdAt: serverTimestamp(),
                                            timestamp: serverTimestamp()
                                          });

                                          // Show confirmation to customer
                                          const notification = document.createElement('div');
                                          notification.innerHTML = `✅ Seller notified! Your pickup code: ${pickupCode}<br>Please bring this code to the store to pay and collect your order.`;
                                          notification.style.cssText = `
                                            position: fixed;
                                            top: 20px;
                                            right: 20px;
                                            background: #10B981;
                                            color: white;
                                            padding: 1rem;
                                            border-radius: 8px;
                                            z-index: 1000;
                                            font-weight: 600;
                                            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                                            max-width: 300px;
                                          `;
                                          document.body.appendChild(notification);
                                          
                                          setTimeout(() => {
                                            if (document.body.contains(notification)) {
                                              document.body.removeChild(notification);
                                            }
                                          }, 8000);

                                        } catch (error) {
                                          console.error('Error notifying seller:', error);
                                          alert('Failed to notify seller. Please try again.');
                                        }
                                      }}
                                      style={{
                                        backgroundColor: hasCustomerNotifiedComing(message.orderData?.orderId) || isPayAtStoreCompleted(message.orderData?.orderId) ? '#d1d5db' : '#10B981',
                                        color: hasCustomerNotifiedComing(message.orderData?.orderId) || isPayAtStoreCompleted(message.orderData?.orderId) ? '#6B7280' : 'white',
                                        cursor: hasCustomerNotifiedComing(message.orderData?.orderId) || isPayAtStoreCompleted(message.orderData?.orderId) ? 'not-allowed' : 'pointer',
                                        opacity: hasCustomerNotifiedComing(message.orderData?.orderId) || isPayAtStoreCompleted(message.orderData?.orderId) ? 0.7 : 1
                                      }}
                                    >
                                      {isPayAtStoreCompleted(message.orderData?.orderId) ? '✅ Payment Completed' : 
                                       hasCustomerNotifiedComing(message.orderData?.orderId) ? '📞 Seller Notified' : '🏪 Pay At Store'}
                                    </button>
                                  ) : (
                                    // Regular payment button for Delivery and Collection orders
                                    <button 
                                      className={`action-btn payment-btn ${isOrderPaid(message.orderData?.orderId) ? 'disabled' : ''}`}
                                      onClick={() => !isOrderPaid(message.orderData?.orderId) && openPaymentModal(message.orderData)}
                                      disabled={isOrderPaid(message.orderData?.orderId)}
                                      style={{
                                        backgroundColor: isOrderPaid(message.orderData?.orderId) ? '#d1d5db' : '#10B981',
                                        color: isOrderPaid(message.orderData?.orderId) ? '#6B7280' : 'white',
                                        cursor: isOrderPaid(message.orderData?.orderId) ? 'not-allowed' : 'pointer',
                                        opacity: isOrderPaid(message.orderData?.orderId) ? 0.7 : 1
                                      }}
                                    >
                                      {isOrderPaid(message.orderData?.orderId) ? '✅ Payment Completed' : '💳 Proceed to Payment'}
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Bank Transfer Verification Button */}
                              {message.messageType === 'bank_transfer_submitted' && message.receiverId === currentUser?.uid && isSeller && (
                                <div className="message-actions">
                                  <button
                                    onClick={async () => {
                                      const verified = window.confirm(
                                        `🏦 VERIFY BANK TRANSFER\n\n` +
                                        `Have you received the payment of ${getCurrencySymbol(message.paymentData.currency)}${formatPrice(message.paymentData.amount, message.paymentData.currency)} ` +
                                        `from ${message.senderName}?\n\n` +
                                        `Reference: ${message.paymentData.bankTransferInfo.referenceNumber}\n` +
                                        `Bank: ${message.paymentData.bankTransferInfo.fromBank}\n\n` +
                                        `Click OK only if you have confirmed the payment in your bank account.`
                                      );

                                      if (verified) {
                                        try {
                                          // Handle payments without ID by using custom reference
                                          let paymentId = message.paymentData.id;
                                          
                                          // If no ID exists, try to use the stripePaymentIntentId or another reference
                                          if (!paymentId) {
                                            if (message.paymentData.stripePaymentIntentId) {
                                              // Try to find the payment document using stripePaymentIntentId as a query
                                              const paymentsRef = collection(db, 'payments');
                                              const q = query(paymentsRef, where('stripePaymentIntentId', '==', message.paymentData.stripePaymentIntentId));
                                              const querySnapshot = await getDocs(q);
                                              
                                              if (!querySnapshot.empty) {
                                                // Use the first matching document
                                                paymentId = querySnapshot.docs[0].id;
                                                console.log('Found payment using stripePaymentIntentId reference:', paymentId);
                                              }
                                            }
                                          }
                                          
                                          // If we still don't have an ID, create a new payment record
                                          if (!paymentId) {
                                            console.log('Creating new payment record for verification', message.paymentData);
                                            // Create a new payment document with the message payment data
                                            const newPaymentRef = await addDoc(collection(db, 'payments'), {
                                              ...message.paymentData,
                                              status: 'completed',
                                              verifiedAt: serverTimestamp(),
                                              verifiedBy: currentUser.uid,
                                              createdFromMessage: true
                                            });
                                            paymentId = newPaymentRef.id;
                                          }
                                          
                                          // Update payment status
                                          const paymentDoc = doc(db, 'payments', paymentId);
                                          await updateDoc(paymentDoc, {
                                            status: 'completed',
                                            verifiedAt: serverTimestamp(),
                                            verifiedBy: currentUser.uid
                                          });

                                          // Send verification message
                                          const verificationMessage = {
                                            conversationId: message.conversationId,
                                            senderId: currentUser.uid,
                                            senderName: currentUser.displayName || currentUser.email,
                                            receiverId: message.senderId,
                                            receiverName: message.senderName,
                                            message: `✅ BANK TRANSFER VERIFIED\n\nYour payment has been verified by the seller.\n\nAmount: ${getCurrencySymbol(message.paymentData.currency)}${formatPrice(message.paymentData.amount, message.paymentData.currency)}\nReference: ${message.paymentData.bankTransferInfo.referenceNumber}\n\n🎫 PICKUP CODE: ${message.paymentData.pickupCode}\n\nPlease provide this code when collecting your order.`,
                                            messageType: 'bank_transfer_verified',
                                            timestamp: serverTimestamp(),
                                            paymentData: message.paymentData
                                          };

                                          await addDoc(collection(db, 'messages'), verificationMessage);
                                          alert('Payment verified successfully! The customer has been notified.');
                                        } catch (error) {
                                          console.error('Error verifying payment:', error);
                                          alert('Failed to verify payment. Please try again.');
                                        }
                                      }
                                    }}
                                    className="action-btn verify-payment-btn"
                                    style={{
                                      backgroundColor: '#059669',
                                      color: 'white'
                                    }}
                                  >
                                    ✅ Verify Bank Transfer
                                  </button>
                                </div>
                              )}

                              {/* Delivery buttons for sellers after payment notification - DELIVERY ONLY */}
                              {message.messageType === 'payment_notification' && message.receiverId === currentUser?.uid && isSeller && 
                               message.paymentData?.deliveryType === 'Delivery' && (
                                <div className="message-actions">
                                  <button 
                                    className={`action-btn deliver-btn ${isDeliveryInProgress(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) || isDeliveryCompleted(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) ? 'disabled' : ''}`}
                                    disabled={isDeliveryInProgress(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) || isDeliveryCompleted(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId)}
                                    onClick={() => {
                                      // Get complete order data for delivery
                                      const orderDataForDelivery = message.orderData || {
                                        orderId: message.paymentData?.displayInfo?.orderId || message.paymentData?.orderId,
                                        items: message.paymentData?.items || [],
                                        totalAmount: message.paymentData?.total || message.paymentData?.amount,
                                        currency: message.paymentData?.currency || 'GBP',
                                        deliveryType: 'Delivery'
                                      };
                                      startDelivery(orderDataForDelivery);
                                    }}
                                  >
                                    {isDeliveryInProgress(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) ? '🚚 Delivery in Progress' : 
                                     isDeliveryCompleted(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) ? '✅ Delivered' : '🚚 Deliver Now'}
                                  </button>
                                </div>
                              )}

                              {/* Collection buttons for sellers after payment notification - COLLECTION ONLY */}
                              {message.messageType === 'payment_notification' && message.receiverId === currentUser?.uid && isSeller && 
                               message.paymentData?.deliveryType === 'Collection' && (
                                <div className="message-actions">
                                  <button
                                    onClick={(event) => {
                                      // Add temporary visual feedback by fading the button
                                      const btn = event.currentTarget;
                                      btn.style.opacity = '0.3';
                                      btn.style.backgroundColor = '#d1d5db';
                                      btn.style.cursor = 'not-allowed';
                                      btn.disabled = true;
                                      btn.textContent = '✓ Order Ready';
                                      
                                      // Process the action
                                      const orderDataForCollection = {
                                        orderId: message.paymentData?.displayInfo?.orderId || message.paymentData?.orderId,
                                        items: message.paymentData?.items || [],
                                        totalAmount: message.paymentData?.total || message.paymentData?.amount,
                                        currency: message.paymentData?.currency || 'GBP',
                                        deliveryType: 'Collection',
                                        pickupCode: message.paymentData?.pickupCode
                                      };
                                      markReadyForCollection(orderDataForCollection);
                                    }}
                                    className="action-btn ready-collection-btn"
                                    style={{
                                      backgroundColor: '#10B981',
                                      color: 'white',
                                      transition: 'all 0.3s ease'
                                    }}
                                  >
                                    📦 Mark Ready for Collection
                                  </button>
                                </div>
                              )}

                              {/* Seller options after payment for Collection orders */}
                              {message.messageType === 'payment_completed' && message.receiverId === currentUser.uid && isSeller && 
                               message.paymentData?.deliveryType === 'Collection' && (
                                <div className="message-actions">
                                  <button
                                    onClick={(event) => {
                                      // Add temporary visual feedback by fading the button
                                      const btn = event.currentTarget;
                                      btn.style.opacity = '0.3';
                                      btn.style.backgroundColor = '#d1d5db';
                                      btn.style.cursor = 'not-allowed';
                                      btn.disabled = true;
                                      btn.textContent = '✓ Order Ready';
                                      
                                      // Process the action
                                      const orderDataForCollection = {
                                        orderId: message.paymentData?.displayInfo?.orderId || message.paymentData?.orderId,
                                        items: message.paymentData?.items || [],
                                        totalAmount: message.paymentData?.total || message.paymentData?.amount,
                                        currency: message.paymentData?.currency || 'GBP',
                                        deliveryType: 'Collection',
                                        pickupCode: message.paymentData?.pickupCode
                                      };
                                      markReadyForCollection(orderDataForCollection);
                                    }}
                                    className="action-btn ready-collection-btn"
                                    style={{
                                      backgroundColor: '#10B981',
                                      color: 'white',
                                      transition: 'all 0.3s ease'
                                    }}
                                  >
                                    📦 Mark Ready for Collection
                                  </button>
                                </div>
                              )}

                              {/* Seller options after payment for Delivery orders */}
                              {message.messageType === 'payment_completed' && message.receiverId === currentUser.uid && isSeller && 
                               message.paymentData?.deliveryType === 'Delivery' && 
                               !isDeliveryInProgress(message.paymentData?.orderId) && !isDeliveryCompleted(message.paymentData?.orderId) && (
                                <div className="message-actions">
                                  <button
                                    onClick={() => {
                                      // Get complete order data for delivery
                                      const orderDataForDelivery = message.orderData || {
                                        orderId: message.paymentData?.displayInfo?.orderId || message.paymentData?.orderId,
                                        items: message.paymentData?.items || [],
                                        totalAmount: message.paymentData?.total || message.paymentData?.amount,
                                        currency: message.paymentData?.currency || 'GBP',
                                        deliveryType: 'Delivery'
                                      };
                                      startDelivery(orderDataForDelivery);
                                    }}
                                  >
                                    {isDeliveryInProgress(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) ? '🚚 Delivery in Progress' : 
                                     isDeliveryCompleted(message.orderData?.orderId || message.paymentData?.displayInfo?.orderId) ? '✅ Delivered' : '🚚 Deliver Now'}
                                  </button>
                                </div>
                              )}

                              {/* Customer collection status for Collection orders */}
                              {message.messageType === 'payment_completed' && message.senderId === currentUser.uid && !isSeller && 
                               message.paymentData?.deliveryType === 'Collection' && (
                                <div className="message-actions">
                                  <div className="collection-status-info">
                                    🏪 <strong>Collection Order</strong> - Bring your pickup code to the store
                                  </div>
                                  <div className="collection-actions">
                                    <button 
                                      className="action-btn schedule-collection-btn"
                                      onClick={() => openCollectionModal(message.paymentData)}
                                      disabled={isOrderMarkedReady(message.paymentData?.orderId)}
                                      style={{
                                        opacity: isOrderMarkedReady(message.paymentData?.orderId) ? '0.3' : '1',
                                        cursor: isOrderMarkedReady(message.paymentData?.orderId) ? 'not-allowed' : 'pointer',
                                        backgroundColor: isOrderMarkedReady(message.paymentData?.orderId) ? '#d1d5db' : ''
                                      }}
                                    >
                                      {isOrderMarkedReady(message.paymentData?.orderId) ? '✓ Order Ready' : '📋 Reschedule Collection'}
                                    </button>
                                    {storeRefundsEnabled && (
                                      <button 
                                        className="action-btn refund-btn"
                                        onClick={() => requestRefund(message.paymentData)}
                                        disabled={isRefundRequested(message.paymentData?.orderId)}
                                      >
                                        {isRefundRequested(message.paymentData?.orderId) ? '❌ Refund Requested' : '❌ Cancel & Request Refund'}
                                      </button>
                                    )}
                                    {!storeRefundsEnabled && (
                                      <div className="refund-disabled-notice">
                                        ℹ️ This store does not offer refunds
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Delivery scheduling for customers after payment completion - only show if delivery not started */}
                              {message.messageType === 'payment_completed' && message.senderId === currentUser.uid && !isSeller && 
                               message.paymentData?.deliveryType === 'Delivery' &&
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
                                      disabled={isOrderMarkedReady(message.paymentData?.orderId)}
                                      style={{
                                        opacity: isOrderMarkedReady(message.paymentData?.orderId) ? '0.3' : '1',
                                        cursor: isOrderMarkedReady(message.paymentData?.orderId) ? 'not-allowed' : 'pointer',
                                        backgroundColor: isOrderMarkedReady(message.paymentData?.orderId) ? '#d1d5db' : ''
                                      }}
                                    >
                                      {isOrderMarkedReady(message.paymentData?.orderId) ? '✓ Order Ready' : '📋 Reschedule Delivery'}
                                    </button>
                                    {storeRefundsEnabled && (
                                      <button 
                                        className="action-btn refund-btn"
                                        onClick={() => requestRefund(message.paymentData)}
                                        disabled={isRefundRequested(message.paymentData?.orderId)}
                                      >
                                        {isRefundRequested(message.paymentData?.orderId) ? '❌ Refund Requested' : '❌ Cancel & Request Refund'}
                                      </button>
                                    )}
                                    {!storeRefundsEnabled && (
                                      <div className="refund-disabled-notice">
                                        ℹ️ This store does not offer refunds
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Receipt offer message - for customers to generate receipt */}
                              {message.messageType === 'receipt_offer' && message.receiverId === currentUser.uid && !isSeller && (
                                <div className="message-actions">
                                  <div style={{ marginBottom: '12px', fontSize: '15px', fontWeight: '500' }}>
                                    Would you like a receipt for this order?
                                  </div>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                      onClick={() => handleReceiptAction('generate_receipt', message.orderData)}
                                      style={{
                                        backgroundColor: '#059669',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '8px 16px',
                                        fontWeight: '500',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      ✅ Yes, generate receipt
                                    </button>
                                    <button
                                      onClick={() => handleReceiptAction('decline_receipt', message.orderData)}
                                      style={{
                                        backgroundColor: '#6B7280',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '8px 16px',
                                        fontWeight: '500',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      ❌ No, thanks
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Receipt generated message - confirmation for customers */}
                              {message.messageType === 'receipt_generated' && (
                                <div className="message-actions">
                                  <div style={{ 
                                    padding: '10px 15px',
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #86efac',
                                    borderRadius: '6px',
                                    marginTop: '8px' 
                                  }}>
                                    <p style={{ margin: '0', fontWeight: '500', color: '#15803d' }}>
                                      ✅ Receipt generated successfully!
                                    </p>
                                    <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#166534' }}>
                                      You can find this receipt in your Receipts page for future reference.
                                    </p>
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
                                        {storeRefundsEnabled && (
                                          <button 
                                            className="action-btn refund-btn"
                                            onClick={() => requestRefund(message.orderData)}
                                            disabled={isRefundRequested(message.orderData?.orderId)}
                                          >
                                            {isRefundRequested(message.orderData?.orderId) ? '❌ Refund Requested' : '❌ Cancel & Request Refund'}
                                          </button>
                                        )}
                                        {!storeRefundsEnabled && (
                                          <div className="refund-disabled-notice">
                                            ℹ️ This store does not offer refunds
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Complete delivery button for sellers when delivery is in progress and not cancelled - DELIVERY ONLY */}
                              {message.messageType === 'delivery_started' && message.senderId === currentUser.uid && isSeller && 
                               message.orderData?.deliveryType === 'Delivery' &&
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

                              {/* Deliver Now button for scheduled deliveries - DELIVERY ORDERS ONLY */}
                              {(message.messageType === 'delivery_scheduled' || message.messageType === 'delivery_rescheduled') && 
                               isSeller && message.orderData?.deliveryType === 'Delivery' && (
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

                              {/* Collection ready message - seller can validate pickup code */}
                              {message.messageType === 'collection_ready' && message.receiverId === currentUser.uid && !isSeller && (
                                <div className="message-actions">
                                  <div className="collection-status-info">
                                    📦 <strong>Ready for Collection</strong> - Your order is ready at the store
                                    <div style={{ marginTop: '8px', fontSize: '14px' }}>
                                      🎫 Pickup Code: <strong>{message.orderData?.pickupCode}</strong>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Validate pickup code button for sellers */}
                              {message.messageType === 'collection_ready' && message.senderId === currentUser.uid && isSeller && (
                                <div className="message-actions">
                                  <button
                                    onClick={() => {
                                      setActiveTab('wallet');
                                    }}
                                    className="action-btn validate-pickup-btn"
                                    style={{
                                      backgroundColor: '#059669',
                                      color: 'white'
                                    }}
                                  >
                                    ✅ Validate Pickup Code
                                  </button>
                                </div>
                              )}

                              {/* Collection completed status */}
                              {message.messageType === 'collection_completed' && (
                                <div className="message-actions">
                                  <div className="collection-status-info">
                                    ✅ <strong>Collection Completed</strong> - Order successfully collected
                                  </div>
                                </div>
                              )}

                              {/* Collection scheduled message - show collection details */}
                              {message.messageType === 'collection_scheduled' && (
                                <div className="message-actions">
                                  <div className="collection-status-info">
                                    📋 <strong>Collection Scheduled</strong>
                                    <div style={{ marginTop: '8px', fontSize: '14px' }}>
                                      ⏰ Time: <strong>{message.orderData?.collectionTime}</strong>
                                      <br />
                                      💰 Collection Fee: <strong>{getCurrencySymbol(message.orderData?.currency || 'GBP')}{formatPrice(message.orderData?.collectionFee || 0, message.orderData?.currency || 'GBP')}</strong>
                                      <br />
                                      💳 New Total: <strong>{getCurrencySymbol(message.orderData?.currency || 'GBP')}{formatPrice(message.orderData?.newTotal || 0, message.orderData?.currency || 'GBP')}</strong>
                                    </div>
                                  </div>
                                  
                                  {/* Only show buttons for the recipient customer */}
                                  {message.receiverId === currentUser.uid && !isSeller && (
                                    <div style={{ marginTop: '10px' }}>
                                      <button 
                                        className="action-btn schedule-collection-btn"
                                        onClick={() => openCollectionModal(message.orderData)}
                                        style={{ 
                                          marginRight: '8px',
                                          opacity: isOrderMarkedReady(message.orderData?.orderId) ? '0.3' : '1',
                                          cursor: isOrderMarkedReady(message.orderData?.orderId) ? 'not-allowed' : 'pointer',
                                          backgroundColor: isOrderMarkedReady(message.orderData?.orderId) ? '#d1d5db' : ''
                                        }}
                                        disabled={isOrderMarkedReady(message.orderData?.orderId)}
                                      >
                                        {isOrderMarkedReady(message.orderData?.orderId) ? '✓ Order Ready' : '📋 Reschedule Collection'}
                                      </button>
                                      {storeRefundsEnabled && (
                                        <button 
                                          className="action-btn refund-btn"
                                          onClick={() => requestRefund(message.orderData)}
                                          disabled={isRefundRequested(message.orderData?.orderId)}
                                        >
                                          {isRefundRequested(message.orderData?.orderId) ? '❌ Refund Requested' : '❌ Cancel Collection'}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Ready for collection message - customer sees pickup notification */}
                              {message.messageType === 'ready_for_collection' && message.receiverId === currentUser.uid && !isSeller && (
                                <div className="message-actions">
                                  <div className="collection-status-info">
                                    📦 <strong>Ready for Collection</strong> - Your order is ready!
                                    <div style={{ marginTop: '8px', fontSize: '14px' }}>
                                      🏪 Please collect at your scheduled time: <strong>{message.orderData?.collectionTime || 'as arranged'}</strong>
                                      <br />
                                      🎫 Bring your pickup code: <strong>{message.orderData?.pickupCode}</strong>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Validate collection pickup for sellers */}
                              {message.messageType === 'ready_for_collection' && message.senderId === currentUser.uid && isSeller && (
                                <div className="message-actions">
                                  <button
                                    onClick={(event) => {
                                      // Add permanent visual feedback by fading the button
                                      const btn = event.currentTarget;
                                      btn.style.opacity = '0.3';
                                      btn.style.backgroundColor = '#d1d5db';
                                      btn.style.cursor = 'not-allowed';
                                      btn.disabled = true;
                                      btn.textContent = '✓ Collection Completed';
                                      
                                      // Store this order ID in our completed collections state
                                      if (message.orderData?.orderId && !completedCollections.includes(message.orderData.orderId)) {
                                        const updatedCompletions = [...completedCollections, message.orderData.orderId];
                                        setCompletedCollections(updatedCompletions);
                                        localStorage.setItem('completedCollectionOrders', JSON.stringify(updatedCompletions));
                                      }
                                      
                                      // Prompt for pickup code and validate
                                      const pickupCode = prompt('Please enter the pickup code provided by the customer:');
                                      if (pickupCode) {
                                        validatePickupCode(pickupCode);
                                      }
                                      // Don't reset the button even if canceled - keep it faded out
                                    }}
                                    // Check if this order has been completed before
                                    disabled={message.orderData?.orderId && completedCollections.includes(message.orderData.orderId)}
                                    className="action-btn validate-pickup-btn"
                                    style={{
                                      backgroundColor: message.orderData?.orderId && completedCollections.includes(message.orderData.orderId)
                                        ? '#d1d5db' : '#059669',
                                      color: 'white',
                                      transition: 'all 0.3s ease',
                                      opacity: message.orderData?.orderId && completedCollections.includes(message.orderData.orderId)
                                        ? '0.3' : '1',
                                      cursor: message.orderData?.orderId && completedCollections.includes(message.orderData.orderId)
                                        ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    {message.orderData?.orderId && completedCollections.includes(message.orderData.orderId)
                                      ? '✓ Collection Completed' : '✅ Complete Collection'}
                                  </button>
                                </div>
                              )}

                              {/* Refund approval buttons for sellers when they receive refund requests */}
                              {message.messageType === 'refund_requested' && message.receiverId === currentUser?.uid && isSeller && (
                                <div className="message-actions">
                                  <div className="refund-request-header">
                                    <strong>🔄 Refund Request</strong>
                                    <div className="refund-details">
                                      {message.refundData?.reason && (
                                        <div className="refund-reason">
                                          <strong>Reason:</strong> {message.refundData.reason}
                                        </div>
                                      )}
                                      {message.refundData?.details && (
                                        <div className="refund-details-text">
                                          <strong>Details:</strong> {message.refundData.details}
                                        </div>
                                      )}
                                      <div className="refund-amount">
                                        <strong>Amount:</strong> {getCurrencySymbol(message.refundData?.currency || 'GBP')}{formatPrice(message.refundData?.amount || 0, message.refundData?.currency || 'GBP')}
                                      </div>
                                      <div className="refund-payment-method">
                                        <strong>Payment Method:</strong> {
                                          message.refundData?.paymentMethod === 'card' ? '💳 Card Payment' :
                                          message.refundData?.paymentMethod === 'google_pay' ? '📱 Google Pay' :
                                          message.refundData?.paymentMethod === 'apple_pay' ? '🍎 Apple Pay' :
                                          message.refundData?.paymentMethod === 'bank_transfer' ? '🏦 Bank Transfer' :
                                          '❓ Unknown'
                                        }
                                      </div>
                                      {message.refundData?.requiresStripeRefund ? (
                                        <div className="refund-note">
                                          <p><strong>💳 Automatic Refund:</strong> This payment will be automatically refunded to the customer's payment method. Refunds typically appear within 2-5 business days depending on the customer's bank.</p>
                                        </div>
                                      ) : (
                                        <div className="refund-note">
                                          <p><strong>🏦 Manual Refund Required:</strong> This was paid by bank transfer. You will need to send the refund manually from your bank account to the customer.</p>
                                        </div>
                                      )}
                                    </div>
                                    <div className="refund-actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                      <button 
                                        onClick={() => {
                                          const refundData = message.refundData || message.orderData || {};
                                          // Ensure we have a valid refund object with required fields
                                          const safeRefundData = {
                                            ...refundData,
                                            refundReason: refundData.refundReason || refundData.reason || 'Not specified',
                                            orderId: refundData.orderId || 'Unknown',
                                            currency: refundData.currency || 'GBP'
                                          };
                                          const amount = message.refundData?.amount || message.orderData?.totalAmount || 0;
                                          approveRefund(safeRefundData, amount);
                                        }}
                                        style={{
                                          backgroundColor: '#22C55E',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          padding: '8px 16px',
                                          cursor: 'pointer',
                                          fontWeight: 'bold',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '5px'
                                        }}
                                      >
                                        <span>{'\u2713'}</span> Approve Refund
                                      </button>
                                      <button
                                        onClick={() => {
                                          // Create a custom dialog for detailed denial reason
                                          const dialogOverlay = document.createElement('div');
                                          dialogOverlay.className = 'custom-dialog-overlay';
                                          dialogOverlay.style.cssText = `
                                            position: fixed;
                                            top: 0;
                                            left: 0;
                                            right: 0;
                                            bottom: 0;
                                            background-color: rgba(0, 0, 0, 0.5);
                                            display: flex;
                                            justify-content: center;
                                            align-items: center;
                                            z-index: 1000;
                                          `;
                                          
                                          const dialogContent = document.createElement('div');
                                          dialogContent.className = 'custom-dialog';
                                          dialogContent.style.cssText = `
                                            background-color: white;
                                            border-radius: 8px;
                                            padding: 24px;
                                            width: 500px;
                                            max-width: 90%;
                                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                                          `;
                                          
                                          dialogContent.innerHTML = `
                                            <h2 style="margin-top: 0; color: #EF4444; font-size: 18px;">Deny Refund Request</h2>
                                            <p style="margin-bottom: 20px;">Please provide a detailed reason for denying this refund request. This explanation will be sent to the customer.</p>
                                            
                                            <div style="margin-bottom: 15px;">
                                              <label style="display: block; margin-bottom: 8px; font-weight: bold;">Denial Reason Category:</label>
                                              <select id="denialReasonCategory" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
                                                <option value="">Select a category...</option>
                                                <option value="Outside return window">Outside return window</option>
                                                <option value="Product was used/damaged">Product was used/damaged</option>
                                                <option value="No valid reason provided">No valid reason provided</option>
                                                <option value="Against store policy">Against store policy</option>
                                                <option value="Customer error">Customer error</option>
                                                <option value="Duplicate request">Duplicate request</option>
                                                <option value="Other">Other</option>
                                              </select>
                                            </div>
                                            
                                            <div style="margin-bottom: 20px;">
                                              <label style="display: block; margin-bottom: 8px; font-weight: bold;">Detailed Explanation:</label>
                                              <textarea id="denialReasonDetails" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db; min-height: 100px;" placeholder="Please provide specific details about why this refund is being denied..."></textarea>
                                            </div>
                                            
                                            <div style="margin-bottom: 15px; padding: 10px; background-color: #FEF2F2; border-radius: 4px; border: 1px solid #FECACA;">
                                              <p style="margin: 0; color: #B91C1C;"><strong>Note:</strong> The customer will be able to appeal this decision with admin support.</p>
                                            </div>
                                            
                                            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                                              <button id="cancelDenial" style="padding: 8px 16px; border-radius: 4px; border: 1px solid #d1d5db; background-color: white; cursor: pointer;">Cancel</button>
                                              <button id="confirmDenial" style="padding: 8px 16px; border-radius: 4px; border: none; background-color: #EF4444; color: white; cursor: pointer; font-weight: bold;">Deny Refund</button>
                                            </div>
                                          `;
                                          
                                          dialogOverlay.appendChild(dialogContent);
                                          document.body.appendChild(dialogOverlay);
                                          
                                          // Handle dialog interactions
                                          document.getElementById('cancelDenial').addEventListener('click', () => {
                                            document.body.removeChild(dialogOverlay);
                                          });
                                          
                                          document.getElementById('confirmDenial').addEventListener('click', () => {
                                            const category = document.getElementById('denialReasonCategory').value;
                                            const details = document.getElementById('denialReasonDetails').value;
                                            
                                            if (!category) {
                                              alert('Please select a reason category.');
                                              return;
                                            }
                                            
                                            if (!details.trim()) {
                                              alert('Please provide detailed explanation for the denial.');
                                              return;
                                            }
                                            
                                            // Format the full denial reason
                                            const fullReason = `${category}: ${details}`;
                                            
                                            const refundData = message.refundData || message.orderData || {};
                                            // Ensure we have a valid refund object with required fields
                                            const safeRefundData = {
                                              ...refundData,
                                              refundReason: refundData.refundReason || refundData.reason || 'Not specified',
                                              orderId: refundData.orderId || 'Unknown',
                                              currency: refundData.currency || 'GBP'
                                            };
                                            
                                            // Remove the dialog
                                            document.body.removeChild(dialogOverlay);
                                            
                                            // Process the refund denial
                                            denyRefund(safeRefundData, fullReason);
                                          });
                                        }}
                                        style={{
                                          backgroundColor: '#EF4444',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          padding: '8px 16px',
                                          cursor: 'pointer',
                                          fontWeight: 'bold',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '5px'
                                        }}
                                      >
                                        <span>{'\u2717'}</span> Deny Refund
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Refund Transfer Confirmation button for sellers on manual refund notices */}
                              {message.messageType === 'manual_refund_notice' && message.receiverId === currentUser?.uid && isSeller && message.orderData?.awaitingTransferConfirmation && (
                                <div className="message-actions">
                                  <div className="refund-transfer-notice">
                                    <strong>🏦 Manual Refund Required</strong>
                                    <div className="refund-details">
                                      <div className="refund-amount">
                                        <strong>Amount:</strong> {getCurrencySymbol(message.orderData?.currency || 'GBP')}{formatPrice(message.orderData?.refundAmount || 0, message.orderData?.currency || 'GBP')}
                                      </div>
                                      <div className="refund-customer">
                                        <strong>Customer:</strong> {
                                          message.orderData?.customerName || 
                                          message.refundData?.customerName || 
                                          selectedConversation?.otherUserName || 
                                          'Unknown Customer'
                                        }
                                      </div>
                                      <div className="refund-instructions">
                                        <p><strong>📋 Instructions:</strong></p>
                                        <p>1. Transfer the refund amount to the customer's bank account</p>
                                        <p>2. Take a screenshot of the transfer confirmation</p>
                                        <p>3. Click "Refund Transferred" and attach the screenshot</p>
                                      </div>
                                    </div>
                                    <button 
                                      className="action-btn transfer-confirm-btn"
                                      onClick={() => openRefundTransferModal(message.orderData)}
                                      style={{
                                        backgroundColor: '#10B981',
                                        color: 'white',
                                        border: 'none',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        width: '100%',
                                        marginTop: '12px'
                                      }}
                                    >
                                      📸 Refund Transferred (Attach Screenshot)
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Refund approval/complaint buttons for customers on refund transfer confirmations */}
                              {message.messageType === 'refund_transfer_confirmed' && (
                                <div className="message-actions">
                                  <div className="refund-approval-section">
                                    <div className="approval-header">
                                      <strong>💰 Please confirm your refund receipt:</strong>
                                    </div>
                                    <div className="approval-info">
                                      <p>Expected Amount: <strong>{getCurrencySymbol(message.orderData?.currency || 'GBP')}{formatPrice(message.orderData?.amount || 0, message.orderData?.currency || 'GBP')}</strong></p>
                                      <p>Have you received the correct refund amount in your bank account?</p>
                                    </div>
                                    <div className="approval-buttons" style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                      {/* Force button style update with key={Date.now()} */}
                                      <button 
                                        key={message.orderData?.customerApproved || message.orderData?.complaintFiled ? "disabled-approve" : "active-approve"}
                                        className="action-btn approve-btn"
                                        onClick={() => {
                                          if (!message.orderData?.customerApproved && !message.orderData?.complaintFiled) {
                                            approveRefundByCustomer(message.orderData);
                                          }
                                        }}
                                        disabled={message.orderData?.customerApproved || message.orderData?.complaintFiled}
                                        style={{
                                          backgroundColor: (message.orderData?.customerApproved || message.orderData?.complaintFiled) ? '#d1d5db' : '#10B981',
                                          color: (message.orderData?.customerApproved || message.orderData?.complaintFiled) ? '#6B7280' : 'white',
                                          border: 'none',
                                          padding: '12px 20px',
                                          borderRadius: '8px',
                                          fontWeight: '600',
                                          cursor: (message.orderData?.customerApproved || message.orderData?.complaintFiled) ? 'not-allowed' : 'pointer',
                                          flex: '1',
                                          opacity: (message.orderData?.customerApproved || message.orderData?.complaintFiled) ? 0.7 : 1
                                        }}
                                      >
                                        ✅ Yes, Received Correctly
                                      </button>
                                      <button 
                                        key={message.orderData?.customerApproved || message.orderData?.complaintFiled ? "disabled-complaint" : "active-complaint"}
                                        className="action-btn complaint-btn"
                                        onClick={() => {
                                          if (!message.orderData?.customerApproved && !message.orderData?.complaintFiled) {
                                            openComplaintModal(message.orderData);
                                          }
                                        }}
                                        disabled={message.orderData?.customerApproved || message.orderData?.complaintFiled}
                                        style={{
                                          backgroundColor: (message.orderData?.customerApproved || message.orderData?.complaintFiled) ? '#d1d5db' : '#EF4444',
                                          color: (message.orderData?.customerApproved || message.orderData?.complaintFiled) ? '#6B7280' : 'white',
                                          border: 'none',
                                          padding: '12px 20px',
                                          borderRadius: '8px',
                                          fontWeight: '600',
                                          cursor: (message.orderData?.customerApproved || message.orderData?.complaintFiled) ? 'not-allowed' : 'pointer',
                                          flex: '1',
                                          opacity: (message.orderData?.customerApproved || message.orderData?.complaintFiled) ? 0.7 : 1
                                        }}
                                      >
                                        ❌ Issue/Complaint
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Show approval confirmation if customer already approved (but not if they filed a complaint) */}
                              {message.messageType === 'refund_transfer_confirmed' && message.orderData?.customerApproved && !message.orderData?.complaintFiled && (
                                <div className="approval-confirmed">
                                  <div style={{
                                    backgroundColor: '#F0FDF4',
                                    border: '1px solid #10B981',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginTop: '10px',
                                    textAlign: 'center'
                                  }}>
                                    <strong style={{ color: '#10B981' }}>✅ Refund Approved by Customer</strong>
                                    <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#059669' }}>
                                      Customer confirmed receipt of correct amount
                                    </p>
                                  </div>
                                </div>
                              )}
                              
                              {/* Show complaint filed confirmation if customer filed a complaint */}
                              {message.messageType === 'refund_transfer_confirmed' && message.orderData?.complaintFiled && !message.orderData?.customerApproved && (
                                <div className="complaint-filed-confirmed">
                                  <div style={{
                                    backgroundColor: '#FEF2F2',
                                    border: '1px solid #EF4444',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginTop: '10px',
                                    textAlign: 'center'
                                  }}>
                                    <strong style={{ color: '#EF4444' }}>⚠️ Complaint Filed</strong>
                                    <p style={{ margin: '5px 0 10px 0', fontSize: '14px', color: '#DC2626' }}>
                                      Your complaint has been submitted to admin for review
                                    </p>
                                    <button
                                      onClick={() => cancelComplaint(message.orderData)}
                                      style={{
                                        backgroundColor: '#6B7280',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#4B5563';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#6B7280';
                                      }}
                                    >
                                      Cancel Complaint
                                    </button>
                                  </div>
                                </div>
                              )}
                              
                              {/* Display screenshot attachments separately after all UI elements for refund transfer messages */}
                              {message.messageType === 'refund_transfer_confirmed' && message.attachments && message.attachments.length > 0 && (
                                <div className="screenshot-attachments" style={{ marginTop: '15px' }}>
                                  {message.attachments.map((attachment, index) => (
                                    attachment.type === 'image' && (
                                      <div key={index} className="screenshot-container">
                                        <div style={{
                                          backgroundColor: '#F8F9FA',
                                          border: '1px solid #E5E7EB',
                                          borderRadius: '12px',
                                          padding: '12px',
                                          textAlign: 'center'
                                        }}>
                                          <img 
                                            src={attachment.url} 
                                            alt={attachment.name || 'Transfer Screenshot'}
                                            className="transfer-screenshot"
                                            style={{
                                              maxWidth: '100%',
                                              width: '100%',
                                              maxWidth: '280px',
                                              height: 'auto',
                                              borderRadius: '8px',
                                              cursor: 'pointer',
                                              border: '2px solid #D1D5DB',
                                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                              objectFit: 'contain',
                                              backgroundColor: '#ffffff'
                                            }}
                                            onClick={() => window.open(attachment.url, '_blank')}
                                            onMouseEnter={(e) => {
                                              e.target.style.transform = 'scale(1.02)';
                                              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.target.style.transform = 'scale(1)';
                                              e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                                            }}
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                              e.target.nextSibling.textContent = '❌ Screenshot failed to load';
                                            }}
                                          />
                                          <div style={{
                                            fontSize: '12px',
                                            color: '#6B7280',
                                            marginTop: '8px',
                                            padding: '4px 8px',
                                            cursor: 'pointer'
                                          }}
                                          onClick={() => window.open(attachment.url, '_blank')}
                                          >
                                            📸 {attachment.name || 'Transfer Screenshot'} • Tap to enlarge
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  ))}
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

                    {/* Admin Conversation Enhanced Interface */}
                    {isAdminConversation && showFormalReportingInfo && (
                      <div className="admin-reporting-interface" style={{
                        backgroundColor: '#FFFFFF',
                        border: '2px solid #DC2626',
                        borderRadius: '8px',
                        padding: '15px',
                        margin: '10px',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.1)',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        maxHeight: '70vh',
                        overflowY: 'auto'
                      }}>
                        <div style={{ marginBottom: '15px' }}>
                          <h3 style={{ 
                            color: '#B91C1C', 
                            fontSize: '16px', 
                            fontWeight: '700',
                            margin: '0 0 8px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            textAlign: 'center',
                            justifyContent: 'center'
                          }}>
                            ⚠️ Contact Admin - Formal Reporting Required
                          </h3>
                          <p style={{ 
                            color: '#991B1B', 
                            fontSize: '13px', 
                            lineHeight: '1.4',
                            margin: '0',
                            textAlign: 'center',
                            backgroundColor: '#FEF2F2',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #FECACA'
                          }}>
                            <strong>📋 Provide a formal report</strong> - Include store name, your email, and issue details.
                          </p>
                        </div>

                        {/* Report Category Selection */}
                        <div style={{ marginBottom: '15px' }}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '13px', 
                            fontWeight: '600',
                            color: '#B91C1C',
                            marginBottom: '5px'
                          }}>
                            📝 Report Category *
                          </label>
                          <select
                            value={reportCategory}
                            onChange={(e) => setReportCategory(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid #DC2626',
                              fontSize: '13px',
                              backgroundColor: 'white',
                              fontWeight: '500',
                              color: '#374151'
                            }}
                          >
                            <option value="">Select a category...</option>
                            <option value="payment_issue">💳 Payment Issue</option>
                            <option value="delivery_problem">🚚 Delivery Problem</option>
                            <option value="product_quality">📦 Product Quality</option>
                            <option value="seller_behavior">😠 Seller Behavior</option>
                            <option value="order_cancellation">❌ Order Cancellation</option>
                            <option value="refund_request">💰 Refund Request</option>
                            <option value="technical_problem">🔧 Technical Problem</option>
                            <option value="other">❓ Other Issues</option>
                          </select>
                        </div>

                        {/* Store Selection */}
                        <div style={{ marginBottom: '15px' }}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '13px', 
                            fontWeight: '600',
                            color: '#B91C1C',
                            marginBottom: '5px'
                          }}>
                            🏪 Select Store *
                          </label>
                          
                          {loadingStoreHistory ? (
                            <div style={{ 
                              padding: '15px', 
                              textAlign: 'center', 
                              color: '#6B7280',
                              fontSize: '13px',
                              backgroundColor: '#F9FAFB',
                              borderRadius: '6px',
                              border: '1px solid #E5E7EB'
                            }}>
                              ⏳ Loading stores...
                            </div>
                          ) : userStoreHistory.length > 0 ? (
                            <div style={{ 
                              maxHeight: '120px', 
                              overflowY: 'auto',
                              border: '1px solid #DC2626',
                              borderRadius: '6px',
                              backgroundColor: 'white'
                            }}>
                              {userStoreHistory.map((store, index) => (
                                <div
                                  key={store.storeId}
                                  onClick={() => setSelectedReportStore(store)}
                                  style={{
                                    padding: '8px 12px',
                                    borderBottom: index < userStoreHistory.length - 1 ? '1px solid #FEE2E2' : 'none',
                                    cursor: 'pointer',
                                    backgroundColor: selectedReportStore?.storeId === store.storeId ? '#FEE2E2' : 'white',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (selectedReportStore?.storeId !== store.storeId) {
                                      e.currentTarget.style.backgroundColor = '#FEF7F7';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (selectedReportStore?.storeId !== store.storeId) {
                                      e.currentTarget.style.backgroundColor = 'white';
                                    }
                                  }}
                                >
                                  <div style={{ 
                                    fontWeight: '600', 
                                    color: '#B91C1C', 
                                    fontSize: '13px',
                                    marginBottom: '2px'
                                  }}>
                                    🏬 {store.storeName}
                                  </div>
                                  <div style={{ 
                                    fontSize: '11px', 
                                    color: '#7F1D1D',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    flexWrap: 'wrap'
                                  }}>
                                    <span>📧 {store.storeEmail.length > 25 ? store.storeEmail.substring(0, 25) + '...' : store.storeEmail}</span>
                                    <span style={{
                                      backgroundColor: store.interactionType === 'ordered' ? '#EF4444' : '#6B7280',
                                      color: 'white',
                                      padding: '1px 5px',
                                      borderRadius: '8px',
                                      fontSize: '10px',
                                      fontWeight: '600'
                                    }}>
                                      {store.interactionType === 'ordered' ? '📦' : '👁️'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ 
                              padding: '15px', 
                              textAlign: 'center', 
                              color: '#7F1D1D',
                              backgroundColor: '#FEF2F2',
                              border: '1px solid #DC2626',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}>
                              📭 No recent stores found. You can still proceed.
                            </div>
                          )}
                        </div>

                        {/* Selected Store Summary */}
                        {selectedReportStore && (
                          <div style={{
                            backgroundColor: '#FEE2E2',
                            border: '1px solid #DC2626',
                            borderRadius: '6px',
                            padding: '8px',
                            marginBottom: '15px'
                          }}>
                            <div style={{ 
                              fontSize: '12px', 
                              fontWeight: '600', 
                              color: '#B91C1C',
                              marginBottom: '3px'
                            }}>
                              ✅ Selected: <strong>{selectedReportStore.storeName}</strong>
                            </div>
                            <div style={{ fontSize: '11px', color: '#7F1D1D' }}>
                              📧 {selectedReportStore.storeEmail}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ 
                          display: 'flex', 
                          gap: '8px', 
                          flexDirection: 'column'
                        }}>
                          <button
                            onClick={() => {
                              if (reportCategory && (selectedReportStore || userStoreHistory.length === 0)) {
                                const reportText = `FORMAL REPORT

Report Category: ${reportCategory}

User Information:
- Name: ${currentUser?.displayName || 'Not provided'}  
- Email: ${currentUser?.email || 'Not provided'}

${selectedReportStore ? `Store Information:
- Store Name: ${selectedReportStore.storeName}
- Store Email: ${selectedReportStore.storeEmail}
- Last Interaction: ${selectedReportStore.lastInteraction}` : 'Store: Not selected from recent interactions'}

Issue Description:
[Please describe your issue in detail here]

I hereby confirm this is a formal report and all information provided is accurate.`;
                                
                                setEditableReportText(reportText);
                                setShowReportModal(true);
                              } else {
                                alert('Please select both a report category and a store (or confirm no recent interactions) before proceeding.');
                              }
                            }}
                            style={{
                              backgroundColor: '#DC2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '10px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            � Generate Formal Report
                          </button>
                          
                          <button
                            onClick={() => setShowFormalReportingInfo(false)}
                            style={{
                              backgroundColor: '#6B7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            ✕ Continue Without Template
                          </button>
                        </div>

                        <div style={{ 
                          fontSize: '11px', 
                          color: '#7F1D1D',
                          textAlign: 'center',
                          marginTop: '8px',
                          fontStyle: 'italic'
                        }}>
                          💡 Formal reports get faster admin response
                        </div>
                      </div>
                    )}

                    {/* Report Edit Modal */}
                    {showReportModal && (
                      <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 10000,
                        padding: '20px'
                      }}>
                        <div style={{
                          backgroundColor: 'white',
                          borderRadius: '12px',
                          padding: '25px',
                          maxWidth: '600px',
                          width: '100%',
                          maxHeight: '80vh',
                          overflowY: 'auto',
                          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                          border: '2px solid #DC2626'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            paddingBottom: '15px',
                            borderBottom: '2px solid #FEE2E2'
                          }}>
                            <h2 style={{
                              color: '#B91C1C',
                              fontSize: '20px',
                              fontWeight: '700',
                              margin: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              📝 Edit Your Formal Report
                            </h2>
                            <button
                              onClick={() => setShowReportModal(false)}
                              style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                fontSize: '24px',
                                cursor: 'pointer',
                                color: '#6B7280',
                                padding: '5px',
                                borderRadius: '50%',
                                width: '35px',
                                height: '35px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#F3F4F6';
                                e.target.style.color = '#B91C1C';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = '#6B7280';
                              }}
                            >
                              ×
                            </button>
                          </div>

                          <div style={{
                            backgroundColor: '#FEF2F2',
                            border: '1px solid #FECACA',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '20px'
                          }}>
                            <p style={{
                              color: '#7F1D1D',
                              fontSize: '14px',
                              margin: 0,
                              textAlign: 'center'
                            }}>
                              💡 <strong>Review and edit your report below before sending</strong>
                            </p>
                          </div>

                          <textarea
                            value={editableReportText}
                            onChange={(e) => setEditableReportText(e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '300px',
                              padding: '15px',
                              border: '2px solid #DC2626',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'monospace',
                              backgroundColor: 'white',
                              color: '#374151',
                              resize: 'vertical',
                              outline: 'none'
                            }}
                            placeholder="Edit your formal report here..."
                          />

                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '20px',
                            justifyContent: 'flex-end'
                          }}>
                            <button
                              onClick={() => setShowReportModal(false)}
                              style={{
                                backgroundColor: '#6B7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 20px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#4B5563';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#6B7280';
                              }}
                            >
                              Cancel
                            </button>
                            
                            <button
                              onClick={() => {
                                if (editableReportText.trim()) {
                                  setNewMessage(editableReportText);
                                  setShowReportModal(false);
                                  setShowFormalReportingInfo(false);
                                } else {
                                  alert('Please provide a report description before sending.');
                                }
                              }}
                              style={{
                                backgroundColor: '#DC2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 20px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#B91C1C';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#DC2626';
                              }}
                            >
                              Send Report
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Block Request Modal */}
                    {showBlockRequestModal && (
                      <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 10000,
                        padding: '20px'
                      }}>
                        <div style={{
                          backgroundColor: 'white',
                          borderRadius: '12px',
                          padding: '25px',
                          maxWidth: '600px',
                          width: '100%',
                          maxHeight: '80vh',
                          overflowY: 'auto',
                          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                          border: '2px solid #EF4444'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            paddingBottom: '15px',
                            borderBottom: '2px solid #FEE2E2'
                          }}>
                            <h2 style={{
                              margin: 0,
                              color: '#DC2626',
                              fontSize: '1.5rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              🚫 Request User Block
                            </h2>
                            <button
                              onClick={() => setShowBlockRequestModal(false)}
                              style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                fontSize: '24px',
                                cursor: 'pointer',
                                color: '#6B7280',
                                padding: '4px',
                                borderRadius: '4px',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#FEE2E2';
                                e.target.style.color = '#DC2626';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = '#6B7280';
                              }}
                            >
                              ×
                            </button>
                          </div>

                          <div style={{
                            backgroundColor: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            borderRadius: '8px',
                            padding: '15px',
                            marginBottom: '20px'
                          }}>
                            <h3 style={{
                              color: '#92400E',
                              fontSize: '16px',
                              margin: '0 0 8px 0',
                              fontWeight: 'bold'
                            }}>
                              ⚠️ Request Admin Block for User
                            </h3>
                            <p style={{
                              color: '#92400E',
                              fontSize: '14px',
                              margin: 0,
                              lineHeight: '1.4'
                            }}>
                              This will send a request to the admin to temporarily suspend <strong>{selectedConversation?.otherUserName}</strong> from accessing your store. The admin will review your request and decide whether to grant the block.
                            </p>
                          </div>

                          <div style={{ marginBottom: '20px' }}>
                            <label style={{
                              display: 'block',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '600',
                              marginBottom: '8px'
                            }}>
                              Reason for Block Request *
                            </label>
                            <select
                              value={blockRequestReason}
                              onChange={(e) => setBlockRequestReason(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '12px',
                                border: '2px solid #D1D5DB',
                                borderRadius: '8px',
                                fontSize: '14px',
                                backgroundColor: 'white',
                                color: '#374151',
                                outline: 'none'
                              }}
                            >
                              <option value="">Select a reason...</option>
                              <option value="Harassment or Abusive Behavior">Harassment or Abusive Behavior</option>
                              <option value="Fraudulent Activity">Fraudulent Activity</option>
                              <option value="Spam or Unwanted Messages">Spam or Unwanted Messages</option>
                              <option value="Inappropriate Content">Inappropriate Content</option>
                              <option value="Repeated Policy Violations">Repeated Policy Violations</option>
                              <option value="Payment Issues">Payment Issues</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div style={{ marginBottom: '20px' }}>
                            <label style={{
                              display: 'block',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '600',
                              marginBottom: '8px'
                            }}>
                              Detailed Description *
                            </label>
                            <textarea
                              value={blockRequestDetails}
                              onChange={(e) => setBlockRequestDetails(e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '120px',
                                padding: '12px',
                                border: '2px solid #D1D5DB',
                                borderRadius: '8px',
                                fontSize: '14px',
                                backgroundColor: 'white',
                                color: '#374151',
                                resize: 'vertical',
                                outline: 'none',
                                fontFamily: 'inherit'
                              }}
                              placeholder="Please provide specific details about the behavior or incident that led to this block request. Include dates, specific messages, or actions if relevant..."
                            />
                          </div>

                          <div style={{ marginBottom: '20px' }}>
                            <label style={{
                              display: 'block',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '600',
                              marginBottom: '8px'
                            }}>
                              Requested Block Duration
                            </label>
                            <select
                              value={blockRequestDuration}
                              onChange={(e) => setBlockRequestDuration(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '12px',
                                border: '2px solid #D1D5DB',
                                borderRadius: '8px',
                                fontSize: '14px',
                                backgroundColor: 'white',
                                color: '#374151',
                                outline: 'none'
                              }}
                            >
                              <option value="1">1 Day</option>
                              <option value="3">3 Days</option>
                              <option value="7">7 Days (1 Week)</option>
                              <option value="14">14 Days (2 Weeks)</option>
                              <option value="30">30 Days (1 Month)</option>
                              <option value="90">90 Days (3 Months)</option>
                              <option value="365">365 Days (1 Year)</option>
                              <option value="permanent">Permanent</option>
                            </select>
                          </div>

                          <div style={{
                            backgroundColor: '#FEF2F2',
                            border: '1px solid #FECACA',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '20px'
                          }}>
                            <p style={{
                              color: '#7F1D1D',
                              fontSize: '13px',
                              margin: 0,
                              lineHeight: '1.4'
                            }}>
                              <strong>Note:</strong> This request will be reviewed by our admin team. False or frivolous requests may result in penalties to your store account. The admin has the final decision on whether to approve the block and for what duration.
                            </p>
                          </div>

                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '20px',
                            justifyContent: 'flex-end'
                          }}>
                            <button
                              onClick={() => {
                                setShowBlockRequestModal(false);
                                setBlockRequestReason('');
                                setBlockRequestDetails('');
                                setBlockRequestDuration('7');
                              }}
                              disabled={submittingBlockRequest}
                              style={{
                                backgroundColor: '#6B7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 20px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: submittingBlockRequest ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                opacity: submittingBlockRequest ? 0.6 : 1
                              }}
                              onMouseEnter={(e) => {
                                if (!submittingBlockRequest) {
                                  e.target.style.backgroundColor = '#4B5563';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!submittingBlockRequest) {
                                  e.target.style.backgroundColor = '#6B7280';
                                }
                              }}
                            >
                              Cancel
                            </button>
                            
                            <button
                              onClick={handleBlockRequest}
                              disabled={submittingBlockRequest || !blockRequestReason || !blockRequestDetails.trim()}
                              style={{
                                backgroundColor: submittingBlockRequest || !blockRequestReason || !blockRequestDetails.trim() ? '#9CA3AF' : '#EF4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 20px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: submittingBlockRequest || !blockRequestReason || !blockRequestDetails.trim() ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => {
                                if (!submittingBlockRequest && blockRequestReason && blockRequestDetails.trim()) {
                                  e.target.style.backgroundColor = '#DC2626';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!submittingBlockRequest && blockRequestReason && blockRequestDetails.trim()) {
                                  e.target.style.backgroundColor = '#EF4444';
                                }
                              }}
                            >
                              {submittingBlockRequest && (
                                <div style={{
                                  width: '16px',
                                  height: '16px',
                                  border: '2px solid transparent',
                                  borderTop: '2px solid white',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }}></div>
                              )}
                              {submittingBlockRequest ? 'Submitting...' : 'Submit Request'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Block Status Warning */}
                    {userBlockStatus && userBlockStatus.isBlocked && (
                      <div style={{
                        backgroundColor: userBlockStatus.blockType === 'permanent' ? '#FEF2F2' : '#FEF2F2',
                        border: userBlockStatus.blockType === 'permanent' ? '2px solid #F87171' : '2px solid #FECACA',
                        borderRadius: '8px',
                        padding: '1rem',
                        margin: '1rem 0',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          color: '#DC2626',
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          marginBottom: '0.5rem'
                        }}>
                          {userBlockStatus.blockType === 'admin_block' ? '🚨 You have been suspended from this store by admin' :
                           userBlockStatus.blockType === 'permanent' ? '🚫 You are blocked from messaging this store' : 
                           '🚫 You are temporarily blocked from messaging this seller'}
                        </div>
                        <div style={{
                          color: '#7F1D1D',
                          fontSize: '0.875rem',
                          marginBottom: '0.5rem'
                        }}>
                          <strong>Reason:</strong> {userBlockStatus.reason}
                        </div>
                        
                        {userBlockStatus.blockType === 'admin_block' ? (
                          <div>
                            {userBlockStatus.adminResponse && (
                              <div style={{
                                color: '#7F1D1D',
                                fontSize: '0.875rem',
                                marginBottom: '0.5rem'
                              }}>
                                <strong>Admin Response:</strong> {userBlockStatus.adminResponse}
                              </div>
                            )}
                            <div style={{
                              color: '#7F1D1D',
                              fontSize: '0.875rem',
                              marginBottom: '0.5rem'
                            }}>
                              <strong>Duration:</strong> {userBlockStatus.duration === 'permanent' ? 'Permanent' : `${userBlockStatus.duration} days`}
                            </div>
                            {userBlockStatus.expiresAt && userBlockStatus.duration !== 'permanent' && (
                              <div style={{
                                color: '#7F1D1D',
                                fontSize: '0.875rem',
                                marginBottom: '0.5rem'
                              }}>
                                <strong>Expires on:</strong> {new Date(userBlockStatus.expiresAt.toDate()).toLocaleDateString()}
                              </div>
                            )}
                            <div style={{
                              color: '#7F1D1D',
                              fontSize: '0.75rem',
                              marginTop: '0.5rem',
                              fontStyle: 'italic'
                            }}>
                              This suspension was imposed by admin. Contact support if you believe this was done in error.
                            </div>
                          </div>
                        ) : userBlockStatus.blockType === 'permanent' ? (
                          <div>
                            {userBlockStatus.blockedAt && (
                              <div style={{
                                color: '#7F1D1D',
                                fontSize: '0.875rem',
                                marginBottom: '0.5rem'
                              }}>
                                <strong>Blocked on:</strong> {new Date(userBlockStatus.blockedAt).toLocaleDateString()}
                              </div>
                            )}
                            <div style={{
                              color: '#7F1D1D',
                              fontSize: '0.75rem',
                              marginTop: '0.5rem',
                              fontStyle: 'italic'
                            }}>
                              {userBlockStatus.reason === 'You have blocked this user from your store' ? 
                                'You have blocked this user. To send messages, unblock them in your store profile under "Manage Blocked Users".' :
                                'This is a permanent block. Contact support if you believe this was done in error.'
                              }
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{
                              color: '#7F1D1D',
                              fontSize: '0.875rem'
                            }}>
                              <strong>Time remaining:</strong> {userBlockStatus.remainingHours > 24 ? 
                                `${Math.ceil(userBlockStatus.remainingHours / 24)} day(s)` : 
                                `${userBlockStatus.remainingHours} hour(s)`}
                            </div>
                            <div style={{
                              color: '#7F1D1D',
                              fontSize: '0.75rem',
                              marginTop: '0.5rem',
                              fontStyle: 'italic'
                            }}>
                              This restriction was put in place to protect sellers. Contact support if you believe this was done in error.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mobile delete hint */}
                    <div className="mobile-hint" style={{
                      display: 'none',
                      fontSize: '0.8rem',
                      color: '#6B7280',
                      textAlign: 'center',
                      padding: '0.75rem 1rem',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.02))',
                      borderTop: '1px solid rgba(16, 185, 129, 0.2)',
                      backdropFilter: 'blur(5px)',
                      fontWeight: '500'
                    }}>
                      ✨ Long press your messages to delete them
                    </div>

                    <div className="message-input-area">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !userBlockStatus?.isBlocked && sendMessage()}
                        placeholder={userBlockStatus?.isBlocked ? 
                          (userBlockStatus.blockType === 'admin_block' ? "You are suspended from messaging this store" :
                           userBlockStatus.blockType === 'permanent' ? "You are blocked from messaging this store" : 
                           "You are temporarily blocked from messaging this seller") : 
                          "Type your message..."}
                        className="message-input"
                        disabled={!!userBlockStatus?.isBlocked}
                        style={{
                          backgroundColor: userBlockStatus?.isBlocked ? '#F3F4F6' : '',
                          color: userBlockStatus?.isBlocked ? '#6B7280' : '',
                          cursor: userBlockStatus?.isBlocked ? 'not-allowed' : 'text'
                        }}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || !!userBlockStatus?.isBlocked}
                        className="send-button"
                        style={{
                          backgroundColor: userBlockStatus?.isBlocked ? '#9CA3AF' : '',
                          cursor: userBlockStatus?.isBlocked ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {userBlockStatus?.isBlocked ? 'Blocked' : 'Send'}
                      </button>
                      
                      {!isSeller && (
                        <div className="mobile-action-buttons">
                          <button
                            onClick={() => !isOrderLockedForever && setShowStoreItems(!showStoreItems)}
                            className={`mobile-browse-btn ${showStoreItems ? 'active' : ''} ${isOrderLockedForever ? 'disabled permanently-locked' : orderStatus !== 'shopping' ? 'disabled' : ''}`}
                            disabled={isOrderLockedForever || orderStatus !== 'shopping'}
                            style={{
                              backgroundColor: isOrderLockedForever ? '#d1d5db' : '',
                              color: isOrderLockedForever ? '#6B7280' : '',
                              cursor: isOrderLockedForever ? 'not-allowed' : ''
                            }}
                          >
                            {isOrderLockedForever ? '🔒 Browsing Locked' : showStoreItems ? 'Hide Items' : '🛍️ Browse'}
                            {!isOrderLockedForever && orderStatus !== 'shopping' && ' (Order Finalized)'}
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
                {/* Payment Provider Upgrade Section for Users in Non-Stripe Countries */}
                {!sellerConnectAccount && userPaymentProvider && 
                 (userPaymentProvider.provider === 'paystack' || userPaymentProvider.provider === 'none') && (
                  <div style={{
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    border: '2px solid #f59e0b',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                      <div style={{ fontSize: '2rem', flexShrink: 0 }}>🌍</div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#92400e', fontSize: '1.3rem' }}>
                          Payment Solution for {userCountryCode && getCountryName(userCountryCode)}
                        </h3>
                        <p style={{ margin: '0 0 15px 0', color: '#92400e', lineHeight: '1.5' }}>
                          <strong>We've got you covered!</strong> While Stripe isn't available in your region yet, we have alternative payment solutions to help you accept payments and grow your business.
                        </p>
                        
                        <div style={{ background: 'rgba(255,255,255,0.7)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.9rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>💰</span>
                              <span><strong>Accept real payments</strong></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>🏦</span>
                              <span><strong>Regional payment methods</strong></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>📊</span>
                              <span><strong>Full payment tracking</strong></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>🛡️</span>
                              <span><strong>Secure transactions</strong></span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <PaymentProviderSelector
                            currentUser={currentUser}
                            onAccountCreated={(accountId) => {
                              setSellerConnectAccount({ accountId });
                              console.log('✅ Payment account created in Messages:', accountId);
                            }}
                            onBalanceUpdate={(balance) => {
                              setStripeConnectBalance(balance);
                            }}
                            showAccountCreation={true}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="wallet-overview">
                  <div className="wallet-header">
                    <h3 className="section-title">Wallet Overview</h3>
                    <div className="wallet-actions">
                      {/* Stripe Connect withdrawal button - shows when seller has Connect account */}
                      {sellerConnectAccount && (
                        <button
                          onClick={async () => {
                            if (stripeConnectBalance.available <= 0) {
                              alert('No funds available for withdrawal. You need to have earnings from sales before you can withdraw.');
                              return;
                            }
                            
                            // Trigger withdrawal through Stripe Connect
                            const confirmed = window.confirm(
                              `Withdraw £${stripeConnectBalance.available.toFixed(2)} to your bank account?\n\n` +
                              `This will transfer your available balance. The money should arrive in your account within 1-2 business days.`
                            );
                            if (confirmed) {
                              try {
                                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/stripe/connect-payout/${sellerConnectAccount.accountId}`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    amount: Math.round(stripeConnectBalance.available * 100), // Convert to cents
                                    currency: 'gbp'
                                  }),
                                });
                                const data = await response.json();
                                if (data.success) {
                                  alert(`✅ Withdrawal successful! £${stripeConnectBalance.available.toFixed(2)} is being transferred to your bank account.`);
                                  // Refresh balance
                                  setStripeConnectBalance(prev => ({ ...prev, available: 0 }));
                                } else {
                                  throw new Error(data.error || 'Withdrawal failed');
                                }
                              } catch (error) {
                                alert(`❌ Withdrawal failed: ${error.message}`);
                              }
                            }
                          }}
                          className="withdraw-btn"
                          disabled={stripeConnectBalance.available <= 0}
                          title={stripeConnectBalance.available <= 0 ? 'No funds available to withdraw' : `Withdraw £${stripeConnectBalance.available.toFixed(2)} to your bank account`}
                        >
                          💸 Withdraw £{stripeConnectBalance.available.toFixed(2)}
                        </button>
                      )}
                      <button
                        onClick={() => setShowFeeSettings(true)}
                        className="fee-settings-btn"
                      >
                        ⚙️ Fee Settings
                      </button>
                    </div>
                  </div>

                  {/* Payment Provider Integration */}
                  <PaymentProviderSelector
                    currentUser={currentUser}
                    onAccountCreated={(accountId) => {
                      setSellerConnectAccount({ accountId, email: currentUser.email });
                      console.log('✅ Connect account created:', accountId);
                    }}
                    onBalanceUpdate={(balanceData) => {
                      setStripeConnectBalance({
                        available: balanceData.stripeBalance || balanceData.available || 0,
                        pending: balanceData.stripePending || balanceData.pending || 0
                      });
                      // Set the account as connected if we have balance data
                      if (balanceData.accountId && !sellerConnectAccount) {
                        setSellerConnectAccount({ accountId: balanceData.accountId });
                      }
                    }}
                    showAccountCreation={true}
                  />
                  
                  {/* Show balance cards only if seller has Connect account */}
                  {sellerConnectAccount && (
                    <div className="balance-cards">
                      <div className="balance-card stripe">
                        <div className="balance-label">💰 Available Balance</div>
                        <div className="balance-amount">
                          £{stripeConnectBalance.available.toFixed(2)}
                        </div>
                        <div className="balance-subtitle">Ready to withdraw</div>
                      </div>

                      <div className="balance-card pending">
                        <div className="balance-label">⏳ Pending Balance</div>
                        <div className="balance-amount">
                          £{stripeConnectBalance.pending.toFixed(2)}
                        </div>
                        <div className="balance-subtitle">Processing payments</div>
                      </div>

                      <div className="balance-card total">
                        <div className="balance-label">📊 Total Balance</div>
                        <div className="balance-amount">
                          £{(stripeConnectBalance.available + stripeConnectBalance.pending).toFixed(2)}
                        </div>
                        <div className="balance-subtitle">In your Stripe account</div>
                      </div>
                    </div>
                  )}

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
                            {transaction.type === 'sale' && storeRefundsEnabled && transaction.orderId && (
                              <button
                                className="refund-btn"
                                onClick={() => {
                                  // Set pending wallet refund data and show modal
                                  setPendingWalletRefund({
                                    orderId: transaction.orderId,
                                    requiresStripeRefund: transaction.paymentMethod !== 'bank_transfer',
                                    currency: transaction.currency || 'GBP',
                                    amount: transaction.amount,
                                    paymentMethod: transaction.paymentMethod || 'card',
                                    transaction: transaction
                                  });
                                  setWalletRefundReason('');
                                  setShowWalletRefundModal(true);
                                }}
                                title="Process refund for this payment"
                              >
                                Refund
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
                    {/* Show delivery type for clarity */}
                    <div className="breakdown-row" style={{ fontWeight: 'bold', color: '#4f46e5' }}>
                      <span>🚚 Delivery Type:</span>
                      <span>{paymentData.deliveryType || 'Delivery'}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Subtotal:</span>
                      <span>
                        {getCurrencySymbol(paymentData.currency)}
                        {formatPrice(paymentData.subtotal || 0, paymentData.currency)}
                      </span>
                    </div>
                    {paymentData.feeBreakdown?.deliveryEnabled && (paymentData.deliveryFee || 0) > 0 && (
                      <div className="breakdown-row">
                        <span>Delivery Fee:</span>
                        <span>
                          {getCurrencySymbol(paymentData.currency)}
                          {formatPrice(paymentData.deliveryFee || 0, paymentData.currency)}
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
                  {(paymentData.availablePaymentMethods || getPaymentMethods(paymentData.currency)).map((method) => (
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
                  {/* Stripe Elements - Production Ready (Link disabled for native card experience) */}
                  <Elements 
                    stripe={stripePromise} 
                    options={{
                      appearance: {
                        theme: 'stripe',
                        disableAnimations: false,
                      },
                      // Disable Link to force native card input
                      disableLink: true
                    }}
                  >
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

              {/* Google Pay Form - Show when Google Pay is selected */}
              {selectedPaymentMethod === 'google_pay' && (
                <div className="payment-section google-pay-section">
                  <Elements stripe={stripePromise}>
                    <StripeGooglePayButton
                      paymentData={paymentData}
                      onPaymentSuccess={handleGooglePaySuccess}
                      onPaymentError={handleGooglePayError}
                      processing={paymentProcessing}
                      setProcessing={setPaymentProcessing}
                      currentUser={currentUser}
                      selectedConversation={selectedConversation}
                    />
                  </Elements>
                </div>
              )}

              {/* Bank Transfer Form - Show when Bank Transfer is selected */}
              {selectedPaymentMethod === 'bank_transfer' && (
                <div className="payment-section bank-transfer-section">
                  <BankTransferForm
                    paymentData={paymentData}
                    onPaymentSuccess={handleBankTransferSuccess}
                    onPaymentError={handleBankTransferError}
                    processing={paymentProcessing}
                    setProcessing={setPaymentProcessing}
                    currentUser={currentUser}
                    selectedConversation={selectedConversation}
                    storeInfo={storeInfo}
                  />
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
              {/* Only show Pay button for non-card/non-google-pay/non-bank-transfer payments or legacy forms */}
              {((selectedPaymentMethod !== 'card' && selectedPaymentMethod !== 'google_pay' && selectedPaymentMethod !== 'bank_transfer') || 
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
              {/* Note for Stripe Elements and Bank Transfer */}
              {((selectedPaymentMethod === 'card' && !showCardForm) || selectedPaymentMethod === 'google_pay') && (
                <p style={{ 
                  fontSize: '14px', 
                  color: '#666', 
                  textAlign: 'center', 
                  margin: '8px 0 0 0' 
                }}>
                  Use the Pay button in the {
                    selectedPaymentMethod === 'google_pay' ? 'Google Pay' : 'card'
                  } form above
                </p>
              )}
              {selectedPaymentMethod === 'bank_transfer' && (
                <p style={{ 
                  fontSize: '14px', 
                  color: '#007B7F', 
                  textAlign: 'center', 
                  margin: '8px 0 0 0',
                  fontWeight: '500'
                }}>
                  Complete the bank transfer using the instructions above
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="payment-modal-overlay" onClick={() => setShowWithdrawModal(false)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h2>💸 Withdraw Earnings</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowWithdrawModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-content">
              {/* Withdrawal Eligibility Info */}
              <div style={{ 
                background: withdrawalEligibility.eligible ? '#dcfce7' : '#fef3c7', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginBottom: '1rem',
                border: `1px solid ${withdrawalEligibility.eligible ? '#16a34a' : '#d97706'}`
              }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: withdrawalEligibility.eligible ? '#15803d' : '#92400e' }}>
                  {withdrawalEligibility.eligible ? '✅ Withdrawal Available' : '⏳ Withdrawal Pending'}
                </h3>
                <p style={{ margin: '0', fontSize: '0.9rem' }}>
                  {withdrawalEligibility.eligible ? 
                    `You can withdraw up to ${getCurrencySymbol(withdrawalConfigs[withdrawalForm.country]?.currency || 'GBP')}${walletData.balance.toFixed(2)}` :
                    withdrawalEligibility.reason || 'Checking eligibility...'
                  }
                </p>
                <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.8 }}>
                  Days on platform: {withdrawalEligibility.daysOnPlatform} | Monthly withdrawals: {withdrawalEligibility.monthlyWithdrawals}/3
                </div>
              </div>

              {withdrawalEligibility.eligible && (
                <div className="withdrawal-form">
                  {/* Country Selection */}
                  <div className="form-group">
                    <label>Country</label>
                    <select 
                      value={withdrawalForm.country}
                      onChange={(e) => setWithdrawalForm(prev => ({ ...prev, country: e.target.value }))}
                      className="form-input"
                    >
                      <option value="GB">🇬🇧 United Kingdom</option>
                      <option value="US">🇺🇸 United States</option>
                      <option value="NG">🇳🇬 Nigeria</option>
                      <option value="DE">🇩🇪 Germany</option>
                      <option value="IN">🇮🇳 India</option>
                      <option value="CA">🇨🇦 Canada</option>
                    </select>
                  </div>

                  {/* Withdrawal Method */}
                  <div className="form-group">
                    <label>Withdrawal Method</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="radio" 
                          value="bank_account"
                          checked={withdrawalForm.withdrawalMethod === 'bank_account'}
                          onChange={(e) => setWithdrawalForm(prev => ({ ...prev, withdrawalMethod: e.target.value }))}
                        />
                        🏦 Bank Account
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="radio" 
                          value="card"
                          checked={withdrawalForm.withdrawalMethod === 'card'}
                          onChange={(e) => setWithdrawalForm(prev => ({ ...prev, withdrawalMethod: e.target.value }))}
                        />
                        💳 Card
                      </label>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="form-group">
                    <label>Amount ({getCurrencySymbol(withdrawalConfigs[withdrawalForm.country]?.currency || 'GBP')})</label>
                    <input 
                      type="number"
                      value={withdrawalForm.amount}
                      onChange={(e) => setWithdrawalForm(prev => ({ ...prev, amount: e.target.value }))}
                      min={withdrawalConfigs[withdrawalForm.country]?.minAmount || 5}
                      max={Math.min(withdrawalConfigs[withdrawalForm.country]?.maxAmount || 550, walletData.balance)}
                      step="0.01"
                      className="form-input"
                      placeholder={`Min: ${withdrawalConfigs[withdrawalForm.country]?.minAmount || 5}, Max: ${withdrawalConfigs[withdrawalForm.country]?.maxAmount || 550}`}
                    />
                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                      Available balance: {getCurrencySymbol(withdrawalConfigs[withdrawalForm.country]?.currency || 'GBP')}{walletData.balance.toFixed(2)}
                    </div>
                  </div>

                  {/* Account Holder Name */}
                  <div className="form-group">
                    <label>Account Holder Name *</label>
                    <input 
                      type="text"
                      value={withdrawalForm.accountHolderName}
                      onChange={(e) => setWithdrawalForm(prev => ({ ...prev, accountHolderName: e.target.value }))}
                      className="form-input"
                      placeholder="Full name as on account"
                    />
                  </div>

                  {withdrawalForm.withdrawalMethod === 'bank_account' && (
                    <>
                      {/* Account Number */}
                      <div className="form-group">
                        <label>{withdrawalConfigs[withdrawalForm.country]?.accountNumberLabel || 'Account Number'} *</label>
                        <input 
                          type="text"
                          value={withdrawalForm.accountNumber}
                          onChange={(e) => setWithdrawalForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                          className="form-input"
                          placeholder={withdrawalForm.country === 'DE' ? 'IBAN' : 'Account number'}
                        />
                      </div>

                      {/* Sort Code / Routing Number */}
                      <div className="form-group">
                        <label>{withdrawalConfigs[withdrawalForm.country]?.sortCodeLabel || 'Sort Code'} *</label>
                        <input 
                          type="text"
                          value={withdrawalForm.sortCode || withdrawalForm.routingNumber || withdrawalForm.swiftCode}
                          onChange={(e) => {
                            if (withdrawalForm.country === 'GB') {
                              setWithdrawalForm(prev => ({ ...prev, sortCode: e.target.value }));
                            } else if (withdrawalForm.country === 'US' || withdrawalForm.country === 'CA') {
                              setWithdrawalForm(prev => ({ ...prev, routingNumber: e.target.value }));
                            } else {
                              setWithdrawalForm(prev => ({ ...prev, swiftCode: e.target.value }));
                            }
                          }}
                          className="form-input"
                          placeholder={
                            withdrawalForm.country === 'GB' ? '12-34-56' :
                            withdrawalForm.country === 'US' ? '123456789' :
                            withdrawalForm.country === 'CA' ? '12345' :
                            withdrawalForm.country === 'IN' ? 'IFSC Code' :
                            'SWIFT/BIC Code'
                          }
                        />
                      </div>

                      {/* Bank Name */}
                      <div className="form-group">
                        <label>Bank Name *</label>
                        <input 
                          type="text"
                          value={withdrawalForm.bankName}
                          onChange={(e) => setWithdrawalForm(prev => ({ ...prev, bankName: e.target.value }))}
                          className="form-input"
                          placeholder="Name of your bank"
                        />
                      </div>
                    </>
                  )}

                  {withdrawalForm.withdrawalMethod === 'card' && (
                    <>
                      {/* Card Number */}
                      <div className="form-group">
                        <label>Card Number *</label>
                        <input 
                          type="text"
                          value={withdrawalForm.cardNumber}
                          onChange={(e) => setWithdrawalForm(prev => ({ ...prev, cardNumber: e.target.value }))}
                          className="form-input"
                          placeholder="1234 5678 9012 3456"
                          maxLength="19"
                        />
                      </div>

                      {/* Expiry Date */}
                      <div className="form-group">
                        <label>Expiry Date *</label>
                        <input 
                          type="text"
                          value={withdrawalForm.expiryDate}
                          onChange={(e) => setWithdrawalForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                          className="form-input"
                          placeholder="MM/YY"
                          maxLength="5"
                        />
                      </div>
                    </>
                  )}

                  {/* Tax Information */}
                  {withdrawalConfigs[withdrawalForm.country]?.taxRate && (
                    <div style={{ 
                      background: '#f3f4f6', 
                      padding: '0.75rem', 
                      borderRadius: '6px', 
                      fontSize: '0.9rem',
                      margin: '1rem 0'
                    }}>
                      <strong>📊 Tax Information:</strong> 
                      <br />
                      {(withdrawalConfigs[withdrawalForm.country].taxRate * 100).toFixed(0)}% tax may be applied by Stripe according to {withdrawalForm.country} regulations.
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="payment-actions">
                    <button 
                      className="payment-btn"
                      onClick={processWithdrawal}
                      disabled={withdrawalProcessing || !withdrawalForm.amount || !withdrawalForm.accountHolderName}
                      style={{ 
                        background: withdrawalProcessing ? '#d1d5db' : '#16a34a',
                        color: 'white',
                        width: '100%'
                      }}
                    >
                      {withdrawalProcessing ? '⏳ Processing...' : `💸 Withdraw ${getCurrencySymbol(withdrawalConfigs[withdrawalForm.country]?.currency || 'GBP')}${withdrawalForm.amount || '0.00'}`}
                    </button>
                  </div>
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

      {/* Collection Scheduling Modal */}
      {showCollectionModal && (
        <div className="payment-modal-overlay" onClick={() => setShowCollectionModal(false)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h2>Schedule Collection</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowCollectionModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-content">
              <div className="payment-section">
                <h3>Collection Time Slots</h3>
                <div className="delivery-options">
                  <div className={`delivery-option ${deliverySettings.timeSlot === 'morning' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      id="morning"
                      name="timeSlot"
                      value="morning"
                      checked={deliverySettings.timeSlot === 'morning'}
                      onChange={(e) => setDeliverySettings({
                        ...deliverySettings,
                        timeSlot: e.target.value,
                        deliveryType: 'collection'
                      })}
                    />
                    <label htmlFor="morning">
                      <div className="option-header">
                        🌅 <strong>Morning Collection</strong>
                        <span className="option-price">+£1.50</span>
                      </div>
                      <div className="option-description">9:00 AM - 12:00 PM</div>
                    </label>
                  </div>

                  <div className={`delivery-option ${deliverySettings.timeSlot === 'afternoon' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      id="afternoon"
                      name="timeSlot"
                      value="afternoon"
                      checked={deliverySettings.timeSlot === 'afternoon'}
                      onChange={(e) => setDeliverySettings({
                        ...deliverySettings,
                        timeSlot: e.target.value,
                        deliveryType: 'collection'
                      })}
                    />
                    <label htmlFor="afternoon">
                      <div className="option-header">
                        ☀️ <strong>Afternoon Collection</strong>
                        <span className="option-price">+£2.00</span>
                      </div>
                      <div className="option-description">12:00 PM - 5:00 PM</div>
                    </label>
                  </div>

                  <div className={`delivery-option ${deliverySettings.timeSlot === 'evening' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      id="evening"
                      name="timeSlot"
                      value="evening"
                      checked={deliverySettings.timeSlot === 'evening'}
                      onChange={(e) => setDeliverySettings({
                        ...deliverySettings,
                        timeSlot: e.target.value,
                        deliveryType: 'collection'
                      })}
                    />
                    <label htmlFor="evening">
                      <div className="option-header">
                        🌆 <strong>Evening Collection</strong>
                        <span className="option-price">+£2.50</span>
                      </div>
                      <div className="option-description">5:00 PM - 8:00 PM</div>
                    </label>
                  </div>

                  <div className={`delivery-option ${deliverySettings.timeSlot === 'next_day' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      id="next_day"
                      name="timeSlot"
                      value="next_day"
                      checked={deliverySettings.timeSlot === 'next_day'}
                      onChange={(e) => setDeliverySettings({
                        ...deliverySettings,
                        timeSlot: e.target.value,
                        deliveryType: 'collection'
                      })}
                    />
                    <label htmlFor="next_day">
                      <div className="option-header">
                        📅 <strong>Next Day Collection</strong>
                        <span className="option-price">+£4.00</span>
                      </div>
                      <div className="option-description">Any time next day</div>
                    </label>
                  </div>
                </div>

                <div className="delivery-actions">
                  <button
                    className="action-btn confirm-btn"
                    onClick={scheduleCollection}
                    style={{
                      backgroundColor: '#10B981',
                      color: 'white',
                      width: '100%',
                      marginTop: '1rem'
                    }}
                  >
                    Schedule Collection
                  </button>
                </div>
              </div>
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
              {/* Delivery Fee Settings - Only show for Delivery stores, not Collection */}
              {sellerStoreData?.deliveryType !== 'Collection' && (
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
              )}

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

              {/* Refunds Settings */}
              <div className="payment-section">
                <h3>Refunds Policy</h3>
                <div className="fee-setting-group">
                  <label className="fee-checkbox">
                    <input
                      type="checkbox"
                      checked={feeSettings.refundsEnabled}
                      onChange={(e) => setFeeSettings(prev => ({
                        ...prev,
                        refundsEnabled: e.target.checked
                      }))}
                    />
                    Allow refunds for this store
                  </label>
                  <p className="fee-setting-description">
                    {feeSettings.refundsEnabled 
                      ? "Customers can request refunds for orders from your store." 
                      : "⚠️ Customers will see that this store does not offer refunds. This cannot be changed for existing orders."}
                  </p>
                </div>
              </div>

              {/* Payment Methods Settings */}
              <div className="payment-section">
                <h3>Payment Methods</h3>
                <div className="fee-setting-group">
                  <label className="fee-checkbox">
                    <input
                      type="checkbox"
                      checked={feeSettings.manualTransferOnly}
                      onChange={(e) => {
                        const isManualOnly = e.target.checked;
                        
                        // If user is trying to uncheck manual transfer (enable card/Google Pay)
                        if (!isManualOnly) {
                          const hasStripeConnect = !!(sellerStoreData?.stripeConnectAccountId || sellerStoreData?.hasAutomaticPayments);
                          
                          if (!hasStripeConnect) {
                            // Prevent unchecking and show Stripe Connect setup prompt
                            setShowStripeConnectModal(true);
                            return; // Don't change the checkbox state
                          }
                        }
                        
                        setFeeSettings(prev => ({
                          ...prev,
                          manualTransferOnly: isManualOnly,
                          // If manual only is enabled, disable card and Google Pay
                          cardPaymentsEnabled: !isManualOnly,
                          googlePayEnabled: !isManualOnly
                        }));
                        
                        console.log('💳 Manual transfer setting changed:', {
                          manualTransferOnly: isManualOnly,
                          hasStripeConnect: !!(sellerStoreData?.stripeConnectAccountId || sellerStoreData?.hasAutomaticPayments)
                        });
                      }}
                    />
                    Manual transfer payments only
                  </label>
                  <p className="fee-setting-description">
                    {feeSettings.manualTransferOnly 
                      ? (
                        <span>
                          ⚠️ Only manual bank transfers will be accepted. Card and Google Pay are disabled.
                          {!(sellerStoreData?.stripeConnectAccountId || sellerStoreData?.hasAutomaticPayments) && (
                            <><br />💡 <strong>To enable card payments:</strong> Set up Stripe Connect in your Store Profile first.</>
                          )}
                        </span>
                      )
                      : "✅ Customers can pay using cards, Google Pay, or manual transfers."}
                  </p>

                  {!feeSettings.manualTransferOnly && (
                    <div className="payment-method-controls" style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
                      <div className="fee-setting-group">
                        <label className="fee-checkbox">
                          <input
                            type="checkbox"
                            checked={feeSettings.cardPaymentsEnabled}
                            onChange={(e) => setFeeSettings(prev => ({
                              ...prev,
                              cardPaymentsEnabled: e.target.checked
                            }))}
                          />
                          Accept card payments
                        </label>
                      </div>
                      <div className="fee-setting-group">
                        <label className="fee-checkbox">
                          <input
                            type="checkbox"
                            checked={feeSettings.googlePayEnabled}
                            onChange={(e) => setFeeSettings(prev => ({
                              ...prev,
                              googlePayEnabled: e.target.checked
                            }))}
                          />
                          Accept Google Pay
                        </label>
                      </div>
                      <p className="fee-setting-description" style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                        Manual bank transfers are always available as a payment option.
                      </p>
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
                    {feeSettings.deliveryEnabled && sellerStoreData?.deliveryType !== 'Collection' && (
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
                    {sellerStoreData?.deliveryType === 'Collection' && (
                      <div style={{ color: '#666', fontSize: '0.9rem', fontStyle: 'italic' }}>
                        * No delivery fee for collection orders
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', fontWeight: 'bold' }}>
                      Total: £{(
                        35 + 
                        (feeSettings.deliveryEnabled && sellerStoreData?.deliveryType !== 'Collection' && !(feeSettings.freeDeliveryThreshold > 0 && 35 >= feeSettings.freeDeliveryThreshold) ? feeSettings.deliveryFee : 0) +
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

      {/* Refund Request Modal */}
      {showRefundModal && (
        <div className="payment-modal-overlay" onClick={() => setShowRefundModal(false)}>
          <div className="payment-modal refund-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h2>🚫 Cancel Order & Request Refund</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowRefundModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-content">
              <div className="refund-form">
                {pendingRefundOrder && (
                  <div className="order-summary-box">
                    <h4>Order to Cancel:</h4>
                    <p><strong>Order ID:</strong> {pendingRefundOrder.orderId}</p>
                    <p><strong>Total:</strong> {getCurrencySymbol(pendingRefundOrder.currency)}{formatPrice(parseFloat(pendingRefundOrder.totalAmount) || 0, pendingRefundOrder.currency)}</p>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="refundReason">Reason for cancellation & refund: *</label>
                  <select 
                    id="refundReason"
                    value={refundReason} 
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="refund-select"
                  >
                    <option value="">Select a reason...</option>
                    <option value="Items damaged">Items damaged during delivery</option>
                    <option value="No longer want items">No longer want the items</option>
                    <option value="Wrong items received">Wrong items received</option>
                    <option value="Items not as described">Items not as described</option>
                    <option value="Delivery took too long">Delivery took too long</option>
                    <option value="Changed my mind">Changed my mind</option>
                    <option value="Found better price elsewhere">Found better price elsewhere</option>
                    <option value="Quality not satisfactory">Quality not satisfactory</option>
                    <option value="Other">Other reason</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="refundDetails">Additional details (optional):</label>
                  <textarea 
                    id="refundDetails"
                    value={refundDetails} 
                    onChange={(e) => setRefundDetails(e.target.value)}
                    className="refund-textarea"
                    placeholder="Please provide any additional details about your refund request..."
                    rows="4"
                  />
                </div>

                <div className="refund-warning">
                  <p>⚠️ <strong>Warning:</strong> This will cancel your order and send a refund request to the seller for approval. Refunds are subject to seller review before processing. This action cannot be undone.</p>
                </div>
                <div className="refund-info" style={{ backgroundColor: '#f0f9ff', padding: '10px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #bae6fd' }}>
                  <p style={{ margin: '0' }}><strong>ℹ️ Note:</strong> All refund requests must be approved by the seller. Once approved:</p>
                  <ul style={{ marginTop: '5px', paddingLeft: '25px' }}>
                    <li>Card/digital payments will be refunded to your original payment method</li>
                    <li>Bank transfers will be refunded manually by the seller</li>
                  </ul>
                </div>

                <div className="modal-actions">
                  <button 
                    className="cancel-btn"
                    onClick={() => setShowRefundModal(false)}
                  >
                    Keep Order
                  </button>
                  <button 
                    className="confirm-payment-btn refund-request-btn"
                    onClick={processRefundRequest}
                    disabled={!refundReason.trim()}
                  >
                    🚫 Cancel Order & Request Refund
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Transfer Confirmation Modal */}
      {showRefundTransferModal && (
        <div className="payment-modal-overlay" onClick={() => setShowRefundTransferModal(false)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📸 Confirm Refund Transfer</h2>
              <button 
                className="close-btn"
                onClick={() => setShowRefundTransferModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <div className="refund-transfer-info">
                <div className="transfer-details">
                  <p><strong>Order ID:</strong> {pendingRefundTransfer?.orderId}</p>
                  <p><strong>Refund Amount:</strong> {getCurrencySymbol(pendingRefundTransfer?.currency || 'GBP')}{formatPrice(pendingRefundTransfer?.refundAmount || 0, pendingRefundTransfer?.currency || 'GBP')}</p>
                  <p><strong>Customer:</strong> {pendingRefundTransfer?.customerName || selectedConversation?.otherUserName || 'Unknown Customer'}</p>
                </div>

                <div className="screenshot-upload">
                  <label htmlFor="refund-screenshot" className="upload-label">
                    <strong>📸 Upload Transfer Screenshot (Required)</strong>
                    <p>Please attach a screenshot of your bank transfer confirmation</p>
                  </label>
                  <input
                    id="refund-screenshot"
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotSelect}
                    className="screenshot-input"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px dashed #ccc',
                      borderRadius: '8px',
                      marginTop: '8px',
                      cursor: 'pointer'
                    }}
                  />
                  {refundTransferScreenshot && (
                    <div className="selected-file" style={{ marginTop: '8px', color: '#10B981', fontWeight: '600' }}>
                      ✅ Selected: {refundTransferScreenshot.name}
                    </div>
                  )}
                </div>

                <div className="transfer-instructions">
                  <p><strong>⚠️ Important:</strong></p>
                  <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                    <li>Make sure you have transferred the exact refund amount</li>
                    <li>The screenshot must clearly show the transfer confirmation</li>
                    <li>This confirms to the customer that their refund has been sent</li>
                    <li>Screenshot files must be under 5MB</li>
                  </ul>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowRefundTransferModal(false)}
                  disabled={uploadingScreenshot}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-payment-btn transfer-confirm-btn"
                  onClick={confirmRefundTransfer}
                  disabled={!refundTransferScreenshot || uploadingScreenshot}
                  style={{
                    backgroundColor: refundTransferScreenshot ? '#10B981' : '#ccc',
                    opacity: uploadingScreenshot ? 0.7 : 1
                  }}
                >
                  {uploadingScreenshot ? '📤 Uploading...' : '✅ Confirm Transfer & Notify Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Complaint Modal */}
      {showComplaintModal && (
        <div className="payment-modal-overlay" onClick={() => closeComplaintModal()}>
          <div className="payment-modal complaint-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-modal-content">
              <div className="modal-header">
                <h3>📧 File Refund Complaint</h3>
                <button 
                  className="close-modal"
                  onClick={() => closeComplaintModal()}
                >
                  ✕
                </button>
              </div>

              <div className="modal-content">
                <div className="complaint-info">
                  <div className="refund-details">
                    <p><strong>Order ID:</strong> {pendingComplaintRefund?.orderId}</p>
                    <p><strong>Expected Amount:</strong> {getCurrencySymbol(pendingComplaintRefund?.currency || 'GBP')}{formatPrice(pendingComplaintRefund?.amount || 0, pendingComplaintRefund?.currency || 'GBP')}</p>
                  </div>

                  <div className="complaint-form">
                    <div className="form-group">
                      <label htmlFor="complaint-email"><strong>Your Email Address:</strong></label>
                      <input
                        id="complaint-email"
                        type="email"
                        value={complaintData.email}
                        onChange={(e) => setComplaintData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter your email for response"
                        style={{
                          width: '100%',
                          padding: '10px',
                          marginTop: '5px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div className="form-group" style={{ marginTop: '15px' }}>
                      <label htmlFor="complaint-type"><strong>Issue Type:</strong></label>
                      <select
                        id="complaint-type"
                        value={complaintData.complaintType}
                        onChange={(e) => setComplaintData(prev => ({ ...prev, complaintType: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px',
                          marginTop: '5px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      >
                        <option value="incorrect_amount">Incorrect refund amount</option>
                        <option value="not_received">Haven't received refund</option>
                        <option value="other">Other issue</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginTop: '15px' }}>
                      <label htmlFor="complaint-explanation"><strong>Explain what happened:</strong></label>
                      <textarea
                        id="complaint-explanation"
                        value={complaintData.explanation}
                        onChange={(e) => setComplaintData(prev => ({ ...prev, explanation: e.target.value }))}
                        placeholder="Please provide details about the issue with your refund..."
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '10px',
                          marginTop: '5px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div className="form-group" style={{ marginTop: '15px' }}>
                      <label htmlFor="complaint-screenshots"><strong>Screenshots (Optional, max 5):</strong></label>
                      <input
                        id="complaint-screenshots"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleComplaintScreenshots}
                        style={{
                          width: '100%',
                          padding: '10px',
                          marginTop: '5px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                      
                      {complaintScreenshots.length > 0 && (
                        <div className="screenshot-preview" style={{ marginTop: '10px' }}>
                          <p style={{ fontSize: '14px', color: '#666' }}>Selected files:</p>
                          {complaintScreenshots.map((file, index) => (
                            <div key={index} style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              padding: '5px 0',
                              borderBottom: '1px solid #eee'
                            }}>
                              <span style={{ fontSize: '14px' }}>{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeComplaintScreenshot(index)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{
                display: 'flex',
                gap: '10px',
                marginTop: '20px',
                justifyContent: 'flex-end'
              }}>
                <button 
                  className="cancel-payment-btn"
                  onClick={() => closeComplaintModal()}
                  style={{
                    backgroundColor: '#6B7280',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-payment-btn submit-complaint-btn"
                  onClick={submitComplaint}
                  disabled={!complaintData.email.trim() || !complaintData.explanation.trim() || submittingComplaint}
                  style={{
                    backgroundColor: complaintData.email.trim() && complaintData.explanation.trim() ? '#EF4444' : '#ccc',
                    opacity: submittingComplaint ? 0.7 : 1
                  }}
                >
                  {submittingComplaint ? '📧 Submitting...' : '📧 Submit Complaint to Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .messages-container {
          max-width: 1200px;
          margin: 1.5rem auto;
          background: rgba(255, 255, 255, 0.98);
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          overflow: hidden;
          min-height: calc(100vh - 4rem);
        }

        .messages-tabs {
          display: flex;
          border-bottom: 1px solid rgba(229, 231, 235, 0.6);
          background: rgba(249, 250, 251, 0.8);
          backdrop-filter: blur(10px);
        }

        .tab-button {
          flex: 1;
          padding: 1.25rem 1rem;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          color: #6B7280;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .tab-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.05));
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .tab-button:hover::before {
          opacity: 1;
        }

        .tab-button.active {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05));
          border-bottom-color: #10B981;
          color: #059669;
          font-weight: 700;
        }

        .tab-button.active::before {
          opacity: 1;
        }

        .messages-content {
          display: flex;
          height: calc(100vh - 12rem);
        }

        .conversations-panel {
          width: 360px;
          border-right: 1px solid rgba(229, 231, 235, 0.6);
          display: flex;
          flex-direction: column;
          background: rgba(249, 250, 251, 0.5);
          backdrop-filter: blur(10px);
        }

        .search-input {
          width: calc(100% - 2rem);
          padding: 1rem 1.25rem;
          border: 2px solid rgba(229, 231, 235, 0.6);
          border-radius: 25px;
          margin: 1.25rem 1rem 1rem 1rem;
          font-size: 0.95rem;
          outline: none;
          box-sizing: border-box;
          background: rgba(255, 255, 255, 0.9);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .search-input:focus {
          border-color: #10B981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
          background: #ffffff;
        }

        .search-input::placeholder {
          color: #9CA3AF;
          font-weight: 400;
        }

        .mobile-only {
          display: none;
        }

        /* Mobile Back Button Styles */
        .mobile-back-row {
          padding: 0.75rem 1rem;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }

        .mobile-back-button {
          width: 100%;
          padding: 0.75rem 1rem;
          background: linear-gradient(135deg, #007B7F 0%, #005a5e 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 123, 127, 0.2);
        }

        .mobile-back-button:hover {
          background: linear-gradient(135deg, #005a5e 0%, #004449 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 123, 127, 0.3);
        }

        .mobile-back-button:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0, 123, 127, 0.2);
        }

        .conversations-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem 1rem;
        }

        .conversation-item {
          padding: 1rem;
          border: 1px solid rgba(229, 231, 235, 0.4);
          border-radius: 16px;
          margin: 0 1rem 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(5px);
          position: relative;
          overflow: hidden;
        }

        .conversation-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.02));
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .conversation-item:hover {
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(16, 185, 129, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .conversation-item:hover::before {
          opacity: 1;
        }

        .conversation-item.selected {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05));
          border-color: #10B981;
          border-width: 2px;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.15);
        }

        .conversation-item.selected::before {
          opacity: 1;
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
          padding: 1.5rem;
          border-bottom: 1px solid rgba(229, 231, 235, 0.6);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.8));
          backdrop-filter: blur(10px);
          position: relative;
        }

        .chat-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.3), transparent);
        }

        .chat-user-info {
          flex: 1;
        }

        .chat-user-details {
          flex: 1;
        }

        .chat-user-name {
          font-weight: 700;
          font-size: 1.2rem;
          color: #1F2937;
          margin-bottom: 0.25rem;
        }

        .chat-user-email {
          font-size: 0.875rem;
          color: #6B7280;
          margin-bottom: 0.25rem;
        }

        .chat-store-address {
          font-size: 0.875rem;
          color: #10B981 !important;
          cursor: pointer;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.2s ease;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          background: rgba(16, 185, 129, 0.1);
          display: inline-block;
        }

        .chat-store-address:hover {
          color: #059669 !important;
          background: rgba(16, 185, 129, 0.15);
          transform: translateY(-1px);
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
          padding: 1.5rem;
          height: calc(100vh - 350px) !important;
          max-height: calc(100vh - 350px) !important;
          scrollbar-width: thin !important;
          scrollbar-color: rgba(16, 185, 129, 0.3) transparent !important;
          -webkit-overflow-scrolling: touch;
          background: linear-gradient(180deg, rgba(249, 250, 251, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%);
        }

        .messages-list::-webkit-scrollbar {
          width: 8px !important;
        }

        .messages-list::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.02) !important;
          border-radius: 10px !important;
        }

        .messages-list::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(5, 150, 105, 0.6)) !important;
          border-radius: 10px !important;
          border: 2px solid transparent !important;
          background-clip: content-box !important;
        }

        .messages-list::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.6), rgba(5, 150, 105, 0.8)) !important;
        }

        .message {
          margin-bottom: 1.25rem;
          display: flex;
          align-items: flex-end;
          gap: 0.5rem;
        }

        .message.sent {
          justify-content: flex-end;
        }

        .message.received {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 75%;
          padding: 1rem 1.25rem;
          border-radius: 20px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          hyphens: auto;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
        }

        .message.sent .message-bubble {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          color: #ffffff;
          border-bottom-right-radius: 6px;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .message.received .message-bubble {
          background: rgba(255, 255, 255, 0.95);
          color: #1F2937;
          border: 1px solid rgba(229, 231, 235, 0.8);
          border-bottom-left-radius: 6px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .message-text {
          font-size: 0.95rem;
          white-space: pre-wrap;
          line-height: 1.5;
          word-break: break-word;
          overflow-wrap: break-word;
          hyphens: auto;
          font-weight: 400;
          letter-spacing: 0.01em;
        }



        .message-time {
          font-size: 0.75rem;
          margin-top: 0.5rem;
          opacity: 0.8;
        }

        .message-input-area {
          display: flex !important;
          gap: 0.75rem;
          align-items: flex-end;
          padding: 1.25rem 1.5rem !important;
          border-top: 1px solid rgba(229, 231, 235, 0.6) !important;
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          flex-wrap: wrap;
          position: sticky !important;
          bottom: 0 !important;
          z-index: 10 !important;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08) !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        .message-input {
          flex: 1 !important;
          padding: 1rem 1.25rem !important;
          border: 2px solid rgba(229, 231, 235, 0.6) !important;
          border-radius: 25px !important;
          outline: none !important;
          font-size: 0.95rem !important;
          min-width: 200px !important;
          background: rgba(255, 255, 255, 0.9) !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          resize: none !important;
          font-family: inherit !important;
          line-height: 1.4 !important;
          max-height: 120px !important;
          min-height: 44px !important;
        }

        .message-input:focus {
          border-color: #10B981 !important;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1) !important;
          background: #ffffff !important;
        }

        .message-input::placeholder {
          color: #9CA3AF !important;
          font-weight: 400 !important;
        }

        .send-button {
          padding: 0.875rem 1.75rem !important;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%) !important;
          color: #fff !important;
          border: none !important;
          border-radius: 25px !important;
          cursor: pointer !important;
          font-weight: 600 !important;
          font-size: 0.95rem !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3) !important;
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
          min-height: 44px !important;
        }

        .send-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4) !important;
        }

        .send-button:active {
          transform: translateY(0) !important;
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

        .fee-setting-description {
          margin-top: 0.5rem;
          font-size: 0.85rem;
          line-height: 1.4;
          color: #6b7280;
          font-weight: normal;
          padding: 0.5rem;
          background: #f9fafb;
          border-radius: 4px;
          border-left: 3px solid #d1d5db;
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
        .balance-card.stripe .balance-label { color: #635BFF; }

        .balance-amount {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .balance-card.available .balance-amount { color: #15803D; }
        .balance-card.pending .balance-amount { color: #B45309; }
        .balance-card.total .balance-amount { color: #005a5d; }
        .balance-card.stripe .balance-amount { color: #4338CA; }

        .balance-subtitle {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
          font-style: italic;
          text-align: center;
        }

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
        
        .refund-btn {
          padding: 0.25rem 0.5rem;
          background: #e11d48;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          margin-top: 0.25rem;
        }
        
        .refund-btn:hover {
          background: #be123c;
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

          .mobile-back-row {
            display: block !important;
          }

          .chat-header {
            padding: 0.75rem 1rem;
          }

          .chat-user-info {
            margin-bottom: 0;
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

        .refund-disabled-notice {
          margin: 0.5rem 0;
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #f87171;
          border-radius: 8px;
          text-align: center;
          font-size: 0.9rem;
          color: #dc2626;
          font-weight: 500;
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

        /* Refund approval styles */
        .refund-request-header {
          margin-bottom: 0.75rem;
          padding: 0.75rem;
          background: #fef3f3;
          border: 1px solid #f87171;
          border-radius: 8px;
        }

        .refund-request-header strong {
          color: #dc2626;
          font-size: 0.95rem;
        }

        .refund-details {
          margin-top: 0.5rem;
          font-size: 0.85rem;
          color: #374151;
        }

        .refund-reason, .refund-details-text, .refund-amount {
          margin: 0.25rem 0;
        }

        .refund-amount {
          font-weight: 600;
          color: #dc2626;
        }

        .refund-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .refund-actions .action-btn {
          flex: 1;
          min-width: 120px;
        }

        .approve-refund-btn {
          background: #16a34a !important;
          color: white !important;
        }

        .approve-refund-btn:hover {
          background: #15803d !important;
        }

        .deny-refund-btn {
          background: #dc2626 !important;
          color: white !important;
        }

        .deny-refund-btn:hover {
          background: #b91c1c !important;
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
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #EF4444;
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.375rem;
          border-radius: 50%;
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
        }

        .message:hover .delete-message-btn {
          opacity: 1;
        }

        .delete-message-btn:hover {
          background: linear-gradient(135deg, #EF4444, #DC2626);
          color: #fff;
          transform: scale(1.1);
          border-color: transparent;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }

        .delete-message-btn:active {
          transform: scale(0.95);
        }

        /* Hide delete button on mobile, show only on desktop */
        .desktop-only {
          display: flex;
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
          .send-order-btn {
            flex: 1;
            width: 100%;
          }

          /* Improve message bubbles on mobile */
          .message-bubble {
            max-width: 85%;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            word-break: break-word;
            padding: 0.75rem;
            min-height: 44px; /* Better touch target */
            box-sizing: border-box;
          }

          /* Hide desktop delete button on mobile */
          .desktop-only {
            display: none !important;
          }

          /* Add visual feedback for long press on mobile */
          .message.sent .message-bubble:active {
            transform: scale(0.98);
            opacity: 0.8;
            transition: all 0.1s ease;
          }

          /* Subtle indication that message is pressable */
          .message.sent .message-bubble {
            position: relative;
          }

          .message.sent .message-bubble::after {
            content: '';
            position: absolute;
            top: 2px;
            right: 2px;
            width: 8px;
            height: 8px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            opacity: 0.6;
          }

          /* Better text wrapping on mobile */
          .message-text {
            word-break: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            line-height: 1.5;
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

          /* Show mobile hint on mobile devices */
          .mobile-hint {
            display: block !important;
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
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            word-break: break-word;
            min-height: 40px; /* Smaller touch target for very small screens */
          }

          /* Ensure desktop delete button stays hidden on very small screens */
          .desktop-only {
            display: none !important;
          }

          /* Improve text readability on small screens */
          .message-text {
            font-size: 0.85rem;
            line-height: 1.4;
            word-break: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
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

        /* Tablet and medium screen optimizations */
        @media (max-width: 1024px) and (min-width: 769px) {
          .message-bubble {
            max-width: 75%;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
          }
          
          /* Show delete button on hover for tablets */
          .desktop-only {
            display: block;
          }
          
          .message-text {
            word-break: break-word;
            overflow-wrap: break-word;
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

        /* Refund Modal Styles */
        .refund-modal {
          max-width: 550px;
          width: 90%;
        }

        .refund-form {
          padding: 1rem 0;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.5rem;
          font-size: 0.95rem;
        }

        .refund-select {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 1rem;
          background: white;
          color: #374151;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .refund-select:focus {
          outline: none;
          border-color: #EF4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .refund-textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 1rem;
          font-family: inherit;
          resize: vertical;
          min-height: 100px;
          transition: border-color 0.2s;
        }

        .refund-textarea:focus {
          outline: none;
          border-color: #EF4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .refund-warning {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 1rem;
          margin: 1.5rem 0;
        }

        .refund-warning p {
          margin: 0;
          color: #dc2626;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .refund-request-btn {
          background: #EF4444;
          color: white;
          font-size: 1rem;
          padding: 0.75rem 1.5rem;
          min-width: 200px;
        }

        .refund-request-btn:hover:not(:disabled) {
          background: #dc2626;
        }

        .refund-request-btn:disabled {
          background: #d1d5db;
          color: #9ca3af;
          cursor: not-allowed;
        }

        /* Withdrawal Styles */
        .wallet-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .withdraw-btn {
          background: linear-gradient(135deg, #16a34a, #22c55e);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0.75rem 1.25rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .withdraw-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #15803d, #16a34a);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
        }

        .withdraw-btn:disabled {
          background: #d1d5db;
          color: #9ca3af;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .withdrawal-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #374151;
          font-size: 0.9rem;
        }

        .form-input {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #16a34a;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1);
        }

        .form-input:invalid {
          border-color: #dc2626;
        }

        @media (max-width: 640px) {
          .modal-actions {
            flex-direction: column;
          }
          
          .confirmation-actions {
            flex-direction: column;
            gap: 0.75rem;
          }
          
          .cancel-btn,
          .wallet-redirect-btn {
            width: 100%;
          }

          .wallet-actions {
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
          }

          .withdraw-btn,
          .fee-settings-btn {
            width: 100%;
            justify-content: center;
          }
        }

        /* Collection Modal Styles */
        .collection-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 1rem;
        }

        .collection-modal-content {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .collection-modal h3 {
          color: #1f2937;
          margin: 0 0 1.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
        }

        .collection-time-slots {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin: 1.5rem 0;
        }

        .time-slot-option {
          display: flex;
          align-items: center;
          padding: 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
        }

        .time-slot-option:hover {
          border-color: #059669;
          background: #f0fdf4;
        }

        .time-slot-option.selected {
          border-color: #059669;
          background: #f0fdf4;
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
        }

        .time-slot-option input[type="radio"] {
          margin-right: 0.75rem;
          width: 18px;
          height: 18px;
          accent-color: #059669;
        }

        .time-slot-details {
          flex: 1;
        }

        .time-slot-label {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 0.25rem;
        }

        .time-slot-price {
          color: #059669;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .time-slot-description {
          color: #6b7280;
          font-size: 0.9rem;
        }

        .collection-order-summary {
          background: #f9fafb;
          border-radius: 8px;
          padding: 1rem;
          margin: 1.5rem 0;
        }

        .collection-order-summary h4 {
          margin: 0 0 0.75rem 0;
          color: #1f2937;
          font-size: 1rem;
          font-weight: 600;
        }

        .collection-total-summary {
          border-top: 1px solid #e5e7eb;
          padding-top: 0.75rem;
          margin-top: 0.75rem;
        }

        .collection-total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .collection-total-row.final {
          font-weight: 700;
          font-size: 1.1rem;
          color: #1f2937;
          border-top: 1px solid #e5e7eb;
          padding-top: 0.5rem;
          margin-top: 0.5rem;
        }

        .collection-modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .collection-confirm-btn {
          background: #059669;
          color: white;
          font-size: 1rem;
          font-weight: 600;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 150px;
        }

        .collection-confirm-btn:hover:not(:disabled) {
          background: #047857;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        }

        .collection-confirm-btn:disabled {
          background: #d1d5db;
          color: #9ca3af;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .collection-status-info {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 1rem;
          color: #065f46;
        }

        .collection-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.75rem;
          flex-wrap: wrap;
        }

        .schedule-collection-btn {
          background: #059669;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .schedule-collection-btn:hover {
          background: #047857;
          transform: translateY(-1px);
        }

        /* Pay At Store Styles */
        .pay-at-store-info {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 1rem;
          color: #92400e;
          margin-bottom: 0.75rem;
        }

        .pay-at-store-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .confirm-pay-at-store-btn {
          background: #059669;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .confirm-pay-at-store-btn:hover {
          background: #047857;
          transform: translateY(-1px);
        }

        .ready-pay-at-store-btn {
          background: #0891b2;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ready-pay-at-store-btn:hover {
          background: #0e7490;
          transform: translateY(-1px);
        }

        .complete-pay-at-store-btn {
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .complete-pay-at-store-btn:hover {
          background: #b91c1c;
          transform: translateY(-1px);
        }

        @media (max-width: 640px) {
          .collection-modal-content {
            padding: 1.5rem;
            margin: 1rem;
          }

          .collection-modal-actions {
            flex-direction: column;
          }

          .collection-confirm-btn {
            width: 100%;
          }

          .collection-actions {
            flex-direction: column;
          }

          .schedule-collection-btn {
            width: 100%;
            justify-content: center;
          }
        }
        
        /* Wallet Refund Modal Styles */
        .wallet-refund-modal {
          max-width: 550px;
          width: 90%;
          max-height: 90vh;
        }
        
        .refund-reason-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .refund-reason-label {
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #333;
        }
        
        .refund-reason-textarea {
          width: 100%;
          min-height: 120px;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.95rem;
          resize: vertical;
        }
        
        .refund-reason-textarea:focus {
          border-color: #007B7F;
          outline: none;
          box-shadow: 0 0 0 2px rgba(0, 123, 127, 0.2);
        }
        
        .refund-transaction-info {
          background: #f9f9f9;
          border: 1px solid #eee;
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 1rem;
        }
        
        .refund-transaction-info p {
          margin: 0.5rem 0;
        }
      `}
</style>

      {/* Wallet Refund Modal */}
      {showWalletRefundModal && pendingWalletRefund && (
        <div className="payment-modal-overlay" onClick={() => setShowWalletRefundModal(false)}>
          <div className="payment-modal wallet-refund-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h2>💸 Process Refund</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowWalletRefundModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-content">
              <div className="refund-transaction-info">
                <p><strong>Order ID:</strong> {pendingWalletRefund.orderId}</p>
                <p><strong>Amount:</strong> {formatCurrency(pendingWalletRefund.amount)}</p>
                <p><strong>Payment Method:</strong> {pendingWalletRefund.paymentMethod.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                <p><strong>Transaction Type:</strong> {pendingWalletRefund.transaction?.description || 'Sale'}</p>
              </div>
              
              <div className="refund-reason-form">
                <label className="refund-reason-label" htmlFor="walletRefundReason">
                  Please provide a reason for this refund: *
                </label>
                <textarea 
                  id="walletRefundReason"
                  className="refund-reason-textarea"
                  value={walletRefundReason}
                  onChange={(e) => setWalletRefundReason(e.target.value)}
                  placeholder="Please explain why you are processing this refund..."
                  required
                ></textarea>
                
                <div className="payment-actions">
                  <button 
                    className="cancel-btn" 
                    onClick={() => setShowWalletRefundModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="pay-btn"
                    disabled={!walletRefundReason.trim()}
                    onClick={() => {
                      if (!walletRefundReason.trim()) {
                        alert('Please provide a reason for the refund.');
                        return;
                      }
                      
                      // Process the refund with the reason
                      approveRefund({
                        ...pendingWalletRefund,
                        refundReason: walletRefundReason.trim()
                      }, pendingWalletRefund.amount);
                      
                      setShowWalletRefundModal(false);
                    }}
                  >
                    Process Refund
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Connect Setup Modal */}
      {showStripeConnectModal && (
        <div className="payment-modal-overlay" onClick={() => setShowStripeConnectModal(false)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h2>🏦 Stripe Connect Required</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowStripeConnectModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="payment-content">
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💳</div>
                <h3 style={{ color: '#333', marginBottom: '1rem' }}>Card Payments Need Stripe Connect</h3>
                <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  To accept <strong>card and Google Pay payments</strong>, you need to set up a Stripe Connect account first.
                  <br /><br />
                  This allows you to securely receive payments directly to your bank account.
                </p>
                
                <div style={{ 
                  background: '#f8f9fa', 
                  border: '1px solid #e9ecef', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  marginBottom: '1.5rem',
                  textAlign: 'left'
                }}>
                  <h4 style={{ color: '#495057', marginBottom: '0.5rem' }}>📋 Next Steps:</h4>
                  <ol style={{ color: '#6c757d', paddingLeft: '1.2rem' }}>
                    <li>Go to your <strong>Store Profile</strong> page</li>
                    <li>Complete the <strong>Stripe Connect setup</strong></li>
                    <li>Return here to enable card payments</li>
                  </ol>
                </div>

                <div className="modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button 
                    className="cancel-btn"
                    onClick={() => setShowStripeConnectModal(false)}
                    style={{ flex: '1', maxWidth: '120px' }}
                  >
                    Maybe Later
                  </button>
                  <button 
                    className="pay-btn"
                    onClick={() => {
                      setShowStripeConnectModal(false);
                      // Navigate to store profile page
                      window.open('/store-profile', '_blank');
                    }}
                    style={{ flex: '1', maxWidth: '150px' }}
                  >
                    Set Up Stripe Connect
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagesPage;