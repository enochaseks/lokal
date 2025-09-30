# Stripe Email Receipts Integration Guide

## 🎯 Overview

This guide shows how to integrate Stripe's professional email receipt functionality into your Lokal app, allowing customers to receive beautifully formatted receipts directly in their email.

## ✅ What's Already Implemented

### 1. **Cloud Functions** (`functions/stripe-receipt-function.js`)
- ✅ `sendStripeReceipt` - Sends professional receipts via Stripe
- ✅ `handleStripeWebhook` - Handles Stripe webhook events
- ✅ `resendStripeReceipt` - Resends receipts if needed

### 2. **React Component** (`src/components/StripeReceiptSender.js`)
- ✅ Button component for sending receipts
- ✅ Loading states and success feedback
- ✅ Error handling

### 3. **Dependencies Updated**
- ✅ Added Stripe to functions/package.json
- ✅ Functions exported in index.js

## 🚀 Setup Instructions

### Step 1: Install Dependencies
```bash
cd functions
npm install
```

### Step 2: Set Environment Variables
In Firebase Console → Functions → Configuration, add:
```
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Step 3: Deploy Functions
```bash
firebase deploy --only functions
```

### Step 4: Configure Stripe Webhook
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-project.cloudfunctions.net/handleStripeWebhook`
3. Select events: `invoice.sent`, `invoice.payment_succeeded`
4. Copy webhook secret to Firebase config

## 📧 How It Works

### Professional Receipt Features:
- **Stripe Branding**: Professional invoice layout
- **Custom Store Info**: Store name, address, phone
- **Order Details**: Order ID, items, amounts
- **PDF Attachment**: Downloadable PDF receipt
- **Email Delivery**: Automatic email to customer
- **Tracking**: Delivery confirmation via webhooks

### Receipt Content:
- Store Information (name, address, phone)
- Order ID and transaction details
- Itemized breakdown with fees
- Total amount and currency
- Payment method information
- Lokal branding footer

## 🛠 Integration Examples

### Example 1: Basic Implementation
```javascript
import StripeReceiptSender from '../components/StripeReceiptSender';

// In your receipt modal or order confirmation
<StripeReceiptSender
  paymentIntentId="pi_1234567890"
  customerEmail="customer@example.com"
  customerName="John Doe"
  orderId="ORDER123"
  storeName="Shantee Hair Pick Up"
  storeAddress="123 Main St, London"
  storePhone="+44 20 1234 5678"
  onSuccess={(result) => {
    console.log('Receipt sent!', result);
    showSuccessToast('Receipt sent to customer email');
  }}
  onError={(error) => {
    console.error('Error:', error);
    showErrorToast('Failed to send receipt');
  }}
/>
```

### Example 2: Firebase Function Call
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const sendReceipt = async () => {
  const functions = getFunctions();
  const sendStripeReceipt = httpsCallable(functions, 'sendStripeReceipt');
  
  try {
    const result = await sendStripeReceipt({
      paymentIntentId: 'pi_1234567890',
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
      orderId: 'ORDER123',
      storeName: 'Shantee Hair Pick Up',
      storeAddress: '123 Main St, London',
      storePhone: '+44 20 1234 5678'
    });
    
    console.log('Receipt sent:', result.data);
    // result.data contains:
    // - receiptId: Firestore document ID
    // - stripeInvoiceId: Stripe invoice ID
    // - receiptUrl: Hosted invoice URL
    // - pdfUrl: PDF download URL
    
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## 📱 Adding to ReceiptsPage

To add the Stripe receipt functionality to your ReceiptsPage, add this after the "Download PDF" button:

```javascript
{/* Add this import at the top */}
import StripeReceiptSender from '../components/StripeReceiptSender';

{/* Add this in the modal buttons section */}
{selectedReceipt?.paymentIntentId && selectedReceipt?.buyerEmail && (
  <StripeReceiptSender
    paymentIntentId={selectedReceipt.paymentIntentId}
    customerEmail={selectedReceipt.buyerEmail}
    customerName={selectedReceipt.buyerName || 'Customer'}
    orderId={selectedReceipt.orderId || selectedReceipt.id}
    storeName={selectedReceipt.storeName}
    storeAddress={selectedReceipt.storeData?.storeLocation}
    storePhone={selectedReceipt.storeData?.phoneNumber}
    onSuccess={(result) => {
      console.log('Stripe receipt sent:', result);
    }}
    onError={(error) => {
      console.error('Failed to send receipt:', error);
    }}
  />
)}
```

## 🔧 Data Requirements

For the Stripe receipt to work, your receipt data should include:

### Required Fields:
- `paymentIntentId` - Stripe Payment Intent ID
- `customerEmail` - Customer's email address

### Optional Fields:
- `customerName` - Customer's full name
- `orderId` - Your internal order ID
- `storeName` - Store/business name
- `storeAddress` - Store physical address
- `storePhone` - Store contact phone

### Example Receipt Data Structure:
```javascript
{
  id: "receipt123",
  paymentIntentId: "pi_1234567890",
  buyerEmail: "customer@example.com",
  buyerName: "John Doe",
  orderId: "ORDER123",
  storeName: "Shantee Hair Pick Up",
  storeData: {
    storeLocation: "123 Main St, London",
    phoneNumber: "+44 20 1234 5678"
  },
  amount: 2500, // £25.00 in pence
  currency: "gbp",
  timestamp: FirestoreTimestamp
}
```

## 🎨 Receipt Appearance

The Stripe receipt includes:

### Header:
- Lokal branding
- Store name and contact info
- Invoice number and date

### Body:
- Order details
- Itemized breakdown
- Tax and fee information
- Payment method

### Footer:
- Thank you message
- Support contact information
- Legal/compliance text

## 📊 Benefits of Stripe Receipts

### For Customers:
- ✅ Professional, branded receipts
- ✅ PDF attachment for records
- ✅ Automatic delivery to inbox
- ✅ Mobile-friendly format
- ✅ Searchable email history

### For Stores:
- ✅ Reduced support requests
- ✅ Professional brand image
- ✅ Automatic compliance
- ✅ Delivery tracking
- ✅ Integration with accounting

### For Platform:
- ✅ Enhanced user experience
- ✅ Reduced development overhead
- ✅ Built-in fraud protection
- ✅ International compliance
- ✅ Analytics and reporting

## 🔄 Testing

### Test Mode Setup:
1. Use Stripe test keys
2. Test with test email addresses
3. Verify webhook delivery
4. Check receipt formatting

### Test Scenarios:
- ✅ Successful payment with receipt
- ✅ Failed payment (no receipt)
- ✅ Refund with adjusted receipt
- ✅ Multiple items with breakdown
- ✅ International currencies

## 📈 Next Steps

1. **Deploy Functions**: `firebase deploy --only functions`
2. **Configure Webhooks**: Set up Stripe webhook endpoint
3. **Test Integration**: Send test receipts
4. **Update UI**: Add receipt buttons to relevant pages
5. **Monitor**: Track receipt delivery and customer feedback

## 🎉 Final Result

Once implemented, customers will receive professional Stripe receipts that include:

- **Professional Design**: Stripe's polished invoice template
- **Complete Information**: All order and store details
- **PDF Attachment**: Downloadable for records
- **Automatic Delivery**: No manual intervention needed
- **Mobile Optimized**: Perfect viewing on all devices
- **Brand Consistency**: Maintains Lokal branding

This creates a seamless, professional experience that builds customer trust and reduces support overhead! 📧✨