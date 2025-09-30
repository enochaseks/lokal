import React, { useEffect, useState } from 'react';
import { useCart } from '../CartContext';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

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

function ShopCartPage() {
  const { cart, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();
  const [buyerProfile, setBuyerProfile] = useState(null);
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [groupFees, setGroupFees] = useState({});

  // Fetch buyer profile and current user
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setBuyerProfile(userDoc.data());
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch fee settings when cart changes
  useEffect(() => {
    const fetchFeeSettings = async () => {
      const storeIds = [...new Set(cart.map(item => item.storeId))];
      
      for (const storeId of storeIds) {
        if (!groupFees[storeId]) {
          await getFeeSettings(storeId);
        }
      }
    };

    if (cart.length > 0) {
      fetchFeeSettings();
    }
  }, [cart, groupFees]);

  // Group items by store and currency, and collect deliveryType
  const grouped = cart.reduce((acc, item) => {
    const key = `${item.storeId}_${item.currency}`;
    if (!acc[key]) acc[key] = { 
      storeId: item.storeId, 
      storeName: item.storeName, 
      currency: item.currency, 
      deliveryType: item.deliveryType, 
      items: [] 
    };
    // If deliveryType is not set yet, set it from the item
    if (!acc[key].deliveryType && item.deliveryType) acc[key].deliveryType = item.deliveryType;
    acc[key].items.push(item);
    return acc;
  }, {});

  // Function to get fee settings from state or fetch them
  const getFeeSettings = async (storeId) => {
    if (groupFees[storeId]) {
      return groupFees[storeId];
    }

    try {
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        const feeSettings = storeData.feeSettings || {};
        
        // Cache the fee settings
        setGroupFees(prev => ({
          ...prev,
          [storeId]: feeSettings
        }));
        
        return feeSettings;
      }
    } catch (error) {
      console.error('Error fetching store fee settings:', error);
    }
    
    return {}; // Return empty object if no settings found
  };

  // Calculate delivery and service fees for a group (async for actual order processing)
  const calculateFees = async (group) => {
    let deliveryFee = 0;
    let serviceFee = 0;
    const subtotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
      // Fetch store-specific fee settings
      const storeDoc = await getDoc(doc(db, 'stores', group.storeId));
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        const feeSettings = storeData.feeSettings || {};

        // Calculate delivery fee
        if (feeSettings.deliveryEnabled && group.deliveryType === 'Delivery') {
          if (feeSettings.freeDeliveryThreshold && subtotal >= feeSettings.freeDeliveryThreshold) {
            deliveryFee = 0; // Free delivery threshold met
          } else {
            deliveryFee = feeSettings.deliveryFee || 0;
          }
        }

        // Calculate service fee
        if (feeSettings.serviceFeeEnabled) {
          if (feeSettings.serviceFeeType === 'percentage') {
            serviceFee = subtotal * (feeSettings.serviceFeeRate / 100);
            if (feeSettings.serviceFeeMax && serviceFee > feeSettings.serviceFeeMax) {
              serviceFee = feeSettings.serviceFeeMax;
            }
          } else {
            serviceFee = feeSettings.serviceFeeAmount || 0;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching store fee settings:', error);
    }

    return {
      subtotal,
      deliveryFee,
      serviceFee,
      total: subtotal + deliveryFee + serviceFee
    };
  };

  // Simple function to calculate fees synchronously (for display purposes)
  const calculateFeesSync = (group) => {
    const subtotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Get cached fee settings for this store
    const feeSettings = groupFees[group.storeId] || {};
    
    let deliveryFee = 0;
    let serviceFee = 0;
    
    // Calculate delivery fee based on seller's settings
    if (feeSettings.deliveryEnabled && group.deliveryType === 'Delivery') {
      if (feeSettings.freeDeliveryThreshold && subtotal >= feeSettings.freeDeliveryThreshold) {
        deliveryFee = 0; // Free delivery threshold met
      } else {
        deliveryFee = feeSettings.deliveryFee || 0;
      }
    }
    
    // Calculate service fee based on seller's settings
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
    
    return {
      subtotal,
      deliveryFee,
      serviceFee,
      total: subtotal + deliveryFee + serviceFee
    };
  };

  const createOrderMessage = async (group) => {
    const fees = await calculateFees(group);
    const itemsList = group.items.map(item => 
      `• ${item.itemName} - ${getCurrencySymbol(group.currency)}${formatPrice(item.price, group.currency)} × ${item.quantity} = ${getCurrencySymbol(group.currency)}${formatPrice(item.price * item.quantity, group.currency)}`
    ).join('\n');

    let feeBreakdown = '';
    if (fees.deliveryFee > 0 || fees.serviceFee > 0) {
      feeBreakdown = `\n💰 Cost Breakdown:
Subtotal: ${getCurrencySymbol(group.currency)}${formatPrice(fees.subtotal, group.currency)}`;
      
      if (fees.deliveryFee > 0) {
        feeBreakdown += `\nDelivery Fee: ${getCurrencySymbol(group.currency)}${formatPrice(fees.deliveryFee, group.currency)}`;
      }
      
      if (fees.serviceFee > 0) {
        feeBreakdown += `\nService Fee: ${getCurrencySymbol(group.currency)}${formatPrice(fees.serviceFee, group.currency)}`;
      }
      
      feeBreakdown += `\nTotal: ${getCurrencySymbol(group.currency)}${formatPrice(fees.total, group.currency)}`;
    }

    return {
      message: `🛒 NEW ORDER REQUEST

Customer: ${buyerProfile?.name || currentUser?.email || 'Unknown'}
${buyerProfile?.email ? `Email: ${buyerProfile.email}` : ''}
${buyerProfile?.location ? `Location: ${buyerProfile.location}` : ''}

📦 Items Ordered:
${itemsList}

💰 ${fees.deliveryFee > 0 || fees.serviceFee > 0 ? 'Total' : 'Subtotal'}: ${getCurrencySymbol(group.currency)}${formatPrice(fees.total, group.currency)}${feeBreakdown}
🚚 Delivery Type: ${group.deliveryType || 'Not specified'}

Please respond to confirm this order and provide payment/pickup instructions.`,
      fees
    };
  };

  const sendOrderToStore = async (group) => {
    try {
      const timestamp = Date.now();
      const conversationId = `order_${timestamp}_${currentUser.uid}_${group.storeId}`;
      const orderMessageData = await createOrderMessage(group);
      
      // Create unique order ID with milliseconds and random component
      const orderId = `order_${timestamp}_${Math.random().toString(36).substr(2, 5)}_${currentUser.uid.slice(-4)}`;
      
      // Create message document
      const messageDoc = await addDoc(collection(db, 'messages'), {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: buyerProfile?.name || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: group.storeId,
        receiverName: group.storeName,
        message: orderMessageData.message,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'order_request',
        orderData: {
          orderId: orderId,
          items: group.items.map(item => ({
            itemId: item.itemId,
            itemName: item.itemName,
            name: item.itemName,
            price: item.price,
            currency: item.currency,
            quantity: item.quantity,
            subtotal: item.price * item.quantity
          })),
          subtotal: orderMessageData.fees.subtotal,
          deliveryFee: orderMessageData.fees.deliveryFee,
          serviceFee: orderMessageData.fees.serviceFee,
          totalAmount: orderMessageData.fees.total,
          totalItems: group.items.reduce((sum, item) => sum + item.quantity, 0),
          currency: group.currency,
          deliveryType: group.deliveryType,
          customerLocation: buyerProfile?.location || null
        }
      });

      console.log(`Order message created with ID: ${messageDoc.id} for store: ${group.storeName}`);
      
      // Small delay to ensure timestamp uniqueness for multiple stores
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('Error sending order to store:', error);
      return false;
    }
  };

  const handlePayNow = async () => {
    if (!currentUser) {
      alert('Please log in to place an order.');
      return;
    }

    const needsLocation = Object.values(grouped).some(
      group => group.deliveryType === 'Delivery'
    );
    
    if (needsLocation && (!buyerProfile || !buyerProfile.location)) {
      setShowLocationWarning(true);
      return;
    }

    setProcessing(true);
    setShowLocationWarning(false);

    try {
      // Send orders to each store sequentially to ensure proper message creation
      const results = [];
      const stores = Object.values(grouped);
      
      for (let i = 0; i < stores.length; i++) {
        const result = await sendOrderToStore(stores[i]);
        results.push(result);
        console.log(`Processed order ${i + 1}/${stores.length} - Success: ${result}`);
      }
      
      const successCount = results.filter(result => result === true).length;
      const totalStores = stores.length;

      if (successCount === totalStores) {
        alert(`Order requests sent successfully to ${totalStores} store${totalStores > 1 ? 's' : ''}! Check your messages for responses from the sellers.`);
        clearCart(); // Clear cart after successful order
        navigate('/messages'); // Navigate to messages page to see conversations
      } else {
        alert(`Some orders failed to send. ${successCount}/${totalStores} orders sent successfully.`);
      }
    } catch (error) {
      console.error('Error processing orders:', error);
      alert('Failed to send order requests. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
      minHeight: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <Navbar />
      
      {/* Header Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #007B7F 0%, #005a5d 100%)',
        padding: '2rem 1rem',
        color: 'white',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat',
          opacity: 0.1
        }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '2.5rem', 
            fontWeight: 800,
            marginBottom: '0.5rem',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            🛒 Your Cart
          </h1>
          <p style={{ 
            margin: 0, 
            fontSize: '1.1rem', 
            opacity: 0.9,
            fontWeight: 400
          }}>
            {cart.length === 0 ? 'Your cart is empty' : `${cart.length} item${cart.length !== 1 ? 's' : ''} from ${Object.keys(grouped).length} store${Object.keys(grouped).length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        maxWidth: 900, 
        margin: '-2rem auto 2rem', 
        padding: '0 1rem',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          style={{ 
            marginBottom: 24, 
            background: 'rgba(255, 255, 255, 0.95)', 
            color: '#007B7F', 
            border: '1px solid rgba(0, 123, 127, 0.2)', 
            borderRadius: 12, 
            padding: '0.75rem 1.5rem', 
            fontWeight: 600, 
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 123, 127, 0.15)',
            backdropFilter: 'blur(10px)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#007B7F';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 123, 127, 0.25)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
            e.currentTarget.style.color = '#007B7F';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 127, 0.15)';
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>←</span> Back to Shopping
        </button>

        {cart.length === 0 ? (
          /* Empty Cart State */
          <div style={{ 
            background: 'white',
            borderRadius: 20,
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0, 123, 127, 0.1)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
            <h3 style={{ 
              color: '#1e293b', 
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: 600
            }}>
              Your cart is empty
            </h3>
            <p style={{ 
              color: '#64748b', 
              marginBottom: '2rem',
              fontSize: '1.1rem'
            }}>
              Start shopping to add items to your cart
            </p>
            <button
              onClick={() => navigate('/explore')}
              style={{
                background: 'linear-gradient(135deg, #007B7F 0%, #005a5d 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(0, 123, 127, 0.3)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 123, 127, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 123, 127, 0.3)';
              }}
            >
              🛍️ Start Shopping
            </button>
          </div>
        ) : (
          /* Cart Items */
          <>
            {Object.entries(grouped).map(([key, group]) => {
              const fees = calculateFeesSync(group);
              return (
                <div key={key} style={{ 
                  marginBottom: 24,
                  background: 'white',
                  borderRadius: 20,
                  padding: '2rem',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                  border: '1px solid rgba(0, 123, 127, 0.1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Store Header */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '1.5rem',
                    paddingBottom: '1rem',
                    borderBottom: '2px solid #f1f5f9'
                  }}>
                    <div>
                      <h3 style={{ 
                        color: '#1e293b', 
                        margin: 0,
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        🏪 {group.storeName}
                        <span style={{ 
                          color: '#64748b', 
                          fontSize: '1rem',
                          fontWeight: 500,
                          background: '#f1f5f9',
                          padding: '4px 12px',
                          borderRadius: '20px'
                        }}>
                          {group.currency}
                        </span>
                      </h3>
                      {group.deliveryType && (
                        <div style={{ 
                          color: '#007B7F', 
                          fontWeight: 600, 
                          marginTop: 8,
                          fontSize: '0.95rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          🚚 {group.deliveryType}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    {group.items.map(item => (
                      <div key={item.itemId} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 16, 
                        marginBottom: 12, 
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
                        borderRadius: 16, 
                        padding: '1.25rem',
                        border: '1px solid #e2e8f0',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}>
                        {item.image && (
                          <div style={{ 
                            width: 64, 
                            height: 64, 
                            borderRadius: 12, 
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            border: '2px solid white'
                          }}>
                            <img 
                              src={item.image} 
                              alt={item.itemName} 
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover'
                              }} 
                            />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontWeight: 700, 
                            fontSize: '1.1rem',
                            color: '#1e293b',
                            marginBottom: '4px'
                          }}>
                            {item.itemName}
                          </div>
                          <div style={{ 
                            color: '#64748b',
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }}>
                            {getCurrencySymbol(item.currency)}{formatPrice(item.price, item.currency)} × {item.quantity} = {getCurrencySymbol(item.currency)}{formatPrice(item.price * item.quantity, item.currency)}
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.itemId, item.storeId)} 
                          style={{ 
                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: 10, 
                            padding: '0.6rem 1rem', 
                            fontWeight: 600, 
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
                          }}
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Price Breakdown */}
                  <div style={{ 
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: 16,
                    padding: '1.5rem',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        color: '#64748b',
                        fontSize: '0.95rem',
                        marginBottom: '6px'
                      }}>
                        <span>Subtotal:</span>
                        <span>{getCurrencySymbol(group.currency)}{formatPrice(fees.subtotal, group.currency)}</span>
                      </div>
                      {fees.deliveryFee > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          color: '#64748b',
                          fontSize: '0.95rem',
                          marginBottom: '6px'
                        }}>
                          <span>🚚 Delivery Fee:</span>
                          <span>{getCurrencySymbol(group.currency)}{formatPrice(fees.deliveryFee, group.currency)}</span>
                        </div>
                      )}
                      {fees.serviceFee > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          color: '#64748b',
                          fontSize: '0.95rem',
                          marginBottom: '6px'
                        }}>
                          <span>⚙️ Service Fee:</span>
                          <span>{getCurrencySymbol(group.currency)}{formatPrice(fees.serviceFee, group.currency)}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      fontWeight: 700, 
                      fontSize: '1.3rem',
                      color: '#007B7F',
                      paddingTop: '0.75rem',
                      borderTop: '2px solid #e2e8f0'
                    }}>
                      <span>Total:</span>
                      <span>{getCurrencySymbol(group.currency)}{formatPrice(fees.total, group.currency)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Action Buttons */}
            <div style={{ 
              background: 'white',
              borderRadius: 20,
              padding: '2rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              border: '1px solid rgba(0, 123, 127, 0.1)',
              display: 'flex', 
              gap: 16, 
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              <button 
                onClick={clearCart} 
                style={{ 
                  background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 12, 
                  padding: '1rem 1.5rem', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(107, 114, 128, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(107, 114, 128, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 114, 128, 0.3)';
                }}
              >
                🗑️ Clear Cart
              </button>
              <button
                onClick={handlePayNow}
                disabled={processing}
                style={{ 
                  background: processing 
                    ? 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)' 
                    : 'linear-gradient(135deg, #007B7F 0%, #005a5d 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 12, 
                  padding: '1rem 2rem', 
                  fontWeight: 600, 
                  cursor: processing ? 'not-allowed' : 'pointer',
                  fontSize: '1.1rem',
                  transition: 'all 0.2s ease',
                  boxShadow: processing 
                    ? '0 2px 8px rgba(0,0,0,0.1)' 
                    : '0 4px 16px rgba(0, 123, 127, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minWidth: '200px',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  if (!processing) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 123, 127, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!processing) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 123, 127, 0.3)';
                  }
                }}
              >
                {processing ? (
                  <>
                    <span style={{ 
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Sending Orders...
                  </>
                ) : (
                  <>🚀 Send Order Requests</>
                )}
              </button>
            </div>

            {/* Location Warning */}
            {showLocationWarning && (
              <div style={{ 
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                border: '1px solid #fca5a5',
                borderRadius: 16,
                padding: '1.5rem',
                marginTop: 16,
                boxShadow: '0 4px 12px rgba(248, 113, 113, 0.2)'
              }}>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '1rem'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                  <span style={{ 
                    color: '#dc2626', 
                    fontWeight: 700,
                    fontSize: '1.1rem'
                  }}>
                    Location Required
                  </span>
                </div>
                <p style={{ 
                  color: '#7f1d1d',
                  margin: '0 0 1rem 0',
                  fontSize: '1rem',
                  lineHeight: 1.5
                }}>
                  Please set your location in your profile to order from delivery stores.
                </p>
                <button 
                  onClick={() => navigate('/profile')}
                  style={{
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '0.75rem 1.5rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
                  }}
                >
                  📍 Update Profile Location
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ShopCartPage;