import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, addDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore';
import { sendManualReceipt, sendCustomReceipt } from '../utils/stripeReceipts';
import EmailReceiptModal from '../components/EmailReceiptModal';
import NotificationToast from '../components/NotificationToast';
import MessageModal from '../components/MessageModal';

function ReportsPage() {
  // Define CSS animation for the spinner and responsive styles
  const spinnerStyle = document.createElement('style');
  spinnerStyle.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Responsive table styles */
    @media (max-width: 768px) {
      .reports-table th, .reports-table td {
        padding: 0.5rem !important;
        font-size: 0.75rem !important;
      }
      .reports-table {
        font-size: 0.75rem !important;
      }
    }
    
    @media (max-width: 480px) {
      .reports-table th, .reports-table td {
        padding: 0.375rem !important;
        font-size: 0.7rem !important;
      }
      .reports-table th:nth-child(n+5), .reports-table td:nth-child(n+5) {
        display: none; /* Hide non-essential columns on very small screens */
      }
    }
  `;
  document.head.appendChild(spinnerStyle);
  
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [isSeller, setIsSeller] = useState(false);
  const [refundTransactions, setRefundTransactions] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loadingRefunds, setLoadingRefunds] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [storeRefundsEnabled, setStoreRefundsEnabled] = useState(false);
  
  // Modal states for email receipt functionality
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [receiptForEmail, setReceiptForEmail] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [messageModal, setMessageModal] = useState(null);
  const [regeneratedReceipts, setRegeneratedReceipts] = useState(() => {
    // Initialize from localStorage if available
    try {
      const savedReceipts = localStorage.getItem('regeneratedReceipts');
      return savedReceipts ? JSON.parse(savedReceipts) : [];
    } catch (error) {
      console.error('Error loading receipts from localStorage:', error);
      return [];
    }
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [receiptType, setReceiptType] = useState('refund'); // 'refund' or 'order'
  const [previewData, setPreviewData] = useState(null);
  // States for receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptModalType, setReceiptModalType] = useState('order');
  const [receiptLoading, setReceiptLoading] = useState(false);
  // States for editable receipt fields
  const [editableReceiptData, setEditableReceiptData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showFullReceiptPreview, setShowFullReceiptPreview] = useState(false);

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
  
  // Handle transaction click and set up preview data
  const handleTransactionClick = async (transaction) => {
    setSelectedTransaction(transaction);
    
    // Create preview data for the receipt
    try {
      // Determine transaction type
      const isRefund = transaction.type === 'refund_deduction' || transaction.transactionType === 'refund';
      
      // Set receipt type accordingly
      setReceiptType(isRefund ? 'refund' : 'order');
      
      // Get items using the same comprehensive fetching logic as regenerateReceipt
      const orderId = transaction.orderId || transaction.id || 'Unknown';
      console.log('Preview - Working with orderId:', orderId, 'transaction:', transaction);
      
      // Enhanced function to fetch items from multiple sources (same as regenerateReceipt)
      const fetchOrderItemsForPreview = async (orderId, transactionItems) => {
        // If we already have items, return them
        if (transactionItems && transactionItems.length > 0) {
          console.log('Preview - Using items from transaction:', transactionItems.length);
          return transactionItems;
        }

        if (!orderId || orderId === 'Unknown') {
          console.log('Preview - No valid orderId for item fetching');
          return [];
        }

        console.log('Preview - Fetching items for orderId:', orderId);

        // Try multiple sources for items
        try {
          // 1. Check transactions collection
          const transactionQuery = query(
            collection(db, 'transactions'),
            where('orderId', '==', orderId),
            limit(1)
          );
          
          const transactionSnapshot = await getDocs(transactionQuery);
          if (!transactionSnapshot.empty) {
            const transactionDoc = transactionSnapshot.docs[0].data();
            if (transactionDoc.items && transactionDoc.items.length > 0) {
              console.log('Preview - Found items in transactions collection:', transactionDoc.items.length);
              return transactionDoc.items;
            }
          }

          // 2. Check payments collection
          const paymentsQuery = query(
            collection(db, 'payments'),
            where('orderId', '==', orderId),
            limit(1)
          );
          
          const paymentsSnapshot = await getDocs(paymentsQuery);
          if (!paymentsSnapshot.empty) {
            const paymentDoc = paymentsSnapshot.docs[0].data();
            if (paymentDoc.items && paymentDoc.items.length > 0) {
              console.log('Preview - Found items in payments collection:', paymentDoc.items.length);
              return paymentDoc.items;
            }
          }

          // 3. Check messages collection for payment_completed messages
          const messagesQuery = query(
            collection(db, 'messages'),
            where('orderId', '==', orderId),
            where('messageType', 'in', ['payment_completed', 'payment_notification']),
            limit(1)
          );
          
          const messagesSnapshot = await getDocs(messagesQuery);
          if (!messagesSnapshot.empty) {
            const messageDoc = messagesSnapshot.docs[0].data();
            if (messageDoc.orderData?.items && messageDoc.orderData.items.length > 0) {
              console.log('Preview - Found items in messages.orderData:', messageDoc.orderData.items.length);
              return messageDoc.orderData.items;
            }
            if (messageDoc.paymentData?.items && messageDoc.paymentData.items.length > 0) {
              console.log('Preview - Found items in messages.paymentData:', messageDoc.paymentData.items.length);
              return messageDoc.paymentData.items;
            }
          }

          // 4. Check orders collection
          const ordersQuery = query(
            collection(db, 'orders'),
            where('orderId', '==', orderId),
            limit(1)
          );
          
          const ordersSnapshot = await getDocs(ordersQuery);
          if (!ordersSnapshot.empty) {
            const orderDoc = ordersSnapshot.docs[0].data();
            if (orderDoc.items && orderDoc.items.length > 0) {
              console.log('Preview - Found items in orders collection:', orderDoc.items.length);
              return orderDoc.items;
            }
          }

          // 5. Check orderStates collection
          const orderStatesQuery = query(
            collection(db, 'orderStates'),
            where('orderId', '==', orderId),
            limit(1)
          );
          
          const orderStatesSnapshot = await getDocs(orderStatesQuery);
          if (!orderStatesSnapshot.empty) {
            const orderStateDoc = orderStatesSnapshot.docs[0].data();
            if (orderStateDoc.items && orderStateDoc.items.length > 0) {
              console.log('Preview - Found items in orderStates collection:', orderStateDoc.items.length);
              return orderStateDoc.items;
            }
          }

          console.log('Preview - No items found in any collection for orderId:', orderId);
          return [];
          
        } catch (error) {
          console.error('Preview - Error fetching order items:', error);
          return [];
        }
      };

      // Fetch items before creating preview
      const previewItems = await fetchOrderItemsForPreview(orderId, transaction.items);
      console.log('Preview - Final previewItems result:', previewItems.length, 'items:', previewItems);
      
      // Set initial preview data, ensuring no undefined values
      const preview = {
        id: transaction.id,
        orderId: orderId,
        customerId: transaction.customerId,
        customerName: transaction.customerName || 'Unknown Customer',
        items: previewItems,
        currency: transaction.currency || 'GBP',
        amount: transaction.amount || transaction.totalAmount || 0,
        totalAmount: transaction.totalAmount || transaction.amount || 0,
        paymentMethod: transaction.paymentMethod || 'Online Payment',
        createdAt: transaction.createdAt,
        refundReason: transaction.refundReason || null,
        customerEmail: transaction.customerEmail || null,
        customerPhone: transaction.customerPhone || null,
        deliveryAddress: transaction.deliveryAddress || transaction.shippingAddress || null,
        shippingAddress: transaction.shippingAddress || null,
        // Add store and delivery info for editing
        storeName: "",
        storePhone: "",
        deliveryMethod: "Not specified"
      };
      
      // If customer ID exists, try to fetch additional customer information
      if (transaction.customerId) {
        try {
          const customerDoc = await getDoc(doc(db, 'users', transaction.customerId));
          if (customerDoc.exists()) {
            const customerData = customerDoc.data();
            preview.customerEmail = preview.customerEmail || customerData.email;
            preview.customerPhone = preview.customerPhone || customerData.phone || customerData.phoneNumber;
            
            // Get address if not already present
            if (!preview.deliveryAddress) {
              if (customerData.address) {
                preview.deliveryAddress = customerData.address;
              } else if (customerData.addresses && customerData.addresses.length > 0) {
                const defaultAddress = customerData.addresses.find(addr => addr.isDefault) || customerData.addresses[0];
                preview.deliveryAddress = defaultAddress.formattedAddress || 
                  `${defaultAddress.street || ''}, ${defaultAddress.city || ''}, ${defaultAddress.state || ''} ${defaultAddress.postalCode || ''}, ${defaultAddress.country || ''}`.trim();
              }
            }
          }
        } catch (error) {
          console.error('Error fetching customer details:', error);
        }
      }
      
      // Always try to fetch items from Firestore for better accuracy
      if (transaction.orderId) {
        console.log("Attempting to fetch items from Firestore for order:", transaction.orderId);
        
        // Try orders collection first (preferred source)
        try {
          const orderRef = doc(db, 'orders', transaction.orderId);
          const orderDoc = await getDoc(orderRef);
          
          if (orderDoc.exists()) {
            const orderData = orderDoc.data();
            console.log("Found order document in orders collection:", transaction.orderId);
            
            // Get items if available
            if (orderData.items && orderData.items.length > 0) {
              console.log("Successfully retrieved items from orders collection:", orderData.items.length);
              preview.items = orderData.items;
            }
            
            // Get delivery method if available
            if (orderData.deliveryMethod) {
              preview.deliveryMethod = orderData.deliveryMethod;
            } else if (orderData.deliveryType) {
              preview.deliveryMethod = orderData.deliveryType;
            } else if (orderData.shippingMethod) {
              preview.deliveryMethod = orderData.shippingMethod;
            }
          } else {
            // Try using a query with orderId field as fallback
            console.log("Order doc not found by ID, trying query with orderId field");
            const orderQuery = query(
              collection(db, 'orders'),
              where('orderId', '==', transaction.orderId),
              limit(1)
            );
            
            const orderSnapshot = await getDocs(orderQuery);
            if (!orderSnapshot.empty) {
              const orderData = orderSnapshot.docs[0].data();
              console.log("Found order via query with orderId field");
              
              if (orderData.items && orderData.items.length > 0) {
                console.log("Retrieved items from order query:", orderData.items.length);
                preview.items = orderData.items;
              }
              
              // Get delivery method if available
              if (orderData.deliveryMethod) {
                preview.deliveryMethod = orderData.deliveryMethod;
              } else if (orderData.deliveryType) {
                preview.deliveryMethod = orderData.deliveryType;
              } else if (orderData.shippingMethod) {
                preview.deliveryMethod = orderData.shippingMethod;
              }
            } else {
              console.log("No order found with orderId:", transaction.orderId);
            }
          }
        } catch (error) {
          console.error('Error fetching order items from orders collection:', error);
        }
      }
      
      // Get store information from Firestore
      try {
        const storeDoc = await getDoc(doc(db, 'stores', currentUser.uid));
        if (storeDoc.exists()) {
          const storeData = storeDoc.data();
          preview.storeName = storeData.name || storeData.displayName || storeData.storeName || currentUser.displayName || storeData.businessName || "";
          preview.storePhone = storeData.phone || storeData.phoneNumber || storeData.contactNumber || "";
        } else {
          preview.storeName = currentUser.displayName || "";
        }
      } catch (error) {
        console.error('Error fetching store details:', error);
        preview.storeName = currentUser.displayName || "";
      }
      
      // Update the preview data
      setPreviewData(preview);
      
      // Initialize editable receipt data
      setEditableReceiptData({
        ...preview,
        refundReason: preview.refundReason || 'Not specified',
        deliveryMethod: preview.deliveryMethod || 'Not specified',
        storeName: preview.storeName,
        storePhone: preview.storePhone || ''
      });
      
      // Open the modal
      setShowReceiptModal(true);
      setIsEditing(false); // Start in view mode
      
    } catch (error) {
      console.error('Error preparing transaction preview:', error);
      // Use basic data without the additional lookups
      const basicData = {
        ...transaction,
        customerName: transaction.customerName || 'Unknown Customer',
        storeName: currentUser.displayName || "",
        storePhone: "",
        deliveryMethod: "Not specified"
      };
      
      setPreviewData(basicData);
      setEditableReceiptData(basicData);
      
      // Still open the modal even if there was an error
      setShowReceiptModal(true);
    }
  };
  
  // Function to open receipt generation modal
  const openReceiptModal = (transaction) => {
    setSelectedTransaction(transaction);
    handleTransactionClick(transaction); // This will fetch preview data
    setShowReceiptModal(true);
  };
  
  // Function to close the receipt modal
  const closeReceiptModal = () => {
    setShowReceiptModal(false);
    setReceiptLoading(false);
    setIsEditing(false);
    setShowFullReceiptPreview(false);
    // Keep the selected transaction data for a brief moment in case the user reopens the modal
    setTimeout(() => {
      if (!showReceiptModal) {
        setSelectedTransaction(null);
        setPreviewData(null);
        setEditableReceiptData(null);
      }
    }, 500);
  };
  
  // Function to handle receipt type selection
  const handleReceiptTypeChange = (type) => {
    setReceiptType(type);
  };
  
  // Function to send the receipt from modal
  const handleSendReceipt = async () => {
    if (!selectedTransaction) return;
    
    setReceiptLoading(true);
    try {
      await regenerateReceipt(selectedTransaction, isEditing); // Pass flag to use edited data if we're in edit mode
      closeReceiptModal();
    } catch (error) {
      console.error("Error sending receipt:", error);
      alert("Error sending receipt: " + error.message);
    } finally {
      setReceiptLoading(false);
    }
  };
  
  // Function to handle changes to editable receipt fields
  const handleReceiptFieldChange = (field, value) => {
    setEditableReceiptData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Function to toggle edit mode
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
  };
  
  // Function to toggle full receipt preview
  const toggleFullReceiptPreview = () => {
    setShowFullReceiptPreview(!showFullReceiptPreview);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_review': return '#F59E0B';
      case 'resolved': return '#10B981';
      case 'serious_complaint': return '#EF4444';
      case 'cancelled': return '#EF4444';
      case 'cancelled_and_refunded': return '#8B5CF6'; // Purple for refunded status
      default: return '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending_review': return 'Pending Review';
      case 'resolved': return 'Resolved';
      case 'serious_complaint': return 'Serious Complaint';
      case 'cancelled': return '❌ Cancelled';
      case 'cancelled_and_refunded': return '💰 Cancelled & Refunded';
      default: return status;
    }
  };
  
  // Function to determine transaction status
  const getTransactionStatus = (transaction) => {
    if (transaction.transactionType === 'refund') {
      return 'cancelled_and_refunded';
    }
    
    // For regular orders, check if there's a status field
    if (transaction.status) {
      return transaction.status;
    }
    
    return transaction.orderStatus || 'unknown';
  };
  
  // Function to regenerate receipt for a transaction
  const regenerateReceipt = async (transaction, useEditableData = false) => {
    if (!currentUser) {
      alert('You must be logged in to regenerate a receipt');
      return;
    }
    
    // Make sure we have a customerId in the transaction
    if (!transaction.customerId) {
      alert('Error: Cannot send receipt because customer information is missing');
      console.error('Missing customerId in transaction:', transaction);
      return;
    }
    
    // If we're using editable data, use that instead of fetching from Firestore
    const useCustomData = useEditableData && editableReceiptData;
    
    // Initialize orderData object to store receipt information
    let orderData = {};
    
    try {
      // Set loading indicator
      const loadingNotification = document.createElement('div');
      loadingNotification.innerHTML = `⏳ Fetching additional order information...`;
      loadingNotification.style.cssText = `
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
      document.body.appendChild(loadingNotification);
      
      // Determine transaction type
      const isRefund = transaction.type === 'refund_deduction' || transaction.transactionType === 'refund';
      
      // Initialize variables for store information and delivery method
      // Initialize without a default store name to ensure we fetch from proper source
      let storeName = null; // Using null ensures we'll use proper fallbacks later
      let storePhone = "";
      let deliveryMethod = "Not specified"; // Default fallback
      
      if (useCustomData) {
        // Use the edited data provided by the user
        console.log("Using custom edited receipt data");
        storeName = editableReceiptData.storeName || currentUser.displayName || "";
        storePhone = editableReceiptData.storePhone || "";
        deliveryMethod = editableReceiptData.deliveryMethod || "Not specified";
        
        // Log store name from custom data for debugging
        console.log("Store name from custom data:", storeName);
        
        // Add comprehensive store information to orderData when using custom data
        orderData.storeName = storeName;
        orderData.storePhone = storePhone;
        orderData.storeAddress = editableReceiptData.storeAddress || "";
        orderData.storeEmail = editableReceiptData.storeEmail || "";
        orderData.storeBusinessId = editableReceiptData.storeBusinessId || "";
        orderData.storeRegistrationNumber = editableReceiptData.storeRegistrationNumber || "";
        orderData.storeVatNumber = editableReceiptData.storeVatNumber || "";
        
        console.log("Using custom store name:", storeName);
        console.log("Using custom delivery method:", deliveryMethod);
      } else {
        // Get store details from Firestore - MUST get this first
        try {
          const storeDoc = await getDoc(doc(db, 'stores', currentUser.uid));
          if (storeDoc.exists()) {
            const storeData = storeDoc.data();
            // Get store name from Firestore with comprehensive fallbacks
            storeName = storeData.name || storeData.displayName || storeData.storeName || storeData.businessName || currentUser.displayName || "";
            
            // Log fetched store name for debugging
            console.log("Fetched store name from Firestore:", storeName);
            
            // Get store phone with comprehensive fallbacks
            storePhone = storeData.phone || 
                        storeData.phoneNumber || 
                        storeData.contactNumber || 
                        storeData.businessPhone ||
                        storeData.storePhone ||
                        storeData.contactPhone ||
                        storeData.mobile ||
                        "";
            
            console.log("Successfully fetched store name from Firestore:", storeName);
            
            // Extract business identification information
            let storeBusinessId = storeData.businessId || '';
            let storeRegistrationNumber = '';
            let storeVatNumber = '';
            
            // Enhanced address detection with comprehensive field paths
            let storeAddress = storeData.storeLocation || 
                             storeData.address || 
                             storeData.businessAddress || 
                             storeData.storeAddress ||
                             (storeData.location?.address) || 
                             (typeof storeData.location === 'string' ? storeData.location : '') ||
                             storeData.fullAddress ||
                             storeData.streetAddress ||
                             '';
                             
            let storeEmail = storeData.email || storeData.contactEmail || storeData.businessEmail || '';
            
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
            
            // Add these to orderData for receipt generation
            orderData.storeName = storeName; // Add storeName to orderData
            orderData.storePhone = storePhone; // Add storePhone to orderData
            orderData.storeBusinessId = storeBusinessId;
            orderData.storeRegistrationNumber = storeRegistrationNumber;
            orderData.storeVatNumber = storeVatNumber;
            orderData.storeAddress = storeAddress;
            orderData.storeEmail = storeEmail;
            
            // Try to get store's default delivery methods from Firestore settings
            if (storeData.deliverySettings) {
              if (storeData.deliverySettings.defaultMethod) {
                deliveryMethod = storeData.deliverySettings.defaultMethod;
                console.log("Found default delivery method in store settings:", deliveryMethod);
              } else if (storeData.deliverySettings.methods && storeData.deliverySettings.methods.length > 0) {
                // If there's an array of methods, use the first one as default
                deliveryMethod = storeData.deliverySettings.methods[0].name || storeData.deliverySettings.methods[0].type;
                console.log("Using first delivery method from store settings:", deliveryMethod);
              }
            } else if (storeData.deliveryOptions) {
              if (typeof storeData.deliveryOptions === 'string') {
                deliveryMethod = storeData.deliveryOptions;
              } else if (Array.isArray(storeData.deliveryOptions) && storeData.deliveryOptions.length > 0) {
                deliveryMethod = storeData.deliveryOptions[0].name || storeData.deliveryOptions[0];
              }
              console.log("Found delivery options in store data:", deliveryMethod);
            }
          } else {
            console.warn("Store document doesn't exist in Firestore, using display name");
            storeName = currentUser.displayName || "";
          }
        } catch (storeError) {
          console.error("Error fetching store from Firestore:", storeError);
          // Fallback to display name if Firestore fetch fails
          storeName = currentUser.displayName || "";
        }
        
        // PRIORITY 1: Try to get specific delivery method from the transaction since this is most accurate
        if (transaction.deliveryMethod) {
          deliveryMethod = transaction.deliveryMethod;
          console.log("Using delivery method from transaction:", deliveryMethod);
        } else if (transaction.deliveryType) {
          deliveryMethod = transaction.deliveryType;
          console.log("Using deliveryType from transaction:", deliveryMethod);
        } else if (transaction.shippingMethod) {
          deliveryMethod = transaction.shippingMethod;
          console.log("Using shippingMethod from transaction:", deliveryMethod);
        }
        
        // PRIORITY 2: If not in transaction, try to get it from the order document
        if (transaction.orderId && deliveryMethod === "Not specified") {
          try {
            // Try different collections where order might exist
            const orderRef = doc(db, 'orders', transaction.orderId);
            const orderDoc = await getDoc(orderRef);
            
            if (orderDoc.exists()) {
              const orderData = orderDoc.data();
              // Try all possible field names for delivery method
              if (orderData.deliveryMethod) {
                deliveryMethod = orderData.deliveryMethod;
              } else if (orderData.deliveryType) {
                deliveryMethod = orderData.deliveryType;
              } else if (orderData.shippingMethod) {
                deliveryMethod = orderData.shippingMethod;
              } else if (orderData.shipping && orderData.shipping.method) {
                deliveryMethod = orderData.shipping.method;
              } else if (orderData.delivery && orderData.delivery.method) {
                deliveryMethod = orderData.delivery.method;
              }
              
              console.log("Found delivery method in orders collection:", deliveryMethod);
            }
          } catch (err) {
            console.log("Error fetching order for delivery method:", err);
          }
        }
      }
        
      // Format the delivery method nicely
      const formatDeliveryMethod = (method) => {
        if (!method || method === "Not specified") return "Not specified";
        return method
          .replace(/_/g, ' ')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
      };
      
      // Enhanced function to fetch items from multiple sources
      const fetchOrderItems = async (orderId, transactionItems) => {
        // If we already have items, return them
        if (transactionItems && transactionItems.length > 0) {
          console.log('Using items from transaction:', transactionItems.length);
          return transactionItems;
        }

        if (!orderId || orderId === 'Unknown') {
          console.log('No valid orderId for item fetching');
          return [];
        }

        console.log('Fetching items for orderId:', orderId);

        // Try multiple sources for items
        try {
          // 1. Check transactions collection
          const transactionQuery = query(
            collection(db, 'transactions'),
            where('orderId', '==', orderId),
            limit(1)
          );
          
          const transactionSnapshot = await getDocs(transactionQuery);
          if (!transactionSnapshot.empty) {
            const transactionDoc = transactionSnapshot.docs[0].data();
            if (transactionDoc.items && transactionDoc.items.length > 0) {
              console.log('Found items in transactions collection:', transactionDoc.items.length);
              return transactionDoc.items;
            }
          }

          // 2. Check payments collection
          const paymentsQuery = query(
            collection(db, 'payments'),
            where('orderId', '==', orderId),
            limit(1)
          );
          
          const paymentsSnapshot = await getDocs(paymentsQuery);
          if (!paymentsSnapshot.empty) {
            const paymentDoc = paymentsSnapshot.docs[0].data();
            if (paymentDoc.items && paymentDoc.items.length > 0) {
              console.log('Found items in payments collection:', paymentDoc.items.length);
              return paymentDoc.items;
            }
          }

          // 3. Check messages collection for payment_completed messages
          const messagesQuery = query(
            collection(db, 'messages'),
            where('orderId', '==', orderId),
            where('messageType', 'in', ['payment_completed', 'payment_notification']),
            limit(1)
          );
          
          const messagesSnapshot = await getDocs(messagesQuery);
          if (!messagesSnapshot.empty) {
            const messageDoc = messagesSnapshot.docs[0].data();
            if (messageDoc.orderData?.items && messageDoc.orderData.items.length > 0) {
              console.log('Found items in messages.orderData:', messageDoc.orderData.items.length);
              return messageDoc.orderData.items;
            }
            if (messageDoc.paymentData?.items && messageDoc.paymentData.items.length > 0) {
              console.log('Found items in messages.paymentData:', messageDoc.paymentData.items.length);
              return messageDoc.paymentData.items;
            }
          }

          // 4. Check orders collection
          const ordersQuery = query(
            collection(db, 'orders'),
            where('orderId', '==', orderId),
            limit(1)
          );
          
          const ordersSnapshot = await getDocs(ordersQuery);
          if (!ordersSnapshot.empty) {
            const orderDoc = ordersSnapshot.docs[0].data();
            if (orderDoc.items && orderDoc.items.length > 0) {
              console.log('Found items in orders collection:', orderDoc.items.length);
              return orderDoc.items;
            }
          }

          // 5. Check orderStates collection
          const orderStatesQuery = query(
            collection(db, 'orderStates'),
            where('orderId', '==', orderId),
            limit(1)
          );
          
          const orderStatesSnapshot = await getDocs(orderStatesQuery);
          if (!orderStatesSnapshot.empty) {
            const orderStateDoc = orderStatesSnapshot.docs[0].data();
            if (orderStateDoc.items && orderStateDoc.items.length > 0) {
              console.log('Found items in orderStates collection:', orderStateDoc.items.length);
              return orderStateDoc.items;
            }
          }

          console.log('No items found in any collection for orderId:', orderId);
          return [];
          
        } catch (error) {
          console.error('Error fetching order items:', error);
          return [];
        }
      };

      // Get the orderId for item fetching
      const orderId = transaction.orderId || transaction.id || 'Unknown';
      console.log('RegenerateReceipt - Working with orderId:', orderId, 'transaction:', transaction);
      
      // Fetch items before creating orderData
      const orderItems = await fetchOrderItems(orderId, transaction.items);
      console.log('Final orderItems result:', orderItems.length, 'items:', orderItems);
      
      // Initial order data from the transaction or edited data
      let orderData;
      
      if (useCustomData) {
        // Use the custom edited data provided by the user
        orderData = {
          // Order details
          orderId: editableReceiptData.orderId || orderId,
          customerId: editableReceiptData.customerId || transaction.customerId || 'Unknown',
          customerName: editableReceiptData.customerName || transaction.customerName || 'Customer',
          items: editableReceiptData.items || orderItems,
          totalAmount: Math.abs(editableReceiptData.amount || editableReceiptData.totalAmount || 
                              transaction.amount || transaction.totalAmount) || 0,
          currency: editableReceiptData.currency || transaction.currency || 'GBP',
          refundReason: isRefund ? (editableReceiptData.refundReason || 'Not specified') : null,
          transactionId: editableReceiptData.transactionId || transaction.transactionId || transaction.id,
          refundId: isRefund ? transaction.id : null,
          paymentMethod: editableReceiptData.paymentMethod || transaction.paymentMethod || 'Online Payment',
          orderDate: editableReceiptData.orderDate || transaction.orderDate || transaction.createdAt,
          
          // Customer details - use edited values
          customerEmail: editableReceiptData.customerEmail || null,
          customerPhone: editableReceiptData.customerPhone || null,
          deliveryAddress: editableReceiptData.deliveryAddress || null,
          
          // Additional details - use edited values
          deliveryMethod: formatDeliveryMethod(editableReceiptData.deliveryMethod),
          subtotal: editableReceiptData.subtotal || transaction.subtotal || null,
          tax: editableReceiptData.tax || transaction.tax || null,
          deliveryFee: editableReceiptData.deliveryFee || transaction.deliveryFee || null,
          
          // Store information - use edited values with proper fallbacks
          storeId: currentUser.uid,
          storeName: editableReceiptData.storeName || storeName || currentUser.displayName || "Store",
          storePhone: editableReceiptData.storePhone || storePhone || ""
        };
      } else {
        // Use transaction data with Firestore enrichment
        orderData = {
          // Order details
          orderId: orderId,
          customerId: transaction.customerId || 'Unknown',
          customerName: transaction.customerName || 'Customer',
          items: orderItems,
          totalAmount: Math.abs(transaction.amount || transaction.totalAmount) || 0,
          currency: transaction.currency || 'GBP',
          refundReason: isRefund ? (transaction.refundReason || 'Not specified') : null,
          transactionId: transaction.transactionId || transaction.id,
          refundId: isRefund ? transaction.id : null,
          paymentMethod: transaction.paymentMethod || 'Online Payment',
          orderDate: transaction.orderDate || transaction.createdAt,
          
          // Customer details - ensure no undefined values
          customerEmail: transaction.customerEmail || (transaction.customerData?.email) || null,
          customerPhone: transaction.customerPhone || (transaction.customerData?.phone) || null,
          deliveryAddress: transaction.deliveryAddress || transaction.shippingAddress || (transaction.customerData?.address) || null,
          
          // Additional details - use null instead of undefined for missing values
          // Using the delivery method we fetched earlier - format it nicely
          deliveryMethod: formatDeliveryMethod(deliveryMethod), // Dynamically fetched from Firestore/transaction/order
          subtotal: transaction.subtotal || null,
          tax: transaction.tax || null,
          deliveryFee: transaction.deliveryFee || null,
          
          // Store information - using the values we dynamically fetched from Firestore
          storeId: currentUser.uid,
          storeName: storeName || currentUser.displayName || "Store", // Dynamically fetched from Firestore
          storePhone: storePhone // Dynamically fetched from Firestore
        };
        
        // Log the store name being used in the non-custom data case
        console.log("Using store name in non-custom data case:", storeName || currentUser.displayName || "Store");
      }
      
      // Check if we have a valid customerId to send the receipt to
      if (!orderData.customerId || orderData.customerId === 'Unknown') {
        // If customerId is missing, try to find it from other data sources
        try {
          const orderQuery = query(
            collection(db, 'orders'), 
            where('orderId', '==', orderData.orderId),
            limit(1)
          );
          
          const orderSnapshot = await getDocs(orderQuery);
          if (!orderSnapshot.empty) {
            const orderDoc = orderSnapshot.docs[0].data();
            // Get customer information
            orderData.customerId = orderDoc.customerId || orderData.customerId;
            orderData.customerName = orderDoc.customerName || orderData.customerName;
            
            // Get delivery details - only update address, keep our already fetched delivery method
            orderData.deliveryAddress = orderDoc.deliveryAddress || orderDoc.shippingAddress || orderData.deliveryAddress;
            
            // Keep the delivery method we already fetched if possible, but update if still "Not specified"
            if (orderData.deliveryMethod === "Not specified") {
              orderData.deliveryMethod = orderDoc.deliveryType || orderDoc.deliveryMethod || orderDoc.shippingMethod || orderData.deliveryMethod;
            }
            
            // Get customer contact information
            orderData.customerEmail = orderDoc.customerEmail || orderData.customerEmail;
            orderData.customerPhone = orderDoc.customerPhone || orderData.customerPhone;
            
            // Get pricing details
            orderData.subtotal = orderDoc.subtotal || orderData.subtotal;
            orderData.tax = orderDoc.tax || orderData.tax;
            orderData.deliveryFee = orderDoc.deliveryFee || orderData.deliveryFee;
            
            // Keep our Firestore-fetched store details, don't override them with potentially outdated info
            orderData.storeId = orderData.storeId || orderDoc.storeId || orderDoc.sellerId || orderDoc.sellerUid;
            // Keep the store name we already fetched directly from Firestore
          }
        } catch (orderError) {
          console.error('Error fetching order details:', orderError);
        }
      }
      
      // If we still don't have customer ID, show error
      if (!orderData.customerId || orderData.customerId === 'Unknown') {
        document.body.removeChild(loadingNotification);
        alert('Cannot regenerate receipt: missing customer information');
        return;
      }
      
      // Try to get customer details from users collection
      try {
        const customerDocRef = doc(db, 'users', orderData.customerId);
        const customerDoc = await getDoc(customerDocRef);
        
        if (customerDoc.exists()) {
          const customerData = customerDoc.data();
          // Only update if we don't already have this information, safely handling undefined values
          orderData.customerName = orderData.customerName === 'Customer' ? customerData.displayName || customerData.name || orderData.customerName : orderData.customerName;
          
          // Use null rather than undefined for empty values
          if (!orderData.customerEmail && customerData.email) {
            orderData.customerEmail = customerData.email;
          }
          
          if (!orderData.customerPhone && (customerData.phone || customerData.phoneNumber)) {
            orderData.customerPhone = customerData.phone || customerData.phoneNumber || null;
          }
          
          // Get address information safely
          if (!orderData.deliveryAddress) {
            if (customerData.address) {
              orderData.deliveryAddress = customerData.address;
            } else if (customerData.addresses && customerData.addresses.length > 0) {
              // If there are multiple addresses, use the default or first one
              const defaultAddress = customerData.addresses.find(addr => addr.isDefault) || customerData.addresses[0];
              if (defaultAddress.formattedAddress) {
                orderData.deliveryAddress = defaultAddress.formattedAddress;
              } else {
                const addressParts = [
                  defaultAddress.street || '',
                  defaultAddress.city || '',
                  defaultAddress.state || '',
                  defaultAddress.postalCode || '',
                  defaultAddress.country || ''
                ].filter(part => part !== '');
                
                if (addressParts.length > 0) {
                  orderData.deliveryAddress = addressParts.join(', ');
                } else {
                  orderData.deliveryAddress = null;
                }
              }
            } else {
              orderData.deliveryAddress = null;
            }
          }
        }
      } catch (customerError) {
        console.error('Error fetching customer details:', customerError);
      }
      
      // We already fetched the store details directly at the beginning of the function
      // No need for additional store information retrieval
      console.log('Using store information from direct fetch:', {
        storeName: orderData.storeName,
        storePhone: orderData.storePhone
      });
      
      // Try to get original order details if we have an orderId but missing items
      if (orderData.orderId && orderData.orderId !== 'Unknown' && (!orderData.items || orderData.items.length === 0)) {
        try {
          // Check transactions collection for original order
          const transactionQuery = query(
            collection(db, 'transactions'),
            where('orderId', '==', orderData.orderId),
            where('type', '==', 'payment'),
            limit(1)
          );
          
          const transactionSnapshot = await getDocs(transactionQuery);
          if (!transactionSnapshot.empty) {
            const transactionDoc = transactionSnapshot.docs[0].data();
            
            // Get pricing details
            orderData.subtotal = transactionDoc.subtotal || orderData.subtotal;
            orderData.tax = transactionDoc.tax || orderData.tax;
            orderData.deliveryFee = transactionDoc.deliveryFee || orderData.deliveryFee;
            
            // Keep our Firestore-fetched store details, don't override
            
            // Update delivery method only if we still don't have one
            if (orderData.deliveryMethod === "Not specified") {
              orderData.deliveryMethod = transactionDoc.deliveryMethod || transactionDoc.deliveryType || transactionDoc.shippingMethod || orderData.deliveryMethod;
            }
          }
          
          // If still no items, check messages collection for payment_completed messages
          if (!orderData.items || orderData.items.length === 0) {
            const messagesQuery = query(
              collection(db, 'messages'),
              where('orderData.orderId', '==', orderData.orderId),
              where('messageType', 'in', ['payment_completed', 'payment_notification']),
              limit(1)
            );
            
            const messagesSnapshot = await getDocs(messagesQuery);
            if (!messagesSnapshot.empty) {
              const messageDoc = messagesSnapshot.docs[0].data();
              
              // Get data from orderData if it exists
              if (messageDoc.orderData) {
                // Get items
                // Keep storeId if needed but don't override our Firestore-fetched store name
                orderData.storeId = orderData.storeId || messageDoc.orderData.storeId || messageDoc.orderData.sellerId || 
                    messageDoc.orderData.sellerUid;
                
                // Only update delivery method if we still don't have one
                if (orderData.deliveryMethod === "Not specified") {
                  orderData.deliveryMethod = messageDoc.orderData.deliveryMethod || 
                      messageDoc.orderData.deliveryType || 
                      messageDoc.orderData.shippingMethod ||
                      (messageDoc.orderData.delivery && messageDoc.orderData.delivery.method) ||
                      (messageDoc.orderData.shipping && messageDoc.orderData.shipping.method) ||
                      orderData.deliveryMethod;
                  
                  console.log("Updated delivery method from message orderData:", orderData.deliveryMethod);
                }
              } 
              // Try paymentData as an alternative
              else if (messageDoc.paymentData) {
                // Keep storeId if needed but don't override our Firestore-fetched store name
                orderData.storeId = orderData.storeId || messageDoc.paymentData.storeId || messageDoc.paymentData.sellerId || 
                    messageDoc.paymentData.sellerUid;
                
                // Only update delivery method if we still don't have one
                if (orderData.deliveryMethod === "Not specified") {
                  orderData.deliveryMethod = messageDoc.paymentData.deliveryMethod || 
                      messageDoc.paymentData.deliveryType || 
                      messageDoc.paymentData.shippingMethod ||
                      (messageDoc.paymentData.delivery && messageDoc.paymentData.delivery.method) ||
                      (messageDoc.paymentData.shipping && messageDoc.paymentData.shipping.method) ||
                      orderData.deliveryMethod;
                  
                  console.log("Updated delivery method from message paymentData:", orderData.deliveryMethod);
                }
              }
              
              // Don't override our Firestore-fetched store information with message data
            }
          }
        } catch (orderDetailsError) {
          console.error('Error fetching order details:', orderDetailsError);
        }
      }
      
      // We already have store information from the direct Firestore fetch at the beginning
      // No additional store lookup needed
      
      // Remove loading notification safely
      try {
        if (document.body.contains(loadingNotification)) {
          document.body.removeChild(loadingNotification);
        }
      } catch (err) {
        console.log('Loading notification already removed:', err);
      }
      
      // CRITICAL: Check if we have a valid customer ID to send to
      if (!orderData.customerId) {
        alert('Error: Cannot send receipt because customer ID is missing');
        return;
      }
      
      // Create a conversation ID between seller and customer
      // Make sure the IDs are in the correct order: we want the conversation between the seller and customer
      // The smaller ID must be first for consistency
      const conversationId = [currentUser.uid, orderData.customerId].sort().join('_');
      
      console.log('Creating receipt with conversation ID:', conversationId);
      console.log('Seller ID:', currentUser.uid);
      console.log('Customer ID:', orderData.customerId);
      
      // Format items with proper spacing for receipt - with error handling
      let formattedItems;
      try {
        formattedItems = orderData.items && orderData.items.length 
          ? orderData.items.map(item => {
              try {
                const itemName = item.itemName || item.name || 'Product';
                const itemPrice = formatPrice(item.price || 0, orderData.currency);
                const lineTotal = formatPrice((item.price || 0) * (item.quantity || 1), orderData.currency);
                return `• ${itemName} x${item.quantity || 1}  ${getCurrencySymbol(orderData.currency)}${itemPrice} = ${getCurrencySymbol(orderData.currency)}${lineTotal}`;
              } catch (itemError) {
                console.error('Error formatting item:', itemError);
                return '• Item information unavailable';
              }
            }).join('\n')
          : isRefund ? '• Refund for order' : '• Order items not available';
      } catch (itemsError) {
        console.error('Error processing items list:', itemsError);
        formattedItems = isRefund ? '• Refund for order' : '• Order items not available';
      }
      
      // Format date
      const receiptDate = new Date().toLocaleString();
      const originalOrderDate = orderData.orderDate ? formatDate(orderData.orderDate) : 'Unknown';
      
      // Format address if available, ensuring no undefined values
      const addressFormatted = orderData.deliveryAddress && orderData.deliveryAddress !== null
        ? `\nDelivery Address:
${orderData.deliveryAddress}`
        : '';
        
      // Format contact information if available, ensuring no undefined values
      let contactInfo = '';
      const hasEmail = orderData.customerEmail && orderData.customerEmail !== null;
      const hasPhone = orderData.customerPhone && orderData.customerPhone !== null;
      
      if (hasEmail || hasPhone) {
        contactInfo = `\nContact Information:`;
        if (hasEmail) contactInfo += `\nEmail: ${orderData.customerEmail}`;
        if (hasPhone) contactInfo += `\nPhone: ${orderData.customerPhone}`;
      }
      
      // Format price breakdown
      const priceBreakdown = [];
      if (orderData.subtotal) priceBreakdown.push(`Subtotal: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.subtotal, orderData.currency)}`);
      if (orderData.tax) priceBreakdown.push(`Tax: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.tax, orderData.currency)}`);
      if (orderData.deliveryFee) priceBreakdown.push(`Delivery Fee: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.deliveryFee, orderData.currency)}`);
      
      const priceBreakdownFormatted = priceBreakdown.length > 0 
        ? `\n${priceBreakdown.join('\n')}`
        : '';
      
      // Filter out any undefined values from orderData to prevent Firestore errors
      const sanitizedOrderData = {};
      Object.keys(orderData).forEach(key => {
        if (orderData[key] !== undefined) {
          sanitizedOrderData[key] = orderData[key];
        }
      });
      
      // Format additional fees if available
      let feeBreakdown = '';
      if (orderData.serviceFee) {
        feeBreakdown += `\nService Fee: ${orderData.serviceFee}%`;
      }
      if (orderData.deliveryFee) {
        feeBreakdown += `\nDelivery Fee: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.deliveryFee, orderData.currency)}`;
      }
      if (orderData.platformFee) {
        feeBreakdown += `\nPlatform Fee: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.platformFee, orderData.currency)}`;
      }
      
      // Log final values used in receipt - these are now dynamically fetched from Firestore
      console.log('Receipt will use store details:', {
        storeName: storeName,
        storePhone: storePhone,
        deliveryMethod: deliveryMethod
      });
      
      // Format store information for receipt
      // Force log storeName to debug the issue
      console.log("DEBUG - Final store name values:", { 
        orderDataStoreName: orderData.storeName, 
        storeNameVar: storeName
      });
      
      // Final store name to use in receipt - extensive fallback chain
      const finalStoreName = orderData.storeName || storeName || currentUser.displayName || "Store";
      
      // Log final store name decision for debugging
      console.log("FINAL STORE NAME SELECTED:", finalStoreName);
      
      let storeInfo = `STORE INFORMATION:
Store: ${finalStoreName}`;
      
      if (orderData.storePhone || storePhone) {
        storeInfo += `\nStore Phone: ${orderData.storePhone || storePhone}`;
      }
      
      if (orderData.storeEmail) {
        storeInfo += `\nStore Email: ${orderData.storeEmail}`;
      }
      
      if (orderData.storeAddress) {
        storeInfo += `\nStore Address: ${orderData.storeAddress}`;
      }
      
      if (orderData.storeRegistrationNumber) {
        storeInfo += `\nBusiness Registration: ${orderData.storeRegistrationNumber}`;
      }
      
      if (orderData.storeVatNumber) {
        storeInfo += `\nVAT Number: ${orderData.storeVatNumber}`;
      }
      
      // Generate receipt message with all available information - send to the customer (not the seller)
      // Double check that we're sending FROM seller TO customer
      console.log('Sending receipt from seller:', currentUser.uid, 'to customer:', orderData.customerId);
      
      // Check if the customerId is valid
      if (!orderData.customerId) {
        throw new Error("Cannot send receipt: Customer ID is missing");
      }
      
      const receiptMessage = {
        conversationId: conversationId,
        senderId: currentUser.uid, // Seller sends the message
        senderName: currentUser.displayName || currentUser.email || 'Seller',
        senderEmail: currentUser.email,
        receiverId: orderData.customerId, // Customer receives the message
        receiverName: orderData.customerName || 'Customer',
        // CRITICAL: For MessagesPage.js to display the message properly, we must use the 'message' field
        // This is the field that's used to render the message content
        // Using standard message format for standard/text messages to ensure compatibility
        // 'text' field is used for notification/summary purposes
        text: isRefund ? `🧾 Refund receipt for order #${orderData.orderId}` : `🧾 Order receipt for #${orderData.orderId}`,
        
        // Using both 'message' AND 'text' fields for maximum compatibility with different UI components
        // MessagesPage.js uses message.message for displaying content
        message: isRefund 
          ? `🧾 COMPREHENSIVE REFUND RECEIPT (Re-generated)

Order ID: ${orderData.orderId}
Date of Refund: ${receiptDate}
Original Order Date: ${originalOrderDate}
Refund Transaction ID: ${orderData.refundId || 'N/A'}
Original Transaction ID: ${orderData.transactionId || 'N/A'}

CUSTOMER INFORMATION:
Name: ${orderData.customerName}${contactInfo}${addressFormatted}

REFUND DETAILS:
${formattedItems}
${priceBreakdownFormatted}${feeBreakdown}

REFUND AMOUNT: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}

PAYMENT INFORMATION:
Payment Method: ${orderData.paymentMethod.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
Delivery Method: ${orderData.deliveryMethod}
Refund Reason: ${orderData.refundReason || 'Not specified'}

${storeInfo}

This is an automatically generated receipt.
Please keep this for your records.
For any questions regarding this refund, please contact customer support.`
          : `🧾 ORDER RECEIPT (Re-generated)

Order ID: ${orderData.orderId}
Date of Purchase: ${originalOrderDate}
Receipt Generated: ${receiptDate}
Transaction ID: ${orderData.transactionId || 'N/A'}

CUSTOMER INFORMATION:
Name: ${orderData.customerName}${contactInfo}${addressFormatted}

ORDER DETAILS:
${formattedItems}
${priceBreakdownFormatted}${feeBreakdown}

TOTAL AMOUNT: ${getCurrencySymbol(orderData.currency)}${formatPrice(orderData.totalAmount, orderData.currency)}

PAYMENT INFORMATION:
Payment Method: ${orderData.paymentMethod.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
Delivery Method: ${orderData.deliveryMethod}

${storeInfo}

This is an automatically generated receipt.
Please keep this for your records.
For any questions regarding this order, please contact the seller.`,
        timestamp: serverTimestamp(),
        isRead: false,
        read: false, // Both fields are needed for compatibility
        // Use 'text' type which is standard for normal messages in the system
        messageType: 'text',
        // Include orderData for reference if needed
        orderData: sanitizedOrderData,
        orderId: orderData.orderId,
        // Maintain receipt-specific fields but use standard message display
        isReceipt: true,
        receiptType: isRefund ? 'refund_receipt' : 'order_receipt',
        // Add receipt flag to help with potential future filters
        type: 'receipt',
        // Make sure the receipt appears in the customer's conversation list
        lastMessageTimestamp: serverTimestamp()
      };
      
      // Log important details for debugging
      console.log('Receipt message:', {
        conversationId: receiptMessage.conversationId,
        from: currentUser.uid + ' (Seller)',
        to: orderData.customerId + ' (Customer)',
        storeName: orderData.storeName, // Log the store name for debugging
        storePhone: orderData.storePhone, // Log the store phone for debugging
        messageType: receiptMessage.messageType
      });
      
      // Critical final check to ensure the message is going to the right recipient
      if (receiptMessage.receiverId !== orderData.customerId) {
        console.error('ERROR: Message recipient mismatch!');
        console.error('Expected recipient:', orderData.customerId);
        console.error('Actual recipient:', receiptMessage.receiverId);
        throw new Error('Receipt recipient mismatch - cannot continue');
      }
      
      // Send the receipt message
      const docRef = await addDoc(collection(db, 'messages'), receiptMessage);
      
      // Create receipt for the receipts collection that will be used by both seller and buyer
      const baseReceiptData = {
        receiptId: `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: orderData.orderId,
        sellerName: currentUser.displayName || 'Seller',
        sellerId: currentUser.uid,
        customerName: orderData.customerName || 'Customer',
        customerId: orderData.customerId,
        items: orderData.items || [],
        currency: orderData.currency || 'GBP',
        subtotal: orderData.subtotal || null,
        deliveryFee: orderData.deliveryFee || null,
        serviceFee: orderData.serviceFee || null,
        totalAmount: orderData.totalAmount || 0,
        paymentMethod: orderData.paymentMethod || 'Online Payment',
        deliveryMethod: orderData.deliveryMethod || 'Not specified',
        dateCreated: new Date().toISOString(),
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        type: isRefund ? 'refund' : 'order',
        status: 'generated',
        regenerated: true,
        messageRef: docRef.id,
        // Store information with comprehensive data
        storeName: orderData.storeName || storeName || currentUser.displayName || "",
        // Ensure address is included by checking all possible fields with comprehensive fallbacks
        storeAddress: orderData.storeAddress || 
                     orderData.sellerAddress || 
                     orderData.businessAddress || 
                     orderData.storeLocation ||
                     (orderData.storeData?.address) || 
                     (orderData.storeData?.storeLocation) ||
                     (orderData.storeData?.businessAddress) ||
                     (orderData.storeData?.location?.address) ||
                     (typeof orderData.storeData?.location === 'string' ? orderData.storeData.location : '') ||
                     (orderData.storeData?.fullAddress) ||
                     (orderData.storeData?.streetAddress) ||
                     null,
        // Ensure phone number is included by checking all possible fields with comprehensive fallbacks
        storePhone: orderData.storePhone || 
                   orderData.sellerPhone || 
                   orderData.businessPhone || 
                   orderData.contactNumber || 
                   (orderData.storeData?.phone) || 
                   (orderData.storeData?.phoneNumber) ||
                   (orderData.storeData?.contactNumber) ||
                   (orderData.storeData?.businessPhone) ||
                   (orderData.storeData?.storePhone) ||
                   (orderData.storeData?.contactPhone) ||
                   (orderData.storeData?.mobile) ||
                   null,
        storeEmail: orderData.storeEmail || 
                   orderData.sellerEmail || 
                   (orderData.storeData?.email) || 
                   (orderData.storeData?.contactEmail) ||
                   (orderData.storeData?.businessEmail) ||
                   null,
        storeRegistrationNumber: orderData.storeRegistrationNumber || null,
        storeVatNumber: orderData.storeVatNumber || null,
        storeBusinessId: orderData.storeBusinessId || null,
      };
      
      // Create a copy for the seller's receipts collection
      const sellerReceiptData = {
        ...baseReceiptData,
        userId: currentUser.uid, // For the seller's receipt
        forSeller: true,
      };
      
      // Create a copy for the buyer's receipts collection
      const buyerReceiptData = {
        ...baseReceiptData,
        userId: orderData.customerId, // For the buyer's receipt
        forBuyer: true,
      };
      
      // Save to receipts collection for both seller and buyer
      const sellerReceiptRef = await addDoc(collection(db, 'receipts'), sellerReceiptData);
      const buyerReceiptRef = await addDoc(collection(db, 'receipts'), buyerReceiptData);
      
      console.log('Receipt saved for seller with ID:', sellerReceiptRef.id);
      console.log('Receipt saved for buyer with ID:', buyerReceiptRef.id);
      
      // Add to regenerated receipts list with timestamp and data quality indicators
      const dataQuality = {
        hasEmail: !!orderData.customerEmail,
        hasPhone: !!orderData.customerPhone,
        hasAddress: !!orderData.deliveryAddress,
        hasItems: !!(orderData.items && orderData.items.length > 0)
      };
      
      const newRegenerated = {
        id: docRef.id,
        refundId: isRefund ? transaction.id : undefined,
        orderId: orderData.orderId,
        customerName: orderData.customerName || 'Unknown Customer',
        amount: orderData.totalAmount,
        currency: orderData.currency,
        timestamp: new Date().toISOString(), // Use ISO string for better serialization
        messageId: docRef.id,
        sellerReceiptId: sellerReceiptRef.id, // Reference to seller's receipt document
        buyerReceiptId: buyerReceiptRef.id,   // Reference to buyer's receipt document 
        dataQuality: dataQuality,
        email: orderData.customerEmail,
        phone: orderData.customerPhone,
        itemCount: orderData.items ? orderData.items.length : 0,
        receiptType: isRefund ? 'refund' : 'order',
        sellerId: currentUser.uid // Associate receipt with current seller
      };
      
      // Limit to most recent 50 receipts per seller to avoid localStorage getting too large
      setRegeneratedReceipts(prevReceipts => {
        // Filter out receipts older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Filter to keep only receipts for this seller that aren't too old
        const sellerReceipts = prevReceipts
          .filter(receipt => 
            (receipt.sellerId === currentUser.uid || !receipt.sellerId) && 
            (receipt.timestamp ? new Date(receipt.timestamp) > thirtyDaysAgo : true)
          );
        
        // Add the new receipt to the beginning
        return [newRegenerated, ...sellerReceipts].slice(0, 50);
      });
      
      // Show success notification with more detailed info
      const notification = document.createElement('div');
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div>✅</div>
          <div>
            <div style="font-weight: 600">${isRefund ? 'Refund' : 'Order'} receipt sent successfully!</div>
            <div style="font-size: 0.85rem; opacity: 0.9">Sent to: ${orderData.customerName}${orderData.customerEmail ? ` (${orderData.customerEmail})` : ''}</div>
            <div style="font-size: 0.85rem; opacity: 0.9">Receipt saved to both seller and buyer accounts</div>
          </div>
        </div>
      `;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 500;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      // Automatically remove the notification after 5 seconds
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
          // Check if the notification is still in the document before removing
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 500);
      }, 5000);
      
      // No need for a second timeout as we already have one above
      
      // Clear the selected transaction and preview data
      setSelectedTransaction(null);
      setPreviewData(null);
      
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('Failed to generate receipt. Please try again.');
    }
  };

  // Download receipt as PDF
  const downloadReceipt = (transaction) => {
    if (!transaction) return;

    // Create receipt date
    const receiptDate = transaction.timestamp 
      ? (transaction.timestamp.toDate ? transaction.timestamp.toDate() : new Date(transaction.timestamp))
      : new Date();
    
    const formattedDate = receiptDate.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Get store address and phone info from multiple possible sources
    let storeAddress = transaction.storeAddress || 
                      (transaction.storeData && transaction.storeData.storeLocation) ||
                      (transaction.storeData && transaction.storeData.storeAddress) || 
                      (transaction.storeData && transaction.storeData.address) ||
                      'Not available';
      
    let storePhone = transaction.storePhone ||
                    (transaction.storeData && transaction.storeData.phoneNumber) ||
                    (transaction.storeData && transaction.storeData.phone) ||
                    'Not available';

    // Generate filename
    const receiptType = transaction.receiptType === 'refund_receipt' ? 'Refund' : 'Receipt';
    const storeNameForFile = transaction.storeName || 
                            transaction.businessName || 
                            (transaction.storeData && transaction.storeData.businessName) ||
                            (transaction.storeData && transaction.storeData.storeName) ||
                            'Store';
    const storeName = storeNameForFile.replace(/[^a-zA-Z0-9]/g, '_');
    const orderId = (transaction.orderId || transaction.orderID || transaction.id || 'Unknown').substring(0, 8);
    const dateStr = receiptDate.toISOString().split('T')[0];
    const filename = `${receiptType}_${storeName}_${orderId}_${dateStr}`;

    // Prepare items section
    const items = transaction.items || [];
    const itemsHtml = items.length > 0 
      ? items.map(item => `
          <div class="info-row">
            <span class="info-label">${item.name || item.productName || 'Item'} ${item.quantity ? `(${item.quantity})` : ''}</span>
            <span class="info-value">${transaction.currency || 'GBP'} ${Number(item.price || item.amount || 0).toFixed(2)}</span>
          </div>
        `).join('')
      : '<div class="info-row"><span class="info-label">No items available</span><span class="info-value">-</span></div>';

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${filename}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
          }
          .receipt-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo-container {
            margin-bottom: 15px;
          }
          .receipt-logo {
            height: 60px;
            width: auto;
            max-width: 200px;
            object-fit: contain;
          }
          .header h1 {
            margin: 10px 0 0 0;
            font-size: 28px;
            font-weight: bold;
            color: #333;
          }
          .header .receipt-type {
            font-size: 18px;
            color: #666;
            margin-top: 10px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section h2 {
            background: #f8f9fa;
            padding: 10px 15px;
            margin: 0 0 15px 0;
            font-size: 16px;
            font-weight: bold;
            color: #333;
            border-left: 4px solid #4f46e5;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label {
            font-weight: 500;
            color: #666;
          }
          .info-value {
            font-weight: 600;
            color: #333;
          }
          .total-row {
            background: #f8f9fa;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            border-left: 4px solid #10b981;
          }
          .total-amount {
            font-size: 24px;
            font-weight: bold;
            color: #10b981;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #eee;
            color: #666;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .receipt-container { 
              box-shadow: none; 
              border-radius: 0;
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <div class="logo-container">
              <img src="/images/logo png.png" alt="Lokal Logo" class="receipt-logo" />
            </div>
            <h1>🧾 DIGITAL RECEIPT</h1>
            <div class="receipt-type">
              ${transaction.receiptType === 'refund_receipt' ? '💸 REFUND RECEIPT' : '🛒 ORDER RECEIPT'}
            </div>
          </div>

          <div class="section">
            <h2>🏪 Store Information</h2>
            <div class="info-row">
              <span class="info-label">Store Name:</span>
              <span class="info-value">${storeNameForFile}</span>
            </div>
            ${storeAddress !== 'Not available' ? `
            <div class="info-row">
              <span class="info-label">Address:</span>
              <span class="info-value">${storeAddress}</span>
            </div>
            ` : ''}
            ${storePhone !== 'Not available' ? `
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span class="info-value">${storePhone}</span>
            </div>
            ` : ''}
          </div>

          <div class="section">
            <h2>📋 Order Details</h2>
            <div class="info-row">
              <span class="info-label">Order ID:</span>
              <span class="info-value">${transaction.orderId || transaction.orderID || transaction.id}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date & Time:</span>
              <span class="info-value">${formattedDate}</span>
            </div>
            ${transaction.paymentMethod ? `
            <div class="info-row">
              <span class="info-label">Payment Method:</span>
              <span class="info-value">${transaction.paymentMethod}</span>
            </div>
            ` : ''}
            ${transaction.deliveryType ? `
            <div class="info-row">
              <span class="info-label">Delivery Type:</span>
              <span class="info-value">${transaction.deliveryType}</span>
            </div>
            ` : ''}
          </div>

          <div class="section">
            <h2>🛍️ Items Purchased</h2>
            ${itemsHtml}
          </div>

          <div class="section">
            <h2>💰 Payment Summary</h2>
            ${transaction.subtotal ? `
            <div class="info-row">
              <span class="info-label">Subtotal:</span>
              <span class="info-value">£${Number(transaction.subtotal).toFixed(2)}</span>
            </div>
            ` : ''}
            ${transaction.serviceFee ? `
            <div class="info-row">
              <span class="info-label">Service Fee:</span>
              <span class="info-value">£${Number(transaction.serviceFee).toFixed(2)}</span>
            </div>
            ` : ''}
            ${transaction.deliveryFee ? `
            <div class="info-row">
              <span class="info-label">Delivery Fee:</span>
              <span class="info-value">£${Number(transaction.deliveryFee).toFixed(2)}</span>
            </div>
            ` : ''}
            ${transaction.platformFee ? `
            <div class="info-row">
              <span class="info-label">Platform Fee:</span>
              <span class="info-value">£${Number(transaction.platformFee).toFixed(2)}</span>
            </div>
            ` : ''}
            
            <div class="total-row">
              <div class="info-row" style="border: none; margin: 0;">
                <span class="info-label" style="font-size: 18px;">Total Amount:</span>
                <span class="total-amount">£${Number(transaction.totalAmount || transaction.amount || 0).toFixed(2)}</span>
              </div>
              <div style="text-align: right; margin-top: 5px; color: #666; font-size: 14px;">
                Currency: ${transaction.currency || 'GBP'}
              </div>
            </div>
          </div>

          ${transaction.receiptType === 'refund_receipt' && transaction.refundReason ? `
          <div class="section">
            <h2>💸 Refund Details</h2>
            <div class="info-row">
              <span class="info-label">Refund Reason:</span>
              <span class="info-value">${transaction.refundReason}</span>
            </div>
          </div>
          ` : ''}

          ${transaction.receiptContent ? `
          <div class="section">
            <h2>📄 Full Receipt</h2>
            <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; font-family: monospace; font-size: 12px; white-space: pre-wrap; border: 1px solid #ddd;">${transaction.receiptContent}</div>
          </div>
          ` : ''}

          <div class="footer">
            <p><strong>Thank you for your order!</strong></p>
            <p>Generated on: ${new Date().toLocaleDateString('en-GB', {
              year: 'numeric',
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create a new window with the HTML content
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = function() {
      // Set the document title for the PDF filename
      printWindow.document.title = filename;
      
      // Use setTimeout to ensure everything is rendered
      setTimeout(() => {
        printWindow.print();
        // Don't close the window automatically - let user decide
      }, 500);
    };
  };

  // Send receipt via email using custom modal
  const sendReceiptViaEmail = async (transaction) => {
    if (!transaction) return;

    // Get current user's email
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user || !user.email) {
      setMessageModal({
        type: 'error',
        title: 'Authentication Required',
        message: 'Please make sure you are logged in with an email address to send receipts.',
        primaryButtonText: 'OK'
      });
      return;
    }

    // Check if transaction has payment intent ID for Stripe receipts
    const paymentIntentId = transaction.paymentIntentId || transaction.paymentId || transaction.chargeId;
    
    if (!paymentIntentId) {
      // For non-Stripe receipts, show informative modal with items
      // Use the enriched data from previewData if available, fallback to transaction
      const items = transaction.items || [];
      const itemsDetails = items.length > 0 
        ? items.map(item => `• ${item.name || item.productName || item.title || 'Item'} ${item.quantity ? `(${item.quantity})` : ''} - ${transaction.currency || 'GBP'} ${Number(item.price || item.amount || 0).toFixed(2)}`)
        : ['• No items available'];

      // Get store name from the most appropriate source
      const storeName = transaction.storeName || 
                       transaction.businessName || 
                       (transaction.storeData && transaction.storeData.businessName) ||
                       (transaction.storeData && transaction.storeData.storeName) ||
                       'Store';

      setMessageModal({
        type: 'info',
        title: 'Email Not Available',
        message: 'This receipt is from a non-Stripe payment and cannot be emailed automatically.',
        details: [
          `Order ID: ${transaction.orderId || transaction.orderID || transaction.id || 'Unknown'}`,
          `Amount: ${transaction.currency || 'GBP'} ${Number(transaction.totalAmount || transaction.amount || 0).toFixed(2)}`,
          `Store: ${storeName}`,
          '',
          'Items Purchased:',
          ...itemsDetails
        ],
        primaryButtonText: 'Download PDF Instead',
        secondaryButtonText: 'OK',
        onPrimaryAction: () => {
          setMessageModal(null);
          downloadReceipt(transaction);
        },
        onSecondaryAction: () => {
          setMessageModal(null);
        }
      });
      return;
    }

    // For Stripe receipts, open email modal
    setReceiptForEmail(transaction);
    setShowEmailModal(true);
  };

  // Handle email send from modal
  const handleEmailSend = async (email) => {
    if (!receiptForEmail || !email) return;

    setEmailLoading(true);
    
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      // Prepare receipt data for email
      const receiptData = {
        orderId: receiptForEmail.orderId || receiptForEmail.orderID || receiptForEmail.id || 'Unknown',
        amount: receiptForEmail.totalAmount || receiptForEmail.amount || 0,
        currency: receiptForEmail.currency || 'GBP',
        customerEmail: email,
        customerName: user.displayName || user.email || 'Customer',
        storeName: receiptForEmail.storeName || receiptForEmail.businessName || 'Store',
        items: receiptForEmail.items || [],
        paymentIntentId: receiptForEmail.paymentIntentId || receiptForEmail.paymentId || receiptForEmail.chargeId,
        receiptData: {
          ...receiptForEmail,
          formattedDate: receiptForEmail.timestamp 
            ? (receiptForEmail.timestamp.toDate ? receiptForEmail.timestamp.toDate() : new Date(receiptForEmail.timestamp)).toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : new Date().toLocaleDateString('en-GB')
        }
      };

      const result = await sendManualReceipt(receiptData);
      
      if (result.success) {
        setNotification({
          type: 'success',
          title: 'Receipt Sent!',
          message: `Receipt sent successfully to ${email}`
        });
        setShowEmailModal(false);
        setReceiptForEmail(null);
      } else {
        throw new Error(result.error || 'Failed to send receipt');
      }
    } catch (error) {
      console.error('Error sending receipt via email:', error);
      setNotification({
        type: 'error',
        title: 'Send Failed',
        message: 'Failed to send receipt via email. Please try again.'
      });
    } finally {
      setEmailLoading(false);
    }
  };

  // Save regenerated receipts to localStorage whenever they change
  useEffect(() => {
    try {
      // Only save to localStorage if we have receipts to save
      if (regeneratedReceipts && regeneratedReceipts.length > 0) {
        localStorage.setItem('regeneratedReceipts', JSON.stringify(regeneratedReceipts));
      }
    } catch (error) {
      console.error('Error saving receipts to localStorage:', error);
    }
  }, [regeneratedReceipts]);
  
  // Load user-specific receipts when user changes
  useEffect(() => {
    if (currentUser) {
      try {
        const savedReceipts = localStorage.getItem('regeneratedReceipts');
        if (savedReceipts) {
          const parsedReceipts = JSON.parse(savedReceipts);
          // Filter receipts to show only those belonging to the current user
          const userReceipts = parsedReceipts.filter(
            receipt => receipt.sellerId === currentUser.uid || !receipt.sellerId
          );
          setRegeneratedReceipts(userReceipts);
        }
      } catch (error) {
        console.error('Error loading user receipts from localStorage:', error);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeComplaints1 = null;
    let unsubscribeComplaints2 = null;
    
    let unsubscribeRefunds = null;
    let unsubscribeOrders = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Check if user is a seller
        try {
          const storeDoc = await getDoc(doc(db, 'stores', user.uid));
          if (storeDoc.exists()) {
            setIsSeller(true);
            
            // Get store data and check if refunds are enabled
            const storeData = storeDoc.data();
            const feeSettings = storeData.feeSettings || {};
            setStoreRefundsEnabled(feeSettings.refundsEnabled !== false); // default to true
            
            // Always fetch refund transactions, regardless of whether refunds are currently enabled
            // This ensures we always show historical refunds, even if refunds are currently disabled
            const refundsQuery = query(
              collection(db, 'transactions'),
              where('sellerId', '==', user.uid),
              where('type', '==', 'refund_deduction'),
              orderBy('createdAt', 'desc')
            );
            
            unsubscribeRefunds = onSnapshot(refundsQuery, async (snapshot) => {
              const refunds = snapshot.docs.map(doc => ({
                id: doc.id,
                transactionType: 'refund',
                status: 'cancelled_and_refunded', // Mark all refunds with this status
                ...doc.data()
              }));
              console.log('Loaded refund transactions:', refunds.length);
              setRefundTransactions(refunds);
              setLoadingRefunds(false);
            }, (error) => {
              console.error('Error fetching refund transactions:', error);
              setLoadingRefunds(false);
            });
            
            // ENHANCED ORDER FETCHING - Check multiple collections
            console.log('🔍 Enhanced order fetching started for seller:', user.uid);
            setLoadingOrders(true);
            
            // Create array to hold all collected orders
            let allCollectedOrders = [];
            
            // 1. First check the transactions collection for payment records
            const transactionsQuery = query(
              collection(db, 'transactions'),
              where('sellerId', '==', user.uid),
              where('type', 'in', ['payment', 'sale']), // Include both payment and sale types
              orderBy('createdAt', 'desc'),
              limit(100)
            );
            
            // 2. Check the payments collection for all payment records
            const paymentsQuery = query(
              collection(db, 'payments'),
              where('sellerId', '==', user.uid),
              orderBy('createdAt', 'desc'),
              limit(100)
            );
            
            // 3. Check the reports collection for completed orders
            const reportsQuery = query(
              collection(db, 'reports'),
              where('sellerId', '==', user.uid),
              where('type', '==', 'order'),
              orderBy('createdAt', 'desc'),
              limit(100)
            );
            
            // 4. Check the receipts collection
            const receiptsQuery = query(
              collection(db, 'receipts'),
              where('sellerId', '==', user.uid),
              where('receiptType', '==', 'order_receipt'),
              orderBy('createdAt', 'desc'),
              limit(100)
            );

            // 5. Check completed transactions collection (pay-at-store orders)
            const completedTransactionsQuery = query(
              collection(db, 'transactions'),
              where('sellerId', '==', user.uid),
              where('pickupStatus', '==', 'collected'),
              orderBy('collectedAt', 'desc'),
              limit(100)
            );
            
            try {
              // Execute all queries in parallel
              const [transactionsSnapshot, paymentsSnapshot, reportsSnapshot, receiptsSnapshot, completedTransactionsSnapshot] = 
                await Promise.all([
                  getDocs(transactionsQuery),
                  getDocs(paymentsQuery),
                  getDocs(reportsQuery),
                  getDocs(receiptsQuery),
                  getDocs(completedTransactionsQuery)
                ]);
              
              console.log('📊 Order source counts:', {
                transactions: transactionsSnapshot.size,
                payments: paymentsSnapshot.size,
                reports: reportsSnapshot.size,
                receipts: receiptsSnapshot.size,
                completedTransactions: completedTransactionsSnapshot.size
              });
              
              // Process transactions
              const transactionOrders = transactionsSnapshot.docs.map(doc => ({
                id: doc.id,
                source: 'transactions',
                transactionType: 'order',
                ...doc.data()
              }));
              
              // Process payments
              const paymentOrders = paymentsSnapshot.docs.map(doc => ({
                id: doc.id,
                source: 'payments',
                transactionType: 'order',
                ...doc.data()
              }));
              
              // Process reports
              const reportOrders = reportsSnapshot.docs.map(doc => ({
                id: doc.id,
                source: 'reports',
                transactionType: 'order',
                ...doc.data()
              }));
              
              // Process receipts
              const receiptOrders = receiptsSnapshot.docs.map(doc => ({
                id: doc.id,
                source: 'receipts',
                transactionType: 'order',
                ...doc.data()
              }));

              // Process completed transactions (pay-at-store orders)
              const completedTransactionOrders = completedTransactionsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  source: 'completed_transactions',
                  transactionType: 'order',
                  // Normalize field names for consistency
                  orderId: data.orderId,
                  totalAmount: data.amount || data.totalAmount,
                  paymentMethod: data.paymentMethod || 'Pay at Store',
                  deliveryType: data.deliveryType || 'Collection',
                  customerId: data.customerId,
                  customerName: data.customerName,
                  items: data.items || [],
                  currency: data.currency || 'GBP',
                  status: 'completed',
                  createdAt: data.collectedAt || data.createdAt,
                  completedAt: data.collectedAt,
                  payAtStore: true,
                  pickupCode: data.pickupCode,
                  ...data
                };
              });
              
              // Combine all orders
              const allFetchedOrders = [
                ...transactionOrders, 
                ...paymentOrders,
                ...reportOrders,
                ...receiptOrders,
                ...completedTransactionOrders
              ];
              
              // Deduplicate orders by orderId
              const orderMap = new Map();
              allFetchedOrders.forEach(order => {
                const orderId = order.orderId || order.id;
                
                // Only replace if this order has more information
                if (!orderMap.has(orderId) || 
                    (orderMap.has(orderId) && 
                     (!orderMap.get(orderId).items || orderMap.get(orderId).items.length === 0) && 
                     order.items && order.items.length > 0)) {
                  orderMap.set(orderId, order);
                }
              });
              
              // Convert map back to array
              allCollectedOrders = Array.from(orderMap.values());
              
              console.log('🛍️ Total unique orders after deduplication:', allCollectedOrders.length);
              
              // Ensure all orders have status information
              const processedOrders = await Promise.all(allCollectedOrders.map(async (order) => {
                // If we don't have a status, try to find it in the orders collection
                if (!order.status && order.orderId) {
                  try {
                    const orderRef = doc(db, 'orders', order.orderId);
                    const orderSnap = await getDoc(orderRef);
                    
                    if (orderSnap.exists()) {
                      const orderData = orderSnap.data();
                      return {
                        ...order,
                        status: orderData.status || 'unknown'
                      };
                    }
                  } catch (error) {
                    console.error('Error fetching order status:', error);
                  }
                }
                return order;
              }));
              
              // Sort by date (most recent first)
              processedOrders.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || a.timestamp?.toDate?.() || new Date(a.createdAt || a.timestamp || 0);
                const dateB = b.createdAt?.toDate?.() || b.timestamp?.toDate?.() || new Date(b.createdAt || b.timestamp || 0);
                return dateB - dateA;
              });
              
              console.log('✅ Order processing complete - displaying', processedOrders.length, 'orders');
              setAllOrders(processedOrders);
            } catch (error) {
              console.error('❌ Error fetching orders:', error);
              setAllOrders([]); // Set empty array on error
            } finally {
              setLoadingOrders(false);
            }
            
            // Use Promise.all to handle both queries simultaneously
            try {
              const complaintsQuery1 = query(
                collection(db, 'admin_complaints'),
                where('sellerId', '==', user.uid),
                orderBy('timestamp', 'desc')
              );
              
              const complaintsQuery2 = query(
                collection(db, 'admin_complaints'),
                where('reportedStoreOwner', '==', user.uid),
                orderBy('timestamp', 'desc')
              );

              // Track loaded state
              let complaintsData1 = [];
              let complaintsData2 = [];
              let loaded1 = false;
              let loaded2 = false;

              const updateComplaints = () => {
                if (loaded1 && loaded2) {
                  // Combine both arrays and remove duplicates
                  const allComplaints = [...complaintsData1, ...complaintsData2];
                  const uniqueComplaints = allComplaints.filter((complaint, index, self) => 
                    index === self.findIndex((c) => c.id === complaint.id)
                  );
                  
                  // Sort by timestamp descending
                  uniqueComplaints.sort((a, b) => {
                    const timestampA = a.timestamp || a.submittedAt;
                    const timestampB = b.timestamp || b.submittedAt;
                    if (!timestampA || !timestampB) return 0;
                    return timestampB.toMillis() - timestampA.toMillis();
                  });
                  
                  setComplaints(uniqueComplaints);
                  setLoading(false);
                }
              };

              // Set up first listener
              unsubscribeComplaints1 = onSnapshot(complaintsQuery1, (snapshot) => {
                complaintsData1 = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                }));
                loaded1 = true;
                updateComplaints();
              }, (error) => {
                console.error('Error fetching complaints (query 1):', error);
                loaded1 = true;
                updateComplaints();
              });

              // Set up second listener
              unsubscribeComplaints2 = onSnapshot(complaintsQuery2, (snapshot) => {
                complaintsData2 = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                }));
                loaded2 = true;
                updateComplaints();
              }, (error) => {
                console.error('Error fetching complaints (query 2):', error);
                loaded2 = true;
                updateComplaints();
              });
              
            } catch (queryError) {
              console.error('Error setting up queries:', queryError);
              setLoading(false);
            }
            
          } else {
            // Not a seller, redirect
            setLoading(false);
            navigate('/explore');
          }
        } catch (error) {
          console.error('Error checking seller status:', error);
          setLoading(false);
          navigate('/explore');
        }
      } else {
        setLoading(false);
        navigate('/login');
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeComplaints1) {
        unsubscribeComplaints1();
      }
      if (unsubscribeComplaints2) {
        unsubscribeComplaints2();
      }
      if (unsubscribeRefunds) {
        unsubscribeRefunds();
      }
      if (unsubscribeOrders) {
        unsubscribeOrders();
      }
    };
  }, [navigate]);

  if (loading) {
    return (
      <div>
        <Navbar />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh',
          fontSize: '18px',
          color: '#666'
        }}>
          Loading reports...
        </div>
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div>
        <Navbar />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh',
          fontSize: '18px',
          color: '#666'
        }}>
          Access denied. This page is for sellers only.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div style={{ 
        maxWidth: '1200px', 
        margin: '2rem auto', 
        padding: '0 1rem',
        minHeight: 'calc(100vh - 120px)'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: '#1F2937',
            marginBottom: '0.5rem'
          }}>
            📊 Reports & Complaints
          </h1>
          <p style={{ color: '#6B7280', fontSize: '1rem' }}>
            View and track complaints and reports filed against your store
          </p>
        </div>
        
        {/* Receipt Regeneration Section */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              color: '#1F2937' 
            }}>
              🧾 Regenerate Receipt
            </h2>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            {/* Transaction type toggle */}
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button 
                  onClick={() => {
                    setReceiptType('order');
                    setSelectedTransaction(null);
                  }}
                  style={{
                    padding: '0.5rem 1.5rem',
                    backgroundColor: receiptType === 'order' ? '#3B82F6' : '#F3F4F6',
                    color: receiptType === 'order' ? 'white' : '#6B7280',
                    border: `1px solid ${receiptType === 'order' ? '#2563EB' : '#D1D5DB'}`,
                    borderRadius: '0.375rem',
                    fontWeight: receiptType === 'order' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🛍️ Orders
                </button>
                <button 
                  onClick={() => {
                    setReceiptType('refund');
                    setSelectedTransaction(null);
                  }}
                  style={{
                    padding: '0.5rem 1.5rem',
                    backgroundColor: receiptType === 'refund' ? '#3B82F6' : '#F3F4F6',
                    color: receiptType === 'refund' ? 'white' : '#6B7280',
                    border: `1px solid ${receiptType === 'refund' ? '#2563EB' : '#D1D5DB'}`,
                    borderRadius: '0.375rem',
                    fontWeight: receiptType === 'refund' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  💸 Refunds
                </button>
              </div>
            </div>
            
            {selectedTransaction && previewData ? (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Regenerate {receiptType === 'refund' ? 'Refund' : 'Order'} Receipt
                </h3>
                
                <div style={{ 
                  backgroundColor: '#F3F4F6', 
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '1rem'
                  }}>
                    <h4 style={{ margin: 0, fontWeight: '600' }}>Order & Customer Details</h4>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={toggleFullReceiptPreview}
                        style={{
                          backgroundColor: showFullReceiptPreview ? '#4F46E5' : '#E5E7EB',
                          color: showFullReceiptPreview ? 'white' : '#374151',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.4rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        {showFullReceiptPreview ? '📄 Hide' : '📄 Show'} Receipt Preview
                      </button>
                      
                      <button
                        onClick={toggleEditMode}
                        style={{
                          backgroundColor: isEditing ? '#4F46E5' : '#E5E7EB',
                          color: isEditing ? 'white' : '#374151',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.4rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        {isEditing ? '✓ Save Changes' : '✏️ Edit Receipt'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Full Receipt Preview */}
                  {showFullReceiptPreview && (
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      padding: '1rem',
                      marginBottom: '1.5rem',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}>
                      <div style={{
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.85rem',
                        lineHeight: '1.5'
                      }}>
                        <div style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: 'bold' }}>
                          {receiptType === 'refund' ? '🧾 REFUND RECEIPT' : '🧾 ORDER RECEIPT'}
                        </div>
                        
                        <div style={{ marginBottom: '1rem' }}>
                          <div><strong>Order ID:</strong> {editableReceiptData?.orderId || 'Unknown'}</div>
                          <div><strong>Date:</strong> {formatDate(editableReceiptData?.createdAt)}</div>
                          <div><strong>Customer:</strong> {editableReceiptData?.customerName}</div>
                          {editableReceiptData?.customerEmail && <div><strong>Email:</strong> {editableReceiptData.customerEmail}</div>}
                        </div>
                        
                        <div style={{ borderTop: '1px dashed #ccc', borderBottom: '1px dashed #ccc', padding: '0.5rem 0', marginBottom: '1rem' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Items:</div>
                          {editableReceiptData?.items && editableReceiptData.items.length > 0 ? (
                            editableReceiptData.items.map((item, i) => {
                              const itemName = item.itemName || item.name || 'Product';
                              const itemPrice = item.price || 0;
                              const quantity = item.quantity || 1;
                              return (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <div>• {itemName} x{quantity}</div>
                                  <div>{getCurrencySymbol(editableReceiptData.currency || 'GBP')}{formatPrice(itemPrice * quantity, editableReceiptData.currency || 'GBP')}</div>
                                </div>
                              );
                            })
                          ) : (
                            <div>No items available</div>
                          )}
                        </div>
                        
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                            <div>Total:</div>
                            <div>{getCurrencySymbol(editableReceiptData?.currency || 'GBP')}{formatPrice(Math.abs(editableReceiptData?.amount || editableReceiptData?.totalAmount || 0), editableReceiptData?.currency || 'GBP')}</div>
                          </div>
                        </div>
                        
                        <div style={{ marginBottom: '1rem' }}>
                          <div><strong>Payment Method:</strong> {editableReceiptData?.paymentMethod?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown'}</div>
                          <div><strong>Delivery Method:</strong> {editableReceiptData?.deliveryMethod}</div>
                          {receiptType === 'refund' && <div><strong>Refund Reason:</strong> {editableReceiptData?.refundReason || 'Not specified'}</div>}
                        </div>
                        
                        <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem' }}>
                          <div><strong>STORE INFORMATION:</strong></div>
                          <div>Store: {editableReceiptData?.storeName}</div>
                          {editableReceiptData?.storePhone && <div>Store Phone: {editableReceiptData.storePhone}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Editable Fields Section */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
                      <h5 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#4B5563' }}>Order Information</h5>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Order ID:</strong> {previewData.orderId || 'Unknown'}
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Date:</strong> {formatDate(previewData.createdAt)}
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Amount:</strong> {getCurrencySymbol(previewData.currency || 'GBP')}{formatPrice(Math.abs(previewData.amount || previewData.totalAmount), previewData.currency || 'GBP')}
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Payment Method:</strong>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editableReceiptData.paymentMethod || ''}
                            onChange={(e) => handleReceiptFieldChange('paymentMethod', e.target.value)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.25rem',
                              marginTop: '0.25rem',
                              border: '1px solid #D1D5DB',
                              borderRadius: '0.25rem',
                              fontSize: '0.85rem'
                            }}
                          />
                        ) : (
                          ' ' + (previewData.paymentMethod ? previewData.paymentMethod.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown')
                        )}
                      </div>
                      
                      {/* Store information section - editable */}
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem', marginTop: '1rem' }}>
                        <strong style={{ color: '#4B5563' }}>Store Name:</strong>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editableReceiptData.storeName || ''}
                            onChange={(e) => handleReceiptFieldChange('storeName', e.target.value)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.25rem',
                              marginTop: '0.25rem',
                              border: '1px solid #D1D5DB',
                              borderRadius: '0.25rem',
                              fontSize: '0.85rem'
                            }}
                          />
                        ) : (
                          ' ' + (editableReceiptData.storeName || '')
                        )}
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Store Phone:</strong>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editableReceiptData.storePhone || ''}
                            onChange={(e) => handleReceiptFieldChange('storePhone', e.target.value)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.25rem',
                              marginTop: '0.25rem',
                              border: '1px solid #D1D5DB',
                              borderRadius: '0.25rem',
                              fontSize: '0.85rem'
                            }}
                          />
                        ) : (
                          ' ' + (editableReceiptData.storePhone || 'Not provided')
                        )}
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Delivery Method:</strong>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editableReceiptData.deliveryMethod || ''}
                            onChange={(e) => handleReceiptFieldChange('deliveryMethod', e.target.value)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.25rem',
                              marginTop: '0.25rem',
                              border: '1px solid #D1D5DB',
                              borderRadius: '0.25rem',
                              fontSize: '0.85rem'
                            }}
                          />
                        ) : (
                          ' ' + (editableReceiptData.deliveryMethod || 'Not specified')
                        )}
                      </div>
                      
                      {receiptType === 'refund' && (
                        <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          <strong style={{ color: '#4B5563' }}>Refund Reason:</strong>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editableReceiptData.refundReason || ''}
                              onChange={(e) => handleReceiptFieldChange('refundReason', e.target.value)}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '0.25rem',
                                marginTop: '0.25rem',
                                border: '1px solid #D1D5DB',
                                borderRadius: '0.25rem',
                                fontSize: '0.85rem'
                              }}
                            />
                          ) : (
                            ' ' + (editableReceiptData.refundReason || 'Not specified')
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
                      <h5 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#4B5563' }}>Customer Information</h5>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Name:</strong>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editableReceiptData.customerName || ''}
                            onChange={(e) => handleReceiptFieldChange('customerName', e.target.value)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.25rem',
                              marginTop: '0.25rem',
                              border: '1px solid #D1D5DB',
                              borderRadius: '0.25rem',
                              fontSize: '0.85rem'
                            }}
                          />
                        ) : (
                          ' ' + (editableReceiptData.customerName || 'Unknown Customer')
                        )}
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>ID:</strong> {previewData.customerId || 'Unknown'}
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Email:</strong>
                        {isEditing ? (
                          <input 
                            type="email" 
                            value={editableReceiptData.customerEmail || ''}
                            onChange={(e) => handleReceiptFieldChange('customerEmail', e.target.value)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.25rem',
                              marginTop: '0.25rem',
                              border: '1px solid #D1D5DB',
                              borderRadius: '0.25rem',
                              fontSize: '0.85rem'
                            }}
                          />
                        ) : (
                          ' ' + (editableReceiptData.customerEmail || 'Not provided')
                        )}
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Phone:</strong>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editableReceiptData.customerPhone || ''}
                            onChange={(e) => handleReceiptFieldChange('customerPhone', e.target.value)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.25rem',
                              marginTop: '0.25rem',
                              border: '1px solid #D1D5DB',
                              borderRadius: '0.25rem',
                              fontSize: '0.85rem'
                            }}
                          />
                        ) : (
                          ' ' + (editableReceiptData.customerPhone || 'Not provided')
                        )}
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#4B5563' }}>Address:</strong> 
                        {isEditing ? (
                          <textarea 
                            value={editableReceiptData.deliveryAddress || ''}
                            onChange={(e) => handleReceiptFieldChange('deliveryAddress', e.target.value)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.25rem',
                              marginTop: '0.25rem',
                              border: '1px solid #D1D5DB',
                              borderRadius: '0.25rem',
                              fontSize: '0.85rem',
                              minHeight: '60px',
                              resize: 'vertical'
                            }}
                          />
                        ) : (
                          <div style={{ 
                            fontSize: '0.85rem',
                            color: '#4B5563',
                            maxHeight: '60px',
                            overflowY: 'auto',
                            padding: '0.25rem 0'
                          }}>
                            {editableReceiptData.deliveryAddress || previewData.shippingAddress || 'Not provided'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Order Items Section */}
                  <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E5E7EB', marginBottom: '1.5rem' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#4B5563' }}>Order Items</h5>
                    {previewData.items && previewData.items.length > 0 ? (
                      <div style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Item</th>
                              <th style={{ padding: '0.5rem', textAlign: 'center' }}>Qty</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Price</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.items.map((item, index) => {
                              const itemName = item.itemName || item.name || 'Product';
                              const itemPrice = item.price || 0;
                              const quantity = item.quantity || 1;
                              const lineTotal = itemPrice * quantity;
                              
                              return (
                                <tr key={index} style={{ borderBottom: index < previewData.items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                                  <td style={{ padding: '0.5rem' }}>{itemName}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{quantity}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                    {getCurrencySymbol(previewData.currency || 'GBP')}{formatPrice(itemPrice, previewData.currency || 'GBP')}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                    {getCurrencySymbol(previewData.currency || 'GBP')}{formatPrice(lineTotal, previewData.currency || 'GBP')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ color: '#6B7280', fontStyle: 'italic', fontSize: '0.85rem' }}>No detailed item information available</p>
                    )}
                  </div>
                  
                  <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#4B5563' }}>
                    This will generate a comprehensive receipt with all available order details and send it directly to the customer via the messaging system.
                    {isEditing && ' Your edits will be included in the receipt.'}
                  </p>
                  
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={handleSendReceipt}
                      disabled={receiptLoading}
                      style={{
                        backgroundColor: '#6366F1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: receiptLoading ? 'default' : 'pointer',
                        opacity: receiptLoading ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem'
                      }}
                    >
                      {receiptLoading ? 'Sending...' : '🧾 Regenerate & Send Receipt'}
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedTransaction(null);
                        setPreviewData(null);
                        setEditableReceiptData(null);
                      }}
                      style={{
                        backgroundColor: '#F3F4F6',
                        color: '#4B5563',
                        border: '1px solid #D1D5DB',
                        borderRadius: '4px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: '1rem', color: '#4B5563' }}>
                  Select a {receiptType === 'refund' ? 'refund' : 'order'} transaction from the table below to regenerate its receipt.
                </p>
              </div>
            )}
            
            {/* Recently Generated Receipts */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                Recently Generated Receipts
              </h3>
              
              {regeneratedReceipts.length === 0 ? (
                <p style={{ color: '#6B7280', fontStyle: 'italic', fontSize: '0.875rem' }}>
                  No receipts have been regenerated yet.
                </p>
              ) : (
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px'
                }}>
                  <table className="reports-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', color: '#4B5563', textAlign: 'left' }}>Time</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', color: '#4B5563', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', color: '#4B5563', textAlign: 'left' }}>Order ID</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', color: '#4B5563', textAlign: 'left' }}>Customer</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', color: '#4B5563', textAlign: 'left' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regeneratedReceipts.map((receipt, index) => (
                        <tr key={receipt.id} style={{ borderBottom: index < regeneratedReceipts.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>{formatDate(receipt.timestamp)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                            <span style={{ 
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: receipt.receiptType === 'refund' ? '#FEE2E2' : '#DCFCE7',
                              color: receipt.receiptType === 'refund' ? '#991B1B' : '#166534',
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
                              {receipt.receiptType === 'refund' ? '💸 Refund' : '🛍️ Order'}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>{receipt.orderId ? receipt.orderId.slice(-8) : 'N/A'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                            {receipt.customerName}
                            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                              {receipt.email ? receipt.email : 'No email'}
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                            <div style={{ fontWeight: '600' }}>
                              {getCurrencySymbol(receipt.currency || 'GBP')}{formatPrice(Math.abs(receipt.amount), receipt.currency || 'GBP')}
                            </div>
                            <div style={{ marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              <span title="Contact information" style={{ 
                                fontSize: '10px', 
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: (receipt.dataQuality?.hasEmail || receipt.dataQuality?.hasPhone) ? '#DCFCE7' : '#FEF2F2',
                                color: (receipt.dataQuality?.hasEmail || receipt.dataQuality?.hasPhone) ? '#166534' : '#991B1B',
                                border: `1px solid ${(receipt.dataQuality?.hasEmail || receipt.dataQuality?.hasPhone) ? '#BBF7D0' : '#FEE2E2'}`
                              }}>
                                {(receipt.dataQuality?.hasEmail || receipt.dataQuality?.hasPhone) ? '✓' : '✕'} Contact
                              </span>
                              <span title="Address included" style={{ 
                                fontSize: '10px', 
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: receipt.dataQuality?.hasAddress ? '#DCFCE7' : '#FEF2F2',
                                color: receipt.dataQuality?.hasAddress ? '#166534' : '#991B1B',
                                border: `1px solid ${receipt.dataQuality?.hasAddress ? '#BBF7D0' : '#FEE2E2'}`
                              }}>
                                {receipt.dataQuality?.hasAddress ? '✓' : '✕'} Address
                              </span>
                              <span title="Items included" style={{ 
                                fontSize: '10px', 
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: receipt.dataQuality?.hasItems ? '#DCFCE7' : '#FEF2F2',
                                color: receipt.dataQuality?.hasItems ? '#166534' : '#991B1B',
                                border: `1px solid ${receipt.dataQuality?.hasItems ? '#BBF7D0' : '#FEE2E2'}`
                              }}>
                                {receipt.dataQuality?.hasItems ? `✓ ${receipt.itemCount} Items` : '✕ No Items'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Transactions Section - Conditional based on receipt type */}
        <div style={{ marginBottom: '3rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '600', 
                color: '#1F2937' 
              }}>
                {receiptType === 'refund' ? '💸 Refunds Tracking' : '🛍️ Orders Tracking'}
              </h2>
              {receiptType === 'refund' && (
                <div style={{
                  backgroundColor: storeRefundsEnabled ? '#DBEAFE' : '#FEF2F2',
                  border: `1px solid ${storeRefundsEnabled ? '#93C5FD' : '#FCA5A5'}`,
                  borderRadius: '4px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  color: storeRefundsEnabled ? '#1E40AF' : '#B91C1C',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}>
                  <span>{storeRefundsEnabled ? '✅' : 'ℹ️'}</span>
                  <span>{storeRefundsEnabled 
                    ? 'Refunds are enabled for your store' 
                    : 'Refunds are currently disabled (historical refunds still visible)'}</span>
                </div>
              )}
            </div>
            
            {/* Transaction type toggle */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={() => {
                    setReceiptType('order');
                    setSelectedTransaction(null);
                  }}
                  style={{
                    padding: '0.5rem 1.5rem',
                    backgroundColor: receiptType === 'order' ? '#3B82F6' : '#F3F4F6',
                    color: receiptType === 'order' ? 'white' : '#6B7280',
                    border: `1px solid ${receiptType === 'order' ? '#2563EB' : '#D1D5DB'}`,
                    borderRadius: '0.375rem',
                    fontWeight: receiptType === 'order' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🛍️ View Orders
                </button>
                <button 
                  onClick={() => {
                    setReceiptType('refund');
                    setSelectedTransaction(null);
                  }}
                  style={{
                    padding: '0.5rem 1.5rem',
                    backgroundColor: receiptType === 'refund' ? '#3B82F6' : '#F3F4F6',
                    color: receiptType === 'refund' ? 'white' : '#6B7280',
                    border: `1px solid ${receiptType === 'refund' ? '#2563EB' : '#D1D5DB'}`,
                    borderRadius: '0.375rem',
                    fontWeight: receiptType === 'refund' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  💸 View Refunds
                </button>
              </div>
            </div>
            
            {/* Loading state */}
            {(receiptType === 'refund' && loadingRefunds) || (receiptType === 'order' && loadingOrders) ? (
              <div style={{ 
                padding: '2rem', 
                textAlign: 'center',
                color: '#6B7280',
                backgroundColor: '#F9FAFB',
                borderRadius: '8px',
                border: '1px solid #E5E7EB'
              }}>
                Loading {receiptType} data...
              </div>
            ) : 
            /* Empty state */
            (receiptType === 'refund' && refundTransactions.length === 0) || (receiptType === 'order' && allOrders.length === 0) ? (
              <div style={{ 
                padding: '2rem', 
                textAlign: 'center',
                backgroundColor: '#F9FAFB',
                borderRadius: '8px',
                border: '1px solid #E5E7EB'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
                  {receiptType === 'refund' ? '🔄' : '🛍️'}
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                  No {receiptType === 'refund' ? 'Refunds' : 'Orders'} {receiptType === 'refund' ? 'Processed' : 'Found'} Yet
                </h3>
                <p style={{ color: '#6B7280' }}>
                  {receiptType === 'refund' 
                    ? 'When you process refunds, they will appear here for tracking and record keeping'
                    : 'When customers place orders, they will appear here for tracking and receipt generation'
                  }
                </p>
              </div>
            ) : (
              /* Table display */
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                overflow: 'hidden'
              }}>
                {/* Mobile hint */}
                {window.innerWidth <= 768 && (
                  <div style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#F0F9FF',
                    color: '#1E40AF',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    borderBottom: '1px solid #E5E7EB'
                  }}>
                    👈 Scroll horizontally to see all columns
                  </div>
                )}
                <div style={{
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  maxWidth: '100%'
                }}>
                  <table className="reports-table" style={{
                    width: '100%',
                    minWidth: '800px',
                    borderCollapse: 'collapse'
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: '#F9FAFB',
                        borderBottom: '1px solid #E5E7EB'
                      }}>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#4B5563', fontWeight: '600', fontSize: '0.875rem' }}>
                          {receiptType === 'refund' ? 'Refund ID' : 'Order ID'}
                        </th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#4B5563', fontWeight: '600', fontSize: '0.875rem' }}>Date</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#4B5563', fontWeight: '600', fontSize: '0.875rem' }}>Customer</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#4B5563', fontWeight: '600', fontSize: '0.875rem' }}>Amount</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#4B5563', fontWeight: '600', fontSize: '0.875rem' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#4B5563', fontWeight: '600', fontSize: '0.875rem' }}>Payment Method</th>
                        {receiptType === 'refund' && (
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#4B5563', fontWeight: '600', fontSize: '0.875rem' }}>Reason</th>
                        )}
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#4B5563', fontWeight: '600', fontSize: '0.875rem' }}>Actions</th>
                      </tr>
                    </thead>
                  <tbody>
                    {(receiptType === 'refund' ? refundTransactions : allOrders).map((transaction) => (
                      <tr 
                        key={transaction.id} 
                        style={{ 
                          borderBottom: '1px solid #E5E7EB',
                          backgroundColor: selectedTransaction?.id === transaction.id ? '#F3F4F6' : 'white',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onClick={() => handleTransactionClick(transaction)}
                        onMouseEnter={(e) => {
                          if (selectedTransaction?.id !== transaction.id) {
                            e.currentTarget.style.backgroundColor = '#F9FAFB';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedTransaction?.id !== transaction.id) {
                            e.currentTarget.style.backgroundColor = 'white';
                          }
                        }}
                      >
                        <td style={{ padding: '0.75rem 1rem', color: '#1F2937', fontSize: '0.875rem', fontWeight: '500' }}>
                          {transaction.orderId ? transaction.orderId.slice(-8) : transaction.id ? transaction.id.slice(-8) : 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#6B7280', fontSize: '0.875rem' }}>
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#1F2937', fontSize: '0.875rem' }}>
                          {transaction.customerName || 'Unknown Customer'}
                        </td>
                        <td style={{ 
                          padding: '0.75rem 1rem', 
                          color: receiptType === 'refund' ? '#EF4444' : '#047857', 
                          fontWeight: '500', 
                          fontSize: '0.875rem' 
                        }}>
                          {getCurrencySymbol(transaction.currency || 'GBP')}
                          {formatPrice(Math.abs(transaction.amount || transaction.totalAmount || 0), transaction.currency || 'GBP')}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: getStatusColor(getTransactionStatus(transaction)),
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {getStatusText(getTransactionStatus(transaction))}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#1F2937', fontSize: '0.875rem' }}>
                          {transaction.paymentMethod ? transaction.paymentMethod.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown'}
                        </td>
                        {receiptType === 'refund' && (
                          <td style={{ padding: '0.75rem 1rem', color: '#1F2937', fontSize: '0.875rem', fontStyle: transaction.refundReason ? 'normal' : 'italic' }}>
                            {transaction.refundReason ? `"${transaction.refundReason}"` : 'No reason provided'}
                          </td>
                        )}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row selection
                              handleTransactionClick(transaction);
                            }}
                            style={{
                              backgroundColor: '#6366F1',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.375rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#4F46E5';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#6366F1';
                            }}
                          >
                            Generate Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>

          {/* Reports & Complaints Section */}
          <div style={{ 
            backgroundColor: '#FFFFFF', 
            borderRadius: '8px', 
            border: '1px solid #E5E7EB', 
            padding: '1.5rem',
            marginTop: '2rem'
          }}>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: '#1F2937', 
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📋 Reports & Complaints
            </h2>

        {complaints.length === 0 ? (
          <div style={{
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              No Reports or Complaints
            </h3>
            <p style={{ color: '#6B7280' }}>
              Great! You have no reports or complaints filed against your store.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {complaints.map((complaint) => (
              <div key={complaint.id} style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: '600', 
                      color: '#1F2937',
                      marginBottom: '0.25rem'
                    }}>
                      {complaint.type === 'store_report' ? '📍 Store Report' : 'Complaint'} #{complaint.complaintId?.split('_')[1] || complaint.id?.slice(-8) || 'Unknown'}
                    </h3>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                      Filed on {formatDate(complaint.timestamp || complaint.submittedAt)}
                    </p>
                    {complaint.type === 'store_report' && (
                      <div style={{
                        display: 'inline-block',
                        backgroundColor: '#7C3AED20',
                        color: '#7C3AED',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        marginTop: '0.25rem'
                      }}>
                        Store Report
                      </div>
                    )}
                  </div>
                  <div style={{
                    backgroundColor: getStatusColor(complaint.status),
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {getStatusText(complaint.status)}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                        {complaint.type === 'store_report' ? 'Reporter' : 'Customer'}
                      </p>
                      <p style={{ color: '#6B7280' }}>
                        {complaint.reporterName || complaint.customerName || 'Unknown'}
                      </p>
                      <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                        {complaint.reporterEmail || complaint.customerEmail || 'N/A'}
                      </p>
                    </div>
                    {complaint.type === 'store_report' ? (
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                          Report Reason
                        </p>
                        <p style={{ color: '#DC2626', fontWeight: '600' }}>
                          {complaint.reason ? complaint.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                          Order ID
                        </p>
                        <p style={{ color: '#6B7280', fontFamily: 'monospace' }}>
                          {complaint.refundData?.orderId || 'Unknown'}
                        </p>
                      </div>
                    )}
                    {complaint.refundData ? (
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                          Refund Amount
                        </p>
                        <p style={{ color: '#6B7280' }}>
                          {getCurrencySymbol(complaint.refundData?.currency || 'GBP')}
                          {formatPrice(complaint.refundData?.amount || 0, complaint.refundData?.currency || 'GBP')}
                        </p>
                      </div>
                    ) : complaint.type === 'store_report' ? (
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                          Report Type  
                        </p>
                        <div style={{
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}>
                          Store Violation
                        </div>
                      </div>
                    ) : null}
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                        Issue Type
                      </p>
                      <p style={{ color: '#6B7280' }}>
                        {complaint.reason 
                          ? complaint.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                          : complaint.complaintType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    {complaint.type === 'store_report' ? 'Report Details' : 'Customer Explanation'}
                  </p>
                  <div style={{
                    backgroundColor: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    color: '#374151'
                  }}>
                    {complaint.details || complaint.explanation || 'No details provided'}
                  </div>
                </div>

                {complaint.screenshots && complaint.screenshots.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                      Customer Screenshots ({complaint.screenshots.length})
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {complaint.screenshots.map((screenshot, index) => (
                        <a
                          key={index}
                          href={screenshot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#3B82F6',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            fontWeight: '500'
                          }}
                        >
                          📸 {screenshot.name || `Screenshot ${index + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.875rem'
                }}>
                  <p style={{ color: '#92400E', fontWeight: '600', marginBottom: '0.25rem' }}>
                    ⚠️ Important Note
                  </p>
                  <p style={{ color: '#92400E' }}>
                    This complaint has been submitted to the admin for review. 
                    You will be contacted if additional information is required.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Receipt Generation Modal */}
      {showReceiptModal && selectedTransaction && (
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '1.5rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                Generate Receipt
              </h2>
              <button
                onClick={closeReceiptModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.75rem' }}>
                Select Receipt Type:
              </h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => handleReceiptTypeChange('order')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: receiptType === 'order' ? '#3B82F6' : '#F3F4F6',
                    color: receiptType === 'order' ? 'white' : '#6B7280',
                    border: `1px solid ${receiptType === 'order' ? '#2563EB' : '#D1D5DB'}`,
                    borderRadius: '0.375rem',
                    fontWeight: receiptType === 'order' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div>🧾</div>
                  <div>Order Receipt</div>
                </button>
                <button
                  onClick={() => handleReceiptTypeChange('refund')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: receiptType === 'refund' ? '#3B82F6' : '#F3F4F6',
                    color: receiptType === 'refund' ? 'white' : '#6B7280',
                    border: `1px solid ${receiptType === 'refund' ? '#2563EB' : '#D1D5DB'}`,
                    borderRadius: '0.375rem',
                    fontWeight: receiptType === 'refund' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div>💸</div>
                  <div>Refund Receipt</div>
                </button>
              </div>
            </div>
            
            {previewData && (
              <div style={{ 
                backgroundColor: '#F9FAFB', 
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Receipt Preview
                </h4>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #E5E7EB',
                  padding: '1rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  <div style={{ marginBottom: '0.75rem', fontWeight: 'bold' }}>
                    {receiptType === 'refund' ? '🧾 REFUND RECEIPT' : '🧾 ORDER RECEIPT'}
                  </div>
                  
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div><strong>Order ID:</strong> {previewData.orderId || 'Unknown'}</div>
                    <div><strong>Date:</strong> {formatDate(previewData.createdAt)}</div>
                    <div><strong>Customer:</strong> {previewData.customerName || 'Unknown'}</div>
                    {previewData.customerEmail && <div><strong>Email:</strong> {previewData.customerEmail}</div>}
                    {previewData.customerPhone && <div><strong>Phone:</strong> {previewData.customerPhone}</div>}
                  </div>
                  
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid #E5E7EB', paddingTop: '0.75rem' }}>
                    <div style={{ marginBottom: '0.5rem' }}><strong>Items:</strong></div>
                    {previewData.items && previewData.items.length > 0 ? (
                      previewData.items.map((item, i) => (
                        <div key={i} style={{ marginBottom: '0.25rem' }}>
                          • {item.name || item.itemName} × {item.quantity || 1}
                        </div>
                      ))
                    ) : (
                      <div>No items available</div>
                    )}
                  </div>
                  
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid #E5E7EB', paddingTop: '0.75rem' }}>
                    <div><strong>Total:</strong> {getCurrencySymbol(previewData.currency || 'GBP')}{formatPrice(Math.abs(previewData.amount || previewData.totalAmount), previewData.currency || 'GBP')}</div>
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '1.5rem'
            }}>
              <button
                onClick={closeReceiptModal}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: '#F3F4F6',
                  color: '#4B5563',
                  border: '1px solid #D1D5DB',
                  borderRadius: '0.375rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => sendReceiptViaEmail(previewData || selectedTransaction)}
                disabled={receiptLoading}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: receiptLoading ? '#9ca3af' : '#f59e0b',
                  color: 'white',
                  border: '1px solid #d97706',
                  borderRadius: '0.375rem',
                  fontWeight: '600',
                  cursor: receiptLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: receiptLoading ? 0.7 : 1
                }}
              >
                <span>📧</span>
                <span>{receiptLoading ? 'Sending...' : 'Send via Email'}</span>
              </button>
              <button
                onClick={handleSendReceipt}
                disabled={receiptLoading}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: '#3B82F6',
                  color: 'white',
                  border: '1px solid #2563EB',
                  borderRadius: '0.375rem',
                  fontWeight: '600',
                  cursor: receiptLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: receiptLoading ? 0.7 : 1
                }}
              >
                {receiptLoading ? (
                  <>
                    <div style={{ 
                      width: '1rem', 
                      height: '1rem', 
                      borderRadius: '50%', 
                      border: '2px solid rgba(255,255,255,0.3)', 
                      borderTopColor: 'white',
                      animation: 'spin 1s linear infinite' 
                    }}></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Receipt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Receipt Modal */}
      <EmailReceiptModal
        isOpen={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          setReceiptForEmail(null);
          setEmailLoading(false);
        }}
        onSend={handleEmailSend}
        isLoading={emailLoading}
        defaultEmail={currentUser?.email || ''}
        receiptDetails={receiptForEmail ? {
          orderId: receiptForEmail.orderId || receiptForEmail.orderID || receiptForEmail.id || 'Unknown',
          storeName: receiptForEmail.storeName || receiptForEmail.businessName || 'Store',
          amount: receiptForEmail.amount || receiptForEmail.totalAmount || 0,
          currency: receiptForEmail.currency || 'GBP'
        } : {}}
      />

      {/* Message Modal */}
      {messageModal && (
        <MessageModal
          isOpen={true}
          onClose={() => setMessageModal(null)}
          type={messageModal.type}
          title={messageModal.title}
          message={messageModal.message}
          details={messageModal.details}
          primaryButtonText={messageModal.primaryButtonText}
          secondaryButtonText={messageModal.secondaryButtonText}
          onPrimaryAction={messageModal.onPrimaryAction}
          onSecondaryAction={messageModal.onSecondaryAction}
        />
      )}

      {/* Notification Toast */}
      {notification && (
        <NotificationToast
          isVisible={true}
          onClose={() => setNotification(null)}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />
      )}
      
      </div>
    </div>
  );
}

export default ReportsPage;
