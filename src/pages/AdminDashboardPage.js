import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, getDocs, addDoc, serverTimestamp, where, limit } from 'firebase/firestore';
import { db } from '../firebase';

// Add pulse animation for online status
const pulseKeyframes = `
  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
`;

// Add the keyframes to the document
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
}

const StoreCard = ({ store, onClick }) => {
  return (
    <div 
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '1.5rem',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease-in-out',
        ':hover': {
          boxShadow: '0 8px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }
      }}
      onMouseEnter={(e) => {
        e.target.style.boxShadow = '0 8px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
      }}
      onMouseLeave={(e) => {
        e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
      }}
    >
      {/* Header with store name and status */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '1rem' 
      }}>
        <h3 style={{ 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          color: '#1F2937', 
          margin: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
          {store.storeName || 'Enoch\'s African Shop'}
        </h3>
        
        {/* Status badges */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}>
          {/* Active/Inactive Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#F3F4F6',
            color: store.isActive !== false ? '#10B981' : '#EF4444',
            padding: '0.375rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.875rem',
            fontWeight: '500',
            border: `1px solid ${store.isActive !== false ? '#D1FAE5' : '#FEE2E2'}`
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: store.isActive !== false ? '#10B981' : '#EF4444',
              marginRight: '0.5rem'
            }}></div>
            {store.isActive !== false ? 'Active' : 'Inactive'}
          </div>

          {/* Disabled Status */}
          {store.disabled && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              padding: '0.25rem 0.5rem',
              borderRadius: '16px',
              fontSize: '0.75rem',
              fontWeight: '600',
              border: '1px solid #FECACA'
            }}>
              <span style={{ marginRight: '0.25rem' }}>⏸️</span>
              DISABLED
            </div>
          )}

          {/* Deleted Status */}
          {store.deleted && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#1F2937',
              color: '#FFFFFF',
              padding: '0.25rem 0.5rem',
              borderRadius: '16px',
              fontSize: '0.75rem',
              fontWeight: '600',
              border: '1px solid #374151'
            }}>
              <span style={{ marginRight: '0.25rem' }}>🗑️</span>
              DELETED
            </div>
          )}
        </div>
      </div>

      {/* Category badge */}
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{
          backgroundColor: '#FEF3C7',
          color: '#92400E',
          padding: '0.25rem 0.75rem',
          borderRadius: '16px',
          fontSize: '0.875rem',
          fontWeight: '500',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
          {store.category || 'Foods & Goods'}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            color: '#1F2937', 
            marginBottom: '0.25rem'
          }}>
            {store.totalItems || 0}
          </div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: '#6B7280', 
            fontWeight: '500' 
          }}>
            Items
          </div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            color: '#1F2937', 
            marginBottom: '0.25rem'
          }}>
            {store.totalOrders || 0}
          </div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: '#6B7280', 
            fontWeight: '500' 
          }}>
            Orders
          </div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#1F2937', 
            marginBottom: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem'
          }}>
            <span style={{ color: '#FBBF24', fontSize: '1.25rem' }}>⭐</span>
            {store.rating?.toFixed(1) || '0.0'}
          </div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: '#6B7280', 
            fontWeight: '500' 
          }}>
            ({store.reviewCount || 0} reviews)
          </div>
        </div>
      </div>
    </div>
  );
};

