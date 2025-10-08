import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { showToast } from './ToastNotification';

const PaystackIntegration = ({ 
  currentUser, 
  onAccountCreated, 
  onBalanceUpdate,
  showAccountCreation = true 
}) => {
  const [paystackAccount, setPaystackAccount] = useState(null);
  const [accountStatus, setAccountStatus] = useState(null);
  const [paystackBalance, setPaystackBalance] = useState({ available: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Load existing Paystack account from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const loadPaystackAccount = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        if (userData?.paystackAccountId) {
          setPaystackAccount({
            accountId: userData.paystackAccountId,
            email: userData.email || currentUser.email
          });
          
          // Check account status (would implement when Paystack backend is ready)
          setAccountStatus('pending'); // Placeholder
        }
      } catch (err) {
        console.error('Error loading Paystack account:', err);
        setError('Failed to load account information');
      } finally {
        setLoading(false);
      }
    };

    loadPaystackAccount();
  }, [currentUser]);

  // Create Paystack subaccount (placeholder for future implementation)
  const createPaystackAccount = async () => {
    if (!currentUser) return;

    setCreating(true);
    setError('');

    try {
      // This would be implemented when adding Paystack backend
      console.log('Paystack integration coming soon...');
      const errorMsg = 'Paystack integration is not yet available. Please use bank transfer for now.';
      setError(errorMsg);
      showToast(errorMsg, 'info', 6000);
    } catch (err) {
      console.error('Error creating Paystack account:', err);
      setError('Failed to create Paystack account. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleWithdrawal = async (amount) => {
    try {
      // Placeholder for Paystack withdrawal
      console.log('Paystack withdrawal coming soon...');
      showToast('Paystack withdrawals will be available soon. Please contact support for manual payouts.', 'info', 6000);
    } catch (err) {
      console.error('Withdrawal error:', err);
      showToast('Withdrawal failed. Please try again.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading Paystack account...</p>
      </div>
    );
  }

  if (!paystackAccount && showAccountCreation) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: '16px',
        padding: '28px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative background pattern */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '120px',
          height: '120px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          zIndex: 1
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: '-30px',
          width: '80px',
          height: '80px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '50%',
          zIndex: 1
        }}></div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '12px',
              marginRight: '16px'
            }}>
              <span style={{ fontSize: '24px' }}>🌍</span>
            </div>
            <div>
              <h3 style={{
                fontSize: '22px',
                fontWeight: '600',
                margin: '0 0 4px 0',
                color: 'white'
              }}>
                Hey there, Seller! 👋
              </h3>
              <p style={{
                fontSize: '14px',
                margin: '0',
                color: 'rgba(255, 255, 255, 0.9)'
              }}>
                We're cooking up something special just for you
              </p>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              color: '#fecaca',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              padding: '20px',
              backdropFilter: 'blur(10px)'
            }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 12px 0',
                color: 'white'
              }}>
                🚀 What's coming your way:
              </h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { icon: '💳', text: 'Direct payments to your Paystack account' },
                  { icon: '⚡', text: 'Lightning-fast withdrawals to local banks' },
                  { icon: '🏦', text: 'Support for mobile money & bank transfers' },
                  { icon: '💰', text: 'Multi-currency support (NGN, GHS, ZAR, etc.)' }
                ].map((item, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.95)'
                  }}>
                    <span style={{ marginRight: '8px', fontSize: '16px' }}>{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: 'rgba(59, 130, 246, 0.15)',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 8px 0',
                color: 'white'
              }}>
                💡 In the meantime:
              </h4>
              <p style={{
                fontSize: '14px',
                margin: '0',
                lineHeight: '1.5',
                color: 'rgba(255, 255, 255, 0.9)'
              }}>
                Don't worry! You can still create your shop and start selling right away. 
                We'll handle your payouts manually until Paystack is ready. Just hit us up 
                when you need to withdraw your earnings! 😊
              </p>
            </div>

            <button
              onClick={createPaystackAccount}
              disabled={creating}
              style={{
                width: '100%',
                background: creating ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.25)',
                color: 'white',
                padding: '14px 20px',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: creating ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                transform: creating ? 'none' : 'translateY(0)',
                boxShadow: creating ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}
              onMouseOver={(e) => {
                if (!creating) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                  e.target.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseOut={(e) => {
                if (!creating) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.target.style.transform = 'translateY(0)';
                }
              }}
            >
              {creating ? '⏳ Setting up...' : '🔔 Notify me when it\'s ready!'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Account exists but not fully set up
  if (paystackAccount && accountStatus !== 'complete') {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: 'white',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            padding: '8px',
            marginRight: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>⏳</span>
          </div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            margin: '0',
            color: 'white'
          }}>
            Almost there! 🎉
          </h3>
        </div>
        
        <p style={{
          fontSize: '14px',
          margin: '0 0 16px 0',
          lineHeight: '1.5',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          Your Paystack setup is in progress. We'll have you up and running soon! 
          In the meantime, just give us a shout for any payouts.
        </p>
        
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '13px',
          fontFamily: 'monospace'
        }}>
          <strong>Account ID:</strong> {paystackAccount.accountId}
        </div>
      </div>
    );
  }

  // Fully set up account (future state)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: '16px',
        padding: '20px',
        color: 'white',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            padding: '6px',
            marginRight: '10px'
          }}>
            <span style={{ fontSize: '16px' }}>✅</span>
          </div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            margin: '0',
            color: 'white'
          }}>
            You're all set! 🎊
          </h3>
        </div>
        <p style={{
          fontSize: '14px',
          margin: '0',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          Your Paystack account is ready to rock and roll!
        </p>
      </div>

      {/* Balance Display */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16px' 
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '16px', marginRight: '6px' }}>💰</span>
            <h4 style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#6b7280',
              margin: '0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Ready to withdraw
            </h4>
          </div>
          <p style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#10b981',
            margin: '0',
            lineHeight: '1'
          }}>
            ₦{paystackBalance.available.toLocaleString()}
          </p>
        </div>
        
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '16px', marginRight: '6px' }}>⏱️</span>
            <h4 style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#6b7280',
              margin: '0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Processing
            </h4>
          </div>
          <p style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#f59e0b',
            margin: '0',
            lineHeight: '1'
          }}>
            ₦{paystackBalance.pending.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Withdrawal Button */}
      <button
        onClick={() => handleWithdrawal(paystackBalance.available)}
        disabled={paystackBalance.available <= 0}
        style={{
          width: '100%',
          background: paystackBalance.available <= 0 
            ? '#e5e7eb' 
            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: paystackBalance.available <= 0 ? '#9ca3af' : 'white',
          padding: '16px 24px',
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: paystackBalance.available <= 0 ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s ease',
          transform: paystackBalance.available <= 0 ? 'none' : 'translateY(0)',
          boxShadow: paystackBalance.available <= 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
        }}
        onMouseOver={(e) => {
          if (paystackBalance.available > 0) {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
          }
        }}
        onMouseOut={(e) => {
          if (paystackBalance.available > 0) {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          }
        }}
      >
        {paystackBalance.available <= 0 
          ? '💤 Nothing to withdraw yet' 
          : '🏦 Withdraw to your bank account'
        }
      </button>
    </div>
  );
};

export default PaystackIntegration;