import React, { useState, useEffect } from 'react';
import StripeConnectIntegration from './StripeConnectIntegration';
import PaystackIntegration from './PaystackIntegration';
import UnsupportedCountryIntegration from './UnsupportedCountryIntegration';
import LimitedStripeIntegration from './LimitedStripeIntegration';
import { detectUserCountry, getPaymentProvider, getCountryName } from '../utils/countryDetection';

const PaymentProviderSelector = ({ 
  currentUser, 
  onAccountCreated, 
  onBalanceUpdate,
  showAccountCreation = true 
}) => {
  const [userCountry, setUserCountry] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualOverride, setManualOverride] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        console.log('🗺️ Google Maps already loaded');
        setGoogleMapsLoaded(true);
        return;
      }

      console.log('🗺️ Loading Google Maps API...');
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('✅ Google Maps API loaded successfully');
        setGoogleMapsLoaded(true);
      };
      
      script.onerror = () => {
        console.warn('❌ Failed to load Google Maps API');
        setGoogleMapsLoaded(false);
      };
      
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    const detectCountryAndProvider = async () => {
      try {
        console.log('🌍 Starting enhanced country detection...');
        
        // Add timeout to prevent hanging
        const detectionPromise = detectUserCountry();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Detection timeout')), 3000)
        );

        const countryCode = await Promise.race([detectionPromise, timeoutPromise]);
        console.log('� Final detected country:', countryCode);
        
        const provider = getPaymentProvider(countryCode);
        console.log('💳 Payment provider details:', provider);
        
        setUserCountry(countryCode);
        setPaymentProvider(provider);
      } catch (error) {
        console.error('❌ Error detecting country:', error);
        // Default to Stripe for UK immediately
        console.log('🔄 Using fallback country: GB');
        setUserCountry('GB');
        setPaymentProvider(getPaymentProvider('GB'));
      } finally {
        setLoading(false);
      }
    };

    // Start detection once component mounts (don't wait for Google Maps)
    detectCountryAndProvider();
  }, []); // Remove googleMapsLoaded dependency to avoid waiting

  const switchProvider = (providerType) => {
    setManualOverride(true);
    if (providerType === 'paystack') {
      setPaymentProvider({
        provider: 'paystack',
        name: 'Paystack',
        description: 'Best for African markets',
        supported: true
      });
    } else {
      setPaymentProvider({
        provider: 'stripe',
        name: 'Stripe Connect',
        description: 'Best for UK, EU, and US markets',
        supported: true
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Detecting your location...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Render Appropriate Provider Component */}
      {paymentProvider?.provider === 'paystack' ? (
        <PaystackIntegration
          currentUser={currentUser}
          onAccountCreated={onAccountCreated}
          onBalanceUpdate={onBalanceUpdate}
          showAccountCreation={showAccountCreation}
        />
      ) : paymentProvider?.provider === 'stripe' ? (
        <StripeConnectIntegration
          currentUser={currentUser}
          onAccountCreated={onAccountCreated}
          onBalanceUpdate={onBalanceUpdate}
          showAccountCreation={showAccountCreation}
        />
      ) : paymentProvider?.provider === 'stripe_limited' || paymentProvider?.provider === 'stripe_unknown' ? (
        <LimitedStripeIntegration
          currentUser={currentUser}
          countryCode={paymentProvider.countryCode}
          countryName={getCountryName(paymentProvider.countryCode)}
          fallbackMessage={paymentProvider.fallbackMessage}
          region={paymentProvider.region}
        />
      ) : paymentProvider?.provider === 'none' ? (
        <UnsupportedCountryIntegration
          currentUser={currentUser}
          countryCode={paymentProvider.countryCode}
          countryName={getCountryName(paymentProvider.countryCode)}
          fallbackMessage={paymentProvider.fallbackMessage}
        />
      ) : paymentProvider?.supported ? (
        <StripeConnectIntegration
          currentUser={currentUser}
          onAccountCreated={onAccountCreated}
          onBalanceUpdate={onBalanceUpdate}
          showAccountCreation={showAccountCreation}
        />
      ) : (
        <div style={{
          background: '#f3f4f6',
          border: '2px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚠️</div>
          <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>
            Payment Setup Unavailable
          </h3>
          <p style={{ margin: 0, color: '#6b7280' }}>
            We're working on payment solutions for your region. Please contact support for assistance.
          </p>
        </div>
      )}

      {/* Country Detection Info - Below wallet overview */}
      <div style={{
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        borderRadius: '16px',
        padding: '20px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '60px',
          height: '60px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%'
        }}></div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 2
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '4px'
            }}>
              <span style={{ fontSize: '16px', marginRight: '8px' }}>📍</span>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                margin: '0',
                color: 'white'
              }}>
                Hey! We spotted you in {getCountryName(userCountry)}
              </h3>
            </div>
            <div>
              <p style={{
                fontSize: '13px',
                margin: '0 0 2px 0',
                color: 'rgba(255, 255, 255, 0.9)'
              }}>
                {paymentProvider?.supported ? '✅' : '⚠️'} {paymentProvider?.name} - {paymentProvider?.description}
              </p>
              {paymentProvider?.region && (
                <p style={{
                  fontSize: '11px',
                  margin: '0',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  Region: {paymentProvider.region} | 
                  Connect Accounts: {paymentProvider?.hasConnectAccounts ? 'Yes' : 'No'} | 
                  Payments: {paymentProvider?.canReceivePayments ? 'Yes' : 'Manual'}
                </p>
              )}
            </div>
          </div>
          
          {!manualOverride && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => switchProvider('stripe')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  background: paymentProvider?.provider === 'stripe' 
                    ? 'rgba(255, 255, 255, 0.25)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  backdropFilter: 'blur(10px)'
                }}
              >
                🏦 Stripe
              </button>
              <button
                onClick={() => switchProvider('paystack')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  background: paymentProvider?.provider === 'paystack' 
                    ? 'rgba(255, 255, 255, 0.25)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  backdropFilter: 'blur(10px)'
                }}
              >
                🌍 Paystack
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alternative Provider Info - Only show for supported countries */}
      {paymentProvider?.provider !== 'none' && (
        <div style={{
          background: 'white',
          border: '2px solid #f3f4f6',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151',
            margin: '0 0 16px 0',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ marginRight: '8px' }}>🔀</span>
            Want to try something else?
          </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {paymentProvider?.provider !== 'stripe' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#475569',
                fontWeight: '500'
              }}>
                🏦 Stripe Connect (UK, EU, US, etc.)
              </span>
              <button
                onClick={() => switchProvider('stripe')}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#2563eb'}
                onMouseOut={(e) => e.target.style.background = '#3b82f6'}
              >
                Switch
              </button>
            </div>
          )}
          
          {paymentProvider?.provider !== 'paystack' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #dcfce7'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#475569',
                fontWeight: '500'
              }}>
                🌍 Paystack (Nigeria, Ghana, South Africa, etc.)
              </span>
              <button
                onClick={() => switchProvider('paystack')}
                style={{
                  background: '#10b981',
                  color: 'white',
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#059669'}
                onMouseOut={(e) => e.target.style.background = '#10b981'}
              >
                Switch
              </button>
            </div>
          )}
          
          <div style={{
            paddingTop: '12px',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <span style={{
              fontSize: '13px',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ marginRight: '6px' }}>💬</span>
              Stuck? Our support team is super friendly and ready to help!
            </span>
          </div>
        </div>
        </div>
      )}

    </div>
  );
};

export default PaymentProviderSelector;