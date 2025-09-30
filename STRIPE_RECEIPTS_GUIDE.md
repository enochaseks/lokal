# Stripe Email Receipts Integration Guide

## Overview

This implementation provides automatic email receipts for customers using Stripe's built-in receipt functionality. When customers make payments, they will automatically receive professional, branded receipts via email.

## Features

✅ **Automatic Receipt Emails**: Customers receive receipts immediately after successful payments  
✅ **Professional Design**: Stripe's beautifully designed, mobile-friendly receipt templates  
✅ **Customer Management**: Automatic Stripe customer creation and management  
✅ **Manual Receipt Resending**: Ability to resend receipts for completed payments  
✅ **Order Tracking**: Integration with your existing order system  
✅ **Webhook Support**: Real-time payment status updates  

## Setup Instructions

### 1. Environment Variables

Add these to your Firebase Functions environment and React app:

```bash
# Firebase Functions (.env or Firebase config)
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret (optional)

# React App (.env)
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
REACT_APP_FIREBASE_FUNCTIONS_URL=https://your-region-your-project.cloudfunctions.net
```

### 2. Install Dependencies

```bash
# In functions directory
cd functions
npm install stripe@^18.5.0 cors@^2.8.5

# If not already installed in main project
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 3. Deploy Functions

```bash
firebase deploy --only functions
```

## Usage Examples

### Basic Payment with Receipt

```javascript
import { createPaymentWithReceipt, processPaymentWithReceipt } from '../utils/stripeReceipts';
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// Create payment with automatic receipt
const paymentData = {
  amount: 25.99, // Amount in pounds
  customerEmail: 'customer@example.com',
  customerName: 'John Smith',
  orderId: 'ORDER_123',
  storeId: 'store_456',
  storeName: 'Shantee Hair Pick Up',
  currency: 'gbp',
  metadata: {
    orderType: 'pickup',
    items: JSON.stringify([
      { name: 'Hair Treatment', price: 25.99 }
    ])
  }
};

// Process payment with automatic receipt
const result = await processPaymentWithReceipt(stripe, elements, paymentData);

if (result.success) {
  console.log('Payment successful! Receipt sent to:', result.receiptEmail);
  // Show success message to customer
  showNotification({
    type: 'success',
    message: `Payment successful! Receipt sent to ${result.receiptEmail}`
  });
}
```

### Manual Receipt Sending

```javascript
import { sendManualReceipt } from '../utils/stripeReceipts';

// Send receipt for existing payment
const receiptResult = await sendManualReceipt({
  paymentIntentId: 'pi_1234567890',
  customerEmail: 'customer@example.com',
  orderId: 'ORDER_123',
  storeName: 'Shantee Hair Pick Up'
});

if (receiptResult.success) {
  console.log('Receipt sent successfully!');
}
```

### Integration with Existing Payment Flow

```javascript
// In your existing payment component
const handlePayment = async (paymentMethod) => {
  try {
    // Get customer email from form
    const customerEmail = document.getElementById('customer-email').value;
    const customerName = document.getElementById('customer-name').value;

    // Create payment intent with receipt
    const paymentData = {
      amount: orderTotal,
      customerEmail,
      customerName,
      orderId: currentOrder.id,
      storeId: storeInfo.id,
      storeName: storeInfo.name
    };

    const result = await processPaymentWithReceipt(stripe, elements, paymentData);

    if (result.success) {
      // Payment and receipt successful
      setPaymentStatus('success');
      setReceiptSent(true);
      
      // Update order in database
      await updateOrder(currentOrder.id, {
        paymentStatus: 'completed',
        paymentIntentId: result.paymentIntent.id,
        receiptSent: true,
        receiptEmail: customerEmail
      });

      // Show success message
      showSuccessMessage(`Payment successful! Receipt sent to ${customerEmail}`);
    } else {
      setPaymentStatus('failed');
      showErrorMessage(result.error);
    }
  } catch (error) {
    console.error('Payment error:', error);
    showErrorMessage('Payment failed. Please try again.');
  }
};
```

## Stripe Receipt Features

### What Customers Receive

- **Professional Design**: Clean, mobile-friendly receipt layout
- **Company Branding**: Your business name and details
- **Transaction Details**: Date, amount, payment method, order ID
- **Customer Information**: Billing details and email
- **Tax Information**: Automatic tax calculations if configured
- **Download Option**: PDF download capability
- **Multi-language Support**: Automatic localization based on customer location

### Receipt Customization Options

You can customize receipts through your Stripe Dashboard:

1. **Business Information**: Logo, address, contact details
2. **Receipt Templates**: Choose from different designs
3. **Tax Settings**: Configure tax rates and display
4. **Currency Display**: Format and decimal places
5. **Custom Fields**: Add additional information
6. **Footer Text**: Custom messages or terms

## Advanced Features

### Webhook Integration

Set up webhooks for real-time payment updates:

```javascript
// The webhook handler is already included in stripe-receipt-function.js
// Configure webhook endpoint in Stripe Dashboard:
// https://your-region-your-project.cloudfunctions.net/stripeWebhook

