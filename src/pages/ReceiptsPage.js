import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';

function ReceiptsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  // Add CSS for loading spinner animation
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Filter states
  const [filterType, setFilterType] = useState('all'); // 'all', 'orders', 'refunds'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'
  
  // Pagination
  const [page, setPage] = useState(1);
  const receiptsPerPage = 10;
  
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

  // Get short date format for display
  const getShortDate = (timestamp) => {
    if (!timestamp) return '';
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleDateString();
  };

  // Close receipt modal
  const closeReceiptModal = () => {
    setShowReceiptModal(false);
    setSelectedReceipt(null);
  };

  // View receipt details
  const viewReceiptDetails = async (receipt) => {
    // Make a copy of the receipt to avoid modifying the original
    let receiptWithStoreInfo = {...receipt};
    
    try {
      // If we have a storeId or sellerId, fetch store details to get the proper store name
      const storeId = receipt.storeId || receipt.sellerId;
      const userId = receipt.userId || receipt.buyerId;
      
      if (storeId) {
        try {
          // First check the stores collection - this is the primary source
          const storeDoc = await getDoc(doc(db, 'stores', storeId));
          
          if (storeDoc.exists()) {
            const storeData = storeDoc.data();
            console.log('Store data from Firestore:', storeData);
            
            // Get store name from store data - force finding the actual store name
            const storeName = storeData.storeName || 
                             storeData.businessName || 
                             storeData.name;
            
            if (!storeName) {
              console.warn(`No store name found in store document for ID: ${storeId}`);
            }
            
            // Update receipt with store information using proper field names
            receiptWithStoreInfo = {
              ...receiptWithStoreInfo,
              // Only use actual store data - NEVER fallback to 'Store'
              storeName: storeName || 'Store ID: ' + storeId.substring(0, 8),
              // Enhanced address detection with multiple field checks
              storeAddress: storeData.storeLocation || 
                          storeData.address || 
                          (storeData.location?.address) || 
                          storeData.businessAddress ||
                          '',
              // Enhanced phone detection with multiple field checks
              storePhone: storeData.phoneNumber || 
                         storeData.phone || 
                         storeData.contactNumber || 
                         storeData.businessPhone ||
                         '',
              phoneType: storeData.phoneType || 'work',
              storeEmail: storeData.email || '',
              // Include store owner info for better connectivity
              storeOwnerId: storeData.ownerId || storeId,
              storeData: storeData
            };
          } else {
            // If no store document, try to get user profile
            // The storeId might be the user ID of the store owner
            const userDoc = await getDoc(doc(db, 'users', storeId));
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              console.log('Store owner data from Firestore:', userData);
              
              // Update receipt with user information - no fallbacks to 'Store'
              receiptWithStoreInfo = {
                ...receiptWithStoreInfo,
                // Only use actual store name data from user profile
                storeName: userData.storeName || 
                           userData.businessName || 
                           userData.displayName || 
                           'Seller ID: ' + storeId.substring(0, 8),
                storeAddress: userData.storeLocation || 
                           userData.address || 
                           userData.businessAddress || 
                           (userData.location?.address) || 
                           '',
                storePhone: userData.phoneNumber || 
                          userData.phone || 
                          userData.contactNumber || 
                          userData.businessPhone ||
                          '',
                phoneType: userData.phoneType || 'work',
                storeEmail: userData.email || '',
                storeOwnerId: storeId
              };
            }
          }
        } catch (error) {
          console.error('Error fetching store information:', error);
        }
      }
      
      // If we have userId or buyerId, try to get additional information
      if (userId && (!receiptWithStoreInfo.storeName || receiptWithStoreInfo.storeName === 'Store' || receiptWithStoreInfo.storeName.includes('ID:'))) {
        try {
          console.log('Looking up additional store information by user ID:', userId);
          
          // First check if this user has any stores associated with them
          const userStoresQuery = query(collection(db, 'stores'), 
                                      where('ownerId', '==', userId));
          const userStoresSnapshot = await getDocs(userStoresQuery);
          
          if (!userStoresSnapshot.empty) {
            // User is a store owner - get their store information
            const storeData = userStoresSnapshot.docs[0].data();
            console.log('Found store owned by user:', storeData);
            
            // Use the store information to enhance the receipt - no fallbacks
            receiptWithStoreInfo = {
              ...receiptWithStoreInfo,
              storeId: userStoresSnapshot.docs[0].id,
              storeName: storeData.storeName || storeData.businessName || storeData.name || 'Store ID: ' + userStoresSnapshot.docs[0].id.substring(0, 8),
              storeAddress: storeData.storeLocation || 
                           storeData.address || 
                           storeData.businessAddress || 
                           (storeData.location?.address) || 
                           '',
              storePhone: storeData.phoneNumber || 
                         storeData.phone || 
                         storeData.contactNumber || 
                         storeData.businessPhone ||
                         '',
              phoneType: storeData.phoneType || 'work',
              storeEmail: storeData.email || '',
              storeData: storeData
            };
          } else {
            // Check if we have user information
            const userDoc = await getDoc(doc(db, 'users', userId));
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              console.log('User data from Firestore:', userData);
              
              // Check if the user has store information in their profile
              if (userData.storeName || userData.businessName || userData.storeInfo) {
                // The user has store information in their profile - no fallbacks
                receiptWithStoreInfo = {
                  ...receiptWithStoreInfo,
                  storeName: userData.storeName || userData.businessName || userData.displayName || 'User ID: ' + userId.substring(0, 8),
                  storeAddress: userData.storeLocation || 
                               userData.address || 
                               userData.businessAddress || 
                               (userData.location?.address) || 
                               (typeof userData.location === 'string' ? userData.location : '') || 
                               '',
                  storePhone: userData.phoneNumber || 
                             userData.phone || 
                             userData.contactNumber || 
                             userData.businessPhone ||
                             '',
                  phoneType: userData.phoneType || 'personal',
                  storeEmail: userData.email || ''
                };
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user store information:', error);
        }
      }

      // Look for fee information in transactions collection
      if (receipt.orderId) {
        // Try to find more detailed fee information in transactions collection
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('orderId', '==', receipt.orderId)
        );

        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        if (!transactionsSnapshot.empty) {
          const transactionDoc = transactionsSnapshot.docs[0];
          const transactionData = transactionDoc.data();
          
          // Update fee information if available
          if (transactionData.deliveryFee || transactionData.serviceFee || transactionData.platformFee) {
            console.log('Found fee data in transactions:', transactionData.deliveryFee, transactionData.serviceFee);
            receiptWithStoreInfo = {
              ...receiptWithStoreInfo,
              deliveryFee: transactionData.deliveryFee || receiptWithStoreInfo.deliveryFee || 0,
              serviceFee: transactionData.serviceFee || receiptWithStoreInfo.serviceFee || 0,
              platformFee: transactionData.platformFee || receiptWithStoreInfo.platformFee || 0,
              subtotal: transactionData.subtotal || receiptWithStoreInfo.subtotal || 0,
              breakdown: transactionData.breakdown || receiptWithStoreInfo.breakdown || {}
            };
          }
        }
        
        // Also check payments collection
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('orderId', '==', receipt.orderId)
        );
        
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        if (!paymentsSnapshot.empty) {
          const paymentDoc = paymentsSnapshot.docs[0];
          const paymentData = paymentDoc.data();
          
          // Check for breakdown in payment data
          if (paymentData.breakdown) {
            console.log('Found fee data in payments breakdown:', paymentData.breakdown);
            receiptWithStoreInfo = {
              ...receiptWithStoreInfo,
              deliveryFee: paymentData.breakdown.deliveryFee || receiptWithStoreInfo.deliveryFee || 0,
              serviceFee: paymentData.breakdown.serviceFee || receiptWithStoreInfo.serviceFee || 0,
              subtotal: paymentData.breakdown.subtotal || receiptWithStoreInfo.subtotal || 0,
              platformFee: paymentData.breakdown.platformFee || receiptWithStoreInfo.platformFee || 0
            };
          } else if (paymentData.deliveryFee || paymentData.serviceFee) {
            receiptWithStoreInfo = {
              ...receiptWithStoreInfo,
              deliveryFee: paymentData.deliveryFee || receiptWithStoreInfo.deliveryFee || 0,
              serviceFee: paymentData.serviceFee || receiptWithStoreInfo.serviceFee || 0,
              platformFee: paymentData.platformFee || receiptWithStoreInfo.platformFee || 0
            };
          }
          
          // Get delivery type from payment data if available
          if (paymentData.deliveryType) {
            receiptWithStoreInfo.deliveryType = paymentData.deliveryType;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching additional receipt information:', error);
    }
    
      // Calculate subtotal if it's missing but we have all the necessary information
    if (!receiptWithStoreInfo.subtotal && receiptWithStoreInfo.amount > 0) {
      // Ensure fee values are numbers, not undefined
      const serviceFee = Number(receiptWithStoreInfo.serviceFee || 0);
      const deliveryFee = Number(receiptWithStoreInfo.deliveryFee || 0);
      const platformFee = Number(receiptWithStoreInfo.platformFee || 0);
      
      if (serviceFee > 0 || deliveryFee > 0 || platformFee > 0) {
        // Subtotal = Total - (serviceFee + deliveryFee + platformFee)
        receiptWithStoreInfo.subtotal = receiptWithStoreInfo.amount - serviceFee - deliveryFee - platformFee;
      } else {
        // If there are no fees, use amount as subtotal
        receiptWithStoreInfo.subtotal = receiptWithStoreInfo.amount;
      }
    }
    
    // Ensure all fee fields exist with numeric values (prevents UI errors)
    receiptWithStoreInfo.serviceFee = Number(receiptWithStoreInfo.serviceFee || 0);
    receiptWithStoreInfo.deliveryFee = Number(receiptWithStoreInfo.deliveryFee || 0);
    receiptWithStoreInfo.platformFee = Number(receiptWithStoreInfo.platformFee || 0);
    receiptWithStoreInfo.subtotal = Number(receiptWithStoreInfo.subtotal || 0);
    
    // Log the final store information to verify we have the data
    console.log("Final receipt store information:", {
      storeName: receiptWithStoreInfo.storeName,
      storeAddress: receiptWithStoreInfo.storeAddress,
      storePhone: receiptWithStoreInfo.storePhone,
      storeEmail: receiptWithStoreInfo.storeEmail,
      storeBusinessId: receiptWithStoreInfo.storeBusinessId,
      storeRegistrationNumber: receiptWithStoreInfo.storeRegistrationNumber,
      storeVatNumber: receiptWithStoreInfo.storeVatNumber
    });
    
    // Set the enhanced receipt with store information
    setSelectedReceipt(receiptWithStoreInfo);
    setShowReceiptModal(true);
  };

  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Create queries for different receipt sources
        try {
          console.log("Fetching all orders and receipts for user:", user.uid);
          
          // Primary: Query the dedicated receipts collection for all user receipts
          // This is the main source of receipts data
          const receiptsQuery = query(
            collection(db, 'receipts'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc')
          );
          
          // Secondary: Also query receipts where user is the buyer
          const buyerReceiptsQuery = query(
            collection(db, 'receipts'),
            where('buyerId', '==', user.uid),
            orderBy('timestamp', 'desc')
          );
          
          // For backwards compatibility: Check for refund receipts 
          // that might be specifically tagged with the user ID
          const refundReceiptsQuery = query(
            collection(db, 'receipts'),
            where('refundUserId', '==', user.uid),
            orderBy('timestamp', 'desc')
          );
          
          // For regenerated receipts with specific flag
          const regeneratedReceiptsQuery = query(
            collection(db, 'receipts'),
            where('buyerId', '==', user.uid),
            where('isRegenerated', '==', true),
            orderBy('timestamp', 'desc')
          );
          
          // Execute all queries from the receipts collection
          const [
            receiptsSnapshot,
            buyerReceiptsSnapshot,
            refundReceiptsSnapshot,
            regeneratedReceiptsSnapshot
          ] = await Promise.all([
            getDocs(receiptsQuery),
            getDocs(buyerReceiptsQuery),
            getDocs(refundReceiptsQuery),
            getDocs(regeneratedReceiptsQuery)
          ]);
          
          console.log(`Found receipts - Primary user receipts: ${receiptsSnapshot.size}, ` +
                      `Buyer receipts: ${buyerReceiptsSnapshot.size}, ` +
                      `Refund receipts: ${refundReceiptsSnapshot.size}, ` + 
                      `Regenerated receipts: ${regeneratedReceiptsSnapshot.size}`);
          
          // Process all receipts
          const allReceipts = [];
          
          // Helper function to process receipts from receipts collection
          const processReceipt = (doc) => {
            // Skip if already added
            if (allReceipts.some(r => r.id === doc.id)) return;
            
            const data = doc.data();
            
            // Ensure this receipt belongs to the current user
            if (data.userId !== user.uid && data.buyerId !== user.uid && data.refundUserId !== user.uid) return;
            
            // Add the receipt to our collection
            const receiptData = {
              id: doc.id,
              ...data,
              orderId: data.orderId || doc.id,
              storeName: data.storeName || data.businessName || data.storeData?.businessName || data.storeData?.storeName || data.sellerName || 'Store',
              storeId: data.storeId || data.sellerId,
              amount: data.amount || data.totalAmount || data.total || 0,
              currency: data.currency || 'GBP',
              timestamp: data.timestamp || data.createdAt || new Date(),
              source: 'receipts',
              // Add fee information if available
              subtotal: data.subtotal || (data.breakdown?.subtotal) || null,
              serviceFee: data.serviceFee || (data.breakdown?.serviceFee) || 0,
              deliveryFee: data.deliveryFee || (data.breakdown?.deliveryFee) || 0,
              platformFee: data.platformFee || (data.breakdown?.platformFee) || 0,
              // Ensure we have the receipt type correctly set
              receiptType: data.receiptType || (data.isRefund ? 'refund_receipt' : 'order_receipt')
            };
            
            allReceipts.push(receiptData);
            console.log(`Added receipt from receipts collection: ${doc.id} - ${receiptData.receiptType}`);
          };
          
          // Process receipts from each query
          receiptsSnapshot.forEach(doc => processReceipt(doc));
          buyerReceiptsSnapshot.forEach(doc => processReceipt(doc));
          refundReceiptsSnapshot.forEach(doc => processReceipt(doc));
          regeneratedReceiptsSnapshot.forEach(doc => processReceipt(doc));
          
          console.log(`Total receipts found after processing: ${allReceipts.length}`);
          
          // Sort by timestamp descending (newest first)
          allReceipts.sort((a, b) => {
            const timestampA = a.timestamp || a.createdAt;
            const timestampB = b.timestamp || b.createdAt;
            
            if (!timestampA) return 1;
            if (!timestampB) return -1;
            
            const timeA = timestampA.toMillis ? timestampA.toMillis() : new Date(timestampA).getTime();
            const timeB = timestampB.toMillis ? timestampB.toMillis() : new Date(timestampB).getTime();
            
            return timeB - timeA;
          });
          
          // Process receipts to extract key information
          const processedReceipts = allReceipts.map(receipt => {
            // Since we're using a dedicated receipts collection, most of the fields
            // should already be properly formatted. We'll just ensure all required fields exist.
            
            // Get store information - NEVER default to just 'Store'
            let storeName = receipt.storeName || 
                           receipt.businessName || 
                           receipt.sellerName;
                           
            // If we still don't have a name, check if there's store data embedded
            if (!storeName && receipt.storeData) {
              storeName = receipt.storeData.storeName || 
                         receipt.storeData.businessName || 
                         receipt.storeData.name || 
                         receipt.storeData.displayName;
            }
            
            // If we have a store ID but no name, use a placeholder with ID
            if (!storeName && (receipt.storeId || receipt.sellerId)) {
              const storeId = receipt.storeId || receipt.sellerId;
              storeName = `Store ${storeId.substring(0, 6)}`;
            } else if (!storeName) {
              // Last resort default
              storeName = 'Unknown Store';
            }
            
            // Get order ID
            const orderId = receipt.orderId || receipt.orderID || receipt.id || '';
            
            // Get amount - handle both normal and refund (negative) amounts
            let amount = 0;
            if (receipt.amount !== undefined && receipt.amount !== null) {
              amount = typeof receipt.amount === 'number' ? Math.abs(receipt.amount) : 0;
            } else if (receipt.totalAmount !== undefined && receipt.totalAmount !== null) {
              amount = typeof receipt.totalAmount === 'number' ? Math.abs(receipt.totalAmount) : 0;
            }
            
            // Get currency
            const currency = receipt.currency || 'GBP';
            
            // Get date
            const timestamp = receipt.timestamp || receipt.createdAt || new Date();
            
            // Get items
            const items = receipt.items || [];
            
            // Get payment method
            const paymentMethod = receipt.paymentMethod || 'Card';
            
            // Get delivery method
            const deliveryMethod = receipt.deliveryMethod || 'Not specified';
            
            // Get refund reason for refunds
            const refundReason = receipt.refundReason || receipt.reason || '';
            
            // Get receipt content (most receipts should have this already set)
            const receiptContent = receipt.receiptContent || receipt.content || receipt.message || '';
            
            // Check if this is a regenerated receipt
            const isRegenerated = receipt.isRegenerated || false;
            
            // Return processed receipt with standardized fields
            return {
              id: receipt.id,
              orderId,
              storeName,
              amount,
              currency,
              timestamp,
              items,
              paymentMethod,
              deliveryMethod,
              refundReason,
              receiptType: receipt.receiptType || (receipt.isRefund ? 'refund_receipt' : 'order_receipt'),
              receiptContent,
              isRegenerated,
              rawData: receipt
            };
          });
          
          // Check if we need to search for additional receipts from legacy sources
          // For most users, the receipts collection should be sufficient
          // This code can be enabled if needed for backward compatibility
          /*
          // Legacy code for searching through messages has been removed
          // All receipts should now be properly stored in the receipts collection
          console.log("Using dedicated receipts collection instead of searching through messages");
          */
          
          // Better deduplication and prioritization of receipts
          const receiptsByOrderId = {};
          
          // Group receipts by orderId
          processedReceipts.forEach(receipt => {
            if (!receipt) return;
            
            const orderId = receipt.orderId || receipt.id || 'Unknown';
            
            // If we don't have this order ID yet, add it
            if (!receiptsByOrderId[orderId]) {
              receiptsByOrderId[orderId] = receipt;
              return;
            }
            
            // We have a duplicate order ID - decide which receipt to keep
            const existing = receiptsByOrderId[orderId];
            
            // Always prioritize regenerated receipts (newer information)
            if (receipt.isRegenerated && !existing.isRegenerated) {
              receiptsByOrderId[orderId] = receipt;
              return;
            }
            
            // Prioritize receipts with more information
            const existingInfoScore = calculateInfoScore(existing);
            const newInfoScore = calculateInfoScore(receipt);
            
            if (newInfoScore > existingInfoScore) {
              receiptsByOrderId[orderId] = receipt;
            }
          });
          
          // Convert back to array and ensure all required fields
          const finalReceipts = Object.values(receiptsByOrderId).map(receipt => {
            let finalStoreName = receipt.storeName || receipt.sellerName;
            
            // If we still don't have a name and have a store ID, use that
            if (!finalStoreName && (receipt.storeId || receipt.sellerId)) {
              const id = receipt.storeId || receipt.sellerId;
              finalStoreName = `Store ID: ${id.substring(0, 8)}`;
            } else if (!finalStoreName) {
              // No information at all - use order ID if available
              finalStoreName = receipt.orderId ? 
                `Order ${receipt.orderId.substring(0, 8)}` : 
                'Unknown Store';
            }
            
            return {
              ...receipt,
              storeName: finalStoreName,
              orderId: receipt.orderId || receipt.id || 'Unknown',
              amount: receipt.amount || 0,
              currency: receipt.currency || 'GBP',
              items: Array.isArray(receipt.items) ? receipt.items : [],
              receiptType: receipt.receiptType || 'order_receipt'
            };
          });
          
          // Helper function to calculate information completeness score for a receipt
          function calculateInfoScore(receipt) {
            let score = 0;
            if (receipt.items && receipt.items.length) score += 3;
            if (receipt.amount && receipt.amount > 0) score += 2;
            if (receipt.storeName && receipt.storeName !== 'Store') score += 1;
            if (receipt.timestamp) score += 1;
            if (receipt.paymentMethod) score += 1;
            if (receipt.deliveryMethod) score += 1;
            if (receipt.receiptContent) score += 2;
            if (receipt.isRegenerated) score += 5; // Strongly prefer regenerated receipts
            return score;
          }
          
          console.log(`Final receipt count after deduplication: ${finalReceipts.length}`);
          setReceipts(finalReceipts);
          setLoading(false);
          
        } catch (error) {
          console.error("Error fetching receipts:", error);
          setLoading(false);
        }
        
      } else {
        // No user is signed in, redirect to login
        navigate('/login');
      }
    });
    
    return () => unsubscribe();
  }, [navigate]);
  
  // Filter receipts based on current filters
  const filteredReceipts = receipts.filter(receipt => {
    // Better receipt type detection with improved logic
    const actualReceiptType = determineReceiptType(receipt);
    
    // Filter by type
    if (filterType === 'orders' && actualReceiptType !== 'order_receipt') return false;
    if (filterType === 'refunds' && actualReceiptType !== 'refund_receipt') return false;
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        (receipt.storeName?.toLowerCase() || '').includes(searchLower) ||
        (receipt.orderId?.toLowerCase() || '').includes(searchLower) ||
        (receipt.refundReason && receipt.refundReason.toLowerCase().includes(searchLower)) ||
        (receipt.receiptContent && receipt.receiptContent.toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });
  
  // Helper function to better determine receipt type
  function determineReceiptType(receipt) {
    // If explicitly set, use that
    if (receipt.receiptType) return receipt.receiptType;
    
    // Check for explicit refund indicators
    const isRefund = 
      receipt.refundReason || 
      (typeof receipt.amount === 'number' && receipt.amount < 0) ||
      receipt.receiptContent?.includes('REFUND') ||
      receipt.message?.includes('REFUND') ||
      receipt.text?.includes('REFUND') ||
      receipt.message?.includes('refund') ||
      receipt.text?.includes('refund') ||
      receipt.source === 'refunds';
    
    if (isRefund) return 'refund_receipt';
    
    // Default to order receipt for anything else
    return 'order_receipt';
  }
  
  // Sort receipts
  const sortedReceipts = [...filteredReceipts].sort((a, b) => {
    const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
    const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
    
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });
  
  // Paginate receipts
  const paginatedReceipts = sortedReceipts.slice(
    (page - 1) * receiptsPerPage, 
    page * receiptsPerPage
  );
  
  // Total pages
  const totalPages = Math.ceil(filteredReceipts.length / receiptsPerPage);
  
  if (loading) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 'calc(100vh - 60px)', // Account for navbar height
          flexDirection: 'column',
          gap: '1rem',
          paddingTop: '60px' // Add padding equal to navbar height
        }}>
          <div style={{
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
          }}></div>
          <p>Loading your receipts...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '0 1rem',
        paddingTop: 'calc(60px + 1.5rem)' // Account for navbar height (60px) plus additional margin
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 'bold',
            margin: 0
          }}>
            My Receipts
          </h1>
          
          <button 
            onClick={() => {
              setLoading(true);
              setTimeout(async () => {
                try {
                  // Reload the page to ensure fresh data
                  window.location.reload();
                } catch (error) {
                  console.error("Error refreshing receipts:", error);
                  setLoading(false);
                }
              }, 100);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
            Refresh Receipts
          </button>
        </div>
        
        {/* Filters */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          alignItems: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem',
          borderRadius: '0.5rem'
        }}>
          {/* Type filter */}
          <div>
            <label style={{ fontSize: '0.875rem', color: '#4b5563', display: 'block', marginBottom: '0.25rem' }}>
              Receipt Type
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setFilterType('all')}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  backgroundColor: filterType === 'all' ? '#4f46e5' : '#e5e7eb',
                  color: filterType === 'all' ? 'white' : '#374151',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('orders')}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  backgroundColor: filterType === 'orders' ? '#4f46e5' : '#e5e7eb',
                  color: filterType === 'orders' ? 'white' : '#374151',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Orders
              </button>
              <button
                onClick={() => setFilterType('refunds')}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  backgroundColor: filterType === 'refunds' ? '#4f46e5' : '#e5e7eb',
                  color: filterType === 'refunds' ? 'white' : '#374151',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Refunds
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div style={{ flexGrow: 1 }}>
            <label style={{ fontSize: '0.875rem', color: '#4b5563', display: 'block', marginBottom: '0.25rem' }}>
              Search Receipts
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by store, order ID..."
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                width: '100%',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          {/* Sort order */}
          <div>
            <label style={{ fontSize: '0.875rem', color: '#4b5563', display: 'block', marginBottom: '0.25rem' }}>
              Sort By
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                backgroundColor: 'white'
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
        
        {/* Receipts List */}
        {paginatedReceipts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🧾</div>
            <h3 style={{ marginBottom: '0.5rem', fontWeight: '500' }}>No receipts found</h3>
            <p>
              {filterType !== 'all' 
                ? `No ${filterType} receipts match your search.` 
                : searchTerm 
                  ? "No receipts match your search." 
                  : "When you make purchases or receive refunds, your receipts will appear here."}
            </p>
          </div>
        ) : (
          <div>
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              {paginatedReceipts.map((receipt, index) => (
                <div 
                  key={receipt.id}
                  onClick={() => viewReceiptDetails(receipt)}
                  style={{
                    padding: '1rem',
                    borderBottom: index < paginatedReceipts.length - 1 ? '1px solid #e5e7eb' : 'none',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    transition: 'background-color 0.2s',
                    ':hover': {
                      backgroundColor: '#f9fafb'
                    },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ 
                        fontWeight: '600', 
                        marginBottom: '0.25rem',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem'
                      }}>
                        <span role="img" aria-label="store">🏪</span>
                        {receipt.storeName}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Order #{receipt.orderId ? receipt.orderId.slice(-8) : 'Unknown'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                        {getCurrencySymbol(receipt.currency || 'GBP')}{formatPrice(Math.abs(receipt.amount || 0), receipt.currency || 'GBP')}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {getShortDate(receipt.timestamp)}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: receipt.receiptType === 'refund_receipt' ? '#fee2e2' : '#ecfdf5',
                        color: receipt.receiptType === 'refund_receipt' ? '#991b1b' : '#065f46',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        borderRadius: '0.25rem'
                      }}>
                        {receipt.receiptType === 'refund_receipt' ? '💸 Refund' : '🧾 Order'}
                      </span>
                      
                      {receipt.isRegenerated && (
                        <span style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          borderRadius: '0.25rem'
                        }}>
                          ♻️ Regenerated
                        </span>
                      )}
                    </div>
                    
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 15l-6-6-6 6"/>
                      </svg>
                      View Details
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                marginTop: '1.5rem',
                gap: '0.5rem'
              }}>
                <button 
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: page === 1 ? '#e5e7eb' : '#4f46e5',
                    color: page === 1 ? '#9ca3af' : 'white',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: page === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  color: '#4b5563'
                }}>
                  Page {page} of {totalPages}
                </div>
                
                <button 
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: page === totalPages ? '#e5e7eb' : '#4f46e5',
                    color: page === totalPages ? '#9ca3af' : 'white',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Receipt Modal */}
      {showReceiptModal && selectedReceipt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          zIndex: 1000,
          padding: '1rem',
          paddingTop: 'calc(60px + 1rem)' // Add extra padding at the top to account for navbar height
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            width: '100%',
            maxWidth: '600px',
            maxHeight: 'calc(100vh - 80px)', // Adjust max height to account for navbar
            overflowY: 'auto',
            padding: '1.5rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '1.5rem',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '0.75rem'
            }}>
              <h2 style={{ 
                fontWeight: 'bold', 
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>
                  {selectedReceipt.receiptType === 'refund_receipt' ? '💸' : '🧾'}
                </span>
                {selectedReceipt.receiptType === 'refund_receipt' ? 'Refund Receipt' : 'Order Receipt'}
              </h2>
              <button 
                onClick={closeReceiptModal} 
                style={{ 
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '1.25rem',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            
            {/* Store & Order Info */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ width: '70%' }}>
                  {/* Store Header Section */}
                  <div style={{
                    backgroundColor: '#f3f4f6',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    {/* Store Icon and Heading */}
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem'
                    }}>
                      <span role="img" aria-label="store" style={{ fontSize: '1.5rem' }}>🏪</span>
                      <h3 style={{ 
                        margin: 0, 
                        padding: 0,
                        fontSize: '1.2rem',
                        fontWeight: '600',
                        color: '#111827'
                      }}>Store Information</h3>
                    </div>
                    
                    {/* Store Name - Always displayed prominently */}
                    <div style={{ 
                      fontSize: '1.3rem', 
                      fontWeight: '700',
                      color: '#111827',
                      marginBottom: '0.5rem',
                      borderBottom: '1px solid #e5e7eb',
                      paddingBottom: '0.5rem'
                    }}>
                      {/* Only display actual store name, no fallbacks */}
                      {selectedReceipt.storeName}
                    </div>
                    
                    {/* Store Contact Details - Always show section, with message if no details */}
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#4b5563'
                    }}>
                      {selectedReceipt.storeAddress ? (
                        <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span role="img" aria-label="address" style={{ fontSize: '1rem', minWidth: '1.2rem' }}>📍</span>
                          <span>{selectedReceipt.storeAddress}</span>
                        </div>
                      ) : (
                        <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af' }}>
                          <span role="img" aria-label="no address" style={{ fontSize: '1rem', minWidth: '1.2rem' }}>📍</span>
                          <span>Address not provided</span>
                        </div>
                      )}
                      
                      {selectedReceipt.storePhone ? (
                        <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span role="img" aria-label="phone" style={{ fontSize: '1rem', minWidth: '1.2rem' }}>
                            {selectedReceipt.phoneType === 'personal' ? '📱' : '📞'}
                          </span>
                          <span>
                            {selectedReceipt.storePhone} 
                            {selectedReceipt.phoneType && (
                              <span style={{ fontSize: '0.85rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                                ({selectedReceipt.phoneType === 'personal' ? 'Personal' : 'Work'})
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af' }}>
                          <span role="img" aria-label="no phone" style={{ fontSize: '1rem', minWidth: '1.2rem' }}>📞</span>
                          <span>No phone number available</span>
                        </div>
                      )}
                      
                      {selectedReceipt.storeEmail && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span role="img" aria-label="email" style={{ fontSize: '1rem', minWidth: '1.2rem' }}>✉️</span>
                          <span>{selectedReceipt.storeEmail}</span>
                        </div>
                      )}
                    </div>

                    {/* Business Information Section */}
                    {(selectedReceipt.storeBusinessId || selectedReceipt.storeRegistrationNumber || selectedReceipt.storeVatNumber) && (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        padding: '0.5rem',
                        borderTop: '1px solid #e5e7eb',
                        fontSize: '0.85rem',
                        color: '#4b5563'
                      }}>
                        {/* Business ID */}
                        {selectedReceipt.storeBusinessId && (
                          <div style={{ marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span role="img" aria-label="business" style={{ fontSize: '0.9rem', minWidth: '1.2rem' }}>🏢</span>
                            <span>Business ID: {selectedReceipt.storeBusinessId}</span>
                          </div>
                        )}
                        
                        {/* Registration Number */}
                        {selectedReceipt.storeRegistrationNumber && (
                          <div style={{ marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span role="img" aria-label="registration" style={{ fontSize: '0.9rem', minWidth: '1.2rem' }}>📝</span>
                            <span>Registration No: {selectedReceipt.storeRegistrationNumber}</span>
                          </div>
                        )}
                        
                        {/* VAT Number */}
                        {selectedReceipt.storeVatNumber && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span role="img" aria-label="vat" style={{ fontSize: '0.9rem', minWidth: '1.2rem' }}>🧾</span>
                            <span>VAT No: {selectedReceipt.storeVatNumber}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '1.125rem', textAlign: 'right' }}>
                    {getCurrencySymbol(selectedReceipt.currency)}{formatPrice(Math.abs(selectedReceipt.amount), selectedReceipt.currency)}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'right' }}>
                    {formatDate(selectedReceipt.timestamp)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Order #{selectedReceipt.orderId}
              </div>
              
              {selectedReceipt.isRegenerated && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '0.875rem',
                  borderRadius: '0.25rem'
                }}>
                  ♻️ This receipt was regenerated by the seller
                </div>
              )}
            </div>
            
            {/* Items */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '500', marginBottom: '0.75rem', fontSize: '1rem' }}>Items</h3>
              
              {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                <div style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '0.375rem',
                  overflow: 'hidden'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', color: '#4b5563', fontWeight: '500' }}>Item</th>
                        <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#4b5563', fontWeight: '500' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', color: '#4b5563', fontWeight: '500' }}>Price</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', color: '#4b5563', fontWeight: '500' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReceipt.items.map((item, index) => {
                        const itemName = item.itemName || item.name || 'Product';
                        const itemPrice = item.price || 0;
                        const quantity = item.quantity || 1;
                        const lineTotal = itemPrice * quantity;
                        
                        return (
                          <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{itemName}</td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>{quantity}</td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', textAlign: 'right' }}>
                              {getCurrencySymbol(selectedReceipt.currency)}{formatPrice(itemPrice, selectedReceipt.currency)}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', textAlign: 'right' }}>
                              {getCurrencySymbol(selectedReceipt.currency)}{formatPrice(lineTotal, selectedReceipt.currency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot style={{ backgroundColor: '#f9fafb' }}>
                      {/* Show subtotal if we have fee information */}
                      {(selectedReceipt.subtotal || selectedReceipt.serviceFee || selectedReceipt.deliveryFee) && (
                        <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td colSpan="3" style={{ padding: '0.5rem 0.75rem', fontWeight: '500', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>Subtotal</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '500', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>
                            {getCurrencySymbol(selectedReceipt.currency)}{formatPrice(selectedReceipt.subtotal || 0, selectedReceipt.currency)}
                          </td>
                        </tr>
                      )}
                      
                      {/* Delivery Fee */}
                      {selectedReceipt.deliveryFee > 0 && (
                        <tr>
                          <td colSpan="3" style={{ padding: '0.5rem 0.75rem', fontWeight: '500', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>Delivery Fee</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '500', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>
                            {getCurrencySymbol(selectedReceipt.currency)}{formatPrice(selectedReceipt.deliveryFee, selectedReceipt.currency)}
                          </td>
                        </tr>
                      )}
                      
                      {/* Service Fee */}
                      {selectedReceipt.serviceFee > 0 && (
                        <tr>
                          <td colSpan="3" style={{ padding: '0.5rem 0.75rem', fontWeight: '500', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>Service Fee</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '500', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>
                            {getCurrencySymbol(selectedReceipt.currency)}{formatPrice(selectedReceipt.serviceFee, selectedReceipt.currency)}
                          </td>
                        </tr>
                      )}
                      
                      {/* Platform Fee */}
                      {selectedReceipt.platformFee > 0 && (
                        <tr>
                          <td colSpan="3" style={{ padding: '0.5rem 0.75rem', fontWeight: '500', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>Platform Fee</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '500', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>
                            {getCurrencySymbol(selectedReceipt.currency)}{formatPrice(selectedReceipt.platformFee, selectedReceipt.currency)}
                          </td>
                        </tr>
                      )}
                      
                      {/* Total row */}
                      <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td colSpan="3" style={{ padding: '0.75rem', fontWeight: '600', textAlign: 'right', color: '#111827' }}>Total</td>
                        <td style={{ padding: '0.75rem', fontWeight: '700', textAlign: 'right', color: '#111827' }}>
                          {getCurrencySymbol(selectedReceipt.currency)}{formatPrice(Math.abs(selectedReceipt.amount), selectedReceipt.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No item details available</p>
              )}
            </div>
            
            {/* Business Information */}
            {(selectedReceipt.storeBusinessId || selectedReceipt.storeRegistrationNumber || selectedReceipt.storeVatNumber) && (
              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#f9fafb', 
                borderRadius: '0.375rem',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ fontWeight: '500', marginBottom: '0.75rem', fontSize: '1rem' }}>Business Information</h3>
                
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {selectedReceipt.storeBusinessId && (
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Business ID</div>
                      <div style={{ fontSize: '0.875rem' }}>{selectedReceipt.storeBusinessId}</div>
                    </div>
                  )}
                  
                  {selectedReceipt.storeRegistrationNumber && (
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Registration Number</div>
                      <div style={{ fontSize: '0.875rem' }}>{selectedReceipt.storeRegistrationNumber}</div>
                    </div>
                  )}
                  
                  {selectedReceipt.storeVatNumber && (
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>VAT Number</div>
                      <div style={{ fontSize: '0.875rem' }}>{selectedReceipt.storeVatNumber}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Payment Information */}
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#f9fafb', 
              borderRadius: '0.375rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontWeight: '500', marginBottom: '0.75rem', fontSize: '1rem' }}>Payment Information</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Payment Method</div>
                  <div style={{ fontSize: '0.875rem' }}>
                    {selectedReceipt.paymentMethod?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Card'}
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Delivery Method</div>
                  <div style={{ fontSize: '0.875rem' }}>
                    {selectedReceipt.deliveryType || selectedReceipt.deliveryMethod?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Not specified'}
                  </div>
                </div>
                
                {selectedReceipt.receiptType === 'refund_receipt' && selectedReceipt.refundReason && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Refund Reason</div>
                    <div style={{ fontSize: '0.875rem' }}>
                      {selectedReceipt.refundReason}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Full Receipt Content */}
            {selectedReceipt.receiptContent && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: '500', marginBottom: '0.75rem', fontSize: '1rem' }}>Full Receipt</h3>
                
                <div style={{
                  fontFamily: 'monospace',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  padding: '1rem',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {selectedReceipt.receiptContent}
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={closeReceiptModal}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReceiptsPage;