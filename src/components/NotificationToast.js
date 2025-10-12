import React, { useEffect, useState } from 'react';

const NotificationToast = ({ 
  isVisible, 
  onClose, 
  type = 'success', // 'success', 'error', 'info', 'warning'
  title, 
  message,
  autoClose = true,
  duration = 5000 
}) => {
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsShowing(true);
      
      if (autoClose) {
        const timer = setTimeout(() => {
          handleClose();
        }, duration);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, autoClose, duration]);

  const handleClose = () => {
    setIsShowing(false);
    setTimeout(() => {
      onClose();
    }, 300); // Wait for animation to complete
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          icon: '✅'
        };
      case 'error':
        return {
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          icon: '❌'
        };
      case 'warning':
        return {
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          icon: '⚠️'
        };
      case 'info':
        return {
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          icon: 'ℹ️'
        };
      default:
        return {
          background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          icon: '📝'
        };
    }
  };

  if (!isVisible) return null;

  const typeStyles = getTypeStyles();

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: isShowing ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.8)',
      zIndex: 3000,
      opacity: isShowing ? 1 : 0,
      transition: 'all 0.3s ease-in-out',
      maxWidth: '400px',
      width: '90%'
    }}>
      <div style={{
        background: typeStyles.background,
        color: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem'
        }}>
          <div style={{ 
            fontSize: '1.25rem',
            flexShrink: 0,
            marginTop: '0.125rem'
          }}>
            {typeStyles.icon}
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <div style={{
                fontWeight: '600',
                fontSize: '0.875rem',
                marginBottom: '0.25rem',
                lineHeight: '1.25'
              }}>
                {title}
              </div>
            )}
            
            {message && (
              <div style={{
                fontSize: '0.875rem',
                opacity: 0.95,
                lineHeight: '1.4',
                wordBreak: 'break-word'
              }}>
                {message}
              </div>
            )}
          </div>
          
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              padding: '0.25rem',
              fontSize: '0.875rem',
              lineHeight: 1,
              flexShrink: 0,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            ×
          </button>
        </div>

        {/* Progress bar for auto-close */}
        {autoClose && (
          <div style={{
            height: '3px',
            background: 'rgba(255, 255, 255, 0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              background: 'rgba(255, 255, 255, 0.6)',
              animation: `shrink ${duration}ms linear`,
              transformOrigin: 'left'
            }} />
          </div>
        )}
      </div>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes shrink {
            0% { transform: scaleX(1); }
            100% { transform: scaleX(0); }
          }
        `}
      </style>
    </div>
  );
};

export default NotificationToast;