# Refunds Policy Feature Documentation

## Overview
Added a comprehensive "Disable refunds" feature that allows sellers to control whether their store offers refunds, with appropriate customer notifications.

## Features Implemented

### 1. Fee Settings Enhancement
- **Location**: `MessagesPage.js` - Fee Settings Modal
- **New Field**: `refundsEnabled` (boolean, defaults to `true`)
- **UI**: Checkbox in Fee Settings with descriptive text
- **Description**: Shows warning when refunds are disabled

### 2. Refund Request Protection
- **Function**: `requestRefund()` in `MessagesPage.js`
- **Enhancement**: Checks store's refunds policy before allowing refund requests
- **User Experience**: Shows alert if store doesn't offer refunds

### 3. Refund Button Conditional Display
- **Location**: Payment completion messages in `MessagesPage.js`
- **Enhancement**: Hides refund buttons when store doesn't offer refunds
- **Alternative**: Shows "This store does not offer refunds" notice

### 4. Store Preview Page Notification
- **Location**: `StorePreviewPage.js` - Store information section
- **Enhancement**: Displays prominent warning when store doesn't offer refunds
- **Styling**: Red-themed notice box for visibility

### 5. Automatic Policy Checking
- **Implementation**: Real-time loading of store refunds policy
- **Scope**: Applies to all messaging conversations and store previews
- **Default**: All stores allow refunds unless explicitly disabled

## Technical Implementation

### Database Structure
```javascript
// Firestore: stores/{storeId}
{
  feeSettings: {
    deliveryEnabled: boolean,
    deliveryFee: number,
    // ... other fee settings
    refundsEnabled: boolean // NEW FIELD
  }
}
```

### Key Functions
1. `checkStoreRefundsPolicy(storeId)` - Checks if store allows refunds
2. Updated `requestRefund()` - Validates refunds policy before proceeding
3. Enhanced fee settings loading - Includes refunds policy in all loads

### UI Components
1. **Fee Settings Modal**: Checkbox for enabling/disabling refunds
2. **Refund Buttons**: Conditionally shown based on policy
3. **Store Preview**: Warning notice for no-refund stores
4. **CSS Styling**: Red-themed notices for refund policy warnings

### Error Handling
- Defaults to allowing refunds if store data is missing
- Graceful fallback on database errors
- Clear user messaging for policy restrictions

## User Experience Flow

### For Sellers
1. Go to Messages → Fee Settings
2. Toggle "Allow refunds for this store" checkbox
3. See preview of policy impact
4. Save settings

### For Customers
1. View store preview - see refund policy warning if applicable
2. In messages - refund buttons hidden if store doesn't offer refunds
3. Attempt refund request - blocked with clear explanation if not allowed

## Benefits
- **Store Control**: Sellers can set clear refund policies
- **Customer Clarity**: Buyers know refund policy before purchasing
- **Reduced Disputes**: Clear expectations prevent conflicts
- **Compliance**: Helps stores comply with their business model

## Styling
- Refund disabled notices use red theme (`#fef2f2` background, `#dc2626` text)
- Consistent with existing warning/error styling
- Mobile responsive design
- Clear iconography (❌ for no refunds, ℹ️ for information)
