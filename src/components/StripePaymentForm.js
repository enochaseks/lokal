import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const StripePaymentForm = ({ 
  paymentData, 
  onPaymentSuccess, 
  onPaymentError, 
  processing, 
  setProcessing,
  currentUser,
  selectedConversation 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [billingDetails, setBillingDetails] = useState({
    name: currentUser?.displayName || '',
    email: currentUser?.email || '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    },
  });

  const handleCardChange = (event) => {
    setCardComplete(event.complete);
    setCardError(event.error);
  };

  const handleBillingChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setBillingDetails(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setBillingDetails(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || processing) {
      return;
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      onPaymentError('Payment form not loaded properly');
      return;
    }

    if (!cardComplete) {
      onPaymentError('Please enter complete card information');
      return;
    }

    setProcessing(true);

    try {
      console.log('🔄 Creating payment intent for amount:', paymentData.total);
      
      // Step 1: Create payment intent on backend
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }

      const { clientSecret, paymentIntentId } = await response.json();
      console.log('✅ Payment intent created:', paymentIntentId);

      // Step 2: Confirm payment with Stripe (disable Link for native card experience)
      console.log('🔄 Confirming payment with Stripe Elements (native card)...');
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: billingDetails,
        },
      }, {
        // Force native card processing, avoid Link redirect
        handleActions: false
      });

      if (result.error) {
        console.error('❌ Payment confirmation error:', result.error);
        onPaymentError(result.error.message);
      } else {
        console.log('✅ Payment confirmed successfully:', result.paymentIntent.id);
        
        // Extract card info from payment intent
        let cardInfo = {
          last4: '****',
          cardType: 'Card',
          expiryMonth: '',
          expiryYear: ''
        };

        // Try to get card details from the payment intent
        if (result.paymentIntent.charges && result.paymentIntent.charges.data && result.paymentIntent.charges.data.length > 0) {
          const charge = result.paymentIntent.charges.data[0];
          if (charge.payment_method_details && charge.payment_method_details.card) {
            const card = charge.payment_method_details.card;
            cardInfo = {
              last4: card.last4 || '****',
              cardType: (card.brand?.charAt(0).toUpperCase() + card.brand?.slice(1)) || 'Card',
              expiryMonth: card.exp_month || '',
              expiryYear: card.exp_year || ''
            };
          }
        }

        console.log('💳 Card info extracted:', cardInfo);

        // Call success handler with payment data
        onPaymentSuccess({
          paymentIntentId: result.paymentIntent.id,
          cardInfo: cardInfo,
          stripePaymentMethod: result.paymentIntent.payment_method
        });
      }
    } catch (error) {
      console.error('❌ Stripe payment error:', error);
      onPaymentError(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        fontFamily: '"Inter", system-ui, sans-serif',
        fontSmoothing: 'antialiased',
        '::placeholder': {
          color: '#9ca3af',
        },
        ':-webkit-autofill': {
          color: '#1f2937',
        },
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
      complete: {
        color: '#16a34a',
        iconColor: '#16a34a',
      },
    },
    hidePostalCode: true,
    // Disable Link to force native card input experience
    disableLink: true,
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      {/* Billing Information */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#374151', fontSize: '1.1rem' }}>Billing Information</h4>
        
        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Full Name"
            value={billingDetails.name}
            onChange={(e) => handleBillingChange('name', e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
          
          <input
            type="email"
            placeholder="Email"
            value={billingDetails.email}
            onChange={(e) => handleBillingChange('email', e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
          
          <input
            type="text"
            placeholder="Address Line 1"
            value={billingDetails.address.line1}
            onChange={(e) => handleBillingChange('address.line1', e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="City"
              value={billingDetails.address.city}
              onChange={(e) => handleBillingChange('address.city', e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            <input
              type="text"
              placeholder="ZIP Code"
              value={billingDetails.address.postal_code}
              onChange={(e) => handleBillingChange('address.postal_code', e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      </div>

      {/* Card Information */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '1.1rem', 
          fontWeight: '600', 
          color: '#374151', 
          marginBottom: '0.75rem' 
        }}>
          Card Information
        </label>
        <div style={{
          padding: '0.75rem',
          border: cardError ? '1px solid #ef4444' : '1px solid #d1d5db',
          borderRadius: '6px',
          backgroundColor: '#ffffff',
          transition: 'border-color 0.2s',
        }}>
          <CardElement 
            options={cardElementOptions}
            onChange={handleCardChange}
          />
        </div>
        {cardError && (
          <div style={{ 
            fontSize: '0.875rem', 
            color: '#ef4444', 
            marginTop: '0.5rem' 
          }}>
            {cardError.message}
          </div>
        )}
        
        {/* Security Notice */}
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#666',
          textAlign: 'center',
        }}>
          🔒 Native secure card processing - Your card details are encrypted and never stored
          <br />
          Powered by Stripe with industry-standard security
        </div>
      </div>

      {/* Pay Button */}
      <button
        type="submit"
        disabled={!stripe || !cardComplete || processing}
        style={{
          width: '100%',
          padding: '1rem 1.5rem',
          backgroundColor: processing || !cardComplete ? '#d1d5db' : '#007B7F',
          color: processing || !cardComplete ? '#9ca3af' : '#ffffff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: processing || !cardComplete ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        {processing ? (
          <>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #ffffff',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            Processing...
          </>
        ) : (
          `Pay ${paymentData.currency === 'GBP' ? '£' : '$'}${paymentData.total?.toFixed(2) || '0.00'}`
        )}
      </button>

      {/* Security Notice */}
      <div style={{
        fontSize: '0.875rem',
        color: '#6b7280',
        textAlign: 'center',
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        lineHeight: '1.4',
      }}>
        🔒 Your payment information is encrypted and secure. We never store your card details.
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
};

export default StripePaymentForm;
