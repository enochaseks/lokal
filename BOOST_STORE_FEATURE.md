# Boost Store Feature Documentation

## Overview

The Boost Store feature allows sellers to pay to promote their stores, making them appear in the "Recommended For You" section on the Explore page. This increases visibility and drives more traffic to their stores. Any authenticated user can boost any store - this allows buyers to boost their favorite stores and support sellers they like.

## Payment Processing

The boost feature uses Stripe for secure payment processing:

1. Users select a boost duration (3, 7, 14, or 30 days)
2. The system creates a payment intent via the Stripe API
3. Users enter their card details in a secure Stripe Elements form
4. Payment is processed directly by Stripe and sent to the business account
5. Upon successful payment, the store's boost status is updated in Firestore

All payments are securely processed through Stripe, and no sensitive payment information is stored in our database.

## Implementation Details

### Database Schema

Boosted stores have the following fields in their Firestore documents:

- `isBoosted`: Boolean flag indicating if the store is currently boosted
- `boostStartDate`: Timestamp when the boost begins
- `boostExpiryDate`: Timestamp when the boost expires
- `boostDuration`: Number of days the boost lasts
- `boostAmount`: Amount paid for the boost
- `boostPaymentIntentId`: Stripe payment intent ID
- `lastBoostedAt`: Timestamp of when the store was last boosted

A separate collection `storeBoosts` tracks all boost transactions:

```javascript
{
  storeId: "store-id-123",
  storeName: "Store Name",
  storeOwnerId: "user-id-456",
  paymentIntentId: "pi_1234567890",
  boostStartDate: Timestamp,
  boostExpiryDate: Timestamp,
  boostDuration: 7, // days
  boostAmount: 13.93,
  currency: "GBP",
  paidById: "user-id-789",
  paidByName: "User Name",
  paidByEmail: "user@example.com",
  createdAt: Timestamp
}
```

### Backend Implementation

1. **API Endpoint**: `/create-boost-payment-intent` creates a Stripe payment intent for store boosting
2. **Webhook Handler**: Processes successful payments and updates store status
3. **Firebase Function**: `updateStoreBoostStatus` updates the store and creates a boost transaction record
4. **Scheduled Function**: `expireStoreBoosts` runs daily to remove expired boosts

### Frontend Implementation

1. **StorePreviewPage**: Displays a "Boost Store" button and modal for selecting boost duration
2. **ExplorePage**: Shows boosted stores in the "Recommended For You" section
3. **Boost Duration Options**: 3, 7, 14, or 30 days at £1.99 per day
4. **Payment Processing**: Uses Stripe to securely process payments

## User Experience

1. User visits a store page
2. User sees a small circular star (⭐) button in the top left corner
   - Button is visible to all authenticated users (whether they are buyers, sellers, or the store owner)
   - The button uses a distinct yellow color to stand out
   - Boosted stores display a "BOOSTED" badge next to their name
3. User clicks the star button to boost the store
4. User selects boost duration from options (3, 7, 14, or 30 days)
5. User pays via Stripe (£1.99 per day)
6. Store immediately appears in "Recommended For You" section on the Explore page
7. Boost expires automatically after the selected duration

## Business Benefits

- **For Sellers**: Increased visibility leads to more visits and potential sales
- **For Buyers**: Discover stores that sellers have invested in promoting
- **For Platform**: Additional revenue stream from boost fees

## Future Enhancements

- Analytics to show boost performance (views, clicks, sales)
- Automatic boost renewal options
- Targeted boosting to specific geographic areas or customer segments
- Promotional periods with discounted boost pricing