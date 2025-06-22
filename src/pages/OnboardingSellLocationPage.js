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
  const [marketName, setMarketName] = useState('');
  const [marketLocation, setMarketLocation] = useState('');
  const [marketLocationSuggestions, setMarketLocationSuggestions] = useState([]);
  const [businessId, setBusinessId] = useState('');
  const [certificate, setCertificate] = useState(null);
  const [foodHygiene, setFoodHygiene] = useState(null);
  const [marketStallLicence, setMarketStallLicence] = useState(null);
  const [origin, setOrigin] = useState('');
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
    setStoreLocationError('');
    if (value.length > 2) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}`);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        setStoreLocationSuggestions(data);
      } catch (err) {
        setStoreLocationSuggestions([]);
        setStoreLocationError('Could not fetch location suggestions.');
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
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}`);
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
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}`);
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

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: '#007B7F', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>&larr; Back</button>
      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8', textAlign: 'center', position: 'relative' }}>
        <h2 style={{ color: '#1C1C1C', marginBottom: '2rem' }}>Where would you sell these products?</h2>
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
          <form style={{ textAlign: 'left' }} onSubmit={e => { e.preventDefault(); navigate('/create-shop', { state: { storeName, storeLocation, businessId, certificate, origin, category } }); }}>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Store Name</label>
              <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Store Location</label>
              <input type="text" value={storeLocation} onChange={handleStoreLocationChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required autoComplete="off" />
              {storeLocationError && <div style={{ color: '#D92D20', fontSize: '0.9rem', marginTop: 4 }}>{storeLocationError}</div>}
              {storeLocationSuggestions.length > 0 && (
                <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #B8B8B8', borderRadius: 4, zIndex: 10, listStyle: 'none', margin: 0, padding: 0, maxHeight: 150, overflowY: 'auto' }}>
                  {storeLocationSuggestions.map((s) => (
                    <li key={s.place_id} style={{ padding: '0.5rem', cursor: 'pointer' }} onClick={() => { setStoreLocation(s.display_name); setStoreLocationSuggestions([]); }}>{s.display_name}</li>
                  ))}
                </ul>
              )}
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
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Type of Origin</label>
              <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select country/island</option>
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
        ) : showMarketForm ? (
          <form style={{ textAlign: 'left' }} onSubmit={e => { e.preventDefault(); navigate('/create-shop', { state: { marketName, marketLocation, foodHygiene, marketStallLicence, origin, category } }); }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Market Name</label>
              <input type="text" value={marketName} onChange={e => setMarketName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Market Location</label>
              <input type="text" value={marketLocation} onChange={handleMarketLocationChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required autoComplete="off" />
              {marketLocationError && <div style={{ color: '#D92D20', fontSize: '0.9rem', marginTop: 4 }}>{marketLocationError}</div>}
              {marketLocationSuggestions.length > 0 && (
                <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #B8B8B8', borderRadius: 4, zIndex: 10, listStyle: 'none', margin: 0, padding: 0, maxHeight: 150, overflowY: 'auto' }}>
                  {marketLocationSuggestions.map((s) => (
                    <li key={s.place_id} style={{ padding: '0.5rem', cursor: 'pointer' }} onClick={() => { setMarketLocation(s.display_name); setMarketLocationSuggestions([]); }}>{s.display_name}</li>
                  ))}
                </ul>
              )}
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
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Type of Origin</label>
              <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select country/island</option>
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
          <form style={{ textAlign: 'left' }} onSubmit={e => { e.preventDefault(); navigate('/create-shop', { state: { onlineName, platform, socialHandle, hasWebsite, websiteLink, onlineLicence, onlineLocation, origin, category } }); }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Name</label>
              <input type="text" value={onlineName} onChange={e => setOnlineName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Where are you selling?</label>
              <select value={platform} onChange={e => { setPlatform(e.target.value); setHasWebsite(''); setWebsiteLink(''); }} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select platform</option>
                {socialPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {platform && platform !== 'Own Website' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Social Media Handle</label>
                <input type="text" value={socialHandle} onChange={e => setSocialHandle(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
              </div>
            )}
            {platform === 'Own Website' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Do you have an active website?</label>
                <select value={hasWebsite} onChange={e => setHasWebsite(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            )}
            {platform === 'Own Website' && hasWebsite === 'yes' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Website Link</label>
                <input type="url" value={websiteLink} onChange={e => setWebsiteLink(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Relevant Licence (optional)</label>
              <input type="file" onChange={e => setOnlineLicence(e.target.files[0])} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Location (optional)</label>
              <input type="text" value={onlineLocation} onChange={handleOnlineLocationChange} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} autoComplete="off" />
              {onlineLocationError && <div style={{ color: '#D92D20', fontSize: '0.9rem', marginTop: 4 }}>{onlineLocationError}</div>}
              {onlineLocationSuggestions.length > 0 && (
                <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #B8B8B8', borderRadius: 4, zIndex: 10, listStyle: 'none', margin: 0, padding: 0, maxHeight: 150, overflowY: 'auto' }}>
                  {onlineLocationSuggestions.map((s) => (
                    <li key={s.place_id} style={{ padding: '0.5rem', cursor: 'pointer' }} onClick={() => { setOnlineLocation(s.display_name); setOnlineLocationSuggestions([]); }}>{s.display_name}</li>
                  ))}
                </ul>
              )}
              <div style={{ color: '#B8B8B8', fontSize: '0.9rem', marginTop: 4 }}>
                (You will still be asked if you want your shop to be noticed on the app)
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Type of Origin</label>
              <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required>
                <option value="">Select country/island</option>
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