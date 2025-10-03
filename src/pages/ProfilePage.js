import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, collectionGroup, onSnapshot, updateDoc } from 'firebase/firestore';
import Navbar from '../components/Navbar';

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [city, setCity] = useState('');
  const [userCategories, setUserCategories] = useState([]);
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = not logged in, object = logged in
  const [followingStores, setFollowingStores] = useState([]);
  const [followingLoading, setFollowingLoading] = useState(true);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // New state for viewed stores
  const [viewedStores, setViewedStores] = useState([]);
  const [showViewedModal, setShowViewedModal] = useState(false);
  const [viewedLoading, setViewedLoading] = useState(false);

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Add new state for active tab
  const [activeTab, setActiveTab] = useState('following');

  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authUser === undefined) return; // Wait for auth to load
    if (!authUser) {
      setLoading(false);
      setError('Not logged in');
      return;
    }
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const docRef = doc(db, 'users', authUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
          if (docSnap.data().categories) setUserCategories(docSnap.data().categories);
        } else {
          setError('Profile not found.');
        }
      } catch (err) {
        setError('Error loading profile: ' + err.message);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [authUser]);

  useEffect(() => {
    // Real-time following list
    if (!authUser) return;
    setFollowingLoading(true);
    const q = query(collectionGroup(db, 'followers'), where('uid', '==', authUser.uid));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const storeIds = snap.docs.map(doc => doc.ref.parent.parent.id);
      const stores = [];
      for (const id of storeIds) {
        const storeDoc = await getDoc(doc(db, 'stores', id));
        if (storeDoc.exists()) {
          stores.push({ id, ...storeDoc.data() });
        }
      }
      setFollowingStores(stores);
      setFollowingLoading(false);
    });
    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!profile || !authUser) return;
    if (!localStorage.getItem('shownNearbyStoresModal')) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`
            )
              .then((res) => res.json())
              .then((data) => {
                const cityName =
                  data.address.city ||
                  data.address.town ||
                  data.address.village ||
                  data.address.state ||
                  '';
                setCity(cityName);
                setShowModal(true);
                setStoresLoading(true);
                fetchStores(cityName);
                localStorage.setItem('shownNearbyStoresModal', 'true');
              });
          },
          (error) => {
            if (profile.location) {
              setCity(profile.location);
              setShowModal(true);
              setStoresLoading(true);
              fetchStores(profile.location);
              localStorage.setItem('shownNearbyStoresModal', 'true');
            }
          }
        );
      } else if (profile.location) {
        setCity(profile.location);
        setShowModal(true);
        setStoresLoading(true);
        fetchStores(profile.location);
        localStorage.setItem('shownNearbyStoresModal', 'true');
      }
    }
    // eslint-disable-next-line
  }, [profile, authUser]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditLocation(profile.location || '');
      setEditPhoto(profile.photoURL || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!showEditModal || !editLocation) {
      setLocationSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(editLocation)}`)
        .then(res => res.json())
        .then(data => {
          setLocationSuggestions(data.map(place => place.display_name));
        });
    }, 300); // debounce
    return () => clearTimeout(timeout);
  }, [editLocation, showEditModal]);

  // Haversine formula to calculate distance between two lat/lon points
  function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  // Geocode a location string to lat/lon using Nominatim
  async function geocodeLocation(location) {
    if (!location) return null;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  }

  const fetchStores = async (cityName) => {
    try {
      let q = query(collection(db, 'stores'), where('live', '==', true));
      const querySnapshot = await getDocs(q);
      let filtered = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Geocode buyer's location
      const buyerLoc = await geocodeLocation(profile?.location || cityName);
      if (!buyerLoc) {
        setNearbyStores([]);
        setStoresLoading(false);
        return;
      }
      // For each store, use lat/lon if present, else geocode, and filter by 30 KM
      const storesWithin30km = [];
      for (const store of filtered) {
        let storeLat = store.latitude, storeLon = store.longitude;
        let storeLoc = null;
        if (storeLat == null || storeLon == null) {
          // Geocode if missing
          storeLoc = await geocodeLocation(store.storeLocation);
          if (!storeLoc) continue;
          storeLat = storeLoc.lat;
          storeLon = storeLoc.lon;
        }
        const dist = getDistanceFromLatLonInKm(buyerLoc.lat, buyerLoc.lon, storeLat, storeLon);
        if (dist <= 30) {
          storesWithin30km.push({ ...store, distance: dist });
        }
      }
      // Optionally sort by distance
      storesWithin30km.sort((a, b) => a.distance - b.distance);
      setNearbyStores(storesWithin30km);
    } catch (err) {
      setNearbyStores([]);
    }
    setStoresLoading(false);
  };

  const name = profile?.name || '';
  const location = profile?.location || '';
  const photoURL = profile?.photoURL || '';

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditError('Name is required.');
      return;
    }
    if (!editLocation.trim()) {
      setEditError('Location is required.');
      return;
    }
    setEditError('');
    setEditLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      await updateDoc(doc(db, 'users', user.uid), {
        name: editName,
        location: editLocation,
      });
      await updateProfile(user, { displayName: editName });
      setProfile(prev => ({ ...prev, name: editName, location: editLocation }));
      setShowEditModal(false);
    } catch (err) {
      setEditError('Error updating profile: ' + err.message);
    }
    setEditLoading(false);
  };

  // New useEffect to load viewed stores from localStorage
  useEffect(() => {
    if (!authUser) return;
    
    const loadViewedStores = async () => {
      setViewedLoading(true);
      try {
        const viewedData = localStorage.getItem(`viewedStores_${authUser.uid}`);
        console.log('Loading viewed stores for user:', authUser.uid, 'Data:', viewedData); // Debug log
        
        if (viewedData) {
          const storeIds = JSON.parse(viewedData);
          const stores = [];
          
          // Fetch store details for each viewed store ID
          for (const storeId of storeIds) {
            try {
              const storeDoc = await getDoc(doc(db, 'stores', storeId));
              if (storeDoc.exists()) {
                stores.push({ id: storeId, ...storeDoc.data() });
              }
            } catch (error) {
              console.error('Error fetching store:', storeId, error);
            }
          }
          
          setViewedStores(stores);
          console.log('Loaded viewed stores:', stores.length); // Debug log
        }
      } catch (error) {
        console.error('Error loading viewed stores:', error);
      }
      setViewedLoading(false);
    };

    loadViewedStores();
  }, [authUser, activeTab]); // Add activeTab as dependency to refresh when tab changes

  // Fetch customer orders
  useEffect(() => {
    if (!authUser || activeTab !== 'orders') return;
    
    const fetchOrders = async () => {
      setOrdersLoading(true);
      try {
        // Fetch all messages where the user was involved in payments, placed orders, or refunds
        const paymentsQuery = query(
          collection(db, 'messages'),
          where('messageType', 'in', [
            'payment_completed', 
            'payment_notification', 
            'order_request', 
            'pay_at_store_completed', 
            'collection_confirmation',
            'refund_approved',
            'refund_denied',
            'refund_request',
            'manual_refund_notice',
            'refund_transfer_confirmed'
          ])
        );
        
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const customerOrders = [];
        
        paymentsSnapshot.docs.forEach(doc => {
          const message = doc.data();
          
          // Skip collection_confirmation messages as they are just notifications, not orders
          if (message.messageType === 'collection_confirmation') {
            return;
          }

          // Handle refund-related messages to capture order details
          if ((message.messageType === 'refund_approved' || 
              message.messageType === 'refund_denied' || 
              message.messageType === 'manual_refund_notice' || 
              message.messageType === 'refund_transfer_confirmed') && 
              (message.receiverId === authUser.uid || message.senderId === authUser.uid)) {
            
            const orderId = message.orderData?.orderId || message.refundData?.orderId;
            if (!orderId) return;
            
            // Check if we already have this order
            const existingOrderIndex = customerOrders.findIndex(o => o.orderId === orderId);
            
            const orderData = {
              id: doc.id,
              orderId: orderId,
              items: message.orderData?.items || message.refundData?.items || [],
              totalAmount: message.orderData?.totalAmount || message.refundData?.amount || message.orderData?.refundAmount || 0,
              currency: message.orderData?.currency || message.refundData?.currency || 'GBP',
              pickupCode: message.orderData?.pickupCode,
              paymentMethod: message.orderData?.paymentMethod || message.refundData?.paymentMethod || 'Unknown',
              deliveryType: message.orderData?.deliveryType,
              timestamp: message.timestamp,
              storeName: message.messageType === 'refund_approved' || message.messageType === 'refund_denied' ? 
                        (message.senderId === authUser.uid ? message.receiverName : message.senderName) : 
                        (message.senderName !== 'Refund System' ? message.senderName : message.receiverName),
              storeId: message.messageType === 'refund_approved' || message.messageType === 'refund_denied' ? 
                      (message.senderId === authUser.uid ? message.receiverId : message.senderId) : 
                      (message.senderId !== 'system' ? message.senderId : message.receiverId),
              status: message.messageType === 'refund_approved' || message.messageType === 'manual_refund_notice' || message.messageType === 'refund_transfer_confirmed' ? 
                     'cancelled_and_refunded' : 'cancelled',
              cancelledAt: message.timestamp,
              refundedAt: message.messageType === 'refund_approved' || message.messageType === 'manual_refund_notice' || message.messageType === 'refund_transfer_confirmed' ? 
                         message.timestamp : null
            };
            
            if (existingOrderIndex >= 0) {
              // Update existing order with refund information
              customerOrders[existingOrderIndex] = {
                ...customerOrders[existingOrderIndex],
                status: orderData.status,
                refundedAt: orderData.refundedAt || customerOrders[existingOrderIndex].refundedAt,
                cancelledAt: orderData.cancelledAt || customerOrders[existingOrderIndex].cancelledAt
              };
            } else {
              customerOrders.push(orderData);
            }
          }
          
          // If this user was the customer who made the payment (senderId of payment_completed)
          if (message.messageType === 'payment_completed' && message.senderId === authUser.uid) {
            const orderId = message.paymentData?.orderId || message.orderData?.orderId;
            
            // Check if we already have this order
            const existingOrderIndex = customerOrders.findIndex(o => o.orderId === orderId);
            
            const orderData = {
              id: doc.id,
              orderId: orderId,
              items: message.paymentData?.items || message.orderData?.items || [],
              totalAmount: message.paymentData?.amount || message.paymentData?.totalAmount || 0,
              currency: message.paymentData?.currency || 'GBP',
              pickupCode: message.paymentData?.pickupCode,
              paymentMethod: message.paymentData?.paymentMethod,
              deliveryType: message.paymentData?.deliveryType || message.orderData?.deliveryType,
              paymentType: message.paymentData?.paymentType || message.orderData?.paymentType,
              timestamp: message.timestamp,
              storeName: message.receiverName,
              storeId: message.receiverId,
              status: 'paid'
            };
            
            if (existingOrderIndex >= 0) {
              // Update existing order only if current status is not already completed
              if (customerOrders[existingOrderIndex].status !== 'collected') {
                customerOrders[existingOrderIndex] = orderData;
              }
            } else {
              customerOrders.push(orderData);
            }
          }
          
          // If this user placed an order request OR it's a completed pay at store order
          if ((message.messageType === 'order_request' || message.messageType === 'pay_at_store_completed') && message.senderId === authUser.uid) {
            const orderId = message.orderData?.orderId;
            
            // Check if we already have this order
            const existingOrderIndex = customerOrders.findIndex(o => o.orderId === orderId);
            
            const orderData = {
              id: doc.id,
              orderId: orderId,
              items: message.orderData?.items || [],
              totalAmount: message.orderData?.totalAmount || 0,
              currency: message.orderData?.currency || 'GBP',
              pickupCode: message.orderData?.pickupCode,
              paymentMethod: 'Pay at Store',
              deliveryType: message.orderData?.deliveryType,
              paymentType: 'Other',
              timestamp: message.timestamp,
              storeName: message.receiverName,
              storeId: message.receiverId,
              status: message.messageType === 'pay_at_store_completed' ? 'collected' : 'ordered',
              collectedAt: message.messageType === 'pay_at_store_completed' ? (message.orderData?.collectedAt || message.timestamp) : null
            };
            
            if (existingOrderIndex >= 0) {
              // Always prioritize completed status over pending/ordered
              if (message.messageType === 'pay_at_store_completed' || customerOrders[existingOrderIndex].status !== 'collected') {
                customerOrders[existingOrderIndex] = orderData;
              }
            } else {
              customerOrders.push(orderData);
            }
          }
        });
        
        // Check orders collection for the most current status
        for (const order of customerOrders) {
          if (order.orderId) {
            try {
              const orderDoc = await getDoc(doc(db, 'orders', order.orderId));
              if (orderDoc.exists()) {
                const orderData = orderDoc.data();
                if (orderData.status) {
                  order.status = orderData.status;
                  if (orderData.deliveredAt) {
                    order.deliveredAt = orderData.deliveredAt;
                  }
                }
              }
            } catch (error) {
              console.log('Error fetching order status:', error);
            }
          }
        }

        // Also check for delivery and collection status updates in messages (fallback)
        const statusQuery = query(collection(db, 'messages'));
        const statusSnapshot = await getDocs(statusQuery);
        
        statusSnapshot.docs.forEach(doc => {
          const message = doc.data();
          if (message.messageType === 'delivery_completed' && message.receiverId === authUser.uid) {
            // Find the corresponding order and update its status
            const order = customerOrders.find(o => o.orderId === message.orderData?.orderId);
            if (order && order.status !== 'delivered') {
              order.status = 'delivered';
              order.deliveredAt = message.timestamp;
            }
          } else if (message.messageType === 'delivery_started' && message.receiverId === authUser.uid) {
            const order = customerOrders.find(o => o.orderId === message.orderData?.orderId);
            if (order && (order.status === 'paid' || order.status === 'ordered')) {
              order.status = 'in_delivery';
              order.deliveryStartedAt = message.timestamp;
            }
          } else if (message.messageType === 'collection_completed' && message.receiverId === authUser.uid) {
            // Find the corresponding order and update its status for collection orders (NOT Pay at Store)
            const order = customerOrders.find(o => o.orderId === message.orderData?.orderId);
            if (order && order.status !== 'collected' && order.paymentType !== 'Other') {
              // Only mark as collected if it's NOT a Pay at Store order
              order.status = 'collected';
              order.collectedAt = message.timestamp;
            }
          } else if (message.messageType === 'pay_at_store_completed' && message.receiverId === authUser.uid) {
            // Find the corresponding Pay at Store order and mark as collected only after seller validation
            const order = customerOrders.find(o => o.orderId === message.orderData?.orderId);
            if (order && order.status !== 'collected') {
              order.status = 'collected';
              order.collectedAt = message.timestamp;
              order.paymentValidated = true; // Mark that payment was validated at store
            }
          } else if (message.messageType === 'collection_ready' && message.receiverId === authUser.uid) {
            const order = customerOrders.find(o => o.orderId === message.orderData?.orderId);
            if (order && (order.status === 'paid' || order.status === 'ordered' || order.status === 'pending')) {
              order.status = 'ready_for_collection';
              order.readyForCollectionAt = message.timestamp;
            }
          } else if (message.messageType === 'order_confirmed_collection' && message.receiverId === authUser.uid) {
            const order = customerOrders.find(o => o.orderId === message.orderData?.orderId);
            if (order && order.status === 'ordered') {
              order.status = 'pending';
              order.confirmedAt = message.timestamp;
            }
          } else if (message.messageType === 'order_cancelled' && message.receiverId === authUser.uid) {
            const order = customerOrders.find(o => o.orderId === message.orderData?.orderId);
            if (order) {
              order.status = 'cancelled';
              order.cancelledAt = message.timestamp;
            }
          } else if ((message.messageType === 'refund_request' || message.messageType === 'order_cancelled_refund') && message.senderId === authUser.uid) {
            // Customer cancelled their own order
            const order = customerOrders.find(o => o.orderId === message.orderData?.orderId);
            if (order) {
              order.status = 'cancelled';
              order.cancelledAt = message.timestamp;
            }
          } else if (message.messageType === 'refund_approved' && (message.receiverId === authUser.uid || message.senderId === authUser.uid)) {
            // Refund was approved - mark as cancelled and refunded
            const orderId = message.orderData?.orderId || message.refundData?.orderId;
            const order = customerOrders.find(o => o.orderId === orderId);
            if (order) {
              order.status = 'cancelled_and_refunded';
              order.refundedAt = message.timestamp;
              order.cancelledAt = order.cancelledAt || message.timestamp;
            }
          } else if (message.messageType === 'refund_denied' && (message.receiverId === authUser.uid || message.senderId === authUser.uid)) {
            // Refund was denied - ensure it's marked as cancelled
            const orderId = message.orderData?.orderId || message.refundData?.orderId;
            const order = customerOrders.find(o => o.orderId === orderId);
            if (order) {
              order.status = 'cancelled';
              order.cancelledAt = order.cancelledAt || message.timestamp;
            }
          } else if (message.messageType === 'manual_refund_notice' || message.messageType === 'refund_transfer_confirmed') {
            // Manual refund was processed
            const orderId = message.orderData?.orderId || message.refundData?.orderId;
            const order = customerOrders.find(o => o.orderId === orderId);
            if (order) {
              order.status = 'cancelled_and_refunded';
              order.refundedAt = message.timestamp;
              order.cancelledAt = order.cancelledAt || message.timestamp;
            }
          }
        });
        
        // Sort orders by timestamp (newest first)
        customerOrders.sort((a, b) => {
          const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
          return bTime - aTime;
        });
        
        setOrders(customerOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
      }
      setOrdersLoading(false);
    };

    fetchOrders();
  }, [authUser, activeTab]);

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8' }}>
        
        {/* Profile Header Section */}
        <div style={{ padding: '2rem', textAlign: 'center', borderBottom: '1px solid #eee' }}>
          <h2 style={{ color: '#1C1C1C', marginBottom: '1.5rem' }}>Your Profile</h2>
          {authUser === undefined || loading ? (
            <div style={{ color: '#888', margin: '2rem 0' }}>Loading...</div>
          ) : error ? (
            <div style={{ color: 'red', margin: '2rem 0' }}>{`Error loading profile: ${error}`}</div>
          ) : (
            <>
              {photoURL ? (
                <img src={photoURL} alt="profile" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 20 }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#eee', margin: '0 auto 20px' }} />
              )}
              <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 10 }}>{name || 'No name set'}</div>
              <div style={{ color: '#888', fontSize: '1rem', marginBottom: 20 }}>{location || 'No location set'}</div>
              
              {/* Button container */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
                  onClick={() => navigate('/messages')}
                >
                  Messages
                </button>
                <button
                  style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
                  onClick={handleEditProfile}
                >
                  Edit Profile
                </button>
              </div>
            </>
          )}
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '2px solid #eee' }}>
          {[
            { key: 'following', label: 'Following' },
            { key: 'viewed', label: 'Recently Viewed' },
            { key: 'orders', label: 'Orders' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '1rem 0.5rem',
                background: activeTab === tab.key ? '#F9F5EE' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #007B7F' : '2px solid transparent',
                color: activeTab === tab.key ? '#007B7F' : '#888',
                fontWeight: activeTab === tab.key ? 700 : 500,
                fontSize: '0.95rem',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ padding: '2rem' }}>
          {activeTab === 'following' && (
            <div>
              <h3 style={{ color: '#007B7F', marginBottom: '1rem' }}>Following Stores</h3>
              {followingLoading ? (
                <div style={{ color: '#888', textAlign: 'center' }}>Loading...</div>
              ) : followingStores.length === 0 ? (
                <div style={{ color: '#888', textAlign: 'center' }}>You are not following any stores yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {followingStores.map(store => (
                    <div 
                      key={store.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 12, 
                        padding: 16,
                        border: '1px solid #eee',
                        borderRadius: 8,
                        background: '#fafafa',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => navigate(`/store-preview/${store.id}`)}
                      onMouseEnter={e => e.target.style.background = '#f0f0f0'}
                      onMouseLeave={e => e.target.style.background = '#fafafa'}
                    >
                      <img 
                        src={store.backgroundImg || 'https://via.placeholder.com/50'} 
                        alt={store.storeName} 
                        style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} 
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{store.storeName}</div>
                        <div style={{ color: '#666', fontSize: '0.9rem' }}>{store.storeLocation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'viewed' && (
            <div>
              <h3 style={{ color: '#007B7F', marginBottom: '1rem' }}>Recently Viewed Stores</h3>
              {viewedLoading ? (
                <div style={{ color: '#888', textAlign: 'center' }}>Loading...</div>
              ) : viewedStores.length === 0 ? (
                <div style={{ color: '#888', textAlign: 'center' }}>You haven't viewed any stores yet.</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                    {viewedStores.map(store => (
                      <div 
                        key={store.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 12, 
                          padding: 16,
                          border: '1px solid #eee',
                          borderRadius: 8,
                          background: '#fafafa',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onClick={() => navigate(`/store-preview/${store.id}`)}
                        onMouseEnter={e => e.target.style.background = '#f0f0f0'}
                        onMouseLeave={e => e.target.style.background = '#fafafa'}
                      >
                        <img 
                          src={store.backgroundImg || 'https://via.placeholder.com/50'} 
                          alt={store.storeName} 
                          style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} 
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{store.storeName}</div>
                          <div style={{ color: '#666', fontSize: '0.9rem' }}>{store.storeLocation}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      localStorage.removeItem(`viewedStores_${authUser.uid}`);
                      setViewedStores([]);
                    }}
                    style={{
                      background: '#ff4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '0.5rem 1rem',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'block',
                      margin: '0 auto'
                    }}
                  >
                    Clear History
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              <h3 style={{ color: '#007B7F', marginBottom: '1rem' }}>Order History</h3>
              {ordersLoading ? (
                <div style={{ textAlign: 'center', color: '#888' }}>Loading orders...</div>
              ) : orders.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888' }}>No orders found.</div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {orders.map(order => {
                    const formatDate = (timestamp) => {
                      if (!timestamp) return 'Unknown date';
                      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
                      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    };

                    const getStatusColor = (status) => {
                      switch (status) {
                        case 'delivered': return '#22C55E';
                        case 'collected': return '#22C55E';
                        case 'in_delivery': return '#3B82F6';
                        case 'ready_for_collection': return '#3B82F6';
                        case 'paid': return '#F59E0B';
                        case 'ordered': return '#F59E0B';
                        case 'pending': return '#F59E0B';
                        case 'cancelled': return '#EF4444';
                        case 'cancelled_and_refunded': return '#8B5CF6'; // Purple for refunded status
                        default: return '#6B7280';
                      }
                    };

                    const getStatusText = (status) => {
                      switch (status) {
                        case 'delivered': return '✅ Delivered';
                        case 'collected': return '✅ Collected';
                        case 'in_delivery': return '🚚 In Delivery';
                        case 'ready_for_collection': return '📦 Ready for Collection';
                        case 'paid': return '💳 Paid';
                        case 'ordered': return '📝 Ordered';
                        case 'pending': return '⏳ Pending';
                        case 'cancelled': return '❌ Cancelled';
                        case 'cancelled_and_refunded': return '💰 Cancelled & Refunded';
                        default: return '📦 Processing';
                      }
                    };

                    const formatPrice = (price, currency) => {
                      const currencySymbols = { GBP: "£", USD: "$", EUR: "€", NGN: "₦" };
                      const symbol = currencySymbols[currency] || currency;
                      const currenciesWithDecimals = ["GBP", "USD", "EUR"];
                      return currenciesWithDecimals.includes(currency) 
                        ? `${symbol}${Number(price).toFixed(2)}`
                        : `${symbol}${price}`;
                    };

                    return (
                      <div 
                        key={order.id}
                        style={{
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          padding: '1rem',
                          background: '#fff'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <h4 style={{ margin: '0 0 0.25rem 0', color: '#111827', fontSize: '1rem' }}>
                              Order #{order.orderId?.slice(-8) || 'Unknown'}
                            </h4>
                            <p style={{ margin: '0', color: '#6B7280', fontSize: '0.875rem' }}>
                              {order.storeName || 'Unknown Store'}
                            </p>
                          </div>
                          <span 
                            style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: '#fff',
                              background: getStatusColor(order.status)
                            }}
                          >
                            {getStatusText(order.status)}
                          </span>
                        </div>

                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                            Items: {order.items?.length || 0}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                            Total: {formatPrice(order.totalAmount, order.currency)}
                          </div>
                          {order.deliveryType && (
                            <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                              Type: {order.deliveryType === 'Collection' ? '🏪 Collection' : '🚚 Delivery'}
                              {order.paymentType === 'Other' && order.deliveryType === 'Collection' && ' (Pay at Store)'}
                            </div>
                          )}
                          <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                            Ordered: {formatDate(order.timestamp)}
                          </div>
                          {order.deliveredAt && (
                            <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                              Delivered: {formatDate(order.deliveredAt)}
                            </div>
                          )}
                          {order.collectedAt && (
                            <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                              Collected: {formatDate(order.collectedAt)}
                            </div>
                          )}
                          {order.readyForCollectionAt && !order.collectedAt && (
                            <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                              Ready Since: {formatDate(order.readyForCollectionAt)}
                            </div>
                          )}
                          {order.confirmedAt && (
                            <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                              Confirmed: {formatDate(order.confirmedAt)}
                            </div>
                          )}
                          {order.cancelledAt && (
                            <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                              Cancelled: {formatDate(order.cancelledAt)}
                            </div>
                          )}
                          {/* Only show pickup code to the buyer (not the seller) */}
                          {order.pickupCode && order.customerId === authUser?.uid && (
                            <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                              Pickup Code: <span style={{ fontWeight: '600', color: '#007B7F' }}>{order.pickupCode}</span>
                            </div>
                          )}
                        </div>

                        {order.items && order.items.length > 0 && (
                          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '0.75rem' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                              Items:
                            </div>
                            {order.items.slice(0, 3).map((item, index) => (
                              <div key={index} style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                                • {item.name || item.itemName} x{item.quantity} - {formatPrice(item.price * item.quantity, order.currency)}
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <div style={{ fontSize: '0.875rem', color: '#6B7280', fontStyle: 'italic' }}>
                                ... and {order.items.length - 3} more items
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


        </div>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px #0008', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: 8, right: 8, background: '#eee', border: 'none', borderRadius: '50%', width: 28, height: 28, fontSize: 18, cursor: 'pointer' }}>×</button>
            <h3 style={{ marginBottom: 18, color: '#007B7F' }}>Nearby Stores</h3>
            {storesLoading ? (
              <div style={{ color: '#888' }}>Loading stores...</div>
            ) : nearbyStores.length === 0 ? (
              <div style={{ color: '#888' }}>No stores found near your location.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {nearbyStores.map(store => (
                  <li key={store.id} style={{ marginBottom: 14, padding: 10, border: '1px solid #eee', borderRadius: 8, background: '#fafbfc', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>{store.storeName}</div>
                    <div style={{ color: '#888', fontSize: '0.95em' }}>{store.storeLocation}</div>
                    <button onClick={() => navigate(`/store-preview/${store.id}`)} style={{ marginTop: 6, background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.8rem', fontWeight: 600, cursor: 'pointer', fontSize: '1em' }}>View Store</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {/* Modal for following stores */}
      {showFollowingModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px #0008', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowFollowingModal(false)} style={{ position: 'absolute', top: 8, right: 8, background: '#eee', border: 'none', borderRadius: '50%', width: 28, height: 28, fontSize: 18, cursor: 'pointer' }}>×</button>
            <h3 style={{ marginBottom: 18, color: '#007B7F' }}>Following Stores</h3>
            {followingLoading ? (
              <div style={{ color: '#888' }}>Loading...</div>
            ) : followingStores.length === 0 ? (
              <div style={{ color: '#888' }}>You are not following any stores.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {followingStores.map(store => (
                  <li key={store.id} style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      onClick={() => { setShowFollowingModal(false); navigate(`/store-preview/${store.id}`); }}>
                    <img src={store.backgroundImg || 'https://via.placeholder.com/40'} alt={store.storeName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontWeight: 600 }}>{store.storeName}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw', textAlign: 'center', position: 'relative' }}>
            <h3 style={{ marginBottom: 18, color: '#007B7F' }}>Edit Profile</h3>
            <form onSubmit={handleEditSave}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600 }}>Name *</label><br />
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} required />
              </div>
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <label style={{ fontWeight: 600 }}>Location *</label><br />
                <input
                  type="text"
                  value={editLocation}
                  onChange={e => {
                    setEditLocation(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => setShowSuggestions(true)}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  required
                  autoComplete="off"
                />
                {showSuggestions && locationSuggestions.length > 0 && (
                  <ul style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 56,
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    maxHeight: 180,
                    overflowY: 'auto',
                    zIndex: 10,
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    boxShadow: '0 2px 8px #0002'
                  }}>
                    {locationSuggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        onMouseDown={() => {
                          setEditLocation(suggestion);
                          setShowSuggestions(false);
                        }}
                        style={{ cursor: 'pointer', padding: 8, borderBottom: idx !== locationSuggestions.length - 1 ? '1px solid #eee' : 'none', background: '#fff' }}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {editError && <div style={{ color: 'red', marginBottom: 12 }}>{editError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }} disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal for viewed stores */}
      {showViewedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, maxWidth: 400, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 2px 16px #0008', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowViewedModal(false)} style={{ position: 'absolute', top: 8, right: 8, background: '#eee', border: 'none', borderRadius: '50%', width: 28, height: 28, fontSize: 18, cursor: 'pointer' }}>×</button>
            <h3 style={{ marginBottom: 18, color: '#007B7F' }}>Recently Viewed Stores</h3>
            {viewedLoading ? (
              <div style={{ color: '#888' }}>Loading...</div>
            ) : viewedStores.length === 0 ? (
              <div style={{ color: '#888' }}>You haven't viewed any stores yet.</div>
            ) : (
              <>
                <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: 16 }}>
                  Click on any store to visit again
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {viewedStores.map(store => (
                    <li key={store.id} style={{ 
                      marginBottom: 14, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      cursor: 'pointer',
                      padding: 12,
                      border: '1px solid #eee',
                      borderRadius: 8,
                      background: '#fafafa',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => { 
                      setShowViewedModal(false); 
                      navigate(`/store-preview/${store.id}`); 
                    }}
                    onMouseEnter={e => e.target.style.background = '#f0f0f0'}
                    onMouseLeave={e => e.target.style.background = '#fafafa'}
                    >
                      <img 
                        src={store.backgroundImg || 'https://via.placeholder.com/40'} 
                        alt={store.storeName} 
                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} 
                      />
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{store.storeName}</div>
                        <div style={{ color: '#666', fontSize: '0.85rem' }}>{store.storeLocation}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    localStorage.removeItem(`viewedStores_${authUser.uid}`);
                    setViewedStores([]);
                  }}
                  style={{
                    marginTop: 16,
                    background: '#ff4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '0.5rem 1rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Clear History
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;