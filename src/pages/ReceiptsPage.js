import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import EmailReceiptModal from '../components/EmailReceiptModal';
import NotificationToast from '../components/NotificationToast';
import MessageModal from '../components/MessageModal';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { sendManualReceipt, sendCustomReceipt } from '../utils/stripeReceipts';

function ReceiptsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  // Email receipt modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [receiptForEmail, setReceiptForEmail] = useState(null);
  
  // Notification states
  const [notification, setNotification] = useState(null);
  const [messageModal, setMessageModal] = useState(null);
  
  // Function to refresh receipts and scout for new information
  const refreshReceipts = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.log('No user logged in for refresh');
      return;
    }

    setLoading(true);
    
    try {
      console.log("Refreshing receipts and scouting for new information...");
      
      // Create queries for different receipt sources
      const receiptsQuery = query(
        collection(db, 'receipts'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
      
      const buyerReceiptsQuery = query(
        collection(db, 'receipts'),
        where('buyerId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
      
      const refundReceiptsQuery = query(
        collection(db, 'receipts'),
        where('refundUserId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
      
      const regeneratedReceiptsQuery = query(
        collection(db, 'receipts'),
        where('buyerId', '==', user.uid),
        where('isRegenerated', '==', true),
        orderBy('timestamp', 'desc')
      );
      
      // Execute all queries
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
      
      console.log(`Refresh found - Primary: ${receiptsSnapshot.size}, ` +
                  `Buyer: ${buyerReceiptsSnapshot.size}, ` +
                  `Refund: ${refundReceiptsSnapshot.size}, ` + 
                  `Regenerated: ${regeneratedReceiptsSnapshot.size}`);
      
      // Process all receipts
      const allReceipts = [];
      
      const processReceipt = (doc) => {
        if (allReceipts.some(r => r.id === doc.id)) return;
        
        const data = doc.data();
        
        if (data.userId !== user.uid && data.buyerId !== user.uid && data.refundUserId !== user.uid) return;
        
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
          subtotal: data.subtotal || (data.breakdown?.subtotal) || null,
          serviceFee: data.serviceFee || (data.breakdown?.serviceFee) || 0,
          deliveryFee: data.deliveryFee || (data.breakdown?.deliveryFee) || 0,
          platformFee: data.platformFee || (data.breakdown?.platformFee) || 0,
          receiptType: data.receiptType || (data.isRefund ? 'refund_receipt' : 'order_receipt')
        };
        
        allReceipts.push(receiptData);
      };
      
      // Process receipts from each query
      receiptsSnapshot.forEach(doc => processReceipt(doc));
      buyerReceiptsSnapshot.forEach(doc => processReceipt(doc));
      refundReceiptsSnapshot.forEach(doc => processReceipt(doc));
      regeneratedReceiptsSnapshot.forEach(doc => processReceipt(doc));
      
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
        let storeName = receipt.storeName || 
                       receipt.businessName || 
                       receipt.sellerName;
                       
        if (!storeName && receipt.storeData) {
          storeName = receipt.storeData.storeName || 
                     receipt.storeData.businessName || 
                     receipt.storeData.name || 
                     receipt.storeData.displayName;
        }
        
        if (!storeName && (receipt.storeId || receipt.sellerId)) {
          const storeId = receipt.storeId || receipt.sellerId;
          storeName = `Store ${storeId.substring(0, 6)}`;
        } else if (!storeName) {
          storeName = 'Unknown Store';
        }
        
        const orderId = receipt.orderId || receipt.orderID || receipt.id || '';
        let amount = 0;
        if (receipt.amount !== undefined && receipt.amount !== null) {
          amount = typeof receipt.amount === 'number' ? Math.abs(receipt.amount) : 0;
        } else if (receipt.totalAmount !== undefined && receipt.totalAmount !== null) {
          amount = typeof receipt.totalAmount === 'number' ? Math.abs(receipt.totalAmount) : 0;
        }
        
        const currency = receipt.currency || 'GBP';
        const timestamp = receipt.timestamp || receipt.createdAt || new Date();
        const items = receipt.items || [];
        const paymentMethod = receipt.paymentMethod || 'Card';
        const deliveryMethod = receipt.deliveryMethod || 'Not specified';
        const refundReason = receipt.refundReason || receipt.reason || '';
        const receiptContent = receipt.receiptContent || receipt.content || receipt.message || '';
        const isRegenerated = receipt.isRegenerated || false;
        
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
      
      // Better deduplication
      const receiptsByOrderId = {};
      
      processedReceipts.forEach(receipt => {
        if (!receipt) return;
        
        const orderId = receipt.orderId || receipt.id || 'Unknown';
        
        if (!receiptsByOrderId[orderId]) {
          receiptsByOrderId[orderId] = receipt;
          return;
        }
        
        const existing = receiptsByOrderId[orderId];
        
        // Always prioritize regenerated receipts
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
      
      function calculateInfoScore(receipt) {
        let score = 0;
        if (receipt.items && receipt.items.length) score += 3;
        if (receipt.amount && receipt.amount > 0) score += 2;
        if (receipt.storeName && receipt.storeName !== 'Store') score += 1;
        if (receipt.timestamp) score += 1;
        if (receipt.paymentMethod) score += 1;
        if (receipt.deliveryMethod) score += 1;
        if (receipt.receiptContent) score += 2;
        if (receipt.isRegenerated) score += 5;
        return score;
      }
      
      // Convert back to array
      const finalReceipts = Object.values(receiptsByOrderId).map(receipt => {
        let finalStoreName = receipt.storeName || receipt.sellerName;
        
        if (!finalStoreName && (receipt.storeId || receipt.sellerId)) {
          const id = receipt.storeId || receipt.sellerId;
          finalStoreName = `Store ID: ${id.substring(0, 8)}`;
        } else if (!finalStoreName) {
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
      
      console.log(`Refresh complete: Found ${finalReceipts.length} receipts after deduplication`);
      setReceipts(finalReceipts);
      
    } catch (error) {
      console.error("Error refreshing receipts:", error);
    } finally {
      setLoading(false);
    }
  };
  
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

  // Download receipt as PDF function
  const downloadReceipt = (receipt) => {
    if (!receipt) return;

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    // Create receipt date
    const receiptDate = receipt.timestamp 
      ? (receipt.timestamp.toDate ? receipt.timestamp.toDate() : new Date(receipt.timestamp))
      : new Date();
    
    const formattedDate = receiptDate.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Get store address and phone info
    let storeAddress = 'Not available';
    let storePhone = 'Not available';
    
    if (receipt.storeData) {
      storeAddress = receipt.storeData.storeLocation || 
                     receipt.storeData.storeAddress || 
                     receipt.storeData.address || 
                     'Not available';
      
      storePhone = receipt.storeData.phoneNumber || 
                   receipt.storeData.phone || 
                   'Not available';
    }

    // Generate filename
    const receiptType = receipt.receiptType === 'refund_receipt' ? 'Refund' : 'Receipt';
    const storeName = (receipt.storeName || 'Store').replace(/[^a-zA-Z0-9]/g, '_');
    const orderId = (receipt.orderId || receipt.id || 'Unknown').substring(0, 8);
    const dateStr = receiptDate.toISOString().split('T')[0];
    const filename = `${receiptType}_${storeName}_${orderId}_${dateStr}`;

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
          .full-receipt {
            background: #f8f9fa;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            border: 1px solid #ddd;
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
              ${receipt.receiptType === 'refund_receipt' ? '💸 REFUND RECEIPT' : '🛒 ORDER RECEIPT'}
            </div>
          </div>

          <div class="section">
            <h2>🏪 Store Information</h2>
            <div class="info-row">
              <span class="info-label">Store Name:</span>
              <span class="info-value">${receipt.storeName || 'Unknown Store'}</span>
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
              <span class="info-value">${receipt.orderId || receipt.id}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date & Time:</span>
              <span class="info-value">${formattedDate}</span>
            </div>
            ${receipt.paymentMethod ? `
            <div class="info-row">
              <span class="info-label">Payment Method:</span>
              <span class="info-value">${receipt.paymentMethod}</span>
            </div>
            ` : ''}
            ${receipt.deliveryType ? `
            <div class="info-row">
              <span class="info-label">Delivery Type:</span>
              <span class="info-value">${receipt.deliveryType}</span>
            </div>
            ` : ''}
          </div>

          <div class="section">
            <h2>�️ Items Purchased</h2>
            ${(() => {
              const items = receipt.items || [];
              return items.length > 0 
                ? items.map(item => `
                    <div class="info-row">
                      <span class="info-label">${item.name || item.productName || 'Item'} ${item.quantity ? `(${item.quantity})` : ''}</span>
                      <span class="info-value">${receipt.currency || 'GBP'} ${Number(item.price || item.amount || 0).toFixed(2)}</span>
                    </div>
                  `).join('')
                : '<div class="info-row"><span class="info-label">No items available</span><span class="info-value">-</span></div>';
            })()}
          </div>

          <div class="section">
            <h2>�💰 Payment Summary</h2>
            ${receipt.subtotal ? `
            <div class="info-row">
              <span class="info-label">Subtotal:</span>
              <span class="info-value">£${Number(receipt.subtotal).toFixed(2)}</span>
            </div>
            ` : ''}
            ${receipt.serviceFee ? `
            <div class="info-row">
              <span class="info-label">Service Fee:</span>
              <span class="info-value">£${Number(receipt.serviceFee).toFixed(2)}</span>
            </div>
            ` : ''}
            ${receipt.deliveryFee ? `
            <div class="info-row">
              <span class="info-label">Delivery Fee:</span>
              <span class="info-value">£${Number(receipt.deliveryFee).toFixed(2)}</span>
            </div>
            ` : ''}
            ${receipt.platformFee ? `
            <div class="info-row">
              <span class="info-label">Platform Fee:</span>
              <span class="info-value">£${Number(receipt.platformFee).toFixed(2)}</span>
            </div>
            ` : ''}
            
            <div class="total-row">
              <div class="info-row" style="border: none; margin: 0;">
                <span class="info-label" style="font-size: 18px;">Total Amount:</span>
                <span class="total-amount">£${Number(receipt.amount || 0).toFixed(2)}</span>
              </div>
              <div style="text-align: right; margin-top: 5px; color: #666; font-size: 14px;">
                Currency: ${receipt.currency || 'GBP'}
              </div>
            </div>
          </div>

          ${receipt.receiptType === 'refund_receipt' && receipt.refundReason ? `
          <div class="section">
            <h2>💸 Refund Details</h2>
            <div class="info-row">
              <span class="info-label">Refund Reason:</span>
              <span class="info-value">${receipt.refundReason}</span>
            </div>
          </div>
          ` : ''}

          ${receipt.receiptContent ? `
          <div class="section">
            <h2>📄 Full Receipt</h2>
            <div class="full-receipt">${receipt.receiptContent}</div>
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
    
    // Enhanced HTML content with mobile-specific instructions
    const mobileInstructions = isMobile ? `
      <div id="mobile-instructions" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        padding: 1rem;
        text-align: center;
        font-family: Arial, sans-serif;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      ">
        <div style="font-weight: bold; margin-bottom: 0.5rem;">📱 Save to ${isIOS ? 'Files (iOS)' : isAndroid ? 'Downloads (Android)' : 'Device'}</div>
        <div style="font-size: 0.85rem; margin-bottom: 1rem; line-height: 1.4;">
          ${isIOS ? 
            '1️⃣ Tap the Share button (⬆️) at the bottom<br/>2️⃣ Select "Save to Files"<br/>3️⃣ Choose your preferred location' : 
            isAndroid ? 
            '1️⃣ Tap Menu (⋮) in the top right<br/>2️⃣ Select "Print"<br/>3️⃣ Choose "Save as PDF"<br/>4️⃣ Select Download location' :
            'Use your browser\'s menu to print or save as PDF'
          }
        </div>
        <button onclick="document.getElementById('mobile-instructions').style.display='none'" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
        ">Got it!</button>
        <button onclick="window.close()" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          margin-left: 0.5rem;
        ">Close</button>
      </div>
      <div style="height: 120px;"></div>
    ` : '';

    const enhancedHtmlContent = htmlContent.replace(
      '<body>',
      `<body>${mobileInstructions}`
    );

    printWindow.document.write(enhancedHtmlContent);
    printWindow.document.close();
    
    // Wait for content to load then handle printing
    printWindow.onload = function() {
      // Set the document title for the PDF filename
      printWindow.document.title = filename;
      
      // Use setTimeout to ensure everything is rendered
      setTimeout(() => {
        if (isMobile) {
          // For mobile, don't auto-trigger print, let user follow instructions
          console.log('Mobile device detected - user will manually save PDF');
          
          // Try to use native share API if available
          if (navigator.share && isIOS) {
            // Note: Web Share API can't share HTML directly, but this sets up future enhancement
            console.log('Native share API available');
          }
        } else {
          // For desktop, trigger print dialog
          printWindow.print();
        }
      }, 500);
    };
  };

  // Send receipt via email
  const sendReceiptViaEmail = (receipt) => {
    if (!receipt) return;

    // Get current user's email
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user || !user.email) {
      setMessageModal({
        type: 'warning',
        title: 'Authentication Required',
        message: 'Please make sure you are logged in with an email address to send receipts.',
        primaryButtonText: 'OK'
      });
      return;
    }

    // Check if receipt has payment intent ID for Stripe receipts
    const paymentIntentId = receipt.paymentIntentId || receipt.paymentId || receipt.chargeId;
    
    if (!paymentIntentId) {
      // Show message for non-Stripe receipts with items
      const items = receipt.items || [];
      const itemsDetails = items.length > 0 
        ? items.map(item => `• ${item.name || item.productName || 'Item'} ${item.quantity ? `(${item.quantity})` : ''} - ${receipt.currency || 'GBP'} ${item.price || item.amount || 0}`)
        : ['• No items available'];

      setMessageModal({
        type: 'info',
        title: 'Non-Stripe Receipt',
        message: 'This receipt is from a non-Stripe payment and cannot be emailed automatically.',
        details: [
          `Order ID: ${receipt.orderId || receipt.orderID || receipt.id || 'Unknown'}`,
          `Amount: ${receipt.currency || 'GBP'} ${receipt.amount || receipt.totalAmount || 0}`,
          `Store: ${receipt.storeName || receipt.businessName || 'Store'}`,
          '',
          'Items Purchased:',
          ...itemsDetails
        ],
        primaryButtonText: 'Download PDF Instead',
        secondaryButtonText: 'OK',
        onPrimaryAction: () => {
          setMessageModal(null);
          downloadReceipt(receipt);
          
          // Show success notification for mobile users
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            setTimeout(() => {
              setNotification({
                type: 'success',
                title: 'PDF Ready!',
                message: 'Follow the instructions in the new tab to save your receipt'
              });
            }, 1000);
          }
        },
        onSecondaryAction: () => {
          setMessageModal(null);
        }
      });
      return;
    }

    // Show email modal for Stripe receipts
    setReceiptForEmail(receipt);
    setShowEmailModal(true);
  };

  // Handle email send from modal
  const handleEmailSend = async (email) => {
    if (!receiptForEmail) return;

    try {
      setEmailLoading(true);
      
      const receiptData = {
        paymentIntentId: receiptForEmail.paymentIntentId || receiptForEmail.paymentId || receiptForEmail.chargeId,
        orderId: receiptForEmail.orderId || receiptForEmail.orderID || receiptForEmail.id || 'Unknown',
        amount: receiptForEmail.amount || receiptForEmail.totalAmount || 0,
        currency: receiptForEmail.currency || 'GBP',
        customerEmail: email,
        customerName: receiptForEmail.customerName || 'Customer',
        storeName: receiptForEmail.storeName || receiptForEmail.businessName || 'Store',
        items: receiptForEmail.items || [],
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
        setShowEmailModal(false);
        setNotification({
          type: 'success',
          title: 'Receipt Sent!',
          message: `Professional receipt has been sent successfully to ${email}`
        });
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
            console.log('✅ FOUND STORE DATA IN STORES COLLECTION');
            console.log('Store data from Firestore:', storeData);
            console.log('Available store fields:', Object.keys(storeData));
            
            // Get store name from store data - force finding the actual store name
            const storeName = storeData.storeName || 
                             storeData.businessName || 
                             storeData.name;
            
            if (!storeName) {
              console.warn(`No store name found in store document for ID: ${storeId}`);
            } else {
              console.log(`✅ Store name found: "${storeName}"`);
            }
            
            // TEMP DEBUG: Log all fields and values to see what's actually in the store document
            console.log('=== DEBUGGING STORE DOCUMENT ===');
            console.log('Full storeData object:', storeData);
            console.log('All field names:', Object.keys(storeData));
            console.log('Store name fields:', {
              storeName: storeData.storeName,
              businessName: storeData.businessName,
              name: storeData.name
            });
            console.log('Address fields:', {
              storeLocation: storeData.storeLocation,
              address: storeData.address,
              businessAddress: storeData.businessAddress,
              location: storeData.location
            });
            console.log('Phone fields:', {
              phoneNumber: storeData.phoneNumber,
              phone: storeData.phone,
              contactNumber: storeData.contactNumber,
              mobile: storeData.mobile
            });
            console.log('=== END DEBUG ===');
            
            // Update receipt with store information using EXACT field names from Firestore
            receiptWithStoreInfo = {
              ...receiptWithStoreInfo,
              // Only use actual store data - NEVER fallback to 'Store'
              storeName: storeName || 'Store ID: ' + storeId.substring(0, 8),
              // Use storeLocation first since that's where the address actually is
              storeAddress: storeData.storeLocation || storeData.storeAddress || '',
              // Use exact Firestore field name - phoneNumber (though it may be empty)
              storePhone: storeData.phoneNumber || '',
              phoneType: storeData.phoneType || 'work',
              storeEmail: storeData.email || storeData.contactEmail || storeData.businessEmail || '',
              // Include store owner info for better connectivity
              storeOwnerId: storeData.ownerId || storeId,
              storeData: storeData
            };
            
            // Debug logging to see what address and phone values were found
            console.log('Address field check results:', {
              storeLocation: storeData.storeLocation,
              address: storeData.address,
              businessAddress: storeData.businessAddress,
              storeAddress: storeData.storeAddress,
              shopAddress: storeData.shopAddress,
              finalAddress: receiptWithStoreInfo.storeAddress
            });
            
            console.log('Phone field check results:', {
              phoneNumber: storeData.phoneNumber,
              phone: storeData.phone,
              contactNumber: storeData.contactNumber,
              businessPhone: storeData.businessPhone,
              storePhone: storeData.storePhone,
              finalPhone: receiptWithStoreInfo.storePhone
            });
          } else {
            // If no store document, try to get user profile
            // The storeId might be the user ID of the store owner
            console.log('❌ NO STORE DOCUMENT FOUND, trying users collection');
            const userDoc = await getDoc(doc(db, 'users', storeId));
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              console.log('✅ FOUND USER DATA IN USERS COLLECTION');
              console.log('Store owner data from Firestore:', userData);
              console.log('User data fields:', Object.keys(userData));
              
              const userStoreName = userData.storeName || 
                                   userData.businessName || 
                                   userData.displayName;
              
              if (userStoreName) {
                console.log(`✅ Store name from user data: "${userStoreName}"`);
              } else {
                console.log('❌ No store name found in user data');
              }
              
              console.log('User address fields:', {
                storeLocation: userData.storeLocation,
                address: userData.address,
                businessAddress: userData.businessAddress,
                location: userData.location
              });
              console.log('User phone fields:', {
                phoneNumber: userData.phoneNumber,
                phone: userData.phone,
                contactNumber: userData.contactNumber,
                mobile: userData.mobile
              });
              
              // Update receipt with user information - no fallbacks to 'Store'
              receiptWithStoreInfo = {
                ...receiptWithStoreInfo,
                // Only use actual store name data from user profile
                storeName: userData.storeName || 
                           userData.businessName || 
                           userData.displayName || 
                           'Seller ID: ' + storeId.substring(0, 8),
                storeAddress: userData.storeLocation || userData.storeAddress || '',
                storePhone: userData.phoneNumber || '',
                phoneType: userData.phoneType || 'work',
                storeEmail: userData.email || userData.contactEmail || userData.businessEmail || '',
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
            console.log('✅ FOUND STORE BY USER OWNERSHIP:', storeData);
            console.log('Store owned by user fields:', Object.keys(storeData));
            
            const ownedStoreName = storeData.storeName || storeData.businessName || storeData.name;
            if (ownedStoreName) {
              console.log(`✅ Store name from owned store: "${ownedStoreName}"`);
            }
            
            console.log('Owned store address fields:', {
              storeLocation: storeData.storeLocation,
              address: storeData.address,
              businessAddress: storeData.businessAddress,
              location: storeData.location
            });
            console.log('Owned store phone fields:', {
              phoneNumber: storeData.phoneNumber,
              phone: storeData.phone,
              contactNumber: storeData.contactNumber,
              mobile: storeData.mobile
            });
            
            // Use the store information to enhance the receipt - no fallbacks
            receiptWithStoreInfo = {
              ...receiptWithStoreInfo,
              storeId: userStoresSnapshot.docs[0].id,
              storeName: storeData.storeName || storeData.businessName || storeData.name || 'Store ID: ' + userStoresSnapshot.docs[0].id.substring(0, 8),
              storeAddress: storeData.storeLocation || storeData.storeAddress || '',
              storePhone: storeData.phoneNumber || '',
              phoneType: storeData.phoneType || 'work',
              storeEmail: storeData.email || storeData.contactEmail || storeData.businessEmail || '',
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
                  storeAddress: userData.storeLocation || userData.storeAddress || '',
                  storePhone: userData.phoneNumber || '',
                  phoneType: userData.phoneType || 'personal',
                  storeEmail: userData.email || userData.contactEmail || userData.businessEmail || ''
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
    
    // DEBUG: Log the actual store data from Firestore to see what fields are available
    if (receiptWithStoreInfo.storeData) {
      console.log("=== ACTUAL STORE DATA FROM FIRESTORE ===");
      console.log("Full store document:", receiptWithStoreInfo.storeData);
      console.log("Available fields:", Object.keys(receiptWithStoreInfo.storeData));
      console.log("=== ADDRESS FIELD VALUES ===");
      Object.keys(receiptWithStoreInfo.storeData).forEach(key => {
        if (key.toLowerCase().includes('address') || key.toLowerCase().includes('location')) {
          console.log(`${key}:`, receiptWithStoreInfo.storeData[key]);
        }
      });
      console.log("=== PHONE FIELD VALUES ===");
      Object.keys(receiptWithStoreInfo.storeData).forEach(key => {
        if (key.toLowerCase().includes('phone') || key.toLowerCase().includes('mobile') || key.toLowerCase().includes('tel')) {
          console.log(`${key}:`, receiptWithStoreInfo.storeData[key]);
        }
      });
      console.log("=== END DEBUG ===");
    }
    
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
        {/* Back Button */}
        <button
          onClick={() => window.history.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '0.5rem',
            color: '#495057',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#e9ecef';
            e.target.style.transform = 'translateX(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#f8f9fa';
            e.target.style.transform = 'translateX(0)';
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>⬅️</span>
          Back
        </button>

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
            onClick={refreshReceipts}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: loading ? '#9ca3af' : '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: loading ? 0.7 : 1
            }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              fill="currentColor" 
              viewBox="0 0 16 16"
              style={{
                animation: loading ? 'spin 1s linear infinite' : 'none'
              }}
            >
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
            {loading ? 'Refreshing...' : 'Refresh Receipts'}
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
                      marginBottom: '0.75rem',
                      borderBottom: '1px solid #e5e7eb',
                      paddingBottom: '0.5rem'
                    }}>
                      {/* Only display actual store name, no fallbacks */}
                      {selectedReceipt.storeName}
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
              
              {/* Store Contact Details - Display after store information */}
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
                fontSize: '0.9rem',
                color: '#4b5563'
              }}>
                {/* Address - Primary field is storeLocation, fallback to storeAddress */}
                {(() => {
                  const storeData = selectedReceipt.storeData;
                  let address = '';
                  
                  // Check direct receipt fields first
                  if (selectedReceipt.storeAddress) {
                    address = selectedReceipt.storeAddress;
                  }
                  
                  // If no address in receipt, check storeData (which comes from actual store document)
                  if (!address && storeData) {
                    address = storeData.storeLocation || storeData.storeAddress || '';
                  }
                  
                  return address ? (
                    <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span role="img" aria-label="address" style={{ fontSize: '1rem', minWidth: '1.2rem' }}>📍</span>
                      <span>{address}</span>
                    </div>
                  ) : null;
                })()}
                
                {/* Phone - Primary field is phoneNumber */}
                {(() => {
                  const storeData = selectedReceipt.storeData;
                  let phone = '';
                  let phoneType = 'work';
                  
                  // Check direct receipt fields first
                  if (selectedReceipt.storePhone) {
                    phone = selectedReceipt.storePhone;
                    phoneType = selectedReceipt.phoneType || 'work';
                  }
                  
                  // If no phone in receipt, check storeData (which comes from actual store document)
                  if (!phone && storeData) {
                    phone = storeData.phoneNumber || '';
                    phoneType = storeData.phoneType || 'work';
                  }
                  
                  return phone ? (
                    <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span role="img" aria-label="phone" style={{ fontSize: '1rem', minWidth: '1.2rem' }}>
                        {phoneType === 'personal' ? '📱' : '📞'}
                      </span>
                      <span>
                        {phone}
                        <span style={{ fontSize: '0.85rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                          ({phoneType === 'personal' ? 'Personal' : 'Work'})
                        </span>
                      </span>
                    </div>
                  ) : null;
                })()}
                
                {/* Email */}
                {selectedReceipt.storeEmail && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span role="img" aria-label="email" style={{ fontSize: '1rem', minWidth: '1.2rem' }}>✉️</span>
                    <span>{selectedReceipt.storeEmail}</span>
                  </div>
                )}
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
            
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => downloadReceipt(selectedReceipt)}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>�</span>
                Download PDF
              </button>
              <button
                onClick={() => sendReceiptViaEmail(selectedReceipt)}
                disabled={loading}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: loading ? '#9ca3af' : '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>📧</span>
                {loading ? 'Sending...' : 'Send via Email'}
              </button>
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
  );
}

export default ReceiptsPage;