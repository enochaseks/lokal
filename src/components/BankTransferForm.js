import React, { useState, useEffect } from 'react';

const BankTransferForm = ({ 
  paymentData, 
  onPaymentSuccess, 
  onPaymentError, 
  processing, 
  setProcessing,
  currentUser,
  selectedConversation,
  storeInfo // Add storeInfo prop to get seller's actual bank details
}) => {
  const [transferStep, setTransferStep] = useState('instructions'); // instructions, confirmation, completed
  const [bankDetails, setBankDetails] = useState(null);
  const [confirmationData, setConfirmationData] = useState({
    referenceNumber: '',
    transferDate: new Date().toISOString().split('T')[0],
    transferredAmount: paymentData.total,
    bankName: '',
    transferMethod: 'online' // online, mobile, branch, atm
  });
  const [loadingBankDetails, setLoadingBankDetails] = useState(true);

  // Get bank details for the seller's country/currency
  useEffect(() => {
    const getBankDetailsForSeller = () => {
      // Check if seller has real payment info saved (use unmasked version for bank transfers)
      const sellerPaymentInfo = storeInfo?.bankTransferInfo || storeInfo?.paymentInfo;
      
      if (storeInfo && sellerPaymentInfo && storeInfo.paymentType === 'Own Card/Bank Details') {
        
        // Build bank details from seller's actual saved information
        const bankDetails = {
          accountName: selectedConversation?.otherUserName || 'Seller',
          reference: `LOKAL-${paymentData.orderId?.slice(-8) || Date.now()}`,
          isRealBankDetails: true
        };

        // Add country-specific fields based on what the seller has saved
        if (sellerPaymentInfo.country === 'UK' || sellerPaymentInfo.sortCode) {
          bankDetails.country = 'UK';
          bankDetails.accountNumber = sellerPaymentInfo.accountNumber || 'Contact seller';
          bankDetails.sortCode = sellerPaymentInfo.sortCode || 'Contact seller';
          bankDetails.bankName = sellerPaymentInfo.bankName || 'Contact seller';
          bankDetails.currency = 'GBP';
          bankDetails.instructions = [
            'Use online banking or visit your bank branch',
            'Send the exact amount shown below in GBP',
            'Use the reference number provided',
            'Transfers usually take 1-3 business days',
            'Keep your receipt for confirmation'
          ];
        } else if (sellerPaymentInfo.country === 'Nigeria') {
          bankDetails.country = 'Nigeria';
          bankDetails.accountNumber = sellerPaymentInfo.accountNumber || 'Contact seller';
          bankDetails.bankName = sellerPaymentInfo.bankName || 'Contact seller';
          bankDetails.currency = 'NGN';
          bankDetails.instructions = [
            'Use mobile banking, USSD, or visit bank branch',
            'Send the exact amount shown below in NGN',
            'Use the reference number provided',
            'Transfers are usually instant',
            'Keep your receipt for confirmation'
          ];
        } else if (sellerPaymentInfo.country === 'USA' || sellerPaymentInfo.routingNumber) {
          bankDetails.country = 'USA';
          bankDetails.accountNumber = sellerPaymentInfo.accountNumber || 'Contact seller';
          bankDetails.routingNumber = sellerPaymentInfo.routingNumber || 'Contact seller';
          bankDetails.bankName = sellerPaymentInfo.bankName || 'Contact seller';
          bankDetails.currency = 'USD';
          bankDetails.instructions = [
            'Use wire transfer or ACH transfer',
            'Send the exact amount shown below in USD',
            'Use the reference number provided',
            'Wire transfers: Same day, ACH: 1-3 business days',
            'Keep your receipt for confirmation'
          ];
        } else if (sellerPaymentInfo.country === 'Canada' || sellerPaymentInfo.transitNumber) {
          bankDetails.country = 'Canada';
          bankDetails.accountNumber = sellerPaymentInfo.accountNumber || 'Contact seller';
          bankDetails.transitNumber = sellerPaymentInfo.transitNumber || 'Contact seller';
          bankDetails.bankName = sellerPaymentInfo.bankName || 'Contact seller';
          bankDetails.currency = 'CAD';
          bankDetails.instructions = [
            'Use online banking or visit bank branch',
            'Send the exact amount shown below in CAD',
            'Use the reference number provided',
            'Transfers usually take 1-2 business days',
            'Keep your receipt for confirmation'
          ];
        } else if (sellerPaymentInfo.country === 'South Africa') {
          bankDetails.country = 'South Africa';
          bankDetails.accountNumber = sellerPaymentInfo.accountNumber || 'Contact seller';
          bankDetails.bankName = sellerPaymentInfo.bankName || 'Contact seller';
          bankDetails.branchCode = sellerPaymentInfo.branchCode || 'Contact seller';
          bankDetails.currency = 'ZAR';
          bankDetails.instructions = [
            'Use online banking or visit bank branch',
            'Send the exact amount shown below in ZAR',
            'Use the reference number provided',
            'Transfers usually take 1-2 business days',
            'Keep your receipt for confirmation'
          ];
        } else if (sellerPaymentInfo.country === 'Ghana') {
          bankDetails.country = 'Ghana';
          bankDetails.accountNumber = sellerPaymentInfo.accountNumber || 'Contact seller';
          bankDetails.bankName = sellerPaymentInfo.bankName || 'Contact seller';
          if (sellerPaymentInfo.mobileNumber) {
            bankDetails.mobileNumber = sellerPaymentInfo.mobileNumber;
          }
          bankDetails.currency = 'GHS';
          bankDetails.instructions = [
            'Use mobile banking, mobile money, or visit bank branch',
            'Send the exact amount shown below in GHS',
            'Use the reference number provided',
            'Mobile transfers are usually instant',
            'Keep your receipt for confirmation'
          ];
        } else if (sellerPaymentInfo.country === 'Kenya') {
          bankDetails.country = 'Kenya';
          bankDetails.accountNumber = sellerPaymentInfo.accountNumber || 'Contact seller';
          bankDetails.bankName = sellerPaymentInfo.bankName || 'Contact seller';
          if (sellerPaymentInfo.mobileNumber) {
            bankDetails.mobileNumber = sellerPaymentInfo.mobileNumber;
          }
          bankDetails.currency = 'KES';
          bankDetails.instructions = [
            'Use M-Pesa, mobile banking, or visit bank branch',
            'Send the exact amount shown below in KES',
            'Use the reference number provided',
            'Mobile transfers are usually instant',
            'Keep your receipt for confirmation'
          ];
        } else if (sellerPaymentInfo.country === 'Jamaica' || sellerPaymentInfo.country === 'Trinidad & Tobago') {
          bankDetails.country = sellerPaymentInfo.country;
          bankDetails.accountNumber = sellerPaymentInfo.accountNumber || 'Contact seller';
          bankDetails.bankName = sellerPaymentInfo.bankName || 'Contact seller';
          bankDetails.branchCode = sellerPaymentInfo.branchCode || sellerPaymentInfo.transitCode || 'Contact seller';
          bankDetails.currency = sellerPaymentInfo.country === 'Jamaica' ? 'JMD' : 'TTD';
          bankDetails.instructions = [
            'Use online banking or visit bank branch',
            `Send the exact amount shown below in ${bankDetails.currency}`,
            'Use the reference number provided',
            'Transfers usually take 1-2 business days',
            'Keep your receipt for confirmation'
          ];
        } else {
          // Fallback for other countries or unrecognized format
          bankDetails.country = sellerPaymentInfo.country || 'Unknown';
          bankDetails.accountNumber = sellerPaymentInfo.accountNumber || 'Contact seller for details';
          bankDetails.bankName = sellerPaymentInfo.bankName || 'Contact seller for bank details';
          bankDetails.currency = paymentData.currency;
          bankDetails.instructions = [
            'Contact the seller for complete bank details',
            'Send the exact amount shown below',
            'Use the reference number provided',
            'Transfer times vary by country and bank',
            'Keep your receipt for confirmation'
          ];
        }

        return bankDetails;
      }

      // Fallback: Use generic bank details based on payment currency if no seller info
      return getFallbackBankDetails(paymentData.currency);
    };

    const getFallbackBankDetails = (currency) => {
      switch (currency) {
        case 'GBP':
          return {
            accountName: selectedConversation?.otherUserName || 'Seller',
            accountNumber: 'Contact seller for account number',
            sortCode: 'Contact seller for sort code',
            bankName: 'Contact seller for bank details',
            reference: `LOKAL-${paymentData.orderId?.slice(-8) || Date.now()}`,
            isRealBankDetails: false,
            instructions: [
              'Contact the seller for their UK bank details',
              'Send the exact amount shown below in GBP',
              'Use the reference number provided',
              'Transfers usually take 1-3 business days',
              'Keep your receipt for confirmation'
            ]
          };
        case 'EUR':
          return {
            accountName: selectedConversation?.otherUserName || 'Seller',
            iban: 'Contact seller for IBAN',
            bic: 'Contact seller for BIC',
            bankName: 'Contact seller for bank details',
            reference: `LOKAL-${paymentData.orderId?.slice(-8) || Date.now()}`,
            isRealBankDetails: false,
            instructions: [
              'Contact the seller for their EUR bank details',
              'Send the exact amount shown below in EUR',
              'Use the reference number provided',
              'SEPA transfers take 1-2 business days',
              'Keep your receipt for confirmation'
            ]
          };
        case 'USD':
          return {
            accountName: selectedConversation?.otherUserName || 'Seller',
            accountNumber: 'Contact seller for account number',
            routingNumber: 'Contact seller for routing number',
            bankName: 'Contact seller for bank details',
            reference: `LOKAL-${paymentData.orderId?.slice(-8) || Date.now()}`,
            isRealBankDetails: false,
            instructions: [
              'Contact the seller for their USD bank details',
              'Send the exact amount shown below in USD',
              'Use the reference number provided',
              'Wire transfers: Same day, ACH: 1-3 business days',
              'Keep your receipt for confirmation'
            ]
          };
        case 'NGN':
          return {
            accountName: selectedConversation?.otherUserName || 'Seller',
            accountNumber: 'Contact seller for account number',
            bankName: 'Contact seller for bank details',
            reference: `LOKAL-${paymentData.orderId?.slice(-8) || Date.now()}`,
            isRealBankDetails: false,
            instructions: [
              'Contact the seller for their Nigerian bank details',
              'Send the exact amount shown below in NGN',
              'Use the reference number provided',
              'Transfers are usually instant',
              'Keep your receipt for confirmation'
            ]
          };
        case 'KES':
          return {
            accountName: selectedConversation?.otherUserName || 'Seller',
            accountNumber: 'Contact seller for account number',
            bankName: 'Contact seller for bank details',
            reference: `LOKAL-${paymentData.orderId?.slice(-8) || Date.now()}`,
            isRealBankDetails: false,
            instructions: [
              'Contact the seller for their Kenyan bank details',
              'Send the exact amount shown below in KES',
              'Use the reference number provided',
              'Mobile transfers are usually instant',
              'Keep your receipt for confirmation'
            ]
          };
        default:
          return {
            accountName: selectedConversation?.otherUserName || 'Seller',
            accountNumber: 'Contact seller for bank details',
            bankName: 'Contact seller for bank details',
            reference: `LOKAL-${paymentData.orderId?.slice(-8) || Date.now()}`,
            isRealBankDetails: false,
            instructions: [
              'Contact the seller for their bank details',
              'Send the exact amount shown below',
              'Use the reference number provided',
              'Transfer times vary by country',
              'Keep your receipt for confirmation'
            ]
          };
      }
    };

    const details = getBankDetailsForSeller();
    setBankDetails(details);
    setLoadingBankDetails(false);
  }, [paymentData.currency, paymentData.orderId, selectedConversation?.otherUserName, storeInfo]);

  const getCurrencySymbol = (currency) => {
    const symbols = {
      'USD': '$', 'GBP': '£', 'EUR': '€', 'JPY': '¥', 
      'NGN': '₦', 'KES': 'KSh', 'CNY': '¥'
    };
    return symbols[currency] || currency;
  };

  const formatPrice = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  };

  const handleConfirmTransfer = async () => {
    if (!confirmationData.referenceNumber.trim()) {
      alert('Please enter the bank reference number from your transfer receipt.');
      return;
    }

    if (!confirmationData.bankName.trim()) {
      alert('Please enter the name of the bank you transferred from.');
      return;
    }

    setProcessing(true);

    try {
      // Simulate bank transfer processing
      console.log('🏦 Processing bank transfer confirmation...');
      
      // Create bank transfer info
      const bankTransferInfo = {
        method: 'bank_transfer',
        referenceNumber: confirmationData.referenceNumber,
        transferDate: confirmationData.transferDate,
        amount: confirmationData.transferredAmount,
        currency: paymentData.currency,
        fromBank: confirmationData.bankName,
        toBank: bankDetails.bankName,
        transferMethod: confirmationData.transferMethod,
        accountDetails: {
          accountName: bankDetails.accountName,
          accountNumber: bankDetails.accountNumber,
          ...(bankDetails.sortCode && { sortCode: bankDetails.sortCode }),
          ...(bankDetails.iban && { iban: bankDetails.iban }),
          ...(bankDetails.routingNumber && { routingNumber: bankDetails.routingNumber })
        },
        status: 'pending_verification', // Bank transfers need seller verification
        submittedAt: new Date().toISOString(),
        verificationRequired: true
      };

      // Generate a simulated payment intent ID for bank transfer
      const paymentIntentId = `bank_transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log('✅ Bank transfer logged successfully');

      // Call success callback
      onPaymentSuccess({
        paymentIntentId,
        bankTransferInfo
      });

      setTransferStep('completed');
    } catch (error) {
      console.error('❌ Bank transfer error:', error);
      onPaymentError(error.message || 'Failed to process bank transfer confirmation');
    } finally {
      setProcessing(false);
    }
  };

  if (loadingBankDetails) {
    return (
      <div style={{
        padding: '2rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        textAlign: 'center',
        border: '1px solid #dee2e6',
      }}>
        <div style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
          🏦 Bank Transfer
        </div>
        <div style={{ fontSize: '14px', color: '#999' }}>
          Loading bank details...
        </div>
      </div>
    );
  }

  if (transferStep === 'completed') {
    return (
      <div style={{
        padding: '2rem',
        backgroundColor: '#d4edda',
        borderRadius: '8px',
        border: '1px solid #c3e6cb',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '18px', color: '#155724', marginBottom: '16px' }}>
          ✅ Bank Transfer Submitted
        </div>
        <p style={{ fontSize: '14px', color: '#155724', margin: 0 }}>
          Your transfer details have been recorded. The seller will be notified and will 
          verify the payment. You'll receive confirmation once verified.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      {transferStep === 'instructions' && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: '#007bff',
            color: '#fff',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>🏦 Bank Transfer Instructions</h3>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
              Transfer {getCurrencySymbol(paymentData.currency)}{formatPrice(paymentData.total, paymentData.currency)} to complete your order
            </p>
          </div>

          {/* Bank Details */}
          <div style={{ padding: '1.5rem' }}>
            <h4 style={{ color: '#333', marginBottom: '16px', fontSize: '16px' }}>
              Transfer Details:
            </h4>
            
            <div style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '16px', 
              borderRadius: '6px',
              marginBottom: '20px',
              border: '1px solid #e9ecef'
            }}>
              {!bankDetails.isRealBankDetails && (
                <div style={{
                  backgroundColor: '#fff3cd',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px',
                  border: '1px solid #ffeaa7'
                }}>
                  <div style={{ color: '#856404', fontWeight: 'bold', marginBottom: '8px' }}>
                    ⚠️ Contact Seller for Bank Details
                  </div>
                  <div style={{ color: '#856404', fontSize: '14px' }}>
                    The seller hasn't provided their bank details yet. Please contact them directly to get the correct bank transfer information.
                  </div>
                </div>
              )}
              
              <div style={{ marginBottom: '12px' }}>
                <strong>Account Name:</strong> {bankDetails.accountName}
              </div>
              
              {bankDetails.accountNumber && bankDetails.accountNumber !== 'Contact seller for details' && bankDetails.accountNumber !== 'Contact seller for account number' && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>Account Number:</strong> {bankDetails.accountNumber}
                </div>
              )}
              
              {bankDetails.sortCode && bankDetails.sortCode !== 'Contact seller for sort code' && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>Sort Code:</strong> {bankDetails.sortCode}
                </div>
              )}
              
              {bankDetails.iban && bankDetails.iban !== 'Contact seller for IBAN' && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>IBAN:</strong> {bankDetails.iban}
                </div>
              )}
              
              {bankDetails.routingNumber && bankDetails.routingNumber !== 'Contact seller for routing number' && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>Routing Number:</strong> {bankDetails.routingNumber}
                </div>
              )}
              
              {bankDetails.transitNumber && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>Transit Number:</strong> {bankDetails.transitNumber}
                </div>
              )}
              
              {bankDetails.branchCode && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>Branch Code:</strong> {bankDetails.branchCode}
                </div>
              )}
              
              {bankDetails.bic && bankDetails.bic !== 'Contact seller for BIC' && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>BIC/SWIFT:</strong> {bankDetails.bic}
                </div>
              )}
              
              {bankDetails.swiftCode && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>SWIFT Code:</strong> {bankDetails.swiftCode}
                </div>
              )}
              
              {bankDetails.mobileNumber && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>Mobile Money:</strong> {bankDetails.mobileNumber}
                </div>
              )}
              
              <div style={{ marginBottom: '12px' }}>
                <strong>Bank:</strong> {bankDetails.bankName}
              </div>
              
              {bankDetails.country && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>Country:</strong> {bankDetails.country}
                </div>
              )}
              
              <div style={{ 
                backgroundColor: '#fff3cd', 
                padding: '12px', 
                borderRadius: '4px',
                border: '1px solid #ffeaa7',
                marginTop: '16px'
              }}>
                <strong style={{ color: '#856404' }}>Reference Number:</strong>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold', 
                  color: '#856404',
                  marginTop: '4px',
                  fontFamily: 'monospace'
                }}>
                  {bankDetails.reference}
                </div>
                <small style={{ color: '#856404', display: 'block', marginTop: '4px' }}>
                  Include this reference when making the transfer
                </small>
              </div>
            </div>

            <h4 style={{ color: '#333', marginBottom: '12px', fontSize: '16px' }}>
              Instructions:
            </h4>
            <ul style={{ 
              marginBottom: '20px', 
              paddingLeft: '20px',
              color: '#555'
            }}>
              {bankDetails.instructions.map((instruction, index) => (
                <li key={index} style={{ marginBottom: '8px' }}>
                  {instruction}
                </li>
              ))}
            </ul>

            <div style={{
              backgroundColor: '#e3f2fd',
              padding: '16px',
              borderRadius: '6px',
              marginBottom: '20px',
              border: '1px solid #bbdefb'
            }}>
              <div style={{ color: '#1565c0', fontWeight: 'bold', marginBottom: '8px' }}>
                💡 Important Notes:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#1565c0' }}>
                <li>Transfer the exact amount: {getCurrencySymbol(paymentData.currency)}{formatPrice(paymentData.total, paymentData.currency)}</li>
                <li>Always include the reference number</li>
                <li>Keep your transfer receipt/confirmation</li>
                <li>Seller will verify payment before releasing items</li>
              </ul>
            </div>

            <button
              onClick={() => setTransferStep('confirmation')}
              style={{
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer',
                width: '100%',
                fontWeight: 'bold'
              }}
            >
              I've Made the Transfer ✓
            </button>
          </div>
        </div>
      )}

      {transferStep === 'confirmation' && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            backgroundColor: '#28a745',
            color: '#fff',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>📋 Confirm Your Transfer</h3>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
              Please provide your transfer details for verification
            </p>
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                Bank Reference Number *
              </label>
              <input
                type="text"
                value={confirmationData.referenceNumber}
                onChange={(e) => setConfirmationData({
                  ...confirmationData,
                  referenceNumber: e.target.value
                })}
                placeholder="Enter reference from your bank receipt"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                Your Bank Name *
              </label>
              <input
                type="text"
                value={confirmationData.bankName}
                onChange={(e) => setConfirmationData({
                  ...confirmationData,
                  bankName: e.target.value
                })}
                placeholder="Name of the bank you transferred from"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                Transfer Date
              </label>
              <input
                type="date"
                value={confirmationData.transferDate}
                onChange={(e) => setConfirmationData({
                  ...confirmationData,
                  transferDate: e.target.value
                })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                Transfer Method
              </label>
              <select
                value={confirmationData.transferMethod}
                onChange={(e) => setConfirmationData({
                  ...confirmationData,
                  transferMethod: e.target.value
                })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="online">Online Banking</option>
                <option value="mobile">Mobile Banking</option>
                <option value="branch">Bank Branch</option>
                <option value="atm">ATM</option>
              </select>
            </div>

            <div style={{
              backgroundColor: '#fff3cd',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '20px',
              border: '1px solid #ffeaa7'
            }}>
              <small style={{ color: '#856404' }}>
                💡 The seller will verify your transfer before releasing the items. 
                This usually takes 1-24 hours depending on your bank.
              </small>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setTransferStep('instructions')}
                style={{
                  backgroundColor: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                ← Back
              </button>
              
              <button
                onClick={handleConfirmTransfer}
                disabled={processing}
                style={{
                  backgroundColor: processing ? '#ccc' : '#007bff',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  flex: 2,
                  fontWeight: 'bold'
                }}
              >
                {processing ? 'Processing...' : 'Confirm Transfer ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankTransferForm;
