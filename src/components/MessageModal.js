import React from 'react';

const MessageModal = ({ 
  isOpen, 
  onClose, 
  type = 'info', // 'info', 'warning', 'error', 'success'
  title, 
  message,
  details = [],
  primaryButtonText = 'OK',
  secondaryButtonText = null,
  onPrimaryAction = null,
  onSecondaryAction = null
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          headerBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          icon: '✅',
          iconBg: '#dcfce7',
          iconColor: '#16a34a'
        };
      case 'error':
        return {
          headerBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          icon: '❌',
          iconBg: '#fee2e2',
          iconColor: '#dc2626'
        };
      case 'warning':
        return {
          headerBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          icon: '⚠️',
          iconBg: '#fef3c7',
          iconColor: '#d97706'
        };
      case 'info':
      default:
        return {
          headerBg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          icon: 'ℹ️',
          iconBg: '#dbeafe',
          iconColor: '#2563eb'
        };
    }
  };

  if (!isOpen) return null;

  const typeStyles = getTypeStyles();

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
        maxWidth: '500px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        transform: 'scale(1)',
        animation: 'modalAppear 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          background: typeStyles.headerBg,
          color: 'white',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: typeStyles.iconBg,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '1.5rem'
          }}>
            {typeStyles.icon}
          </div>
          
          {title && (
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              margin: 0,
              marginBottom: '0.5rem'
            }}>
              {title}
            </h2>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {message && (
            <div style={{
              fontSize: '0.975rem',
              color: '#374151',
              lineHeight: '1.6',
              marginBottom: details.length > 0 ? '1.5rem' : '0',
              textAlign: 'center'
            }}>
              {message}
            </div>
          )}

          {/* Details List */}
          {details.length > 0 && (
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              border: '1px solid #e2e8f0'
            }}>
              {details.map((detail, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  marginBottom: index < details.length - 1 ? '0.5rem' : '0',
                  fontSize: '0.875rem',
                  color: '#6b7280'
                }}>
                  <span style={{ 
                    color: typeStyles.iconColor,
                    fontWeight: '600',
                    flexShrink: 0
                  }}>
                    •
                  </span>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {secondaryButtonText && (
              <button
                onClick={onSecondaryAction || onClose}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#f3f4f6';
                }}
              >
                {secondaryButtonText}
              </button>
            )}
            
            <button
              onClick={onPrimaryAction || onClose}
              style={{
                padding: '0.75rem 1.5rem',
                background: typeStyles.headerBg,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: '100px'
              }}
            >
              {primaryButtonText}
            </button>
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes modalAppear {
            0% { 
              opacity: 0;
              transform: scale(0.9) translateY(-10px);
            }
            100% { 
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default MessageModal;