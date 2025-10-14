import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import pushNotificationService from '../services/pushNotificationService';

const PushNotificationPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('default');

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    // Only show prompt if user is logged in
    if (!user) return;

    // Check if notifications are supported
    if (!pushNotificationService.isSupported()) {
      console.log('Push notifications not supported');
      return;
    }

    const status = pushNotificationService.getPermissionStatus();
    setPermissionStatus(status);

    // Show prompt if permission hasn't been granted or denied
    if (status === 'default') {
      // Check if user has dismissed the prompt recently
      const lastDismissed = localStorage.getItem('notificationPromptDismissed');
      if (lastDismissed) {
        const daysSinceDismissed = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
          // Don't show again for 7 days
          return;
        }
      }

      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 3000);
    }
  };

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      // Initialize the service
      const initialized = await pushNotificationService.initialize();
      if (!initialized) {
        alert('Push notifications are not supported in your browser');
        setShowPrompt(false);
        return;
      }

      // Request permission
      const granted = await pushNotificationService.requestPermission();
      
      if (granted) {
        // Get and save the FCM token
        const token = await pushNotificationService.getToken();
        if (token) {
          setPermissionStatus('granted');
          setShowPrompt(false);
          // Show success message
          alert('✅ Push notifications enabled! You\'ll now receive notifications even when you\'re away from the app.');
        } else {
          alert('Failed to get notification token. Please try again.');
        }
      } else {
        setPermissionStatus('denied');
        setShowPrompt(false);
        alert('Push notifications were blocked. You can enable them in your browser settings.');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      alert('An error occurred while enabling notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember that user dismissed the prompt
    localStorage.setItem('notificationPromptDismissed', Date.now().toString());
  };

  const handleRemindLater = () => {
    setShowPrompt(false);
    // Remember for 1 day
    localStorage.setItem('notificationPromptDismissed', (Date.now() - (6 * 24 * 60 * 60 * 1000)).toString());
  };

  if (!showPrompt) return null;

  return (
    <>
      <style jsx>{`
        .notification-prompt-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.3s ease-in-out;
        }

        .notification-prompt {
          background: white;
          border-radius: 16px;
          max-width: 450px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease-out;
        }

        .prompt-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 24px;
          border-radius: 16px 16px 0 0;
          text-align: center;
        }

        .prompt-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .prompt-title {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }

        .prompt-subtitle {
          font-size: 14px;
          opacity: 0.95;
          margin: 0;
        }

        .prompt-body {
          padding: 24px;
        }

        .prompt-description {
          font-size: 15px;
          color: #4a5568;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .prompt-benefits {
          list-style: none;
          padding: 0;
          margin: 0 0 24px 0;
        }

        .prompt-benefits li {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: #f7fafc;
          border-radius: 8px;
          margin-bottom: 8px;
          font-size: 14px;
          color: #2d3748;
        }

        .benefit-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .prompt-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .btn {
          padding: 14px 24px;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: #e2e8f0;
          color: #4a5568;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #cbd5e0;
        }

        .btn-text {
          background: transparent;
          color: #718096;
          font-size: 14px;
        }

        .btn-text:hover:not(:disabled) {
          color: #4a5568;
          text-decoration: underline;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 480px) {
          .notification-prompt {
            margin: 20px;
          }

          .prompt-header {
            padding: 20px;
          }

          .prompt-title {
            font-size: 20px;
          }

          .prompt-body {
            padding: 20px;
          }
        }
      `}</style>

      <div className="notification-prompt-overlay">
        <div className="notification-prompt">
          <div className="prompt-header">
            <div className="prompt-icon">🔔</div>
            <h2 className="prompt-title">Stay Connected!</h2>
            <p className="prompt-subtitle">Get instant updates on your orders and messages</p>
          </div>

          <div className="prompt-body">
            <p className="prompt-description">
              Enable push notifications to stay informed even when you're not on Lokal.
            </p>

            <ul className="prompt-benefits">
              <li>
                <span className="benefit-icon">💬</span>
                <span>New message alerts from buyers and sellers</span>
              </li>
              <li>
                <span className="benefit-icon">📦</span>
                <span>Order updates and delivery notifications</span>
              </li>
              <li>
                <span className="benefit-icon">💳</span>
                <span>Payment confirmations and receipts</span>
              </li>
              <li>
                <span className="benefit-icon">⭐</span>
                <span>New reviews and store activity</span>
              </li>
            </ul>

            <div className="prompt-actions">
              <button 
                className="btn btn-primary" 
                onClick={handleEnable}
                disabled={isLoading}
              >
                {isLoading ? '⏳ Enabling...' : '🔔 Enable Notifications'}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleRemindLater}
                disabled={isLoading}
              >
                Remind Me Later
              </button>
              <button 
                className="btn btn-text" 
                onClick={handleDismiss}
                disabled={isLoading}
              >
                No Thanks
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PushNotificationPrompt;
