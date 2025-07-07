import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { app, db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useCart } from '../CartContext';

function Navbar() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState('');
  const navigate = useNavigate();
  const { cart, clearCart } = useCart();

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Check if user is a seller (has a store doc)
        const storeDoc = await getDoc(doc(db, 'stores', u.uid));
        if (storeDoc.exists()) {
          setUserType('seller');
        } else {
          setUserType('buyer');
        }
        // Onboarding guard
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        const onboardingStepValue = userDoc.exists() ? userDoc.data().onboardingStep : null;
        setOnboardingStep(onboardingStepValue);
        if (onboardingStepValue && onboardingStepValue !== 'complete') {
          navigate('/' + onboardingStepValue);
        }
      } else {
        setUserType('');
        setOnboardingStep('');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      clearCart();
      await signOut(getAuth(app));
      navigate('/explore');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Only show cart if userType is 'buyer' and onboardingStep is 'complete' and user is logged in
  const showCart = user && userType === 'buyer' && onboardingStep === 'complete';

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
        {/* Hamburger menu beside logo for all users */}
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
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!user ? (
          <>
            <a href="/login" style={{ color: '#007B7F', marginRight: '1rem', textDecoration: 'none', fontWeight: 'bold' }}>Login</a>
            <a href="/register" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold' }}>Register</a>
          </>
        ) : (
          <>
            {userType === 'buyer' ? (
              <>
                <a href="/profile" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.7rem', verticalAlign: 'middle', marginRight: '1rem' }} title="Profile">
                  <span role="img" aria-label="profile">👤</span>
                </a>
                {showCart && (
                  <button
                    onClick={() => navigate('/shop-cart')}
                    style={{ background: 'none', border: 'none', margin: '0 1.2rem', position: 'relative', cursor: 'pointer' }}
                    aria-label="Cart"
                  >
                    <img src={process.env.PUBLIC_URL + '/images/cart.png'} alt="Cart" style={{ width: 32, height: 32 }} />
                    {cart && cart.length > 0 && (
                      <span style={{ position: 'absolute', top: -8, right: -8, background: '#D92D20', color: '#fff', borderRadius: '50%', padding: '2px 8px', fontSize: 14, fontWeight: 700 }}>{cart.length}</span>
                    )}
                  </button>
                )}
              </>
            ) : (
              <a href="/store-profile" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.7rem', verticalAlign: 'middle', marginRight: '1rem' }} title="Profile">
                <span role="img" aria-label="profile">👤</span>
              </a>
            )}
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#D92D20', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Logout</button>
          </>
        )}
      </div>
      {sidebarOpen && (
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
          <button onClick={() => { setSidebarOpen(false); navigate('/my-reviews'); }} style={{ color: '#007B7F', background: 'none', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', marginBottom: 24, cursor: 'pointer' }}>My Reviews</button>
          {user && (
            <button onClick={() => { setSidebarOpen(false); navigate('/messages'); }} style={{ color: '#007B7F', background: 'none', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', marginBottom: 24, cursor: 'pointer' }}>Messages</button>
          )}
          {!user ? (
            <a href="/about" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 24 }}>About</a>
          ) : (
            <>
              <Link to="/explore" onClick={() => setSidebarOpen(false)} style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 24 }}>Explore</Link>
              <Link to="/feed" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 24 }}>Feed</Link>
              <a href="/settings" style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 24 }}>Settings</a>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

export default Navbar; 