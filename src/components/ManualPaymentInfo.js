import React from 'react';
import { getCountryName } from '../utils/countryDetection';

const ManualPaymentInfo = ({ 
  countryCode, 
  paymentProvider, 
  showInModal = false,
  onClose 
}) => {
  const countryName = getCountryName(countryCode);
  
  const InfoContent = () => (
    <div style={{
      background: showInModal ? 'white' : '#fef3c7',
      padding: '20px',
      borderRadius: '12px',
      border: showInModal ? '1px solid #e5e7eb' : '1px solid #f59e0b',
      maxWidth: showInModal ? 'none' : '600px',
      margin: showInModal ? 0 : '20px auto'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <span style={{ fontSize: '24px', marginRight: '12px' }}>🌍</span>
        <h3 style={{
          margin: 0,
          color: '#92400e',
          fontSize: '1.3rem'
        }}>
          Manual Payment Processing for {countryName}
        </h3>
      </div>
      
      <div style={{
        background: showInModal ? '#f8f9fa' : 'rgba(255, 255, 255, 0.8)',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <h4 style={{
          margin: '0 0 12px 0',
          color: '#374151',
          fontSize: '1.1rem'
        }}>
          What this means for you:
        </h4>
        <ul style={{
          margin: 0,
          paddingLeft: '20px',
          color: '#4b5563',
          lineHeight: '1.6'
        }}>
          <li>✅ <strong>You can still create your shop</strong> - showcase products and connect with customers</li>
          <li>🛍️ <strong>Customers can browse</strong> - they'll see your products and can contact you</li>
          <li>📧 <strong>Order notifications</strong> - you'll be notified when someone wants to buy</li>
          <li>🤝 <strong>Manual payment assistance</strong> - our support team will help process payments</li>
          <li>💳 <strong>Multiple payment options</strong> - bank transfer, mobile money, or cash collection</li>
        </ul>
      </div>
      
      <div style={{
        background: showInModal ? '#e0f2fe' : '#dcfdf4',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '16px',
        border: `1px solid ${showInModal ? '#0284c7' : '#16a34a'}`
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '16px', marginRight: '8px' }}>🚀</span>
          <div>
            <h4 style={{
              margin: '0 0 8px 0',
              color: showInModal ? '#075985' : '#14532d',
              fontSize: '1rem'
            }}>
              How it works:
            </h4>
            <ol style={{
              margin: 0,
              paddingLeft: '20px',
              color: showInModal ? '#0c4a6e' : '#166534'
            }}>
              <li>Create your shop and add products</li>
              <li>Customer finds your shop and wants to buy</li>
              <li>You receive an order notification via email</li>
              <li>Our support team contacts you to arrange payment</li>
              <li>Payment is processed (bank transfer, mobile money, etc.)</li>
              <li>You fulfill the order and ship to customer</li>
            </ol>
          </div>
        </div>
      </div>
      
      <div style={{
        background: showInModal ? '#fef3c7' : 'rgba(245, 158, 11, 0.1)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #f59e0b'
      }}>
        <p style={{
          margin: 0,
          color: '#92400e',
          fontSize: '0.9rem',
          fontStyle: 'italic',
          textAlign: 'center'
        }}>
          💡 We're actively working to bring automatic payment processing to {countryName}. 
          You'll be among the first to know when it's available!
        </p>
      </div>
      
      {showInModal && onClose && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '20px'
        }}>
          <button
            onClick={onClose}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Got it, thanks!
          </button>
        </div>
      )}
    </div>
  );

  if (showInModal) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}>
          <InfoContent />
        </div>
      </div>
    );
  }

  return <InfoContent />;
};

export default ManualPaymentInfo;