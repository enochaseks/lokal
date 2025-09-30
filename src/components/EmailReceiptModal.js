import React, { useState } from 'react';

const EmailReceiptModal = ({ 
  isOpen, 
  onClose, 
  onSend, 
  isLoading = false,
  defaultEmail = '',
  receiptDetails = {}
}) => {
  const [email, setEmail] = useState(defaultEmail);
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    
    if (emailError && validateEmail(value)) {
      setEmailError('');
    }
  };

  const handleSend = () => {
    if (!email.trim()) {
      setEmailError('Email address is required');
      return;
    }
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    onSend(email);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📧</div>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            margin: 0,
            marginBottom: '0.25rem'
          }}>
            Send Receipt via Email
          </h2>
          <p style={{ 
            opacity: 0.9, 
            fontSize: '0.875rem', 
            margin: 0 
          }}>
            Professional receipt will be sent to the email address below
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Receipt Preview */}
          {receiptDetails.orderId && (
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ 
                fontSize: '0.875rem', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Receipt Details:
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.5' }}>
                <div><strong>Order ID:</strong> {receiptDetails.orderId}</div>
                <div><strong>Store:</strong> {receiptDetails.storeName}</div>
                <div><strong>Amount:</strong> {receiptDetails.currency} {receiptDetails.amount}</div>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              onKeyPress={handleKeyPress}
              placeholder="Enter email address"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${emailError ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '6px',
                fontSize: '0.875rem',
                outline: 'none',
                transition: 'border-color 0.2s',
                backgroundColor: isLoading ? '#f9fafb' : 'white',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                if (!emailError) {
                  e.target.style.borderColor = '#3b82f6';
                }
              }}
              onBlur={(e) => {
                if (!emailError) {
                  e.target.style.borderColor = '#d1d5db';
                }
              }}
            />
            {emailError && (
              <div style={{
                color: '#ef4444',
                fontSize: '0.75rem',
                marginTop: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <span>⚠️</span>
                {emailError}
              </div>
            )}
          </div>

          {/* Info Note */}
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#1e40af',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem'
            }}>
              <span style={{ marginTop: '0.125rem' }}>💡</span>
              <div>
                The receipt will be sent as a professional email with all transaction details, 
                including itemized breakdown and store information.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isLoading || !email.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                background: isLoading || !email.trim() 
                  ? '#9ca3af' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: isLoading || !email.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                minWidth: '120px',
                justifyContent: 'center'
              }}
            >
              {isLoading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span>📧</span>
                  <span>Send Receipt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Add CSS animation for spinner */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default EmailReceiptModal;