import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item) => {
    setCart(prev => {
      // If item from same store and same id exists, increase quantity
      const existing = prev.find(i => i.itemId === item.itemId && i.storeId === item.storeId);
      if (existing) {
        return prev.map(i =>
          i.itemId === item.itemId && i.storeId === item.storeId
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  };

  const removeFromCart = (itemId, storeId) => {
    setCart(prev => prev.filter(i => !(i.itemId === itemId && i.storeId === storeId)));
  };

  const clearCart = () => setCart([]);

  // Add a function to clear cart on profile deletion or logout
  const clearCartOnProfileDelete = () => {
    setCart([]);
    localStorage.removeItem('cart');
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, clearCartOnProfileDelete }}>
      {children}
    </CartContext.Provider>
  );
} 