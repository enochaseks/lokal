import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import PushNotificationSettings from './PushNotificationSettings';

const NotificationPreferences = ({ isModal = false, onClose = null }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    messageNotifications: true,
    orderNotifications: true,
    paymentNotifications: true,
    collectionNotifications: true,
    marketingEmails: false,
    pushNotifications: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
      loadPreferences(user.uid);
    }
  }, []);

  const loadPreferences = async (userId) => {
    try {
      const prefsDoc = await getDoc(doc(db, 'userPreferences', userId));
      if (prefsDoc.exists()) {
        const data = prefsDoc.data();
        setPreferences(prev => ({
          ...prev,
          ...data.notifications
        }));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!currentUser) return;

    setSaving(true);
    try {
      const userPrefsRef = doc(db, 'userPreferences', currentUser.uid);
      const prefsDoc = await getDoc(userPrefsRef);
      
      if (prefsDoc.exists()) {
        await updateDoc(userPrefsRef, {
          notifications: preferences,
          updatedAt: new Date()
        });
      } else {
        await setDoc(userPrefsRef, {
          userId: currentUser.uid,
          notifications: preferences,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      setMessage('✅ Notification preferences saved successfully!');
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage('❌ Failed to save preferences. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (loading) {
    return (
      <div className={`notification-preferences ${isModal ? 'modal-style' : ''}`}>
        <div className="loading-spinner">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className={`notification-preferences ${isModal ? 'modal-style' : ''}`}>
      <style jsx>{`
        .notification-preferences {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .modal-style {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10000;
          max-height: 80vh;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 9999;
        }
        
        .preferences-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .preferences-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
          margin: 0;
        }
        
        .close-button {
          background: #f3f4f6;
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 14px;
          color: #6b7280;
        }
        
        .close-button:hover {
          background: #e5e7eb;
        }
        
        .preference-section {
          margin-bottom: 25px;
        }
        
        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .preference-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        
        .preference-item:last-child {
          border-bottom: none;
        }
        
        .preference-info {
          flex: 1;
        }
        
        .preference-name {
          font-weight: 500;
          color: #1f2937;
          margin-bottom: 4px;
        }
        
        .preference-description {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.4;
        }
        
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
        }
        
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e1;
          transition: 0.3s;
          border-radius: 24px;
        }
        
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        
        input:checked + .toggle-slider {
          background-color: #4f46e5;
        }
        
        input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }
        
        .save-section {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .save-button {
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .save-button:hover:not(:disabled) {
          background: #4338ca;
          transform: translateY(-1px);
        }
        
        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .message {
          padding: 10px 15px;
          border-radius: 6px;
          font-weight: 500;
          animation: fadeIn 0.3s;
        }
        
        .message.success {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        
        .message.error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
        }
        
        .loading-spinner {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media (max-width: 640px) {
          .notification-preferences {
            margin: 10px;
            padding: 15px;
          }
          
          .modal-style {
            top: 20px;
            left: 10px;
            right: 10px;
            transform: none;
            max-height: calc(100vh - 40px);
          }
          
          .preference-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .toggle-switch {
            align-self: flex-end;
          }
        }
      `}</style>

      {isModal && (
        <div className="modal-overlay" onClick={onClose}></div>
      )}

      <div className="preferences-header">
        <h2 className="preferences-title">📧 Notification Preferences</h2>
        {isModal && (
          <button className="close-button" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className="preference-section">
        <div className="section-title">
          📱 Email Notifications
        </div>
        
        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-name">Enable Email Notifications</div>
            <div className="preference-description">
              Receive email notifications for all Lokal activities
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.emailNotifications}
              onChange={() => handleToggle('emailNotifications')}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-name">Message Notifications</div>
            <div className="preference-description">
              Get notified when you receive new messages from buyers or sellers
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.messageNotifications}
              disabled={!preferences.emailNotifications}
              onChange={() => handleToggle('messageNotifications')}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-name">Order Notifications</div>
            <div className="preference-description">
              Notifications for order status updates, collection reminders, and delivery updates
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.orderNotifications}
              disabled={!preferences.emailNotifications}
              onChange={() => handleToggle('orderNotifications')}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-name">Payment Notifications</div>
            <div className="preference-description">
              Alerts for payment confirmations, receipts, and transaction updates
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.paymentNotifications}
              disabled={!preferences.emailNotifications}
              onChange={() => handleToggle('paymentNotifications')}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-name">Collection Notifications</div>
            <div className="preference-description">
              Updates when items are ready for collection and pickup reminders
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.collectionNotifications}
              disabled={!preferences.emailNotifications}
              onChange={() => handleToggle('collectionNotifications')}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="preference-section">
        <div className="section-title">
          � Push Notifications
        </div>
        <div style={{ marginTop: '15px' }}>
          <PushNotificationSettings />
        </div>
      </div>

      <div className="preference-section">
        <div className="section-title">
          �📢 Marketing & Updates
        </div>
        
        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-name">Marketing Emails</div>
            <div className="preference-description">
              Promotional emails, feature updates, and Lokal community news
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.marketingEmails}
              onChange={() => handleToggle('marketingEmails')}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="save-section">
        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
        
        <button
          className="save-button"
          onClick={savePreferences}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default NotificationPreferences;