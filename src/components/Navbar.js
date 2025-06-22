import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { app } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(getAuth(app));
      navigate('/explore');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <nav style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '1rem', 
      background: '#F9F5EE', 
      borderBottom: '2px solid #B8B8B8' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <a href="/" style={{ display: 'inline-block', border: 'none', background: 'none' }}>
          <img src={process.env.PUBLIC_URL + '/images/logo png.png'} alt="Lokal Logo" style={{ maxHeight: '60px', verticalAlign: 'middle' }} />
        </a>
        {/* Hamburger menu beside logo for authenticated users */}
        {user && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 12 }}
            aria-label="Open menu"
          >
            <div style={{ width: 20, height: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ height: 3, background: '#007B7F', borderRadius: 2 }}></div>
              <div style={{ height: 3, background: '#007B7F', borderRadius: 2 }}></div>
              <div style={{ height: 3, background: '#007B7F', borderRadius: 2 }}></div>
            </div>
          </button>
        )}
      </div>
      <div>
        {!user ? (
          <>
            <a href="/login" style={{ color: '#007B7F', marginRight: '1rem', textDecoration: 'none', fontWeight: 'bold' }}>Login</a>
            <a href="/register" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold' }}>Register</a>
          </>
        ) : (
          <>
            <a href="/store-profile" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.7rem', verticalAlign: 'middle', marginRight: '1rem' }} title="Profile">
              <span role="img" aria-label="profile">👤</span>
            </a>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#D92D20', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Logout</button>
          </>
        )}
      </div>
      {user && sidebarOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 240,
          height: '100vh',
          background: '#fff',
          boxShadow: '2px 0 12px rgba(0,0,0,0.12)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2rem 1.2rem',
        }}>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ alignSelf: 'flex-end', background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#007B7F', marginBottom: 24 }}
            aria-label="Close menu"
          >
            ×
          </button>
          <Link to="/explore" onClick={() => setSidebarOpen(false)} style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 24 }}>Explore</Link>
          <Link to="/feed" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 24 }}>Feed</Link>
          <a href="/settings" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 24 }}>Settings</a>
          <button onClick={() => { setSidebarOpen(false); navigate('/my-reviews'); }} style={{ color: '#007B7F', background: 'none', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', marginBottom: 24, cursor: 'pointer' }}>Reviews</button>
        </div>
      )}
    </nav>
  );
}

export default Navbar; 