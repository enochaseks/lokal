import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

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

function ExplorePage() {
  const [userLocation, setUserLocation] = useState(null);
  const [city, setCity] = useState('');
  const [showDropdowns, setShowDropdowns] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [shops, setShops] = useState([]);
  const [ratings, setRatings] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`
          )
            .then((res) => res.json())
            .then((data) => {
              setCity(
                data.address.city ||
                data.address.town ||
                data.address.village ||
                data.address.state ||
                ''
              );
            });
        },
        (error) => {
          alert('Location access denied or unavailable.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'stores'), where('live', '==', true));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setShops(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

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

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <style>{responsiveStyles}</style>
      <Navbar />
      <div className="explore-controls" style={{ display: 'flex', alignItems: 'center', padding: '1rem', gap: '1rem', background: '#F9F5EE', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, marginRight: '1rem' }}>
          <span style={{ fontSize: '1rem', marginRight: '0.3rem' }}>📍</span>
          <span style={{ fontSize: '1rem', color: '#1C1C1C' }}>{city ? city : 'Detecting city...'}</span>
        </div>
        <div className={`explore-bar${isMobile ? ' mobile' : ''}${showDropdowns ? ' show-dropdowns' : ''}`} style={{ display: 'flex', background: '#fff', border: '2px solid #007B7F', borderRadius: '16px', overflow: 'visible', width: '100%', maxWidth: 900, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search..."
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
            <select style={{ padding: '0.5rem 1rem', fontSize: '1rem', border: 'none', color: '#1C1C1C', background: 'transparent', borderRight: isMobile ? 'none' : '1px solid #007B7F', borderRadius: '0' }}>
              <option>Category</option>
            </select>
            <select style={{ padding: '0.5rem 1rem', fontSize: '1rem', border: 'none', color: '#1C1C1C', background: 'transparent', borderRight: isMobile ? 'none' : '1px solid #007B7F', borderRadius: '0' }}>
              <option>Filter By</option>
              <option>Open Now</option>
              <option>Top Rated</option>
            </select>
            <select style={{ padding: '0.5rem 1rem', fontSize: '1rem', border: 'none', color: '#1C1C1C', background: 'transparent', borderRadius: '0' }}>
              <option>Sort By</option>
              <option>Newest</option>
              <option>Oldest</option>
              <option>Rating</option>
            </select>
          </div>
        </div>
      </div>
      <h2 style={{ margin: '2rem 0 1rem 1rem', color: '#1C1C1C', fontWeight: 'bold', fontSize: '1.5rem', textAlign: 'left' }}>Shops near you</h2>
      {shops.length === 0 && (
        <div style={{ marginLeft: '1.5rem', color: '#888', fontWeight: 500, fontSize: '1.1rem' }}>No Stores Near You</div>
      )}
      <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '1rem' }}>
        {shops.map(shop => {
          const open = isStoreOpen(shop.openingTime, shop.closingTime);
          return (
            <div
              key={shop.id}
              onClick={() => navigate(`/store-preview/${shop.id}`)}
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
                <div style={{ position: 'absolute', top: 8, left: 12, background: open ? '#e8fbe8' : '#fbe8e8', borderRadius: 8, padding: '2px 10px', fontWeight: 600, color: open ? '#3A8E3A' : '#D92D20', fontSize: '1rem', boxShadow: '0 1px 4px #ececec' }}>
                  {open ? 'Open' : 'Closed'}
                </div>
                {!open && (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.55)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.3rem', color: '#D92D20', pointerEvents: 'none' }}>
                    Closed
                  </div>
                )}
              </div>
              <div style={{ padding: '0.7rem', width: '100%' }}>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#222' }}>{shop.storeName}</div>
                <div style={{ fontSize: '0.95rem', color: '#444' }}>{shop.storeLocation}</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Page content can go here */}
    </div>
  );
}

export default ExplorePage; 