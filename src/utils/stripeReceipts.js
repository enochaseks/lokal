// Stripe Receipt Utilities for Lokal Platform
// This file provides client-side functions to create payments with automatic email receipts

/**
 * Creates a payment intent with automatic email receipt
 * @param {Object} paymentData - Payment information
 * @param {number} paymentData.amount - Payment amount in pounds (not cents)
 * @param {string} paymentData.customerEmail - Customer's email for receipt
 * @param {string} paymentData.customerName - Customer's name
 * @param {string} paymentData.orderId - Order/transaction ID
 * @param {string} paymentData.storeId - Store ID
 * @param {string} paymentData.storeName - Store name for receipt
 * @param {string} paymentData.currency - Currency code (default: 'gbp')
 * @param {Object} paymentData.metadata - Additional metadata
 * @returns {Promise<Object>} Payment intent response with client secret
 */
export const createPaymentWithReceipt = async (paymentData) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_FIREBASE_FUNCTIONS_URL}/createPaymentIntentWithReceipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: paymentData.amount,
        currency: paymentData.currency || 'gbp',
        customerEmail: paymentData.customerEmail,
        customerName: paymentData.customerName,
        orderId: paymentData.orderId,
        storeId: paymentData.storeId,
        storeName: paymentData.storeName,
        metadata: {
          ...paymentData.metadata,
          receiptRequested: true,
          platform: 'lokal'
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create payment intent');
    }

    const result = await response.json();
    
    console.log('Payment intent created with receipt:', {
      paymentIntentId: result.paymentIntentId,
      receiptEmailEnabled: result.receiptEmailEnabled
    });

    return result;
  } catch (error) {
    console.error('Error creating payment with receipt:', error);
    throw error;
  }
};

/**
 * Manually sends a Stripe receipt for a completed payment
 * @param {Object} receiptData - Receipt information
 * @param {string} receiptData.paymentIntentId - Stripe payment intent ID
 * @param {string} receiptData.customerEmail - Customer's email
 * @param {string} receiptData.orderId - Order ID for reference
 * @param {string} receiptData.storeName - Store name
 * @returns {Promise<Object>} Receipt sending response
 */
export const sendManualReceipt = async (receiptData) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_FIREBASE_FUNCTIONS_URL}/sendStripeReceipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentIntentId: receiptData.paymentIntentId,
        customerEmail: receiptData.customerEmail,
        orderId: receiptData.orderId,
        storeName: receiptData.storeName
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send receipt');
    }

    const result = await response.json();
    
    console.log('Manual receipt sent successfully:', {
      chargeId: result.chargeId,
      receiptEmail: result.receiptEmail
    });

    return result;
  } catch (error) {
    console.error('Error sending manual receipt:', error);
    throw error;
  }
};

/**
 * Sends a custom receipt email for non-Stripe transactions
 */
export const sendCustomReceipt = async (receiptData) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_FIREBASE_FUNCTIONS_URL}/sendCustomReceipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerEmail: receiptData.customerEmail,
        customerName: receiptData.customerName,
        orderId: receiptData.orderId,
        storeName: receiptData.storeName,
        amount: receiptData.amount,
        currency: receiptData.currency,
        items: receiptData.items || [],
        receiptData: receiptData.receiptData || {}
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send custom receipt');
    }

    const result = await response.json();
    
    console.log('Custom receipt sent successfully:', {
      receiptId: result.receiptId,
      receiptEmail: result.receiptEmail
    });

    return result;
  } catch (error) {
    console.error('Error sending custom receipt:', error);
    throw error;
  }
};

/**
 * Enhanced payment processing with Stripe Elements and automatic receipts
 * @param {Object} stripe - Stripe instance
 * @param {Object} elements - Stripe Elements instance
 * @param {Object} paymentData - Payment data including customer info
 * @returns {Promise<Object>} Payment result
 */
export const processPaymentWithReceipt = async (stripe, elements, paymentData) => {
  try {
    // Step 1: Create payment intent with receipt
    const paymentIntentResponse = await createPaymentWithReceipt(paymentData);
    
    if (!paymentIntentResponse.success) {
      throw new Error('Failed to create payment intent');
    }

    // Step 2: Confirm payment with Stripe Elements
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: paymentIntentResponse.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
        receipt_email: paymentData.customerEmail, // Ensure receipt email is set
      },
    });

    if (error) {
      console.error('Payment confirmation error:', error);
      return {
        success: false,
        error: error.message,
        type: error.type
      };
    }

    // Step 3: Payment successful - receipt will be sent automatically
    console.log('Payment successful with automatic receipt:', {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      receiptEmail: paymentData.customerEmail
    });

    return {
      success: true,
      paymentIntent,
      receiptSent: true,
      receiptEmail: paymentData.customerEmail
    };

  } catch (error) {
    console.error('Error in payment processing:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Utility to validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Creates a customer receipt notification for the UI
 * @param {Object} receiptInfo - Receipt information
 * @returns {Object} Notification data
 */
export const createReceiptNotification = (receiptInfo) => {
  return {
    type: 'success',
    title: 'Receipt Sent! 📧',
    message: `A receipt has been sent to ${receiptInfo.customerEmail}`,
    details: [
      `Order ID: ${receiptInfo.orderId}`,
      `Store: ${receiptInfo.storeName}`,
      `Amount: £${receiptInfo.amount?.toFixed(2)}`,
      'Check your email for the receipt'
    ],
    duration: 8000 // Show for 8 seconds
  };
};

// Export all functions as default for easy importing
export default {
  createPaymentWithReceipt,
  sendManualReceipt,
  sendCustomReceipt,
  processPaymentWithReceipt,
  isValidEmail,
  createReceiptNotification
};