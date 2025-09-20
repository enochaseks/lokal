import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import QRCodeModal from '../components/QRCodeModal';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function StoreProfilePage() {
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [storeItems, setStoreItems] = useState([]);
  const [itemImage, setItemImage] = useState(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCurrency, setItemCurrency] = useState('GBP');
  const [itemQuality, setItemQuality] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [followers, setFollowers] = useState([]);
  const [followersDetails, setFollowersDetails] = useState([]);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  // New state for editing functionality
  const [editingName, setEditingName] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [showNameChangeDialog, setShowNameChangeDialog] = useState(false);
  const [showLocationChangeDialog, setShowLocationChangeDialog] = useState(false);
  const [nameChangeReason, setNameChangeReason] = useState('');
  const [locationChangeReason, setLocationChangeReason] = useState('');
  const [pendingChanges, setPendingChanges] = useState({
    name: null,
    location: null,
    requiresLicenseUpdate: false
  });

  // New state for change tracking and restrictions
  const [changeHistory, setChangeHistory] = useState({
    nameChanges: [],
    locationChanges: [],
    thumbnailChanges: [],
    lastRestrictionDate: null,
    lastThumbnailRestrictionDate: null,
  });
  const [showRestrictionDialog, setShowRestrictionDialog] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState('');
  
  // New state for second change warning
  const [showSecondChangeWarning, setShowSecondChangeWarning] = useState(false);
  const [pendingChangeType, setPendingChangeType] = useState('');
  
  // New state for thumbnail change warning
  const [showThumbnailChangeDialog, setShowThumbnailChangeDialog] = useState(false);
  // New state for the specific "first change" warning
  const [showFirstThumbnailWarning, setShowFirstThumbnailWarning] = useState(false);

  // Add missing state for edit fields and showEditProfile
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editDeliveryType, setEditDeliveryType] = useState('');
  const [editPaymentType, setEditPaymentType] = useState('');
  const [editOpeningTime, setEditOpeningTime] = useState('');
  const [editClosingTime, setEditClosingTime] = useState('');
  const [editThumbnail, setEditThumbnail] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editSellsAlcohol, setEditSellsAlcohol] = useState('');
  const [editAlcoholLicense, setEditAlcoholLicense] = useState(null);
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editPhoneType, setEditPhoneType] = useState('work');

  // Add at the top, after other useState hooks
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [closedDays, setClosedDays] = useState(profile?.closedDays || []);
  const [openingTimes, setOpeningTimes] = useState(profile?.openingTimes || {});
  const [closingTimes, setClosingTimes] = useState(profile?.closingTimes || {});

  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError('Not logged in');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const docRef = doc(db, 'stores', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile(data);
          setEditName(data.storeName || '');
          setEditLocation(data.storeLocation || '');
          setEditOrigin(data.origin || '');
          setEditDeliveryType(data.deliveryType || '');
          setEditPaymentType(data.paymentType || '');
          setEditOpeningTime(data.openingTime || '');
          setEditClosingTime(data.closingTime || '');
          setClosedDays(data.closedDays || []);
          setOpeningTimes(data.openingTimes || {});
          setClosingTimes(data.closingTimes || {});
          setEditSellsAlcohol(data.sellsAlcohol || '');
          setEditAlcoholLicense(data.alcoholLicense || null);
          setEditPhoneNumber(data.phoneNumber || '');
          setEditPhoneType(data.phoneType || 'work');
          // Load change history
          setChangeHistory({
            nameChanges: data.nameChanges || [],
            locationChanges: data.locationChanges || [],
            thumbnailChanges: data.thumbnailChanges || [],
            lastRestrictionDate: data.lastRestrictionDate || null,
            lastThumbnailRestrictionDate: data.lastThumbnailRestrictionDate || null,
          });
        } else {
          setError('Store profile not found.');
        }
        // Fetch items
        const itemsCol = collection(db, 'stores', user.uid, 'items');
        const itemsSnap = await getDocs(itemsCol);
        setStoreItems(itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        // Fetch followers
        const followersCol = collection(db, 'stores', user.uid, 'followers');
        onSnapshot(followersCol, async (snapshot) => {
          const followersArr = snapshot.docs.map(doc => doc.data());
          setFollowers(followersArr);
          // Fetch user details for each follower
          const details = [];
          for (const f of followersArr) {
            if (f.uid) {
              const userDoc = await getDoc(doc(db, 'users', f.uid));
              if (userDoc.exists()) {
                details.push({ uid: f.uid, ...userDoc.data() });
              } else {
                details.push({ uid: f.uid, name: f.email || f.uid, photoURL: '' });
              }
            }
          }
          setFollowersDetails(details);
          // Check if current user is following
          setIsFollowing(followersArr.some(f => f.uid === user.uid));
        });
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!itemName || !itemPrice || !itemQuality || !itemQuantity) return;
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      let imageUrl = '';
      if (itemImage) {
        const imgRef = ref(storage, `storeItems/${user.uid}_${Date.now()}_${itemImage.name}`);
        await uploadBytes(imgRef, itemImage);
        imageUrl = await getDownloadURL(imgRef);
      }
      const itemData = {
        name: itemName,
        price: itemPrice,
        currency: itemCurrency,
        quality: itemQuality,
        quantity: itemQuantity,
        image: imageUrl,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'stores', user.uid, 'items'), itemData);
      setShowAddModal(false);
      setItemImage(null);
      setItemName('');
      setItemPrice('');
      setItemCurrency('GBP');
      setItemQuality('');
      setItemQuantity('');
      // Re-fetch items
      const itemsCol = collection(db, 'stores', user.uid, 'items');
      const itemsSnap = await getDocs(itemsCol);
      setStoreItems(itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      alert('Error adding item: ' + err.message);
    }
    setLoading(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (editDeliveryType === 'Delivery' && editPaymentType === 'Other') {
      alert("'Pay at Store' is not available with 'Delivery'. Please choose another payment method.");
      return;
    }

    // Check if name or location has changed
    const nameChanged = editName !== profile.storeName;
    const locationChanged = editLocation !== profile.storeLocation;
    const thumbnailChanged = editThumbnail !== null;

    if (nameChanged && !nameChangeReason) {
      setShowNameChangeDialog(true);
      return;
    }

    if (locationChanged && !locationChangeReason) {
      setShowLocationChangeDialog(true);
      return;
    }

    if (thumbnailChanged) {
      setShowThumbnailChangeDialog(true);
      return;
    }
    
    if (editSellsAlcohol === 'yes' && !editAlcoholLicense) {
      alert('You must upload proof of license to sell alcohol.');
      return;
    }
    
    await executeSave();
  };

  const executeSave = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      
      let thumbnailUrl = profile.backgroundImg || '';
      if (editThumbnail) {
        const imgRef = ref(storage, `storeBanners/${user.uid}_${editThumbnail.name}`);
        await uploadBytes(imgRef, editThumbnail);
        thumbnailUrl = await getDownloadURL(imgRef);
      }

      // Clear opening/closing times for closed days
      const cleanedOpeningTimes = { ...openingTimes };
      const cleanedClosingTimes = { ...closingTimes };
      
      closedDays.forEach(day => {
        delete cleanedOpeningTimes[day];
        delete cleanedClosingTimes[day];
      });

      // Update change history
      const newChangeHistory = { ...changeHistory };
      if (editName !== profile.storeName) {
        newChangeHistory.nameChanges.push({
          from: profile.storeName,
          to: editName,
          date: new Date().toISOString(),
          reason: nameChangeReason
        });
      }
      if (editLocation !== profile.storeLocation) {
        newChangeHistory.locationChanges.push({
          from: profile.storeLocation,
          to: editLocation,
          date: new Date().toISOString(),
          reason: locationChangeReason
        });
      }
      if (editThumbnail) {
        newChangeHistory.thumbnailChanges.push({
          from: profile.backgroundImg || 'No thumbnail',
          to: thumbnailUrl,
          date: new Date().toISOString()
        });
      }

      const updateData = {
        storeName: editName,
        storeLocation: editLocation,
        origin: editOrigin,
        backgroundImg: thumbnailUrl,
        deliveryType: editDeliveryType,
        openingTime: editOpeningTime,
        closingTime: editClosingTime,
        nameChanges: newChangeHistory.nameChanges,
        locationChanges: newChangeHistory.locationChanges,
        thumbnailChanges: newChangeHistory.thumbnailChanges,
        // Use cleaned times that exclude closed days
        closedDays,
        openingTimes: cleanedOpeningTimes,
        closingTimes: cleanedClosingTimes,
        sellsAlcohol: editSellsAlcohol,
        alcoholLicense: editAlcoholLicense,
        phoneNumber: editPhoneNumber,
        phoneType: editPhoneType,
      };

      // Handle significant changes that require license updates
      const hasLicenses = profile.certificate || profile.foodHygiene || profile.marketStallLicence || profile.onlineLicence;
      
      if ((editName !== profile.storeName) && nameChangeReason !== 'Name Error' && hasLicenses) {
        updateData.live = false;
        updateData.requiresLicenseUpdate = true;
        updateData.nameChangeReason = nameChangeReason;
      }

      if ((editLocation !== profile.storeLocation) && locationChangeReason === 'yes' && hasLicenses) {
        updateData.live = false;
        updateData.requiresLicenseUpdate = true;
        updateData.locationChangeReason = locationChangeReason;
      }

      if (editThumbnail && hasLicenses) {
        updateData.live = false;
        updateData.requiresLicenseUpdate = true;
        updateData.thumbnailChangeReason = 'Thumbnail updated';
      }

      // Check for name/location change restriction
      const totalNameLocationChanges = newChangeHistory.nameChanges.length + newChangeHistory.locationChanges.length;
      if (!hasLicenses && totalNameLocationChanges >= 3) {
        updateData.lastRestrictionDate = new Date().toISOString();
        newChangeHistory.lastRestrictionDate = updateData.lastRestrictionDate;
      }

      // Check for thumbnail change restriction (after 2nd change)
      if (!hasLicenses && newChangeHistory.thumbnailChanges.length === 2) {
        updateData.lastThumbnailRestrictionDate = new Date().toISOString();
        newChangeHistory.lastThumbnailRestrictionDate = updateData.lastThumbnailRestrictionDate;
      }

      const docRef = doc(db, 'stores', user.uid);
      await updateDoc(docRef, updateData);
      
      setShowEditProfile(false);
      setEditingName(false);
      setEditingLocation(false);
      setShowNameChangeDialog(false);
      setShowLocationChangeDialog(false);
      setShowThumbnailChangeDialog(false);
      setShowFirstThumbnailWarning(false);
      setNameChangeReason('');
      setLocationChangeReason('');
      setPendingChanges({ name: null, location: null, requiresLicenseUpdate: false });
      setChangeHistory(newChangeHistory);
      
      // Re-fetch profile
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setProfile(docSnap.data());
    } catch (err) {
      alert('Error updating profile: ' + err.message);
    }
    setLoading(false);
  };

  const handleNameEdit = () => {
    // Check if user is restricted from making changes
    if (isRestrictedFromChanges()) {
      setRestrictionMessage('You have reached the limit of 3 name/location changes. You can make changes again in 4 months.');
      setShowRestrictionDialog(true);
      return;
    }
    
    setEditingName(true);
    setShowEditProfile(true);
  };

  const handleLocationEdit = () => {
    // Check if user is restricted from making changes
    if (isRestrictedFromChanges()) {
      setRestrictionMessage('You have reached the limit of 3 name/location changes. You can make changes again in 4 months.');
      setShowRestrictionDialog(true);
      return;
    }
    
    setEditingLocation(true);
    setShowEditProfile(true);
  };

  const handleGeneralEdit = () => {
    setEditingName(false);
    setEditingLocation(false);
    setShowEditProfile(true);
  };

  const handleNameChangeConfirm = (reason) => {
    setNameChangeReason(reason);
    setShowNameChangeDialog(false);
    
    // Check if this will be the third change AND user has no licenses
    const hasLicenses = profile?.certificate || profile?.foodHygiene || profile?.marketStallLicence || profile?.onlineLicence;
    const totalChanges = changeHistory.nameChanges.length + changeHistory.locationChanges.length + changeHistory.thumbnailChanges.length;
    
    if (!hasLicenses && totalChanges === 2) {
      setPendingChangeType('name');
      setShowSecondChangeWarning(true);
      return;
    }
    
    executeSave();
  };

  const handleLocationChangeConfirm = (moved) => {
    setLocationChangeReason(moved);
    setShowLocationChangeDialog(false);
    
    // Check if this will be the third change AND user has no licenses
    const hasLicenses = profile?.certificate || profile?.foodHygiene || profile?.marketStallLicence || profile?.onlineLicence;
    const totalChanges = changeHistory.nameChanges.length + changeHistory.locationChanges.length + changeHistory.thumbnailChanges.length;
    
    if (!hasLicenses && totalChanges === 2) {
      setPendingChangeType('location');
      setShowSecondChangeWarning(true);
      return;
    }
    
    executeSave();
  };

  const handleSecondChangeWarningConfirm = () => {
    setShowSecondChangeWarning(false);
    setPendingChangeType('');
    executeSave();
  };

  const handleSecondChangeWarningCancel = () => {
    setShowSecondChangeWarning(false);
    setPendingChangeType('');
    setShowNameChangeDialog(false);
    setShowLocationChangeDialog(false);
    setNameChangeReason('');
    setLocationChangeReason('');
  };

  const handleThumbnailChangeConfirm = () => {
    // This function is now the confirmation from the generic dialog
    setShowThumbnailChangeDialog(false);
    
    const hasLicenses = profile?.certificate || profile?.foodHygiene || profile?.marketStallLicence || profile?.onlineLicence;
    
    if (hasLicenses) {
      // Licensed users just save
      executeSave();
    } else {
      // Unlicensed users get a specific flow
      if (changeHistory.thumbnailChanges.length === 0) {
        // This is their FIRST change, so show the warning.
        setShowFirstThumbnailWarning(true);
      } else {
        // This is their SECOND change, which will trigger the restriction upon saving.
        executeSave();
      }
    }
  };

  const handleFirstThumbnailWarningConfirm = () => {
    // User acknowledged the warning for their first change, now save it.
    setShowFirstThumbnailWarning(false);
    executeSave();
  };

  // Helper to show image preview if file exists
  const renderImage = (file) => {
    if (!file) return null;
    if (typeof file === 'string') {
      return <img src={file} alt="" style={{ maxWidth: 180, maxHeight: 180, borderRadius: 12, marginBottom: 16, objectFit: 'cover' }} />;
    }
    return <img src={URL.createObjectURL(file)} alt="" style={{ maxWidth: 180, maxHeight: 180, borderRadius: 12, marginBottom: 16, objectFit: 'cover' }} />;
  };

  // Add a helper to check if the store can go live
  const canGoLive =
    profile &&
    profile.backgroundImg &&
    profile.storeName &&
    profile.storeLocation &&
    profile.origin &&
    profile.deliveryType &&
    storeItems.length > 0;

  const handleGoLive = async () => {
    if (!canGoLive) return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const docRef = doc(db, 'stores', user.uid);
    await updateDoc(docRef, { live: true });
    setProfile(prev => ({ ...prev, live: true }));
  };

  const handleGoOffline = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const docRef = doc(db, 'stores', user.uid);
    await updateDoc(docRef, { live: false });
    setProfile(prev => ({ ...prev, live: false }));
  };

  const handleFollow = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !profile) return;
    const followerRef = doc(db, 'stores', user.uid, 'followers', user.uid);
    await addDoc(collection(db, 'stores', user.uid, 'followers'), { uid: user.uid, email: user.email });
    setIsFollowing(true);
  };

  const handleUnfollow = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !profile) return;
    const followerRef = doc(db, 'stores', user.uid, 'followers', user.uid);
    await deleteDoc(followerRef);
    setIsFollowing(false);
  };

  const isRestrictedFromChanges = () => {
    const hasLicenses = profile?.certificate || profile?.foodHygiene || profile?.marketStallLicence || profile?.onlineLicence;
    
    // If user has licenses, no restrictions apply
    if (hasLicenses) return false;
    
    const totalNameLocationChanges = changeHistory.nameChanges.length + changeHistory.locationChanges.length;
    
    // If less than 3 name/location changes, no restriction
    if (totalNameLocationChanges < 3) return false;
    
    // If 3 or more changes, check if 4 months have passed since the last name/location restriction
    if (changeHistory.lastRestrictionDate) {
      const lastRestriction = new Date(changeHistory.lastRestrictionDate);
      const fourMonthsLater = new Date(lastRestriction);
      fourMonthsLater.setMonth(fourMonthsLater.getMonth() + 4);
      
      return new Date() < fourMonthsLater;
    }
    
    // This case handles a user reaching 3 changes for the first time
    // without a lastRestrictionDate set yet. They are now restricted.
    return true;
  };

  const isRestrictedFromThumbnailChanges = () => {
    const hasLicenses = profile?.certificate || profile?.foodHygiene || profile?.marketStallLicence || profile?.onlineLicence;
    
    // If user has licenses, no restrictions apply
    if (hasLicenses) return false;
    
    // If user has made 2 or more thumbnail changes, they might be restricted.
    if (changeHistory.thumbnailChanges.length >= 2) {
      const restrictionDate = changeHistory.lastThumbnailRestrictionDate || changeHistory.thumbnailChanges[1]?.date;
      if (!restrictionDate) return false; // Should not happen, but a safeguard.

      const fourMonthsLater = new Date(restrictionDate);
      fourMonthsLater.setMonth(fourMonthsLater.getMonth() + 4);
      
      return new Date() < fourMonthsLater;
    }
    
    return false;
  };

  const getTimeUntilAllowed = () => {
    if (!changeHistory.lastRestrictionDate) return null;
    
    const lastRestriction = new Date(changeHistory.lastRestrictionDate);
    const fourMonthsLater = new Date(lastRestriction);
    fourMonthsLater.setMonth(fourMonthsLater.getMonth() + 4);
    
    const now = new Date();
    const timeDiff = fourMonthsLater - now;
    
    if (timeDiff <= 0) return null;
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    
    return { months, days: remainingDays };
  };

  // Replace the helper functions at the top with these improved versions:
  const today = daysOfWeek[new Date().getDay()];
  const isClosedToday = profile && profile.closedDays && profile.closedDays.includes(today);
  const todayOpening = profile && profile.openingTimes && profile.openingTimes[today];
  const todayClosing = profile && profile.closingTimes && profile.closingTimes[today];

  function isStoreOpenForToday(profile) {
    if (!profile) return false;
    
    const today = daysOfWeek[new Date().getDay()];
    
    // Check if store is closed today
    if (profile.closedDays && profile.closedDays.includes(today)) {
      return false;
    }
    
    // Get today's opening and closing times
    const todayOpening = profile.openingTimes && profile.openingTimes[today];
    const todayClosing = profile.closingTimes && profile.closingTimes[today];
    
    // If no specific times set for today, fall back to general opening/closing times
    const opening = todayOpening || profile.openingTime;
    const closing = todayClosing || profile.closingTime;
    
    if (!opening || !closing) return false;
    
    const now = new Date();
    const [openH, openM] = opening.split(':').map(Number);
    const [closeH, closeM] = closing.split(':').map(Number);
    
    const openDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openH, openM);
    const closeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeH, closeM);
    
    // Handle overnight hours (e.g., 10 PM to 6 AM)
    if (closeH < openH || (closeH === openH && closeM < openM)) {
      const nextDayClose = new Date(closeDate);
      nextDayClose.setDate(nextDayClose.getDate() + 1);
      return now >= openDate || now <= nextDayClose;
    }
    
    return now >= openDate && now <= closeDate;
  }

  if (loading) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', marginTop: 80 }}>Loading profile...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', marginTop: 80, color: '#D92D20' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {/* Banner: show backgroundImg if present, else colored banner */}
        <div style={{ width: '100%', height: 180, background: profile.backgroundImg ? 'none' : '#cfc6f7', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {profile.backgroundImg ? (
            <img src={profile.backgroundImg} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
          
          {/* QR Code Icon */}
          <button
            onClick={() => setShowQRModal(true)}
            style={{ 
              position: 'absolute', 
              left: 24, 
              top: 24, 
              background: 'rgba(255, 255, 255, 0.9)', 
              color: '#007B7F', 
              border: '2px solid #007B7F', 
              borderRadius: 12, 
              padding: '0.5rem', 
              fontWeight: 600, 
              fontSize: '1.2rem', 
              cursor: 'pointer', 
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#007B7F';
              e.target.style.color = '#fff';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
              e.target.style.color = '#007B7F';
              e.target.style.transform = 'scale(1)';
            }}
            title="Show Store QR Code"
          >
            📱 QR
          </button>

          {/* Go live or live/offline button on the right */}
          {profile.live ? (
            <button
              style={{ position: 'absolute', right: 24, top: 24, background: '#D92D20', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', zIndex: 2 }}
              onClick={handleGoOffline}
              title="Click to go offline"
            >
              Store is live (Turn off)
            </button>
          ) : (
            <button
              style={{ position: 'absolute', right: 24, top: 24, background: canGoLive ? '#D92D20' : '#ccc', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem', fontWeight: 700, fontSize: '1rem', cursor: canGoLive ? 'pointer' : 'not-allowed', zIndex: 2 }}
              onClick={handleGoLive}
              disabled={!canGoLive}
              title={canGoLive ? '' : 'Add all required info and at least one item to go live'}
            >
              Go live
            </button>
          )}
        </div>
        {/* Title and details below banner */}
        <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.2rem 1.2rem 1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginTop: -30, marginBottom: 24, position: 'relative' }}>
          {/* Title and origin in the same row, title left, origin right */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '1.1rem', color: '#222', letterSpacing: '0.2px' }}>{profile.storeName || 'Store Profile'}</span>
              <button
                onClick={handleNameEdit}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: isRestrictedFromChanges() ? '#ccc' : '#007B7F', 
                  cursor: isRestrictedFromChanges() ? 'not-allowed' : 'pointer', 
                  fontSize: '0.9rem', 
                  padding: '2px 6px' 
                }}
                title={isRestrictedFromChanges() ? 'Changes restricted for 4 months' : "Edit store name"}
                disabled={isRestrictedFromChanges()}
              >
                ✏️
              </button>
            </div>
            {profile.origin && (
              <span style={{ fontSize: '0.92rem', color: '#888', fontWeight: 500 }}>Origin: {profile.origin}</span>
            )}
            {/* Edit Button */}
            <button
              style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 1rem', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', marginLeft: 10 }}
              onClick={handleGeneralEdit}
            >
              Edit
            </button>
            <button
              style={{ background: '#007B7F', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 1rem', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', marginLeft: 10 }}
              onClick={() => navigate('/messages')}
            >
              Messages
            </button>
          </div>
          {/* Location */}
          {profile.storeLocation && (
            <div style={{ width: '100%', textAlign: 'left', fontSize: '0.95rem', color: '#444', marginBottom: 4, wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'column', alignItems: 'flex-start' }}>
              {/* Show street on its own line if possible */}
              {(() => {
                const parts = profile.storeLocation.split(',');
                return (
                  <>
                    <span><span style={{ fontWeight: 500 }}>Address:</span> {parts[0]}</span>
                    <span style={{ color: '#666', fontSize: '0.93rem' }}>{parts.slice(1).join(',').trim()}</span>
                  </>
                );
              })()}
              <button
                onClick={handleLocationEdit}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: isRestrictedFromChanges() ? '#ccc' : '#007B7F', 
                  cursor: isRestrictedFromChanges() ? 'not-allowed' : 'pointer', 
                  fontSize: '0.9rem', 
                  padding: '2px 6px' 
                }}
                title={isRestrictedFromChanges() ? 'Changes restricted for 4 months' : "Edit location"}
                disabled={isRestrictedFromChanges()}
              >
                ✏️
              </button>
            </div>
          )}
          {/* Show restriction status if applicable */}
          {isRestrictedFromChanges() && (
            <div style={{ 
              width: '100%', 
              background: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: 8, 
              padding: '0.8rem', 
              marginTop: 8,
              color: '#856404'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Changes Restricted</div>
              <div style={{ fontSize: '0.9rem' }}>
                You have reached the limit of 3 name/location changes. 
                {(() => {
                  const timeLeft = getTimeUntilAllowed();
                  if (timeLeft) {
                    return ` You can make changes again in ${timeLeft.months} months and ${timeLeft.days} days.`;
                  }
                  return ' You can make changes again in 4 months.';
                })()}
              </div>
            </div>
          )}
          {/* Opening/Closing Time and Status */}
          <div style={{ width: '100%', fontSize: '0.98rem', color: '#007B7F', marginBottom: 8 }}>
            <b>Today:</b> {today} &nbsp;
            {isClosedToday ? (
              <span style={{ color: '#D92D20', fontWeight: 600 }}>Closed Today</span>
            ) : (
              <>
                <b>Opening Time:</b> {todayOpening || profile.openingTime || '--:--'} &nbsp; 
                <b>Closing Time:</b> {todayClosing || profile.closingTime || '--:--'}
                <span style={{ 
                  marginLeft: 16, 
                  fontWeight: 600, 
                  color: isStoreOpenForToday(profile) ? '#3A8E3A' : '#D92D20' 
                }}>
                  {isStoreOpenForToday(profile) ? 'Open Now' : 'Closed Now'}
                </span>
              </>
            )}
          </div>
          {/* Messages and Followers row */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 8px 0' }}>
            <button style={{ background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <span role="img" aria-label="messages">💬</span> Messages
            </button>
            <button
              style={{ background: 'none', border: '1.5px solid #007B7F', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600, fontSize: '1.1rem', color: '#007B7F', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              onClick={() => setShowFollowersModal(true)}
            >
              <span role="img" aria-label="followers">👥</span> Followers ({followers.length})
            </button>
          </div>
          {/* Store item tab/button */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', gap: 8, marginTop: 32 }}>
            <button style={{ flex: 1, background: '#f6f6fa', border: 'none', borderRadius: 12, padding: '1rem', fontSize: '1rem', color: '#007B7F', fontWeight: 600, boxShadow: '0 1px 4px #ececec', cursor: 'pointer', letterSpacing: '0.5px' }}>Store item</button>
            <button onClick={() => setShowAddModal(true)} style={{ background: '#fff', border: '1.5px solid #007B7F', borderRadius: 12, padding: '1rem 1.2rem', fontSize: '1rem', color: '#007B7F', fontWeight: 600, boxShadow: '0 1px 4px #ececec', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span role="img" aria-label="add">➕</span> Add items
            </button>
          </div>
          {/* Store items list */}
          {storeItems.length > 0 && (
            <div style={{ width: '100%', marginTop: 24 }}>
              <h4 style={{ fontSize: '1rem', color: '#222', marginBottom: 10 }}>Store Items</h4>
              {storeItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, background: '#f6f6fa', borderRadius: 10, padding: '0.7rem 1rem' }}>
                  {item.image && <img src={item.image} alt="item" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.98rem', color: '#222' }}>{item.name}</div>
                    <div style={{ fontSize: '0.95rem', color: '#444' }}>{item.price} {item.currency}</div>
                    <div style={{ fontSize: '0.92rem', color: '#666' }}>Quality: {item.quality} | Quantity: {item.quantity}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Delivery Info Box */}
          {profile.deliveryType && (
            <div style={{ width: '100%', background: '#f6f6fa', borderRadius: 10, padding: '0.7rem 1rem', color: '#007B7F', fontSize: '0.98rem', marginTop: 18, marginBottom: 0 }}>
              <b>Delivery Type:</b> {profile.deliveryType}
            </div>
          )}
        </div>
        {/* Add Item Modal */}
        {showAddModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>Add Store Item</h3>
              <form onSubmit={handleAddItem}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Image</label>
                  <input type="file" accept="image/*" onChange={e => setItemImage(e.target.files[0])} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Item Name</label>
                  <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Price</label>
                    <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required min="0" step="0.01" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Currency</label>
                    <select value={itemCurrency} onChange={e => setItemCurrency(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}>
                      <option value="GBP">£ (GBP)</option>
                      <option value="NGN">₦ (NGN)</option>
                      <option value="EUR">€ (EUR)</option>
                      <option value="USD">$ (USD)</option>
                      <option value="CAD">C$ (CAD)</option>
                      <option value="AUD">A$ (AUD)</option>
                      <option value="ZAR">R (ZAR)</option>
                      <option value="GHS">₵ (GHS)</option>
                      <option value="KES">KSh (KES)</option>
                      <option value="XOF">CFA (XOF)</option>
                      <option value="XAF">CFA (XAF)</option>
                      <option value="INR">₹ (INR)</option>
                      <option value="JPY">¥ (JPY)</option>
                      <option value="CNY">¥ (CNY)</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Quality</label>
                  <select value={itemQuality} onChange={e => setItemQuality(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                    <option value="" disabled>Select quality</option>
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Quantity</label>
                  <select value={itemQuantity} onChange={e => setItemQuantity(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                    <option value="" disabled>Select quantity</option>
                    {[...Array(100)].map((_, i) => (
                      <option key={i+1} value={i+1}>{i+1}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ background: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Add</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showEditProfile && profile && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            background: 'rgba(0,0,0,0.25)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000,
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <div style={{ 
              background: '#fff', 
              borderRadius: 16, 
              boxShadow: '0 4px 24px #B8B8B8', 
              padding: '2rem 1.5rem', 
              minWidth: 320, 
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              animation: 'slideDown 0.3s ease-out',
              transform: 'translateY(0)',
              transition: 'transform 0.3s ease-out'
            }}>
              <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>
                {editingName ? 'Edit Store Name' : editingLocation ? 'Edit Location' : 'Edit Store Profile'}
              </h3>
              <form onSubmit={handleSaveProfile}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Store Name</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem', 
                      border: '1px solid #B8B8B8', 
                      borderRadius: 4,
                      backgroundColor: editingName ? '#fff' : '#f5f5f5',
                      color: editingName ? '#000' : '#666'
                    }} 
                    required 
                    disabled={!editingName}
                  />
                  {!editingName && (
                    <small style={{ color: '#888', fontSize: '0.8rem' }}>
                      Click the ✏️ button next to the store name to edit
                    </small>
                  )}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Location</label>
                  <input 
                    type="text" 
                    value={editLocation} 
                    onChange={e => setEditLocation(e.target.value)} 
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem', 
                      border: '1px solid #B8B8B8', 
                      borderRadius: 4,
                      backgroundColor: editingLocation ? '#fff' : '#f5f5f5',
                      color: editingLocation ? '#000' : '#666'
                    }} 
                    required 
                    disabled={!editingLocation}
                  />
                  {!editingLocation && (
                    <small style={{ color: '#888', fontSize: '0.8rem' }}>
                      Click the ✏️ button next to the location to edit
                    </small>
                  )}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Origin</label>
                  <select
                    value={editOrigin}
                    onChange={e => setEditOrigin(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}
                    required
                    disabled
                  >
                    <option value="">Select country/island</option>
                    <option value="African">African</option>
                    <option value="Caribbean">Caribbean</option>
                    <optgroup label="African Countries">
                      {[
                        'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Egypt', 'Ethiopia', 'Morocco', 'Uganda', 'Tanzania', 'Algeria', 'Angola', 'Cameroon', 'Ivory Coast', 'Senegal', 'Zimbabwe', 'Zambia', 'Botswana', 'Namibia', 'Rwanda', 'Burundi', 'Mali', 'Malawi', 'Mozambique', 'Tunisia', 'Libya', 'Sudan', 'Somalia', 'Chad', 'Niger', 'Benin', 'Burkina Faso', 'Guinea', 'Sierra Leone', 'Liberia', 'Togo', 'Central African Republic', 'Congo', 'Gabon', 'Gambia', 'Lesotho', 'Mauritius', 'Swaziland', 'Djibouti', 'Eritrea', 'Seychelles', 'Comoros', 'Cape Verde', 'Sao Tome and Principe',
                      ].map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                    <optgroup label="Caribbean Islands">
                      {[
                        'Jamaica', 'Trinidad and Tobago', 'Barbados', 'Bahamas', 'Saint Lucia', 'Grenada', 'Saint Vincent and the Grenadines', 'Antigua and Barbuda', 'Dominica', 'Saint Kitts and Nevis', 'Cuba', 'Haiti', 'Dominican Republic', 'Puerto Rico', 'Aruba', 'Curacao', 'Saint Martin', 'Saint Barthelemy', 'Anguilla', 'Montserrat', 'British Virgin Islands', 'US Virgin Islands', 'Cayman Islands', 'Turks and Caicos', 'Guadeloupe', 'Martinique', 'Saint Pierre and Miquelon',
                      ].map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div style={{ marginBottom: '1.5rem', width: '100%' }}>
                  <label style={{ fontWeight: 500, display: 'block', marginBottom: 8 }}>Delivery Type:</label>
                  <select value={editDeliveryType} onChange={e => setEditDeliveryType(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}>
                    <option value="Collection">Collection</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Do you sell alcohol in your store/market/online?</label>
                  <select value={editSellsAlcohol} onChange={e => setEditSellsAlcohol(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                {editSellsAlcohol === 'yes' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Upload proof of license/permission to sell alcohol (required)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => setEditAlcoholLicense(e.target.files[0])} style={{ width: '100%' }} required />
                  </div>
                )}
                
                {/* Phone Number Section */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Phone Number (optional)</label>
                  <input 
                    type="tel" 
                    value={editPhoneNumber} 
                    onChange={e => setEditPhoneNumber(e.target.value)} 
                    placeholder="e.g., +44 20 1234 5678" 
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem', 
                      border: '1px solid #B8B8B8', 
                      borderRadius: 4,
                      marginBottom: 8
                    }} 
                  />
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ fontWeight: 500, fontSize: '0.9rem', color: '#666' }}>Phone Type:</label>
                  </div>
                  <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="phoneType"
                        value="work"
                        checked={editPhoneType === 'work'}
                        onChange={e => setEditPhoneType(e.target.value)}
                      />
                      <span style={{ color: '#007B7F' }}>📞 Work</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="phoneType"
                        value="personal"
                        checked={editPhoneType === 'personal'}
                        onChange={e => setEditPhoneType(e.target.value)}
                      />
                      <span style={{ color: '#666' }}>📱 Personal</span>
                    </label>
                  </div>
                  <small style={{ color: '#888', fontSize: '0.8rem', marginTop: 4, display: 'block' }}>
                    Adding a phone number helps customers contact you directly
                  </small>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Opening Time</label>
                  <input type="time" value={editOpeningTime} onChange={e => setEditOpeningTime(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Closing Time</label>
                  <input type="time" value={editClosingTime} onChange={e => setEditClosingTime(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Closed Days (optional)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {daysOfWeek.map(day => (
                      <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="checkbox"
                          checked={closedDays.includes(day)}
                          onChange={e => {
                            if (e.target.checked) {
                              setClosedDays([...closedDays, day]);
                            } else {
                              setClosedDays(closedDays.filter(d => d !== day));
                            }
                          }}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
                {daysOfWeek.map(day => (
                  <div key={day} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ minWidth: 80, fontWeight: closedDays.includes(day) ? 400 : 500 }}>
                      {day}:
                    </label>
                    <input
                      type="time"
                      value={closedDays.includes(day) ? '' : (openingTimes[day] || '')}
                      onChange={e => {
                        if (!closedDays.includes(day)) {
                          setOpeningTimes({ ...openingTimes, [day]: e.target.value });
                        }
                      }}
                      disabled={closedDays.includes(day)}
                      placeholder="Open"
                      style={{ 
                        width: 110, 
                        border: closedDays.includes(day) ? '1px solid #ddd' : '1px solid #B8B8B8', 
                        borderRadius: 4, 
                        padding: '0.3rem',
                        backgroundColor: closedDays.includes(day) ? '#f5f5f5' : '#fff'
                      }}
                    />
                    <span style={{ color: closedDays.includes(day) ? '#999' : '#000' }}>to</span>
                    <input
                      type="time"
                      value={closedDays.includes(day) ? '' : (closingTimes[day] || '')}
                      onChange={e => {
                        if (!closedDays.includes(day)) {
                          setClosingTimes({ ...closingTimes, [day]: e.target.value });
                        }
                      }}
                      disabled={closedDays.includes(day)}
                      placeholder="Close"
                      style={{ 
                        width: 110, 
                        border: closedDays.includes(day) ? '1px solid #ddd' : '1px solid #B8B8B8', 
                        borderRadius: 4, 
                        padding: '0.3rem',
                        backgroundColor: closedDays.includes(day) ? '#f5f5f5' : '#fff'
                      }}
                    />
                    {closedDays.includes(day) && (
                      <span style={{ color: '#D92D20', fontSize: '0.9rem', fontWeight: 600 }}>
                        CLOSED
                      </span>
                    )}
                  </div>
                ))}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Thumbnail</label>
                  
                  {/* Current Thumbnail Preview */}
                  {profile.backgroundImg && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#666', marginBottom: 6 }}>Current Thumbnail:</div>
                      <img 
                        src={profile.backgroundImg} 
                        alt="Current thumbnail" 
                        style={{ 
                          maxWidth: 200, 
                          maxHeight: 120, 
                          borderRadius: 8, 
                          border: '2px solid #007B7F',
                          objectFit: 'cover'
                        }} 
                      />
                    </div>
                  )}
                  
                  {/* New Thumbnail Upload */}
                  <div style={{ 
                    position: 'relative',
                    opacity: isRestrictedFromThumbnailChanges() ? 0.5 : 1,
                    pointerEvents: isRestrictedFromThumbnailChanges() ? 'none' : 'auto'
                  }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => setEditThumbnail(e.target.files[0])} 
                      disabled={isRestrictedFromThumbnailChanges()}
                      style={{
                        width: '100%',
                        cursor: isRestrictedFromThumbnailChanges() ? 'not-allowed' : 'pointer'
                      }}
                    />
                    {isRestrictedFromThumbnailChanges() && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(255,255,255,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 4,
                        border: '1px solid #ccc'
                      }}>
                        <span style={{ color: '#D92D20', fontSize: '0.8rem', fontWeight: 600 }}>
                          Restricted
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* New Thumbnail Preview */}
                  {editThumbnail && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#007B7F', marginBottom: 6 }}>New Thumbnail Preview:</div>
                      <img 
                        src={URL.createObjectURL(editThumbnail)} 
                        alt="New thumbnail preview" 
                        style={{ 
                          maxWidth: 200, 
                          maxHeight: 120, 
                          borderRadius: 8, 
                          border: '2px solid #28a745',
                          objectFit: 'cover'
                        }} 
                      />
                    </div>
                  )}
                  
                  {isRestrictedFromThumbnailChanges() && (
                    <small style={{ color: '#D92D20', fontSize: '0.8rem', display: 'block', marginTop: 4 }}>
                      Thumbnail changes are restricted for 4 months after your first change.
                    </small>
                  )}
                  {/* Debug info - remove this later */}
                  <small style={{ color: '#666', fontSize: '0.7rem', display: 'block', marginTop: 2 }}>
                    Debug: Has licenses: {profile?.certificate || profile?.foodHygiene || profile?.marketStallLicence || profile?.onlineLicence ? 'Yes' : 'No'}, 
                    Thumbnail changes: {changeHistory.thumbnailChanges.length}, 
                    Restricted: {isRestrictedFromThumbnailChanges() ? 'Yes' : 'No'}
                  </small>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button type="button" onClick={() => setShowEditProfile(false)} style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ background: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showFollowersModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw', textAlign: 'center' }}>
              <button
                onClick={() => setShowFollowersModal(false)}
                style={{ position: 'absolute', top: 8, right: 8, background: '#eee', border: 'none', borderRadius: '50%', width: 28, height: 28, fontSize: 18, cursor: 'pointer' }}>
                ×
              </button>
              <h3 style={{ marginBottom: 18, color: '#007B7F' }}>Followers ({followersDetails.length})</h3>
              {followersDetails.length === 0 ? (
                <div style={{ color: '#888' }}>No followers yet.</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {followersDetails.map(f => (
                    <li key={f.uid} style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={f.photoURL || 'https://via.placeholder.com/40'} alt={f.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontWeight: 600 }}>{f.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {/* Name Change Confirmation Dialog */}
        {showNameChangeDialog && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>Why the change of name?</h3>
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={() => handleNameChangeConfirm('Store name changed')}
                  style={{ width: '100%', marginBottom: 10, padding: '0.8rem', background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Store name changed
                </button>
                <button
                  onClick={() => handleNameChangeConfirm('Moved Store to different location')}
                  style={{ width: '100%', marginBottom: 10, padding: '0.8rem', background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Moved Store to different location
                </button>
                <button
                  onClick={() => handleNameChangeConfirm('Name Error')}
                  style={{ width: '100%', marginBottom: 10, padding: '0.8rem', background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Name Error
                </button>
              </div>
              <button
                onClick={() => setShowNameChangeDialog(false)}
                style={{ width: '100%', padding: '0.8rem', background: '#eee', color: '#444', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Location Change Confirmation Dialog */}
        {showLocationChangeDialog && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>Have you recently moved stores?</h3>
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={() => handleLocationChangeConfirm('yes')}
                  style={{ width: '100%', marginBottom: 10, padding: '0.8rem', background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleLocationChangeConfirm('no')}
                  style={{ width: '100%', marginBottom: 10, padding: '0.8rem', background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  No
                </button>
              </div>
              <button
                onClick={() => setShowLocationChangeDialog(false)}
                style={{ width: '100%', padding: '0.8rem', background: '#eee', color: '#444', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {/* Restriction Dialog */}
        {showRestrictionDialog && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#D92D20', fontWeight: 700, fontSize: '1.2rem' }}>⚠️ Changes Restricted</h3>
              <p style={{ marginBottom: 20, color: '#444', lineHeight: 1.5 }}>
                {restrictionMessage}
              </p>
              <div style={{ marginBottom: 20, padding: '1rem', background: '#f8f9fa', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Why this restriction?</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  To maintain data integrity and prevent abuse, store owners without licenses are limited to 3 name/location changes. 
                  Adding proper licenses removes this restriction.
                </div>
              </div>
              <button
                onClick={() => setShowRestrictionDialog(false)}
                style={{ width: '100%', padding: '0.8rem', background: '#007B7F', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Understand
              </button>
            </div>
          </div>
        )}
        {/* Second Change Warning Dialog */}
        {showSecondChangeWarning && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#f39c12', fontWeight: 700, fontSize: '1.2rem' }}>⚠️ Final Change Warning</h3>
              <p style={{ marginBottom: 20, color: '#444', lineHeight: 1.5 }}>
                This will be your <strong>third</strong> name/location change. After this change, you will not be able to modify your store name or location for <strong>4 months</strong>.
              </p>
              <div style={{ marginBottom: 20, padding: '1rem', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: '#856404' }}>Important:</div>
                <div style={{ fontSize: '0.9rem', color: '#856404' }}>
                  • This restriction only applies to store owners without licenses<br/>
                  • Adding proper licenses removes all restrictions<br/>
                  • The 4-month period starts from the date of this change
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleSecondChangeWarningCancel}
                  style={{ 
                    flex: 1, 
                    padding: '0.8rem', 
                    background: '#eee', 
                    color: '#444', 
                    border: 'none', 
                    borderRadius: 8, 
                    fontWeight: 600, 
                    cursor: 'pointer' 
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSecondChangeWarningConfirm}
                  style={{ 
                    flex: 1, 
                    padding: '0.8rem', 
                    background: '#f39c12', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 8, 
                    fontWeight: 600, 
                    cursor: 'pointer' 
                  }}
                >
                  Proceed Anyway
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Thumbnail Change Dialog */}
        {showThumbnailChangeDialog && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>Confirm Thumbnail Change</h3>
              <p style={{ marginBottom: 20, color: '#444', lineHeight: 1.5 }}>
                You are about to update your store thumbnail.
              </p>
              <div style={{ marginBottom: 20, padding: '1rem', background: '#f8f9fa', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>What happens next?</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  {(() => {
                    const hasLicenses = profile?.certificate || profile?.foodHygiene || profile?.marketStallLicence || profile?.onlineLicence;
                    if (hasLicenses) {
                      return (
                        <>
                          • Your store will go offline temporarily<br/>
                          • You will need to update your licenses<br/>
                          • Your store will be live again after license verification
                        </>
                      );
                    } else {
                      return (
                        <>
                          • This is your <strong>{changeHistory.thumbnailChanges.length === 0 ? 'first' : 'second'}</strong> thumbnail change.<br/>
                          • Unlicensed users are allowed 2 changes.<br/>
                          • After your second change, a 4-month restriction will apply.
                        </>
                      );
                    }
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowThumbnailChangeDialog(false)}
                  style={{ 
                    flex: 1, 
                    padding: '0.8rem', 
                    background: '#eee', 
                    color: '#444', 
                    border: 'none', 
                    borderRadius: 8, 
                    fontWeight: 600, 
                    cursor: 'pointer' 
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleThumbnailChangeConfirm}
                  style={{ 
                    flex: 1, 
                    padding: '0.8rem', 
                    background: '#007B7F', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 8, 
                    fontWeight: 600, 
                    cursor: 'pointer' 
                  }}
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        )}
        {/* First Thumbnail Change Warning Dialog */}
        {showFirstThumbnailWarning && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#f39c12', fontWeight: 700, fontSize: '1.2rem' }}>⚠️ Heads Up!</h3>
              <p style={{ marginBottom: 20, color: '#444', lineHeight: 1.5 }}>
                This is your first of two allowed thumbnail changes. After your <strong>next</strong> change, you will be unable to modify it for 4 months.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowFirstThumbnailWarning(false)}
                  style={{ flex: 1, padding: '0.8rem', background: '#eee', color: '#444', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFirstThumbnailWarningConfirm}
                  style={{ flex: 1, padding: '0.8rem', background: '#f39c12', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Okay, I Understand
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Add CSS animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideDown {
            from { 
              transform: translateY(-50px);
              opacity: 0;
            }
            to { 
              transform: translateY(0);
              opacity: 1;
            }
          }
          
          @keyframes slideUp {
            from { 
              transform: translateY(0);
              opacity: 1;
            }
            to { 
              transform: translateY(-50px);
              opacity: 0;
            }
          }
        `}
      </style>

      {/* QR Code Modal */}
      {showQRModal && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          storeId={profile?.ownerId}
          storeName={profile?.storeName}
        />
      )}
    </div>
  );
}

function isStoreOpen(opening, closing) {
  if (!opening || !closing) return false;
  const now = new Date();
  const [openH, openM] = opening.split(':').map(Number);
  const [closeH, closeM] = closing.split(':').map(Number);
  const openDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openH, openM);
  const closeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeH, closeM);
  return now >= openDate && now <= closeDate;
}

export default StoreProfilePage;