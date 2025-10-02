import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import QRCodeModal from '../components/QRCodeModal';
import PaymentProviderSelector from '../components/PaymentProviderSelector';
import { getAuth } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function maskValue(value) {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

function CreateShopPage() {
  const location = useLocation();
  const navigate = useNavigate();
  let sellerData = location.state || {};

  // Fallback: Load from localStorage if location.state is empty
  if (Object.keys(sellerData).length === 0) {
    try {
      const saved = localStorage.getItem('sellerData');
      if (saved) sellerData = JSON.parse(saved);
    } catch {}
  }

  // Always save sellerData to localStorage on mount
  useEffect(() => {
    if (sellerData && Object.keys(sellerData).length > 0) {
      localStorage.setItem('sellerData', JSON.stringify(sellerData));
    }
  }, [sellerData]);

  // Get current user for Stripe Connect
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  const [backgroundImg, setBackgroundImg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deliveryType, setDeliveryType] = useState('Collection');
  const [hasOwnDelivery, setHasOwnDelivery] = useState('');
  const [showDeliveryMsg, setShowDeliveryMsg] = useState(false);
  const [paymentType, setPaymentType] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCountry, setPaymentCountry] = useState('');
  const [ukSortCode, setUkSortCode] = useState('');
  const [ukAccountNumber, setUkAccountNumber] = useState('');
  const [ukExpiry, setUkExpiry] = useState('');
  const [ukBankName, setUkBankName] = useState('');
  const [ngAccountNumber, setNgAccountNumber] = useState('');
  const [ngBankName, setNgBankName] = useState('');
  const [otherPayment, setOtherPayment] = useState('');
  const [usRouting, setUsRouting] = useState('');
  const [usAccount, setUsAccount] = useState('');
  const [usBank, setUsBank] = useState('');
  const [caTransit, setCaTransit] = useState('');
  const [caAccount, setCaAccount] = useState('');
  const [caBank, setCaBank] = useState('');
  const [saAccount, setSaAccount] = useState('');
  const [saBank, setSaBank] = useState('');
  const [saBranch, setSaBranch] = useState('');
  const [ghAccount, setGhAccount] = useState('');
  const [ghBank, setGhBank] = useState('');
  const [ghMobile, setGhMobile] = useState('');
  const [keAccount, setKeAccount] = useState('');
  const [keBank, setKeBank] = useState('');
  const [keMobile, setKeMobile] = useState('');
  const [caribAccount, setCaribAccount] = useState('');
  const [caribBank, setCaribBank] = useState('');
  const [caribBranch, setCaribBranch] = useState('');
  const [cardType, setCardType] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [createdStoreId, setCreatedStoreId] = useState('');
  const [createdStoreName, setCreatedStoreName] = useState('');
  
  // Stripe Connect states
  const [stripeConnectAccountId, setStripeConnectAccountId] = useState(null);
  const [stripeConnectRequired, setStripeConnectRequired] = useState(true);
  const [showStripeConnectStep, setShowStripeConnectStep] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const handleBackgroundImgChange = (e) => {
    setBackgroundImg(e.target.files[0]);
  };

  // Stripe Connect callback functions
  const handleStripeConnectAccountCreated = (accountId) => {
    console.log('✅ Stripe Connect account created:', accountId);
    setStripeConnectAccountId(accountId);
    setShowStripeConnectStep(false);
  };

  const handleStripeConnectBalanceUpdate = (balance) => {
    console.log('💰 Stripe Connect balance updated:', balance);
    // Balance will be handled in the wallet section
  };

  const handleCreateShop = async (e) => {
    e.preventDefault();
    if (!backgroundImg) {
      alert('Background image is required.');
      setLoading(false);
      return;
    }

    // MANDATORY: All sellers must have Stripe Connect - no virtual wallet
    if (!stripeConnectAccountId) {
      alert('⚠️ Payment Account Required: You must set up your Stripe Connect account to create a shop. This is how you will receive real money directly from customers into your bank account. Virtual wallets are no longer supported.');
      setShowStripeConnectStep(true);
      setLoading(false);
      return;
    }

    if (deliveryType === 'Delivery' && paymentType === 'Other') {
      alert("'Pay at Store' is not available with 'Delivery'. Please choose another payment method.");
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      
      // DEBUG: Print sellerData to see what is passed from onboarding
      console.log('sellerData passed to CreateShopPage:', sellerData);
      let backgroundUrl = '';
      if (backgroundImg) {
        const imgRef = ref(storage, `storeBanners/${user.uid}/${backgroundImg.name}`);
        await uploadBytes(imgRef, backgroundImg);
        backgroundUrl = await getDownloadURL(imgRef);
      }
      // --- Upload all provided files and save URLs ---
      let certificateUrl = '';
      if (sellerData.certificate) {
        const certRef = ref(storage, `storeCertificates/${user.uid}/${sellerData.certificate.name}`);
        await uploadBytes(certRef, sellerData.certificate);
        certificateUrl = await getDownloadURL(certRef);
      }
      let foodHygieneUrl = '';
      if (sellerData.foodHygiene) {
        const foodRef = ref(storage, `storeFoodHygiene/${user.uid}/${sellerData.foodHygiene.name}`);
        await uploadBytes(foodRef, sellerData.foodHygiene);
        foodHygieneUrl = await getDownloadURL(foodRef);
      }
      let marketStallLicenceUrl = '';
      if (sellerData.marketStallLicence) {
        const marketRef = ref(storage, `storeMarketStallLicence/${user.uid}/${sellerData.marketStallLicence.name}`);
        await uploadBytes(marketRef, sellerData.marketStallLicence);
        marketStallLicenceUrl = await getDownloadURL(marketRef);
      }
      let onlineLicenceUrl = '';
      if (sellerData.onlineLicence) {
        const onlineRef = ref(storage, `storeOnlineLicence/${user.uid}/${sellerData.onlineLicence.name}`);
        await uploadBytes(onlineRef, sellerData.onlineLicence);
        onlineLicenceUrl = await getDownloadURL(onlineRef);
      }
      let alcoholLicenseUrl = '';
      if (sellerData.alcoholLicense) {
        const alcRef = ref(storage, `storeAlcoholLicense/${user.uid}/${sellerData.alcoholLicense.name}`);
        await uploadBytes(alcRef, sellerData.alcoholLicense);
        alcoholLicenseUrl = await getDownloadURL(alcRef);
      }
      // --- Payment Info ---
      let paymentInfo = {};
      if (paymentType === 'Own Card/Bank Details') {
        if (paymentCountry === 'UK') {
          paymentInfo = { country: 'UK', sortCode: ukSortCode, accountNumber: ukAccountNumber, bankName: ukBankName, expiry: ukExpiry };
        } else if (paymentCountry === 'Nigeria') {
          paymentInfo = { country: 'Nigeria', accountNumber: ngAccountNumber, bankName: ngBankName };
        } else if (paymentCountry === 'USA') {
          paymentInfo = { country: 'USA', routingNumber: usRouting, accountNumber: usAccount, bankName: usBank };
        } else if (paymentCountry === 'Canada') {
          paymentInfo = { country: 'Canada', transitNumber: caTransit, accountNumber: caAccount, bankName: caBank };
        } else if (paymentCountry === 'South Africa') {
          paymentInfo = { country: 'South Africa', accountNumber: saAccount, bankName: saBank, branchCode: saBranch };
        } else if (paymentCountry === 'Ghana') {
          paymentInfo = { country: 'Ghana', accountNumber: ghAccount, bankName: ghBank, mobileMoney: ghMobile };
        } else if (paymentCountry === 'Kenya') {
          paymentInfo = { country: 'Kenya', accountNumber: keAccount, bankName: keBank, mobileMoney: keMobile };
        } else if (paymentCountry === 'Jamaica' || paymentCountry === 'Trinidad & Tobago') {
          paymentInfo = { country: paymentCountry, accountNumber: caribAccount, bankName: caribBank, branchCode: caribBranch };
        } else if (paymentCountry === 'Other') {
          paymentInfo = { country: 'Other', details: otherPayment };
        }
      }
      // Geocode the store location to get latitude and longitude
      let latitude = sellerData.latitude || null;
      let longitude = sellerData.longitude || null;
      let storeLocationString = sellerData.storeLocation || sellerData.marketLocation || sellerData.onlineLocation || '';
      if ((!latitude || !longitude) && storeLocationString) {
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(storeLocationString)}`);
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            latitude = parseFloat(geoData[0].lat);
            longitude = parseFloat(geoData[0].lon);
          }
        } catch (geoErr) {
          // If geocoding fails, leave lat/lng as null
        }
      }
      // --- Save all fields, including those for settings ---
      // Store both masked (for UI display) and unmasked (for bank transfers) payment info
      let maskedPaymentInfo = { ...paymentInfo };
      let unmaskedPaymentInfo = { ...paymentInfo }; // Keep original for bank transfers
      
      if (maskedPaymentInfo.sortCode) maskedPaymentInfo.sortCode = maskValue(maskedPaymentInfo.sortCode);
      if (maskedPaymentInfo.accountNumber) maskedPaymentInfo.accountNumber = maskValue(maskedPaymentInfo.accountNumber);
      if (maskedPaymentInfo.expiry) maskedPaymentInfo.expiry = maskValue(maskedPaymentInfo.expiry);
      if (cardType) {
        maskedPaymentInfo.cardType = cardType;
        unmaskedPaymentInfo.cardType = cardType;
      }
      const storeProfile = {
        ownerId: user.uid,
        storeName: sellerData.storeName || sellerData.marketName || sellerData.onlineName || '',
        storeLocation: sellerData.storeLocation || sellerData.marketLocation || sellerData.onlineLocation || '',
        origin: sellerData.origin || '',
        deliveryType: sellerData.deliveryType || '',
        businessId: sellerData.businessId || '',
        certificate: certificateUrl,
        foodHygiene: foodHygieneUrl,
        marketStallLicence: marketStallLicenceUrl,
        // Legacy format for backward compatibility
        platform: sellerData.platform || '',
        socialHandle: sellerData.socialHandle || '',
        hasWebsite: sellerData.hasWebsite || '',
        websiteLink: sellerData.websiteLink || '',
        // New format - convert from legacy if exists
        socialLinks: sellerData.platform && sellerData.socialHandle ? [{
          platform: sellerData.platform,
          handle: sellerData.socialHandle,
          id: Date.now()
        }] : [],
        websiteLinks: sellerData.websiteLink ? [{
          name: 'Website',
          url: sellerData.websiteLink,
          id: Date.now()
        }] : [],
        onlineLicence: onlineLicenceUrl,
        backgroundImg: backgroundUrl,
        hasOwnDelivery: deliveryType === 'Delivery' ? hasOwnDelivery : '',
        paymentType,
        paymentInfo: maskedPaymentInfo, // Masked version for UI display
        bankTransferInfo: unmaskedPaymentInfo, // Unmasked version for bank transfers
        cardType,
        createdAt: new Date().toISOString(),
        category: sellerData.category || '',
        latitude,
        longitude,
        sellsAlcohol: sellerData.sellsAlcohol || '',
        alcoholLicense: alcoholLicenseUrl,
        openingTime: sellerData.openingTime || '',
        closingTime: sellerData.closingTime || '',
        live: false, // Mark new stores as live by default
        stripeConnectAccountId: stripeConnectAccountId, // Required for receiving payments
        // Add any other fields you want to persist for settings
      };
      await setDoc(doc(db, 'stores', user.uid), storeProfile);
      await updateDoc(doc(db, 'users', user.uid), { ...storeProfile, onboardingStep: 'complete' });
      
      // Show success modal with QR code
      setCreatedStoreId(user.uid);
      setCreatedStoreName(storeProfile.storeName);
      setShowSuccessModal(true);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      alert('Error creating shop: ' + err.message);
    }
  };

  // Add a function to get a summary string for payment info
  function getPaymentSummary() {
    if (paymentType === 'Own Card/Bank Details') {
      if (paymentCountry === 'UK') {
        return `UK: Sort Code ${ukSortCode}, Account ${ukAccountNumber}, Bank ${ukBankName}, Expiry ${ukExpiry}`;
      } else if (paymentCountry === 'Nigeria') {
        return `Nigeria: Account ${ngAccountNumber}, Bank ${ngBankName}`;
      } else if (paymentCountry === 'USA') {
        return `USA: Routing ${usRouting}, Account ${usAccount}, Bank ${usBank}`;
      } else if (paymentCountry === 'Canada') {
        return `Canada: Transit ${caTransit}, Account ${caAccount}, Bank ${caBank}`;
      } else if (paymentCountry === 'South Africa') {
        return `South Africa: Account ${saAccount}, Bank ${saBank}, Branch ${saBranch}`;
      } else if (paymentCountry === 'Ghana') {
        return `Ghana: Account ${ghAccount}, Bank ${ghBank}, Mobile Money ${ghMobile}`;
      } else if (paymentCountry === 'Kenya') {
        return `Kenya: Account ${keAccount}, Bank ${keBank}, Mobile Money ${keMobile}`;
      } else if (paymentCountry === 'Jamaica' || paymentCountry === 'Trinidad & Tobago') {
        return `${paymentCountry}: Account ${caribAccount}, Bank ${caribBank}, Branch ${caribBranch}`;
      } else if (paymentCountry === 'Other') {
        return 'Pay at Store';
      }
    } else if (paymentType === 'Other') {
      return 'Pay at Store Payment Method';
    }
    return '';
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8' }}>
        <h2 style={{ color: '#1C1C1C', marginBottom: '1rem' }}>Create Shop</h2>
        <div style={{ marginBottom: '2rem' }}>
          <h4>Summary</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '1.1rem', color: '#222' }}>
            <li><b>Store Name:</b> {sellerData.storeName || 'N/A'}</li>
            <li><b>Store Location:</b> {sellerData.storeLocation || 'N/A'}</li>
            <li><b>Origin:</b> {sellerData.origin || 'N/A'}</li>
            <li><b>Category:</b> {sellerData.category || 'N/A'}</li>
            <li><b>Delivery Type:</b> {sellerData.deliveryType || 'N/A'}</li>
            {sellerData.paymentInfo && (
              <li><b>Payment Info:</b> {Object.entries(sellerData.paymentInfo).map(([k, v]) => `${k}: ${v}`).join(', ')}</li>
            )}
          </ul>
        </div>
        <form onSubmit={handleCreateShop} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '2rem', width: '100%' }}>
            <label style={{ fontWeight: 500, marginRight: 10 }}>Background Thumbnail:</label>
            <input type="file" accept="image/*" onChange={handleBackgroundImgChange} style={{ marginTop: 8 }} />
          </div>
          <div style={{ marginBottom: '1.5rem', width: '100%' }}>
            <label style={{ fontWeight: 500, marginRight: 10 }}>Delivery Type:</label>
            <select
              value={deliveryType}
              onChange={e => {
                const newDeliveryType = e.target.value;
                setDeliveryType(newDeliveryType);
                if (newDeliveryType === 'Delivery' && paymentType === 'Other') {
                  setPaymentType(''); // Reset payment type if it was 'Pay at Store'
                }
                setHasOwnDelivery('');
                setShowDeliveryMsg(false);
              }}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}
            >
              <option value="Collection">Collection</option>
              <option value="Delivery">Delivery</option>
            </select>
          </div>
          {deliveryType === 'Delivery' && (
            <div style={{ marginBottom: '1.5rem', width: '100%' }}>
              <label style={{ fontWeight: 500, marginRight: 10 }}>Do you have your own form of delivery?</label>
              <select value={hasOwnDelivery} onChange={e => {
                setHasOwnDelivery(e.target.value);
                if (e.target.value === 'yes') setShowDeliveryMsg(true);
                else if (e.target.value === 'no') {
                  setDeliveryType('Collection');
                  setHasOwnDelivery('');
                  setShowDeliveryMsg(false);
                }
              }} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}>
                <option value="" disabled>Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {showDeliveryMsg && (
                <div style={{ color: '#D92D20', marginTop: 8, fontSize: '0.98rem' }}>
                  We do not offer any transportation for delivery. You will need to use your own delivery method.
                </div>
              )}
            </div>
          )}
          <div style={{ marginBottom: '1.5rem', width: '100%' }}>
            <label style={{ fontWeight: 500, marginRight: 10 }}>Payment Type:</label>
            <select
              value={paymentType}
              onChange={e => setPaymentType(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}
            >
              <option value="" disabled>Select payment type</option>
              <option value="Own Card/Bank Details">Own Card/Bank Details</option>
              <option value="Other" disabled={deliveryType === 'Delivery'}>Pay at Store</option>
            </select>
            {paymentType === 'Own Card/Bank Details' && (
              <button type="button" onClick={() => setShowPaymentModal(true)} style={{ marginTop: 10, background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Add Card Details</button>
            )}
          </div>
          {(paymentType && getPaymentSummary()) && (
            <div style={{ marginBottom: '1.2rem', width: '100%', background: '#f6f6fa', borderRadius: 8, padding: '0.8rem 1rem', color: '#007B7F', fontSize: '1rem', maxWidth: 400 }}>
              <div style={{ fontWeight: 600, color: '#007070', marginBottom: 8 }}>Payment Details:</div>
              <div style={{ color: '#007070', lineHeight: 1.7 }}>
                {paymentType === 'Own Card/Bank Details' && paymentCountry === 'UK' && (
                  <>
                    <div><b>Country:</b> UK</div>
                    <div><b>Sort Code:</b> {ukSortCode}</div>
                    <div><b>Account:</b> {ukAccountNumber}</div>
                    <div><b>Bank:</b> {ukBankName}</div>
                    <div><b>Expiry:</b> {ukExpiry}</div>
                    {cardType && <div><b>Card Type:</b> {cardType}</div>}
                  </>
                )}
                {paymentType === 'Own Card/Bank Details' && paymentCountry === 'Nigeria' && (
                  <>
                    <div><b>Country:</b> Nigeria</div>
                    <div><b>Account:</b> {ngAccountNumber}</div>
                    <div><b>Bank:</b> {ngBankName}</div>
                  </>
                )}
                {paymentType === 'Own Card/Bank Details' && paymentCountry === 'USA' && (
                  <>
                    <div><b>Country:</b> USA</div>
                    <div><b>Routing Number:</b> {usRouting}</div>
                    <div><b>Account:</b> {usAccount}</div>
                    <div><b>Bank:</b> {usBank}</div>
                  </>
                )}
                {paymentType === 'Own Card/Bank Details' && paymentCountry === 'Canada' && (
                  <>
                    <div><b>Country:</b> Canada</div>
                    <div><b>Transit Number:</b> {caTransit}</div>
                    <div><b>Account:</b> {caAccount}</div>
                    <div><b>Bank:</b> {caBank}</div>
                  </>
                )}
                {paymentType === 'Own Card/Bank Details' && paymentCountry === 'South Africa' && (
                  <>
                    <div><b>Country:</b> South Africa</div>
                    <div><b>Account:</b> {saAccount}</div>
                    <div><b>Bank:</b> {saBank}</div>
                    <div><b>Branch Code:</b> {saBranch}</div>
                  </>
                )}
                {paymentType === 'Own Card/Bank Details' && paymentCountry === 'Ghana' && (
                  <>
                    <div><b>Country:</b> Ghana</div>
                    <div><b>Account:</b> {ghAccount}</div>
                    <div><b>Bank:</b> {ghBank}</div>
                    <div><b>Mobile Money:</b> {ghMobile}</div>
                  </>
                )}
                {paymentType === 'Own Card/Bank Details' && paymentCountry === 'Kenya' && (
                  <>
                    <div><b>Country:</b> Kenya</div>
                    <div><b>Account:</b> {keAccount}</div>
                    <div><b>Bank:</b> {keBank}</div>
                    <div><b>Mobile Money:</b> {keMobile}</div>
                  </>
                )}
                {paymentType === 'Own Card/Bank Details' && (paymentCountry === 'Jamaica' || paymentCountry === 'Trinidad & Tobago') && (
                  <>
                    <div><b>Country:</b> {paymentCountry}</div>
                    <div><b>Account:</b> {caribAccount}</div>
                    <div><b>Bank:</b> {caribBank}</div>
                    <div><b>Branch/Transit Code:</b> {caribBranch}</div>
                  </>
                )}
                {paymentType === 'Own Card/Bank Details' && paymentCountry === 'Other' && (
                  <div>Pay at Store</div>
                )}
                {paymentType === 'Other' && (
                  <div>Pay at Store Method</div>
                )}
              </div>
              <div style={{ color: '#888', marginTop: 8, fontSize: 15 }}>
                You can always change or remove your payment method in your settings page &gt; payment method.
              </div>
            </div>
          )}

          {/* Mandatory Stripe Connect Setup */}
          <div style={{ 
            width: '100%', 
            margin: '2rem 0',
            padding: '1.5rem',
            background: stripeConnectAccountId ? '#f0f9ff' : '#fff3cd',
            border: stripeConnectAccountId ? '2px solid #0ea5e9' : '2px solid #ffc107',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>
                {stripeConnectAccountId ? '✅' : '🔗'}
              </span>
              <h3 style={{ margin: 0, color: stripeConnectAccountId ? '#0ea5e9' : '#856404' }}>
                {stripeConnectAccountId ? 'Payment Account Connected!' : 'Payment Account Setup Required'}
              </h3>
            </div>
            
            {stripeConnectAccountId ? (
              <div>
                <p style={{ margin: '0 0 10px 0', color: '#0ea5e9' }}>
                  ✅ Your Stripe account is connected! Customers will pay directly into your account, and you can withdraw to your bank instantly.
                </p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                  Account ID: {stripeConnectAccountId.substring(0, 20)}...
                </p>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 15px 0', color: '#856404', fontWeight: '500' }}>
                  ⚠️ Set up your payment account to receive money directly from customers
                </p>
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Why this is required:</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                    <li>💰 <strong>Get real money instantly</strong> - No waiting for platform payouts</li>
                    <li>🏦 <strong>Withdraw to your bank</strong> - Direct access to your earnings</li>
                    <li>📊 <strong>Professional reporting</strong> - Tax documents and analytics</li>
                    <li>🛡️ <strong>Fraud protection</strong> - Enterprise-grade security</li>
                  </ul>
                </div>
                
                {showStripeConnectStep ? (
                  <div style={{ background: 'white', padding: '15px', borderRadius: '8px' }}>
                    <PaymentProviderSelector
                      currentUser={currentUser}
                      onAccountCreated={handleStripeConnectAccountCreated}
                      onBalanceUpdate={handleStripeConnectBalanceUpdate}
                      showAccountCreation={true}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowStripeConnectStep(true)}
                    style={{
                      width: '100%',
                      background: '#0ea5e9',
                      color: 'white',
                      padding: '12px',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      cursor: 'pointer'
                    }}
                  >
                    🚀 Set Up Payment Account
                  </button>
                )}
              </div>
            )}
          </div>

          <button type="submit" style={{ width: '100%', background: stripeConnectAccountId ? '#D92D20' : '#666', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '0.5px', marginTop: '0.5rem', boxShadow: '0 2px 8px #B8B8B8', transition: 'background 0.2s' }} disabled={loading || !stripeConnectAccountId}>
            {loading ? 'Creating...' : !stripeConnectAccountId ? 'Complete Payment Setup First' : 'Create Shop'}
          </button>
        </form>
      </div>
      {showPaymentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>Add Card/Bank Details</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Country</label>
              <select value={paymentCountry} onChange={e => setPaymentCountry(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}>
                <option value="" disabled>Select country</option>
                <option value="UK">UK</option>
                <option value="Nigeria">Nigeria</option>
                <option value="USA">USA</option>
                <option value="Canada">Canada</option>
                <option value="South Africa">South Africa</option>
                <option value="Ghana">Ghana</option>
                <option value="Kenya">Kenya</option>
                <option value="Jamaica">Jamaica</option>
                <option value="Trinidad & Tobago">Trinidad & Tobago</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {/* Card Type Selection */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Card Type</label>
              <select value={cardType} onChange={e => setCardType(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="" disabled>Select card type</option>
                <option value="Personal">Personal</option>
                <option value="Business">Business</option>
              </select>
            </div>
            {paymentCountry === 'UK' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label>Sort Code</label>
                  <input type="text" value={ukSortCode} onChange={e => setUkSortCode(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Account Number</label>
                  <input type="text" value={ukAccountNumber} onChange={e => setUkAccountNumber(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Bank Name</label>
                  <input type="text" value={ukBankName} onChange={e => setUkBankName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Expiry Date</label>
                  <input
                    type="text"
                    value={ukExpiry}
                    onChange={e => {
                      let value = e.target.value.replace(/[^0-9]/g, '');
                      if (value.length > 4) value = value.slice(0, 4);
                      if (value.length > 2) value = value.slice(0, 2) + '/' + value.slice(2);
                      setUkExpiry(value);
                    }}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}
                    placeholder="MM/YY"
                    maxLength={5}
                  />
                </div>
              </>
            )}
            {paymentCountry === 'Nigeria' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label>Account Number</label>
                  <input type="text" value={ngAccountNumber} onChange={e => setNgAccountNumber(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Bank Name</label>
                  <input type="text" value={ngBankName} onChange={e => setNgBankName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
              </>
            )}
            {paymentCountry === 'USA' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label>Routing Number</label>
                  <input type="text" value={usRouting} onChange={e => setUsRouting(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Account Number</label>
                  <input type="text" value={usAccount} onChange={e => setUsAccount(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Bank Name</label>
                  <input type="text" value={usBank} onChange={e => setUsBank(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
              </>
            )}
            {paymentCountry === 'Canada' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label>Transit Number</label>
                  <input type="text" value={caTransit} onChange={e => setCaTransit(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Account Number</label>
                  <input type="text" value={caAccount} onChange={e => setCaAccount(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Bank Name</label>
                  <input type="text" value={caBank} onChange={e => setCaBank(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
              </>
            )}
            {paymentCountry === 'South Africa' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label>Account Number</label>
                  <input type="text" value={saAccount} onChange={e => setSaAccount(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Bank Name</label>
                  <input type="text" value={saBank} onChange={e => setSaBank(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Branch Code</label>
                  <input type="text" value={saBranch} onChange={e => setSaBranch(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
              </>
            )}
            {paymentCountry === 'Ghana' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label>Account Number</label>
                  <input type="text" value={ghAccount} onChange={e => setGhAccount(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Bank Name</label>
                  <input type="text" value={ghBank} onChange={e => setGhBank(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Mobile Money Number (optional)</label>
                  <input type="text" value={ghMobile} onChange={e => setGhMobile(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
              </>
            )}
            {paymentCountry === 'Kenya' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label>Account Number</label>
                  <input type="text" value={keAccount} onChange={e => setKeAccount(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Bank Name</label>
                  <input type="text" value={keBank} onChange={e => setKeBank(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Mobile Money Number (optional)</label>
                  <input type="text" value={keMobile} onChange={e => setKeMobile(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
              </>
            )}
            {(paymentCountry === 'Jamaica' || paymentCountry === 'Trinidad & Tobago') && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label>Account Number</label>
                  <input type="text" value={caribAccount} onChange={e => setCaribAccount(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Bank Name</label>
                  <input type="text" value={caribBank} onChange={e => setCaribBank(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label>Branch/Transit Code</label>
                  <input type="text" value={caribBranch} onChange={e => setCaribBranch(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
                </div>
              </>
            )}
            {paymentCountry === 'Other' && (
              <div style={{ marginBottom: 14 }}>
                <label>Payment Details</label>
                <input type="text" value={otherPayment} onChange={e => setOtherPayment(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setShowPaymentModal(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Close</button>
              <button type="button" onClick={() => setShowPaymentModal(false)} style={{ background: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Modal with QR Code */}
      {showSuccessModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000 
        }}>
          <div style={{ 
            background: '#fff', 
            borderRadius: 16, 
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)', 
            padding: '2rem', 
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ 
                fontSize: '3rem', 
                marginBottom: '0.5rem' 
              }}>🎉</div>
              <h2 style={{ 
                color: '#007B7F', 
                marginBottom: '0.5rem',
                fontSize: '1.5rem'
              }}>
                Shop Created Successfully!
              </h2>
              <p style={{ 
                color: '#666', 
                fontSize: '1rem',
                marginBottom: '1.5rem',
                lineHeight: '1.4'
              }}>
                Congratulations! Your store "{createdStoreName}" is now live on the platform.
              </p>
            </div>
            
            <div style={{ 
              background: '#f8f9ff', 
              borderRadius: 12, 
              padding: '1.5rem', 
              marginBottom: '1.5rem',
              border: '2px dashed #007B7F'
            }}>
              <h3 style={{ 
                color: '#007B7F', 
                marginBottom: '1rem',
                fontSize: '1.2rem'
              }}>
                🏪 Your Store is Ready!
              </h3>
              <p style={{ 
                color: '#666', 
                fontSize: '0.9rem', 
                marginBottom: '1rem',
                lineHeight: '1.4'
              }}>
                Share your store with customers using a QR code
              </p>
              
              <button
                onClick={() => setShowQRModal(true)}
                style={{
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  margin: '0 auto'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
              >
                📱 View QR Code
              </button>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/store-profile');
                }}
                style={{
                  background: '#007B7F',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#005a5d'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#007B7F'}
              >
                View My Store
              </button>
              
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/');
                }}
                style={{
                  background: '#fff',
                  color: '#007B7F',
                  border: '2px solid #007B7F',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#007B7F';
                  e.target.style.color = '#fff';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#fff';
                  e.target.style.color = '#007B7F';
                }}
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* QR Code Modal */}
      {showQRModal && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          storeId={createdStoreId}
          storeName={createdStoreName}
        />
      )}
    </div>
  );
}

export default CreateShopPage; 