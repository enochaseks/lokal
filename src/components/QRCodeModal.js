import React from 'react';
import QRCodeDisplay from './QRCodeDisplay';

function QRCodeModal({ isOpen, onClose, storeId, storeName }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        background: 'rgba(0,0,0,0.5)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 1000,
        backdropFilter: 'blur(2px)'
      }}
      onClick={handleBackdropClick}
    >
      <div style={{ 
        background: '#fff', 
        borderRadius: 16, 
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)', 
        padding: '2rem', 
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        textAlign: 'center',
        position: 'relative',
        animation: 'modalSlideIn 0.3s ease-out'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#666',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#f0f0f0';
            e.target.style.color = '#333';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.color = '#666';
          }}
        >
          ×
        </button>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ 
            fontSize: '2rem', 
            marginBottom: '0.5rem' 
          }}>📱</div>
          <h2 style={{ 
            color: '#007B7F', 
            marginBottom: '0.5rem',
            fontSize: '1.4rem',
            fontWeight: '600'
          }}>
            Store QR Code
          </h2>
          <h3 style={{ 
            color: '#333', 
            fontSize: '1.1rem',
            marginBottom: '0.5rem',
            fontWeight: '500'
          }}>
            {storeName}
          </h3>
          <p style={{ 
            color: '#666', 
            fontSize: '0.95rem',
            marginBottom: '1.5rem',
            lineHeight: '1.4',
            maxWidth: '400px',
            margin: '0 auto 1.5rem auto'
          }}>
            Share this QR code with customers so they can easily find and visit your store on the platform
          </p>
        </div>
        
        <div style={{ 
          background: '#f8f9ff', 
          borderRadius: 12, 
          padding: '1.5rem', 
          marginBottom: '1rem',
          border: '2px dashed #007B7F'
        }}>
          <QRCodeDisplay 
            storeId={storeId}
            storeName={storeName}
            size={200}
            showDownload={true}
          />
        </div>

        <div style={{ 
          fontSize: '0.85rem', 
          color: '#888',
          fontStyle: 'italic'
        }}>
          Customers can scan this code with their phone camera
        </div>
      </div>

      <style jsx>{`
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default QRCodeModal;