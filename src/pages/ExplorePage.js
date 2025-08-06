import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const responsiveStyles = `
@media (max-width: 768px) {
  .explore-controls {
    flex-direction: row !important;
    align-items: center !important;
    gap: 0.5rem !important;
  }
  .explore-bar {
    flex-direction: row !important;
    border-radius: 16px !important;
    width: 100%;
    max-width: 900px;
  }
  .explore-dropdowns {
    display: none;
  }
  .explore-bar.mobile .explore-dropdown-toggle {
    display: block !important;
  }
  .explore-bar.mobile .explore-dropdowns {
    display: none;
  }
  .explore-bar.mobile.show-dropdowns .explore-dropdowns {
    display: flex !important;
    flex-direction: column;
    width: 100%;
    background: #fff;
    border: 2px solid #007B7F;
    border-radius: 0 0 16px 16px;
    margin-top: -2px;
    z-index: 10;
    position: absolute;
    left: 0;
    top: 100%;
  }
}
@media (min-width: 769px) {
  .explore-bar .explore-dropdown-toggle {
    display: none !important;
  }
  .explore-bar .explore-dropdowns {
    display: flex !important;
    flex-direction: row;
    position: static;
    background: none;
    border: none;
    border-radius: 0;
    margin-top: 0;
  }
}
`;

function isStoreOpen(opening, closing) {
  if (!opening || !closing) return false;
  const now = new Date();
  const [openH, openM] = opening.split(':').map(Number);
  const [closeH, closeM] = closing.split(':').map(Number);
  const openDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openH, openM);
  const closeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeH, closeM);
  return now >= openDate && now <= closeDate;
}

const categories = [
  'Foods & Goods',
  'Meat & Poultry',
  'Wholesale',
  'Beauty & Hair',
];

// Add Haversine distance function
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