// Events handled:
// - payment_intent.succeeded
// - charge.succeeded
// - payment_intent.payment_failed
```

### Customer Management

```javascript
// Customers are automatically created and managed
// Access customer data through Stripe Dashboard or API

// Retrieve customer payment history
const customer = await stripe.customers.retrieve('cus_customer_id');
const paymentMethods = await stripe.paymentMethods.list({
  customer: 'cus_customer_id',
  type: 'card',
});
```

### Receipt Analytics

Track receipt delivery through Stripe Dashboard:
- Delivery status
- Open rates
- Click-through rates
- Customer interaction data

## Integration with Existing Receipt System

You can use both systems together:

```javascript
// 1. Stripe receipt (automatic, professional)
const stripeResult = await processPaymentWithReceipt(stripe, elements, paymentData);

// 2. Your custom PDF receipt (additional)
if (stripeResult.success) {
  // Also create your custom receipt
  await downloadReceipt(selectedReceipt); // Your existing function
  
  // Show both options to customer
  showReceiptOptions({
    stripeReceipt: `Receipt sent to ${paymentData.customerEmail}`,
    customReceipt: 'Download custom receipt',
    both: true
  });
}
```

## Error Handling

```javascript
try {
  const result = await createPaymentWithReceipt(paymentData);
} catch (error) {
  switch (error.message) {
    case 'Missing required fields':
      showError('Please fill in all required fields');
      break;
    case 'Invalid email address':
      showError('Please enter a valid email address');
      break;
    case 'Payment failed':
      showError('Payment could not be processed. Please try again.');
      break;
    default:
      showError('An unexpected error occurred. Please contact support.');
  }
}
```

## Testing

### Test with Stripe Test Mode

```javascript
// Use test card numbers
const testCards = {
  visa: '4242424242424242',
  visaDebit: '4000056655665556',
  mastercard: '5555555555554444',
  declined: '4000000000000002'
};

// Test email addresses receive real emails in test mode
const testEmail = 'customer@example.com';
```

### Receipt Testing Checklist

- [ ] Receipt email delivered to customer
- [ ] Professional formatting and design
- [ ] Correct business information displayed
- [ ] Accurate transaction details
- [ ] PDF download works
- [ ] Mobile-friendly design
- [ ] Webhook events triggered correctly
- [ ] Customer created in Stripe Dashboard
- [ ] Payment intent marked as succeeded

## Benefits Over Custom Receipts

1. **Professional Design**: Stripe's receipts look more professional than custom solutions
2. **Automatic Delivery**: No need to manage email sending infrastructure
3. **High Deliverability**: Stripe's email system has excellent delivery rates
4. **Mobile Optimized**: Receipts look perfect on all devices
5. **Compliance**: Automatically includes required tax and legal information
6. **Multi-language**: Automatic localization for international customers
7. **Analytics**: Built-in tracking and analytics
8. **Reliability**: 99.9% uptime guarantee from Stripe

## Support and Troubleshooting

### Common Issues

1. **Receipts not being sent**:
   - Check STRIPE_SECRET_KEY is set correctly
   - Verify customer email is valid
   - Check Stripe Dashboard for failed webhooks

2. **Wrong business information**:
   - Update business details in Stripe Dashboard
   - Configure receipt settings under Settings > Receipts

3. **Receipt customization**:
   - Access receipt templates in Stripe Dashboard
   - Upload your logo and business information
   - Configure tax settings

### Getting Help

- Stripe Documentation: https://stripe.com/docs/receipts
- Stripe Support: Available 24/7 through Dashboard
- Firebase Functions Logs: Check for error messages

## Conclusion

This Stripe receipt integration provides a professional, reliable way to send receipts to customers automatically. It's more reliable and professional than custom solutions while requiring minimal maintenance.

The automatic receipt system will:
- Increase customer satisfaction
- Reduce support requests about receipts
- Provide professional branding
- Ensure reliable delivery
- Save development time
- Provide analytics and insights

Your customers will receive beautiful, professional receipts immediately after payment, enhancing their experience with your platform! 📧✨