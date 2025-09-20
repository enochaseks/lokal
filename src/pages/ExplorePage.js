import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const responsiveStyles = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .explore-controls {
    flex-direction: row !important;
    align-items: center !important;
    gap: 0.5rem !important;
  }
  .explore-bar {
    flex-direction: row !important;
    border-radius: 20px !important;
    width: 100%;
    max-width: 900px;
  }
  .explore-dropdowns {
    display: none;
  }
  .explore-bar.mobile .explore-dropdown-toggle {
    display: flex !important;
  }
  .explore-bar.mobile .explore-dropdowns {
    display: none;
  }
  .explore-bar.mobile.show-dropdowns .explore-dropdowns {
    display: flex !important;
    flex-direction: column;
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0 0 20px 20px;
    margin-top: 4px;
    z-index: 1010;
    position: absolute;
    left: 0;
    top: 100%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    animation: fadeIn 0.3s ease;
  }
  
  /* Ensure location area doesn't interfere with dropdowns */
  .explore-controls > div:first-child {
    z-index: 1;
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

/* Custom select styling */
select {
  transition: all 0.2s ease;
}

select:hover {
  background: rgba(249, 245, 238, 0.3) !important;
}

select:focus {
  background: rgba(249, 245, 238, 0.5) !important;
  box-shadow: 0 0 0 2px rgba(0, 123, 127, 0.2) !important;
}

/* Input placeholder styling */
input::placeholder {
  color: #9CA3AF !important;
  font-weight: 400;
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
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLocation, setManualLocation] = useState('');

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
      setLocationLoading(true);
      setLocationError(null);
      
      try {
        // If profile location exists, geocode it
        if (profile && profile.location) {
          console.log('Using profile location:', profile.location);
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(profile.location)}&limit=1`);
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
              setLocationLoading(false);
              return;
            }
          } catch (error) {
            console.warn('Profile location geocoding failed:', error);
            // Continue to browser geolocation fallback
          }
        }
        
        // Fallback to browser geolocation with improved options
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setUserLocation(coords);
              
              try {
                // Use a faster reverse geocoding approach with a timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
                
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=10`,
                  { signal: controller.signal }
                );
                clearTimeout(timeoutId);
                
                const data = await res.json();
                const detectedCity = data.address?.city ||
                  data.address?.town ||
                  data.address?.village ||
                  data.address?.suburb ||
                  data.display_name?.split(',')[0] ||
                  'Unknown City';
                setCity(detectedCity);
                setUserCountry(data.address?.country || '');
              } catch (error) {
                console.warn('Reverse geocoding failed:', error);
                // Set location anyway, city will show as "Unknown City"
                setCity('Unknown City');
              }
              setLocationDetected(true);
              setLocationLoading(false);
            },
            (error) => {
              console.error('Geolocation error:', error);
              let errorMessage = 'Location unavailable';
              
              switch(error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = 'Location access denied';
                  setLocationError('Permission denied. Click the pin to try again or allow location access.');
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = 'Location unavailable';
                  setLocationError('Location data unavailable. Click the pin to retry.');
                  break;
                case error.TIMEOUT:
                  errorMessage = 'Location timeout';
                  setLocationError('Location request timed out. Click the pin to retry.');
                  break;
                default:
                  setLocationError('Unable to get location. Click the pin to try again.');
              }
              
              setCity(errorMessage);
              setLocationDetected(true);
              setLocationLoading(false);
            },
            {
              timeout: 8000, // Reduced from 10s to 8s for faster fallback
              enableHighAccuracy: false, // Use false for faster detection
              maximumAge: 300000 // 5 minutes cache
            }
          );
        } else {
          setCity('Geolocation not supported');
          setLocationError('Your browser doesn\'t support location services.');
          setLocationDetected(true);
          setLocationLoading(false);
        }
      } catch (error) {
        console.error('Location detection error:', error);
        setCity('Location error');
        setLocationError('Something went wrong. Click the pin to retry.');
        setLocationDetected(true);
        setLocationLoading(false);
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

  // Add automatic location refresh when page becomes visible (helpful for mobile users)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && locationError && locationError.includes('denied')) {
        // Only auto-retry if location was denied and page becomes visible
        // This helps when user grants permission in another tab
        console.log('Page became visible, retrying location detection...');
        setTimeout(() => {
          if (locationError && locationError.includes('denied')) {
            refreshLocation();
          }
        }, 1000); // Small delay to avoid immediate retry
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [locationError]);

  // Add a periodic location check (only if location failed initially)
  useEffect(() => {
    if (locationError && !locationLoading) {
      const intervalId = setInterval(() => {
        // Only auto-retry if there's an error and we're not already loading
        if (locationError && !locationLoading && navigator.geolocation) {
          console.log('Periodic location retry...');
          refreshLocation();
        }
      }, 60000); // Retry every 60 seconds

      return () => clearInterval(intervalId);
    }
  }, [locationError, locationLoading]);

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
      // Filter out disabled and deleted stores on the client side
      const filteredShops = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(shop => !shop.disabled && !shop.deleted);
      
      setShops(filteredShops);
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
    setLocationLoading(true);
    setLocationError(null);
    setCity('Detecting location...');
    setUserLocation(null);
    
    // Force location detection to run again with improved settings
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          
          try {
            // Use a faster reverse geocoding approach with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=10`,
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            
            const data = await res.json();
            const detectedCity = data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.suburb ||
              data.display_name?.split(',')[0] ||
              'Unknown City';
            setCity(detectedCity);
            setUserCountry(data.address?.country || '');
            setLocationError(null);
          } catch (error) {
            console.error('Error reverse geocoding:', error);
            setCity('Unknown City');
            setLocationError('Couldn\'t determine city name, but location detected');
          }
          setLocationDetected(true);
          setLocationLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMessage = 'Location unavailable';
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied';
              setLocationError('Please allow location access in your browser settings and try again.');
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location unavailable';
              setLocationError('Location services unavailable. Please check your device settings.');
              break;
            case error.TIMEOUT:
              errorMessage = 'Location timeout';
              setLocationError('Location request timed out. Please try again.');
              break;
            default:
              setLocationError('Unable to detect location. Please try again or check your device settings.');
          }
          
          setCity(errorMessage);
          setLocationDetected(true);
          setLocationLoading(false);
        },
        {
          timeout: 6000, // Faster timeout for manual refresh
          enableHighAccuracy: true, // Use high accuracy for manual refresh
          maximumAge: 0 // Don't use cached location for manual refresh
        }
      );
    } else {
      setCity('Geolocation not supported');
      setLocationError('Your browser doesn\'t support location services.');
      setLocationDetected(true);
      setLocationLoading(false);
    }
  };

  // Function to handle manual location input
  const setManualLocationHandler = async (locationName) => {
    if (!locationName.trim()) return;
    
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName.trim())}&limit=1`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        setUserLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        const detectedCity = data[0].address?.city ||
          data[0].address?.town ||
          data[0].address?.village ||
          data[0].address?.suburb ||
          data[0].display_name?.split(',')[0] ||
          locationName.trim();
        setCity(detectedCity);
        setUserCountry(data[0].address?.country || '');
        setLocationDetected(true);
        setShowManualLocation(false);
        setManualLocation('');
        setLocationError(null);
      } else {
        setLocationError(`Couldn't find "${locationName}". Please try a different city or area name.`);
      }
    } catch (error) {
      console.error('Manual location lookup failed:', error);
      setLocationError('Failed to lookup location. Please check your connection and try again.');
    }
    
    setLocationLoading(false);
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
              userSelect: 'none',
              animation: locationLoading ? 'spin 1s linear infinite' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!locationLoading) e.target.style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              if (!locationLoading) e.target.style.transform = 'scale(1)';
            }}
            title={locationLoading ? "Detecting location..." : "Click to refresh location"}
            aria-label="Refresh location"
          >
            {locationLoading ? '🔄' : '📍'}
          </span>
          <span style={{ fontSize: '1rem', color: locationError ? '#D92D20' : '#1C1C1C' }}>
            {locationLoading 
              ? 'Detecting location...' 
              : city || (locationDetected ? 'Location unavailable' : 'Detecting city...')
            }
          </span>
          {locationError && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.9rem',
              color: '#B91C1C',
              marginTop: '4px',
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>⚠️ Location Issue</div>
              <div style={{ marginBottom: '8px' }}>{locationError}</div>
              {locationError.includes('denied') && (
                <div style={{ fontSize: '0.8rem', color: '#7F1D1D', marginBottom: '8px' }}>
                  💡 <strong>Why we need location:</strong> To show you nearby stores and calculate accurate delivery times.
                  <br />
                  📱 <strong>How to enable:</strong> Look for the location icon in your browser's address bar or check your browser settings.
                </div>
              )}
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #FECACA' }}>
                <button
                  onClick={() => setShowManualLocation(!showManualLocation)}
                  style={{
                    background: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    marginRight: '8px'
                  }}
                >
                  {showManualLocation ? 'Cancel' : 'Enter Location Manually'}
                </button>
                {showManualLocation && (
                  <div style={{ marginTop: '8px' }}>
                    <input
                      type="text"
                      placeholder="Enter your city or area"
                      value={manualLocation}
                      onChange={(e) => setManualLocation(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          setManualLocationHandler(manualLocation);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        marginBottom: '4px'
                      }}
                    />
                    <button
                      onClick={() => setManualLocationHandler(manualLocation)}
                      disabled={!manualLocation.trim() || locationLoading}
                      style={{
                        background: manualLocation.trim() && !locationLoading ? '#007B7F' : '#9CA3AF',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        cursor: manualLocation.trim() && !locationLoading ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {locationLoading ? 'Setting...' : 'Set Location'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={`explore-bar${isMobile ? ' mobile' : ''}${showDropdowns ? ' show-dropdowns' : ''}`} style={{ 
          display: 'flex', 
          background: 'rgba(255, 255, 255, 0.9)', 
          backdropFilter: 'blur(10px)', 
          border: '1px solid rgba(255, 255, 255, 0.2)', 
          borderRadius: '20px', 
          overflow: 'visible', 
          width: '100%', 
          maxWidth: 900, 
          position: 'relative',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease',
          zIndex: isMobile && showDropdowns ? 1010 : 'auto'
        }}>
          <input
            type="text"
            placeholder="🔍 Search stores, products..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '1rem 1.25rem',
              fontSize: '1rem',
              border: 'none',
              outline: 'none',
              color: '#1F2937',
              background: 'transparent',
              borderRadius: '20px 0 0 20px',
              fontWeight: '500',
              '::placeholder': {
                color: '#9CA3AF',
                fontSize: '1rem'
              }
            }}
            onFocus={e => {
              e.target.parentElement.style.transform = 'translateY(-2px)';
              e.target.parentElement.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
              e.target.style.background = 'rgba(249, 245, 238, 0.5)';
            }}
            onBlur={e => {
              e.target.parentElement.style.transform = 'translateY(0)';
              e.target.parentElement.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
              e.target.style.background = 'transparent';
            }}
          />
          <button
            type="button"
            className="explore-dropdown-toggle"
            style={{
              display: isMobile ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 123, 127, 0.1)',
              border: 'none',
              padding: '0 1rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: '#007B7F',
              outline: 'none',
              borderRadius: '0 20px 20px 0',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setShowDropdowns((prev) => !prev)}
            onMouseEnter={e => {
              e.target.style.background = 'rgba(0, 123, 127, 0.2)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(0, 123, 127, 0.1)';
              e.target.style.transform = 'scale(1)';
            }}
            aria-label="Show filters"
          >
            {showDropdowns ? '▲' : '▼'}
          </button>
          <div className="explore-dropdowns" style={{ 
            display: isMobile ? (showDropdowns ? 'flex' : 'none') : 'flex', 
            flexDirection: isMobile ? 'column' : 'row', 
            width: isMobile ? '100%' : 'auto', 
            background: isMobile ? 'rgba(255, 255, 255, 0.95)' : 'transparent', 
            backdropFilter: isMobile ? 'blur(10px)' : 'none',
            position: isMobile ? 'absolute' : 'static', 
            left: 0, 
            top: '100%', 
            zIndex: 10, 
            border: isMobile ? '1px solid rgba(255, 255, 255, 0.2)' : 'none', 
            borderRadius: isMobile ? '0 0 20px 20px' : '0', 
            marginTop: isMobile ? '4px' : '0',
            boxShadow: isMobile ? '0 8px 32px rgba(0, 0, 0, 0.1)' : 'none'
          }}>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ 
                padding: '1rem 1.25rem', 
                fontSize: '1rem', 
                border: 'none', 
                color: '#1F2937', 
                background: 'transparent', 
                outline: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                borderRight: isMobile ? 'none' : '1px solid rgba(0, 123, 127, 0.2)',
                borderRadius: isMobile ? '0' : '0',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                paddingRight: '2.5rem'
              }}
            >
              <option value="">📂 Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filterBy}
              onChange={e => setFilterBy(e.target.value)}
              style={{ 
                padding: '1rem 1.25rem', 
                fontSize: '1rem', 
                border: 'none', 
                color: '#1F2937', 
                background: 'transparent', 
                outline: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                borderRight: isMobile ? 'none' : '1px solid rgba(0, 123, 127, 0.2)',
                borderRadius: '0',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                paddingRight: '2.5rem'
              }}
            >
              <option value="">🔍 Filter By</option>
              <option value="Open Now">🟢 Open Now</option>
              <option value="Top Rated">⭐ Top Rated</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ 
                padding: '1rem 1.25rem', 
                fontSize: '1rem', 
                border: 'none', 
                color: '#1F2937', 
                background: 'transparent', 
                outline: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                borderRadius: isMobile ? '0' : '0 20px 20px 0',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                paddingRight: '2.5rem'
              }}
            >
              <option value="">📊 Sort By</option>
              <option value="Newest">🆕 Newest</option>
              <option value="Oldest">📅 Oldest</option>
              <option value="Rating">⭐ Rating</option>
            </select>
          </div>
        </div>
      </div>

      {/* Compact City Selector - Left Aligned */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        margin: '1rem 0 0 1rem',
        position: 'relative',
        zIndex: 100
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          transition: 'all 0.2s ease',
          width: 'fit-content',
          position: 'relative',
          zIndex: 100
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.08)';
        }}>
          <span style={{ 
            fontSize: '0.9rem',
            fontWeight: '600',
            color: '#1F2937',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            🏙️ City:
          </span>
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            style={{ 
              padding: '0.4rem 2rem 0.4rem 0.75rem', 
              fontSize: '0.9rem', 
              border: 'none', 
              borderRadius: '8px',
              background: 'rgba(249, 245, 238, 0.5)',
              color: '#1F2937',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23007B7F\'><path d=\'M7 10l5 5 5-5z\'/></svg>")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '0.8rem',
              transition: 'all 0.2s ease',
              minWidth: '120px',
              position: 'relative',
              zIndex: 100
            }}
            onFocus={e => {
              e.target.style.background = 'rgba(249, 245, 238, 0.8)';
              e.target.style.boxShadow = '0 0 0 2px rgba(0, 123, 127, 0.2)';
              e.target.style.zIndex = '101';
            }}
            onBlur={e => {
              e.target.style.background = 'rgba(249, 245, 238, 0.5)';
              e.target.style.boxShadow = 'none';
              e.target.style.zIndex = '100';
            }}
          >
            <option value=''>All Cities</option>
            {allCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>

      <h2 style={{ 
        margin: '3rem 0 1rem 1rem', 
        color: '#1C1C1C', 
        fontWeight: 'bold', 
        fontSize: '1.5rem', 
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        📍 Shops Near You
        <span style={{ 
          background: '#f0f9f9', 
          color: '#007B7F', 
          borderRadius: '12px', 
          padding: '2px 8px', 
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          {filteredShops.length}
        </span>
      </h2>
      
      {filteredShops.length === 0 ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem 1rem',
          background: '#f8fafc',
          borderRadius: '12px',
          margin: '0 1rem',
          border: '2px dashed #e2e8f0'
        }}>
          <div style={{
            textAlign: 'center',
            color: '#64748b'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
            <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              No stores available
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Check back later for new stores near you
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '0 1rem 1rem' }}>
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
              onClick={() => {
                handleStoreClick(shop.id);
                navigate(`/store-preview/${shop.id}`);
              }}
              style={{
                minWidth: 200,
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                background: '#fff',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                opacity: open ? 1 : 0.7,
                filter: open ? 'none' : 'grayscale(0.3)',
                transition: 'all 0.3s ease, transform 0.2s ease',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-4px)';
                e.target.style.boxShadow = '0 10px 25px -3px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              }}
            >
              <div style={{ width: '100%', position: 'relative' }}>
                <img
                  src={shop.backgroundImg}
                  alt={shop.storeName}
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: '16px 16px 0 0' }}
                />
                
                <div style={{ 
                  position: 'absolute', 
                  top: 12, 
                  right: 12, 
                  background: 'rgba(255, 255, 255, 0.95)', 
                  backdropFilter: 'blur(8px)',
                  borderRadius: 12, 
                  padding: '4px 8px', 
                  fontWeight: 600, 
                  color: '#007B7F', 
                  fontSize: '0.9rem', 
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  ⭐ {ratings[shop.id]?.avg || '0.0'} ({ratings[shop.id]?.count || 0})
                </div>
                
                <div style={{ 
                  position: 'absolute', 
                  top: 12, 
                  left: 12, 
                  background: isClosedToday ? 'rgba(239, 68, 68, 0.95)' : (open ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)'), 
                  backdropFilter: 'blur(8px)',
                  borderRadius: 12, 
                  padding: '4px 8px', 
                  fontWeight: 600, 
                  color: 'white', 
                  fontSize: '0.9rem', 
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  border: isClosedToday ? '1px solid rgba(239, 68, 68, 0.3)' : (open ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)')
                }}>
                  {isClosedToday ? 'Closed Today' : (open ? 'Open' : 'Closed')}
                </div>
                
                {distance !== null && (
                  <div style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 20,
                    padding: '4px 12px',
                    fontWeight: 600,
                    color: '#007B7F',
                    fontSize: '0.9rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    {distance}
                  </div>
                )}
                
                {!open && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    background: 'rgba(255,255,255,0.8)', 
                    borderRadius: '16px 16px 0 0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700, 
                    fontSize: '1.1rem', 
                    color: '#ef4444', 
                    pointerEvents: 'none',
                    backdropFilter: 'blur(2px)'
                  }}>
                    {isClosedToday ? 'Closed Today' : 'Closed'}
                  </div>
                )}
              </div>
              <div style={{ padding: '1rem', width: '100%' }}>
                <div style={{ 
                  fontWeight: 700, 
                  fontSize: '1.1rem', 
                  color: '#1f2937',
                  marginBottom: '0.5rem',
                  lineHeight: '1.3'
                }}>
                  {shop.storeName}
                </div>
                <div style={{ 
                  fontSize: '0.9rem', 
                  color: '#6b7280',
                  marginBottom: '0.5rem',
                  lineHeight: '1.4'
                }}>
                  {shop.storeLocation}
                </div>
                {!isClosedToday && todayOpening && todayClosing && (
                  <div style={{ 
                    fontSize: '0.9rem', 
                    color: '#007B7F', 
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    🕒 {todayOpening} - {todayClosing}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}
      
      {/* Spotlight Store Section */}
      <h2 style={{ 
        margin: '3rem 0 1rem 1rem', 
        color: '#1C1C1C', 
        fontWeight: 'bold', 
        fontSize: '1.5rem', 
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        ✨ Spotlight Store
        <span style={{ 
          background: '#fff9e6', 
          color: '#FFD700', 
          borderRadius: '12px', 
          padding: '2px 8px', 
          fontSize: '0.9rem',
          fontWeight: '500',
          border: '1px solid #FFD700'
        }}>
          {filteredShops.filter(s => {
            const rating = ratings[s.id];
            return rating && parseFloat(rating.avg) >= 4.8 && rating.count >= 8;
          }).length}
        </span>
      </h2>

      {filteredShops.filter(s => {
        const rating = ratings[s.id];
        return rating && parseFloat(rating.avg) >= 4.8 && rating.count >= 8;
      }).length === 0 ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem 1rem',
          background: '#fffdf0',
          borderRadius: '12px',
          margin: '0 1rem',
          border: '2px dashed #fbbf24'
        }}>
          <div style={{
            textAlign: 'center',
            color: '#a16207'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⭐</div>
            <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              No spotlight stores available
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Stores need 4.8+ stars and 8+ reviews to be featured
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '0 1rem 1rem' }}>
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
                  onClick={() => {
                    handleStoreClick(shop.id);
                    navigate(`/store-preview/${shop.id}`);
                  }}
                  style={{
                    minWidth: 200,
                    border: '2px solid #FFD700',
                    borderRadius: 16,
                    background: '#fffbeb',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    opacity: open ? 1 : 0.7,
                    filter: open ? 'none' : 'grayscale(0.3)',
                    transition: 'all 0.3s ease, transform 0.2s ease',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-4px)';
                    e.target.style.boxShadow = '0 10px 25px -3px rgba(255, 215, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  }}
                >
                  <div style={{ width: '100%', position: 'relative' }}>
                    <img
                      src={shop.backgroundImg}
                      alt={shop.storeName}
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: '16px 16px 0 0' }}
                    />
                    
                    <div style={{ 
                      position: 'absolute', 
                      top: 12, 
                      right: 12, 
                      background: 'rgba(255, 215, 0, 0.95)', 
                      backdropFilter: 'blur(8px)',
                      borderRadius: 12, 
                      padding: '4px 8px', 
                      fontWeight: 600, 
                      color: 'white', 
                      fontSize: '0.9rem', 
                      boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)',
                      border: '1px solid rgba(255, 215, 0, 0.3)'
                    }}>
                      ⭐ {storeRating.avg} ({storeRating.count})
                    </div>
                    
                    <div style={{ 
                      position: 'absolute', 
                      top: 12, 
                      left: 12, 
                      background: isClosedToday ? 'rgba(239, 68, 68, 0.95)' : (open ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)'), 
                      backdropFilter: 'blur(8px)',
                      borderRadius: 12, 
                      padding: '4px 8px', 
                      fontWeight: 600, 
                      color: 'white', 
                      fontSize: '0.9rem', 
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      border: isClosedToday ? '1px solid rgba(239, 68, 68, 0.3)' : (open ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)')
                    }}>
                      {isClosedToday ? 'Closed Today' : (open ? 'Open' : 'Closed')}
                    </div>
                    
                    {/* Spotlight badge */}
                    <div style={{ 
                      position: 'absolute', 
                      bottom: 12, 
                      left: 12, 
                      background: 'linear-gradient(135deg, #FFD700, #FFA500)', 
                      borderRadius: 20, 
                      padding: '6px 12px', 
                      fontWeight: 700, 
                      color: 'white', 
                      fontSize: '0.8rem', 
                      boxShadow: '0 4px 12px rgba(255, 215, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      backdropFilter: 'blur(8px)'
                    }}>
                      ✨ SPOTLIGHT
                    </div>
                    
                    {!open && (
                      <div style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        background: 'rgba(255,255,255,0.8)', 
                        borderRadius: '16px 16px 0 0', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontWeight: 700, 
                        fontSize: '1.1rem', 
                        color: '#ef4444', 
                        pointerEvents: 'none',
                        backdropFilter: 'blur(2px)'
                      }}>
                        {isClosedToday ? 'Closed Today' : 'Closed'}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '1rem', width: '100%' }}>
                    <div style={{ 
                      fontWeight: 700, 
                      fontSize: '1.1rem', 
                      color: '#1f2937',
                      marginBottom: '0.5rem',
                      lineHeight: '1.3'
                    }}>
                      {shop.storeName}
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#6b7280',
                      marginBottom: '0.5rem',
                      lineHeight: '1.4'
                    }}>
                      {shop.storeLocation}
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#FFD700', 
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {parseFloat(storeRating.avg) === 5.0 ? '⭐ Perfect Rating!' : `⭐ ${storeRating.avg} Star Rating`}
                    </div>
                    {!isClosedToday && todayOpening && todayClosing && (
                      <div style={{ 
                        fontSize: '0.9rem', 
                        color: '#007B7F', 
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🕒 {todayOpening} - {todayClosing}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Categories Section - Each category as its own main section */}
      {categories.map(category => {
        const categoryShops = filteredShops.filter(shop => shop.category === category);
        
        return (
          <div key={category} style={{ marginBottom: '3rem' }}>
            <h2 style={{ 
              margin: '3rem 0 1rem 1rem', 
              color: '#1C1C1C', 
              fontWeight: 'bold', 
              fontSize: '1.5rem', 
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {category === 'Foods & Goods' && '🍎'}
              {category === 'Meat & Poultry' && '🥩'}
              {category === 'Wholesale' && '📦'}
              {category === 'Beauty & Hair' && '💄'}
              {category}
              <span style={{ 
                background: '#f0f9f9', 
                color: '#007B7F', 
                borderRadius: '12px', 
                padding: '2px 8px', 
                fontSize: '0.9rem',
                fontWeight: '500'
              }}>
                {categoryShops.length}
              </span>
            </h2>
            
            {categoryShops.length === 0 ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '3rem 1rem',
                background: '#f8fafc',
                borderRadius: '12px',
                margin: '0 1rem',
                border: '2px dashed #e2e8f0'
              }}>
                <div style={{
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
                  <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                    No stores available
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    Check back later for new stores in this category
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '0 1rem 1rem' }}>
                  {categoryShops.slice(0, 10).map(shop => {
                    // Same logic for open/closed status
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
                    let distance = null;
                    if (userLocation && shop.latitude && shop.longitude) {
                      const distanceKm = getDistanceFromLatLonInKm(
                        Number(userLocation.lat), Number(userLocation.lng),
                        Number(shop.latitude), Number(shop.longitude)
                      );
                      
                      // More accurate distance formatting
                      if (distanceKm < 0.01) {
                        distance = "Here";
                      } else if (distanceKm < 0.1) {
                        const distanceYards = Math.round(distanceKm * 1093.61);
                        distance = `${distanceYards} yds`;
                      } else if (distanceKm < 1) {
                        distance = `${Math.round(distanceKm * 1000)} m`;
                      } else if (distanceKm < 10) {
                        distance = `${distanceKm.toFixed(1)} km`;
                      } else {
                        distance = `${Math.round(distanceKm)} km`;
                      }
                    }
                    
                    return (
                      <div
                        key={shop.id}
                        onClick={() => handleStoreClick(shop.id)}
                        style={{
                          minWidth: 200,
                          border: '1px solid #e0e0e0',
                          borderRadius: 12,
                          background: '#fff',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative',
                          opacity: open ? 1 : 0.6,
                          transition: 'opacity 0.3s, transform 0.2s, box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                        }}
                      >
                        <div style={{ width: '100%', position: 'relative' }}>
                          <img
                            src={shop.backgroundImg}
                            alt={shop.storeName}
                            style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
                          />
                          <div style={{ 
                            position: 'absolute', 
                            top: 6, 
                            left: 8, 
                            background: isClosedToday ? '#fee2e2' : (open ? '#dcfce7' : '#fee2e2'), 
                            borderRadius: 6, 
                            padding: '2px 8px', 
                            fontWeight: 600, 
                            color: isClosedToday ? '#dc2626' : (open ? '#16a34a' : '#dc2626'), 
                            fontSize: '0.8rem', 
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)' 
                          }}>
                            {isClosedToday ? 'Closed Today' : (open ? 'Open' : 'Closed')}
                          </div>
                          {storeRating && (
                            <div style={{ 
                              position: 'absolute', 
                              top: 6, 
                              right: 8, 
                              background: '#fff', 
                              borderRadius: 6, 
                              padding: '2px 8px', 
                              fontWeight: 600, 
                              color: '#f59e0b', 
                              fontSize: '0.8rem', 
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              ⭐ {storeRating.avg}
                            </div>
                          )}
                          {distance && (
                            <div style={{ 
                              position: 'absolute', 
                              bottom: 6, 
                              right: 8, 
                              background: '#007B7F', 
                              borderRadius: 6, 
                              padding: '2px 8px', 
                              fontWeight: 600, 
                              color: '#fff', 
                              fontSize: '0.8rem', 
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)' 
                            }}>
                              {distance}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '0.75rem', width: '100%' }}>
                          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#222', marginBottom: '4px' }}>
                            {shop.storeName}
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '6px' }}>
                            {shop.storeLocation}
                          </div>
                          {!isClosedToday && todayOpening && todayClosing && (
                            <div style={{ fontSize: '0.85rem', color: '#007B7F', fontWeight: 500 }}>
                              {todayOpening} - {todayClosing}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {categoryShops.length > 10 && (
                  <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                    <button
                      onClick={() => {
                        setSelectedCategory(category);
                        setSearchTerm('');
                        setFilterBy('');
                        setSortBy('');
                        // Scroll to top to show filtered results
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        background: '#007B7F',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#006666'}
                      onMouseLeave={(e) => e.target.style.background = '#007B7F'}
                    >
                      View All {category} ({categoryShops.length})
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ExplorePage;