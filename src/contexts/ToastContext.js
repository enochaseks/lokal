import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Component that displays in the CENTER of screen
const Toast = ({ toast, onRemove }) => {
  const getToastStyle = (type) => {
    const baseStyle = {
      position: 'fixed',
      top: '80px', // Below the navbar (navbar is 60px + some margin)
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10001, // Just above navbar's 9999
      padding: '20px 30px',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: '500',
      textAlign: 'center',
      minWidth: '300px',
      maxWidth: '500px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
      animation: 'toastFadeIn 0.3s ease-out',
      backdropFilter: 'blur(10px)',
      border: '2px solid',
      cursor: 'pointer',
      pointerEvents: 'auto',
      isolation: 'isolate',
      // Force the element to create its own layer
      willChange: 'transform',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      // Ensure it's in its own stacking context
      contain: 'layout style paint'
    };

    switch (type) {
      case 'success':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          borderColor: '#34d399'
        };
      case 'error':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          borderColor: '#f87171'
        };
      case 'warning':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          borderColor: '#fbbf24'
        };
      case 'info':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          borderColor: '#60a5fa'
        };
      default:
        return baseStyle;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '';
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes toastFadeIn {
            from {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.8);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
          }
        `}
      </style>
      <div 
        style={{
          ...getToastStyle(toast.type),
          pointerEvents: 'auto' // Re-enable pointer events for the toast itself
        }}
        onClick={() => onRemove(toast.id)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{getIcon(toast.type)}</span>
          <span>{toast.message}</span>
        </div>
        <div style={{ 
          fontSize: '12px', 
          marginTop: '8px', 
          opacity: 0.8,
          fontWeight: 'normal'
        }}>
          Click to dismiss
        </div>
      </div>
    </>
  );
};

// Toast Container that renders all active toasts using Portal
const ToastContainer = ({ toasts, onRemove }) => {
  const [portalElement, setPortalElement] = useState(null);

  useEffect(() => {
    // Create or get the toast portal element
    let element = document.getElementById('toast-portal');
    if (!element) {
      element = document.createElement('div');
      element.id = 'toast-portal';
      element.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 2147483647;
        isolation: isolate;
        will-change: transform;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        contain: layout style paint;
      `;
      document.body.appendChild(element);
      console.log('🍞 Toast portal created with z-index:', element.style.zIndex);
    }
    setPortalElement(element);

    return () => {
      // Clean up when component unmounts
      if (element && element.parentNode && toasts.length === 0) {
        element.parentNode.removeChild(element);
      }
    };
  }, [toasts.length]);

  if (toasts.length === 0 || !portalElement) return null;

  // Only show the most recent toast to avoid overlapping in center
  const latestToast = toasts[toasts.length - 1];

  return createPortal(
    <Toast toast={latestToast} onRemove={onRemove} />,
    portalElement
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      message,
      type,
      duration
    };

    // Clear existing toasts and show new one (center screen works better with one at a time)
    setToasts([toast]);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message, duration = 4000) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message, duration = 6000) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const showWarning = useCallback((message, duration = 5000) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const showInfo = useCallback((message, duration = 4000) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAllToasts
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};