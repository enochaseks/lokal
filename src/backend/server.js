require('dotenv').config(); // Load environment variables first
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Use environment variable
const cors = require('cors');

const app = express();

// Import routes
const hubspotRoutes = require('./routes/hubspot');

// Configure CORS with specific options
app.use(cors({
  origin: [
    'http://localhost:3000',  // Local development
    'http://127.0.0.1:3000',  // Alternative local
    'https://lokal-app.com',  // Production domain (if applicable)
    'https://lokalshops.co.uk', // Production domain
    'https://www.lokalshops.co.uk', // www subdomain
    process.env.FRONTEND_URL  // From environment variable if set
  ].filter(Boolean), // Filter out undefined values
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow cookies if needed
  maxAge: 86400 // OPTION preflight cache time (24 hours)
}));

app.use(express.json());

// Use API routes
app.use('/api/hubspot', hubspotRoutes);

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running!', 
    timestamp: new Date().toISOString(),
    service: 'Lokal Stripe Payment API'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create payment intent endpoint
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Create payment intent with Connect account (for marketplace payments)
app.post('/create-connect-payment-intent', async (req, res) => {
  try {
    const { amount, currency, sellerStripeAccountId, applicationFeeAmount = 0 } = req.body;

    if (!sellerStripeAccountId) {
      return res.status(400).send({ error: 'Seller Stripe account ID is required' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      application_fee_amount: Math.round(applicationFeeAmount * 100), // Platform fee in cents
      transfer_data: {
        destination: sellerStripeAccountId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Connect Payment Intent Error:', error);
    res.status(400).send({ error: error.message });
  }
});

// ============================================================================
// STRIPE CONNECT ENDPOINTS
// ============================================================================

// Create Stripe Connect account for seller
app.post('/api/stripe/create-connect-account', async (req, res) => {
  try {
    const { email, country = 'GB', type = 'standard' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const account = await stripe.accounts.create({
      type: type,
      country: country,
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    res.json({ 
      accountId: account.id,
      success: true 
    });
  } catch (error) {
    console.error('Error creating Connect account:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create account link for onboarding
app.post('/api/stripe/create-account-link', async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Use production URLs for live mode, localhost for test mode
    const isLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
    const baseUrl = isLiveMode ? 'https://lokalshops.co.uk' : (process.env.FRONTEND_URL || 'http://localhost:3000');
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/messages?tab=wallet&refresh=true`,
      return_url: `${baseUrl}/messages?tab=wallet&setup=complete`,
      type: 'account_onboarding',
    });

    res.json({ 
      url: accountLink.url,
      success: true 
    });
  } catch (error) {
    console.error('Error creating account link:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get Connect account status
app.post('/api/stripe/account-status', async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const account = await stripe.accounts.retrieve(accountId);
    
    res.json({
      accountId: account.id,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: account.requirements,
      capabilities: account.capabilities,
      success: true
    });
  } catch (error) {
    console.error('Error fetching account status:', error);
    
    // Check if account was deleted from Stripe
    if (error.code === 'resource_missing' || error.message.includes('No such account')) {
      return res.status(404).json({ 
        error: 'Account not found in Stripe', 
        accountDeleted: true,
        success: false 
      });
    }
    
    res.status(400).json({ error: error.message, success: false });
  }
});

// Get Connect account balance
app.post('/api/stripe/account-balance', async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId,
    });

    // Get available balance in primary currency (usually GBP for UK accounts)
    const availableBalance = balance.available.find(b => b.currency === 'gbp') || balance.available[0] || { amount: 0, currency: 'gbp' };
    const pendingBalance = balance.pending.find(b => b.currency === 'gbp') || balance.pending[0] || { amount: 0, currency: 'gbp' };

    res.json({
      available: {
        amount: availableBalance.amount / 100, // Convert from cents
        currency: availableBalance.currency.toUpperCase()
      },
      pending: {
        amount: pendingBalance.amount / 100, // Convert from cents  
        currency: pendingBalance.currency.toUpperCase()
      },
      success: true
    });
  } catch (error) {
    console.error('Error fetching account balance:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create manual payout (instant transfer to bank)
app.post('/api/stripe/create-payout', async (req, res) => {
  try {
    const { accountId, amount, currency = 'gbp' } = req.body;

    if (!accountId || !amount) {
      return res.status(400).json({ error: 'Account ID and amount are required' });
    }

    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
    }, {
      stripeAccount: accountId,
    });

    res.json({
      payoutId: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency.toUpperCase(),
      status: payout.status,
      arrivalDate: payout.arrival_date,
      success: true
    });
  } catch (error) {
    console.error('Error creating payout:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create store boost payment intent
app.post('/create-boost-payment-intent', async (req, res) => {
  try {
    const { amount, currency, storeId, boostDuration, userId } = req.body;
    
    // Validate required fields
    if (!amount || !currency || !storeId || !boostDuration || !userId) {
      return res.status(400).send({ 
        error: 'Missing required fields. Please provide amount, currency, storeId, boostDuration, and userId' 
      });
    }
    
    // Create a payment intent specifically for store boosting
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        type: 'store_boost',
        storeId,
        userId,
        boostDuration,
        boostStartDate: new Date().toISOString()
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Boost payment error:', error);
    res.status(400).send({ error: error.message });
  }
});

// Process refund endpoint
app.post('/api/process-refund', async (req, res) => {
  try {
    const { paymentIntentId, amount, currency, reason } = req.body;

    // Validate required fields
    if (!paymentIntentId) {
      return res.status(400).send({ error: 'Payment Intent ID is required' });
    }

    // Create refund with Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents if partial refund
      reason: reason || 'requested_by_customer'
    });

    res.send({
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100, // Convert back to currency units
      currency: refund.currency,
      status: refund.status,
      expectedArrival: {
        earliest: Math.floor(Date.now() / 1000) + (2 * 24 * 60 * 60), // 2 days from now
        latest: Math.floor(Date.now() / 1000) + (10 * 24 * 60 * 60)   // 10 days from now
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(400).send({ 
      error: error.message,
      type: error.type || 'api_error'
    });
  }
});

// Process withdrawal endpoint
app.post('/api/process-withdrawal', async (req, res) => {
  try {
    const { amount, currency, country, accountDetails, sellerId, sellerEmail, withdrawalMethod } = req.body;

    // Validate required fields
    if (!amount || !currency || !accountDetails || !sellerId) {
      return res.status(400).send({ error: 'Missing required withdrawal fields' });
    }

    // For development/testing: simulate withdrawal processing
    // In production, you would integrate with actual banking APIs or Stripe Connect

    console.log('🏦 Processing withdrawal:', {
      sellerId,
      sellerEmail,
      amount,
      currency,
      country,
      withdrawalMethod,
      accountDetails: {
        ...accountDetails,
        accountNumber: accountDetails.accountNumber ? accountDetails.accountNumber.slice(-4).padStart(accountDetails.accountNumber.length, '*') : 'N/A'
      }
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Country-specific processing simulation
    const countryProcessing = {
      'GB': { 
        processingDays: '1-2 business days',
        bankingSystem: 'Faster Payments',
        fees: amount * 0.001 // 0.1% fee
      },
      'US': { 
        processingDays: '1-3 business days',
        bankingSystem: 'ACH Transfer',
        fees: Math.min(amount * 0.0025, 5.00) // 0.25% fee, max $5
      },
      'NG': { 
        processingDays: '2-5 business days',
        bankingSystem: 'NIBSS Instant Payment',
        fees: amount * 0.002 // 0.2% fee
      },
      'DE': { 
        processingDays: '1-2 business days',
        bankingSystem: 'SEPA Transfer',
        fees: 0.50 // Fixed €0.50 fee
      },
      'IN': { 
        processingDays: '1-2 business days',
        bankingSystem: 'UPI/NEFT',
        fees: amount * 0.001 // 0.1% fee
      },
      'CA': { 
        processingDays: '2-3 business days',
        bankingSystem: 'Interac e-Transfer',
        fees: 1.50 // Fixed C$1.50 fee
      }
    };

    const processingInfo = countryProcessing[country] || countryProcessing['GB'];
    const processingFee = processingInfo.fees;
    const netAmount = amount - processingFee;

    // Generate a mock transaction ID
    const transactionId = `WD_${Date.now()}_${sellerId.slice(-6)}`;

    res.send({
      success: true,
      transactionId: transactionId,
      amount: netAmount,
      originalAmount: amount,
      processingFee: processingFee,
      currency: currency.toUpperCase(),
      status: 'processing',
      country: country,
      withdrawalMethod: withdrawalMethod,
      bankingSystem: processingInfo.bankingSystem,
      estimatedArrival: processingInfo.processingDays,
      accountDetails: {
        accountHolderName: accountDetails.accountHolderName,
        maskedAccountNumber: accountDetails.accountNumber ? 
          accountDetails.accountNumber.slice(-4).padStart(accountDetails.accountNumber.length, '*') : 'N/A',
        bankName: accountDetails.bankName || 'Bank Transfer'
      },
      processedAt: new Date().toISOString(),
      message: `Withdrawal of ${currency}${amount.toFixed(2)} is being processed. Net amount after fees: ${currency}${netAmount.toFixed(2)}`
    });

  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(400).send({ 
      success: false,
      error: error.message,
      type: error.type || 'withdrawal_error'
    });
  }
});

// Process webhook for Stripe events
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error(`Webhook Error: ${error.message}`);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  // Handle specific events
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    // Handle store boost payments
    if (paymentIntent.metadata.type === 'store_boost') {
      try {
        console.log('Store boost payment succeeded:', paymentIntent.id);
        
        // Here you would update your database to mark the store as boosted
        // This would typically involve a Firestore update
        
        // Return success - actual database updates should be done via Firebase functions
        // to ensure proper authentication and security rules are applied
      } catch (error) {
        console.error('Error processing boost payment:', error);
      }
    }
    
    // Handle Connect marketplace payments
    if (paymentIntent.transfer_data && paymentIntent.transfer_data.destination) {
      console.log('Connect marketplace payment succeeded:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        sellerAccount: paymentIntent.transfer_data.destination,
        applicationFee: paymentIntent.application_fee_amount / 100
      });
    }
  }
  
  // Handle Connect account updates
  if (event.type === 'account.updated') {
    const account = event.data.object;
    console.log('Connect account updated:', {
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted
    });
  }
  
  // Handle transfer events
  if (event.type === 'transfer.created') {
    const transfer = event.data.object;
    console.log('Transfer created:', {
      transferId: transfer.id,
      amount: transfer.amount / 100,
      destination: transfer.destination
    });
  }

  // Return success response
  res.status(200).json({ received: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});