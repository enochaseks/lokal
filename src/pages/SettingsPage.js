import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { updateMarketingConsent } from '../utils/hubspotClient';

// Helper function to mask sensitive values
function maskValue(value) {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

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
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [view, setView] = useState('main'); // 'main', 'payment', 'discounts', 'account', 'about', 'terms', 'privacy', 'communications'
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
  
  // Handle redirects from registration page to specific policies
  useEffect(() => {
    const redirectToTerms = window.localStorage.getItem('redirectToTerms');
    const redirectToPrivacy = window.localStorage.getItem('redirectToPrivacy');
    
    if (redirectToTerms) {
      setView('terms');
      window.localStorage.removeItem('redirectToTerms');
    } else if (redirectToPrivacy) {
      setView('privacy');
      window.localStorage.removeItem('redirectToPrivacy');
    }
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
        // Get marketing consent if available
        if (storeSnap.data().hasOwnProperty('marketingConsent')) {
          setMarketingConsent(storeSnap.data().marketingConsent);
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
          // Get marketing consent if available
          if (userSnap.data().hasOwnProperty('marketingConsent')) {
            setMarketingConsent(userSnap.data().marketingConsent);
          }
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

    // Store both masked (for UI display) and unmasked (for bank transfers) versions
    let maskedInfo = { ...info };
    let unmaskedInfo = { ...info }; // Keep original for bank transfers
    
    if (userType === 'seller' && paymentType === 'Own Card/Bank Details') {
      if (maskedInfo.sortCode) maskedInfo.sortCode = maskValue(maskedInfo.sortCode);
      if (maskedInfo.accountNumber) maskedInfo.accountNumber = maskValue(maskedInfo.accountNumber);
      if (maskedInfo.expiry) maskedInfo.expiry = maskValue(maskedInfo.expiry);
    }

    const ref = userType === 'seller' ? doc(db, 'stores', user.uid) : doc(db, 'users', user.uid);
    await updateDoc(ref, userType === 'seller' ? { 
      paymentType, 
      paymentInfo: maskedInfo,  // Masked version for UI display
      bankTransferInfo: unmaskedInfo  // Unmasked version for bank transfers
    } : { paymentType });
    setEditPayment(false);
    setPaymentInfo(maskedInfo);
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

    // Store both masked (for UI display) and unmasked (for bank transfers) versions
    let maskedInfo = { ...info };
    let unmaskedInfo = { ...info }; // Keep original for bank transfers
    
    if (userType === 'seller' && paymentType === 'Own Card/Bank Details') {
      if (maskedInfo.sortCode) maskedInfo.sortCode = maskValue(maskedInfo.sortCode);
      if (maskedInfo.accountNumber) maskedInfo.accountNumber = maskValue(maskedInfo.accountNumber);
      if (maskedInfo.expiry) maskedInfo.expiry = maskValue(maskedInfo.expiry);
    }

    const ref = userType === 'seller' ? doc(db, 'stores', user.uid) : doc(db, 'users', user.uid);
    await updateDoc(ref, userType === 'seller' ? { 
      paymentType, 
      paymentInfo: maskedInfo,  // Masked version for UI display
      bankTransferInfo: unmaskedInfo  // Unmasked version for bank transfers
    } : { paymentType });
    setEditPayment(false);
    setPaymentInfo(maskedInfo);
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
  
  // Handle marketing consent changes
  const handleMarketingConsentChange = async (newConsentValue) => {
    if (!user) return;
    setMarketingConsent(newConsentValue);
    
    try {
      // Update consent in Firestore
      const ref = userType === 'seller' ? doc(db, 'stores', user.uid) : doc(db, 'users', user.uid);
      await updateDoc(ref, { marketingConsent: newConsentValue });
      
      console.log(`Marketing consent updated in Firestore to: ${newConsentValue}`);
      
      // Get user details for HubSpot
      const userDoc = await getDoc(ref);
      const userData = userDoc.data();
      
      // Prepare the contact data for HubSpot
      const contactData = {
        email: user.email,
        firstName: userData?.firstName || user.displayName?.split(' ')[0] || '',
        lastName: userData?.lastName || user.displayName?.split(' ').slice(1).join(' ') || '',
        marketingConsent: newConsentValue
      };
      
      console.log('Updating HubSpot with contact data:', contactData);
      
      // Import the function to handle contact creation/update
      const { addOrUpdateContact } = await import('../utils/hubspotClient');
      
      // Update or create the contact in HubSpot
      const success = await addOrUpdateContact(contactData);
      
      if (success) {
        console.log('Successfully updated HubSpot contact');
        // Add a small notification to show the user the action was successful
        const statusText = newConsentValue ? 'enabled' : 'disabled';
        alert(`Marketing preferences ${statusText} successfully!`);
      } else {
        console.error('HubSpot update failed, but Firestore updated successfully');
        // Show a toast or silent message instead of an alert for better UX
        // We've already saved to Firestore, so the core functionality works
        console.log('Marketing preferences saved locally but not synced with marketing service');
        alert('Your preferences were saved, but there was an issue connecting to our marketing service.');
      }
    } catch (error) {
      console.error('Error updating marketing consent:', error);
      // Revert UI state if update fails
      setMarketingConsent(!newConsentValue);
      alert('Failed to update marketing preferences. Please try again.');
    }
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
            <button onClick={() => setView('terms')} style={{ textAlign: 'left', background: '#f6f6fa', border: '1px solid #eee', borderRadius: 8, padding: '1.2rem', fontSize: '1.1rem', fontWeight: 600, color: '#007B7F', cursor: 'pointer' }}>
              Terms of Service
            </button>
            <button onClick={() => setView('privacy')} style={{ textAlign: 'left', background: '#f6f6fa', border: '1px solid #eee', borderRadius: 8, padding: '1.2rem', fontSize: '1.1rem', fontWeight: 600, color: '#007B7F', cursor: 'pointer' }}>
              Privacy Policy
            </button>
            <button onClick={() => setView('communications')} style={{ textAlign: 'left', background: '#f6f6fa', border: '1px solid #eee', borderRadius: 8, padding: '1.2rem', fontSize: '1.1rem', fontWeight: 600, color: '#007B7F', cursor: 'pointer' }}>
              Communication Preferences
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

  // Terms of Service page view
  if (view === 'terms') {
    return (
      <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 700, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2.5rem 2rem' }}>
          <button onClick={() => setView('main')} style={{ marginBottom: 18, background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>{'< Back'}</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 18 }}>Terms of Service</h2>
          <div style={{ color: '#222', fontSize: '1rem', lineHeight: 1.6 }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>1. Introduction</h3>
            <p>Welcome to Lokal, the dedicated marketplace for African & Caribbean stores and products. These Terms of Service ("Terms") govern your use of the Lokal platform, including our website, mobile application, and related services (collectively, the "Platform"). By accessing or using Lokal, you agree to be bound by these Terms.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>2. Platform Description</h3>
            <p>Lokal is an e-commerce platform that connects buyers with African & Caribbean sellers. We provide tools for sellers to create virtual stores, showcase products, manage inventory, and process payments. For buyers, we offer a marketplace to discover local stores, browse products, communicate with sellers, and make purchases.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>3. Account Registration</h3>
            <p>To fully use our Platform, you must register for an account. You can register as either a buyer or a seller. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. You must provide accurate, current, and complete information during registration and keep this information updated.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>4. Seller Terms</h3>
            <p><strong>4.1 Store Creation:</strong> As a seller, you can create a virtual store on our Platform, add products, set prices, and manage inventory.</p>
            <p><strong>4.2 Product Listings:</strong> All product listings must be accurate, comply with applicable laws, and not infringe on any third-party rights.</p>
            <p><strong>4.3 Payment Processing:</strong> Sellers can manage payment methods including bank transfers and in-person payments. All payment information must be accurate and kept up-to-date.</p>
            <p><strong>4.4 Delivery Options:</strong> Sellers can offer delivery services or in-store pickup. The terms of delivery must be clearly communicated to buyers.</p>
            <p><strong>4.5 Discounts:</strong> Sellers can offer discounts on their products through the Platform's discount system.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>5. Buyer Terms</h3>
            <p><strong>5.1 Purchases:</strong> Buyers can browse products, add items to their cart, and complete purchases through the Platform.</p>
            <p><strong>5.2 Payment:</strong> Buyers must provide accurate payment information and authorize the Platform to process payments for purchases.</p>
            <p><strong>5.3 Communications:</strong> Buyers can communicate with sellers through the Platform's messaging system.</p>
            <p><strong>5.4 Reviews:</strong> Buyers can leave reviews for stores and products. All reviews must be honest, appropriate, and based on actual experiences.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>6. Payments and Fees</h3>
            <p><strong>6.1 Payment Methods:</strong> The Platform supports various payment methods, including bank transfers and card payments.</p>
            <p><strong>6.2 Currency:</strong> Transactions may be conducted in multiple currencies, including GBP, USD, EUR, NGN, CAD, AUD, ZAR, GHS, KES, and others.</p>
            <p><strong>6.3 Platform Fees:</strong> Lokal may charge fees for the use of the Platform. These fees will be clearly communicated to users.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>7. Refunds and Returns</h3>
            <p>Refund and return policies are set by individual sellers. Sellers must clearly communicate their refund and return policies to buyers. Lokal may facilitate the refund process but is not responsible for the outcome of refund requests.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>8. User Content</h3>
            <p>Users may post content, including product descriptions, reviews, and messages. You retain ownership of your content, but grant Lokal a license to use, reproduce, modify, and display your content for the purpose of operating the Platform.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>9. Prohibited Activities and Platform Moderation</h3>
            <p>You agree not to engage in any of the following prohibited activities:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>Violating any applicable laws or regulations</li>
              <li>Infringing on the rights of others</li>
              <li>Posting false, misleading, or deceptive content</li>
              <li>Interfering with the proper operation of the Platform</li>
              <li>Using the Platform for any illegal or unauthorized purpose</li>
              <li>Harassing, threatening, or intimidating other users</li>
              <li>Impersonating another person or entity</li>
              <li>Posting offensive, discriminatory, or inappropriate content</li>
              <li>Attempting to gain unauthorized access to other user accounts or Platform systems</li>
              <li>Selling prohibited or dangerous items as determined by our content policies</li>
            </ul>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>9.1 Admin Oversight and Moderation</h4>
            <p>Lokal employs a team of administrators who oversee platform activities to maintain a safe and trustworthy marketplace environment. Our administrators:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>Monitor listings, reviews, and user interactions for policy compliance</li>
              <li>Investigate reports of suspicious or prohibited activities</li>
              <li>Take appropriate action against accounts that violate our terms, including warning, suspension, or permanent removal</li>
              <li>Verify seller credentials and product authenticity when necessary</li>
              <li>Review and respond to user support requests and inquiries</li>
            </ul>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>9.2 Reporting and Enforcement</h4>
            <p>We encourage users to report any content or behavior that violates these Terms of Service. Our reporting and enforcement processes include:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>A user-accessible reporting system for flagging inappropriate content or behavior</li>
              <li>Prompt review of all reports by our admin team</li>
              <li>Transparent communication regarding the outcome of investigations</li>
              <li>Cooperation with law enforcement when required by law</li>
            </ul>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>9.3 User Support</h4>
            <p>Our admin team is available to assist with platform-related issues. Users can reach out for help with:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>Account access problems</li>
              <li>Transaction disputes</li>
              <li>Questions about platform policies</li>
              <li>Technical difficulties</li>
              <li>Suggestions for platform improvements</li>
            </ul>
            
            <p>Lokal reserves the right to determine, at its sole discretion, whether any user activity violates these Terms of Service. We may take action without prior notice, including removing content, suspending accounts, or banning users who engage in prohibited activities.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>10. Account Deactivation and Deletion</h3>
            <p>You may deactivate or delete your account at any time through the Settings page. Deactivation will hide your profile but retain your data. Deletion will permanently remove your account and associated data. For sellers, this includes removing your store, all its items, discounts, followers, and reviews.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>11. Privacy</h3>
            <p>Your privacy is important to us. Our use of your information is governed by our Privacy Policy, which is incorporated into these Terms by reference.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>12. Modifications to the Terms</h3>
            <p>We reserve the right to modify these Terms at any time. We will notify you of any significant changes. Your continued use of the Platform after any changes indicates your acceptance of the modified Terms.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>13. Limitation of Liability</h3>
            <p>To the maximum extent permitted by law, Lokal shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Platform.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>14. Governing Law</h3>
            <p>These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Lokal is incorporated, without regard to its conflict of law provisions.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>15. Contact Information</h3>
            <p>If you have any questions about these Terms, feedback, or need assistance, you can contact us through the following channels:</p>
            
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li><strong>Email:</strong> <a href="mailto:helplokal@gmail.com" style={{ color: '#007B7F', textDecoration: 'none' }}>helplokal@gmail.com</a></li>
              <li><strong>Instagram:</strong> <a href="https://www.instagram.com/lokaladmin/?utm_source=ig_web_button_share_sheet" target="_blank" rel="noopener noreferrer" style={{ color: '#007B7F', textDecoration: 'none' }}>@lokaladmin</a></li>
              <li><strong>In-App:</strong> Through our support channels available on the Platform</li>
            </ul>
            
            <p>We aim to respond to all inquiries within 2 - 4 business days.</p>
            
            <p style={{ marginTop: 25 }}><em>Last updated: September 28, 2025</em></p>
          </div>
        </div>
      </div>
    );
  }

  // Privacy Policy page view
  if (view === 'privacy') {
    return (
      <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 700, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2.5rem 2rem' }}>
          <button onClick={() => setView('main')} style={{ marginBottom: 18, background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>{'< Back'}</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 18 }}>Privacy Policy</h2>
          <div style={{ color: '#222', fontSize: '1rem', lineHeight: 1.6 }}>
            <p>Effective Date: September 28, 2025</p>

            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>1. Introduction</h3>
            <p>Welcome to Lokal's Privacy Policy. At Lokal, we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our marketplace platform for African & Caribbean stores and products.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>2. Information We Collect</h3>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>2.1 Personal Information</h4>
            <p>When you register for an account or use our services, we may collect:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>Contact information (name, email address, phone number)</li>
              <li>Account credentials (username, password)</li>
              <li>Payment information (bank details, card information)</li>
              <li>Shipping and billing addresses</li>
              <li>Profile information (profile picture, biography)</li>
            </ul>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>2.2 Store Information</h4>
            <p>For sellers, we collect additional information about your store:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>Store name and description</li>
              <li>Store location and operating hours</li>
              <li>Product listings and inventory information</li>
              <li>Store policies (refunds, shipping, etc.)</li>
              <li>Banking and payment processing details</li>
            </ul>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>2.3 Usage Information</h4>
            <p>We automatically collect information about how you interact with our platform:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>Access times and browsing history on our platform</li>
              <li>Pages viewed and features used</li>
              <li>Transaction history</li>
              <li>Device information (IP address, browser type, operating system)</li>
              <li>Location data (with permission)</li>
            </ul>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>2.4 Device and Technical Information</h4>
            <p>We collect technical information from your devices for the following essential purposes:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li><strong>Security:</strong> IP addresses help us detect and prevent fraud, unauthorized access attempts, and suspicious activities that could harm our users or platform.</li>
              <li><strong>Service Optimization:</strong> Browser and operating system information allows us to optimize our website and app performance for different devices and browsers.</li>
              <li><strong>Error Resolution:</strong> Technical information helps us diagnose and fix problems when the platform isn't working properly for specific users.</li>
              <li><strong>Geographic Customization:</strong> We use general location information (not precise GPS) to provide region-specific content, currency, and language options.</li>
            </ul>
            <p>We do not use this technical data to track individual user behavior across third-party websites or services. This information is primarily used to ensure platform security, stability, and performance.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>3. How We Use Your Information</h3>
            <p>We use your information for the following purposes:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li><strong>Provide our services:</strong> Enable you to buy and sell products, process payments, and communicate with other users</li>
              <li><strong>Account management:</strong> Create and manage your account, authenticate your identity, and maintain your profile</li>
              <li><strong>Communications:</strong> Send you service announcements, updates, security alerts, and support messages</li>
              <li><strong>Marketing communications:</strong> Send promotional emails and offers about our services (only if you've explicitly provided consent)</li>
              <li><strong>Improve our platform:</strong> Analyze usage patterns, troubleshoot issues, and develop new features</li>
              <li><strong>Security:</strong> Detect and prevent fraud, abuse, and unauthorized access to your account</li>
              <li><strong>Legal compliance:</strong> Comply with applicable laws, regulations, and legal processes</li>
            </ul>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>3.1 Marketing Communications</h4>
            <p>If you've given your consent during registration or through your account settings, we may use your information to send you marketing communications, including:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>Special offers and promotions</li>
              <li>New product features and updates</li>
              <li>Personalized recommendations based on your activity</li>
              <li>Local store events or promotions that may interest you</li>
            </ul>
            <p>You can opt out of marketing communications at any time by:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>Clicking the "unsubscribe" link in any marketing email</li>
              <li>Updating your communication preferences in your account settings</li>
              <li>Contacting our support team</li>
            </ul>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>4. How We Share Your Information</h3>
            <p>We may share your information with:</p>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>4.1 Other Users</h4>
            <p>When you interact with buyers or sellers on our platform, we share limited information necessary to facilitate transactions:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li><strong>For buyers:</strong> We share your name, communication messages, shipping address (for delivery orders), and transaction history with sellers you purchase from</li>
              <li><strong>For sellers:</strong> We share your store name, profile, product information, ratings, and contact details with potential buyers</li>
              <li><strong>For reviews:</strong> When you leave a review, your profile name and review content are visible to other users</li>
              <li><strong>For messaging:</strong> Content of messages exchanged through our platform's messaging system</li>
            </ul>
            <p>You can control some of this information through your privacy settings in your account.</p>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>4.2 Service Providers</h4>
            <p>We partner with trusted third-party service providers who perform services on our behalf. These companies have access only to the information necessary to perform these services and are contractually obligated to use it only for the intended purpose. Our service providers include:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li><strong>Payment processors:</strong> To securely process transactions (e.g., Stripe, PayPal)</li>
              <li><strong>Cloud service providers:</strong> For secure storage and hosting of our platform (e.g., Firebase, AWS)</li>
              <li><strong>Analytics providers:</strong> To help us understand platform usage and improve our services</li>
              <li><strong>Customer support tools:</strong> To assist with user inquiries and issue resolution</li>
              <li><strong>Email service providers:</strong> To send notifications, updates, and marketing communications (with your consent)</li>
              <li><strong>Fraud detection services:</strong> To protect our users and platform from fraudulent activities</li>
            </ul>
            <p>All service providers are vetted for their security practices and are bound by data protection agreements that prohibit using your information for their own purposes.</p>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>4.3 Legal Authorities</h4>
            <p>We may disclose your information to legal authorities in the following limited circumstances:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li><strong>Legal requirements:</strong> When we have a good-faith belief that disclosure is necessary to comply with applicable laws or regulations</li>
              <li><strong>Judicial proceedings:</strong> In response to valid court orders, subpoenas, or other legal process</li>
              <li><strong>Protection of rights:</strong> To establish, exercise, or defend our legal rights</li>
              <li><strong>Safety concerns:</strong> When we believe disclosure is necessary to prevent physical harm, financial loss, or suspected illegal activity</li>
            </ul>
            <p>When legally permitted, we will attempt to notify you of such requests unless doing so would violate the law or court order.</p>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>4.4 Business Transfers</h4>
            <p>If Lokal is involved in a merger, acquisition, or sale of all or a portion of its assets, your information may be transferred as part of that transaction. In such event:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>We will notify you via email and/or a prominent notice on our platform before your information becomes subject to a different privacy policy</li>
              <li>The acquiring entity will be required to honor the commitments we have made in this Privacy Policy</li>
              <li>You will be given the opportunity to delete your account if you do not wish your information to be transferred</li>
            </ul>
            
            <p style={{ fontWeight: 600, marginTop: 16 }}>We will never sell your personal information to third parties for marketing purposes.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>5. Data Security</h3>
            <p>We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.</p>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>5.1 How We Protect Your Data</h4>
            <p>We employ the following security measures to protect your information:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li><strong>Encryption:</strong> We use industry-standard encryption protocols to protect data in transit and at rest</li>
              <li><strong>Access Controls:</strong> We limit employee access to personal data on a need-to-know basis</li>
              <li><strong>Regular Security Audits:</strong> We conduct periodic security assessments to identify and address vulnerabilities</li>
              <li><strong>IP and Device Protection:</strong> Technical information like IP addresses are stored securely and accessed only for legitimate security and operational needs</li>
              <li><strong>Anonymization:</strong> Where possible, we anonymize or pseudonymize data used for analytics purposes</li>
            </ul>
            
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16, marginBottom: 8 }}>5.2 Payment Security</h4>
            <p>For payment security, we use secure encryption technologies for sensitive financial information. We do not store complete payment card details on our servers.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>6. Data Retention</h3>
            <p>We retain your personal information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. If you delete your account, we will retain certain information as required by law but will delete or anonymize other personal information.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>7. Your Privacy Rights</h3>
            <p>Depending on your location, you may have rights regarding your personal information, including:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li>Access and obtain a copy of your data</li>
              <li>Rectify inaccurate or incomplete information</li>
              <li>Request deletion of your personal information</li>
              <li>Object to or restrict certain processing activities</li>
              <li>Data portability (receive your data in a structured, machine-readable format)</li>
            </ul>
            <p>To exercise these rights, please contact us through the Settings page or using the contact information provided below.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>8. Children's Privacy</h3>
            <p>Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>9. Cookies and Tracking Technologies</h3>
            <p>We use cookies and similar technologies to enhance your experience, analyze usage patterns, and deliver personalized content. You can control cookies through your browser settings, but disabling certain cookies may limit your ability to use some features of our platform.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>10. International Data Transfers</h3>
            <p>Your information may be transferred to and processed in countries other than your country of residence, including countries where our servers are located. We implement appropriate safeguards to protect your information during these transfers in accordance with applicable data protection laws.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>11. Third-Party Links and Services</h3>
            <p>Our platform may contain links to third-party websites and services. We are not responsible for the privacy practices or content of these third parties. We encourage you to review the privacy policies of any third-party sites you visit.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>12. Changes to This Privacy Policy</h3>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the updated policy on our platform and, where appropriate, sending you a notification. Your continued use of our services after such changes indicates your acceptance of the updated Privacy Policy.</p>
            
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginTop: 20, marginBottom: 12 }}>13. Contact Us</h3>
            <p>If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, you can contact us through the following channels:</p>
            
            <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
              <li><strong>Email:</strong> <a href="mailto:helplokal@gmail.com" style={{ color: '#007B7F', textDecoration: 'none' }}>helplokal@gmail.com</a></li>
              <li><strong>Instagram:</strong> <a href="https://www.instagram.com/lokaladmin/?utm_source=ig_web_button_share_sheet" target="_blank" rel="noopener noreferrer" style={{ color: '#007B7F', textDecoration: 'none' }}>@lokaladmin</a></li>
              <li><strong>In-App:</strong> Through our support channels available on the Platform</li>
            </ul>
            
            <p>For privacy-related inquiries, we will respond as quickly as possible and within any timeframes required by applicable law.</p>
            
            <p style={{ marginTop: 25 }}><em>Last updated: September 28, 2025</em></p>
          </div>
        </div>
      </div>
    );
  }

  // Test HubSpot connection function
  const testHubSpotConnection = async () => {
    try {
      // Direct API call to test HubSpot
      const testEmail = `test-${Date.now()}@lokal-app.com`;
      console.log(`Creating direct test contact with email: ${testEmail}`);
      
      const { addOrUpdateContact } = await import('../utils/hubspotClient');
      
      const result = await addOrUpdateContact({
        email: testEmail,
        firstName: 'Test',
        lastName: 'Direct',
        marketingConsent: true
      });
      
      if (result) {
        alert(`HubSpot test successful! Created contact with email: ${testEmail}`);
      } else {
        alert('HubSpot test failed. Check console for details.');
      }
    } catch (error) {
      console.error('Error in direct HubSpot test:', error);
      alert(`HubSpot test error: ${error.message}`);
    }
  };

  // Communications Preferences view
  if (view === 'communications') {
    return (
      <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 700, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2.5rem 2rem' }}>
          <button onClick={() => setView('main')} style={{ marginBottom: 18, background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>{'< Back'}</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 18 }}>Communication Preferences</h2>
          
          <div style={{ color: '#222', fontSize: '1rem', lineHeight: 1.6, marginBottom: 30 }}>
            <p>Manage how Lokal communicates with you. You can update your preferences at any time.</p>
          </div>
          
          {/* Developer Test Button - Remove in production */}
          <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f8f8f8', borderRadius: '8px', border: '1px solid #ddd' }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Developer Options</h4>
            <button 
              onClick={testHubSpotConnection}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007B7F',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                marginRight: '10px',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Test Direct HubSpot API
            </button>
            <p style={{ fontSize: '0.8rem', marginTop: '8px', color: '#666' }}>
              Check the browser console (F12) for detailed logs.
            </p>
          </div>
          
          <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 16 }}>Marketing Communications</h3>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '15px' }}>
              <input 
                type="checkbox" 
                id="marketingCheckbox"
                checked={marketingConsent}
                onChange={() => handleMarketingConsentChange(!marketingConsent)}
                style={{ marginRight: '12px', marginTop: '4px', width: '16px', height: '16px' }}
              />
              <label htmlFor="marketingCheckbox" style={{ fontSize: '1rem', lineHeight: '1.5' }}>
                I consent to receive marketing communications about special offers, new features, and personalized recommendations.
              </label>
            </div>
            
            <div style={{ fontSize: '0.9rem', color: '#666', marginLeft: '28px' }}>
              <p>By opting in, you'll receive:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li>Special promotions and discounts</li>
                <li>New feature announcements</li>
                <li>Personalized recommendations</li>
                <li>Community events and updates</li>
              </ul>
            </div>
          </div>
          
          <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 16 }}>Account Communications</h3>
            <p style={{ marginBottom: '10px' }}>
              <strong>Note:</strong> You will always receive important notifications about your account, transactions, and security. 
              These are essential to provide you with our services and cannot be disabled.
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Examples include: purchase confirmations, password resets, security alerts, and policy updates.
            </p>
          </div>
          
          <div style={{ marginTop: '25px', fontSize: '0.9rem', color: '#666' }}>
            <p>
              You can also unsubscribe from marketing emails by clicking the "Unsubscribe" link at the bottom of any marketing email you receive from us.
            </p>
            <p>
              For any questions about your communication preferences, please contact us at{' '}
              <a href="mailto:helplokal@gmail.com" style={{ color: '#007B7F', textDecoration: 'none' }}>helplokal@gmail.com</a>
            </p>
          </div>
          
        </div>
      </div>
    );
  }

  return null;
}

export default SettingsPage;