function ExplorePage() {
  const [userLocation, setUserLocation] = useState(null);
  const [city, setCity] = useState('');
  const [showDropdowns, setShowDropdowns] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [shops, setShops] = useState([]);
  const [ratings, setRatings] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterBy, setFilterBy] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchRadius, setSearchRadius] = useState(30);
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState('');
  const [userCountry, setUserCountry] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [locationDetected, setLocationDetected] = useState(false);

  // Fix the useEffect to properly set currentUser
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data());
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Separate location detection useEffect that only runs once when profile is first loaded
  useEffect(() => {
    if (locationDetected) return; // Don't run if location already detected

    async function setInitialLocation() {
      try {
        // If profile location exists, geocode it
        if (profile && profile.location) {
          console.log('Using profile location:', profile.location);
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(profile.location)}`);
          const data = await res.json();
          if (data && data.length > 0) {
            setUserLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
            const detectedCity = data[0].address?.city ||
              data[0].address?.town ||
              data[0].address?.village ||
              data[0].address?.suburb ||
              'Unknown City';
            setCity(detectedCity);
            setUserCountry(data[0].address?.country || '');
            setLocationDetected(true);
            return;
          }
        }
        
        // Fallback to browser geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setUserLocation(coords);
              
              try {
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`
                );
                const data = await res.json();
                const detectedCity = data.address?.city ||
                  data.address?.town ||
                  data.address?.village ||
                  data.address?.suburb ||
                  'Unknown City';
                setCity(detectedCity);
                setUserCountry(data.address?.country || '');
              } catch (error) {
                console.error('Error reverse geocoding:', error);
                setCity('Unknown City');
              }
              setLocationDetected(true);
            },
            (error) => {
              console.error('Geolocation error:', error);
              setCity('Location unavailable');
              setLocationDetected(true);
            },
            {
              timeout: 10000,
              enableHighAccuracy: true,
              maximumAge: 300000 // 5 minutes cache
            }
          );
        } else {
          setCity('Geolocation not supported');
          setLocationDetected(true);
        }
      } catch (error) {
        console.error('Location detection error:', error);
        setCity('Location error');
        setLocationDetected(true);
      }
    }

    // Only run location detection when we have a user (logged in) and haven't detected location yet
    if (currentUser !== null) {
      setInitialLocation();
    }
  }, [profile, currentUser, locationDetected]);

  // Handle window resize separately
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    let q;
    if (selectedCategory) {
      q = query(
        collection(db, 'stores'),
        where('live', '==', true),
        where('category', '==', selectedCategory)
      );
    } else {
      q = query(
        collection(db, 'stores'),
        where('live', '==', true)
      );
    }
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setShops(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [selectedCategory]);

  useEffect(() => {
    // Fetch ratings for all shops
    const fetchRatings = async () => {
      const ratingsObj = {};
      for (const shop of shops) {
        const reviewsSnap = await getDocs(collection(db, 'stores', shop.id, 'reviews'));
        const reviews = reviewsSnap.docs.map(doc => doc.data());
        const count = reviews.length;
        const avg = count ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / count).toFixed(1) : '0.0';
        ratingsObj[shop.id] = { avg, count };
      }
      setRatings(ratingsObj);
    };
    if (shops.length > 0) fetchRatings();
  }, [shops]);

  useEffect(() => {
    const checkOnboarding = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const onboardingStep = userDoc.data().onboardingStep;
        if (onboardingStep && onboardingStep !== 'complete') {
          navigate('/' + onboardingStep);
        }
      }
    };
    checkOnboarding();
  }, [navigate]);

  // Only filter by distance from user location
  let displayedShops = [...shops];

  // Search filter
  if (searchTerm.trim() !== '') {
    const term = searchTerm.trim().toLowerCase();
    displayedShops = displayedShops.filter(shop => {
      const name = (shop.storeName || '').toLowerCase();
      const location = (shop.storeLocation || '').toLowerCase();
      const postCode = (shop.postCode || '').toLowerCase();
      return name.includes(term) || location.includes(term) || postCode.includes(term);
    });
  }

  // Filter By
  if (filterBy === 'Open Now') {
    displayedShops = displayedShops.filter(shop => isStoreOpen(shop.openingTime, shop.closingTime));
  } else if (filterBy === 'Top Rated') {
    displayedShops
      .map(shop => ({ ...shop, avgRating: parseFloat(ratings[shop.id]?.avg || 0), ratingCount: ratings[shop.id]?.count || 0 }))
      .filter(shop => shop.ratingCount >= 10)
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 5);
  }

  // Sort By
  if (sortBy === 'Newest') {
    displayedShops = displayedShops.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sortBy === 'Oldest') {
    displayedShops = displayedShops.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sortBy === 'Rating') {
    displayedShops = displayedShops
      .map(shop => ({ ...shop, avgRating: parseFloat(ratings[shop.id]?.avg || 0), ratingCount: ratings[shop.id]?.count || 0 }))
      .filter(shop => shop.ratingCount >= 10)
      .sort((a, b) => b.avgRating - a.avgRating);
  }

  // Filter displayedShops by selectedCity
  if (selectedCity) {
    displayedShops = displayedShops.filter(shop =>
      (shop.city && shop.city === selectedCity) ||
      (shop.storeLocation && shop.storeLocation.includes(selectedCity))
    );
  }

  // FINAL: Filter by distance (radius) LAST
  const filteredShops = displayedShops.filter(shop => {
    if (!shop.latitude || !shop.longitude || !userLocation) return false;
    const distance = getDistanceFromLatLonInKm(
      Number(userLocation.lat), Number(userLocation.lng),
      Number(shop.latitude), Number(shop.longitude)
    );
    return distance <= searchRadius;
  });

  // Define allCities after shops is set and before render logic
  const allCities = Array.from(new Set(filteredShops
    .map(shop => {
      if (shop.city) return shop.city;
      if (shop.storeLocation) {
        const parts = shop.storeLocation.split(',');
        return parts.length > 1 ? parts[1].trim() : '';
      }
      return '';
    })
  )).filter(Boolean);

  // Function to handle store click and add to viewed stores
  const handleStoreClick = (storeId) => {
    if (currentUser) {
      // Get existing viewed stores from localStorage
      const viewedKey = `viewedStores_${currentUser.uid}`;
      const existingViewed = JSON.parse(localStorage.getItem(viewedKey) || '[]');
      
      // Remove store if it already exists (to move it to front)
      const filteredViewed = existingViewed.filter(id => id !== storeId);
      
      // Add store to beginning of array
      const updatedViewed = [storeId, ...filteredViewed];
      
      // Keep only last 20 viewed stores
      const limitedViewed = updatedViewed.slice(0, 20);
      
      // Save back to localStorage
      localStorage.setItem(viewedKey, JSON.stringify(limitedViewed));
      
      console.log('Saved viewed store:', storeId, 'for user:', currentUser.uid); // Debug log
    }
    
    // Navigate to store page
    navigate(`/store-preview/${storeId}`);
  };

  // Add function to refresh location
  const refreshLocation = () => {
    setLocationDetected(false);
    setCity('Detecting city...');
    setUserLocation(null);
    
    // Force location detection to run again
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`
            );
            const data = await res.json();
            const detectedCity = data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.suburb ||
              'Unknown City';
            setCity(detectedCity);
            setUserCountry(data.address?.country || '');
          } catch (error) {
            console.error('Error reverse geocoding:', error);
            setCity('Unknown City');
          }
          setLocationDetected(true);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setCity('Location unavailable');
          setLocationDetected(true);
        },
        {
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 0 // Don't use cached location
        }
      );
    } else {
      setCity('Geolocation not supported');
      setLocationDetected(true);
    }
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <style>{responsiveStyles}</style>
      <Navbar />
      <div className="explore-controls" style={{ display: 'flex', alignItems: 'center', padding: '1rem', gap: '1rem', background: '#F9F5EE', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, marginRight: '1rem' }}>
          <span 
            onClick={refreshLocation}
            style={{ 
              fontSize: '1rem', 
              marginRight: '0.3rem', 
              cursor: 'pointer',
              transition: 'transform 0.2s ease',
              userSelect: 'none'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
            }}
            title="Click to refresh location"
            aria-label="Refresh location"
          >
            📍
          </span>
          <span style={{ fontSize: '1rem', color: '#1C1C1C' }}>
            {city || (locationDetected ? 'Location unavailable' : 'Detecting city...')}
          </span>
        </div>
        <div className={`explore-bar${isMobile ? ' mobile' : ''}${showDropdowns ? ' show-dropdowns' : ''}`} style={{ display: 'flex', background: '#fff', border: '2px solid #007B7F', borderRadius: '16px', overflow: 'visible', width: '100%', maxWidth: 900, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              border: 'none',
              outline: 'none',
              color: '#1C1C1C',
              background: 'transparent',
              borderRight: isMobile ? 'none' : '1px solid #007B7F',
              borderRadius: '0',
            }}
            onFocus={e => (e.target.style.background = '#F9F5EE')}
            onBlur={e => (e.target.style.background = 'transparent')}
          />
          <button
            type="button"
            className="explore-dropdown-toggle"
            style={{
              display: isMobile ? 'block' : 'none',
              background: 'none',
              border: 'none',
              padding: '0 1rem',
              cursor: 'pointer',
              fontSize: '1.5rem',
              color: '#007B7F',
              outline: 'none',
            }}
            onClick={() => setShowDropdowns((prev) => !prev)}
            aria-label="Show filters"
          >
            ▼
          </button>
          <div className="explore-dropdowns" style={{ display: isMobile ? (showDropdowns ? 'flex' : 'none') : 'flex', flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto', background: isMobile ? '#fff' : 'none', position: isMobile ? 'absolute' : 'static', left: 0, top: '100%', zIndex: 10, border: isMobile ? '2px solid #007B7F' : 'none', borderRadius: isMobile ? '0 0 16px 16px' : '0', marginTop: isMobile ? '-2px' : '0' }}>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ padding: '0.5rem 1rem', fontSize: '1rem', border: 'none', color: '#1C1C1C', background: 'transparent', borderRight: isMobile ? 'none' : '1px solid #007B7F', borderRadius: '0' }}
            >
              <option value="">Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filterBy}
              onChange={e => setFilterBy(e.target.value)}
              style={{ padding: '0.5rem 1rem', fontSize: '1rem', border: 'none', color: '#1C1C1C', background: 'transparent', borderRight: isMobile ? 'none' : '1px solid #007B7F', borderRadius: '0' }}
            >
              <option value="">Filter By</option>
              <option value="Open Now">Open Now</option>
              <option value="Top Rated">Top Rated</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ padding: '0.5rem 1rem', fontSize: '1rem', border: 'none', color: '#1C1C1C', background: 'transparent', borderRadius: '0' }}
            >
              <option value="">Sort By</option>
              <option value="Newest">Newest</option>
              <option value="Oldest">Oldest</option>
              <option value="Rating">Rating</option>
            </select>
          </div>
        </div>
      </div>

      {/* Place the radius slider here, below the controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '1rem 0 0 1rem' }}>
        <label style={{ fontWeight: 500 }}>City:</label>
        <select
          value={selectedCity}
          onChange={e => setSelectedCity(e.target.value)}
          style={{ padding: '0.5rem 1rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: 8 }}
        >
          <option value=''>All Cities</option>
          {allCities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      <h2 style={{ margin: '2rem 0 1rem 1rem', color: '#1C1C1C', fontWeight: 'bold', fontSize: '1.5rem', textAlign: 'left' }}>Shops near you</h2>
      {filteredShops.length === 0 && (
        <div style={{ marginLeft: '1.5rem', color: '#888', fontWeight: 500, fontSize: '1.1rem' }}>No Stores Near You</div>
      )}
      <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '1rem' }}>
        {filteredShops.map(shop => {
          // New logic for open/closed status
          const today = daysOfWeek[new Date().getDay()];
          const isClosedToday = shop.closedDays && shop.closedDays.includes(today);
          const todayOpening = shop.openingTimes && shop.openingTimes[today];
          const todayClosing = shop.closingTimes && shop.closingTimes[today];
          
          function isStoreOpenForToday(shop) {
            if (!shop) return false;
            
            const today = daysOfWeek[new Date().getDay()];
            
            // Check if store is closed today
            if (shop.closedDays && shop.closedDays.includes(today)) {
              return false;
            }
            
            // Get today's opening and closing times
            const todayOpening = shop.openingTimes && shop.openingTimes[today];
            const todayClosing = shop.closingTimes && shop.closingTimes[today];
            
            // If no specific times set for today, fall back to general opening/closing times
            const opening = todayOpening || shop.openingTime;
            const closing = todayClosing || shop.closingTime;
            
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
          
          const open = isStoreOpenForToday(shop);
          let distance = null;
          if (userLocation && shop.latitude && shop.longitude) {
            const distanceKm = getDistanceFromLatLonInKm(
              Number(userLocation.lat), Number(userLocation.lng),
              Number(shop.latitude), Number(shop.longitude)
            );
            
            // More accurate distance formatting
            if (distanceKm < 0.01) {
              // For distances less than 10 meters, show as "Here"
              distance = "Here";
            } else if (distanceKm < 0.1) {
              // Convert to yards for very close distances (10m - 100m)
              const distanceYards = Math.round(distanceKm * 1093.61);
              distance = `${distanceYards} yds`;
            } else if (distanceKm < 1) {
              // Show in meters for close distances (100m - 1km)
              distance = `${Math.round(distanceKm * 1000)} m`;
            } else if (distanceKm < 10) {
              // Show 1 decimal place for medium distances (1-10km)
              distance = `${distanceKm.toFixed(1)} km`;
            } else {
              // Round to nearest km for longer distances (10km+)
              distance = `${Math.round(distanceKm)} km`;
            }
          }
          return (
            <div
              key={shop.id}
              onClick={() => handleStoreClick(shop.id)}
              style={{
                minWidth: 220,
                border: '1px solid #ccc',
                borderRadius: 12,
                background: '#fff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px #ececec',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                opacity: open ? 1 : 0.5,
                filter: open ? 'none' : 'grayscale(0.5)',
                transition: 'opacity 0.3s, filter 0.3s',
              }}
            >
              <div style={{ width: '100%', position: 'relative' }}>
                <img
                  src={shop.backgroundImg}
                  alt={shop.storeName}
                  style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
                />
                <div style={{ position: 'absolute', top: 8, right: 12, background: '#fff', borderRadius: 8, padding: '2px 10px', fontWeight: 600, color: '#007B7F', fontSize: '1rem', boxShadow: '0 1px 4px #ececec' }}>
                  ⭐ {ratings[shop.id]?.avg || '0.0'} ({ratings[shop.id]?.count || 0})
                </div>
                <div style={{ position: 'absolute', top: 8, left: 12, background: isClosedToday ? '#fbe8e8' : (open ? '#e8fbe8' : '#fbe8e8'), borderRadius: 8, padding: '2px 10px', fontWeight: 600, color: isClosedToday ? '#D92D20' : (open ? '#3A8E3A' : '#D92D20'), fontSize: '1rem', boxShadow: '0 1px 4px #ececec' }}>
                  {isClosedToday ? 'Closed Today' : (open ? 'Open' : 'Closed')}
                </div>
                {!open && (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.55)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.3rem', color: '#D92D20', pointerEvents: 'none' }}>
                    {isClosedToday ? 'Closed Today' : 'Closed'}
                  </div>
                )}
              </div>
              <div style={{ padding: '0.7rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#222' }}>{shop.storeName}</div>
                  {distance !== null && (
                    <div
                      style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: '2px 14px',
                        fontWeight: 600,
                        color: '#007B7F',
                        fontSize: '1rem',
                        boxShadow: '0 1px 4px #ececec',
                        border: '1.5px solid #eee',
                        display: 'inline-block',
                        minWidth: 60,
                        textAlign: 'center',
                        marginTop: '-30px',
                        marginLeft: 'auto',
                        zIndex: 10,
                        position: 'relative',
                      }}
                    >
                      {distance}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.95rem', color: '#444' }}>{shop.storeLocation}</div>
                {!isClosedToday && todayOpening && todayClosing && (
                  <div style={{ fontSize: '0.95rem', color: '#007B7F', fontWeight: 500 }}>
                    {todayOpening} - {todayClosing}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Spotlight Store Section */}
      <h2 style={{ margin: '2rem 0 1rem 1rem', color: '#1C1C1C', fontWeight: 'bold', fontSize: '1.5rem', textAlign: 'left' }}>Spotlight Store</h2>

      {filteredShops.filter(s => {
        const rating = ratings[s.id];
        return rating && parseFloat(rating.avg) >= 4.8 && rating.count >= 8;
      }).length === 0 ? (
        <div style={{ marginLeft: '1.5rem', color: '#888', fontWeight: 500, fontSize: '1.1rem' }}>No Spotlight Store</div>
      ) : (
        <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '1rem' }}>
          {filteredShops
            .filter(s => {
              const rating = ratings[s.id];
              return rating && parseFloat(rating.avg) >= 4.8 && rating.count >= 8;
            })
            .sort((a, b) => {
              const ratingA = ratings[a.id];
              const ratingB = ratings[b.id];
              // Sort by rating first (highest first), then by review count (most first)
              if (parseFloat(ratingB.avg) !== parseFloat(ratingA.avg)) {
                return parseFloat(ratingB.avg) - parseFloat(ratingA.avg);
              }
              return ratingB.count - ratingA.count;
            })
            .slice(0, 5)
            .map(shop => {
              // Use the same improved logic
              const today = daysOfWeek[new Date().getDay()];
              const isClosedToday = shop.closedDays && shop.closedDays.includes(today);
              const todayOpening = shop.openingTimes && shop.openingTimes[today];
              const todayClosing = shop.closingTimes && shop.closingTimes[today];
              
              function isStoreOpenForToday(shop) {
                if (!shop) return false;
                
                const today = daysOfWeek[new Date().getDay()];
                
                // Check if store is closed today
                if (shop.closedDays && shop.closedDays.includes(today)) {
                  return false;
                }
                
                // Get today's opening and closing times
                const todayOpening = shop.openingTimes && shop.openingTimes[today];
                const todayClosing = shop.closingTimes && shop.closingTimes[today];
                
                // If no specific times set for today, fall back to general opening/closing times
                const opening = todayOpening || shop.openingTime;
                const closing = todayClosing || shop.closingTime;
                
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
              
              const open = isStoreOpenForToday(shop);
              const storeRating = ratings[shop.id];
              return (
                <div
                  key={shop.id}
                  onClick={() => handleStoreClick(shop.id)}
                  style={{
                    minWidth: 220,
                    border: '2px solid #FFD700',
                    borderRadius: 12,
                    background: '#fffbe6',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px #ececec',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    opacity: open ? 1 : 0.5,
                    filter: open ? 'none' : 'grayscale(0.5)',
                    transition: 'opacity 0.3s, filter 0.3s',
                  }}
                >
                  <div style={{ width: '100%', position: 'relative' }}>
                    <img
                      src={shop.backgroundImg}
                      alt={shop.storeName}
                      style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
                    />
                    <div style={{ position: 'absolute', top: 8, right: 12, background: '#FFD700', borderRadius: 8, padding: '2px 10px', fontWeight: 600, color: '#fff', fontSize: '1rem', boxShadow: '0 1px 4px #ececec' }}>
                      ⭐ {storeRating.avg} ({storeRating.count})
                    </div>
                    <div style={{ position: 'absolute', top: 8, left: 12, background: isClosedToday ? '#fbe8e8' : (open ? '#e8fbe8' : '#fbe8e8'), borderRadius: 8, padding: '2px 10px', fontWeight: 600, color: isClosedToday ? '#D92D20' : (open ? '#3A8E3A' : '#D92D20'), fontSize: '1rem', boxShadow: '0 1px 4px #ececec' }}>
                      {isClosedToday ? 'Closed Today' : (open ? 'Open' : 'Closed')}
                    </div>
                    {/* Add a "Spotlight" badge */}
                    <div style={{ position: 'absolute', bottom: 8, left: 12, background: '#FFD700', borderRadius: 16, padding: '4px 12px', fontWeight: 700, color: '#fff', fontSize: '0.85rem', boxShadow: '0 2px 6px rgba(255, 215, 0, 0.3)' }}>
                      ✨ SPOTLIGHT
                    </div>
                    {!open && (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.55)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.3rem', color: '#D92D20', pointerEvents: 'none' }}>
                        {isClosedToday ? 'Closed Today' : 'Closed'}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '0.7rem', width: '100%' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#222' }}>{shop.storeName}</div>
                    <div style={{ fontSize: '0.95rem', color: '#444' }}>{shop.storeLocation}</div>
                    <div style={{ fontSize: '0.95rem', color: '#FFD700', fontWeight: 600 }}>
                      {parseFloat(storeRating.avg) === 5.0 ? '⭐ Perfect Rating!' : `⭐ ${storeRating.avg} Star Rating`}
                    </div>
                    {!isClosedToday && todayOpening && todayClosing && (
                      <div style={{ fontSize: '0.95rem', color: '#007B7F', fontWeight: 500 }}>
                        {todayOpening} - {todayClosing}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export default ExplorePage;