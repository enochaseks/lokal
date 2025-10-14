import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import pushNotificationService from '../services/pushNotificationService';

const PushNotificationSettings = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('');
  const [browser, setBrowser] = useState('');

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    setLoading(true);
    
    // Check if notifications are supported
    const supported = pushNotificationService.isSupported();
    setIsSupported(supported);

    if (!supported) {
      setLoading(false);
      return;
    }

    // Get permission status
    const status = pushNotificationService.getPermissionStatus();
    setPermissionStatus(status);
    setIsEnabled(status === 'granted');

    // Get platform and browser info
    setPlatform(pushNotificationService.getPlatform());
    setBrowser(pushNotificationService.getBrowser());

    setLoading(false);
  };

  const handleToggle = async () => {
    const auth = getAuth();
    if (!auth.currentUser) {
      alert('Please log in to enable push notifications');
      return;
    }

    if (!isEnabled) {
      // Enable notifications
      setLoading(true);
      try {
        const initialized = await pushNotificationService.initialize();
        if (!initialized) {
          alert('Failed to initialize push notifications');
          return;
        }

        const granted = await pushNotificationService.requestPermission();
        if (granted) {
          const token = await pushNotificationService.getToken();
          if (token) {
            setIsEnabled(true);
            setPermissionStatus('granted');
            alert('✅ Push notifications enabled successfully!');
          } else {
            alert('Failed to get notification token');
          }
        } else {
          setPermissionStatus('denied');
          alert('Push notifications were blocked. Please enable them in your browser settings.');
        }
      } catch (error) {
        console.error('Error enabling notifications:', error);
        alert('An error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      // Disable notifications
      if (window.confirm('Are you sure you want to disable push notifications?')) {
        setLoading(true);
        try {
          await pushNotificationService.deleteToken();
          setIsEnabled(false);
          alert('Push notifications disabled');
        } catch (error) {
          console.error('Error disabling notifications:', error);
          alert('An error occurred. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  if (loading && permissionStatus === 'default') {
    return (
      <div style={{
        padding: '20px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <p>Loading notification settings...</p>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div style={{
        padding: '20px',
        background: '#fff3cd',
        borderRadius: '12px',
        border: '1px solid #ffc107'
      }}>
        <h3 style={{ marginTop: 0, color: '#856404' }}>⚠️ Not Supported</h3>
        <p style={{ color: '#856404', marginBottom: 0 }}>
          Push notifications are not supported in your current browser.
          Please try using Chrome, Firefox, Safari, or Edge.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
    }}>
      <style jsx>{`
        .notification-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .notification-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .notification-title h3 {
          margin: 0;
          font-size: 20px;
          color: #2d3748;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 56px;
          height: 30px;
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
          background-color: #cbd5e0;
          transition: 0.3s;
          border-radius: 30px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 22px;
          width: 22px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }

        input:disabled + .toggle-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notification-info {
          background: #f7fafc;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          color: #718096;
          font-weight: 500;
        }

        .info-value {
          color: #2d3748;
          font-weight: 600;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-granted {
          background: #d4edda;
          color: #155724;
        }

        .status-denied {
          background: #f8d7da;
          color: #721c24;
        }

        .status-default {
          background: #d1ecf1;
          color: #0c5460;
        }

        .notification-description {
          color: #4a5568;
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .notification-benefits {
          background: #f7fafc;
          padding: 16px;
          border-radius: 8px;
          margin-top: 20px;
        }

        .notification-benefits h4 {
          margin: 0 0 12px 0;
          color: #2d3748;
          font-size: 16px;
        }

        .notification-benefits ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .notification-benefits li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          color: #4a5568;
          font-size: 14px;
        }

        .benefit-icon {
          font-size: 18px;
        }
      `}</style>

      <div className="notification-header">
        <div className="notification-title">
          <span style={{ fontSize: '28px' }}>🔔</span>
          <h3>Push Notifications</h3>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={handleToggle}
            disabled={loading || permissionStatus === 'denied'}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <p className="notification-description">
        Receive real-time notifications about messages, orders, payments, and more—even when you're not using Lokal.
      </p>

      <div className="notification-info">
        <div className="info-row">
          <span className="info-label">Status:</span>
          <span className={`status-badge status-${permissionStatus}`}>
            {permissionStatus === 'granted' && '✅ Enabled'}
            {permissionStatus === 'denied' && '❌ Blocked'}
            {permissionStatus === 'default' && '⏳ Not Set'}
          </span>
        </div>
        {platform && (
          <div className="info-row">
            <span className="info-label">Platform:</span>
            <span className="info-value">{platform}</span>
          </div>
        )}
        {browser && (
          <div className="info-row">
            <span className="info-label">Browser:</span>
            <span className="info-value">{browser}</span>
          </div>
        )}
      </div>

      {permissionStatus === 'denied' && (
        <div style={{
          background: '#fff3cd',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #ffc107'
        }}>
          <h4 style={{ marginTop: 0, color: '#856404' }}>⚠️ Notifications Blocked</h4>
          <p style={{ color: '#856404', marginBottom: 0, fontSize: '14px' }}>
            You've blocked notifications. To enable them, please update your browser settings:
            <br /><br />
            <strong>Chrome/Edge:</strong> Click the lock icon in the address bar → Site settings → Notifications → Allow
            <br />
            <strong>Firefox:</strong> Click the shield icon → Permissions → Notifications → Allow
            <br />
            <strong>Safari:</strong> Safari → Preferences → Websites → Notifications → Allow for lokalshops.co.uk
          </p>
        </div>
      )}

      <div className="notification-benefits">
        <h4>You'll be notified about:</h4>
        <ul>
          <li>
            <span className="benefit-icon">💬</span>
            <span>New messages from buyers and sellers</span>
          </li>
          <li>
            <span className="benefit-icon">📦</span>
            <span>Order updates and confirmations</span>
          </li>
          <li>
            <span className="benefit-icon">💳</span>
            <span>Payment receipts and confirmations</span>
          </li>
          <li>
            <span className="benefit-icon">⭐</span>
            <span>New reviews on your store</span>
          </li>
          <li>
            <span className="benefit-icon">🚀</span>
            <span>Store boost status updates</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PushNotificationSettings;
