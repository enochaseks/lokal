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

  const createOrderMessage = (group) => {
    const total = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemsList = group.items.map(item => 
      `• ${item.itemName} - ${getCurrencySymbol(group.currency)}${formatPrice(item.price, group.currency)} × ${item.quantity} = ${getCurrencySymbol(group.currency)}${formatPrice(item.price * item.quantity, group.currency)}`
    ).join('\n');

    return `🛒 NEW ORDER REQUEST

Customer: ${buyerProfile?.name || currentUser?.email || 'Unknown'}
${buyerProfile?.email ? `Email: ${buyerProfile.email}` : ''}
${buyerProfile?.location ? `Location: ${buyerProfile.location}` : ''}

📦 Items Ordered:
${itemsList}

💰 Total: ${getCurrencySymbol(group.currency)}${formatPrice(total, group.currency)}
🚚 Delivery Type: ${group.deliveryType || 'Not specified'}

Please respond to confirm this order and provide payment/pickup instructions.`;
  };

  const sendOrderToStore = async (group) => {
    try {
      const conversationId = `${currentUser.uid}_${group.storeId}`;
      
      // Create message document
      await addDoc(collection(db, 'messages'), {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: buyerProfile?.name || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: group.storeId,
        receiverName: group.storeName,
        message: createOrderMessage(group),
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'order_request',
        orderData: {
          items: group.items,
          total: group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          currency: group.currency,
          deliveryType: group.deliveryType,
          customerLocation: buyerProfile?.location || null
        }
      });

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
      // Send orders to each store
      const orderPromises = Object.values(grouped).map(group => sendOrderToStore(group));
      const results = await Promise.all(orderPromises);
      
      const successCount = results.filter(result => result === true).length;
      const totalStores = Object.keys(grouped).length;

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
            {Object.entries(grouped).map(([key, group]) => (
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
                <div style={{ textAlign: 'right', fontWeight: 600, marginTop: 8 }}>
                  Total: {getCurrencySymbol(group.currency)}{formatPrice(group.items.reduce((sum, i) => sum + i.price * i.quantity, 0), group.currency)}
                </div>
              </div>
            ))}
            
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