import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, getDocs } from 'firebase/firestore';

function SettingsPage() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [paymentInfo, setPaymentInfo] = useState({});
  const [editPayment, setEditPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCountry, setPaymentCountry] = useState('');
  const [ukSortCode, setUkSortCode] = useState('');
  const [ukAccountNumber, setUkAccountNumber] = useState('');
  const [ukExpiry, setUkExpiry] = useState('');
  const [ukBankName, setUkBankName] = useState('');
  const [ngAccountNumber, setNgAccountNumber] = useState('');
  const [ngBankName, setNgBankName] = useState('');
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
  const [otherPayment, setOtherPayment] = useState('');
  const [discounts, setDiscounts] = useState([]);
  const [newDiscount, setNewDiscount] = useState({ item: '', percent: '', description: '', validity: '' });
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showDeactivateWarning, setShowDeactivateWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storeItems, setStoreItems] = useState([]);
  const [view, setView] = useState('main'); // 'main', 'payment', 'discounts', 'account', 'about'

  // Use onAuthStateChanged to reliably get the user
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Firestore data when user is set
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    let unsubscribeDiscounts = null;
    (async () => {
      // Try to get store doc
      const storeRef = doc(db, 'stores', user.uid);
      const storeSnap = await getDoc(storeRef);
      if (storeSnap.exists()) {
        setUserType('seller');
        setPaymentType(storeSnap.data().paymentType || '');
        setPaymentInfo(storeSnap.data().paymentInfo || {});
        // Listen for discounts
        const discountsRef = collection(db, 'stores', user.uid, 'discounts');
        unsubscribeDiscounts = onSnapshot(discountsRef, (snap) => {
          setDiscounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        // Fetch store items for dropdown
        const itemsRef = collection(db, 'stores', user.uid, 'items');
        const itemsSnap = await getDocs(itemsRef);
        setStoreItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      } else {
        // Try to get user doc
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserType('buyer');
          setPaymentType(userSnap.data().paymentType || '');
        }
        setLoading(false);
      }
    })();
    return () => {
      if (unsubscribeDiscounts) unsubscribeDiscounts();
    };
  }, [user]);

  const handlePaymentChange = () => setEditPayment(true);

  const handlePaymentSave = async () => {
    if (!user) return;
    let info = {};
    if (userType === 'seller' && paymentType === 'Own Card/Bank Details') {
      if (paymentCountry === 'UK') {
        info = { country: 'UK', sortCode: ukSortCode, accountNumber: ukAccountNumber, bankName: ukBankName, expiry: ukExpiry };
      } else if (paymentCountry === 'Nigeria') {
        info = { country: 'Nigeria', accountNumber: ngAccountNumber, bankName: ngBankName };
      } else if (paymentCountry === 'USA') {
        info = { country: 'USA', routingNumber: usRouting, accountNumber: usAccount, bankName: usBank };
      } else if (paymentCountry === 'Canada') {
        info = { country: 'Canada', transitNumber: caTransit, accountNumber: caAccount, bankName: caBank };
      } else if (paymentCountry === 'South Africa') {
        info = { country: 'South Africa', accountNumber: saAccount, bankName: saBank, branchCode: saBranch };
      } else if (paymentCountry === 'Ghana') {
        info = { country: 'Ghana', accountNumber: ghAccount, bankName: ghBank, mobileMoney: ghMobile };
      } else if (paymentCountry === 'Kenya') {
        info = { country: 'Kenya', accountNumber: keAccount, bankName: keBank, mobileMoney: keMobile };
      } else if (paymentCountry === 'Jamaica' || paymentCountry === 'Trinidad & Tobago') {
        info = { country: paymentCountry, accountNumber: caribAccount, bankName: caribBank, branchCode: caribBranch };
      } else if (paymentCountry === 'Other') {
        info = { country: 'Other', details: otherPayment };
      }
    }
    const ref = userType === 'seller' ? doc(db, 'stores', user.uid) : doc(db, 'users', user.uid);
    await updateDoc(ref, userType === 'seller' ? { paymentType, paymentInfo: info } : { paymentType });
    setEditPayment(false);
    setPaymentInfo(info);
    setView('main');
  };

  const handleAddDiscount = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!newDiscount.item.trim() || !newDiscount.percent.trim()) return;
    await addDoc(collection(db, 'stores', user.uid, 'discounts'), newDiscount);
    setNewDiscount({ item: '', percent: '', description: '', validity: '' });
  };

  const handleDeleteAccount = () => {
    setShowDeleteWarning(false);
    alert('Account deleted (not implemented)');
  };

  const handleDeactivateAccount = () => {
    setShowDeactivateWarning(false);
    alert('Account deactivated (not implemented)');
  };

  const handlePaymentModalSave = () => {
    let info = {};
    if (paymentCountry === 'UK') {
      info = { country: 'UK', sortCode: ukSortCode, accountNumber: ukAccountNumber, bankName: ukBankName, expiry: ukExpiry };
    } else if (paymentCountry === 'Nigeria') {
      info = { country: 'Nigeria', accountNumber: ngAccountNumber, bankName: ngBankName };
    } else if (paymentCountry === 'USA') {
      info = { country: 'USA', routingNumber: usRouting, accountNumber: usAccount, bankName: usBank };
    } else if (paymentCountry === 'Canada') {
      info = { country: 'Canada', transitNumber: caTransit, accountNumber: caAccount, bankName: caBank };
    } else if (paymentCountry === 'South Africa') {
      info = { country: 'South Africa', accountNumber: saAccount, bankName: saBank, branchCode: saBranch };
    } else if (paymentCountry === 'Ghana') {
      info = { country: 'Ghana', accountNumber: ghAccount, bankName: ghBank, mobileMoney: ghMobile };
    } else if (paymentCountry === 'Kenya') {
      info = { country: 'Kenya', accountNumber: keAccount, bankName: keBank, mobileMoney: keMobile };
    } else if (paymentCountry === 'Jamaica' || paymentCountry === 'Trinidad & Tobago') {
      info = { country: paymentCountry, accountNumber: caribAccount, bankName: caribBank, branchCode: caribBranch };
    } else if (paymentCountry === 'Other') {
      info = { country: 'Other', details: otherPayment };
    }
    setPaymentInfo(info);
    setShowPaymentModal(false);
  };

  function getPaymentSummary() {
    if (paymentType === 'Own Card/Bank Details') {
      if (paymentInfo.country === 'UK') {
        return `UK: Sort Code ${paymentInfo.sortCode}, Account ${paymentInfo.accountNumber}, Bank ${paymentInfo.bankName}, Expiry ${paymentInfo.expiry}`;
      } else if (paymentInfo.country === 'Nigeria') {
        return `Nigeria: Account ${paymentInfo.accountNumber}, Bank ${paymentInfo.bankName}`;
      } else if (paymentInfo.country === 'USA') {
        return `USA: Routing ${paymentInfo.routingNumber}, Account ${paymentInfo.accountNumber}, Bank ${paymentInfo.bankName}`;
      } else if (paymentInfo.country === 'Canada') {
        return `Canada: Transit ${paymentInfo.transitNumber}, Account ${paymentInfo.accountNumber}, Bank ${paymentInfo.bankName}`;
      } else if (paymentInfo.country === 'South Africa') {
        return `South Africa: Account ${paymentInfo.accountNumber}, Bank ${paymentInfo.bankName}, Branch ${paymentInfo.branchCode}`;
      } else if (paymentInfo.country === 'Ghana') {
        return `Ghana: Account ${paymentInfo.accountNumber}, Bank ${paymentInfo.bankName}, Mobile Money ${paymentInfo.mobileMoney}`;
      } else if (paymentInfo.country === 'Kenya') {
        return `Kenya: Account ${paymentInfo.accountNumber}, Bank ${paymentInfo.bankName}, Mobile Money ${paymentInfo.mobileMoney}`;
      } else if (paymentInfo.country === 'Jamaica' || paymentInfo.country === 'Trinidad & Tobago') {
        return `${paymentInfo.country}: Account ${paymentInfo.accountNumber}, Bank ${paymentInfo.bankName}, Branch ${paymentInfo.branchCode}`;
      } else if (paymentInfo.country === 'Other') {
        return 'Pay at Store';
      }
    } else if (paymentType === 'Other') {
      return 'Pay at Store Payment Method';
    }
    return '';
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

  // Main menu view
  if (view === 'main') {
    return (
      <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 24 }}>Settings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <button onClick={() => setView('payment')} style={{ textAlign: 'left', background: '#f6f6fa', border: '1px solid #eee', borderRadius: 8, padding: '1.2rem', fontSize: '1.1rem', fontWeight: 600, color: '#007B7F', cursor: 'pointer' }}>
              Payment Type <span style={{ float: 'right', color: '#888', fontWeight: 400 }}>{paymentType ? paymentType : 'Not set'}</span>
            </button>
            {userType === 'seller' && (
              <button onClick={() => setView('discounts')} style={{ textAlign: 'left', background: '#f6f6fa', border: '1px solid #eee', borderRadius: 8, padding: '1.2rem', fontSize: '1.1rem', fontWeight: 600, color: '#007B7F', cursor: 'pointer' }}>
                Discounts
              </button>
            )}
            <button onClick={() => setView('account')} style={{ textAlign: 'left', background: '#f6f6fa', border: '1px solid #eee', borderRadius: 8, padding: '1.2rem', fontSize: '1.1rem', fontWeight: 600, color: '#007B7F', cursor: 'pointer' }}>
              Account Management
            </button>
            <button onClick={() => setView('about')} style={{ textAlign: 'left', background: '#f6f6fa', border: '1px solid #eee', borderRadius: 8, padding: '1.2rem', fontSize: '1.1rem', fontWeight: 600, color: '#007B7F', cursor: 'pointer' }}>
              About
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Payment type view
  if (view === 'payment') {
    return (
      <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem' }}>
          <button onClick={() => setView('main')} style={{ marginBottom: 18, background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>{'< Back'}</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: 18 }}>Payment Type</h2>
          {/* Payment type edit UI here */}
          {editPayment ? (
            userType === 'seller' ? (
              <div style={{ marginBottom: 8 }}>
                <select value={paymentType} onChange={e => setPaymentType(e.target.value)} style={{ width: '100%', borderRadius: 6, border: '1px solid #ccc', padding: 8, marginBottom: 10 }}>
                  <option value="" disabled>Select payment type</option>
                  <option value="Own Card/Bank Details">Own Card/Bank Details</option>
                  <option value="Other">Pay at Store</option>
                </select>
                {paymentType === 'Own Card/Bank Details' && (
                  <button type="button" onClick={() => setShowPaymentModal(true)} style={{ marginTop: 10, background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Add Card Details</button>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={handlePaymentSave} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditPayment(false)} style={{ background: '#eee', color: '#444', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={paymentType} onChange={e => setPaymentType(e.target.value)} placeholder="Enter payment type..." style={{ flex: 1, borderRadius: 6, border: '1px solid #ccc', padding: 8 }} />
                <button onClick={handlePaymentSave} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditPayment(false)} style={{ background: '#eee', color: '#444', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            )
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>Current: {paymentType || <span style={{ color: '#888' }}>No payment type set</span>}</div>
              {userType === 'seller' && getPaymentSummary() && (
                <div style={{ color: '#007070', background: '#f6f6fa', borderRadius: 8, padding: '0.8rem 1rem', marginBottom: 8 }}>{getPaymentSummary()}</div>
              )}
              <button onClick={handlePaymentChange} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Change Payment Type</button>
            </>
          )}
          {/* Payment Modal for Card/Bank Details */}
          {showPaymentModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
                <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>Add Card/Bank Details</h3>
                {/* ... country select and fields ... */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button type="button" onClick={() => setShowPaymentModal(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Close</button>
                  <button type="button" onClick={handlePaymentModalSave} style={{ background: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Discounts view
  if (view === 'discounts') {
    return (
      <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem' }}>
          <button onClick={() => setView('main')} style={{ marginBottom: 18, background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>{'< Back'}</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: 18 }}>Discounts</h2>
          {/* Discounts UI here */}
          <ul style={{ marginBottom: 12 }}>
            {discounts.length === 0 ? <li style={{ color: '#888' }}>No discounts set</li> : discounts.map((d, i) => <li key={d.id}>{d.item} - {d.percent}% - {d.description} (Valid: {d.validity})</li>)}
          </ul>
          <form onSubmit={handleAddDiscount} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={newDiscount.item} onChange={e => setNewDiscount({ ...newDiscount, item: e.target.value })} style={{ flex: 1, borderRadius: 6, border: '1px solid #ccc', padding: 8 }}>
              <option value="">{storeItems.length === 0 ? 'No items available' : 'Select item'}</option>
              {storeItems.map(item => (
                <option key={item.id} value={item.name || item.title || item.id}>{item.name || item.title || item.id}</option>
              ))}
            </select>
            <input type="text" value={newDiscount.percent} onChange={e => setNewDiscount({ ...newDiscount, percent: e.target.value })} placeholder="Percent" style={{ width: 80, borderRadius: 6, border: '1px solid #ccc', padding: 8 }} />
            <input type="text" value={newDiscount.description} onChange={e => setNewDiscount({ ...newDiscount, description: e.target.value })} placeholder="Description" style={{ flex: 2, borderRadius: 6, border: '1px solid #ccc', padding: 8 }} />
            <input type="text" value={newDiscount.validity} onChange={e => setNewDiscount({ ...newDiscount, validity: e.target.value })} placeholder="Validity" style={{ width: 120, borderRadius: 6, border: '1px solid #ccc', padding: 8 }} />
            <button type="submit" style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Add</button>
          </form>
        </div>
      </div>
    );
  }

  // Account management view
  if (view === 'account') {
    return (
      <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 600, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem' }}>
          <button onClick={() => setView('main')} style={{ marginBottom: 18, background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>{'< Back'}</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: 18 }}>Account Management</h2>
          <button onClick={() => setShowDeactivateWarning(true)} style={{ background: '#FFD700', color: '#222', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, marginRight: 12, cursor: 'pointer' }}>Deactivate Account</button>
          <button onClick={() => setShowDeleteWarning(true)} style={{ background: '#D92D20', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Delete Account</button>
        </div>
      </div>
    );
  }

  // About page view
  if (view === 'about') {
    return (
      <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 700, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2.5rem 2rem' }}>
          <button onClick={() => setView('main')} style={{ marginBottom: 18, background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>{'< Back'}</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 18 }}>About Lokal</h2>
          <div style={{ color: '#222', fontSize: '1.1rem', lineHeight: 1.7 }}>
            <p><b>Lokal</b> is your dedicated African & Caribbean e-commerce marketplace, designed to help you discover and connect with nearby stores in your community. Unlike generic search engines that provide vague locations and limited information, Lokal empowers you to create a vibrant virtual store, showcase your products, engage with customers, and receive real feedback—all in one place.</p>
            <p>The inspiration for Lokal began in 2023, when our founder recognized a significant gap in the market. Finding authentic African and Caribbean stores for daily shopping was a challenge, and even when such stores were found, accessibility was often an issue. Lokal—originally known as Folo—was created to bridge this gap, making it easy to find, shop, and communicate with local African and Caribbean businesses. Whether you want to shop online, chat with store owners, or arrange delivery or collection, Lokal brings the marketplace to your fingertips.</p>
            <p>Our mission is to empower African & Caribbean businesses to reach new customers and grow their income in a way that is more accessible and community-driven than traditional platforms like Google, Facebook, or Instagram. We are building a space where business owners can not only sell to local shoppers, but also connect with vendors and partners from across Africa, the Caribbean, and around the world.</p>
            <p>At Lokal, we believe African & Caribbean businesses matter. We are committed to building a supportive community that helps everyone thrive—whether you are a store owner, a shopper, or a vendor. Join us as we celebrate culture, support local enterprise, and create new opportunities for growth and connection.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default SettingsPage;