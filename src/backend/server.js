require('dotenv').config(); // Load environment variables first
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Use environment variable
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});