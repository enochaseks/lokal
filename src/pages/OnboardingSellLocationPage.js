import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const locations = [
  'In a store',
  'Market',
  'Online',
];

const africanCountries = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Egypt', 'Ethiopia', 'Morocco', 'Uganda', 'Tanzania', 'Algeria', 'Angola', 'Cameroon', 'Ivory Coast', 'Senegal', 'Zimbabwe', 'Zambia', 'Botswana', 'Namibia', 'Rwanda', 'Burundi', 'Mali', 'Malawi', 'Mozambique', 'Tunisia', 'Libya', 'Sudan', 'Somalia', 'Chad', 'Niger', 'Benin', 'Burkina Faso', 'Guinea', 'Sierra Leone', 'Liberia', 'Togo', 'Central African Republic', 'Congo', 'Gabon', 'Gambia', 'Lesotho', 'Mauritius', 'Swaziland', 'Djibouti', 'Eritrea', 'Seychelles', 'Comoros', 'Cape Verde', 'Sao Tome and Principe',
];
const caribbeanIslands = [
  'Jamaica', 'Trinidad and Tobago', 'Barbados', 'Bahamas', 'Saint Lucia', 'Grenada', 'Saint Vincent and the Grenadines', 'Antigua and Barbuda', 'Dominica', 'Saint Kitts and Nevis', 'Cuba', 'Haiti', 'Dominican Republic', 'Puerto Rico', 'Aruba', 'Curacao', 'Saint Martin', 'Saint Barthelemy', 'Anguilla', 'Montserrat', 'British Virgin Islands', 'US Virgin Islands', 'Cayman Islands', 'Turks and Caicos', 'Guadeloupe', 'Martinique', 'Saint Pierre and Miquelon',
];

const commonCountries = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'India', 'China', 'Japan', 'Brazil', 'Mexico', 'Turkey', 'UAE', 'Saudi Arabia', 'Ireland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland', 'Belgium', 'Austria', 'New Zealand', 'Singapore', 'Malaysia', 'South Korea', 'Russia', 'Poland', 'Portugal', 'Greece', 'Israel', 'Egypt', 'South Africa', 'Nigeria', 'Ghana', 'Kenya', 'Jamaica', 'Trinidad and Tobago'
];

// Helper to map country name to country code for Nominatim
const countryNameToCode = {
  'Nigeria': 'ng', 'Ghana': 'gh', 'Kenya': 'ke', 'South Africa': 'za', 'Egypt': 'eg', 'Ethiopia': 'et', 'Morocco': 'ma', 'Uganda': 'ug', 'Tanzania': 'tz', 'Algeria': 'dz', 'Angola': 'ao', 'Cameroon': 'cm', 'Ivory Coast': 'ci', 'Senegal': 'sn', 'Zimbabwe': 'zw', 'Zambia': 'zm', 'Botswana': 'bw', 'Namibia': 'na', 'Rwanda': 'rw', 'Burundi': 'bi', 'Mali': 'ml', 'Malawi': 'mw', 'Mozambique': 'mz', 'Tunisia': 'tn', 'Libya': 'ly', 'Sudan': 'sd', 'Somalia': 'so', 'Chad': 'td', 'Niger': 'ne', 'Benin': 'bj', 'Burkina Faso': 'bf', 'Guinea': 'gn', 'Sierra Leone': 'sl', 'Liberia': 'lr', 'Togo': 'tg', 'Central African Republic': 'cf', 'Congo': 'cg', 'Gabon': 'ga', 'Gambia': 'gm', 'Lesotho': 'ls', 'Mauritius': 'mu', 'Swaziland': 'sz', 'Djibouti': 'dj', 'Eritrea': 'er', 'Seychelles': 'sc', 'Comoros': 'km', 'Cape Verde': 'cv', 'Sao Tome and Principe': 'st',
  'Jamaica': 'jm', 'Trinidad and Tobago': 'tt', 'Barbados': 'bb', 'Bahamas': 'bs', 'Saint Lucia': 'lc', 'Grenada': 'gd', 'Saint Vincent and the Grenadines': 'vc', 'Antigua and Barbuda': 'ag', 'Dominica': 'dm', 'Saint Kitts and Nevis': 'kn', 'Cuba': 'cu', 'Haiti': 'ht', 'Dominican Republic': 'do', 'Puerto Rico': 'pr', 'Aruba': 'aw', 'Curacao': 'cw', 'Saint Martin': 'mf', 'Saint Barthelemy': 'bl', 'Anguilla': 'ai', 'Montserrat': 'ms', 'British Virgin Islands': 'vg', 'US Virgin Islands': 'vi', 'Cayman Islands': 'ky', 'Turks and Caicos': 'tc', 'Guadeloupe': 'gp', 'Martinique': 'mq', 'Saint Pierre and Miquelon': 'pm',
};

function OnboardingSellLocationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const category = location.state?.category || '';
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [showMarketForm, setShowMarketForm] = useState(false);
  const [showOnlineForm, setShowOnlineForm] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [storeLocationSuggestions, setStoreLocationSuggestions] = useState([]);
  const [selectedStoreLocation, setSelectedStoreLocation] = useState(null);
  const [marketName, setMarketName] = useState('');
  const [marketLocation, setMarketLocation] = useState('');
  const [marketLocationSuggestions, setMarketLocationSuggestions] = useState([]);
  const [businessId, setBusinessId] = useState('');
  const [certificate, setCertificate] = useState(null);
  const [foodHygiene, setFoodHygiene] = useState(null);
  const [marketStallLicence, setMarketStallLicence] = useState(null);
  const [origin, setOrigin] = useState('');
  const [country, setCountry] = useState('');
  const [storeLocationError, setStoreLocationError] = useState('');
  const [marketLocationError, setMarketLocationError] = useState('');
  const [onlineName, setOnlineName] = useState('');
  const [platform, setPlatform] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const [onlineLicence, setOnlineLicence] = useState(null);
  const [onlineLocation, setOnlineLocation] = useState('');
  const [onlineLocationSuggestions, setOnlineLocationSuggestions] = useState([]);
  const [onlineLocationError, setOnlineLocationError] = useState('');
  const [hasWebsite, setHasWebsite] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [deliveryType, setDeliveryType] = useState('');
  const [formError, setFormError] = useState('');
  const [sellsAlcohol, setSellsAlcohol] = useState('');
  const [alcoholLicense, setAlcoholLicense] = useState(null);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [zip, setZip] = useState('');
  const [marketStreet, setMarketStreet] = useState('');
  const [marketCity, setMarketCity] = useState('');
  const [marketState, setMarketState] = useState('');
  const [marketZip, setMarketZip] = useState('');
  const [onlineStreet, setOnlineStreet] = useState('');
  const [onlineCity, setOnlineCity] = useState('');
  const [onlineState, setOnlineState] = useState('');
  const [onlineZip, setOnlineZip] = useState('');

  const socialPlatforms = [
    'Instagram', 'Facebook', 'WhatsApp', 'TikTok', 'Twitter', 'Other Social Media', 'Own Website'
  ];

  const handleLocationClick = (loc) => {
    if (loc === 'In a store') {
      setShowStoreForm(true);
    } else if (loc === 'Market') {
      setShowMarketForm(true);
    } else if (loc === 'Online') {
      setShowOnlineForm(true);
    }
  };

  // Autocomplete for store location
  const handleStoreLocationChange = async (e) => {
    const value = e.target.value;
    setStoreLocation(value);
    setSelectedStoreLocation(null);
    if (value.length > 2) {
      try {
        // Use origin to get country code
        const countryCode = countryNameToCode[origin] || '';
        const countryParam = countryCode ? `&countrycodes=${countryCode}` : '';
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}${countryParam}`);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        setStoreLocationSuggestions(data);
      } catch (err) {
        setStoreLocationSuggestions([]);
      }
    } else {
      setStoreLocationSuggestions([]);
    }
  };

  // Autocomplete for market location
  const handleMarketLocationChange = async (e) => {
    const value = e.target.value;
    setMarketLocation(value);
    setMarketLocationError('');
    if (value.length > 2) {
      try {
        const countryCode = countryNameToCode[origin] || '';
        const countryParam = countryCode ? `&countrycodes=${countryCode}` : '';
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}${countryParam}`);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        setMarketLocationSuggestions(data);
      } catch (err) {
        setMarketLocationSuggestions([]);
        setMarketLocationError('Could not fetch location suggestions.');
      }
    } else {
      setMarketLocationSuggestions([]);
    }
  };

  // Autocomplete for online location
  const handleOnlineLocationChange = async (e) => {
    const value = e.target.value;
    setOnlineLocation(value);
    setOnlineLocationError('');
    if (value.length > 2) {
      try {
        const countryCode = countryNameToCode[origin] || '';
        const countryParam = countryCode ? `&countrycodes=${countryCode}` : '';
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}${countryParam}`);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        setOnlineLocationSuggestions(data);
      } catch (err) {
        setOnlineLocationSuggestions([]);
        setOnlineLocationError('Could not fetch location suggestions.');
      }
    } else {
      setOnlineLocationSuggestions([]);
    }
  };

  // Add a helper to get the heading based on which form is shown
  function getHeading(showStoreForm, showMarketForm, showOnlineForm) {
    if (showStoreForm) return 'Tell us about Your Store?';
    if (showMarketForm) return 'Tell us about Your Market?';
    if (showOnlineForm) return 'Tell us about Your Online Shop?';
    return 'Where would you sell these products?';
  }

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#007B7F', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>&larr; Back</button>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center', position: 'relative' }}>
        <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>{getHeading(showStoreForm, showMarketForm, showOnlineForm)}</h2>
        {!showStoreForm && !showMarketForm && !showOnlineForm ? (
          locations.map((loc) => (
            <button
              key={loc}
              style={{ width: '100%', background: '#F5A623', color: '#fff', padding: '1rem', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', cursor: 'pointer' }}
              onClick={() => handleLocationClick(loc)}
            >
              {loc}
            </button>
          ))
        ) : showStoreForm ? (
          <form style={{ textAlign: 'left' }} onSubmit={async e => {
            e.preventDefault();
            if (deliveryType === 'Delivery' && (!street.trim() || !city.trim() || !zip.trim())) {
              setFormError('Full address is required for delivery.');
              return;
            }
            if (sellsAlcohol === 'yes' && !alcoholLicense) {
              setFormError('You must upload proof of license to sell alcohol.');
              return;
            }
            setFormError('');
            const country = origin || '';
            const fullAddress = `${street}, ${city}, ${stateRegion}, ${zip}, ${country}`;
            let lat = null, lon = null;
            try {
              const countryCode = countryNameToCode[origin] || '';
              const countryParam = countryCode ? `&countrycodes=${countryCode}` : '';
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}${countryParam}`);
              if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                  lat = data[0].lat;
                  lon = data[0].lon;
                }
              }
            } catch {}
            const { getAuth } = await import('firebase/auth');
            const { doc, updateDoc, getDoc, setDoc } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
              const userRef = doc(db, 'users', user.uid);
              const userSnap = await getDoc(userRef);
              if (!userSnap.exists()) {
                await setDoc(userRef, {
                  email: user.email,
                  createdAt: new Date().toISOString(),
                  onboardingStep: 'create-shop',
                  storeName: storeName,
                  storeLocation: fullAddress,
                  businessId,
                  certificate,
                  origin: origin,
                  category,
                  deliveryType,
                  latitude: lat,
                  longitude: lon,
                });
              } else {
                await updateDoc(userRef, {
                  onboardingStep: 'create-shop',
                  storeName: storeName,
                  storeLocation: fullAddress,
                  businessId,
                  certificate,
                  origin: origin,
                  category,
                  deliveryType,
                  latitude: lat,
                  longitude: lon,
                });
              }
            }
            console.log('STORE FORM SUBMIT', { storeName, fullAddress, origin, category, deliveryType, lat, lon });
            navigate('/create-shop', { state: { storeName, storeLocation: fullAddress, businessId, certificate, origin, category, deliveryType, latitude: lat, longitude: lon } });
          }}>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Store Name</label>
              <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Street Address</label>
              <input type="text" value={street} onChange={e => setStreet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>City</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>State/Province/Region</label>
              <input type="text" value={stateRegion} onChange={e => setStateRegion(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Zip/Postal Code</label>
              <input type="text" value={zip} onChange={e => setZip(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Country</label>
              <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select country</option>
                <optgroup label="Common Countries">
                  {commonCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="African Countries">
                  {africanCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Caribbean Islands">
                  {caribbeanIslands.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Business ID (optional)</label>
              <input type="text" value={businessId} onChange={e => setBusinessId(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Relevant Certificate (optional)</label>
              <input type="file" onChange={e => setCertificate(e.target.files[0])} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>What Origin is Your Store/Business?</label>
              <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select origin</option>
                <option value="African">African</option>
                <option value="Caribbean">Caribbean</option>
                <optgroup label="African Countries">
                  {africanCountries.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Caribbean Islands">
                  {caribbeanIslands.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Delivery Type</label>
              <select value={deliveryType} onChange={e => setDeliveryType(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select</option>
                <option value="Delivery">Delivery</option>
                <option value="Collection">Collection</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Do you sell alcohol in your store/market/online?</label>
              <select value={sellsAlcohol} onChange={e => setSellsAlcohol(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            {sellsAlcohol === 'yes' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Upload proof of license/permission to sell alcohol (required)</label>
                <input type="file" accept="image/*,application/pdf" onChange={e => setAlcoholLicense(e.target.files[0])} style={{ width: '100%' }} required />
              </div>
            )}
            {formError && <div style={{ color: '#D92D20', marginBottom: 8 }}>{formError}</div>}
            <button type="submit" style={{ width: '100%', background: '#D92D20', color: '#fff', padding: '0.75rem', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: '1rem' }}>Continue</button>
          </form>
        ) : showMarketForm ? (
          <form style={{ textAlign: 'left' }} onSubmit={async e => {
            e.preventDefault();
            const country = origin || '';
            const fullAddress = `${marketStreet}, ${marketCity}, ${marketState}, ${marketZip}, ${country}`;
            let lat = null, lon = null;
            try {
              const countryCode = countryNameToCode[origin] || '';
              const countryParam = countryCode ? `&countrycodes=${countryCode}` : '';
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}${countryParam}`);
              if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                  lat = data[0].lat;
                  lon = data[0].lon;
                }
              }
            } catch {}
            const { getAuth } = await import('firebase/auth');
            const { doc, updateDoc, getDoc, setDoc } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
              const userRef = doc(db, 'users', user.uid);
              const userSnap = await getDoc(userRef);
              if (!userSnap.exists()) {
                await setDoc(userRef, {
                  email: user.email,
                  createdAt: new Date().toISOString(),
                  onboardingStep: 'create-shop',
                  storeName: marketName,
                  storeLocation: fullAddress,
                  foodHygiene,
                  marketStallLicence,
                  origin: origin,
                  category,
                  deliveryType,
                  latitude: lat,
                  longitude: lon,
                });
              } else {
                await updateDoc(userRef, {
                  onboardingStep: 'create-shop',
                  storeName: marketName,
                  storeLocation: fullAddress,
                  foodHygiene,
                  marketStallLicence,
                  origin: origin,
                  category,
                  deliveryType,
                  latitude: lat,
                  longitude: lon,
                });
              }
            }
            console.log('MARKET FORM SUBMIT', { marketName, fullAddress, origin, category, deliveryType, lat, lon });
            navigate('/create-shop', { state: { storeName: marketName, storeLocation: fullAddress, origin, category, deliveryType, latitude: lat, longitude: lon } });
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Market Name</label>
              <input type="text" value={marketName} onChange={e => setMarketName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Street Address</label>
              <input type="text" value={marketStreet} onChange={e => setMarketStreet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>City</label>
              <input type="text" value={marketCity} onChange={e => setMarketCity(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>State/Province/Region</label>
              <input type="text" value={marketState} onChange={e => setMarketState(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Zip/Postal Code</label>
              <input type="text" value={marketZip} onChange={e => setMarketZip(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Country</label>
              <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select country</option>
                <optgroup label="Common Countries">
                  {commonCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="African Countries">
                  {africanCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Caribbean Islands">
                  {caribbeanIslands.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Food Hygiene Certificate (mandatory)</label>
              <input type="file" onChange={e => setFoodHygiene(e.target.files[0])} style={{ width: '100%' }} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Market Stall Licence (mandatory)</label>
              <input type="file" onChange={e => setMarketStallLicence(e.target.files[0])} style={{ width: '100%' }} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>What Origin is Your Store/Business?</label>
              <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select origin</option>
                <option value="African">African</option>
                <option value="Caribbean">Caribbean</option>
                <optgroup label="African Countries">
                  {africanCountries.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Caribbean Islands">
                  {caribbeanIslands.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            <button type="submit" style={{ width: '100%', background: '#D92D20', color: '#fff', padding: '0.75rem', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: '1rem' }}>Continue</button>
          </form>
        ) : (
          <form style={{ textAlign: 'left' }} onSubmit={async e => {
            e.preventDefault();
            const country = origin || '';
            const fullAddress = `${onlineStreet}, ${onlineCity}, ${onlineState}, ${onlineZip}, ${country}`;
            let lat = null, lon = null;
            try {
              const countryCode = countryNameToCode[origin] || '';
              const countryParam = countryCode ? `&countrycodes=${countryCode}` : '';
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}${countryParam}`);
              if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                  lat = data[0].lat;
                  lon = data[0].lon;
                }
              }
            } catch {}
            const { getAuth } = await import('firebase/auth');
            const { doc, updateDoc, getDoc, setDoc } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
              const userRef = doc(db, 'users', user.uid);
              const userSnap = await getDoc(userRef);
              if (!userSnap.exists()) {
                await setDoc(userRef, {
                  email: user.email,
                  createdAt: new Date().toISOString(),
                  onboardingStep: 'create-shop',
                  storeName: onlineName,
                  storeLocation: fullAddress,
                  platform,
                  socialHandle,
                  hasWebsite,
                  websiteLink,
                  onlineLicence,
                  origin: origin,
                  category,
                  deliveryType,
                  latitude: lat,
                  longitude: lon,
                });
              } else {
                await updateDoc(userRef, {
                  onboardingStep: 'create-shop',
                  storeName: onlineName,
                  storeLocation: fullAddress,
                  platform,
                  socialHandle,
                  hasWebsite,
                  websiteLink,
                  onlineLicence,
                  origin: origin,
                  category,
                  deliveryType,
                  latitude: lat,
                  longitude: lon,
                });
              }
            }
            console.log('ONLINE FORM SUBMIT', { onlineName, fullAddress, origin, category, deliveryType, lat, lon });
            navigate('/create-shop', { state: { storeName: onlineName, storeLocation: fullAddress, origin, category, deliveryType, latitude: lat, longitude: lon } });
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Name</label>
              <input type="text" value={onlineName} onChange={e => setOnlineName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Street Address</label>
              <input type="text" value={onlineStreet} onChange={e => setOnlineStreet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>City</label>
              <input type="text" value={onlineCity} onChange={e => setOnlineCity(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>State/Province/Region</label>
              <input type="text" value={onlineState} onChange={e => setOnlineState(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Zip/Postal Code</label>
              <input type="text" value={onlineZip} onChange={e => setOnlineZip(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Country</label>
              <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select country</option>
                <optgroup label="Common Countries">
                  {commonCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="African Countries">
                  {africanCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Caribbean Islands">
                  {caribbeanIslands.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Relevant Licence (optional)</label>
              <input type="file" onChange={e => setOnlineLicence(e.target.files[0])} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>What Origin is Your Store/Business?</label>
              <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select origin</option>
                <option value="African">African</option>
                <option value="Caribbean">Caribbean</option>
                <optgroup label="African Countries">
                  {africanCountries.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Caribbean Islands">
                  {caribbeanIslands.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            <button type="submit" style={{ width: '100%', background: '#D92D20', color: '#fff', padding: '0.75rem', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: '1rem' }}>Continue</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default OnboardingSellLocationPage; 