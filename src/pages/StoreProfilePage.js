import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import QRCodeModal from '../components/QRCodeModal';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db, storage } from '../firebase';
import { doc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Country and origin arrays
const africanCountries = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Egypt', 'Ethiopia', 'Morocco', 'Uganda', 'Tanzania', 'Algeria', 'Angola', 'Cameroon', 'Ivory Coast', 'Senegal', 'Zimbabwe', 'Zambia', 'Botswana', 'Namibia', 'Rwanda', 'Burundi', 'Mali', 'Malawi', 'Mozambique', 'Tunisia', 'Libya', 'Sudan', 'Somalia', 'Chad', 'Niger', 'Benin', 'Burkina Faso', 'Guinea', 'Sierra Leone', 'Liberia', 'Togo', 'Central African Republic', 'Congo', 'Gabon', 'Gambia', 'Lesotho', 'Mauritius', 'Swaziland', 'Djibouti', 'Eritrea', 'Seychelles', 'Comoros', 'Cape Verde', 'Sao Tome and Principe',
];

const caribbeanIslands = [
  'Jamaica', 'Trinidad and Tobago', 'Barbados', 'Bahamas', 'Saint Lucia', 'Grenada', 'Saint Vincent and the Grenadines', 'Antigua and Barbuda', 'Dominica', 'Saint Kitts and Nevis', 'Cuba', 'Haiti', 'Dominican Republic', 'Puerto Rico', 'Aruba', 'Curacao', 'Saint Martin', 'Saint Barthelemy', 'Anguilla', 'Montserrat', 'British Virgin Islands', 'US Virgin Islands', 'Cayman Islands', 'Turks and Caicos', 'Guadeloupe', 'Martinique', 'Saint Pierre and Miquelon',
];

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
  
  // Social media and website fields - now as arrays for multiple links
  const [editSocialLinks, setEditSocialLinks] = useState([]);
  const [editWebsiteLinks, setEditWebsiteLinks] = useState([]);

  // Item management states
  const [showItemMenu, setShowItemMenu] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemCurrency, setEditItemCurrency] = useState('GBP');
  const [editItemQuality, setEditItemQuality] = useState('');
  const [editItemQuantity, setEditItemQuantity] = useState('');
  const [editItemImage, setEditItemImage] = useState(null);
  const [editItemStock, setEditItemStock] = useState('in-stock');

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
          setEditLocation(data.storeLocation || data.storeAddress || '');
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
          
          // Initialize social media and website arrays - convert from old format if needed
          const socialLinks = data.socialLinks || [];
          // If we have old format data, convert it
          if (data.platform && data.socialHandle && socialLinks.length === 0) {
            socialLinks.push({
              platform: data.platform,
              handle: data.socialHandle,
              id: Date.now()
            });
          }
          setEditSocialLinks(socialLinks);
          
          const websiteLinks = data.websiteLinks || [];
          // If we have old format data, convert it
          if (data.websiteLink && websiteLinks.length === 0) {
            websiteLinks.push({
              name: data.websiteName || 'Website',
              url: data.websiteLink,
              id: Date.now()
            });
          }
          setEditWebsiteLinks(websiteLinks);
          
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
          // Get both document IDs and data for each follower
          const followersArr = snapshot.docs.map(doc => ({
            docId: doc.id, // Store document ID for deletion if needed
            ...doc.data()
          }));
          
          setFollowers(followersArr);
          
          // Fetch user details for each follower
          const details = [];
          
          for (const f of followersArr) {
            if (f.uid) {
              const userDoc = await getDoc(doc(db, 'users', f.uid));
              if (userDoc.exists()) {
                // Check if account is deleted
                const userData = userDoc.data();
                if (!userData.deleted && userData.accountStatus !== 'deleted') {
                  // Valid user, add to followers details
                  details.push({ uid: f.uid, ...userData });
                } else {
                  // User is deleted, remove from followers collection
                  console.log(`User ${f.uid} has been deleted, removing from followers`);
                  try {
                    // Use the stored document ID for precise deletion
                    const followerDocRef = doc(db, 'stores', user.uid, 'followers', f.docId);
                    await deleteDoc(followerDocRef);
                  } catch (err) {
                    console.error('Error removing deleted follower:', err);
                  }
                }
              } else {
                // User document doesn't exist, remove from followers
                console.log(`User document for ${f.uid} not found, removing from followers`);
                try {
                  // Use the stored document ID for precise deletion
                  const followerDocRef = doc(db, 'stores', user.uid, 'followers', f.docId);
                  await deleteDoc(followerDocRef);
                } catch (err) {
                  console.error('Error removing non-existent follower:', err);
                }
              }
            }
          }
          
          setFollowersDetails(details);
          
          // Check if current user is following (only from valid followers)
          const currentUserIsFollowing = followersArr.some(f => 
            f.uid === user.uid && 
            details.some(d => d.uid === user.uid)
          );
          setIsFollowing(currentUserIsFollowing);
        });
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking inside the dropdown
      if (event.target.closest('.dropdown-menu')) {
        return;
      }
      if (showItemMenu !== null) {
        setShowItemMenu(null);
      }
    };

    if (showItemMenu !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showItemMenu]);

  // Social media and website link management functions
  const addSocialLink = () => {
    setEditSocialLinks([...editSocialLinks, {
      platform: 'Instagram',
      handle: '',
      id: Date.now()
    }]);
  };

  const removeSocialLink = (id) => {
    setEditSocialLinks(editSocialLinks.filter(link => link.id !== id));
  };

  const updateSocialLink = (id, field, value) => {
    setEditSocialLinks(editSocialLinks.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  const addWebsiteLink = () => {
    setEditWebsiteLinks([...editWebsiteLinks, {
      name: '',
      url: '',
      id: Date.now()
    }]);
  };

  const removeWebsiteLink = (id) => {
    setEditWebsiteLinks(editWebsiteLinks.filter(link => link.id !== id));
  };

  const updateWebsiteLink = (id, field, value) => {
    setEditWebsiteLinks(editWebsiteLinks.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  // Item management functions
  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditItemName(item.name || '');
    setEditItemPrice(item.price || '');
    setEditItemCurrency(item.currency || 'GBP');
    setEditItemQuality(item.quality || '');
    setEditItemQuantity(item.quantity || '');
    setEditItemStock(item.stock || 'in-stock');
    setEditItemImage(null);
    setShowEditItemModal(true);
    setShowItemMenu(null);
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!editingItem || !editItemName || !editItemPrice || !editItemQuality || !editItemQuantity) return;
    
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');

      let imageUrl = editingItem.image;
      if (editItemImage) {
        const imgRef = ref(storage, `storeItems/${user.uid}_${Date.now()}_${editItemImage.name}`);
        await uploadBytes(imgRef, editItemImage);
        imageUrl = await getDownloadURL(imgRef);
      }

      const itemData = {
        name: editItemName,
        price: editItemPrice,
        currency: editItemCurrency,
        quality: editItemQuality,
        quantity: editItemQuantity,
        stock: editItemStock,
        image: imageUrl,
        updatedAt: new Date().toISOString()
      };

      const itemRef = doc(db, 'stores', user.uid, 'items', editingItem.id);
      await updateDoc(itemRef, itemData);

      // Update local state
      setStoreItems(storeItems.map(item => 
        item.id === editingItem.id ? { ...item, ...itemData } : item
      ));

      setShowEditItemModal(false);
      setEditingItem(null);
    } catch (err) {
      alert('Error updating item: ' + err.message);
    }
    setLoading(false);
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');

      const itemRef = doc(db, 'stores', user.uid, 'items', item.id);
      await deleteDoc(itemRef);

      // Update local state
      setStoreItems(storeItems.filter(i => i.id !== item.id));
      setShowItemMenu(null);
    } catch (err) {
      alert('Error deleting item: ' + err.message);
    }
    setLoading(false);
  };

  const handleStockUpdate = async (item, newStock) => {
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');

      const itemRef = doc(db, 'stores', user.uid, 'items', item.id);
      await updateDoc(itemRef, { 
        stock: newStock,
        updatedAt: new Date().toISOString()
      });

      // Update local state
      setStoreItems(storeItems.map(i => 
        i.id === item.id ? { ...i, stock: newStock } : i
      ));
      setShowItemMenu(null);
    } catch (err) {
      alert('Error updating stock: ' + err.message);
    }
    setLoading(false);
  };

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
        stock: 'in-stock', // Default to in-stock for new items
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
        storeAddress: editLocation, // Keep storeAddress in sync with storeLocation
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
        // Social media and website arrays
        socialLinks: editSocialLinks,
        websiteLinks: editWebsiteLinks,
        // Keep old format for backward compatibility
        platform: editSocialLinks.length > 0 ? editSocialLinks[0].platform : '',
        socialHandle: editSocialLinks.length > 0 ? editSocialLinks[0].handle : '',
        hasWebsite: editWebsiteLinks.length > 0 ? 'yes' : 'no',
        websiteLink: editWebsiteLinks.length > 0 ? editWebsiteLinks[0].url : '',
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
    if (!canGoLive) {
      console.log('Cannot go live. Missing requirements:', {
        backgroundImg: !!profile?.backgroundImg,
        storeName: !!profile?.storeName,
        storeLocation: !!profile?.storeLocation,
        origin: !!profile?.origin,
        deliveryType: !!profile?.deliveryType,
        hasItems: storeItems.length > 0
      });
      return;
    }
    
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert('Please log in to continue');
        return;
      }
      
      console.log('Going live...');
      const docRef = doc(db, 'stores', user.uid);
      await updateDoc(docRef, { live: true });
      setProfile(prev => ({ ...prev, live: true }));
      console.log('Store is now live!');
    } catch (error) {
      console.error('Error going live:', error);
      alert('Failed to go live. Please try again.');
    }
  };

  const handleGoOffline = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert('Please log in to continue');
        return;
      }
      
      console.log('Going offline...');
      const docRef = doc(db, 'stores', user.uid);
      await updateDoc(docRef, { live: false });
      setProfile(prev => ({ ...prev, live: false }));
      console.log('Store is now offline');
    } catch (error) {
      console.error('Error going offline:', error);
      alert('Failed to go offline. Please try again.');
    }
  };

  const handleFollow = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !profile) return;
    
    try {
      // Check if already following to prevent duplicates
      const followersCol = collection(db, 'stores', user.uid, 'followers');
      const q = query(followersCol, where('uid', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Not following yet, add as follower
        await addDoc(collection(db, 'stores', user.uid, 'followers'), { 
          uid: user.uid, 
          email: user.email,
          timestamp: new Date()
        });
        setIsFollowing(true);
      } else {
        console.log('Already following this store');
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error following store:', error);
    }
  };

  const handleUnfollow = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !profile) return;
    
    try {
      // Find the follower document with the current user's UID
      const followersCol = collection(db, 'stores', user.uid, 'followers');
      const q = query(followersCol, where('uid', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      // Delete all matching documents (should only be one)
      let deleted = false;
      querySnapshot.forEach(async (docSnapshot) => {
        await deleteDoc(docSnapshot.ref);
        deleted = true;
      });
      
      if (deleted) {
        setIsFollowing(false);
      } else {
        console.log('No follower document found to unfollow');
      }
    } catch (error) {
      console.error('Error unfollowing store:', error);
    }
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

          {/* Go live or live/offline button on the right - modernized */}
          {profile.live ? (
            <button
              style={{ 
                position: 'absolute', 
                right: 24, 
                top: 24, 
                background: 'rgba(217, 45, 32, 0.9)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 12, 
                padding: '0.7rem 1.4rem', 
                fontWeight: 600, 
                fontSize: '0.95rem', 
                cursor: 'pointer', 
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(217, 45, 32, 0.25)',
                transition: 'all 0.2s ease'
              }}
              onClick={handleGoOffline}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(217, 45, 32, 1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(217, 45, 32, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(217, 45, 32, 0.9)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 45, 32, 0.25)';
              }}
              title="Click to go offline"
            >
              <span role="img" aria-label="live" style={{ fontSize: '1rem' }}>🔴</span>
              Store is Live
            </button>
          ) : (
            <button
              style={{ 
                position: 'absolute', 
                right: 24, 
                top: 24, 
                background: canGoLive ? 'rgba(0, 123, 127, 0.9)' : '#ccc', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 12, 
                padding: '0.7rem 1.4rem', 
                fontWeight: 600, 
                fontSize: '0.95rem', 
                cursor: canGoLive ? 'pointer' : 'not-allowed', 
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: canGoLive ? '0 4px 12px rgba(0, 123, 127, 0.25)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onClick={handleGoLive}
              onMouseOver={(e) => {
                if (canGoLive) {
                  e.currentTarget.style.background = 'rgba(0, 123, 127, 1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 123, 127, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (canGoLive) {
                  e.currentTarget.style.background = 'rgba(0, 123, 127, 0.9)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 127, 0.25)';
                }
              }}
              disabled={!canGoLive}
              title={canGoLive ? 'Make your store available to customers' : 'Add all required info and at least one item to go live'}
            >
              <span role="img" aria-label="offline" style={{ fontSize: '1rem' }}>⚫</span>
              Go Live
            </button>
          )}
        </div>
        {/* Title and details below banner - modernized card */}
        <div style={{ 
          width: '100%', 
          maxWidth: 450, 
          background: '#fff', 
          borderRadius: 24, 
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)', 
          padding: '2rem 1.5rem 1.5rem', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'flex-start', 
          marginTop: -40, 
          marginBottom: 30, 
          position: 'relative',
          border: '1px solid rgba(0, 123, 127, 0.1)'
        }}>
          {/* Title and origin in the same row, title left, origin right - modernized */}
          <div style={{ 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: 14
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 10
            }}>
              <span style={{ 
                fontWeight: 700, 
                fontSize: '1.3rem', 
                color: '#1a1a1a', 
                letterSpacing: '0.2px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                {profile.storeName || 'Store Profile'}
              </span>
              <button
                onClick={handleNameEdit}
                style={{ 
                  background: isRestrictedFromChanges() ? '#f5f5f5' : 'rgba(0, 123, 127, 0.1)', 
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isRestrictedFromChanges() ? '#ccc' : '#007B7F', 
                  cursor: isRestrictedFromChanges() ? 'not-allowed' : 'pointer', 
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!isRestrictedFromChanges()) {
                    e.currentTarget.style.background = 'rgba(0, 123, 127, 0.15)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isRestrictedFromChanges()) {
                    e.currentTarget.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
                title={isRestrictedFromChanges() ? 'Changes restricted for 4 months' : "Edit store name"}
                disabled={isRestrictedFromChanges()}
              >
                ✏️
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {profile.origin && (
                <div style={{ 
                  fontSize: '0.9rem', 
                  color: '#555', 
                  fontWeight: 500,
                  background: 'rgba(0, 123, 127, 0.08)',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <span role="img" aria-label="origin" style={{ marginRight: '5px', fontSize: '0.9rem' }}>🌍</span> 
                  {profile.origin}
                </div>
              )}
              
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ 
                    background: 'rgba(0, 123, 127, 0.9)',
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 10, 
                    padding: '0.5rem 1.1rem', 
                    fontWeight: 600, 
                    fontSize: '0.9rem', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(0, 123, 127, 0.15)'
                  }}
                  onClick={handleGeneralEdit}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 123, 127, 1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 123, 127, 0.2)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 123, 127, 0.9)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 123, 127, 0.15)';
                  }}
                >
                  <span role="img" aria-label="edit" style={{ fontSize: '0.85rem' }}>✏️</span> Edit
                </button>
              </div>
            </div>
          </div>
          {/* Location - modernized */}
          {(profile.storeLocation || profile.storeAddress) && (
            <div style={{ 
              width: '100%',
              background: '#fafafa', 
              borderRadius: '14px',
              padding: '12px 16px',
              marginTop: '8px',
              marginBottom: '12px',
              borderLeft: '3px solid #007B7F',
              position: 'relative'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '2px' 
              }}>
                <span role="img" aria-label="location" style={{ fontSize: '1.1rem' }}>📍</span>
                <span style={{ 
                  fontWeight: 600, 
                  color: '#333',
                  fontSize: '0.9rem'
                }}>
                  Store Address
                </span>
              </div>
              
              <div style={{ 
                paddingLeft: '31px',
                wordBreak: 'break-word',
                textAlign: 'left',
                fontSize: '0.95rem',
                color: '#444'
              }}>
                {(() => {
                  if (profile.storeLocation) {
                    const parts = profile.storeLocation.split(',');
                    return (
                      <>
                        <div style={{ fontWeight: 500, marginBottom: '2px' }}>{parts[0]}</div>
                        <div style={{ color: '#666', fontSize: '0.93rem' }}>{parts.slice(1).join(',').trim()}</div>
                      </>
                    );
                  } else if (profile.storeAddress) {
                    const parts = profile.storeAddress.split(',');
                    return (
                      <>
                        <div style={{ fontWeight: 500, marginBottom: '2px' }}>{parts[0]}</div>
                        <div style={{ color: '#666', fontSize: '0.93rem' }}>{parts.slice(1).join(',').trim()}</div>
                      </>
                    );
                  } else {
                    return (
                      <span>Location not set</span>
                    );
                  }
                })()}
              </div>
              
              <button
                onClick={handleLocationEdit}
                style={{ 
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: isRestrictedFromChanges() ? '#f5f5f5' : 'rgba(0, 123, 127, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isRestrictedFromChanges() ? '#ccc' : '#007B7F',
                  cursor: isRestrictedFromChanges() ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!isRestrictedFromChanges()) {
                    e.currentTarget.style.background = 'rgba(0, 123, 127, 0.15)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isRestrictedFromChanges()) {
                    e.currentTarget.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
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
            <button 
              onClick={() => navigate('/messages')}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#007B7F', 
                fontWeight: 600, 
                fontSize: '0.98rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6, 
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = '#00696d';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = '#007B7F';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span role="img" aria-label="messages">💬</span> Messages
            </button>
            <button
              style={{ 
                background: '#f8f8ff', 
                border: '1.5px solid #007B7F', 
                borderRadius: 12, 
                padding: '0.6rem 1.4rem', 
                fontWeight: 600, 
                fontSize: '1.1rem', 
                color: '#007B7F', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0, 123, 127, 0.1)'
              }}
              onClick={() => setShowFollowersModal(true)}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#eef8f8';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 123, 127, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f8ff';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 123, 127, 0.1)';
              }}
            >
              <span role="img" aria-label="followers" style={{ fontSize: '1.2rem' }}>👥</span> 
              Followers ({followers.length})
            </button>
          </div>
          {/* Store item tab/button - modernized */}
          <div style={{ 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'row', 
            gap: 12, 
            marginTop: 32 
          }}>
            <button style={{ 
              flex: 1, 
              background: 'linear-gradient(to right, #f4f9f9, #e8f4f4)', 
              border: 'none', 
              borderRadius: 16, 
              padding: '1.1rem 1rem', 
              fontSize: '1rem', 
              color: '#007B7F', 
              fontWeight: 600, 
              boxShadow: '0 2px 6px rgba(0, 123, 127, 0.08)', 
              cursor: 'pointer', 
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 123, 127, 0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 123, 127, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span role="img" aria-label="store" style={{ fontSize: '1.2rem' }}>🏪</span>
                <span>Store Items</span>
              </div>
            </button>
            
            <button 
              onClick={() => setShowAddModal(true)} 
              style={{ 
                background: '#fff', 
                border: '1.5px solid #007B7F', 
                borderRadius: 16, 
                padding: '1rem 1.2rem', 
                fontSize: '1rem', 
                color: '#007B7F', 
                fontWeight: 600, 
                boxShadow: '0 2px 6px rgba(0, 123, 127, 0.08)', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(0, 123, 127, 0.04)';
                e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 123, 127, 0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 123, 127, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span role="img" aria-label="add" style={{ fontSize: '1.1rem' }}>➕</span> Add Items
            </button>
          </div>
          {/* Store items list - modernized */}
          {storeItems.length > 0 && (
            <div style={{ width: '100%', marginTop: 28 }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: 16 
              }}>
                <h4 style={{ 
                  fontSize: '1.1rem', 
                  color: '#1a1a1a', 
                  margin: 0, 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span role="img" aria-label="items" style={{ fontSize: '1.1rem' }}>📦</span>
                  Available Items ({storeItems.length})
                </h4>
                
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: '#007B7F', 
                  background: 'rgba(0, 123, 127, 0.08)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontWeight: 500
                }}>
                  {storeItems.length} {storeItems.length === 1 ? 'Item' : 'Items'}
                </div>
              </div>
              
              {/* Go Live Status Debug */}
              {!profile?.live && (
                <div style={{ 
                  marginTop: '16px',
                  padding: '12px',
                  background: canGoLive ? '#f0f9ff' : '#fef3f2',
                  border: `1px solid ${canGoLive ? '#bfdbfe' : '#fecaca'}`,
                  borderRadius: '8px',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', color: canGoLive ? '#1e40af' : '#dc2626' }}>
                    {canGoLive ? '✅ Ready to Go Live!' : '⚠️ Requirements for Going Live:'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4px' }}>
                    <div style={{ color: profile?.backgroundImg ? '#10b981' : '#ef4444' }}>
                      {profile?.backgroundImg ? '✅' : '❌'} Background Image
                    </div>
                    <div style={{ color: profile?.storeName ? '#10b981' : '#ef4444' }}>
                      {profile?.storeName ? '✅' : '❌'} Store Name
                    </div>
                    <div style={{ color: profile?.storeLocation ? '#10b981' : '#ef4444' }}>
                      {profile?.storeLocation ? '✅' : '❌'} Store Location
                    </div>
                    <div style={{ color: profile?.origin ? '#10b981' : '#ef4444' }}>
                      {profile?.origin ? '✅' : '❌'} Origin
                    </div>
                    <div style={{ color: profile?.deliveryType ? '#10b981' : '#ef4444' }}>
                      {profile?.deliveryType ? '✅' : '❌'} Delivery Type
                    </div>
                    <div style={{ color: storeItems.length > 0 ? '#10b981' : '#ef4444' }}>
                      {storeItems.length > 0 ? '✅' : '❌'} At least 1 item ({storeItems.length})
                    </div>
                  </div>
                </div>
              )}

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px'
              }}>
                {storeItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 14, 
                      marginBottom: 4, 
                      background: item.stock === 'out-of-stock' ? '#ffebee' : item.stock === 'low-stock' ? '#fff8e1' : '#f9f9f9', 
                      borderRadius: 14, 
                      padding: '1rem',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                      border: item.stock === 'out-of-stock' ? '1px solid #ffcdd2' : item.stock === 'low-stock' ? '1px solid #ffecb3' : '1px solid #f0f0f0',
                      position: 'relative',
                      zIndex: showItemMenu === item.id ? 1000000 : 1
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      if (item.stock === 'out-of-stock') {
                        e.currentTarget.style.background = '#ffcdd2';
                      } else if (item.stock === 'low-stock') {
                        e.currentTarget.style.background = '#ffecb3';
                      } else {
                        e.currentTarget.style.background = '#fff';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      if (item.stock === 'out-of-stock') {
                        e.currentTarget.style.background = '#ffebee';
                      } else if (item.stock === 'low-stock') {
                        e.currentTarget.style.background = '#fff8e1';
                      } else {
                        e.currentTarget.style.background = '#f9f9f9';
                      }
                    }}
                  >
                    {/* Stock status overlay */}
                    {item.stock !== 'in-stock' && (
                      <div style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        background: item.stock === 'out-of-stock' ? '#f44336' : '#ff9800',
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: 6,
                        zIndex: 1
                      }}>
                        {item.stock === 'out-of-stock' ? 'OUT OF STOCK' : 'LOW STOCK'}
                      </div>
                    )}

                    {/* 3-dot menu */}
                    <div 
                      id={`menu-button-${item.id}`}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: '#666',
                        padding: '4px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.8)',
                        transition: 'all 0.2s ease',
                        zIndex: 1000
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowItemMenu(showItemMenu === item.id ? null : item.id);
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,1)';
                        e.currentTarget.style.color = '#333';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                        e.currentTarget.style.color = '#666';
                      }}
                    >
                      ⋮
                    </div>

                    {/* Dropdown menu */}
                    {showItemMenu === item.id && (
                      <div 
                        className="dropdown-menu"
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 40,
                          background: 'white',
                          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                          borderRadius: 12,
                          zIndex: 999999,
                          minWidth: 200,
                          border: '2px solid #007B7F'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #f0f0f0',
                          background: '#f8f9fa',
                          borderRadius: '12px 12px 0 0',
                          fontWeight: 600,
                          color: '#333',
                          fontSize: '0.9rem'
                        }}>
                          {item.name}
                        </div>
                        
                        <button
                          onClick={() => handleEditItem(item)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            borderBottom: '1px solid #f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <span>✏️</span> Edit Item
                        </button>
                        
                        <div style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <div style={{ padding: '0 16px', fontSize: '0.8rem', color: '#666', fontWeight: 500, marginBottom: '4px' }}>
                            Stock Status:
                          </div>
                          <button
                            onClick={() => handleStockUpdate(item, 'in-stock')}
                            style={{
                              width: '100%',
                              padding: '8px 16px',
                              border: 'none',
                              background: item.stock === 'in-stock' ? '#e8f5e8' : 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              color: item.stock === 'in-stock' ? '#4caf50' : '#666',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = item.stock === 'in-stock' ? '#e8f5e8' : '#f5f5f5'}
                            onMouseOut={(e) => e.currentTarget.style.background = item.stock === 'in-stock' ? '#e8f5e8' : 'none'}
                          >
                            <span>✅</span> In Stock
                          </button>
                          <button
                            onClick={() => handleStockUpdate(item, 'low-stock')}
                            style={{
                              width: '100%',
                              padding: '8px 16px',
                              border: 'none',
                              background: item.stock === 'low-stock' ? '#fff8e1' : 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              color: item.stock === 'low-stock' ? '#ff9800' : '#666',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = item.stock === 'low-stock' ? '#fff8e1' : '#f5f5f5'}
                            onMouseOut={(e) => e.currentTarget.style.background = item.stock === 'low-stock' ? '#fff8e1' : 'none'}
                          >
                            <span>⚠️</span> Low Stock
                          </button>
                          <button
                            onClick={() => handleStockUpdate(item, 'out-of-stock')}
                            style={{
                              width: '100%',
                              padding: '8px 16px',
                              border: 'none',
                              background: item.stock === 'out-of-stock' ? '#ffebee' : 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              color: item.stock === 'out-of-stock' ? '#f44336' : '#666',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = item.stock === 'out-of-stock' ? '#ffebee' : '#f5f5f5'}
                            onMouseOut={(e) => e.currentTarget.style.background = item.stock === 'out-of-stock' ? '#ffebee' : 'none'}
                          >
                            <span>❌</span> Out of Stock
                          </button>
                        </div>
                        
                        <button
                          onClick={() => handleDeleteItem(item)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            color: '#f44336',
                            borderRadius: '0 0 12px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#ffebee'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <span>🗑️</span> Delete Item
                        </button>
                      </div>
                    )}



                    {item.image && 
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        style={{ 
                          width: 60, 
                          height: 60, 
                          borderRadius: 10, 
                          objectFit: 'cover',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                          opacity: item.stock === 'out-of-stock' ? 0.6 : 1
                        }} 
                      />
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: '1rem', 
                        color: item.stock === 'out-of-stock' ? '#999' : '#222',
                        marginBottom: '3px'
                      }}>
                        {item.name}
                      </div>
                      <div style={{ 
                        fontSize: '1rem', 
                        color: item.stock === 'out-of-stock' ? '#999' : '#007B7F',
                        fontWeight: 700, 
                        marginBottom: '4px'
                      }}>
                        {item.currency} {item.price}
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#666',
                        display: 'flex',
                        gap: '10px',
                        opacity: item.stock === 'out-of-stock' ? 0.6 : 1
                      }}>
                        <span style={{ 
                          background: '#f0f0f0', 
                          padding: '2px 8px', 
                          borderRadius: '12px'
                        }}>
                          {item.quality}
                        </span>
                        <span style={{ 
                          background: '#f0f0f0', 
                          padding: '2px 8px', 
                          borderRadius: '12px'
                        }}>
                          Qty: {item.quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Delivery Info Box */}
          {profile.deliveryType && (
            <div className="info-card delivery-info">
              <div className="info-card-icon">🚚</div>
              <div className="info-card-content">
                <div className="info-card-title">Delivery Method</div>
                <div className="info-card-value">{profile.deliveryType}</div>
              </div>
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

        {/* Edit Item Modal */}
        {showEditItemModal && editingItem && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #B8B8B8', padding: '2rem 1.5rem', minWidth: 320, maxWidth: '90vw' }}>
              <h3 style={{ marginBottom: 18, color: '#007B7F', fontWeight: 700, fontSize: '1.2rem' }}>Edit Item: {editingItem.name}</h3>
              <form onSubmit={handleUpdateItem}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Image (optional)</label>
                  <input type="file" accept="image/*" onChange={e => setEditItemImage(e.target.files[0])} />
                  {editingItem.image && !editItemImage && (
                    <div style={{ marginTop: 8 }}>
                      <img src={editingItem.image} alt="Current" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                      <small style={{ display: 'block', color: '#666', marginTop: 4 }}>Current image (upload new to replace)</small>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Item Name</label>
                  <input type="text" value={editItemName} onChange={e => setEditItemName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
                </div>
                <div style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Price</label>
                    <input type="number" value={editItemPrice} onChange={e => setEditItemPrice(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required min="0" step="0.01" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Currency</label>
                    <select value={editItemCurrency} onChange={e => setEditItemCurrency(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}>
                      <option value="GBP">GBP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="NGN">NGN</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                      <option value="ZAR">ZAR</option>
                      <option value="GHS">GHS</option>
                      <option value="KES">KES</option>
                      <option value="XOF">XOF</option>
                      <option value="XAF">XAF</option>
                      <option value="INR">INR</option>
                      <option value="JPY">JPY</option>
                      <option value="CNY">CNY</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Quality</label>
                  <select value={editItemQuality} onChange={e => setEditItemQuality(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                    <option value="">Select Quality</option>
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Very Good">Very Good</option>
                    <option value="Good">Good</option>
                    <option value="Acceptable">Acceptable</option>
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Quantity Available</label>
                  <input type="number" value={editItemQuantity} onChange={e => setEditItemQuantity(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required min="0" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Stock Status</label>
                  <select value={editItemStock} onChange={e => setEditItemStock(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }}>
                    <option value="in-stock">✅ In Stock</option>
                    <option value="low-stock">⚠️ Low Stock</option>
                    <option value="out-of-stock">❌ Out of Stock</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowEditItemModal(false);
                      setEditingItem(null);
                    }} 
                    style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#444', fontWeight: 500, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    style={{ background: '#007B7F', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
                  >
                    {loading ? 'Updating...' : 'Update Item'}
                  </button>
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
                  >
                    <option value="">Select origin</option>
                    <option value="African">African</option>
                    <option value="Caribbean">Caribbean</option>
                    <option value="African American">African American</option>
                    <option value="Black British">Black British</option>
                    <option value="Black Caribbean">Black Caribbean</option>
                    <option value="Black African">Black African</option>
                    <option value="Black British Caribbean">Black British Caribbean</option>
                    <option value="Black British African">Black British African</option>
                    <optgroup label="African Countries">
                      {africanCountries.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                    <optgroup label="Caribbean Islands">
                      {caribbeanIslands.map(c => <option key={c} value={c}>{c}</option>)}
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

                {/* Dynamic Social Media Links Section */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontWeight: 500, display: 'block' }}>Social Media Links (optional)</label>
                    <button
                      type="button"
                      onClick={addSocialLink}
                      style={{
                        background: '#007BFF',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: 30,
                        height: 30,
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Add social media link"
                    >
                      +
                    </button>
                  </div>
                  
                  {editSocialLinks.map((link, index) => (
                    <div key={link.id} style={{ 
                      border: '1px solid #E0E0E0', 
                      borderRadius: 8, 
                      padding: 12, 
                      marginBottom: 8,
                      backgroundColor: '#F9F9F9'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Social Link {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeSocialLink(link.id)}
                          style={{
                            background: '#DC3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Remove link"
                        >
                          ×
                        </button>
                      </div>
                      
                      <div style={{ marginBottom: 8 }}>
                        <select
                          value={link.platform}
                          onChange={e => updateSocialLink(link.id, 'platform', e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', border: '1px solid #B8B8B8', borderRadius: 4, fontSize: '0.9rem' }}
                        >
                          <option value="">Select platform</option>
                          <option value="Instagram">Instagram</option>
                          <option value="Facebook">Facebook</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="TikTok">TikTok</option>
                          <option value="Twitter">Twitter</option>
                          <option value="LinkedIn">LinkedIn</option>
                          <option value="YouTube">YouTube</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      
                      <input 
                        type="text" 
                        value={link.handle} 
                        onChange={e => updateSocialLink(link.id, 'handle', e.target.value)}
                        placeholder="@yourusername or your handle"
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #B8B8B8', borderRadius: 4, fontSize: '0.9rem' }}
                      />
                    </div>
                  ))}
                  
                  {editSocialLinks.length === 0 && (
                    <p style={{ color: '#888', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', margin: '12px 0' }}>
                      Click the + button to add social media links
                    </p>
                  )}
                </div>

                {/* Dynamic Website Links Section */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontWeight: 500, display: 'block' }}>Website Links (optional)</label>
                    <button
                      type="button"
                      onClick={addWebsiteLink}
                      style={{
                        background: '#28A745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: 30,
                        height: 30,
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Add website link"
                    >
                      +
                    </button>
                  </div>
                  
                  {editWebsiteLinks.map((link, index) => (
                    <div key={link.id} style={{ 
                      border: '1px solid #E0E0E0', 
                      borderRadius: 8, 
                      padding: 12, 
                      marginBottom: 8,
                      backgroundColor: '#F9F9F9'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Website {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeWebsiteLink(link.id)}
                          style={{
                            background: '#DC3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Remove link"
                        >
                          ×
                        </button>
                      </div>
                      
                      <div style={{ marginBottom: 8 }}>
                        <input 
                          type="text" 
                          value={link.name} 
                          onChange={e => updateWebsiteLink(link.id, 'name', e.target.value)}
                          placeholder="Website name (e.g., My Store, Online Shop)"
                          style={{ width: '100%', padding: '0.4rem', border: '1px solid #B8B8B8', borderRadius: 4, fontSize: '0.9rem' }}
                        />
                      </div>
                      
                      <input 
                        type="url" 
                        value={link.url} 
                        onChange={e => updateWebsiteLink(link.id, 'url', e.target.value)}
                        placeholder="https://yourwebsite.com"
                        style={{ width: '100%', padding: '0.4rem', border: '1px solid #B8B8B8', borderRadius: 4, fontSize: '0.9rem' }}
                      />
                    </div>
                  ))}
                  
                  {editWebsiteLinks.length === 0 && (
                    <p style={{ color: '#888', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', margin: '12px 0' }}>
                      Click the + button to add website links
                    </p>
                  )}
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
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)'
            }}
            onClick={(e) => {
              // Close when clicking the backdrop
              if (e.target === e.currentTarget) {
                setShowFollowersModal(false);
              }
            }}
          >
            <div style={{ 
              background: '#fff', 
              borderRadius: 20, 
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)', 
              padding: '1.5rem', 
              minWidth: 320, 
              maxWidth: '90vw',
              maxHeight: '80vh',
              width: '400px',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Header with title and close button */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <h3 style={{ 
                  margin: 0, 
                  color: '#007B7F', 
                  fontSize: '1.2rem',
                  fontWeight: '600' 
                }}>
                  Followers ({followersDetails.length})
                </h3>
                
                <button
                  onClick={() => setShowFollowersModal(false)}
                  style={{ 
                    background: '#f5f5f5', 
                    border: 'none', 
                    borderRadius: '50%', 
                    width: '36px', 
                    height: '36px', 
                    fontSize: '18px', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#ebebeb'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#f5f5f5'}
                >
                  ×
                </button>
              </div>
              
              {/* Content */}
              <div style={{ 
                overflowY: 'auto', 
                flex: 1, 
                padding: '0 5px'
              }}>
                {followersDetails.length === 0 ? (
                  <div style={{ 
                    color: '#888', 
                    padding: '40px 0', 
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '15px'
                  }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: '#f2f8f8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      color: '#007B7F',
                      boxShadow: '0 4px 12px rgba(0, 123, 127, 0.1)'
                    }}>
                      👥
                    </div>
                    <div>
                      <p style={{ margin: '0 0 5px 0', fontWeight: '600', fontSize: '1.1rem', color: '#555' }}>No followers yet</p>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#888' }}>Share your store to get followers!</p>
                    </div>
                  </div>
                ) : (
                  <ul style={{ 
                    listStyle: 'none', 
                    padding: 0, 
                    margin: 0
                  }}>
                    {followersDetails.map(f => (
                      <li key={f.uid} style={{ 
                        marginBottom: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '14px',
                        padding: '10px',
                        borderRadius: '12px',
                        transition: 'background-color 0.2s ease',
                        cursor: 'default',
                        hover: { backgroundColor: '#f9f9f9' }
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <img 
                          src={f.photoURL || 'https://via.placeholder.com/40'} 
                          alt={f.name || 'User'} 
                          style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '50%', 
                            objectFit: 'cover',
                            border: '2px solid #f0f0f0'
                          }} 
                        />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ 
                            fontWeight: 600, 
                            fontSize: '1rem' 
                          }}>
                            {f.name || f.email || 'Unknown User'}
                          </div>
                          {f.email && f.name && (
                            <div style={{ 
                              color: '#777', 
                              fontSize: '0.85rem' 
                            }}>
                              {f.email}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {/* Footer with dismiss button */}
              <div style={{
                marginTop: '20px',
                paddingTop: '15px',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => setShowFollowersModal(false)}
                  style={{
                    background: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#00696d'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007B7F'}
                >
                  Close
                </button>
              </div>
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