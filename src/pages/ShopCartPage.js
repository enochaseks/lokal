import React, { useEffect, useState } from 'react';
import { useCart } from '../CartContext';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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

  // Fetch buyer profile
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
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
    if (!acc[key]) acc[key] = { storeName: item.storeName, currency: item.currency, deliveryType: item.deliveryType, items: [] };
    // If deliveryType is not set yet, set it from the item
    if (!acc[key].deliveryType && item.deliveryType) acc[key].deliveryType = item.deliveryType;
    acc[key].items.push(item);
    return acc;
  }, {});

  const handlePayNow = () => {
    const needsLocation = Object.values(grouped).some(
      group => group.deliveryType === 'Delivery'
    );
    if (needsLocation && (!buyerProfile || !buyerProfile.location)) {
      setShowLocationWarning(true);
      return;
    }
    alert('Payment functionality coming soon.');
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
            <button onClick={clearCart} style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem 1.2rem', fontWeight: 600, cursor: 'pointer', marginTop: 16 }}>Clear Cart</button>
            <button
              onClick={handlePayNow}
              style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem 1.2rem', fontWeight: 600, cursor: 'pointer', marginTop: 16, marginLeft: 12 }}
            >
              Pay Now
            </button>
            {showLocationWarning && (
              <div style={{ color: '#D92D20', marginTop: 12, fontWeight: 600 }}>
                Please set your location in your profile to order from delivery stores.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ShopCartPage; 