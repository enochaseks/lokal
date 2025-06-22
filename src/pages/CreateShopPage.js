import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAuth } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function CreateShopPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const sellerData = location.state || {};
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

  const handleBackgroundImgChange = (e) => {
    setBackgroundImg(e.target.files[0]);
  };

  const handleCreateShop = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      let backgroundUrl = '';
      if (backgroundImg) {
        const imgRef = ref(storage, `storeBanners/${user.uid}/${backgroundImg.name}`);
        await uploadBytes(imgRef, backgroundImg);
        backgroundUrl = await getDownloadURL(imgRef);
      }
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
      const storeProfile = {
        ownerId: user.uid,
        storeName: sellerData.storeName || sellerData.marketName || sellerData.onlineName || '',
        storeLocation: sellerData.storeLocation || sellerData.marketLocation || sellerData.onlineLocation || '',
        businessId: sellerData.businessId || '',
        certificate: sellerData.certificate?.name || '',
        foodHygiene: sellerData.foodHygiene?.name || '',
        marketStallLicence: sellerData.marketStallLicence?.name || '',
        platform: sellerData.platform || '',
        socialHandle: sellerData.socialHandle || '',
        hasWebsite: sellerData.hasWebsite || '',
        websiteLink: sellerData.websiteLink || '',
        onlineLicence: sellerData.onlineLicence?.name || '',
        origin: sellerData.origin || '',
        backgroundImg: backgroundUrl,
        deliveryType,
        hasOwnDelivery: deliveryType === 'Delivery' ? hasOwnDelivery : '',
        paymentType,
        paymentInfo,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'stores', user.uid), storeProfile);
      setLoading(false);
      navigate('/store-profile', { state: { ...storeProfile } });
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
            {sellerData.storeName && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Store Name:</b> {sellerData.storeName}</li>
            )}
            {sellerData.storeLocation && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Store Location:</b> {sellerData.storeLocation}</li>
            )}
            {sellerData.marketName && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Market Name:</b> {sellerData.marketName}</li>
            )}
            {sellerData.marketLocation && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Market Location:</b> {sellerData.marketLocation}</li>
            )}
            {sellerData.onlineName && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Online Name:</b> {sellerData.onlineName}</li>
            )}
            {sellerData.platform && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Platform:</b> {sellerData.platform}</li>
            )}
            {sellerData.socialHandle && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Social Handle:</b> {sellerData.socialHandle}</li>
            )}
            {sellerData.hasWebsite && sellerData.hasWebsite === 'yes' && sellerData.websiteLink && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Website:</b> {sellerData.websiteLink}</li>
            )}
            {sellerData.businessId && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Business ID:</b> {sellerData.businessId}</li>
            )}
            {sellerData.certificate && sellerData.certificate.name && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Certificate:</b> {sellerData.certificate.name}</li>
            )}
            {sellerData.foodHygiene && sellerData.foodHygiene.name && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Food Hygiene Certificate:</b> {sellerData.foodHygiene.name}</li>
            )}
            {sellerData.marketStallLicence && sellerData.marketStallLicence.name && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Market Stall Licence:</b> {sellerData.marketStallLicence.name}</li>
            )}
            {sellerData.onlineLicence && sellerData.onlineLicence.name && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Online Licence:</b> {sellerData.onlineLicence.name}</li>
            )}
            {sellerData.origin && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Type of Origin:</b> {sellerData.origin}</li>
            )}
            {sellerData.onlineLocation && (
              <li style={{ marginBottom: '0.7rem' }}><b style={{ fontWeight: 600 }}>Online Location:</b> {sellerData.onlineLocation}</li>
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
            <select value={deliveryType} onChange={e => {
              setDeliveryType(e.target.value);
              setHasOwnDelivery('');
              setShowDeliveryMsg(false);
            }} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}>
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
            <select value={paymentType} onChange={e => setPaymentType(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}>
              <option value="" disabled>Select payment type</option>
              <option value="Own Card/Bank Details">Own Card/Bank Details</option>
              <option value="Other">Pay at Store</option>
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
          <button type="submit" style={{ width: '100%', background: '#D92D20', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '0.5px', marginTop: '0.5rem', boxShadow: '0 2px 8px #B8B8B8', transition: 'background 0.2s' }} disabled={loading}>{loading ? 'Creating...' : 'Create Shop'}</button>
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
                  <input type="text" value={ukExpiry} onChange={e => setUkExpiry(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} placeholder="MM/YY" />
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
    </div>
  );
}

export default CreateShopPage; 