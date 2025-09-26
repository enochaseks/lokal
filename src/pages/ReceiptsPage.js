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
  const viewReceiptDetails = (receipt) => {
    setSelectedReceipt(receipt);
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
          
          // 1. First, get messages that are receipts (both orders and refunds)
          const messagesQuery = query(
            collection(db, 'messages'),
            where('receiverId', '==', user.uid),
            where('isReceipt', '==', true),
            orderBy('timestamp', 'desc')
          );
          
          // 2. Also check for messages with receiptType field
          const receiptTypesQuery = query(
            collection(db, 'messages'),
            where('receiverId', '==', user.uid),
            where('receiptType', 'in', ['order_receipt', 'refund_receipt']),
            orderBy('timestamp', 'desc')
          );
          
          // 3. Also check for messages with type='receipt'
          const typeReceiptQuery = query(
            collection(db, 'messages'),
            where('receiverId', '==', user.uid),
            where('type', '==', 'receipt'),
            orderBy('timestamp', 'desc')
          );
          
          // 4. Check for actual orders in the orders collection
          const ordersQuery = query(
            collection(db, 'orders'),
            where('buyerId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          
          // 5. Check for transactions in the transactions collection
          const transactionsQuery = query(
            collection(db, 'transactions'),
            where('buyerId', '==', user.uid),
            orderBy('timestamp', 'desc')
          );
          
          // Execute all queries
          const [messagesSnapshot, receiptTypesSnapshot, typeReceiptSnapshot, ordersSnapshot, transactionsSnapshot] = await Promise.all([
            getDocs(messagesQuery),
            getDocs(receiptTypesQuery),
            getDocs(typeReceiptQuery),
            getDocs(ordersQuery),
            getDocs(transactionsQuery)
          ]);
          
          console.log(`Found receipts - Messages: ${messagesSnapshot.size}, ReceiptTypes: ${receiptTypesSnapshot.size}, TypeReceipt: ${typeReceiptSnapshot.size}, Orders: ${ordersSnapshot.size}, Transactions: ${transactionsSnapshot.size}`);
          
          // Process all receipts
          const allReceipts = [];
          
          // Process isReceipt=true messages
          messagesSnapshot.forEach(doc => {
            const data = doc.data();
            allReceipts.push({
              id: doc.id,
              ...data,
              source: 'messages',
              receiptType: data.receiptType || (data.message?.includes('REFUND RECEIPT') ? 'refund_receipt' : 'order_receipt')
            });
          });
          
          // Process receiptType field messages
          receiptTypesSnapshot.forEach(doc => {
            // Avoid duplicates
            if (!allReceipts.some(r => r.id === doc.id)) {
              const data = doc.data();
              allReceipts.push({
                id: doc.id,
                ...data,
                source: 'messages',
                receiptType: data.receiptType
              });
            }
          });
          
          // Process type=receipt messages
          typeReceiptSnapshot.forEach(doc => {
            // Avoid duplicates
            if (!allReceipts.some(r => r.id === doc.id)) {
              const data = doc.data();
              allReceipts.push({
                id: doc.id,
                ...data,
                source: 'messages',
                receiptType: data.receiptType || (data.message?.includes('REFUND RECEIPT') ? 'refund_receipt' : 'order_receipt')
              });
            }
          });
          
          // Process orders from orders collection
          ordersSnapshot.forEach(doc => {
            const data = doc.data();
            // Don't add duplicates - check by orderId since that should be unique
            if (!allReceipts.some(r => r.orderId === doc.id)) {
              const orderData = {
                id: `order_${doc.id}`,
                orderId: doc.id,
                buyerId: data.buyerId,
                sellerId: data.sellerId,
                storeName: data.storeName || 'Store',
                items: data.items || [],
                totalAmount: data.totalAmount || data.amount || 0,
                currency: data.currency || 'GBP',
                timestamp: data.createdAt || data.timestamp || new Date(),
                paymentMethod: data.paymentMethod || 'Card',
                deliveryMethod: data.deliveryMethod || 'Not specified',
                source: 'orders',
                receiptType: 'order_receipt'
              };
              
              allReceipts.push(orderData);
              console.log(`Added order from orders collection: ${doc.id}`);
            }
          });
          
          // Process transactions
          transactionsSnapshot.forEach(doc => {
            const data = doc.data();
            // Check if this transaction is already represented
            const transactionId = data.orderId || doc.id;
            if (!allReceipts.some(r => r.orderId === transactionId)) {
              const isRefund = data.type === 'refund' || data.transactionType === 'refund' || 
                              (typeof data.amount === 'number' && data.amount < 0);
              
              const transactionData = {
                id: `transaction_${doc.id}`,
                orderId: transactionId,
                buyerId: data.buyerId,
                sellerId: data.sellerId,
                storeName: data.storeName || data.sellerName || 'Store',
                items: data.items || [],
                totalAmount: Math.abs(data.amount || 0),
                currency: data.currency || 'GBP',
                timestamp: data.timestamp || data.createdAt || new Date(),
                paymentMethod: data.paymentMethod || 'Card',
                deliveryMethod: data.deliveryMethod || 'Not specified',
                refundReason: data.reason || data.refundReason || '',
                source: 'transactions',
                receiptType: isRefund ? 'refund_receipt' : 'order_receipt'
              };
              
              allReceipts.push(transactionData);
              console.log(`Added ${isRefund ? 'refund' : 'order'} from transactions collection: ${doc.id}`);
            }
          });
          
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
            // Get store information
            const storeName = receipt.storeName || receipt.orderData?.storeName || receipt.sellerName || 'Store';
            
            // Get order ID
            const orderId = receipt.orderId || receipt.orderData?.orderId || '';
            
            // Get amount
            let amount = 0;
            let currency = 'GBP';
            
            if (receipt.amount !== undefined && receipt.amount !== null) {
              amount = typeof receipt.amount === 'number' ? Math.abs(receipt.amount) : 0;
              currency = receipt.currency || 'GBP';
            } else if (receipt.orderData?.totalAmount) {
              amount = receipt.orderData.totalAmount;
              currency = receipt.orderData.currency || 'GBP';
            } else if (receipt.totalAmount !== undefined && receipt.totalAmount !== null) {
              amount = typeof receipt.totalAmount === 'number' ? Math.abs(receipt.totalAmount) : 0;
              currency = receipt.currency || 'GBP';
            }
            
            // Get date
            const timestamp = receipt.timestamp || receipt.createdAt || new Date();
            
            // Get items
            const items = receipt.items || receipt.orderData?.items || [];
            
            // Get payment method
            const paymentMethod = receipt.paymentMethod || receipt.orderData?.paymentMethod || 'Card';
            
            // Get delivery method
            const deliveryMethod = receipt.deliveryMethod || receipt.orderData?.deliveryMethod || 'Not specified';
            
            // Get refund reason for refunds
            const refundReason = receipt.refundReason || receipt.orderData?.refundReason || '';
            
            // Get receipt message content
            let receiptContent = '';
            if (receipt.message) {
              receiptContent = receipt.message;
            } else if (receipt.text && receipt.text.length > 20) {
              receiptContent = receipt.text;
            }
            
            // Return processed receipt
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
              receiptType: receipt.receiptType,
              receiptContent,
              isRegenerated: receipt.message?.includes('Re-generated') || false,
              rawData: receipt
            };
          });
          
          // Final cleanup - ensure no duplicates and all required fields are present
          const finalReceipts = processedReceipts.filter((receipt, index, self) => {
            // Filter out any undefined or null receipts
            if (!receipt) return false;
            
            // Keep only the first occurrence of receipts with the same orderId
            return receipt.orderId ? 
              index === self.findIndex(r => r.orderId === receipt.orderId) : 
              true;
          }).map(receipt => {
            // Ensure all required fields have at least default values
            return {
              ...receipt,
              storeName: receipt.storeName || 'Store',
              orderId: receipt.orderId || receipt.id || 'Unknown',
              amount: receipt.amount || 0,
              currency: receipt.currency || 'GBP',
              items: Array.isArray(receipt.items) ? receipt.items : [],
              receiptType: receipt.receiptType || 'order_receipt'
            };
          });
          
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
    // Determine receipt type if not explicitly set
    const actualReceiptType = receipt.receiptType || 
                              (receipt.source === 'orders' ? 'order_receipt' : 
                               (receipt.refundReason || (typeof receipt.amount === 'number' && receipt.amount < 0)) ? 
                               'refund_receipt' : 'order_receipt');
    
    // Filter by type
    if (filterType === 'orders' && actualReceiptType !== 'order_receipt') return false;
    if (filterType === 'refunds' && actualReceiptType !== 'refund_receipt') return false;
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        (receipt.storeName?.toLowerCase() || '').includes(searchLower) ||
        (receipt.orderId?.toLowerCase() || '').includes(searchLower) ||
        (receipt.refundReason && receipt.refundReason.toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });
  
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
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 'bold',
          marginBottom: '1.5rem'
        }}>
          My Receipts
        </h1>
        
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
                      <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                        {receipt.storeName || 'Store'}
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
                <div style={{ fontWeight: '500', fontSize: '1.125rem' }}>
                  {selectedReceipt.storeName}
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
                      <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td colSpan="3" style={{ padding: '0.75rem', fontWeight: '500', textAlign: 'right' }}>Total</td>
                        <td style={{ padding: '0.75rem', fontWeight: '600', textAlign: 'right' }}>
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
            
            {/* Additional Information */}
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
                    {selectedReceipt.deliveryMethod?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Not specified'}
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