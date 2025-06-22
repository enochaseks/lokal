import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';

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

function ExplorePage() {
  const [userLocation, setUserLocation] = useState(null);
  const [city, setCity] = useState('');
  const [showDropdowns, setShowDropdowns] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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
      {/* Page content can go here */}
    </div>
  );
}

export default ExplorePage; 