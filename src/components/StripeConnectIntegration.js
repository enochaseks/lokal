import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const StripeConnectIntegration = ({ 
  currentUser, 
  onAccountCreated, 
  onBalanceUpdate,
  showAccountCreation = true 
}) => {
  const [connectAccount, setConnectAccount] = useState(null);
  const [accountStatus, setAccountStatus] = useState(null);
  const [stripeBalance, setStripeBalance] = useState({ available: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAccountId, setShowAccountId] = useState(false);

  // Load existing Connect account from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const loadConnectAccount = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        if (userData?.stripeConnectAccountId) {
          setConnectAccount({
            accountId: userData.stripeConnectAccountId,
            email: userData.email || currentUser.email
          });
          
          // Check account status
          await checkAccountStatus(userData.stripeConnectAccountId);
        }
      } catch (err) {
        console.error('Error loading Connect account:', err);
        setError('Failed to load account information');
      } finally {
        setLoading(false);
      }
    };

    loadConnectAccount();
  }, [currentUser]);

  // Check Stripe account status
  const checkAccountStatus = async (accountId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/stripe/account-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });

      const data = await response.json();
      if (data.success) {
        setAccountStatus(data);
        
        // Get balance if account is active
        if (data.chargesEnabled) {
          await getAccountBalance(accountId);
        }
      } else {
        // Account doesn't exist in Stripe anymore - clear from Firestore
        console.log('🗑️ Account deleted from Stripe, clearing local data');
        await clearDeletedAccount();
      }
    } catch (err) {
      console.error('Error checking account status:', err);
      // If account fetch fails, it might be deleted - clear local data
      if (err.message.includes('No such account') || err.message.includes('does not exist')) {
        await clearDeletedAccount();
      }
    }
  };

  // Clear deleted account from Firestore
  const clearDeletedAccount = async () => {
    try {
      // Remove account ID from Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        stripeConnectAccountId: null,
        stripeConnectCreatedAt: null
      });
      
      // Reset local state
      setConnectAccount(null);
      setAccountStatus(null);
      setStripeBalance({ available: 0, pending: 0 });
      setError('Your Stripe account was removed. You can create a new one below.');
      
      console.log('✅ Cleared deleted account data');
    } catch (error) {
      console.error('Error clearing deleted account:', error);
    }
  };

  // Get Stripe account balance
  const getAccountBalance = async (accountId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/stripe/account-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });

      const data = await response.json();
      if (data.success) {
        setStripeBalance({
          available: data.available.amount,
          pending: data.pending.amount,
          currency: data.available.currency
        });
        
        // Notify parent component about balance update
        if (onBalanceUpdate) {
          onBalanceUpdate({
            stripeBalance: data.available.amount,
            stripePending: data.pending.amount,
            currency: data.available.currency
          });
        }
      }
    } catch (err) {
      console.error('Error getting account balance:', err);
    }
  };

  // Create new Stripe Connect account
  const createConnectAccount = async () => {
    if (!currentUser?.email) {
      setError('User email is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      // Create Connect account
      const createResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/stripe/create-connect-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          country: 'GB', // UK default
          type: 'standard'
        })
      });

      const createData = await createResponse.json();
      if (!createData.success) {
        throw new Error(createData.error);
      }

      // Save account ID to Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        stripeConnectAccountId: createData.accountId,
        stripeConnectCreatedAt: new Date()
      });

      // Create account link for onboarding
      const linkResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/stripe/create-account-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: createData.accountId })
      });

      const linkData = await linkResponse.json();
      if (!linkData.success) {
        throw new Error(linkData.error);
      }

      // Set account info
      setConnectAccount({
        accountId: createData.accountId,
        email: currentUser.email
      });

      // Notify parent component
      if (onAccountCreated) {
        onAccountCreated(createData.accountId);
      }

      // Redirect to Stripe onboarding
      window.location.href = linkData.url;

    } catch (err) {
      console.error('Error creating Connect account:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  // Refresh account link for re-onboarding
  const refreshAccountLink = async () => {
    if (!connectAccount?.accountId) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/stripe/create-account-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connectAccount.accountId })
      });

      const data = await response.json();
      if (data.success) {
        window.location.href = data.url;
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('Error refreshing account link:', err);
      setError('Failed to create account link');
    }
  };

  // Manual payout
  const createPayout = async (amount) => {
    if (!connectAccount?.accountId || !amount) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/stripe/create-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: connectAccount.accountId,
          amount: amount,
          currency: 'gbp'
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Payout of £${data.amount} initiated successfully!`);
        // Refresh balance
        await getAccountBalance(connectAccount.accountId);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('Error creating payout:', err);
      setError('Failed to create payout');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>⏳ Loading Stripe account...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #e5e5e5', borderRadius: '8px', marginBottom: '20px' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#1a73e8' }}>
        💳 Stripe Connect Integration
      </h3>

      {error && (
        <div style={{ 
          background: '#fee', 
          color: '#c33', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '15px' 
        }}>
          {error}
        </div>
      )}

      {!connectAccount && showAccountCreation && (
        <div>
          <p>Connect your Stripe account to receive real payments directly to your bank account.</p>
          <button
            onClick={createConnectAccount}
            disabled={creating}
            style={{
              background: '#1a73e8',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '6px',
              cursor: creating ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {creating ? '⏳ Creating Account...' : '🚀 Connect Stripe Account'}
          </button>
        </div>
      )}

      {connectAccount && (
        <div>
          <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>Account ID:</strong>
                {showAccountId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '14px',
                      background: '#f0f9ff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid #0ea5e9'
                    }}>
                      {connectAccount.accountId}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(connectAccount.accountId);
                        // Could add a toast notification here
                      }}
                      style={{
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '500',
                        marginRight: '4px'
                      }}
                      title="Copy Account ID to clipboard"
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => setShowAccountId(false)}
                      style={{
                        background: '#6b7280',
                        color: 'white',
                        border: 'none',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}
                      title="Hide Account ID"
                    >
                      👁️‍🗨️ Hide
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      acct_••••••••••••••••
                    </span>
                    <button
                      onClick={() => setShowAccountId(true)}
                      style={{
                        background: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}
                      title="Click to reveal Account ID"
                    >
                      👁️ Show
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🗑️ Reset
            </button>
          </div>

          {accountStatus && (
            <div style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                marginBottom: '10px' 
              }}>
                <span>Status:</span>
                {accountStatus.chargesEnabled ? (
                  <span style={{ color: '#0f5132', background: '#d1e7dd', padding: '4px 8px', borderRadius: '4px' }}>
                    ✅ Active
                  </span>
                ) : (
                  <span style={{ color: '#842029', background: '#f8d7da', padding: '4px 8px', borderRadius: '4px' }}>
                    ⚠️ Setup Required
                  </span>
                )}
              </div>

              {!accountStatus.detailsSubmitted && (
                <button
                  onClick={refreshAccountLink}
                  style={{
                    background: '#fd7e14',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginBottom: '10px'
                  }}
                >
                  📝 Complete Setup
                </button>
              )}
            </div>
          )}

          {accountStatus?.chargesEnabled && (
            <div>
              <h4>💰 Stripe Balance</h4>
              <div style={{ 
                background: '#f8f9fa', 
                padding: '15px', 
                borderRadius: '6px',
                marginBottom: '15px' 
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Available:</strong> £{stripeBalance.available.toFixed(2)}
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <strong>Pending:</strong> £{stripeBalance.pending.toFixed(2)}
                </div>
                
                {stripeBalance.available >= 1 && (
                  <button
                    onClick={() => {
                      const amount = prompt(`Enter amount to withdraw (max £${stripeBalance.available.toFixed(2)}):`);
                      if (amount && !isNaN(amount) && parseFloat(amount) <= stripeBalance.available) {
                        createPayout(parseFloat(amount));
                      }
                    }}
                    style={{
                      background: '#198754',
                      color: 'white',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    💸 Withdraw to Bank
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '400px',
            margin: '20px'
          }}>
            <h3>Reset Stripe Connect Account?</h3>
            <p>This will clear the connection and allow you to create a new one. This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ccc',
                  background: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowResetConfirm(false);
                  await clearDeletedAccount();
                }}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: '#dc3545',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Reset Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StripeConnectIntegration;