function AdminDashboardPage() {
  const navigate = useNavigate();
  
  // Add a helper function to show comprehensive activity tracking requirements
  const showActivityTrackingInfo = () => {
    console.log(`
    📊 COMPREHENSIVE SELLER ACTIVITY TRACKING SYSTEM
    
    Current Implementation: ✅ Enhanced activity tracking from 7+ data sources
    
    🔍 CURRENTLY TRACKING FROM:
    1. User Sessions (login/logout events)
    2. Real-time Presence (online status)  
    3. Message Interactions (sent/received)
    4. Transaction Activity (orders placed)
    5. Item Management (products added/updated)
    6. Review Responses (customer service)
    7. Store Profile Updates (business changes)
    
    🚀 PRODUCTION-READY ENHANCEMENTS RECOMMENDED:
    
    1. 🔐 Enhanced Session Management:
       - Add device fingerprinting
       - Track login methods (email, social, etc.)
       - Monitor suspicious login patterns
    
    2. 👁️ Real-Time Presence Heartbeat:
       - 30-second ping intervals
       - Page visibility API integration
       - Mobile app lifecycle tracking
    
    3. 📊 Advanced Analytics:
       - Session duration tracking
       - Page view analytics  
       - Feature usage patterns
    
    4. 🔔 Smart Notifications:
       - Inactive seller alerts
       - Activity spike detection
       - Engagement scoring
    
    Current system provides comprehensive multi-source activity monitoring!
    `);
  };
  
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  
  // Admin messaging states
  const [activeTab, setActiveTab] = useState('reports'); // 'reports', 'messages', 'stores', 'conversations'
  const [adminMessages, setAdminMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showMessagingModal, setShowMessagingModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Store search and filtering states
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);
  
  // New states for additional tabs
  const [liveStores, setLiveStores] = useState([]);
  const [sellerBuyerConversations, setSellerBuyerConversations] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  
  // Conversation search and filter states
  const [conversationSearchTerm, setConversationSearchTerm] = useState('');
  const [filteredConversations, setFilteredConversations] = useState([]);
  
  // Report filter states
  const [reportFilter, setReportFilter] = useState('all'); // 'all', 'store_report', 'post_report'
  
  // Buyer blocking states
  const [isBlockingBuyer, setIsBlockingBuyer] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [selectedBuyerToBlock, setSelectedBuyerToBlock] = useState(null);
  const [blockDurationDays, setBlockDurationDays] = useState(5); // Default to 5 days

  useEffect(() => {
    // Show activity tracking system info
    showActivityTrackingInfo();
    
    // Clean up expired blocks
    cleanupExpiredBlocks();
    
    // Check if user is admin
    const checkAdminAuth = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        navigate('/admin-login');
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        if (!adminDoc.exists()) {
          navigate('/admin-login');
          return;
        }
      } catch (error) {
        console.error('Admin auth check error:', error);
        navigate('/admin-login');
        return;
      }

      // If admin is verified, load complaints
      loadComplaints();
    };

    checkAdminAuth();
  }, [navigate]);

  const loadComplaints = () => {
    const complaintsQuery = query(
      collection(db, 'admin_complaints'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(complaintsQuery, (snapshot) => {
      const complaintsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComplaints(complaintsData);
      setLoading(false);
    });

    return unsubscribe;
  };

  const handleStatusUpdate = async (complaintId, newStatus) => {
    setUpdateLoading(true);
    try {
      await updateDoc(doc(db, 'admin_complaints', complaintId), {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setComplaints(prev => prev.map(complaint => 
        complaint.id === complaintId 
          ? { ...complaint, status: newStatus }
          : complaint
      ));

      setShowModal(false);
      setSelectedComplaint(null);
    } catch (error) {
      console.error('Error updating complaint status:', error);
      alert('Error updating complaint status');
    }
    setUpdateLoading(false);
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      navigate('/admin-login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Load admin messages function - only shows messages from help center or store preview help requests
  const loadAdminMessages = () => {
    console.log('Loading admin messages...');
    const messagesQuery = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      console.log('Received messages snapshot with', snapshot.docs.length, 'documents');
      const messagesData = {};
      
      for (const doc of snapshot.docs) {
        const message = { id: doc.id, ...doc.data() };
        
        // Process only help center messages and store preview help requests
        let isAdminRelevant = false;
        let conversationId = message.conversationId;
        let userId, userName, userEmail;
        
        // 1. Check if this is a message from help center support system
        // Help center messages have messageType 'support_request' or come from the help center form
        if (message.messageType === 'support_request' || 
            (message.supportData && message.supportData.subject) ||
            (message.message && message.message.includes('Submitted from: Help Center'))) {
          isAdminRelevant = true;
          
          // Determine user info - the user is whoever is NOT admin
          if (message.senderId === 'admin') {
            userId = message.receiverId;
            userName = message.receiverName;
            userEmail = message.receiverEmail;
          } else {
            userId = message.senderId;
            userName = message.senderName;
            userEmail = message.senderEmail;
          }
        }
        
        // 2. Check if this is a message from store preview page help request
        // These messages are sent through handleContactAdmin or handleSubmitReport
        else if (message.conversationId?.startsWith('admin_') && 
                (message.isAdminConversation || 
                message.message?.includes('store preview'))) {
          isAdminRelevant = true;
          
          // Determine user info - the user is whoever is NOT admin
          if (message.senderId === 'admin') {
            userId = message.receiverId;
            userName = message.receiverName;
            userEmail = message.receiverEmail;
          } else {
            userId = message.senderId;
            userName = message.senderName;
            userEmail = message.senderEmail;
          }
        }
        
        if (!isAdminRelevant) continue;
        
        // Get additional user information if available
        try {
          if (userId && (!userName || userName === 'Unknown User')) {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              userName = userData.name || userData.displayName || userData.username || userName || 'Unknown User';
              userEmail = userData.email || userEmail || 'Unknown Email';
            }
          }
        } catch (error) {
          console.warn('Could not fetch additional user details:', error);
        }
        
        if (!messagesData[conversationId]) {
          messagesData[conversationId] = {
            id: conversationId,
            userId: userId,
            userName: userName || 'Unknown User',
            userEmail: userEmail || 'Unknown Email',
            otherUserName: userName || 'Unknown User', // For UI compatibility
            otherUserEmail: userEmail || 'Unknown Email', // For UI compatibility
            lastMessage: message.message,
            lastMessageTime: message.timestamp,
            lastMessageSender: message.senderId === 'admin' ? 'admin' : 'user',
            unreadCount: 0,
            messages: [],
            isAutoFlagged: false, // No longer auto-flagging messages
            originalConversationId: message.conversationId, // Keep track of original conversation
            storeContext: null, // Will be populated if message relates to a store
            source: message.message?.includes('Submitted from: Help Center') ? 'help_center' : 'store_preview'
          };
          
          // Try to get store context if this relates to a store transaction
          if (message.receiverId && message.receiverId !== 'admin') {
            try {
              const storeDoc = await getDoc(doc(db, 'stores', message.receiverId));
              if (storeDoc.exists()) {
                messagesData[conversationId].storeContext = {
                  storeId: message.receiverId,
                  storeName: storeDoc.data().storeName || 'Unknown Store',
                  storeOwner: storeDoc.data().ownerName || 'Unknown Owner'
                };
              }
            } catch (error) {
              console.warn('Could not fetch store context:', error);
            }
          }
          
          // If there's a supportData object, add relevant context
          if (message.supportData) {
            messagesData[conversationId].supportData = message.supportData;
          }
        }
        
        // Update with most recent message info if this message is newer
        const messageTime = message.timestamp?.toMillis ? message.timestamp.toMillis() : Date.now();
        const currentLastTime = messagesData[conversationId].lastMessageTime?.toMillis ? 
          messagesData[conversationId].lastMessageTime.toMillis() : 0;
          
        if (messageTime > currentLastTime) {
          messagesData[conversationId].lastMessage = message.message;
          messagesData[conversationId].lastMessageTime = message.timestamp;
          messagesData[conversationId].lastMessageSender = message.senderId === 'admin' ? 'admin' : 'user';
        }
        
        // Count unread messages from users (not from admin)
        if (message.senderId !== 'admin' && !message.isRead) {
          messagesData[conversationId].unreadCount++;
        }
        
        messagesData[conversationId].messages.push(message);
      }
      
      // Convert to array and sort by last message time
      const conversationsArray = Object.values(messagesData).sort((a, b) => {
        const aTime = a.lastMessageTime?.toMillis ? a.lastMessageTime.toMillis() : 0;
        const bTime = b.lastMessageTime?.toMillis ? b.lastMessageTime.toMillis() : 0;
        return bTime - aTime;
      });
      
      console.log('Final admin conversations:', conversationsArray);
      setAdminMessages(conversationsArray);
    }, (error) => {
      console.error('Error in admin messages query:', error);
    });

    return unsubscribe;
  };

  // Send admin message function
  const handleSendAdminMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;
    
    setSendingMessage(true);
    try {
      // Add message to the messages collection
      await addDoc(collection(db, 'messages'), {
        conversationId: selectedConversation.id,
        senderId: 'admin',
        senderName: 'Lokal Admin Support',
        senderEmail: 'admin@lokal.com',
        receiverId: selectedConversation.userId,
        receiverName: selectedConversation.userName,
        receiverEmail: selectedConversation.userEmail,
        message: messageText.trim(),
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'text',
        isAdminMessage: true
      });

      setMessageText('');
      setShowMessagingModal(false);
    } catch (error) {
      console.error('Error sending admin message:', error);
      alert('Failed to send message. Please try again.');
    }
    setSendingMessage(false);
  };

  // Buyer blocking functions
  const handleBlockBuyer = async () => {
    if (!selectedBuyerToBlock || !blockReason.trim()) {
      alert('Please provide a reason for blocking this buyer.');
      return;
    }

    setIsBlockingBuyer(true);
    try {
      const blockDurationMs = blockDurationDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      const blockUntil = new Date(Date.now() + blockDurationMs);

      // Create blocked user entry
      await addDoc(collection(db, 'blocked_users'), {
        buyerId: selectedBuyerToBlock.buyerId,
        buyerName: selectedBuyerToBlock.buyerName,
        buyerEmail: selectedBuyerToBlock.buyerEmail,
        sellerId: selectedBuyerToBlock.sellerId,
        sellerName: selectedBuyerToBlock.sellerName,
        storeName: selectedBuyerToBlock.storeName,
        reason: blockReason,
        blockedAt: serverTimestamp(),
        blockedUntil: blockUntil,
        blockedBy: 'admin',
        conversationId: selectedBuyerToBlock.conversationId,
        blockDurationDays: blockDurationDays,
        isActive: true
      });

      // Send automated abuse warning message to the conversation
      const abuseMessage = `⚠️ ADMIN NOTICE: This buyer has been temporarily blocked from communicating with ${selectedBuyerToBlock.sellerName} at ${selectedBuyerToBlock.storeName} for ${blockDurationDays} days due to: ${blockReason}\n\nThis action was taken to protect our sellers from inappropriate behavior. The buyer will be able to resume communication after the block period expires.\n\nIf you believe this action was taken in error, please contact support.`;
      
      await addDoc(collection(db, 'messages'), {
        conversationId: selectedBuyerToBlock.conversationId,
        senderId: 'admin',
        senderName: 'Admin Support',
        senderEmail: 'admin@lokal.com',
        receiverId: selectedBuyerToBlock.buyerId,
        receiverName: selectedBuyerToBlock.buyerName,
        receiverEmail: selectedBuyerToBlock.buyerEmail,
        message: abuseMessage,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'admin_warning',
        isAdminMessage: true,
        blockNotice: true
      });

      // Also notify the seller about the action taken
      const sellerNotification = `🛡️ ADMIN ACTION: We have temporarily blocked the buyer "${selectedBuyerToBlock.buyerName}" from communicating with you at ${selectedBuyerToBlock.storeName} for ${blockDurationDays} days due to: ${blockReason}\n\nYour safety and comfort are our priority. The buyer will not be able to send you messages during this period.`;
      
      await addDoc(collection(db, 'messages'), {
        conversationId: selectedBuyerToBlock.conversationId,
        senderId: 'admin',
        senderName: 'Admin Support',
        senderEmail: 'admin@lokal.com',
        receiverId: selectedBuyerToBlock.sellerId,
        receiverName: selectedBuyerToBlock.sellerName,
        receiverEmail: selectedBuyerToBlock.sellerEmail || '',
        message: sellerNotification,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'admin_notification',
        isAdminMessage: true,
        protectionNotice: true
      });

      console.log(`Buyer ${selectedBuyerToBlock.buyerName} blocked successfully for ${blockDurationDays} days`);
      alert(`Buyer "${selectedBuyerToBlock.buyerName}" has been blocked for ${blockDurationDays} days. Automated messages have been sent to both parties.`);
      
      // Reset states
      setShowBlockConfirm(false);
      setBlockReason('');
      setSelectedBuyerToBlock(null);
      setShowMessagingModal(false);
      setSelectedConversation(null);
      setBlockDurationDays(5); // Reset to default
      
    } catch (error) {
      console.error('Error blocking buyer:', error);
      alert('Failed to block buyer. Please try again.');
    }
    setIsBlockingBuyer(false);
  };

  const initiateBlockBuyer = (conversation) => {
    if (!conversation.buyerData && !conversation.buyerId) {
      alert('Cannot block buyer - buyer information not available.');
      return;
    }

    console.log('Initiating block for conversation:', conversation);
    
    setSelectedBuyerToBlock({
      buyerId: conversation.buyerId || conversation.buyerData?.id,
      buyerName: conversation.buyerName || conversation.buyerData?.name,
      buyerEmail: conversation.buyerEmail || conversation.buyerData?.email,
      sellerId: conversation.sellerId || conversation.sellerData?.id,
      sellerName: conversation.sellerName || conversation.sellerData?.name,
      storeName: conversation.storeName || conversation.sellerData?.storeName || 'Unknown Store',
      conversationId: conversation.id
    });
    setShowBlockConfirm(true);
  };

  // Clean up expired blocks
  const cleanupExpiredBlocks = async () => {
    try {
      console.log('Cleaning up expired blocks...');
      const blockedUsersQuery = query(
        collection(db, 'blocked_users'),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(blockedUsersQuery);
      const now = new Date();
      
      for (const doc of snapshot.docs) {
        const blockData = doc.data();
        const blockUntil = new Date(blockData.blockedUntil);
        
        if (now >= blockUntil) {
          console.log(`Expiring block for user ${blockData.buyerName}`);
          await updateDoc(doc.ref, {
            isActive: false,
            expiredAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired blocks:', error);
    }
  };

  // Load live stores function - pull from same source as ExplorePage
  const loadLiveStores = () => {
    console.log('Loading live stores from stores collection...');
    setLoadingStores(true);
    
    // Simple query to match exactly what ExplorePage uses
    const liveStoresQuery = query(
      collection(db, 'stores'),
      where('live', '==', true)
    );

    const unsubscribe = onSnapshot(liveStoresQuery, async (snapshot) => {
      console.log('Received stores snapshot with', snapshot.docs.length, 'live stores');
      
      // Get stores data with user emails, reviews, and items
      const storesPromises = snapshot.docs.map(async (storeDoc) => {
        const storeData = { id: storeDoc.id, ...storeDoc.data() };
        
        // Fetch user email from users collection using ownerId or document id
        const userId = storeData.ownerId || storeDoc.id;
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            storeData.email = userData.email || 'No email found';
          } else {
            storeData.email = 'User not found';
          }
        } catch (error) {
          console.error('Error fetching user email for store:', storeDoc.id, error);
          storeData.email = 'Error loading email';
        }
        
        // Fetch reviews data
        try {
          const reviewsSnapshot = await getDocs(collection(db, 'stores', storeDoc.id, 'reviews'));
          const reviews = reviewsSnapshot.docs.map(reviewDoc => reviewDoc.data());
          
          if (reviews.length > 0) {
            // Calculate average rating
            const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
            const averageRating = totalRating / reviews.length;
            
            storeData.rating = averageRating;
            storeData.reviewCount = reviews.length;
          } else {
            storeData.rating = 0;
            storeData.reviewCount = 0;
          }
        } catch (error) {
          console.error('Error fetching reviews for store:', storeDoc.id, error);
          storeData.rating = 0;
          storeData.reviewCount = 0;
        }
        
        // Fetch items count and full items data for admin (like StorePreviewPage)
        try {
          const itemsSnapshot = await getDocs(collection(db, 'stores', storeDoc.id, 'items'));
          storeData.totalItems = itemsSnapshot.docs.length;
          // Store full items data for admin viewing (with images like in StorePreviewPage)
          storeData.storeItems = itemsSnapshot.docs.map(itemDoc => ({
            id: itemDoc.id,
            ...itemDoc.data()
          }));
        } catch (error) {
          console.error('Error fetching items for store:', storeDoc.id, error);
          storeData.totalItems = storeData.totalItems || 0;
          storeData.storeItems = [];
        }
        
        // Extract complete fee settings from wallet (like in MessagesPage)
        const feeSettings = storeData.feeSettings || {};
        storeData.deliveryFee = feeSettings.deliveryEnabled ? (parseFloat(feeSettings.deliveryFee) || 0) : 0;
        storeData.serviceFee = feeSettings.serviceFeeEnabled ? {
          type: feeSettings.serviceFeeType || 'percentage',
          rate: feeSettings.serviceFeeRate || 2.5,
          amount: feeSettings.serviceFeeAmount || 0,
          max: feeSettings.serviceFeeMax || 0
        } : null;
        storeData.freeDeliveryThreshold = feeSettings.freeDeliveryThreshold || 0;
        storeData.refundsEnabled = feeSettings.refundsEnabled !== false; // default to true
        
        // Calculate actual last active date from comprehensive seller activities
        try {
          const activityDates = [];
          
          // Check user sessions (login/logout tracking)
          const userSessionsQuery = query(
            collection(db, 'userSessions'),
            where('userId', '==', storeDoc.id),
            orderBy('timestamp', 'desc'),
            limit(1)
          );
          const sessionsSnapshot = await getDocs(userSessionsQuery);
          if (!sessionsSnapshot.empty) {
            const latestSession = sessionsSnapshot.docs[0].data();
            if (latestSession.timestamp) {
              activityDates.push(latestSession.timestamp.toDate());
            }
          }
          
          // Check user's online presence/heartbeat
          const userPresenceDoc = await getDoc(doc(db, 'userPresence', storeDoc.id));
          if (userPresenceDoc.exists()) {
            const presenceData = userPresenceDoc.data();
            if (presenceData.lastSeen) {
              const lastSeenDate = presenceData.lastSeen.toDate ? presenceData.lastSeen.toDate() : new Date(presenceData.lastSeen);
              activityDates.push(lastSeenDate);
            }
          }
          
          // Check recent messages sent by this seller (real-time interaction)
          const recentMessagesQuery = query(
            collection(db, 'messages'),
            where('senderId', '==', storeDoc.id),
            orderBy('timestamp', 'desc'),
            limit(1)
          );
          const recentMessagesSnapshot = await getDocs(recentMessagesQuery);
          if (!recentMessagesSnapshot.empty) {
            const latestMessage = recentMessagesSnapshot.docs[0].data();
            if (latestMessage.timestamp) {
              activityDates.push(latestMessage.timestamp.toDate());
            }
          }
          
          // Check recent transactions and wallet activities
          const recentTransactionsQuery = query(
            collection(db, 'transactions'),
            where('sellerId', '==', storeDoc.id),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const recentTransactionsSnapshot = await getDocs(recentTransactionsQuery);
          if (!recentTransactionsSnapshot.empty) {
            const latestTransaction = recentTransactionsSnapshot.docs[0].data();
            if (latestTransaction.createdAt) {
              activityDates.push(latestTransaction.createdAt.toDate());
            }
          }
          
          // Check store profile updates and changes
          if (storeData.lastUpdated) {
            const lastUpdatedDate = storeData.lastUpdated.toDate ? storeData.lastUpdated.toDate() : new Date(storeData.lastUpdated);
            activityDates.push(lastUpdatedDate);
          }
          
          // Check items collection for recent additions/updates
          const recentItemsQuery = query(
            collection(db, 'stores', storeDoc.id, 'items'),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const recentItemsSnapshot = await getDocs(recentItemsQuery);
          if (!recentItemsSnapshot.empty) {
            const latestItem = recentItemsSnapshot.docs[0].data();
            if (latestItem.createdAt) {
              const itemDate = latestItem.createdAt.toDate ? latestItem.createdAt.toDate() : new Date(latestItem.createdAt);
              activityDates.push(itemDate);
            }
            if (latestItem.updatedAt) {
              const itemUpdateDate = latestItem.updatedAt.toDate ? latestItem.updatedAt.toDate() : new Date(latestItem.updatedAt);
              activityDates.push(itemUpdateDate);
            }
          }
          
          // Check reviews received (seller engagement with reviews)
          const recentReviewsQuery = query(
            collection(db, 'stores', storeDoc.id, 'reviews'),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const recentReviewsSnapshot = await getDocs(recentReviewsQuery);
          if (!recentReviewsSnapshot.empty) {
            const latestReview = recentReviewsSnapshot.docs[0].data();
            if (latestReview.sellerResponse && latestReview.sellerResponseDate) {
              const responseDate = latestReview.sellerResponseDate.toDate ? latestReview.sellerResponseDate.toDate() : new Date(latestReview.sellerResponseDate);
              activityDates.push(responseDate);
            }
          }
          
          // Use original lastActive as fallback
          if (storeData.lastActive) {
            const originalLastActive = storeData.lastActive.toDate ? storeData.lastActive.toDate() : new Date(storeData.lastActive);
            activityDates.push(originalLastActive);
          }
          
          // Find the most recent activity date
          if (activityDates.length > 0) {
            const mostRecentActivity = new Date(Math.max(...activityDates.map(date => date.getTime())));
            storeData.calculatedLastActive = mostRecentActivity;
            
            // Also determine if user is currently online (within last 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            storeData.isCurrentlyOnline = mostRecentActivity > fiveMinutesAgo;
          } else {
            storeData.calculatedLastActive = null;
            storeData.isCurrentlyOnline = false;
          }
          
        } catch (error) {
          console.error('Error calculating comprehensive activity for store:', storeDoc.id, error);
          storeData.calculatedLastActive = storeData.lastActive ? 
            (storeData.lastActive.toDate ? storeData.lastActive.toDate() : new Date(storeData.lastActive)) : 
            null;
          storeData.isCurrentlyOnline = false;
        }
        
        return storeData;
      });
      
      const storesData = await Promise.all(storesPromises);
      
      console.log('Live stores loaded with emails and items:', storesData.length);
      setLiveStores(storesData);
      setLoadingStores(false);
    }, (error) => {
      console.error('Error loading stores:', error);
      setLoadingStores(false);
    });

    return unsubscribe;
  };

  // Load seller-buyer conversations function - enhanced with proper Firestore data fetching
  const loadSellerBuyerConversations = () => {
    console.log('Loading seller-buyer conversations with complete user data from Firestore...');
    setLoadingConversations(true);
    
    // Query all messages to build conversation summaries
    const messagesQuery = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      console.log('Received conversation messages with', snapshot.docs.length, 'total messages');
      const conversationsData = {};
      const processedUsers = new Map(); // Cache to avoid duplicate lookups
      
      for (const doc of snapshot.docs) {
        const message = { id: doc.id, ...doc.data() };
        
        // Debug: Log message structure for the first few messages
        if (snapshot.docs.indexOf(doc) < 3) {
          console.log('Sample message data:', {
            id: message.id,
            senderId: message.senderId,
            receiverId: message.receiverId,
            senderName: message.senderName,
            receiverName: message.receiverName,
            senderEmail: message.senderEmail,
            receiverEmail: message.receiverEmail,
            conversationId: message.conversationId,
            message: message.message?.substring(0, 50) + '...'
          });
        }
        
        // Skip admin conversations (focus on seller-buyer conversations)
        if (!message.conversationId || 
            message.conversationId.startsWith('admin_') ||
            message.isAdminMessage ||
            message.senderId === 'admin' ||
            message.receiverId === 'admin' ||
            !message.senderId ||
            !message.receiverId ||
            message.senderId === message.receiverId) {
          continue;
        }
        
        const conversationId = message.conversationId;
        
        if (!conversationsData[conversationId]) {
          conversationsData[conversationId] = {
            id: conversationId,
            participants: new Set(),
            sellerData: null,
            buyerData: null,
            lastMessage: message.message,
            lastMessageTime: message.timestamp,
            lastMessageSender: message.senderId,
            messageCount: 0,
            messages: []
          };
        }
        
        // Add participants
        conversationsData[conversationId].participants.add(message.senderId);
        conversationsData[conversationId].participants.add(message.receiverId);
        
        // Enhanced user identification with proper Firestore fetching
        const userIds = [message.senderId, message.receiverId];
        
        for (const userId of userIds) {
          if (!processedUsers.has(userId)) {
            try {
              console.log(`Fetching complete data for user: ${userId}`);
              
              // First, check if user is a seller (has a store)
              const storeDocRef = doc(db, 'stores', userId);
              const storeDoc = await getDoc(storeDocRef);
              
              if (storeDoc.exists()) {
                const storeData = storeDoc.data();
                console.log(`Found store data for ${userId}:`, storeData);
                console.log(`Available email fields:`, {
                  email: storeData.email,
                  ownerEmail: storeData.ownerEmail,
                  sellerEmail: storeData.sellerEmail,
                  contactEmail: storeData.contactEmail,
                  businessEmail: storeData.businessEmail
                });
                
                // Also fetch the user document for complete seller info
                let sellerName = storeData.ownerName || storeData.name || storeData.storeName;
                let sellerEmail = storeData.email || storeData.ownerEmail || storeData.sellerEmail || storeData.contactEmail || storeData.businessEmail;
                
                try {
                  const sellerUserDocRef = doc(db, 'users', userId);
                  const sellerUserDoc = await getDoc(sellerUserDocRef);
                  if (sellerUserDoc.exists()) {
                    const sellerUserData = sellerUserDoc.data();
                    console.log(`Found user data for seller ${userId}:`, sellerUserData);
                    console.log(`Available user email fields:`, {
                      email: sellerUserData.email,
                      userEmail: sellerUserData.userEmail,
                      contactEmail: sellerUserData.contactEmail
                    });
                    sellerName = sellerUserData.name || sellerUserData.firstName || sellerUserData.displayName || sellerName;
                    sellerEmail = sellerUserData.email || sellerUserData.userEmail || sellerUserData.contactEmail || sellerEmail;
                  } else {
                    // If no user document exists, try to get email from Firebase Auth user ID
                    console.log(`No user document found for ${userId}, checking if we can derive email from auth...`);
                    // Note: In a real app, you might want to store the auth user's email when they create their store
                    // For now, we'll just log this case
                  }
                } catch (userError) {
                  console.warn('Could not fetch user data for seller:', userError);
                }
                
                console.log(`Final seller data for ${userId}:`, { name: sellerName, email: sellerEmail });
                
                // If we still don't have email, try to get it from message data as last resort
                if (!sellerEmail || sellerEmail === 'No email provided') {
                  if (message.senderId === userId && message.senderEmail) {
                    sellerEmail = message.senderEmail;
                    console.log(`Using sender email from message: ${sellerEmail}`);
                  } else if (message.receiverId === userId && message.receiverEmail) {
                    sellerEmail = message.receiverEmail;
                    console.log(`Using receiver email from message: ${sellerEmail}`);
                  }
                }
                
                console.log(`Store data for ${userId}:`, storeData);
                console.log(`Store name fields: storeName="${storeData.storeName}", name="${storeData.name}", title="${storeData.title}"`);
                
                processedUsers.set(userId, {
                  type: 'seller',
                  id: userId,
                  name: sellerName || 'Unknown Seller',
                  email: sellerEmail || 'No email provided',
                  storeName: storeData.storeName || storeData.name || storeData.title || storeData.businessName || 'Store Name Not Found',
                  storeId: userId,
                  storeCategory: storeData.category || 'Uncategorized',
                  storeLocation: storeData.storeLocation || storeData.address || 'No location'
                });
              } else {
                // Check if user exists in users collection (buyer)
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  console.log(`Found buyer data for ${userId}:`, userData);
                  
                  processedUsers.set(userId, {
                    type: 'buyer',
                    id: userId,
                    name: userData.name || userData.firstName || userData.displayName || 'Unknown Buyer',
                    email: userData.email || 'No email provided',
                    phone: userData.phone || userData.phoneNumber || 'Not provided',
                    joinDate: userData.createdAt || userData.joinDate || null
                  });
                } else {
                  console.warn(`No user document found for ${userId}, using fallback data from message`);
                  // Enhanced fallback to message data if available
                  let fallbackName = 'Unknown User';
                  let fallbackEmail = 'No email available';
                  
                  // Try to extract user data from the current message
                  if (message.senderName && message.senderId === userId) {
                    fallbackName = message.senderName;
                    fallbackEmail = message.senderEmail || 'No email available';
                  } else if (message.receiverName && message.receiverId === userId) {
                    fallbackName = message.receiverName;
                    fallbackEmail = message.receiverEmail || 'No email available';
                  } else {
                    // Use userID as a last resort identifier
                    fallbackName = `User ${userId.substring(0, 8)}...`;
                  }
                  
                  processedUsers.set(userId, {
                    type: 'unknown',
                    id: userId,
                    name: fallbackName,
                    email: fallbackEmail,
                    noFirestoreData: true
                  });
                }
              }
            } catch (error) {
              console.error('Error fetching user data for:', userId, error);
              
              // Try to use fallback data from the message itself
              let fallbackName = 'Unknown User';
              let fallbackEmail = 'No email available';
              
              if (message.senderName && message.senderId === userId) {
                fallbackName = message.senderName;
                fallbackEmail = message.senderEmail || 'No email available';
              } else if (message.receiverName && message.receiverId === userId) {
                fallbackName = message.receiverName;
                fallbackEmail = message.receiverEmail || 'No email available';
              }
              
              processedUsers.set(userId, {
                type: 'unknown',
                id: userId,
                name: fallbackName,
                email: fallbackEmail,
                error: true
              });
            }
          }
        }
        
        // Assign seller and buyer based on processed data
        const senderData = processedUsers.get(message.senderId);
        const receiverData = processedUsers.get(message.receiverId);
        
        // Prioritize actual seller (has store) over unknown type
        if (senderData?.type === 'seller' && !conversationsData[conversationId].sellerData) {
          conversationsData[conversationId].sellerData = senderData;
          console.log(`Assigned sender as seller for conversation ${conversationId}`);
        } else if (receiverData?.type === 'seller' && !conversationsData[conversationId].sellerData) {
          conversationsData[conversationId].sellerData = receiverData;
          console.log(`Assigned receiver as seller for conversation ${conversationId}`);
        }
        
        // Assign buyer (non-seller)
        if (senderData?.type === 'buyer' && !conversationsData[conversationId].buyerData) {
          conversationsData[conversationId].buyerData = senderData;
          console.log(`Assigned sender as buyer for conversation ${conversationId}`);
        } else if (receiverData?.type === 'buyer' && !conversationsData[conversationId].buyerData) {
          conversationsData[conversationId].buyerData = receiverData;
          console.log(`Assigned receiver as buyer for conversation ${conversationId}`);
        }
        
        // If we still don't have clear seller/buyer assignment, make best guess
        if (!conversationsData[conversationId].sellerData && !conversationsData[conversationId].buyerData) {
          if (senderData && receiverData) {
            // Assign based on available information
            if (senderData.storeName || senderData.type === 'seller') {
              conversationsData[conversationId].sellerData = senderData;
              conversationsData[conversationId].buyerData = receiverData;
            } else if (receiverData.storeName || receiverData.type === 'seller') {
              conversationsData[conversationId].sellerData = receiverData;
              conversationsData[conversationId].buyerData = senderData;
            } else {
              // Assign arbitrarily if we can't determine roles, avoiding error types
              conversationsData[conversationId].sellerData = (senderData && !senderData.error) ? senderData : receiverData;
              conversationsData[conversationId].buyerData = (senderData && !senderData.error) ? receiverData : senderData;
            }
          }
        } else if (conversationsData[conversationId].sellerData && !conversationsData[conversationId].buyerData) {
          // We have seller, assign the other as buyer
          const sellerId = conversationsData[conversationId].sellerData.id;
          if (senderData && senderData.id !== sellerId) {
            conversationsData[conversationId].buyerData = senderData;
          } else if (receiverData && receiverData.id !== sellerId) {
            conversationsData[conversationId].buyerData = receiverData;
          }
        } else if (!conversationsData[conversationId].sellerData && conversationsData[conversationId].buyerData) {
          // We have buyer, assign the other as seller
          const buyerId = conversationsData[conversationId].buyerData.id;
          if (senderData && senderData.id !== buyerId) {
            conversationsData[conversationId].sellerData = senderData;
          } else if (receiverData && receiverData.id !== buyerId) {
            conversationsData[conversationId].sellerData = receiverData;
          }
        }
        
        // Update with most recent message info
        const messageTime = message.timestamp?.toMillis ? message.timestamp.toMillis() : Date.now();
        const currentLastTime = conversationsData[conversationId].lastMessageTime?.toMillis ? 
          conversationsData[conversationId].lastMessageTime.toMillis() : 0;
          
        if (messageTime > currentLastTime) {
          conversationsData[conversationId].lastMessage = message.message;
          conversationsData[conversationId].lastMessageTime = message.timestamp;
          conversationsData[conversationId].lastMessageSender = message.senderId;
        }
        
        conversationsData[conversationId].messageCount++;
        conversationsData[conversationId].messages.push(message);
      }
      
      // Convert to array and filter for valid seller-buyer conversations
      const conversationsArray = Object.values(conversationsData)
        .filter(conv => {
          // Ensure we have both participants and at least one message
          const hasValidData = conv.sellerData && conv.buyerData && 
                              conv.sellerData.id !== conv.buyerData.id && 
                              conv.messageCount > 0;
                              
          if (hasValidData) {
            console.log(`Valid conversation found: ${conv.sellerData.name} (${conv.sellerData.storeName}) ↔ ${conv.buyerData.name}`);
          }
          
          return hasValidData;
        })
        .map(conv => ({
          ...conv,
          // Format for display with complete Firestore data
          sellerId: conv.sellerData.id,
          sellerName: conv.sellerData.name,
          sellerEmail: conv.sellerData.email, 
          storeName: conv.sellerData.storeName || conv.sellerData.name || conv.sellerData.title || conv.sellerData.businessName || 'Unknown Store', 
          storeId: conv.sellerData.storeId || conv.sellerData.id,
          storeCategory: conv.sellerData.storeCategory,
          storeLocation: conv.sellerData.storeLocation,
          buyerId: conv.buyerData.id,
          buyerName: conv.buyerData.name,
          buyerEmail: conv.buyerData.email,
          buyerPhone: conv.buyerData.phone,
          buyerJoinDate: conv.buyerData.joinDate
        }))
        .sort((a, b) => {
          const aTime = a.lastMessageTime?.toMillis ? a.lastMessageTime.toMillis() : 0;
          const bTime = b.lastMessageTime?.toMillis ? b.lastMessageTime.toMillis() : 0;
          return bTime - aTime;
        });
      
      console.log('Enhanced seller-buyer conversations loaded with complete Firestore data:', conversationsArray.length);
      console.log('Sample conversation data:', conversationsArray[0]);
      setSellerBuyerConversations(conversationsArray);
      setLoadingConversations(false);
    }, (error) => {
      console.error('Error loading seller-buyer conversations:', error);
      setLoadingConversations(false);
    });

    return unsubscribe;
  };

  // Load data when tab changes
  useEffect(() => {
    console.log('Admin Dashboard useEffect - activeTab:', activeTab);
    let unsubscribe;
    
    switch (activeTab) {
      case 'messages':
        console.log('Loading admin messages because tab is messages');
        unsubscribe = loadAdminMessages();
        break;
      case 'stores':
        console.log('Loading live stores because tab is stores');
        unsubscribe = loadLiveStores();
        break;
      case 'conversations':
        console.log('Loading seller-buyer conversations because tab is conversations');
        unsubscribe = loadSellerBuyerConversations();
        break;
      default:
        break;
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeTab]);

  // Also load admin messages on component mount to ensure they're available
  useEffect(() => {
    console.log('Admin Dashboard mounted, loading admin messages');
    const unsubscribe = loadAdminMessages();
    return () => unsubscribe();
  }, []);

  // Filter stores based on search term and category
  useEffect(() => {
    let filtered = [...liveStores];
    
    // Filter by search term (store name, email, address)
    if (storeSearchTerm.trim()) {
      const searchLower = storeSearchTerm.toLowerCase();
      filtered = filtered.filter(store => 
        (store.storeName && store.storeName.toLowerCase().includes(searchLower)) ||
        (store.email && store.email.toLowerCase().includes(searchLower)) ||
        (store.storeLocation && store.storeLocation.toLowerCase().includes(searchLower)) ||
        (store.storeAddress && store.storeAddress.toLowerCase().includes(searchLower)) ||
        (store.address && store.address.toLowerCase().includes(searchLower)) ||
        (store.businessId && store.businessId.toLowerCase().includes(searchLower))
      );
    }
    
    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(store => 
        store.category && store.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    setFilteredStores(filtered);
  }, [liveStores, storeSearchTerm, selectedCategory]);

  // Filter conversations based on search term
  useEffect(() => {
    let filtered = sellerBuyerConversations;
    
    // Filter by search term
    if (conversationSearchTerm.trim()) {
      const searchLower = conversationSearchTerm.toLowerCase();
      filtered = filtered.filter(conversation => 
        conversation.sellerName?.toLowerCase().includes(searchLower) ||
        conversation.buyerName?.toLowerCase().includes(searchLower) ||
        conversation.storeName?.toLowerCase().includes(searchLower) ||
        conversation.sellerEmail?.toLowerCase().includes(searchLower) ||
        conversation.buyerEmail?.toLowerCase().includes(searchLower) ||
        conversation.lastMessage?.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredConversations(filtered);
  }, [sellerBuyerConversations, conversationSearchTerm]);

  useEffect(() => {
    const unsubscribe = loadAdminMessages();
    return () => unsubscribe && unsubscribe();
  }, []);

  // Predefined categories (consistent with ExplorePage and other components)
  const ALL_CATEGORIES = [
    'Foods & Goods',
    'Meat & Poultry',
    'Wholesale',
    'Beauty & Hair',
  ];

  // Get unique categories from stores, merged with predefined categories
  const getUniqueCategories = () => {
    // Get categories from actual stores
    const storeCategories = liveStores
      .map(store => store.category)
      .filter(category => category && category.trim() !== '')
      .map(category => category.trim());
    
    // Merge with predefined categories and remove duplicates
    const allCategories = [...new Set([...ALL_CATEGORIES, ...storeCategories])];
    
    return allCategories.sort();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_review': return '#EF4444'; // Red
      case 'new': return '#EF4444'; // Red
      case 'investigating': return '#F59E0B'; // Yellow
      case 'resolved': return '#10B981'; // Green
      case 'rejected': return '#6B7280'; // Gray
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending_review': return '🆕';
      case 'new': return '🆕';
      case 'investigating': return '🔍';
      case 'resolved': return '✅';
      case 'rejected': return '❌';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem',
        color: '#6B7280'
      }}>
        Loading admin dashboard...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: 'bold',
          color: '#1F2937',
          margin: 0
        }}>
          🛡️ Admin Dashboard
        </h1>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: '#EF4444',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Logout
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        padding: '0 2rem'
      }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <button
            onClick={() => setActiveTab('reports')}
            style={{
              background: 'none',
              border: 'none',
              padding: '1rem 0',
              fontSize: '1rem',
              fontWeight: activeTab === 'reports' ? '700' : '400',
              color: activeTab === 'reports' ? '#007B7F' : '#6B7280',
              borderBottom: activeTab === 'reports' ? '2px solid #007B7F' : 'none',
              cursor: 'pointer'
            }}
          >
            📊 Reports & Complaints
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            style={{
              background: 'none',
              border: 'none',
              padding: '1rem 0',
              fontSize: '1rem',
              fontWeight: activeTab === 'messages' ? '700' : '400',
              color: activeTab === 'messages' ? '#007B7F' : '#6B7280',
              borderBottom: activeTab === 'messages' ? '2px solid #007B7F' : 'none',
              cursor: 'pointer'
            }}
          >
            💬 User Messages ({adminMessages.length})
          </button>
          <button
            onClick={() => setActiveTab('stores')}
            style={{
              background: 'none',
              border: 'none',
              padding: '1rem 0',
              fontSize: '1rem',
              fontWeight: activeTab === 'stores' ? '700' : '400',
              color: activeTab === 'stores' ? '#007B7F' : '#6B7280',
              borderBottom: activeTab === 'stores' ? '2px solid #007B7F' : 'none',
              cursor: 'pointer'
            }}
          >
            🏪 Live Stores ({liveStores.length})
          </button>
          <button
            onClick={() => setActiveTab('conversations')}
            style={{
              background: 'none',
              border: 'none',
              padding: '1rem 0',
              fontSize: '1rem',
              fontWeight: activeTab === 'conversations' ? '700' : '400',
              color: activeTab === 'conversations' ? '#007B7F' : '#6B7280',
              borderBottom: activeTab === 'conversations' ? '2px solid #007B7F' : 'none',
              cursor: 'pointer'
            }}
          >
            🗨️ Seller-Buyer Chats ({sellerBuyerConversations.length})
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'reports' ? (
        <div style={{ padding: '2rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#6B7280', fontSize: '0.875rem' }}>Total Reports</h3>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#1F2937' }}>
              {complaints.length}
            </p>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#6B7280', fontSize: '0.875rem' }}>Store Reports</h3>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#7C3AED' }}>
              {complaints.filter(c => c.type === 'store_report').length}
            </p>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#6B7280', fontSize: '0.875rem' }}>Post Reports</h3>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#DC2626' }}>
              {complaints.filter(c => c.type === 'post_report').length}
            </p>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#6B7280', fontSize: '0.875rem' }}>New/Unresolved</h3>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#EF4444' }}>
              {complaints.filter(c => c.status === 'pending_review' || c.status === 'investigating' || c.status === 'new').length}
            </p>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#6B7280', fontSize: '0.875rem' }}>Resolved</h3>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#10B981' }}>
              {complaints.filter(c => c.status === 'resolved').length}
            </p>
          </div>
        </div>

        {/* Complaints List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937' }}>
                Reports & Complaints
              </h2>
            </div>
            
            {/* Report Filter Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setReportFilter('all')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  background: reportFilter === 'all' ? '#007B7F' : '#ffffff',
                  color: reportFilter === 'all' ? '#ffffff' : '#374151',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (reportFilter !== 'all') {
                    e.target.style.background = '#F9FAFB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (reportFilter !== 'all') {
                    e.target.style.background = '#ffffff';
                  }
                }}
              >
                All Reports ({complaints.length})
              </button>
              <button
                onClick={() => setReportFilter('store_report')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  background: reportFilter === 'store_report' ? '#7C3AED' : '#ffffff',
                  color: reportFilter === 'store_report' ? '#ffffff' : '#374151',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (reportFilter !== 'store_report') {
                    e.target.style.background = '#F9FAFB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (reportFilter !== 'store_report') {
                    e.target.style.background = '#ffffff';
                  }
                }}
              >
                🏪 Store Reports ({complaints.filter(c => c.type === 'store_report').length})
              </button>
              <button
                onClick={() => setReportFilter('post_report')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  background: reportFilter === 'post_report' ? '#DC2626' : '#ffffff',
                  color: reportFilter === 'post_report' ? '#ffffff' : '#374151',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (reportFilter !== 'post_report') {
                    e.target.style.background = '#F9FAFB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (reportFilter !== 'post_report') {
                    e.target.style.background = '#ffffff';
                  }
                }}
              >
                📝 Post Reports ({complaints.filter(c => c.type === 'post_report').length})
              </button>
            </div>
          </div>

          {complaints.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#6B7280'
            }}>
              No complaints found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Date</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Customer</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Shop</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Issue</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints
                    .filter(complaint => reportFilter === 'all' || complaint.type === reportFilter)
                    .map((complaint) => (
                    <tr key={complaint.id}>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        {complaint.submittedAt ? new Date(complaint.submittedAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>
                            {complaint.reporterName || complaint.customerName || 'Unknown'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                            {complaint.reporterEmail || complaint.customerEmail}
                          </div>
                          {complaint.type === 'store_report' && (
                            <div style={{ fontSize: '0.75rem', color: '#7C3AED', fontWeight: '600', marginTop: '0.25rem' }}>
                              🏪 Store Report
                            </div>
                          )}
                          {complaint.type === 'post_report' && (
                            <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: '600', marginTop: '0.25rem' }}>
                              📝 Post Report
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>
                            {complaint.reportedStoreName || complaint.shopInfo?.businessName || 'Unknown Shop'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                            {complaint.shopInfo?.email || complaint.reportedStoreId || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB', maxWidth: '300px' }}>
                        <div>
                          {complaint.reason && (
                            <div style={{ 
                              fontSize: '0.875rem', 
                              fontWeight: '600',
                              color: '#DC2626',
                              marginBottom: '0.25rem'
                            }}>
                              {complaint.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                          )}
                          <div style={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.875rem',
                            color: '#6B7280'
                          }}>
                            {complaint.details || complaint.explanation || complaint.message || 'No details provided'}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          backgroundColor: getStatusColor(complaint.status) + '20',
                          color: getStatusColor(complaint.status)
                        }}>
                          {getStatusIcon(complaint.status)}
                          {complaint.status || 'new'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        <button
                          onClick={() => {
                            setSelectedComplaint(complaint);
                            setShowModal(true);
                          }}
                          style={{
                            backgroundColor: '#3B82F6',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      ) : activeTab === 'messages' ? (
        /* Messages Tab Content */
        <div style={{ padding: '2rem' }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937' }}>
                💬 User Messages & Support
              </h2>
            </div>

            {adminMessages.length === 0 ? (
              <div style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#6B7280'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📬</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                  No Messages
                </h3>
                <p>No user messages found. Messages from buyers contacting admin will appear here.</p>
              </div>
            ) : (
              <div style={{ padding: '1rem' }}>
                {adminMessages.map((conversation) => (
                  <div key={conversation.id} style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    cursor: 'pointer',
                    backgroundColor: selectedConversation?.id === conversation.id ? '#F0F9FF' : '#fff'
                  }}
                  onClick={() => {
                    setSelectedConversation(conversation);
                    setShowMessagingModal(true);
                  }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ 
                          fontSize: '1rem', 
                          fontWeight: '600', 
                          color: '#1F2937', 
                          margin: '0 0 0.5rem 0' 
                        }}>
                          {conversation.otherUserName || 'Unknown User'}
                        </h4>
                        <p style={{ 
                          color: '#6B7280', 
                          fontSize: '0.875rem', 
                          margin: '0 0 0.5rem 0' 
                        }}>
                          {conversation.otherUserEmail}
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          {/* Source tag */}
                          <div style={{
                            backgroundColor: conversation.source === 'help_center' ? '#DBEAFE' : '#E0F2FE',
                            color: conversation.source === 'help_center' ? '#1E40AF' : '#0C4A6E',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            display: 'inline-block'
                          }}>
                            {conversation.source === 'help_center' ? '🆘 Help Center' : '❓ Store Help'}
                          </div>
                          
                          {/* Store context tag if available */}
                          {conversation.storeContext && (
                            <div style={{
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              display: 'inline-block'
                            }}>
                              📍 Re: {conversation.storeContext.storeName}
                            </div>
                          )}
                        </div>
                        <p style={{ 
                          color: '#374151', 
                          fontSize: '0.875rem',
                          margin: 0,
                          fontStyle: 'italic'
                        }}>
                          "{conversation.lastMessage || 'No messages yet'}"
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                        <div style={{
                          backgroundColor: '#3B82F6',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          Reply
                        </div>
                        {conversation.lastMessageTime && (
                          <p style={{ 
                            color: '#9CA3AF', 
                            fontSize: '0.75rem', 
                            margin: '0.25rem 0 0 0' 
                          }}>
                            {new Date(conversation.lastMessageTime.toMillis()).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'stores' ? (
        /* Live Stores Tab Content */
        <div style={{ padding: '2rem' }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937' }}>
                  🏪 Live Stores Management
                </h2>
                <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                  Showing {filteredStores.length} of {liveStores.length} stores
                </div>
              </div>
              
              {/* Search and Filter Controls */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 280px auto', 
                gap: '1rem', 
                alignItems: 'center',
                maxWidth: '100%',
                '@media (max-width: 768px)': {
                  gridTemplateColumns: '1fr',
                  gap: '0.75rem'
                }
              }}>
                {/* Search Input */}
                <div style={{ 
                  position: 'relative',
                  maxWidth: '500px' // Limit maximum width of search bar
                }}>
                  <input
                    type="text"
                    placeholder="Search stores by name, email, address, or business ID..."
                    value={storeSearchTerm}
                    onChange={(e) => setStoreSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.75rem 0.75rem 1rem',
                      border: '2px solid #E5E7EB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#007B7F';
                      e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 127, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E5E7EB';
                      e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9CA3AF',
                    pointerEvents: 'none',
                    fontSize: '1rem'
                  }}>
                    🔍
                  </div>
                </div>
                
                {/* Category Filter */}
                <div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #E5E7EB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                      fontFamily: 'inherit',
                      fontWeight: '500',
                      color: '#374151'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#007B7F';
                      e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 127, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E5E7EB';
                      e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <option value="" style={{ color: '#6B7280' }}>All Categories</option>
                    {getUniqueCategories().map(category => (
                      <option key={category} value={category} style={{ color: '#374151' }}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Clear Filters Button */}
                {(storeSearchTerm || selectedCategory) && (
                  <button
                    onClick={() => {
                      setStoreSearchTerm('');
                      setSelectedCategory('');
                    }}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: '#F3F4F6',
                      color: '#6B7280',
                      border: '2px solid #E5E7EB',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      minWidth: 'fit-content'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#E5E7EB';
                      e.target.style.color = '#374151';
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#F3F4F6';
                      e.target.style.color = '#6B7280';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <span style={{ fontSize: '0.875rem' }}>🗑️</span>
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {loadingStores ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                <p>Loading stores...</p>
              </div>
            ) : filteredStores.length === 0 && liveStores.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏪</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                  No Live Stores
                </h3>
                <p>No active stores found in the system.</p>
              </div>
            ) : filteredStores.length === 0 && liveStores.length > 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                  No Results Found
                </h3>
                <p>No stores match your current search criteria.</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Try adjusting your search terms or clearing filters.
                </p>
              </div>
            ) : (
              <div style={{ padding: '1rem' }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                  gap: '1.5rem' 
                }}>
                  {filteredStores.map((store) => (
                    <StoreCard 
                      key={store.id}
                      store={store}
                      onClick={() => {
                        setSelectedStore(store);
                        setShowDrawer(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <StoreDetailsDrawer 
            store={selectedStore}
            open={showDrawer}
            onClose={() => {
              setShowDrawer(false);
              setSelectedStore(null);
            }}
          />
        </div>
      ) : activeTab === 'conversations' ? (
        /* Seller-Buyer Conversations Tab Content */
        <div style={{ padding: '2rem' }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937' }}>
                  🗨️ Seller-Buyer Conversations
                </h2>
                <div style={{
                  backgroundColor: '#3B82F6',
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  {filteredConversations.length} conversations
                </div>
              </div>
              
              {/* Search Bar */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search conversations by seller, buyer, store, or message content..."
                    value={conversationSearchTerm}
                    onChange={(e) => setConversationSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.5rem 0.75rem 1rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      backgroundColor: 'white'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9CA3AF',
                    fontSize: '1rem'
                  }}>
                    🔍
                  </div>
                </div>
                
                {conversationSearchTerm && (
                  <button
                    onClick={() => setConversationSearchTerm('')}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#EF4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#DC2626'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#EF4444'}
                  >
                    Clear
                  </button>
                )}
              </div>
              
              {/* Search Results Info */}
              {conversationSearchTerm && (
                <div style={{ 
                  marginTop: '0.75rem', 
                  fontSize: '0.75rem', 
                  color: '#6B7280',
                  fontStyle: 'italic'
                }}>
                  {filteredConversations.length === sellerBuyerConversations.length 
                    ? `Showing all ${sellerBuyerConversations.length} conversations`
                    : `Found ${filteredConversations.length} of ${sellerBuyerConversations.length} conversations matching "${conversationSearchTerm}"`
                  }
                </div>
              )}
            </div>

            {loadingConversations ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                <p>Loading conversations...</p>
              </div>
            ) : filteredConversations.length === 0 && sellerBuyerConversations.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗨️</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                  No Conversations
                </h3>
                <p>No seller-buyer conversations found.</p>
              </div>
            ) : filteredConversations.length === 0 && sellerBuyerConversations.length > 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                  No Results Found
                </h3>
                <p>No conversations match your search criteria.</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#9CA3AF' }}>
                  Try searching for seller names, buyer names, store names, or message content.
                </p>
              </div>
            ) : (
              <div style={{ padding: '1rem' }}>
                {filteredConversations.map((conversation) => (
                  <div key={conversation.id} style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '1rem',
                    cursor: 'pointer',
                    backgroundColor: '#fff',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                  }}
                  onClick={() => {
                    setSelectedConversation(conversation);
                    setShowMessagingModal(true);
                  }}
                  >
                    {/* Conversation Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        {/* Participant Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1rem' }}>
                          {/* Seller Info */}
                          <div style={{
                            padding: '0.75rem',
                            backgroundColor: '#F0F9FF',
                            borderRadius: '8px',
                            border: '1px solid #E0F2FE'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '1.25rem', marginRight: '0.5rem' }}>🛍️</span>
                              <h4 style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: '600', 
                                color: '#0369A1', 
                                margin: 0
                              }}>
                                SELLER
                              </h4>
                            </div>
                            <p style={{ color: '#1F2937', fontSize: '0.9rem', margin: '0 0 0.25rem 0', fontWeight: '600' }}>
                              {conversation.sellerName || 'Unknown Seller'}
                            </p>
                            <p style={{ color: '#6B7280', fontSize: '0.75rem', margin: '0 0 0.5rem 0' }}>
                              📧 {conversation.sellerEmail}
                            </p>
                            {conversation.storeName && conversation.storeName !== 'No Store' && (
                              <div style={{
                                backgroundColor: '#DBEAFE',
                                color: '#1E40AF',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                marginBottom: '0.25rem',
                                display: 'inline-block'
                              }}>
                                🏪 {conversation.storeName}
                              </div>
                            )}
                            {conversation.storeCategory && (
                              <div style={{
                                backgroundColor: '#FEF3C7',
                                color: '#92400E',
                                padding: '0.2rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                fontWeight: '600',
                                marginTop: '0.25rem',
                                display: 'block'
                              }}>
                                📂 {conversation.storeCategory}
                              </div>
                            )}
                            {conversation.storeLocation && conversation.storeLocation !== 'No location' && (
                              <div style={{
                                fontSize: '0.65rem',
                                color: '#6B7280',
                                marginTop: '0.25rem',
                                display: 'flex',
                                alignItems: 'center'
                              }}>
                                📍 {conversation.storeLocation.length > 30 ? conversation.storeLocation.substring(0, 30) + '...' : conversation.storeLocation}
                              </div>
                            )}
                          </div>
                          
                          {/* Buyer Info */}
                          <div style={{
                            padding: '0.75rem',
                            backgroundColor: '#F0FDF4',
                            borderRadius: '8px',
                            border: '1px solid #DCFCE7'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '1.25rem', marginRight: '0.5rem' }}>👤</span>
                              <h4 style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: '600', 
                                color: '#15803D', 
                                margin: 0
                              }}>
                                BUYER
                              </h4>
                            </div>
                            <p style={{ color: '#1F2937', fontSize: '0.9rem', margin: '0 0 0.25rem 0', fontWeight: '600' }}>
                              {conversation.buyerName || 'Unknown Buyer'}
                            </p>
                            <p style={{ color: '#6B7280', fontSize: '0.75rem', margin: '0 0 0.25rem 0' }}>
                              📧 {conversation.buyerEmail}
                            </p>
                            {conversation.buyerPhone && conversation.buyerPhone !== 'Not provided' && (
                              <p style={{ color: '#6B7280', fontSize: '0.75rem', margin: '0 0 0.25rem 0' }}>
                                📱 {conversation.buyerPhone}
                              </p>
                            )}
                            {conversation.buyerJoinDate && (
                              <div style={{
                                fontSize: '0.65rem',
                                color: '#6B7280',
                                marginTop: '0.25rem',
                                backgroundColor: '#F3F4F6',
                                padding: '0.2rem 0.4rem',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}>
                                📅 Joined: {new Date(conversation.buyerJoinDate.toDate ? conversation.buyerJoinDate.toDate() : conversation.buyerJoinDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Last Message Preview */}
                        <div style={{
                          backgroundColor: '#F8FAFC',
                          padding: '1rem',
                          borderRadius: '8px',
                          borderLeft: '4px solid #3B82F6',
                          position: 'relative'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#3B82F6' }}>
                              💬 Latest Message
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                              {conversation.lastMessageTime ? 
                                (() => {
                                  const date = new Date(conversation.lastMessageTime.toDate());
                                  const now = new Date();
                                  const diffMs = now - date;
                                  const diffMins = Math.floor(diffMs / 60000);
                                  const diffHours = Math.floor(diffMs / 3600000);
                                  const diffDays = Math.floor(diffMs / 86400000);
                                  
                                  if (diffMins < 1) return 'Just now';
                                  if (diffMins < 60) return `${diffMins}m ago`;
                                  if (diffHours < 24) return `${diffHours}h ago`;
                                  if (diffDays < 7) return `${diffDays}d ago`;
                                  return date.toLocaleDateString();
                                })() : 'N/A'
                              }
                            </span>
                          </div>
                          <p style={{ 
                            color: '#374151', 
                            fontSize: '0.875rem',
                            margin: 0,
                            fontStyle: 'italic',
                            lineHeight: 1.4
                          }}>
                            "{(conversation.lastMessage && conversation.lastMessage.length > 120) 
                              ? conversation.lastMessage.substring(0, 120) + '...' 
                              : conversation.lastMessage || 'No messages yet'}"
                          </p>
                        </div>
                      </div>
                      
                      {/* Stats Panel */}
                      <div style={{ textAlign: 'right', marginLeft: '1.5rem', minWidth: '120px' }}>
                        <div style={{
                          backgroundColor: '#3B82F6',
                          color: 'white',
                          borderRadius: '16px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          marginBottom: '0.75rem',
                          textAlign: 'center'
                        }}>
                          {conversation.messageCount} messages
                        </div>
                        
                        <div style={{
                          backgroundColor: '#F3F4F6',
                          borderRadius: '8px',
                          padding: '0.5rem',
                          fontSize: '0.75rem',
                          color: '#6B7280',
                          textAlign: 'center'
                        }}>
                          <div style={{ marginBottom: '0.25rem' }}>📅 Started</div>
                          <div style={{ fontWeight: '600', color: '#374151' }}>
                            {conversation.lastMessageTime ? 
                              new Date(conversation.lastMessageTime.toDate()).toLocaleDateString() : 
                              'Unknown'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Admin Messaging Modal */}
      {showMessagingModal && selectedConversation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #E5E7EB'
            }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#1F2937', fontSize: '1.25rem' }}>
                  💬 Seller-Buyer Conversation
                </h3>
                
                {/* Participant Summary */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div style={{ 
                    backgroundColor: '#F0F9FF', 
                    padding: '0.5rem 0.75rem', 
                    borderRadius: '6px',
                    border: '1px solid #E0F2FE',
                    fontSize: '0.75rem'
                  }}>
                    <strong style={{ color: '#0369A1' }}>🛍️ {selectedConversation.sellerName}</strong>
                    {selectedConversation.sellerEmail && selectedConversation.sellerEmail !== 'No email provided' && (
                      <div style={{ color: '#0369A1', fontSize: '0.7rem' }}>
                        📧 {selectedConversation.sellerEmail}
                      </div>
                    )}
                    {selectedConversation.storeName && selectedConversation.storeName !== 'No Store' && (
                      <div style={{ color: '#0369A1', fontSize: '0.7rem' }}>
                        🏪 {selectedConversation.storeName}
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    backgroundColor: '#F0FDF4', 
                    padding: '0.5rem 0.75rem', 
                    borderRadius: '6px',
                    border: '1px solid #DCFCE7',
                    fontSize: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong style={{ color: '#15803D' }}>👤 {selectedConversation.buyerName}</strong>
                      {selectedConversation.buyerEmail && (
                        <div style={{ color: '#15803D', fontSize: '0.7rem' }}>
                          📧 {selectedConversation.buyerEmail}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => initiateBlockBuyer(selectedConversation)}
                      style={{
                        backgroundColor: '#EF4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      title="Block this buyer for 3 days due to abuse or inappropriate behavior"
                    >
                      🚫 Block Buyer
                    </button>
                  </div>
                </div>
                
                <div style={{
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  display: 'inline-block',
                  fontWeight: '600'
                }}>
                  🛡️ Admin Support Panel - Intervene in this conversation
                </div>
              </div>
              
              <button
                onClick={() => {
                  setShowMessagingModal(false);
                  setSelectedConversation(null);
                  setMessageText('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6B7280',
                  padding: '0.5rem'
                }}
              >
                ×
              </button>
            </div>

            {/* Conversation Messages */}
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: '#F9FAFB'
            }}>
              <h4 style={{ 
                margin: '0 0 1rem 0', 
                color: '#374151', 
                fontSize: '0.875rem',
                fontWeight: '600',
                borderBottom: '1px solid #E5E7EB',
                paddingBottom: '0.5rem'
              }}>
                💬 Conversation History
              </h4>
              
              {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedConversation.messages
                    .sort((a, b) => {
                      if (!a.timestamp || !b.timestamp) return 0;
                      return a.timestamp.toMillis() - b.timestamp.toMillis();
                    })
                    .map((message, index) => {
                      // Determine message type and styling
                      const isAdmin = message.senderId === 'admin';
                      const isSeller = message.senderId === selectedConversation.sellerId;
                      const isBuyer = message.senderId === selectedConversation.buyerId;
                      
                      let bgColor, borderColor, senderLabel, senderIcon;
                      
                      if (isAdmin) {
                        bgColor = '#EEF2FF';
                        borderColor = '#C7D2FE';
                        senderLabel = 'Admin Support';
                        senderIcon = '🛡️';
                      } else if (isSeller) {
                        bgColor = '#F0F9FF';
                        borderColor = '#E0F2FE';
                        senderLabel = selectedConversation.sellerName || 'Seller';
                        senderIcon = '🛍️';
                      } else if (isBuyer) {
                        bgColor = '#F0FDF4';
                        borderColor = '#DCFCE7';
                        senderLabel = selectedConversation.buyerName || 'Buyer';
                        senderIcon = '👤';
                      } else {
                        bgColor = '#F9FAFB';
                        borderColor = '#E5E7EB';
                        senderLabel = message.senderName || 'Unknown User';
                        senderIcon = '❓';
                      }
                      
                      return (
                        <div
                          key={message.id || index}
                          style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            backgroundColor: bgColor,
                            border: `1px solid ${borderColor}`,
                            position: 'relative'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem'
                          }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: isAdmin ? '#4338CA' : isSeller ? '#0369A1' : '#15803D',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              {senderIcon} {senderLabel}
                              {isAdmin && (
                                <span style={{
                                  backgroundColor: '#DC2626',
                                  color: 'white',
                                  fontSize: '0.6rem',
                                  padding: '0.1rem 0.3rem',
                                  borderRadius: '4px',
                                  marginLeft: '0.5rem'
                                }}>
                                  ADMIN
                                </span>
                              )}
                            </span>
                            <span style={{
                              fontSize: '0.75rem',
                              color: '#6B7280'
                            }}>
                              {message.timestamp ? new Date(message.timestamp.toDate()).toLocaleString() : 'Just now'}
                            </span>
                          </div>
                          <p style={{
                            margin: 0,
                            fontSize: '0.875rem',
                            color: '#374151',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.4'
                          }}>
                            {message.message || message.text}
                          </p>
                          {message.messageType === 'text' && message.message && message.message.includes('FORMAL REPORT') && (
                            <div style={{
                              backgroundColor: '#FEE2E2',
                              border: '1px solid #FECACA',
                              borderRadius: '4px',
                              padding: '0.5rem',
                              marginTop: '0.5rem',
                              fontSize: '0.75rem'
                            }}>
                              <strong style={{ color: '#B91C1C' }}>🚨 FORMAL REPORT - Priority Handling Required</strong>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p style={{
                  color: '#6B7280',
                  fontSize: '0.875rem',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  margin: 0
                }}>
                  No messages in this conversation yet.
                </p>
              )}
            </div>

            {/* Message Input */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Send Response as Admin Support:
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your response here..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '0.75rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={() => {
                  setShowMessagingModal(false);
                  setSelectedConversation(null);
                  setMessageText('');
                }}
                style={{
                  backgroundColor: '#6B7280',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendAdminMessage}
                disabled={!messageText.trim() || sendingMessage}
                style={{
                  backgroundColor: !messageText.trim() || sendingMessage ? '#9CA3AF' : '#10B981',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  cursor: !messageText.trim() || sendingMessage ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                {sendingMessage ? 'Sending...' : 'Send Response'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Buyer Confirmation Modal */}
      {showBlockConfirm && selectedBuyerToBlock && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #E5E7EB'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#DC2626'
              }}>
                🚫 Block Buyer - {blockDurationDays} Day{blockDurationDays !== 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => {
                  setShowBlockConfirm(false);
                  setBlockReason('');
                  setSelectedBuyerToBlock(null);
                  setBlockDurationDays(5);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6B7280'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#DC2626', fontSize: '1rem' }}>
                  ⚠️ You are about to block this buyer:
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#7F1D1D' }}>
                  <strong>Buyer:</strong> {selectedBuyerToBlock.buyerName} ({selectedBuyerToBlock.buyerEmail})<br/>
                  <strong>From Store:</strong> {selectedBuyerToBlock.storeName || 'Unknown Store'}<br/>
                  <strong>Duration:</strong> {blockDurationDays} day{blockDurationDays !== 1 ? 's' : ''} ({blockDurationDays * 24} hours)
                </p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Block Duration:
                </label>
                <select
                  value={blockDurationDays}
                  onChange={(e) => setBlockDurationDays(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    color: '#374151'
                  }}
                >
                  <option value={5}>5 Days - Minor violation</option>
                  <option value={10}>10 Days - Moderate violation</option>
                  <option value={15}>15 Days - Serious violation</option>
                  <option value={30}>1 Month - Major violation</option>
                  <option value={60}>2 Months - Severe violation</option>
                  <option value={90}>3 Months - Very severe violation</option>
                  <option value={120}>4 Months - Extreme violation</option>
                  <option value={150}>5 Months - Maximum violation</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Reason for blocking (required):
                </label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g., Inappropriate messages, harassment, abusive language, spam, etc."
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '0.75rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  maxLength={500}
                />
                <div style={{ fontSize: '0.75rem', color: '#6B7280', textAlign: 'right', marginTop: '0.25rem' }}>
                  {blockReason.length}/500 characters
                </div>
              </div>

              <div style={{
                backgroundColor: '#F0F9FF',
                border: '1px solid #BFDBFE',
                borderRadius: '6px',
                padding: '0.75rem',
                fontSize: '0.75rem',
                color: '#1E40AF'
              }}>
                <strong>What happens when you block this buyer:</strong>
                <ul style={{ margin: '0.5rem 0 0 1rem', paddingLeft: 0 }}>
                  <li>Buyer cannot send messages to this seller for {blockDurationDays} day{blockDurationDays !== 1 ? 's' : ''}</li>
                  <li>Automated warning message will be sent to the buyer</li>
                  <li>Seller will be notified of the protective action taken</li>
                  <li>Block will automatically expire after {blockDurationDays * 24} hours</li>
                </ul>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              justifyContent: 'flex-end',
              borderTop: '1px solid #E5E7EB',
              paddingTop: '1rem'
            }}>
              <button
                onClick={() => {
                  setShowBlockConfirm(false);
                  setBlockReason('');
                  setSelectedBuyerToBlock(null);
                  setBlockDurationDays(5);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBlockBuyer}
                disabled={isBlockingBuyer || !blockReason.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: !blockReason.trim() ? '#9CA3AF' : '#DC2626',
                  color: 'white',
                  cursor: !blockReason.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  opacity: isBlockingBuyer ? 0.7 : 1
                }}
              >
                {isBlockingBuyer ? 'Blocking...' : `🚫 Block for ${blockDurationDays} Day${blockDurationDays !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && selectedComplaint && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', fontWeight: 'bold' }}>
              Manage Complaint
            </h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
                {selectedComplaint.type === 'store_report' ? 'Reporter Details' : 
                 selectedComplaint.type === 'post_report' ? 'Reporter Details' : 'Customer Details'}
              </h4>
              <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                <strong>Name:</strong> {selectedComplaint.reporterName || selectedComplaint.customerName || 'Unknown'}
              </p>
              <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                <strong>Email:</strong> {selectedComplaint.reporterEmail || selectedComplaint.customerEmail}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
                {selectedComplaint.type === 'store_report' ? 'Reported Store Details' : 
                 selectedComplaint.type === 'post_report' ? 'Store Associated with Post' : 'Shop Details'}
              </h4>
              <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                <strong>Business:</strong> {
                  selectedComplaint.reportedStoreName || 
                  selectedComplaint.shopInfo?.businessName || 
                  selectedComplaint.sellerName || 
                  'N/A'
                }
              </p>
              <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                <strong>Store ID:</strong> {selectedComplaint.reportedStoreId || 'N/A'}
              </p>
              <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                <strong>Owner ID:</strong> {selectedComplaint.reportedStoreOwner || 'N/A'}
              </p>
              {(selectedComplaint.shopInfo?.address || selectedComplaint.shopInfo?.email) && (
                <>
                  {selectedComplaint.shopInfo?.email && (
                    <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                      <strong>Email:</strong> {selectedComplaint.shopInfo.email}
                    </p>
                  )}
                  {selectedComplaint.shopInfo?.address && (
                    <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                      <strong>Address:</strong> {selectedComplaint.shopInfo.address}
                    </p>
                  )}
                </>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
                {selectedComplaint.type === 'store_report' ? 'Store Report Details' : 
                 selectedComplaint.type === 'post_report' ? 'Post Report Details' : 'Complaint Details'}
              </h4>
              {(selectedComplaint.reason || selectedComplaint.complaintType) && (
                <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                  <strong>Reason:</strong> {
                    selectedComplaint.reason 
                      ? selectedComplaint.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                      : selectedComplaint.complaintType?.replace('_', ' ').toUpperCase()
                  }
                </p>
              )}
              
              {/* Store Report Details */}
              {selectedComplaint.type === 'store_report' && (
                <div style={{ 
                  margin: '0.5rem 0', 
                  padding: '0.75rem', 
                  backgroundColor: '#FEF2F2', 
                  border: '1px solid #FECACA',
                  borderRadius: '6px' 
                }}>
                  <strong style={{ color: '#DC2626' }}>Store Report Type: </strong>
                  <span style={{ color: '#7F1D1D' }}>
                    {selectedComplaint.reason 
                      ? selectedComplaint.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                      : 'General Report'
                    }
                  </span>
                </div>
              )}
              
              {/* Post Report Details */}
              {selectedComplaint.type === 'post_report' && (
                <div style={{ 
                  margin: '0.5rem 0', 
                  padding: '0.75rem', 
                  backgroundColor: '#FEF2F2', 
                  border: '1px solid #FECACA',
                  borderRadius: '6px' 
                }}>
                  <strong style={{ color: '#DC2626' }}>Reported Post: </strong>
                  <div style={{ 
                    marginTop: '0.5rem', 
                    padding: '0.5rem', 
                    backgroundColor: '#F9FAFB', 
                    borderRadius: '4px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <p style={{ 
                      margin: '0 0 0.25rem 0', 
                      fontSize: '0.875rem', 
                      color: '#6B7280' 
                    }}>
                      <strong>Post ID:</strong> {selectedComplaint.reportedPostId}
                    </p>
                    {selectedComplaint.reportedPostText && (
                      <p style={{ 
                        margin: '0.25rem 0', 
                        fontSize: '0.875rem', 
                        color: '#374151',
                        fontStyle: 'italic',
                        maxHeight: '100px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        <strong>Post Content:</strong> "{selectedComplaint.reportedPostText.length > 200 
                          ? selectedComplaint.reportedPostText.substring(0, 200) + '...' 
                          : selectedComplaint.reportedPostText}"
                      </p>
                    )}
                  </div>
                </div>
              )}
              {selectedComplaint.refundData && (
                <div style={{ margin: '0.5rem 0', padding: '1rem', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                  <strong>Related Order:</strong>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>Order ID: {selectedComplaint.refundData.orderId}</p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>Amount: {selectedComplaint.refundData.currency || 'GBP'} {selectedComplaint.refundData.amount}</p>
                </div>
              )}
              <p style={{ margin: '0.5rem 0', color: '#374151', lineHeight: '1.5' }}>
                <strong>Details:</strong><br/>
                {selectedComplaint.details || selectedComplaint.explanation || selectedComplaint.message || 'No additional details provided'}
              </p>
              {selectedComplaint.screenshots && selectedComplaint.screenshots.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#374151' }}>Screenshot Evidence:</p>
                  {selectedComplaint.screenshots.map((screenshot, index) => (
                    <div key={index} style={{ marginBottom: '0.5rem' }}>
                      <img 
                        src={screenshot.url} 
                        alt={`Complaint Evidence ${index + 1}`}
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: '6px',
                          border: '1px solid #E5E7EB',
                          marginBottom: '0.5rem'
                        }}
                      />
                      <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0 }}>{screenshot.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#374151' }}>Update Status</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['pending_review', 'investigating', 'resolved', 'rejected'].map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(selectedComplaint.id, status)}
                    disabled={updateLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: updateLoading ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      backgroundColor: selectedComplaint.status === status ? getStatusColor(status) : '#F3F4F6',
                      color: selectedComplaint.status === status ? 'white' : '#374151'
                    }}
                  >
                    {getStatusIcon(status)} {status}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedComplaint(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer'
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

const StoreDetailsDrawer = ({ store, open, onClose }) => {
  const [isDisabling, setIsDisabling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDisableStore = async () => {
    if (!store?.id) return;
    
    const confirmDisable = window.confirm(
      `Are you sure you want to ${store.disabled ? 'enable' : 'disable'} "${store.storeName}"?\n\n` +
      `${store.disabled ? 'This will make the store visible on the explore page again.' : 'This will temporarily hide the store from the explore page.'}`
    );
    
    if (!confirmDisable) return;
    
    setIsDisabling(true);
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        disabled: !store.disabled,
        disabledAt: !store.disabled ? serverTimestamp() : null,
        disabledBy: 'admin'
      });
      
      console.log(`Store ${store.disabled ? 'enabled' : 'disabled'} successfully`);
      // Refresh the stores list
      window.location.reload();
    } catch (error) {
      console.error('Error updating store status:', error);
      alert('Failed to update store status. Please try again.');
    } finally {
      setIsDisabling(false);
    }
  };

  const handleDeleteStore = async () => {
    if (!store?.id) return;
    
    const confirmDelete = window.confirm(
      `⚠️ PERMANENT SELLER ACCOUNT DELETION WARNING ⚠️\n\n` +
      `Are you sure you want to PERMANENTLY DELETE the seller account for "${store.storeName}"?\n\n` +
      `This action will:\n` +
      `• Delete the seller's Firebase Auth account\n` +
      `• Remove all store data from Firestore\n` +
      `• Delete all associated items, orders, and messages\n` +
      `• Log out the seller immediately if they're online\n` +
      `• Cannot be undone\n\n` +
      `Type "DELETE SELLER" in the next prompt to confirm.`
    );
    
    if (!confirmDelete) return;
    
    const deleteConfirmation = prompt('Type "DELETE SELLER" to confirm permanent seller account deletion:');
    if (deleteConfirmation !== 'DELETE SELLER') {
      alert('Deletion cancelled. You must type "DELETE SELLER" exactly to confirm.');
      return;
    }
    
    setIsDeleting(true);
    try {
      // First mark the store as deleted in Firestore
      await updateDoc(doc(db, 'stores', store.id), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: 'admin',
        disabled: true
      });

      // Get the seller's user ID (ownerId or store.id)
      const sellerId = store.ownerId || store.id;
      
      // Mark the user account as deleted in Firestore
      try {
        await updateDoc(doc(db, 'users', sellerId), {
          deleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: 'admin',
          accountStatus: 'deleted'
        });
      } catch (userError) {
        console.log('User document may not exist or already deleted:', userError);
      }

      // Delete all seller's items
      try {
        const itemsQuery = query(collection(db, 'items'), where('sellerId', '==', sellerId));
        const itemsSnapshot = await getDocs(itemsQuery);
        const deleteItemsPromises = itemsSnapshot.docs.map(itemDoc => 
          updateDoc(doc(db, 'items', itemDoc.id), {
            deleted: true,
            deletedAt: serverTimestamp()
          })
        );
        await Promise.all(deleteItemsPromises);
      } catch (itemsError) {
        console.log('Error deleting seller items:', itemsError);
      }

      // Delete seller's messages
      try {
        const messagesQuery = query(collection(db, 'messages'), where('sellerId', '==', sellerId));
        const messagesSnapshot = await getDocs(messagesQuery);
        const deleteMessagesPromises = messagesSnapshot.docs.map(msgDoc => 
          updateDoc(doc(db, 'messages', msgDoc.id), {
            deleted: true,
            deletedAt: serverTimestamp()
          })
        );
        await Promise.all(deleteMessagesPromises);
      } catch (messagesError) {
        console.log('Error deleting seller messages:', messagesError);
      }

      // Set user session to deleted to force logout
      try {
        await addDoc(collection(db, 'userSessions'), {
          userId: sellerId,
          action: 'account_deleted_by_admin',
          timestamp: serverTimestamp(),
          adminAction: true,
          forceLogout: true
        });
      } catch (sessionError) {
        console.log('Error creating logout session:', sessionError);
      }

      console.log('Seller account and all associated data deleted successfully');
      alert(`Seller account for "${store.storeName}" has been permanently deleted.\nThe seller will be logged out immediately if they were online.`);
      onClose();
      // Refresh the stores list
      window.location.reload();
    } catch (error) {
      console.error('Error deleting seller account:', error);
      alert('Failed to delete seller account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!open || !store) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000
        }}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '50%',
        maxWidth: '600px',
        minWidth: '400px',
        backgroundColor: 'white',
        zIndex: 1001,
        overflowY: 'auto',
        boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.1)',
        padding: '2rem'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #E5E7EB'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#1F2937' }}>
            {store.storeName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6B7280',
              padding: '0.5rem'
            }}
          >
            ×
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: '#F9FAFB',
          borderRadius: '8px',
          border: '1px solid #E5E7EB'
        }}>
          <button
            onClick={handleDisableStore}
            disabled={isDisabling}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              backgroundColor: store.disabled ? '#10B981' : '#F59E0B',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: isDisabling ? 'not-allowed' : 'pointer',
              opacity: isDisabling ? 0.6 : 1,
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!isDisabling) {
                e.target.style.opacity = '0.9';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDisabling) {
                e.target.style.opacity = '1';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            {isDisabling ? '⏳' : (store.disabled ? '✅' : '⏸️')}
            {isDisabling ? 'Updating...' : (store.disabled ? 'Enable Store' : 'Disable Store')}
          </button>

          <button
            onClick={handleDeleteStore}
            disabled={isDeleting}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              backgroundColor: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.target.style.opacity = '0.9';
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.backgroundColor = '#DC2626';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDeleting) {
                e.target.style.opacity = '1';
                e.target.style.transform = 'translateY(0)';
                e.target.style.backgroundColor = '#EF4444';
              }
            }}
          >
            {isDeleting ? '⏳' : '��🗑️'}
            {isDeleting ? 'Deleting...' : 'Delete Seller Account'}
          </button>
        </div>

        <div style={{ fontSize: '0.875rem', color: '#374151' }}>
          {/* Store Status Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.75rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              📊 Store Status
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {/* Live Status */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem',
                backgroundColor: store.live ? '#ECFDF5' : '#FEF2F2',
                borderRadius: '8px',
                border: `1px solid ${store.live ? '#D1FAE5' : '#FECACA'}`
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: store.live ? '#10B981' : '#EF4444',
                  marginRight: '0.5rem',
                  animation: store.live ? 'pulse 2s infinite' : 'none'
                }}></div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Live Status</div>
                  <div style={{ fontWeight: '600', color: store.live ? '#10B981' : '#EF4444' }}>
                    {store.live ? 'LIVE' : 'NOT LIVE'}
                  </div>
                </div>
              </div>

              {/* Disabled Status */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem',
                backgroundColor: store.disabled ? '#FEF2F2' : '#F0FDF4',
                borderRadius: '8px',
                border: `1px solid ${store.disabled ? '#FECACA' : '#BBF7D0'}`
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  marginRight: '0.5rem'
                }}>
                  {store.disabled ? '⏸️' : '✅'}
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Access Status</div>
                  <div style={{ fontWeight: '600', color: store.disabled ? '#DC2626' : '#16A34A' }}>
                    {store.disabled ? 'DISABLED' : 'ENABLED'}
                  </div>
                </div>
              </div>

              {/* Deleted Status */}
              {store.deleted && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#1F2937',
                  borderRadius: '8px',
                  border: '1px solid #374151',
                  gridColumn: '1 / -1'
                }}>
                  <div style={{
                    fontSize: '1.25rem',
                    marginRight: '0.5rem'
                  }}>
                    🗑️
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Store Status</div>
                    <div style={{ fontWeight: '600', color: '#FFFFFF' }}>
                      PERMANENTLY DELETED
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Status timestamps */}
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#F9FAFB', borderRadius: '6px', fontSize: '0.75rem', color: '#6B7280' }}>
              {store.disabledAt && (
                <div>🔒 Disabled: {new Date(store.disabledAt.toDate ? store.disabledAt.toDate() : store.disabledAt).toLocaleString()}</div>
              )}
              {store.deletedAt && (
                <div>🗑️ Deleted: {new Date(store.deletedAt.toDate ? store.deletedAt.toDate() : store.deletedAt).toLocaleString()}</div>
              )}
              {!store.disabledAt && !store.deletedAt && (
                <div>✅ Store is in normal operating status</div>
              )}
            </div>
          </div>

          {/* Contact Info Section */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              � Contact Info
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>� Email:</span>
                {store.email || 'Not provided'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>📱 Phone:</span>
                {store.phone || store.phoneNumber || 'Not provided'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem', gridColumn: '1 / -1' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>📍 Address:</span>
                {store.storeLocation || store.address || store.storeAddress || 'Not provided'}
              </div>
            </div>
          </div>

          {/* Business Info Section */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              🏢 Business Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🏷️ Category:</span>
                {store.category || 'Uncategorized'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🆔 Business ID:</span>
                {store.businessId || 'Not provided'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🌍 Origin:</span>
                {store.origin || 'Not provided'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🍺 Sells Alcohol:</span>
                {store.sellsAlcohol || 'No'}
              </div>
            </div>
          </div>

          {/* Operating Hours & Status */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              ⏰ Operating Hours & Status
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>⏰ Hours:</span>
                {(() => {
                  // Check for different hour formats
                  if (store.openingTime && store.closingTime) {
                    return `${store.openingTime} - ${store.closingTime}`;
                  } else if (store.openingHours && store.closingHours) {
                    return `${store.openingHours} - ${store.closingHours}`;
                  } else if (store.operatingHours) {
                    return store.operatingHours;
                  } else if (store.hours) {
                    return store.hours;
                  } else {
                    return 'Not specified';
                  }
                })()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🟢 Store Status:</span>
                <span style={{ 
                  backgroundColor: (store.live || store.isActive) ? '#10B981' : '#EF4444',
                  color: 'white',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {(store.live || store.isActive) ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🔓 Currently:</span>
                <span style={{ 
                  backgroundColor: (() => {
                    // Determine if store is currently open based on hours
                    const now = new Date();
                    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
                    const openTime = store.openingTime || store.openingHours;
                    const closeTime = store.closingTime || store.closingHours;
                    
                    if (openTime && closeTime) {
                      // Simple time comparison (assumes same day, doesn't handle overnight)
                      const isOpen = currentTime >= openTime && currentTime <= closeTime;
                      return isOpen ? '#10B981' : '#F59E0B';
                    } else {
                      // Fallback to store.isOpen if available
                      return store.isOpen ? '#10B981' : '#F59E0B';
                    }
                  })(),
                  color: 'white',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {(() => {
                    // Determine if store is currently open
                    const now = new Date();
                    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
                    const openTime = store.openingTime || store.openingHours;
                    const closeTime = store.closingTime || store.closingHours;
                    
                    if (openTime && closeTime) {
                      const isOpen = currentTime >= openTime && currentTime <= closeTime;
                      return isOpen ? 'OPEN' : 'CLOSED';
                    } else {
                      // Fallback to store.isOpen if available
                      return store.isOpen ? 'OPEN' : 'CLOSED';
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery & Payment Info */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              🚚 Delivery & Fees (From Wallet Settings)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>� Delivery Enabled:</span>
                <span style={{ 
                  backgroundColor: (store.feeSettings && store.feeSettings.deliveryEnabled) ? '#10B981' : '#EF4444',
                  color: 'white',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {(store.feeSettings && store.feeSettings.deliveryEnabled) ? 'YES' : 'NO'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>� Delivery Fee:</span>
                £{store.deliveryFee ? store.deliveryFee.toFixed(2) : '0.00'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🎯 Free Delivery Threshold:</span>
                £{store.freeDeliveryThreshold ? store.freeDeliveryThreshold.toFixed(2) : '0.00'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>⚙️ Service Fee Enabled:</span>
                <span style={{ 
                  backgroundColor: store.serviceFee ? '#10B981' : '#EF4444',
                  color: 'white',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {store.serviceFee ? 'YES' : 'NO'}
                </span>
              </div>
              {store.serviceFee && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>� Service Fee:</span>
                    {store.serviceFee.type === 'percentage' 
                      ? `${store.serviceFee.rate}%${store.serviceFee.max > 0 ? ` (max £${store.serviceFee.max})` : ''}` 
                      : `£${store.serviceFee.amount.toFixed(2)}`
                    }
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>� Service Fee Type:</span>
                    <span style={{ 
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      padding: '0.1rem 0.3rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {store.serviceFee.type.toUpperCase()}
                    </span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🔄 Refunds Enabled:</span>
                <span style={{ 
                  backgroundColor: store.refundsEnabled ? '#10B981' : '#EF4444',
                  color: 'white',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {store.refundsEnabled ? 'YES' : 'NO'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>💳 Payment Type:</span>
                {store.paymentType || 'Not specified'}
              </div>
            </div>
          </div>

          {/* Store Items Section */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              🛍️ Store Inventory ({store.totalItems || 0} items)
            </h4>
            {store.storeItems && store.storeItems.length > 0 ? (
              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto', 
                border: '1px solid #E5E7EB', 
                borderRadius: '6px',
                padding: '0.5rem'
              }}>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {store.storeItems.slice(0, 10).map((item, index) => (
                    <div key={item.id || index} style={{
                      backgroundColor: '#F9FAFB',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'flex-start'
                    }}>
                      {/* Item Image */}
                      <div style={{ 
                        minWidth: '80px',
                        height: '80px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        backgroundColor: '#E5E7EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name || item.itemName || 'Item'} 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover' 
                            }} 
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          display: item.image ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9CA3AF',
                          fontSize: '0.75rem',
                          textAlign: 'center'
                        }}>
                          📷<br/>No Image
                        </div>
                      </div>
                      
                      {/* Item Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '1rem', color: '#1F2937', marginBottom: '0.25rem' }}>
                              {item.name || item.itemName || 'Unnamed Item'}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                              {item.description || item.itemDescription || 'No description available'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: '100px' }}>
                            <div style={{ fontWeight: '700', color: '#059669', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                              £{item.price ? parseFloat(item.price).toFixed(2) : '0.00'}
                            </div>
                            <div>
                              <span style={{ 
                                backgroundColor: item.available !== false ? '#10B981' : '#EF4444',
                                color: 'white',
                                padding: '0.2rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>
                                {item.available !== false ? 'AVAILABLE' : 'UNAVAILABLE'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Item Metadata */}
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.75rem', color: '#6B7280' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span>📦</span>
                            <span style={{ fontWeight: '500' }}>Stock: {item.stock || item.quantity || 'N/A'}</span>
                          </div>
                          {item.category && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>🏷️</span>
                              <span style={{ fontWeight: '500' }}>Category: {item.category}</span>
                            </div>
                          )}
                          {item.weight && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>⚖️</span>
                              <span style={{ fontWeight: '500' }}>Weight: {item.weight}</span>
                            </div>
                          )}
                          {item.createdAt && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>📅</span>
                              <span style={{ fontWeight: '500' }}>
                                Added: {(() => {
                                  try {
                                    if (item.createdAt.toDate && typeof item.createdAt.toDate === 'function') {
                                      return new Date(item.createdAt.toDate()).toLocaleDateString();
                                    } else {
                                      return new Date(item.createdAt).toLocaleDateString();
                                    }
                                  } catch (e) {
                                    return 'Unknown';
                                  }
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {store.storeItems.length > 10 && (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#6B7280', 
                      fontSize: '0.875rem',
                      fontStyle: 'italic',
                      padding: '1rem',
                      backgroundColor: '#F3F4F6',
                      borderRadius: '6px'
                    }}>
                      📦 ... and {store.storeItems.length - 10} more items (showing first 10)
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                color: '#6B7280', 
                fontStyle: 'italic',
                padding: '2rem',
                border: '2px dashed #D1D5DB',
                borderRadius: '8px',
                backgroundColor: '#F9FAFB'
              }}>
                📭 No items found in this store's inventory
              </div>
            )}
          </div>

          {/* Online Presence */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              🌐 Online Presence
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>📱 Platform:</span>
                {store.platform || 'Not specified'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>📲 Social Handle:</span>
                {store.socialHandle || 'Not provided'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🌐 Has Website:</span>
                {store.hasWebsite || 'No'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🔗 Website:</span>
                {store.websiteLink || 'Not provided'}
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              📊 Performance Stats
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
              <div style={{ textAlign: 'center', backgroundColor: '#F3F4F6', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1F2937' }}>
                  {store.totalItems || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Items</div>
              </div>
              <div style={{ textAlign: 'center', backgroundColor: '#F3F4F6', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1F2937' }}>
                  {store.totalOrders || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Orders</div>
              </div>
              <div style={{ textAlign: 'center', backgroundColor: '#F3F4F6', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1F2937' }}>
                  ⭐ {(store.averageRating || store.rating || 0).toFixed(1)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Rating</div>
              </div>
              <div style={{ textAlign: 'center', backgroundColor: '#F3F4F6', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1F2937' }}>
                  {store.reviewCount || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Reviews</div>
              </div>
            </div>
          </div>

          {/* Location & Documents */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              📍 Documents & Licenses
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>📄 Certificate:</span>
                <span style={{ 
                  backgroundColor: store.certificate ? '#10B981' : '#EF4444',
                  color: 'white',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {store.certificate ? 'YES' : 'NO'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🍽️ Food Hygiene:</span>
                <span style={{ 
                  backgroundColor: store.foodHygiene ? '#10B981' : '#EF4444',
                  color: 'white',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {store.foodHygiene ? 'YES' : 'NO'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🏪 Market Stall Licence:</span>
                <span style={{ 
                  backgroundColor: store.marketStallLicence ? '#10B981' : '#EF4444',
                  color: 'white',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {store.marketStallLicence ? 'YES' : 'NO'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🍺 Alcohol License:</span>
                <span style={{ 
                  backgroundColor: store.alcoholLicense ? '#10B981' : '#EF4444',
                  color: 'white',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {store.alcoholLicense ? 'YES' : 'NO'}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
              🕒 Important Dates
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🕒 Created:</span>
                {store.createdAt ? (() => {
                  try {
                    if (store.createdAt.toDate && typeof store.createdAt.toDate === 'function') {
                      return new Date(store.createdAt.toDate()).toLocaleDateString();
                    } else {
                      return new Date(store.createdAt).toLocaleDateString();
                    }
                  } catch (e) {
                    return 'Invalid Date';
                  }
                })() : 'N/A'}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🔄 Activity Status:</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  {/* Online Status Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: store.isCurrentlyOnline ? '#10B981' : '#6B7280',
                      marginRight: '0.5rem',
                      animation: store.isCurrentlyOnline ? 'pulse 2s infinite' : 'none'
                    }}></span>
                    <span style={{ 
                      fontWeight: '600',
                      color: store.isCurrentlyOnline ? '#10B981' : '#6B7280',
                      fontSize: '0.875rem'
                    }}>
                      {store.isCurrentlyOnline ? 'Online Now' : 'Offline'}
                    </span>
                  </div>
                  
                  {/* Last Active Time */}
                  {store.calculatedLastActive ? (() => {
                    try {
                      const lastActiveDate = new Date(store.calculatedLastActive);
                      const now = new Date();
                      const timeDiff = now - lastActiveDate;
                      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                      
                      let timeAgo = '';
                      let statusColor = '#10B981'; // Default green
                      
                      if (daysDiff === 0) {
                        const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
                        if (hoursDiff === 0) {
                          const minutesDiff = Math.floor(timeDiff / (1000 * 60));
                          timeAgo = minutesDiff <= 1 ? 'Just now' : `${minutesDiff}m ago`;
                          statusColor = '#10B981'; // Green - very recent
                        } else {
                          timeAgo = `${hoursDiff}h ago`;
                          statusColor = '#10B981'; // Green - today
                        }
                      } else if (daysDiff === 1) {
                        timeAgo = 'Yesterday';
                        statusColor = '#F59E0B'; // Yellow - yesterday
                      } else if (daysDiff < 7) {
                        timeAgo = `${daysDiff} days ago`;
                        statusColor = '#F59E0B'; // Yellow - this week
                      } else if (daysDiff < 30) {
                        const weeksDiff = Math.floor(daysDiff / 7);
                        timeAgo = `${weeksDiff} week${weeksDiff > 1 ? 's' : ''} ago`;
                        statusColor = '#EF4444'; // Red - weeks ago
                      } else if (daysDiff < 365) {
                        const monthsDiff = Math.floor(daysDiff / 30);
                        timeAgo = `${monthsDiff} month${monthsDiff > 1 ? 's' : ''} ago`;
                        statusColor = '#EF4444'; // Red - months ago
                      } else {
                        const yearsDiff = Math.floor(daysDiff / 365);
                        timeAgo = `${yearsDiff} year${yearsDiff > 1 ? 's' : ''} ago`;
                        statusColor = '#DC2626'; // Dark red - years ago
                      }
                      
                      return (
                        <>
                          <div style={{ 
                            fontWeight: '600',
                            color: statusColor,
                            fontSize: '0.875rem'
                          }}>
                            Last Active: {timeAgo}
                          </div>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: '#6B7280',
                            marginTop: '0.125rem'
                          }}>
                            {lastActiveDate.toLocaleDateString()} at {lastActiveDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        </>
                      );
                    } catch (e) {
                      return <span style={{ color: '#EF4444', fontSize: '0.875rem' }}>Invalid Date</span>;
                    }
                  })() : (
                    <div style={{ color: '#EF4444', fontWeight: '600', fontSize: '0.875rem' }}>
                      No Activity Recorded
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information (masked for security) */}
          {store.paymentInfo && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', margin: '0 0 0.5rem 0', borderBottom: '2px solid #E5E7EB', paddingBottom: '0.25rem' }}>
                💳 Payment Info (Masked)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {store.paymentInfo.country && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🌍 Country:</span>
                    {store.paymentInfo.country}
                  </div>
                )}
                {store.paymentInfo.bankName && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>🏦 Bank:</span>
                    {store.paymentInfo.bankName}
                  </div>
                )}
                {store.cardType && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '600', marginRight: '0.5rem' }}>💳 Card Type:</span>
                    {store.cardType}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminDashboardPage;
