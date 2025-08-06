import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, getDocs, deleteDoc, setDoc } from 'firebase/firestore';

function MessagesPage() {
  const [activeTab, setActiveTab] = useState('messages');
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
  
  // Store items states
  const [showStoreItems, setShowStoreItems] = useState(false);
  const [storeItems, setStoreItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [storeInfo, setStoreInfo] = useState(null);

  // Cart states
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  
  // Collapsible sections state
  const [cartSectionsCollapsed, setCartSectionsCollapsed] = useState({
    items: false,
    calculation: false
  });
  
  // Order workflow states
  const [orderStatus, setOrderStatus] = useState('shopping'); // 'shopping', 'done_adding', 'bagging', 'ready_for_payment', 'completed'
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [persistedOrderItems, setPersistedOrderItems] = useState([]);

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

  // Toggle collapse state for cart sections
  const toggleCartSection = (section) => {
    setCartSectionsCollapsed(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const storeDocRef = doc(db, 'stores', user.uid);
          const storeDocSnap = await getDoc(storeDocRef);
          setIsSeller(storeDocSnap.exists());
          
          // Check for persisted order state
          const orderStateDocRef = doc(db, 'orderStates', user.uid);
          const orderStateSnap = await getDoc(orderStateDocRef);
          if (orderStateSnap.exists()) {
            const orderState = orderStateSnap.data();
            setOrderStatus(orderState.status || 'shopping');
            setCurrentOrderId(orderState.orderId || null);
            setPersistedOrderItems(orderState.items || []);
            
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

  // Fetch conversations
  useEffect(() => {
    if (!currentUser) return;

    // For sellers, we need to fetch both sent and received messages to see all conversations
    const messagesQuery = isSeller 
      ? query(
          collection(db, 'messages'),
          orderBy('timestamp', 'desc')
        )
      : query(
          collection(db, 'messages'),
          where('senderId', '==', currentUser.uid),
          orderBy('timestamp', 'desc')
        );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const conversationMap = new Map();
      
      snapshot.docs.forEach(doc => {
        const message = { id: doc.id, ...doc.data() };
        
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
          // Customer logic (unchanged)
          if (message.senderId === currentUser.uid) {
            shouldInclude = true;
            otherUserId = message.receiverId;
            otherUserName = message.receiverName;
            otherUserEmail = message.receiverEmail;
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
            conversationMap.set(conversationId, {
              id: conversationId,
              otherUserId,
              otherUserName,
              otherUserEmail,
              lastMessage: message.message,
              lastMessageTime: message.timestamp,
              isRead: message.isRead,
              messageType: message.messageType
            });
          }
        }
      });

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

  // Fetch store info when conversation is selected (for displaying correct email)
  useEffect(() => {
    if (!selectedConversation || isSeller) return;

    const fetchStoreInfo = async () => {
      try {
        const storeDoc = await getDoc(doc(db, 'stores', selectedConversation.otherUserId));
        if (storeDoc.exists()) {
          setStoreInfo(storeDoc.data());
        }
      } catch (error) {
        console.error('Error fetching store info:', error);
      }
    };

    fetchStoreInfo();
  }, [selectedConversation, isSeller]);

  // Fetch store items and info when showing items
  useEffect(() => {
    if (!showStoreItems || !selectedConversation || isSeller) return;

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
  }, [showStoreItems, selectedConversation, isSeller]);

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

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    try {
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

  // Delete message function
  const deleteMessage = async (messageId) => {
    if (!messageId || !currentUser) return;

    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await updateDoc(doc(db, 'messages', messageId), {
          deleted: true,
          deletedBy: currentUser.uid,
          deletedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message. Please try again.');
      }
    }
  };

  // Calculate cart totals
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
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

    // Create consistent conversation ID (always put smaller UID first for consistency)
    const conversationId = selectedConversation.id || 
      [currentUser.uid, selectedConversation.otherUserId].sort().join('_');

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
          items: cart.map(item => ({
            itemId: item.id,
            itemName: item.name,
            price: item.price,
            currency: item.currency,
            quantity: item.quantity,
            subtotal: item.price * item.quantity
          })),
          totalAmount: totalPrice,
          totalItems: getCartItemCount(),
          currency: cart[0]?.currency || 'GBP'
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
    const totalAmount = allOrderItems.reduce((total, item) => total + item.subtotal, 0);
    const totalItems = allOrderItems.reduce((total, item) => total + item.quantity, 0);
    const currency = allOrderItems[0]?.currency || 'GBP';

    const doneMessage = `✅ DONE ADDING ITEMS

Order ID: ${orderId}

${allOrderItems.map(item => 
  `• ${item.itemName} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.subtotal, item.currency)}`
).join('\n')}

Total: ${getCurrencySymbol(currency)}${formatPrice(totalAmount, currency)}
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
        totalAmount: totalAmount,
        totalItems: totalItems,
        currency: currency,
        timestamp: serverTimestamp()
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

    const totalAmount = allOrderItems.reduce((total, item) => total + item.subtotal, 0);
    const totalItems = allOrderItems.reduce((total, item) => total + item.quantity, 0);
    const currency = allOrderItems[0]?.currency || 'GBP';

    const orderDetails = allOrderItems.map(item => 
      `• ${item.itemName} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.subtotal, item.currency)}`
    ).join('\n');

    const doneMessage = `✅ DONE ADDING ITEMS

Order ID: ${orderId}

${orderDetails}

Total: ${getCurrencySymbol(currency)}${formatPrice(totalAmount, currency)}
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
          totalAmount: totalAmount,
          totalItems: totalItems,
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

    // Create consistent conversation ID
    const conversationId = selectedConversation.id || 
      [selectedConversation.otherUserId, currentUser.uid].sort().join('_');

    // Ensure all values are properly defined
    const validItems = orderData.items.map(item => ({
      itemName: item.itemName || item.name || 'Unknown Item',
      quantity: Number(item.quantity) || 1,
      currency: item.currency || 'GBP',
      subtotal: Number(item.subtotal) || (Number(item.price) * Number(item.quantity)) || 0
    }));

    const totalAmount = Number(orderData.totalAmount) || validItems.reduce((total, item) => total + item.subtotal, 0);
    const currency = orderData.currency || validItems[0]?.currency || 'GBP';
    const orderId = orderData.orderId || `order_${Date.now()}`;

    const baggedMessage = `📦 ITEMS BAGGED

Order ID: ${orderId}

Your order has been prepared and bagged:

${validItems.map(item => 
  `• ${item.itemName} x${item.quantity} - ${getCurrencySymbol(item.currency)}${formatPrice(item.subtotal, item.currency)}`
).join('\n')}

Total Amount: ${getCurrencySymbol(currency)}${formatPrice(totalAmount, currency)}

Please proceed with payment to complete your order.`;

    try {
      await addDoc(collection(db, 'messages'), {
        conversationId: conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderEmail: currentUser.email,
        receiverId: selectedConversation.otherUserId,
        receiverName: selectedConversation.otherUserName,
        receiverEmail: selectedConversation.otherUserEmail,
        message: baggedMessage,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'items_bagged',
        orderData: {
          orderId: orderId,
          items: validItems,
          totalAmount: Number(totalAmount),
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
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div className="messages-container">
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
          <div className="messages-content">
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
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    setShowStoreItems(false);
                    setShowCart(false);
                  }}
                  className="back-button mobile-only"
                >
                  ← Back to conversations
                </button>
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
                      onClick={() => setSelectedConversation(conversation)}
                      className={`conversation-item ${selectedConversation?.id === conversation.id ? 'selected' : ''}`}
                    >
                      <div className="conversation-content">
                        <div className="conversation-main">
                          <div className="conversation-name">
                            {conversation.otherUserName}
                          </div>
                          <div className="conversation-email">
                            {conversation.otherUserEmail && conversation.otherUserEmail !== 'store@example.com' ? conversation.otherUserEmail : ''}
                          </div>
                          <div className="conversation-preview">
                            {conversation.messageType === 'order_request' && '🛒 '}
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
                <div className="chat-header">
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      setShowStoreItems(false);
                      setShowCart(false);
                    }}
                    className="back-button mobile-only"
                  >
                    ← Back
                  </button>
                  <div className="chat-user-info">
                    <div className="chat-user-name">
                      {selectedConversation.otherUserName}
                    </div>
                    <div className="chat-user-email">
                      {(() => {
                        const email = storeInfo?.email || selectedConversation.otherUserEmail;
                        return (email && email !== 'store@example.com') ? email : '';
                      })()}
                    </div>
                  </div>
                  
                  {!isSeller && (
                    <div className="header-buttons">
                      <button
                        onClick={() => setShowStoreItems(!showStoreItems)}
                        className={`browse-items-btn ${showStoreItems ? 'active' : ''} ${orderStatus !== 'shopping' ? 'disabled' : ''}`}
                        disabled={orderStatus !== 'shopping'}
                      >
                        {showStoreItems ? 'Hide Items' : '🛍️ Browse'}
                        {orderStatus !== 'shopping' && ' (Order Finalized)'}
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
                </div>

                <div className="chat-body">
                  <div className={`messages-area ${(showStoreItems || showCart) ? 'with-sidebar' : ''}`}>
                    <div className="messages-list">
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
                            <div className="message-bubble">
                              <div className="message-content">
                                <div className="message-text">
                                  {message.message}
                                </div>
                                {message.senderId === currentUser.uid && (
                                  <button
                                    onClick={() => deleteMessage(message.id)}
                                    className="delete-message-btn"
                                    title="Delete message"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                              
                              {/* Special handling for order workflow messages */}
                              {message.messageType === 'order_request' && message.senderId === currentUser.uid && !isSeller && orderStatus === 'shopping' && (
                                <div className="message-actions">
                                  <button
                                    onClick={() => signalDoneAddingFromMessage(message.orderData)}
                                    className="action-btn done-message-btn"
                                    disabled={orderStatus !== 'shopping'}
                                  >
                                    ✅ Done Adding Items
                                  </button>
                                </div>
                              )}
                              
                              {message.messageType === 'done_adding' && message.receiverId === currentUser.uid && isSeller && (
                                <div className="message-actions">
                                  <button
                                    onClick={() => signalItemsBagged(message.orderData)}
                                    className="action-btn bag-items-btn"
                                  >
                                    📦 Items Bagged & Ready
                                  </button>
                                </div>
                              )}
                              
                              {message.messageType === 'items_bagged' && message.receiverId === currentUser.uid && !isSeller && (
                                <div className="message-actions">
                                  <button className="action-btn payment-btn">
                                    💳 Proceed to Payment
                                  </button>
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

                    <div className="message-input-area">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type your message..."
                        className="message-input"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className="send-button"
                      >
                        Send
                      </button>
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
                <div className="wallet-overview">
                  <h3 className="section-title">Wallet Overview</h3>
                  
                  <div className="balance-cards">
                    <div className="balance-card available">
                      <div className="balance-label">Available Balance</div>
                      <div className="balance-amount">
                        {formatCurrency(walletData.balance)}
                      </div>
                    </div>

                    <div className="balance-card pending">
                      <div className="balance-label">Pending</div>
                      <div className="balance-amount">
                        {formatCurrency(walletData.pendingBalance)}
                      </div>
                    </div>

                    <div className="balance-card total">
                      <div className="balance-label">Total Earnings</div>
                      <div className="balance-amount">
                        {formatCurrency(walletData.totalEarnings)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (walletData.balance > 0) {
                        alert('Withdrawal functionality will be implemented soon!');
                      } else {
                        alert('No available balance to withdraw');
                      }
                    }}
                    disabled={walletData.balance <= 0}
                    className="withdraw-button"
                  >
                    Withdraw Available Balance
                  </button>
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
                            </div>
                          </div>
                          <div
                            className="transaction-amount"
                            style={{ color: getTransactionColor(transaction.type) }}
                          >
                            {transaction.type === 'withdrawal' ? '-' : '+'}
                            {formatCurrency(Math.abs(transaction.amount))}
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

      <style jsx>{`
        .messages-container {
          max-width: 1200px;
          margin: 2rem auto;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(184, 184, 184, 0.3);
          overflow: hidden;
          min-height: calc(100vh - 6rem);
        }

        .messages-tabs {
          display: flex;
          border-bottom: 2px solid #eee;
        }

        .tab-button {
          flex: 1;
          padding: 1rem;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: #888;
          font-weight: 700;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-button.active {
          background: #F9F5EE;
          border-bottom-color: #007B7F;
          color: #007B7F;
        }

        .messages-content {
          display: flex;
          height: calc(100vh - 12rem);
        }

        .conversations-panel {
          width: 320px;
          border-right: 1px solid #eee;
          display: flex;
          flex-direction: column;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem;
          border: 1.5px solid #B8B8B8;
          border-radius: 6px;
          margin: 1rem;
          margin-bottom: 0.5rem;
          width: calc(100% - 2rem);
          font-size: 0.95rem;
          outline: none;
          box-sizing: border-box;
        }

        .back-button {
          width: calc(100% - 2rem);
          margin: 0.5rem 1rem;
          padding: 0.5rem;
          background: #eee;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .mobile-only {
          display: none;
        }

        .conversations-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem 1rem;
        }

        .conversation-item {
          padding: 0.75rem;
          border: 1px solid #eee;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          background: #fafafa;
          cursor: pointer;
          transition: background 0.2s;
        }

        .conversation-item:hover {
          background: #f0f9ff;
        }

        .conversation-item.selected {
          background: #F0F9FF;
          border-left: 4px solid #007B7F;
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
          padding: 1rem;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fff;
        }

        .chat-user-info {
          flex: 1;
        }

        .chat-user-name {
          font-weight: 600;
          font-size: 1.1rem;
        }

        .chat-user-email {
          font-size: 0.9rem;
          color: #666;
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
        }

        .messages-area.with-sidebar {
          border-right: 1px solid #eee;
        }

        .messages-list {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .message {
          margin-bottom: 1rem;
          display: flex;
        }

        .message.sent {
          justify-content: flex-end;
        }

        .message.received {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 80%;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          word-wrap: break-word;
        }

        .message.sent .message-bubble {
          background: #007B7F;
          color: #fff;
        }

        .message.received .message-bubble {
          background: #f1f1f1;
          color: #333;
        }

        .message-text {
          font-size: 0.95rem;
          white-space: pre-wrap;
          line-height: 1.4;
        }

        .message-time {
          font-size: 0.75rem;
          margin-top: 0.5rem;
          opacity: 0.8;
        }

        .message-input-area {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          padding: 1rem;
          border-top: 1px solid #eee;
          background: #fff;
          flex-wrap: wrap;
        }

        .message-input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid #ccc;
          border-radius: 8px;
          outline: none;
          font-size: 0.95rem;
        }

        .send-button {
          padding: 0.75rem 1.5rem;
          background: #007B7F;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
        }

        .send-button:disabled {
          background: #ccc;
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

        .balance-amount {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .balance-card.available .balance-amount { color: #15803D; }
        .balance-card.pending .balance-amount { color: #B45309; }
        .balance-card.total .balance-amount { color: #005a5d; }

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

          .search-input {
            margin: 0.5rem;
            width: calc(100% - 1rem);
          }

          .back-button {
            margin: 0.5rem;
            width: calc(100% - 1rem);
          }

          .message-input-area {
            flex-wrap: wrap;
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
          gap: 0.75rem;
        }

        .clear-cart-btn {
          flex: 1;
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
          flex: 2;
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
          background: transparent;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 0.8rem;
          padding: 0.2rem;
          border-radius: 3px;
          opacity: 0;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .message:hover .delete-message-btn {
          opacity: 1;
        }

        .delete-message-btn:hover {
          background: #ff4444;
          color: #fff;
          transform: scale(1.1);
        }

        /* Mobile responsive updates */
        @media (max-width: 768px) {
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
            max-height: 400px;
            order: -1;
          }

          .cart-content-wrapper {
            max-height: 300px;
          }

          .cart-items {
            max-height: 200px;
          }

          .cart-actions {
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .cart-btn {
            display: none;
          }

          .cart-sidebar {
            max-height: 300px;
          }
        }
      `}</style>
    </div>
  );
}

export default MessagesPage;