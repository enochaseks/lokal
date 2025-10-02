import React from 'react';

const LimitedStripeIntegration = ({ 
  currentUser, 
  countryCode,
  countryName,
  fallbackMessage,
  region
}) => {
  const handleContactSupport = () => {
    const subject = encodeURIComponent(`Seller Account Setup Request - ${countryName}`);
    const body = encodeURIComponent(`Hi Support Team,

I'm trying to set up seller payments for my shop. I'm located in ${countryName} (${countryCode}) where Stripe payments work for customers, but I can't create a Connect account automatically.

My details:
- Email: ${currentUser?.email}
- User ID: ${currentUser?.uid}
- Country: ${countryName} (${countryCode})
- Region: ${region}

Can you help me set up manual payouts so I can start receiving payments from customers?

Thanks!`);
    
    window.open(`mailto:support@lokal.com?subject=${subject}&body=${body}`);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      borderRadius: '16px',
      padding: '28px',
      color: 'white',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background elements */}
      <div style={{
        position: 'absolute',
        top: '-30px',
        right: '-30px',
        width: '80px',
        height: '80px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        zIndex: 1
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-15px',
        left: '-15px',
        width: '50px',
        height: '50px',
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
            <span style={{ fontSize: '24px' }}>⚡</span>
          </div>
          <div>
            <h3 style={{
              fontSize: '22px',
              fontWeight: '600',
              margin: '0 0 4px 0',
              color: 'white'
            }}>
              Good news from {countryName}! 🎉
            </h3>
            <p style={{
              fontSize: '14px',
              margin: '0',
              color: 'rgba(255, 255, 255, 0.9)'
            }}>
              Customers can pay you, but we need to set up payouts manually
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
            <span style={{ fontSize: '20px', marginRight: '12px' }}>💳</span>
            <div>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 8px 0',
                color: 'white'
              }}>
                What works in {region}:
              </h4>
              <div style={{ display: 'grid', gap: '6px' }}>
                {[
                  '✅ Customers can pay with credit cards',
                  '✅ Secure Stripe payment processing',
                  '✅ All major payment methods accepted',
                  '✅ Instant payment confirmation'
                ].map((item, index) => (
                  <div key={index} style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.95)'
                  }}>
                    {item}
                  </div>
                ))}
              </div>
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
            margin: '0 0 8px 0',
            color: 'white'
          }}>
            📋 What we'll handle for you:
          </h4>
          <p style={{
            fontSize: '14px',
            margin: '0',
            lineHeight: '1.5',
            color: 'rgba(255, 255, 255, 0.9)'
          }}>
            {fallbackMessage}
          </p>
        </div>

        <div style={{
          background: 'rgba(34, 197, 94, 0.15)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          border: '1px solid rgba(34, 197, 94, 0.3)'
        }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            color: 'white'
          }}>
            🚀 You can still do everything:
          </h4>
          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              { icon: '🏪', text: 'Create your shop and list products' },
              { icon: '💰', text: 'Receive payments from customers' },
              { icon: '📦', text: 'Manage orders and deliveries' },
              { icon: '📊', text: 'Track sales and performance' }
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
            🤝 Set up manual payouts
          </button>
          
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            textAlign: 'center'
          }}>
            <p style={{
              fontSize: '13px',
              margin: '0',
              color: 'rgba(255, 255, 255, 0.9)'
            }}>
              💡 <strong>Pro tip:</strong> While we set up your payouts, you can start building your shop and attracting customers!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LimitedStripeIntegration;