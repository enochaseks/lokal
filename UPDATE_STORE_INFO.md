# How to Update Store Address and Phone Number

This guide will help you update the store address and phone number that appears on receipts.

## Option 1: Using the Store Profile Page (Recommended)

1. Log in to your account as the store owner
2. Navigate to your Store Profile page
3. Click the "Edit" button
4. Update the "Location" field with your store's address
5. Update the "Phone Number" field with your store's contact number
6. Save your changes

## Option 2: Using the Direct Update Script

If you can't access the Store Profile page or prefer a direct update:

1. Make sure you have Node.js installed
2. Run `npm install firebase` to install the Firebase SDK
3. Open the file `update-store-direct.js` in a code editor
4. Find your store ID from a receipt (in the receipt page, you can check the browser's developer tools network requests, or it may be visible in the receipt data)
5. Update the `STORE_ID` constant in the script with your actual store ID
6. Update the address and phone number in the script
7. Run the script with `node update-store-direct.js`
8. Refresh your receipts page to see the updated information

## Finding Your Store ID

If you need to find your store ID:

1. Open a receipt in the browser
2. Right-click and select "Inspect" or press F12 to open developer tools
3. Go to the Console tab and enter this code:
   ```javascript
   // Get store ID from the currently displayed receipt
   const receiptElement = document.querySelector('[data-receipt-id]');
   if (receiptElement) {
     const receiptData = JSON.parse(receiptElement.dataset.receiptData || '{}');
     console.log('Store ID:', receiptData.sellerId || 'Not found');
   } else {
     console.log('No receipt currently displayed');
   }
   ```
4. The store ID should be displayed in the console

## Verifying the Update

After updating your store information:

1. Generate a new receipt to see if it includes the updated address and phone number
2. If viewing an existing receipt, refresh the page to see if the information has been updated