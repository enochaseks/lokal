import React, { useState, useEffect } from 'react';
import { useStripe } from '@stripe/react-stripe-js';

const StripeGooglePayButton = ({ 
  paymentData, 
  onPaymentSuccess, 
  onPaymentError, 
  processing, 
  setProcessing,
  currentUser,
  selectedConversation 
}) => {
  const stripe = useStripe();
  const [canMakePayment, setCanMakePayment] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(true);

  useEffect(() => {
    if (!stripe) {
      console.log('⚠️ Stripe not loaded yet for Google Pay, waiting...');
      setCheckingAvailability(false);
      return;
    }
    
    if (!paymentData.total) {
      console.error('❌ No payment total provided for Google Pay');
      setCheckingAvailability(false);
      return;
    }

    console.log('🔄 Initializing Google Pay with payment data:', paymentData);

    // Force check for REAL Google Pay - bypass Stripe's Link detection
    const checkRealGooglePay = async () => {
      // Check for native Google Pay API (the REAL thing)
      if (window.google && window.google.payments && window.google.payments.api) {
        console.log('✅ REAL Google Pay API detected - native wallet available');
        
        // Create payment request that will trigger REAL Google Pay
        const pr = stripe.paymentRequest({
          country: 'US',
          currency: paymentData.currency.toLowerCase(),
          total: {
            label: `Lokal Marketplace`,
            amount: Math.round(paymentData.total * 100),
          },
          displayItems: paymentData.items ? paymentData.items.map(item => ({
            label: item.name,
            amount: Math.round(item.price * 100)
          })) : [],
          requestPayerName: true,
          requestPayerEmail: true,
          requestPayerPhone: false,
          requestShipping: false,
        });
        
        // Handle payment method selection for Google Pay
        pr.on('paymentmethod', async (ev) => {
          console.log('🌐 Google Pay payment method selected');
          setProcessing(true);
          
          try {
            // Step 1: Create payment intent on backend
            console.log('🔄 Creating payment intent for Google Pay...');
            const apiUrl = process.env.NODE_ENV === 'production' 
              ? process.env.REACT_APP_PRODUCTION_API_URL 
              : process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/create-payment-intent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                amount: paymentData.total,
                currency: paymentData.currency,
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to create payment intent');
            }

            const { clientSecret, paymentIntentId } = await response.json();
            console.log('✅ Payment intent created for Google Pay:', paymentIntentId);

            // Step 2: Confirm payment with Stripe
            console.log('🔄 Confirming Google Pay payment with Stripe...');
            const { error, paymentIntent } = await stripe.confirmCardPayment(
              clientSecret,
              { payment_method: ev.paymentMethod.id },
              { handleActions: false }
            );

            if (error) {
              console.error('❌ Google Pay payment failed:', error);
              ev.complete('fail');
              throw new Error(error.message);
            } else {
              console.log('✅ Google Pay payment confirmed successfully:', paymentIntent.id);
              ev.complete('success');
              
              // Extract Google Pay info
              const googlePayInfo = {
                deviceAccount: `Google Pay ****${ev.paymentMethod.card?.last4 || '****'}`,
                transactionId: paymentIntent.id,
                brand: ev.paymentMethod.card?.brand || 'google_pay',
                last4: ev.paymentMethod.card?.last4 || '****',
                paymentNetwork: 'Google Pay'
              };

              console.log('🌐 Google Pay info extracted:', googlePayInfo);

              onPaymentSuccess({
                paymentIntentId: paymentIntent.id,
                googlePayInfo: googlePayInfo,
              });
            }
          } catch (error) {
            console.error('❌ Google Pay error:', error);
            ev.complete('fail');
            onPaymentError(error.message);
          } finally {
            setProcessing(false);
          }
        });
        
        setCanMakePayment(true);
        setPaymentRequest(pr);
        setCheckingAvailability(false);
        return;
      }
      
      // Fallback: Check if we're on HTTPS and Chrome
      if (window.location.protocol === 'https:' && /Chrome/.test(navigator.userAgent)) {
        console.log('🌐 Chrome + HTTPS detected - Google Pay should work');
        
        const pr = stripe.paymentRequest({
          country: 'US',
          currency: paymentData.currency.toLowerCase(),
          total: {
            label: `Lokal Marketplace`,
            amount: Math.round(paymentData.total * 100),
          },
          displayItems: paymentData.items ? paymentData.items.map(item => ({
            label: item.name,
            amount: Math.round(item.price * 100)
          })) : [],
          requestPayerName: true,
          requestPayerEmail: true,
          requestPayerPhone: false,
          requestShipping: false,
        });
        
        // Handle payment method selection for fallback Google Pay
        pr.on('paymentmethod', async (ev) => {
          console.log('🌐 Fallback Google Pay payment method selected');
          setProcessing(true);
          
          try {
            // Step 1: Create payment intent on backend
            console.log('🔄 Creating payment intent for Google Pay...');
            const apiUrl = process.env.NODE_ENV === 'production' 
              ? process.env.REACT_APP_PRODUCTION_API_URL 
              : process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/create-payment-intent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                amount: paymentData.total,
                currency: paymentData.currency,
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to create payment intent');
            }

            const { clientSecret, paymentIntentId } = await response.json();
            console.log('✅ Payment intent created for Google Pay:', paymentIntentId);

            // Step 2: Confirm payment with Stripe
            console.log('🔄 Confirming Google Pay payment with Stripe...');
            const { error, paymentIntent } = await stripe.confirmCardPayment(
              clientSecret,
              { payment_method: ev.paymentMethod.id },
              { handleActions: false }
            );

            if (error) {
              console.error('❌ Google Pay payment failed:', error);
              ev.complete('fail');
              throw new Error(error.message);
            } else {
              console.log('✅ Google Pay payment confirmed successfully:', paymentIntent.id);
              ev.complete('success');
              
              // Extract Google Pay info
              const googlePayInfo = {
                deviceAccount: `Google Pay ****${ev.paymentMethod.card?.last4 || '****'}`,
                transactionId: paymentIntent.id,
                brand: ev.paymentMethod.card?.brand || 'google_pay',
                last4: ev.paymentMethod.card?.last4 || '****',
                paymentNetwork: 'Google Pay'
              };

              console.log('🌐 Google Pay info extracted:', googlePayInfo);

              onPaymentSuccess({
                paymentIntentId: paymentIntent.id,
                googlePayInfo: googlePayInfo,
              });
            }
          } catch (error) {
            console.error('❌ Google Pay error:', error);
            ev.complete('fail');
            onPaymentError(error.message);
          } finally {
            setProcessing(false);
          }
        });
        
        // Try to make payment anyway - force Google Pay
        try {
          const result = await pr.canMakePayment();
          console.log('Google Pay availability result:', result);
          if (result) {
            setCanMakePayment(true);
            setPaymentRequest(pr);
          } else {
            setCanMakePayment(false);
          }
        } catch (error) {
          console.log('Google Pay check failed:', error);
          setCanMakePayment(false);
        }
      } else {
        console.log('❌ Google Pay not available - requires Chrome + HTTPS');
        setCanMakePayment(false);
      }
      
      setCheckingAvailability(false);
    };

    checkRealGooglePay();

  }, [stripe, paymentData.total, paymentData.currency, paymentData.items, setProcessing, onPaymentSuccess, onPaymentError]);

  if (checkingAvailability) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        textAlign: 'center',
        border: '1px solid #dee2e6',
      }}>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
          🌐 Google Pay
        </div>
        <div style={{ fontSize: '12px', color: '#999' }}>
          Checking Google Pay availability...
        </div>
      </div>
    );
  }

  if (!canMakePayment || !paymentRequest) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        textAlign: 'center',
        border: '1px solid #dee2e6',
      }}>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
          🌐 Google Pay
        </div>
        <div style={{ fontSize: '12px', color: '#999' }}>
          Google Pay is not available. Please ensure you're:
          <br />
          • Using Chrome browser
          • On a secure HTTPS connection  
          • Have Google Pay set up
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ 
        background: 'linear-gradient(135deg, #4285f4, #34a853)', 
        color: '#fff', 
        padding: '1rem', 
        borderRadius: '8px', 
        textAlign: 'center',
        cursor: processing ? 'not-allowed' : 'pointer',
        opacity: processing ? 0.6 : 1,
        transition: 'opacity 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '16px',
        fontWeight: '600',
        border: 'none',
        width: '100%',
        minHeight: '50px',
        userSelect: 'none'
      }}
      onClick={async () => {
        if (!processing && paymentRequest) {
          console.log('🌐 Google Pay button clicked - FORCING native Google Pay wallet');
          try {
            // First check if payment can be made
            const canShow = await paymentRequest.canMakePayment();
            console.log('🔍 Google Pay canMakePayment result:', canShow);
            
            if (canShow && canShow.googlePay) {
              console.log('✅ Showing native Google Pay interface...');
              await paymentRequest.show();
              console.log('✅ Google Pay interface opened successfully');
            } else {
              console.warn('⚠️ Google Pay not available for this payment request');
              // Try direct Google Pay API as fallback
              if (window.google && window.google.payments) {
                console.log('🔄 Trying direct Google Pay API...');
                alert('Google Pay is available but Stripe integration failed. Please try again or use a different payment method.');
              } else {
                alert('Google Pay is not available on this device/browser. Please use Chrome.');
              }
            }
          } catch (error) {
            console.error('❌ Failed to show Google Pay interface:', error);
            alert('Failed to open Google Pay. Please try again or use a different payment method.');
          }
        } else if (!paymentRequest) {
          console.error('❌ Payment request not initialized');
          alert('Google Pay is not properly initialized. Please refresh and try again.');
        }
      }}
      >
        {processing ? (
          <>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #fff',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            Processing...
          </>
        ) : (
          <>
            🌐 Google Pay
            <span style={{ marginLeft: '8px', fontSize: '14px' }}>
              {paymentData.currency === 'GBP' ? '£' : '$'}{paymentData.total.toFixed(2)}
            </span>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        marginTop: '12px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#666',
        textAlign: 'center',
      }}>
        🔒 Opens Google Pay wallet - Complete payment in Google Pay app
        <br />
        Secure payment powered by Google Pay and Stripe
      </div>
    </div>
  );
};

export default StripeGooglePayButton;
