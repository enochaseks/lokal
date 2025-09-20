import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

function QRCodeDisplay({ storeId, storeName, size = 200, showDownload = true, style = {} }) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    generateQRCode();
  }, [storeId]);

  const generateQRCode = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Create the URL that customers will navigate to using the existing store-preview route
      const storeURL = `${window.location.origin}/store-preview/${storeId}`;
      
      // Generate QR code
      const options = {
        width: size,
        margin: 2,
        color: {
          dark: '#1C1C1C',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      };
      
      const dataURL = await QRCode.toDataURL(storeURL, options);
      setQrCodeDataURL(dataURL);
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataURL) return;
    
    const link = document.createElement('a');
    link.download = `${storeName || 'store'}-qr-code.png`;
    link.href = qrCodeDataURL;
    link.click();
  };

  const copyStoreLink = async () => {
    try {
      const storeURL = `${window.location.origin}/store-preview/${storeId}`;
      await navigator.clipboard.writeText(storeURL);
      alert('Store link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      alert('Failed to copy link');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: size,
        height: size,
        border: '2px dashed #B8B8B8',
        borderRadius: '8px',
        ...style 
      }}>
        <span style={{ color: '#666' }}>Generating QR Code...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: size,
        height: size,
        border: '2px dashed #ff4444',
        borderRadius: '8px',
        color: '#ff4444',
        ...style 
      }}>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '1rem',
      ...style 
    }}>
      <div style={{
        padding: '1rem',
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #E0E0E0'
      }}>
        <img 
          src={qrCodeDataURL} 
          alt={`QR Code for ${storeName || 'store'}`}
          style={{ 
            display: 'block',
            borderRadius: '8px'
          }}
        />
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <p style={{ 
          margin: '0 0 0.5rem 0', 
          fontSize: '0.9rem', 
          color: '#666',
          fontWeight: '500'
        }}>
          Scan to visit this store
        </p>
        
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {showDownload && (
            <button
              onClick={downloadQRCode}
              style={{
                padding: '0.5rem 1rem',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
            >
              Download QR
            </button>
          )}
          
          <button
            onClick={copyStoreLink}
            style={{
              padding: '0.5rem 1rem',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#1976D2'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#2196F3'}
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}

export default QRCodeDisplay;