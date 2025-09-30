// Example integration for MessagesPage.js payment flow
// Add this import at the top of your MessagesPage.js file

import { createPaymentWithReceipt } from '../utils/stripeReceipts';

// Example of how to modify your existing payment handling to include email receipts
// Replace this in your payment processing function

const handlePaymentWithReceipt = async (paymentData) => {
  try {
    // Get customer email - you might want to add an email input field
    const customerEmail = prompt("Enter your email to receive a receipt:");
    
    if (!customerEmail || !customerEmail.includes('@')) {
      alert('Please enter a valid email address for your receipt');
      return;
    }

    // Create payment with automatic receipt
    const paymentIntentResponse = await createPaymentWithReceipt({
      amount: paymentData.amount, // Amount in pounds (not cents)
      customerEmail: customerEmail,
      customerName: paymentData.customerName || 'Customer',
      orderId: paymentData.orderId || `ORDER_${Date.now()}`,
      storeId: paymentData.storeId,
      storeName: paymentData.storeName || 'Lokal Store',
      currency: 'gbp',
      metadata: {
        orderType: paymentData.orderType || 'purchase',
        platform: 'lokal'
      }
    });

    if (paymentIntentResponse.success) {
      // Use the client secret with your existing Stripe Elements
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: paymentIntentResponse.clientSecret,
        confirmParams: {
          receipt_email: customerEmail, // Ensure receipt is sent
        },
      });

      if (error) {
        console.error('Payment failed:', error);
        alert('Payment failed: ' + error.message);
      } else {
        console.log('Payment successful with receipt!', paymentIntent);
        alert(`Payment successful! Receipt sent to ${customerEmail}`);
        
        // Your existing success handling code here
        // Update order status, show success message, etc.
      }
    }
  } catch (error) {
    console.error('Payment error:', error);
    alert('Payment processing failed. Please try again.');
  }
};

// Optional: Add an email input field to your payment form
const EmailInput = ({ onEmailChange }) => (
  <div style={{ marginBottom: '1rem' }}>
    <label htmlFor="customer-email" style={{ 
      display: 'block', 
      marginBottom: '0.5rem',
      fontWeight: '500'
    }}>
      Email for Receipt (required)
    </label>
    <input
      id="customer-email"
      type="email"
      placeholder="customer@example.com"
      onChange={(e) => onEmailChange(e.target.value)}
      style={{
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #ccc',
        borderRadius: '0.375rem',
        fontSize: '1rem'
      }}
      required
    />
  </div>
);

// Usage in your JSX:
// <EmailInput onEmailChange={setCustomerEmail} />