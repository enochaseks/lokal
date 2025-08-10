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
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', padding: '2rem 1rem', borderRadius: 8, boxShadow: '0 2px 8px #B8B8B8' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ marginBottom: 20, background: '#eee', color: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}
        >
          ← Back
        </button>
        <h2 style={{ marginBottom: 24 }}>Your Cart</h2>
        {cart.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', margin: '2rem 0' }}>Your cart is empty.</div>
        ) : (
          <>
            {Object.entries(grouped).map(([key, group]) => {
              const fees = calculateFeesSync(group);
              return (
                <div key={key} style={{ marginBottom: 32 }}>
                  <h3 style={{ color: '#007B7F', marginBottom: 10 }}>{group.storeName} <span style={{ color: '#888', fontSize: '1rem' }}>({group.currency})</span></h3>
                  {group.deliveryType && (
                    <div style={{ color: '#007B7F', fontWeight: 500, marginBottom: 8 }}>
                      Delivery Type: {group.deliveryType}
                    </div>
                  )}
                  {group.items.map(item => (
                    <div key={item.itemId} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, background: '#f6f6fa', borderRadius: 8, padding: '0.7rem 1rem' }}>
                      {item.image && <img src={item.image} alt={item.itemName} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{item.itemName}</div>
                        <div style={{ color: '#444' }}>{getCurrencySymbol(item.currency)}{formatPrice(item.price, item.currency)} × {item.quantity}</div>
                      </div>
                      <button onClick={() => removeFromCart(item.itemId, item.storeId)} style={{ background: '#D92D20', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>
                      Subtotal: {getCurrencySymbol(group.currency)}{formatPrice(fees.subtotal, group.currency)}
                    </div>
                    {fees.deliveryFee > 0 && (
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>
                        Delivery Fee: {getCurrencySymbol(group.currency)}{formatPrice(fees.deliveryFee, group.currency)}
                      </div>
                    )}
                    {fees.serviceFee > 0 && (
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>
                        Service Fee: {getCurrencySymbol(group.currency)}{formatPrice(fees.serviceFee, group.currency)}
                      </div>
                    )}
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 4 }}>
                      Total: {getCurrencySymbol(group.currency)}{formatPrice(fees.total, group.currency)}
                    </div>
                  </div>
                </div>
              );
            })}
            
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <button 
                onClick={clearCart} 
                style={{ 
                  background: '#888', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 8, 
                  padding: '0.7rem 1.2rem', 
                  fontWeight: 600, 
                  cursor: 'pointer' 
                }}
              >
                Clear Cart
              </button>
              <button
                onClick={handlePayNow}
                disabled={processing}
                style={{ 
                  background: processing ? '#ccc' : '#007B7F', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 8, 
                  padding: '0.7rem 1.2rem', 
                  fontWeight: 600, 
                  cursor: processing ? 'not-allowed' : 'pointer' 
                }}
              >
                {processing ? 'Sending Orders...' : 'Send Order Requests'}
              </button>
            </div>

            {showLocationWarning && (
              <div style={{ 
                color: '#D92D20', 
                marginTop: 12, 
                fontWeight: 600,
                background: '#fbe8e8',
                padding: '0.8rem',
                borderRadius: 8,
                border: '1px solid #D92D20'
              }}>
                ⚠️ Please set your location in your profile to order from delivery stores.
                <div style={{ marginTop: 8 }}>
                  <button 
                    onClick={() => navigate('/profile')}
                    style={{
                      background: '#D92D20',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '0.4rem 0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Update Profile
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ShopCartPage;