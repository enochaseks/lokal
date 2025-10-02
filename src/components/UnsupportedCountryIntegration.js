import React from 'react';

const UnsupportedCountryIntegration = ({ 
  currentUser, 
  countryCode,
  countryName,
  fallbackMessage
}) => {
  const handleContactSupport = () => {
    // Open email or contact form
    const subject = encodeURIComponent(`Payment Setup Request - ${countryName}`);
    const body = encodeURIComponent(`Hi Support Team,

I'm trying to set up payments for my shop but I'm located in ${countryName} (${countryCode}) where automatic payment processing isn't available yet.

My email: ${currentUser?.email}
User ID: ${currentUser?.uid}

Can you help me set up manual payments or let me know when automatic payments will be available in my country?

Thanks!`);
    
    window.open(`mailto:support@lokal.com?subject=${subject}&body=${body}`);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #6b46c1 0%, #553c9a 100%)',
      borderRadius: '16px',
      padding: '28px',
      color: 'white',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background elements */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '100px',
        height: '100px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        zIndex: 1
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-20px',
        left: '-20px',
        width: '60px',
        height: '60px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '50%',
        zIndex: 1
      }}></div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '12px',
            marginRight: '16px'
          }}>
            <span style={{ fontSize: '24px' }}>🌏</span>
          </div>
          <div>
            <h3 style={{
              fontSize: '22px',
              fontWeight: '600',
              margin: '0 0 4px 0',
              color: 'white'
            }}>
              Hello from {countryName}! 👋
            </h3>
            <p style={{
              fontSize: '14px',
              margin: '0',
              color: 'rgba(255, 255, 255, 0.9)'
            }}>
              We're working on bringing payments to your region
            </p>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '20px', marginRight: '12px' }}>💡</span>
            <div>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 8px 0',
                color: 'white'
              }}>
                Here's what we can do right now:
              </h4>
              <p style={{
                fontSize: '14px',
                margin: '0',
                lineHeight: '1.5',
                color: 'rgba(255, 255, 255, 0.95)'
              }}>
                {fallbackMessage}
              </p>
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(59, 130, 246, 0.15)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            color: 'white'
          }}>
            🚀 What you can still do:
          </h4>
          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              { icon: '🏪', text: 'Create your shop and start listing products' },
              { icon: '💬', text: 'Chat with customers and take orders' },
              { icon: '📦', text: 'Manage inventory and deliveries' },
              { icon: '💰', text: 'We\'ll handle payments manually until automation is ready' }
            ].map((item, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.95)'
              }}>
                <span style={{ marginRight: '8px', fontSize: '16px' }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          <button
            onClick={handleContactSupport}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.25)',
              color: 'white',
              padding: '14px 20px',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.3)';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.25)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            📧 Contact Support for Manual Setup
          </button>
          
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            textAlign: 'center'
          }}>
            <p style={{
              fontSize: '13px',
              margin: '0',
              color: 'rgba(255, 255, 255, 0.9)'
            }}>
              💚 <strong>Good news:</strong> You can still start selling today! We'll sort out the payment details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnsupportedCountryIntegration;