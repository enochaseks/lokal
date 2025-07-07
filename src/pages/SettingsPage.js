import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

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
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);
  const [cardType, setCardType] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [storeData, setStoreData] = useState(null);
  const navigate = useNavigate();

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
        if (storeSnap.data().paymentInfo && storeSnap.data().paymentInfo.cardType) {
          setCardType(storeSnap.data().paymentInfo.cardType);
        }
        // Listen for discounts
        const discountsRef = collection(db, 'stores', user.uid, 'discounts');
        unsubscribeDiscounts = onSnapshot(discountsRef, (snap) => {
          setDiscounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        // Fetch store items for dropdown
        const itemsRef = collection(db, 'stores', user.uid, 'items');
        const itemsSnap = await getDocs(itemsRef);
        setStoreItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setStoreData(storeSnap.data());
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

  useEffect(() => {
    const fetchOrCreateStore = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      const storeRef = doc(db, 'stores', user.uid);
      const storeSnap = await getDoc(storeRef);
      if (!storeSnap.exists()) {
        // Create with default values if not found
        const defaultData = {
          ownerId: user.uid,
          businessId: '',
          certificate: '',
          paymentInfo: {},
          createdAt: new Date().toISOString(),
          // ...add all other fields you want to initialize
        };
        await setDoc(storeRef, defaultData);
        setStoreData(defaultData);
      } else {
        setStoreData(storeSnap.data());
      }
    };
    fetchOrCreateStore();
  }, []);

  // Keep cardType in sync with paymentInfo
  useEffect(() => {
    if (paymentInfo && paymentInfo.cardType) {
      setCardType(paymentInfo.cardType);
    }
  }, [paymentInfo]);

  const handlePaymentChange = () => setEditPayment(true);

  const handlePaymentSave = async () => {
    if (!user) return;
    let info = {};
    if (userType === 'seller' && paymentType === 'Own Card/Bank Details') {
      if (paymentCountry === 'UK') {
        info = { country: 'UK', sortCode: ukSortCode, accountNumber: ukAccountNumber, bankName: ukBankName, expiry: ukExpiry, cardType };
      } else if (paymentCountry === 'Nigeria') {
        info = { country: 'Nigeria', accountNumber: ngAccountNumber, bankName: ngBankName, cardType };
      } else if (paymentCountry === 'USA') {
        info = { country: 'USA', routingNumber: usRouting, accountNumber: usAccount, bankName: usBank, cardType };
      } else if (paymentCountry === 'Canada') {
        info = { country: 'Canada', transitNumber: caTransit, accountNumber: caAccount, bankName: caBank, cardType };
      } else if (paymentCountry === 'South Africa') {
        info = { country: 'South Africa', accountNumber: saAccount, bankName: saBank, branchCode: saBranch, cardType };
      } else if (paymentCountry === 'Ghana') {
        info = { country: 'Ghana', accountNumber: ghAccount, bankName: ghBank, mobileMoney: ghMobile, cardType };
      } else if (paymentCountry === 'Kenya') {
        info = { country: 'Kenya', accountNumber: keAccount, bankName: keBank, mobileMoney: keMobile, cardType };
      } else if (paymentCountry === 'Jamaica' || paymentCountry === 'Trinidad & Tobago') {
        info = { country: paymentCountry, accountNumber: caribAccount, bankName: caribBank, branchCode: caribBranch, cardType };
      } else if (paymentCountry === 'Other') {
        info = { country: 'Other', details: otherPayment, cardType };
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

  const handleDeactivateAccount = async () => {
    setShowDeactivateWarning(false);
    if (!user) return;
    try {
      if (userType === 'seller') {
        await updateDoc(doc(db, 'stores', user.uid), { deactivated: true, live: false });
      } else {
        await updateDoc(doc(db, 'users', user.uid), { deactivated: true });
      }
      alert('Account deactivated.');
      navigate('/');
    } catch (err) {
      alert('Error deactivating account: ' + err.message);
    }
  };

  const deleteStoreSubcollections = async (storeId) => {
    // Delete all items, discounts, followers, reviews subcollections for a store
    const subcollections = ['items', 'discounts', 'followers', 'reviews'];
    for (const sub of subcollections) {
      const colRef = collection(db, 'stores', storeId, sub);
      const snap = await getDocs(colRef);
      for (const docu of snap.docs) {
        await deleteDoc(docu.ref);
      }
    }
  };

  const handleDeleteWarningContinue = () => {
    setShowDeleteWarning(false);
    setShowReauthModal(true);
    setPendingDelete(true);
  };

  const handleReauthAndDelete = async () => {
    setReauthError('');
    if (!user || !reauthPassword) {
      setReauthError('Password is required.');
      return;
    }
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setReauthError('No authenticated user. Please log in again.');
        return;
      }
      const credential = EmailAuthProvider.credential(currentUser.email, reauthPassword);
      await reauthenticateWithCredential(currentUser, credential);
      // Now do the actual delete logic
      try {
        if (userType === 'seller') {
          if (!window.confirm('Deleting your account will permanently remove your shop and all its data. This cannot be undone. Are you sure?')) return;
          await deleteStoreSubcollections(currentUser.uid);
          await deleteDoc(doc(db, 'stores', currentUser.uid));
        } else {
          if (!window.confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;
          await deleteDoc(doc(db, 'users', currentUser.uid));
        }
        await deleteUser(currentUser);
        setShowReauthModal(false);
        setReauthPassword('');
        setReauthError('');
        setPendingDelete(false);
        // Sign out and redirect
        await auth.signOut();
        navigate('/');
      } catch (err) {
        setReauthError('Error deleting account: ' + err.message);
      }
    } catch (err) {
      if (err.code === 'auth/wrong-password') {
        setReauthError('Incorrect password. Please try again.');
      } else {
        setReauthError('Re-authentication failed: ' + err.message);
      }
    }
  };

  const handlePaymentModalSave = async () => {
    // Validate per country
    if (paymentCountry === 'UK') {
      if (!ukSortCode.match(/^\d{6}$/) || !ukAccountNumber.match(/^\d{8}$/) || !ukBankName.trim() || !ukExpiry.trim() || !cardType) {
        setPaymentError('Please enter a valid UK sort code (6 digits), account number (8 digits), bank name, expiry, and card type.');
        return;
      }
    } else if (paymentCountry === 'USA') {
      if (!usRouting.match(/^\d{9}$/) || !usAccount.match(/^\d{8,12}$/) || !usBank.trim() || !cardType) {
        setPaymentError('Please enter a valid US routing number (9 digits), account number (8-12 digits), bank name, and card type.');
        return;
      }
    } else if (paymentCountry === 'Nigeria') {
      if (!ngAccountNumber.match(/^\d{10}$/) || !ngBankName.trim() || !cardType) {
        setPaymentError('Please enter a valid Nigerian account number (10 digits), bank name, and card type.');
        return;
      }
    } else if (paymentCountry === 'Canada') {
      if (!caTransit.match(/^\d{5}$/) || !caAccount.match(/^\d{7,12}$/) || !caBank.trim() || !cardType) {
        setPaymentError('Please enter a valid Canadian transit number (5 digits), account number (7-12 digits), bank name, and card type.');
        return;
      }
    } else if (paymentCountry === 'Ghana') {
      if (!ghAccount.match(/^\d+$/) || !ghBank.trim() || !cardType) {
        setPaymentError('Please enter a valid Ghanaian account number, bank name, and card type.');
        return;
      }
    } else if (paymentCountry === 'Kenya') {
      if (!keAccount.match(/^\d+$/) || !keBank.trim() || !cardType) {
        setPaymentError('Please enter a valid Kenyan account number, bank name, and card type.');
        return;
      }
    } else if (!cardType) {
      setPaymentError('Please select a card type.');
      return;
    }
    setPaymentError('');
    let info = {};
    if (userType === 'seller' && paymentType === 'Own Card/Bank Details') {
      if (paymentCountry === 'UK') {
        info = { country: 'UK', sortCode: ukSortCode, accountNumber: ukAccountNumber, bankName: ukBankName, expiry: ukExpiry, cardType };
      } else if (paymentCountry === 'Nigeria') {
        info = { country: 'Nigeria', accountNumber: ngAccountNumber, bankName: ngBankName, cardType };
      } else if (paymentCountry === 'USA') {
        info = { country: 'USA', routingNumber: usRouting, accountNumber: usAccount, bankName: usBank, cardType };
      } else if (paymentCountry === 'Canada') {
        info = { country: 'Canada', transitNumber: caTransit, accountNumber: caAccount, bankName: caBank, cardType };
      } else if (paymentCountry === 'South Africa') {
        info = { country: 'South Africa', accountNumber: saAccount, bankName: saBank, branchCode: saBranch, cardType };
      } else if (paymentCountry === 'Ghana') {
        info = { country: 'Ghana', accountNumber: ghAccount, bankName: ghBank, mobileMoney: ghMobile, cardType };
      } else if (paymentCountry === 'Kenya') {
        info = { country: 'Kenya', accountNumber: keAccount, bankName: keBank, mobileMoney: keMobile, cardType };
      } else if (paymentCountry === 'Jamaica' || paymentCountry === 'Trinidad & Tobago') {
        info = { country: paymentCountry, accountNumber: caribAccount, bankName: caribBank, branchCode: caribBranch, cardType };
      } else if (paymentCountry === 'Other') {
        info = { country: 'Other', details: otherPayment, cardType };
      }
    }
    const ref = userType === 'seller' ? doc(db, 'stores', user.uid) : doc(db, 'users', user.uid);
    await updateDoc(ref, userType === 'seller' ? { paymentType, paymentInfo: info } : { paymentType });
    setEditPayment(false);
    setPaymentInfo(info);
    setShowPaymentModal(false);
  };

  function getPaymentSummary() {
    if (paymentType === 'Own Card/Bank Details') {
      if (paymentInfo.country === 'UK') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div><b>UK:</b></div>
            <div>Sort Code: {paymentInfo.sortCode}</div>
            <div>Account: {paymentInfo.accountNumber}</div>
            <div>Bank: {paymentInfo.bankName}</div>
            <div>Expiry: {paymentInfo.expiry}</div>
            <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
          </div>
        );
      } else if (paymentInfo.country === 'Nigeria') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div><b>Nigeria:</b></div>
            <div>Account: {paymentInfo.accountNumber}</div>
            <div>Bank: {paymentInfo.bankName}</div>
            <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
          </div>
        );
      } else if (paymentInfo.country === 'USA') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div><b>USA:</b></div>
            <div>Routing: {paymentInfo.routingNumber}</div>
            <div>Account: {paymentInfo.accountNumber}</div>
            <div>Bank: {paymentInfo.bankName}</div>
            <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
          </div>
        );
      } else if (paymentInfo.country === 'Canada') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div><b>Canada:</b></div>
            <div>Transit: {paymentInfo.transitNumber}</div>
            <div>Account: {paymentInfo.accountNumber}</div>
            <div>Bank: {paymentInfo.bankName}</div>
            <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
          </div>
        );
      } else if (paymentInfo.country === 'South Africa') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div><b>South Africa:</b></div>
            <div>Account: {paymentInfo.accountNumber}</div>
            <div>Bank: {paymentInfo.bankName}</div>
            <div>Branch: {paymentInfo.branchCode}</div>
            <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
          </div>
        );
      } else if (paymentInfo.country === 'Ghana') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div><b>Ghana:</b></div>
            <div>Account: {paymentInfo.accountNumber}</div>
            <div>Bank: {paymentInfo.bankName}</div>
            <div>Mobile Money: {paymentInfo.mobileMoney}</div>
            <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
          </div>
        );
      } else if (paymentInfo.country === 'Kenya') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div><b>Kenya:</b></div>
            <div>Account: {paymentInfo.accountNumber}</div>
            <div>Bank: {paymentInfo.bankName}</div>
            <div>Mobile Money: {paymentInfo.mobileMoney}</div>
            <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
          </div>
        );
      } else if (paymentInfo.country === 'Jamaica' || paymentInfo.country === 'Trinidad & Tobago') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div><b>{paymentInfo.country}:</b></div>
            <div>Account: {paymentInfo.accountNumber}</div>
            <div>Bank: {paymentInfo.bankName}</div>
            <div>Branch: {paymentInfo.branchCode}</div>
            <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
          </div>
        );
      } else if (paymentInfo.country === 'Other') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>Pay at Store</div>
            <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
          </div>
        );
      }
    } else if (paymentType === 'Other') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div>Pay at Store Payment Method</div>
          <div>Card Type: {paymentInfo.cardType || 'Not specified'}</div>
        </div>
      );
    }
    return '';
  }

  // Add a handler for expiry input formatting
  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 2) value = value.slice(0, 2) + '/' + value.slice(2, 4);
    setUkExpiry(value.slice(0, 5));
  };

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
                  <option value="Other" disabled={storeData && storeData.deliveryType === 'Delivery'}>Pay at Store</option>
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
              {userType === 'seller' && paymentInfo && paymentInfo.cardType && (
                <div style={{ color: '#007070', background: '#f6f6fa', borderRadius: 8, padding: '0.8rem 1rem', marginBottom: 8 }}>
                  <b>Card Type:</b> {paymentInfo.cardType}
                </div>
              )}
              <button onClick={handlePaymentChange} style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Change Payment Type</button>
            </>
          )}
          {/* Payment Modal for Card/Bank Details */}
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
                {/* Render fields for each country */}
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
                {/* Card Type and Expiry always shown */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Card Type</label>
                  <select value={cardType} onChange={e => setCardType(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                    <option value="" disabled>Select card type</option>
                    <option value="Personal">Personal</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Expiry</label>
                  <input type="text" value={ukExpiry} onChange={handleExpiryChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} placeholder="MM/YY" maxLength={5} />
                </div>
                {paymentError && <div style={{ color: '#D92D20', marginBottom: 10 }}>{paymentError}</div>}
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
        {showDeactivateWarning && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw', textAlign: 'center' }}>
              <h3 style={{ marginBottom: 18, color: '#FFD700' }}>Deactivate Account</h3>
              <p style={{ marginBottom: 20 }}>
                {userType === 'seller'
                  ? 'Deactivating your account will hide your shop from Explore and your profile from all users. You can reactivate by contacting support.'
                  : 'Deactivating your account will hide your account from all users. You can reactivate by contacting support.'}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
                <button onClick={() => setShowDeactivateWarning(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleDeactivateAccount} style={{ background: '#FFD700', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#222', fontWeight: 600, cursor: 'pointer' }}>Deactivate</button>
              </div>
            </div>
          </div>
        )}
        {showDeleteWarning && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw', textAlign: 'center' }}>
              <h3 style={{ marginBottom: 18, color: '#D92D20' }}>Delete Account</h3>
              <p style={{ marginBottom: 20 }}>
                {userType === 'seller'
                  ? 'Deleting your account will permanently remove your shop, all its items, discounts, followers, and reviews. This cannot be undone.'
                  : 'Are you sure you want to permanently delete your account? This cannot be undone.'}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
                <button onClick={() => setShowDeleteWarning(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleDeleteWarningContinue} style={{ background: '#D92D20', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Continue</button>
              </div>
            </div>
          </div>
        )}
        {showReauthModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw', textAlign: 'center' }}>
              <h3 style={{ marginBottom: 18, color: '#D92D20' }}>Confirm Your Password</h3>
              <p style={{ marginBottom: 20 }}>For your security, please enter your password to confirm account deletion.</p>
              <input
                type="password"
                value={reauthPassword}
                onChange={e => setReauthPassword(e.target.value)}
                placeholder="Password"
                style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', marginBottom: 12 }}
              />
              {reauthError && <div style={{ color: 'red', marginBottom: 12 }}>{reauthError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
                <button onClick={() => { setShowReauthModal(false); setReauthPassword(''); setReauthError(''); setPendingDelete(false); }} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleReauthAndDelete} style={{ background: '#D92D20', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Delete Account</button>
              </div>
            </div>
          </div>
        )}
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