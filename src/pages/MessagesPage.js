import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

function MessagesPage() {
  const [activeTab, setActiveTab] = useState('messages');
  const [search, setSearch] = useState('');
  const [isSeller, setIsSeller] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Check if user has a store profile (making them a seller)
          const storeDocRef = doc(db, 'stores', user.uid);
          const storeDocSnap = await getDoc(storeDocRef);
          setIsSeller(storeDocSnap.exists());
        } catch (error) {
          console.error('Error checking seller status:', error);
          setIsSeller(false);
        }
      } else {
        setIsSeller(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Reset to messages tab if user is not a seller and currently on payments tab
  useEffect(() => {
    if (!isSeller && activeTab === 'payments') {
      setActiveTab('messages');
    }
  }, [isSeller, activeTab]);

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
      <div
        className="messages-card"
        style={{
          width: '100%',
          maxWidth: 600,
          margin: '2rem auto',
          background: '#fff',
          padding: '2rem 1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px #B8B8B8',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab('messages')}
            style={{
              flex: isSeller ? 1 : 'auto',
              width: isSeller ? 'auto' : '100%',
              padding: '1rem',
              background: activeTab === 'messages' ? '#F9F5EE' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'messages' ? '2px solid #007B7F' : '2px solid transparent',
              color: activeTab === 'messages' ? '#007B7F' : '#888',
              fontWeight: 700,
              fontSize: '1.1rem',
              cursor: 'pointer',
              outline: 'none',
              transition: 'color 0.2s, border-bottom 0.2s',
            }}
          >
            Messages
          </button>
          {isSeller && (
            <button
              onClick={() => setActiveTab('payments')}
              style={{
                flex: 1,
                padding: '1rem',
                background: activeTab === 'payments' ? '#F9F5EE' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'payments' ? '2px solid #007B7F' : '2px solid transparent',
                color: activeTab === 'payments' ? '#007B7F' : '#888',
                fontWeight: 700,
                fontSize: '1.1rem',
                cursor: 'pointer',
                outline: 'none',
                transition: 'color 0.2s, border-bottom 0.2s',
              }}
            >
              Payments
            </button>
          )}
        </div>
        {activeTab === 'messages' && (
          <div>
            <input
              type="text"
              placeholder={isSeller ? "Search customers by name" : "Search conversations"}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.8rem',
                border: '1.5px solid #B8B8B8',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <p>
              {isSeller 
                ? "This is where you will see your conversations with your customers." 
                : "This is where you will see your conversations with vendors."
              }
            </p>
            
          </div>
        )}
        {activeTab === 'payments' && isSeller && (
          <div>
            <p>Payments functionality coming soon.</p>
          </div>
        )}
      </div>
      <style>
        {`
          @media (max-width: 700px) {
            .messages-card {
              max-width: 98vw !important;
              padding: 1.2rem 0.5rem !important;
              border-radius: 6px !important;
            }
          }
          @media (max-width: 400px) {
            .messages-card {
              padding: 0.5rem 0.2rem !important;
              font-size: 0.95rem !important;
            }
          }
        `}
      </style>
    </div>
  );
}

export default MessagesPage;