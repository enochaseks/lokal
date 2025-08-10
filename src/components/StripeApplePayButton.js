import React, { useState, useEffect } from 'react';
import { useStripe } from '@stripe/react-stripe-js';

const StripeApplePayButton = ({ 
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
    if (!stripe || !paymentData.total) {
      setCheckingAvailability(false);
      return;
    }

    const pr = stripe.paymentRequest({
      country: 'US',
      currency: paymentData.currency.toLowerCase(),
      total: {
        label: 'Total',
        amount: Math.round(paymentData.total * 100), // Convert to cents
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if Apple Pay is available
    pr.canMakePayment().then(result => {
      setCheckingAvailability(false);
      if (result) {
        setCanMakePayment(true);
        setPaymentRequest(pr);
        console.log('✅ Apple Pay is available');
      } else {
        setCanMakePayment(false);
        console.log('❌ Apple Pay is not available');
      }
    }).catch(error => {
      setCheckingAvailability(false);
      setCanMakePayment(false);
      console.log('❌ Error checking Apple Pay availability:', error);
    });

    // Handle payment method selection
    pr.on('paymentmethod', async (ev) => {
      console.log('🍎 Apple Pay payment method selected');
      setProcessing(true);
      
      try {
        // Step 1: Create payment intent on backend
        console.log('🔄 Creating payment intent for Apple Pay...');
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
        console.log('✅ Payment intent created for Apple Pay:', paymentIntentId);

        // Step 2: Confirm payment with Stripe
        console.log('🔄 Confirming Apple Pay payment with Stripe...');
        const { error, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (error) {
          console.error('❌ Apple Pay payment failed:', error);
          ev.complete('fail');
          throw new Error(error.message);
        } else {
          console.log('✅ Apple Pay payment confirmed successfully:', paymentIntent.id);
          ev.complete('success');
          
          // Extract Apple Pay info
          const applePayInfo = {
            deviceAccount: `Apple Pay ****${ev.paymentMethod.card?.last4 || '****'}`,
            transactionId: paymentIntent.id,
            brand: ev.paymentMethod.card?.brand || 'apple_pay',
            last4: ev.paymentMethod.card?.last4 || '****',
          };

          console.log('🍎 Apple Pay info extracted:', applePayInfo);

          onPaymentSuccess({
            paymentIntentId: paymentIntent.id,
            applePayInfo: applePayInfo,
          });
        }
      } catch (error) {
        console.error('❌ Apple Pay error:', error);
        ev.complete('fail');
        onPaymentError(error.message);
      } finally {
        setProcessing(false);
      }
    });

  }, [stripe, paymentData.total, paymentData.currency, setProcessing, onPaymentSuccess, onPaymentError]);

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
          🍎 Apple Pay
        </div>
        <div style={{ fontSize: '12px', color: '#999' }}>
          Checking Apple Pay availability...
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
          🍎 Apple Pay
        </div>
        <div style={{ fontSize: '12px', color: '#999' }}>
          Apple Pay is not available on this device or browser.
          <br />
          Please use a supported device with Safari or try another payment method.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ 
        backgroundColor: '#000', 
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
      onClick={() => {
        if (!processing && paymentRequest) {
          console.log('🍎 Apple Pay button clicked');
          paymentRequest.show();
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
            🍎 Pay with Apple Pay
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
        🔒 Secure payment powered by Apple Pay and Stripe
        <br />
        Your payment information is never stored on our servers
      </div>
    </div>
  );
};

export default StripeApplePayButton;
