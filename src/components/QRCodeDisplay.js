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
    
    // Create a canvas to draw the full page
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size (A4-like ratio but smaller for practical use)
    canvas.width = 800;
    canvas.height = 1000;
    
    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Load the Lokal logo
    const logoImage = new Image();
    logoImage.onload = () => {
      // Draw logo at the top (centered)
      const logoHeight = 120;
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      const logoX = (canvas.width - logoWidth) / 2;
      ctx.drawImage(logoImage, logoX, 40, logoWidth, logoHeight);
      
      // Add tagline below logo
      ctx.fillStyle = '#666666';
      ctx.font = '18px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Find African & Caribbean Stores Near You', canvas.width / 2, 190);
      
      // Add store name
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.textAlign = 'center';
      const storeName_display = storeName || 'Store';
      ctx.fillText(storeName_display, canvas.width / 2, 250);
      
      // Add instruction text
      ctx.fillStyle = '#666666';
      ctx.font = '24px Arial, sans-serif';
      ctx.fillText(`Scan here to check out`, canvas.width / 2, 300);
      ctx.fillText(`${storeName_display} on Lokal`, canvas.width / 2, 330);
      
      // Create QR code image and draw it on canvas
      const qrImage = new Image();
      qrImage.onload = () => {
        // Draw QR code centered
        const qrSize = 400;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = 380;
        
        // Draw white background for QR code
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);
        
        // Add border
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);
        
        // Draw QR code
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
        
        // Add footer instructions
        ctx.fillStyle = '#666666';
        ctx.font = '18px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('1. Open your phone camera', canvas.width / 2, 850);
        ctx.fillText('2. Point at the QR code above', canvas.width / 2, 880);
        ctx.fillText('3. Tap the link that appears', canvas.width / 2, 910);
        
        // Add website URL
        ctx.fillStyle = '#007B7F';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillText('lokalshops.co.uk', canvas.width / 2, 960);
        
        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `${storeName || 'store'}-lokal-qr-page.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      
      qrImage.src = qrCodeDataURL;
    };
    
    // Load the logo from the public directory
    logoImage.src = '/images/logo png.png';
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
              Download QR Page
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