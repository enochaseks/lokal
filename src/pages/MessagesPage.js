import React, { useState } from 'react';
import Navbar from '../components/Navbar';

function MessagesPage() {
  const [activeTab, setActiveTab] = useState('messages');
  const [search, setSearch] = useState('');

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
              flex: 1,
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
        </div>
        {activeTab === 'messages' && (
          <div>
            <input
              type="text"
              placeholder="Search customers by store name"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.7rem 1rem',
                border: '1.5px solid #B8B8B8',
                borderRadius: 8,
                marginBottom: 24,
                fontSize: '1rem',
                outline: 'none',
              }}
            />
            <p>This is where you will see your conversations with other users.</p>
          </div>
        )}
        {activeTab === 'payments' && (
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