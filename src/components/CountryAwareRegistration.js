import React, { useState, useEffect } from 'react';
import { detectUserCountry, getPaymentProvider, getCountryName } from '../utils/countryDetection';

const CountryAwareRegistration = ({ 
  onCountryDetected, 
  showPaymentWarning = true,
  children 
}) => {
  const [userCountry, setUserCountry] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUnsupportedWarning, setShowUnsupportedWarning] = useState(false);

  useEffect(() => {
    const detectCountryAndProvider = async () => {
      try {
        const country = await detectUserCountry();
        const provider = getPaymentProvider(country);
        
        setUserCountry(country);
        setPaymentProvider(provider);
        
        // Show warning for unsupported countries if enabled
        if (showPaymentWarning && provider.provider === 'none') {
          setShowUnsupportedWarning(true);
        }
        
        // Callback to parent component
        if (onCountryDetected) {
          onCountryDetected({
            country,
            provider,
            supportsPayments: provider.provider !== 'none',
            requiresStripe: provider.provider === 'stripe' && provider.supported
          });
        }
        
        console.log('🌍 Country detection for registration:', {
          country: getCountryName(country),
          provider: provider.provider,
          supported: provider.supported
        });
      } catch (error) {
        console.error('Error detecting country during registration:', error);
        // Default to supported country behavior
        const defaultProvider = {
          provider: 'stripe',
          supported: true,
          name: 'Stripe Connect'
        };
        
        if (onCountryDetected) {
          onCountryDetected({
            country: 'GB',
            provider: defaultProvider,
            supportsPayments: true,
            requiresStripe: true
          });
        }
      } finally {
        setLoading(false);
      }
    };

    detectCountryAndProvider();
  }, [onCountryDetected, showPaymentWarning]);

  const handleDismissWarning = () => {
    setShowUnsupportedWarning(false);
  };

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        background: '#f8f9fa',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <div style={{
          display: 'inline-block',
          width: '20px',
          height: '20px',
          border: '2px solid #3b82f6',
          borderRadius: '50%',
          borderTopColor: 'transparent',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ margin: '10px 0 0 0', color: '#666' }}>
          Detecting your location...
        </p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      {/* Unsupported Country Warning Modal */}
      {showUnsupportedWarning && (
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
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            margin: '20px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <span style={{ fontSize: '48px' }}>🌍</span>
              <h3 style={{
                margin: '10px 0',
                color: '#1f2937',
                fontSize: '1.5rem'
              }}>
                Welcome from {getCountryName(userCountry)}!
              </h3>
            </div>
            
            <div style={{
              background: '#fef3c7',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #f59e0b'
            }}>
              <h4 style={{
                margin: '0 0 12px 0',
                color: '#92400e',
                fontSize: '1.1rem'
              }}>
                Good News! You Can Still Join Lokal
              </h4>
              <p style={{
                margin: '0 0 12px 0',
                color: '#78350f',
                lineHeight: '1.5'
              }}>
                While automatic payment processing isn't available in your region yet, you can:
              </p>
              <ul style={{
                margin: '0',
                paddingLeft: '20px',
                color: '#78350f'
              }}>
                <li>✅ Create your account and profile</li>
                <li>✅ Set up your shop and showcase products</li>
                <li>✅ Connect with customers who find you</li>
                <li>📧 Get help from our team to process payments manually</li>
              </ul>
            </div>
            
            <div style={{
              background: '#e0f2fe',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #0284c7'
            }}>
              <p style={{
                margin: '0',
                color: '#075985',
                fontSize: '0.9rem',
                fontStyle: 'italic'
              }}>
                💡 We're actively working to bring automatic payments to more countries. 
                You'll be among the first to know when it's available in {getCountryName(userCountry)}!
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleDismissWarning}
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
                Continue Registration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Country Detection Info Bar */}
      {userCountry && paymentProvider && !showUnsupportedWarning && (
        <div style={{
          background: paymentProvider.supported ? 
            'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
            'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          margin: '0 0 20px 0',
          display: 'flex',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}>
          <span style={{ fontSize: '16px', marginRight: '8px' }}>
            {paymentProvider.supported ? '✅' : '🌍'}
          </span>
          <div>
            <strong>Location detected: {getCountryName(userCountry)}</strong>
            <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>
              {paymentProvider.supported ? 
                `${paymentProvider.name} available - Full payment processing` :
                'Manual payment processing - Full support available'
              }
            </div>
          </div>
        </div>
      )}

      {/* Render children */}
      {children}
    </div>
  );
};

export default CountryAwareRegistration;