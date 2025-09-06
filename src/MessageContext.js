import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';

const MessageContext = createContext();

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within a MessageProvider');
  }
  return context;
};

export const MessageProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [allMessages, setAllMessages] = useState([]);

  // Monitor auth state
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setUnreadMessageCount(0);
        setAllMessages([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Monitor messages for current user
  useEffect(() => {
    if (!currentUser) {
      setUnreadMessageCount(0);
      setAllMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, 'messages'),
      where('receiverId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setAllMessages(messages);
      
      // Count unread messages
      const unreadCount = messages.filter(msg => !msg.isRead).length;
      setUnreadMessageCount(unreadCount);
      
      console.log('🔔 MessageContext - User:', currentUser.uid);
      console.log('🔔 MessageContext - Total messages received:', messages.length);
      console.log('🔔 MessageContext - Unread count:', unreadCount);
      console.log('🔔 MessageContext - Unread messages:', messages.filter(msg => !msg.isRead));
    }, (error) => {
      console.error('Error fetching messages:', error);
      setUnreadMessageCount(0);
      setAllMessages([]);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Function to mark messages as read
  const markMessagesAsRead = async (messageIds) => {
    if (!messageIds || messageIds.length === 0) {
      console.log('🔔 No messages to mark as read');
      return;
    }
    
    try {
      console.log('🔔 Marking messages as read:', messageIds);
      const promises = messageIds.map(messageId => 
        updateDoc(doc(db, 'messages', messageId), { isRead: true })
      );
      await Promise.all(promises);
      console.log('🔔 Successfully marked messages as read:', messageIds);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Function to mark all messages as read for current user
  const markAllAsRead = async () => {
    const unreadMessages = allMessages.filter(msg => !msg.isRead);
    const messageIds = unreadMessages.map(msg => msg.id);
    await markMessagesAsRead(messageIds);
  };

  const value = {
    currentUser,
    unreadMessageCount,
    allMessages,
    markMessagesAsRead,
    markAllAsRead
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
};
