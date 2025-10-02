# 🔧 Production Setup Guide: Stripe Connect Live Mode

## ✅ **Current Status**
- ✅ Live keys configured for production
- ✅ Account validation and cleanup logic added
- ✅ Reset functionality available for testing
- ✅ Integration component added to wallet
- ✅ HTTPS URLs for live mode redirects

## 🔑 **Missing: Live Connect Client ID**

You need to get your **live mode** Connect Client ID:

### **Steps:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. **Switch to Live mode** (toggle in top left)
3. Go to **Connect** → **Settings**
4. Copy your **live mode** Connect Client ID (starts with `ca_live_`)
5. Update `src/backend/.env`:
   ```
   STRIPE_CONNECT_CLIENT_ID=ca_live_your_actual_client_id_here
   ```

## 🚀 **Testing the Integration**

### **1. Start Both Servers:**
```bash
# Backend
cd src/backend
node server.js

# Frontend  
npm start
```

### **2. Test Seller Flow:**
1. Login as a seller
2. Go to **Messages** → **Wallet** tab
3. You should see **"🚀 Connect Stripe Account"** button
4. Click it to test account creation
5. Complete Stripe onboarding flow
6. Return to see account status

### **3. Test Account Deletion/Reset:**
- Use the **🗑️ Reset** button to clear the account
- Or delete the account from Stripe Dashboard
- Component should automatically detect and reset

## 🐛 **Account Cleanup Logic**

**What happens when account is deleted:**
1. ✅ Detects account no longer exists in Stripe
2. ✅ Automatically removes `stripeConnectAccountId` from Firestore  
3. ✅ Resets component state to show "Connect" button again
4. ✅ Shows helpful error message

**Manual reset:**
- 🗑️ **Reset button** for immediate testing
- Confirms before clearing data
- Safe for development testing

## 🔍 **Troubleshooting**

**"Connect Client ID required":**
- Get live mode client ID from Stripe Dashboard
- Update backend `.env` file
- Restart server

**"Account not found":**
- This is expected if you deleted it from Stripe
- Component will auto-reset
- Create a new account

**Still seeing old account ID:**
- Click the 🗑️ **Reset** button
- Check Firestore directly
- Clear browser cache

---

**🎯 Once you add the Connect Client ID, the full integration will work perfectly for testing!**