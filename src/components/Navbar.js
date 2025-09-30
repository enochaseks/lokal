import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { app, db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useCart } from '../CartContext';
import { useMessage } from '../MessageContext';

function Navbar() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [adminCode, setAdminCode] = useState('');
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [adminCodeError, setAdminCodeError] = useState('');
  const navigate = useNavigate();
  const { cart, clearCart } = useCart();
  const { unreadMessageCount } = useMessage();

  // Handle window resize to detect mobile devices
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Call handler right away so state gets updated with initial window size
    handleResize();
    
    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        // Onboarding guard - only redirect if email is verified
        if (u.emailVerified) {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          const onboardingStepValue = userDoc.exists() ? userDoc.data().onboardingStep : null;
          setOnboardingStep(onboardingStepValue);
          if (onboardingStepValue && onboardingStepValue !== 'complete') {
            navigate('/' + onboardingStepValue);
          }
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
  
  // Function to handle admin access code validation
  const handleAdminAccess = (e) => {
    e.preventDefault();
    setSidebarOpen(false);
    setShowAdminCodeModal(true);
  };
  
  // Function to verify admin code and grant access to admin portal
  const verifyAdminCode = () => {
    // Check if code matches the secret code
    if (adminCode === '109826') {
      setAdminCodeError('');
      setAdminCode('');
      setShowAdminCodeModal(false);
      
      // Show success message
      const successModal = document.createElement('div');
      successModal.style.position = 'fixed';
      successModal.style.top = '0';
      successModal.style.left = '0';
      successModal.style.right = '0';
      successModal.style.bottom = '0';
      successModal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      successModal.style.display = 'flex';
      successModal.style.justifyContent = 'center';
      successModal.style.alignItems = 'center';
      successModal.style.zIndex = '10000';
      
      const successContent = document.createElement('div');
      successContent.style.backgroundColor = 'white';
      successContent.style.borderRadius = '8px';
      successContent.style.padding = '2rem';
      successContent.style.width = '90%';
      successContent.style.maxWidth = '400px';
      successContent.style.textAlign = 'center';
      
      const icon = document.createElement('div');
      icon.innerHTML = '✅';
      icon.style.fontSize = '3rem';
      icon.style.marginBottom = '1rem';
      icon.style.color = '#10B981';
      
      const title = document.createElement('h2');
      title.innerText = 'Access Granted';
      title.style.fontSize = '1.5rem';
      title.style.marginBottom = '1rem';
      title.style.fontWeight = 'bold';
      
      const message = document.createElement('p');
      message.innerText = 'You have been verified. Redirecting to the admin portal...';
      message.style.marginBottom = '1.5rem';
      message.style.color = '#4B5563';
      
      successContent.appendChild(icon);
      successContent.appendChild(title);
      successContent.appendChild(message);
      successModal.appendChild(successContent);
      document.body.appendChild(successModal);
      
      // Redirect to admin dashboard after a short delay
      setTimeout(() => {
        document.body.removeChild(successModal);
        navigate('/admin-login');
      }, 1500);
      
    } else {
      // Show error message for incorrect code
      setAdminCodeError('Invalid access code. Please try again.');
    }
  };

  // Only show cart if userType is 'buyer' and onboardingStep is 'complete' and user is logged in
  const showCart = user && userType === 'buyer' && onboardingStep === 'complete';

  return (
    <nav style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '0 1rem', 
      background: 'rgba(255, 255, 255, 0.98)', 
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      transition: 'all 0.3s ease',
      height: '60px',
      width: '100%',
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden',
      willChange: 'transform',
      margin: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <a href="/" style={{ display: 'inline-block', border: 'none', background: 'none' }}>
            <img 
              src={process.env.PUBLIC_URL + '/images/logo png.png'} 
              alt="Lokal Logo" 
              style={{ 
                maxHeight: '35px', 
                verticalAlign: 'middle',
                transition: 'transform 0.2s ease'
              }} 
              onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            />
          </a>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 'bold', 
            color: 'rgba(0, 123, 127, 0.8)', 
            marginLeft: '5px',
            padding: '1px 6px',
            borderRadius: '10px',
            background: 'rgba(0, 123, 127, 0.1)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            beta
          </span>
        </div>
        {/* Modern Hamburger menu */}
        <button
          onClick={() => setSidebarOpen(true)}
          style={{ 
            background: 'rgba(0, 123, 127, 0.1)', 
            border: 'none', 
            cursor: 'pointer', 
            padding: '6px', 
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={e => {
            e.target.style.background = 'rgba(0, 123, 127, 0.2)';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={e => {
            e.target.style.background = 'rgba(0, 123, 127, 0.1)';
            e.target.style.transform = 'scale(1)';
          }}
          aria-label="Open menu"
        >
          <div style={{ width: 20, height: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ height: 2.5, background: '#007B7F', borderRadius: 2 }}></div>
            <div style={{ height: 2.5, background: '#007B7F', borderRadius: 2 }}></div>
            <div style={{ height: 2.5, background: '#007B7F', borderRadius: 2 }}></div>
          </div>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {!user ? (
          <>
            <a 
              href="/login" 
              style={{ 
                color: '#007B7F', 
                textDecoration: 'none', 
                fontWeight: '600', 
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                background: 'rgba(0, 123, 127, 0.1)',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem'
              }}
              onMouseEnter={e => {
                e.target.style.background = 'rgba(0, 123, 127, 0.2)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Login
            </a>
            <a 
              href="/register" 
              style={{ 
                color: 'white', 
                textDecoration: 'none', 
                fontWeight: '600',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #007B7F, #00A3A8)',
                boxShadow: '0 3px 10px rgba(0, 123, 127, 0.3)',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem'
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 6px 20px rgba(0, 123, 127, 0.4)';
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.3)';
              }}
            >
              Register
            </a>
          </>
        ) : (
          <>
            {userType === 'buyer' ? (
              <>
                <a 
                  href="/profile" 
                  style={{ 
                    color: '#007B7F', 
                    textDecoration: 'none', 
                    fontWeight: 'bold', 
                    fontSize: '1.2rem', 
                    padding: '6px',
                    borderRadius: '8px',
                    background: 'rgba(0, 123, 127, 0.1)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }} 
                  title="Profile"
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.2)';
                    e.target.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  <span role="img" aria-label="profile">👤</span>
                </a>
                {showCart && (
                  <button
                    onClick={() => navigate('/shop-cart')}
                    style={{ 
                      background: 'rgba(0, 123, 127, 0.1)', 
                      border: 'none', 
                      padding: '6px', 
                      position: 'relative', 
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.2)';
                      e.target.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'scale(1)';
                    }}
                    aria-label="Cart"
                  >
                    <img src={process.env.PUBLIC_URL + '/images/cart.png'} alt="Cart" style={{ width: 18, height: 18 }} />
                    {cart && cart.length > 0 && (
                      <span style={{ 
                        position: 'absolute', 
                        top: -4, 
                        right: -4, 
                        background: 'linear-gradient(135deg, #DC2626, #EF4444)', 
                        color: '#fff', 
                        borderRadius: '50%', 
                        padding: '2px 6px', 
                        fontSize: '12px', 
                        fontWeight: '700',
                        minWidth: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)'
                      }}>
                        {cart.length}
                      </span>
                    )}
                  </button>
                )}
              </>
            ) : (
              <a 
                href="/store-profile" 
                style={{ 
                  color: '#007B7F', 
                  textDecoration: 'none', 
                  fontWeight: 'bold', 
                  fontSize: '1.2rem', 
                  padding: '6px',
                  borderRadius: '8px',
                  background: 'rgba(0, 123, 127, 0.1)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }} 
                title="Store Profile"
                onMouseEnter={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.2)';
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                <span role="img" aria-label="profile">👤</span>
              </a>
            )}
            <button 
              onClick={handleLogout} 
              style={{ 
                background: 'rgba(220, 38, 38, 0.1)', 
                border: 'none', 
                color: '#DC2626', 
                fontWeight: '600', 
                cursor: 'pointer', 
                fontSize: '0.85rem',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.target.style.background = 'rgba(220, 38, 38, 0.2)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'rgba(220, 38, 38, 0.1)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(4px)',
              zIndex: 1999,
              animation: 'fadeIn 0.3s ease'
            }}
            onClick={() => setSidebarOpen(false)}
          />
          {/* Modern Sidebar */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 280,
            height: '100vh',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '4px 0 30px rgba(0, 0, 0, 0.15)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem 0',
            animation: 'slideIn 0.3s ease'
          }}>
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '0 2rem',
              marginBottom: '2rem' 
            }}>
              <h3 style={{ 
                color: '#1F2937', 
                margin: 0, 
                fontSize: '1.2rem', 
                fontWeight: '700' 
              }}>
                Menu
              </h3>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ 
                  background: 'rgba(220, 38, 38, 0.1)', 
                  border: 'none', 
                  borderRadius: '12px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px', 
                  cursor: 'pointer', 
                  color: '#DC2626',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.target.style.background = 'rgba(220, 38, 38, 0.2)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'rgba(220, 38, 38, 0.1)';
                  e.target.style.transform = 'scale(1)';
                }}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            {/* Menu Items */}
            <div style={{ flex: 1, padding: '0 1rem' }}>
              <button 
                onClick={() => { setSidebarOpen(false); navigate('/my-reviews'); }} 
                style={{ 
                  color: '#1F2937', 
                  background: 'rgba(0, 123, 127, 0.05)', 
                  border: '1px solid rgba(0, 123, 127, 0.1)', 
                  fontWeight: '600', 
                  fontSize: '1rem', 
                  width: '100%',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.5rem', 
                  cursor: 'pointer',
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                  e.target.style.transform = 'translateX(4px)';
                  e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                  e.target.style.transform = 'translateX(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>⭐</span>
                My Reviews
              </button>
              
              {user && (
                <button 
                  onClick={() => { setSidebarOpen(false); navigate('/messages'); }} 
                  style={{ 
                    color: '#1F2937', 
                    background: 'rgba(0, 123, 127, 0.05)', 
                    border: '1px solid rgba(0, 123, 127, 0.1)', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    width: '100%',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    position: 'relative'
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.target.style.transform = 'translateX(4px)';
                    e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                    e.target.style.transform = 'translateX(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>💬</span>
                  Messages
                  {unreadMessageCount > 0 && (
                    <span style={{ 
                      position: 'absolute', 
                      top: '8px', 
                      right: '12px', 
                      background: 'linear-gradient(135deg, #DC2626, #EF4444)', 
                      color: '#fff', 
                      borderRadius: '50%', 
                      padding: '2px 6px', 
                      fontSize: '11px', 
                      fontWeight: '700',
                      minWidth: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                    }}>
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </span>
                  )}
                </button>
              )}
              
              {user && userType === 'buyer' && (
                <button 
                  onClick={() => { setSidebarOpen(false); navigate('/receipts'); }} 
                  style={{ 
                    color: '#1F2937', 
                    background: 'rgba(0, 123, 127, 0.05)', 
                    border: '1px solid rgba(0, 123, 127, 0.1)', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    width: '100%',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.target.style.transform = 'translateX(4px)';
                    e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                    e.target.style.transform = 'translateX(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>🧾</span>
                  Receipts
                </button>
              )}              {user && userType === 'seller' && (
                <button 
                  onClick={() => { setSidebarOpen(false); navigate('/reports'); }} 
                  style={{ 
                    color: '#1F2937', 
                    background: 'rgba(0, 123, 127, 0.05)', 
                    border: '1px solid rgba(0, 123, 127, 0.1)', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    width: '100%',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem', 
                    cursor: 'pointer',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                    e.target.style.transform = 'translateX(4px)';
                    e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                    e.target.style.transform = 'translateX(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>📊</span>
                  Reports
                </button>
              )}
              
              {/* Help Center - visible for all users */}
              <a 
                href="/help-center" 
                onClick={() => setSidebarOpen(false)}
                style={{ 
                  color: '#1F2937', 
                  textDecoration: 'none', 
                  fontWeight: '600', 
                  fontSize: '1rem',
                  width: '100%',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.5rem',
                  borderRadius: '12px',
                  background: 'rgba(0, 123, 127, 0.05)',
                  border: '1px solid rgba(0, 123, 127, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                  e.target.style.transform = 'translateX(4px)';
                  e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                  e.target.style.transform = 'translateX(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📚</span>
                Help Center
              </a>

              {!user ? (
                <>
                  <a 
                    href="/about" 
                    onClick={() => setSidebarOpen(false)}
                    style={{ 
                      color: '#1F2937', 
                      textDecoration: 'none', 
                      fontWeight: '600', 
                      fontSize: '1rem',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem',
                      borderRadius: '12px',
                      background: 'rgba(0, 123, 127, 0.05)',
                      border: '1px solid rgba(0, 123, 127, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'translateX(4px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                      e.target.style.transform = 'translateX(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                    About
                  </a>
                  
                  {/* Only show Admin Login on non-mobile devices */}
                  {!isMobile && (
                    <button 
                      onClick={handleAdminAccess}
                      style={{ 
                        color: '#DC2626', 
                        textDecoration: 'none', 
                        fontWeight: '600', 
                        fontSize: '1rem',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        marginBottom: '0.5rem',
                        borderRadius: '12px',
                        background: 'rgba(220, 38, 38, 0.05)',
                        border: '1px solid rgba(220, 38, 38, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => {
                        e.target.style.background = 'rgba(220, 38, 38, 0.1)';
                        e.target.style.transform = 'translateX(4px)';
                        e.target.style.boxShadow = '0 4px 15px rgba(220, 38, 38, 0.1)';
                      }}
                      onMouseLeave={e => {
                        e.target.style.background = 'rgba(220, 38, 38, 0.05)';
                        e.target.style.transform = 'translateX(0)';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>🔒</span>
                      Admin Portal
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setSidebarOpen(false); navigate('/explore'); }}
                    style={{ 
                      color: '#1F2937', 
                      background: 'rgba(0, 123, 127, 0.05)', 
                      border: '1px solid rgba(0, 123, 127, 0.1)', 
                      fontWeight: '600', 
                      fontSize: '1rem', 
                      width: '100%',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem', 
                      cursor: 'pointer',
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'translateX(4px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                      e.target.style.transform = 'translateX(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>🔍</span>
                    Explore
                  </button>
                  <button
                    onClick={() => { setSidebarOpen(false); navigate('/feed'); }}
                    style={{ 
                      color: '#1F2937', 
                      background: 'rgba(0, 123, 127, 0.05)', 
                      border: '1px solid rgba(0, 123, 127, 0.1)', 
                      fontWeight: '600', 
                      fontSize: '1rem', 
                      width: '100%',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem', 
                      cursor: 'pointer',
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'translateX(4px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                      e.target.style.transform = 'translateX(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>📱</span>
                    Feed
                  </button>
                  <a 
                    href="/settings" 
                    onClick={() => setSidebarOpen(false)}
                    style={{ 
                      color: '#1F2937', 
                      textDecoration: 'none', 
                      fontWeight: '600', 
                      fontSize: '1rem',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem',
                      borderRadius: '12px',
                      background: 'rgba(0, 123, 127, 0.05)',
                      border: '1px solid rgba(0, 123, 127, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.1)';
                      e.target.style.transform = 'translateX(4px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(0, 123, 127, 0.1)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'rgba(0, 123, 127, 0.05)';
                      e.target.style.transform = 'translateX(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>⚙️</span>
                    Settings
                  </a>
                </>
              )}
            </div>
          </div>
          <style>
            {`
              @keyframes slideIn {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
              }
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            `}
          </style>
        </>
      )}
      
      {/* Admin Code Modal */}
      {showAdminCodeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Admin Portal Access
              </h2>
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Enter the access code (109826) to verify your identity and access the admin portal.
              </p>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.5rem' }}>
                Access Code
              </label>
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="Enter 6-digit access code"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  marginBottom: adminCodeError ? '0.5rem' : '0'
                }}
              />
              {adminCodeError && (
                <p style={{ color: '#DC2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {adminCodeError}
                </p>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAdminCodeModal(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: '#f3f4f6',
                  color: '#1f2937',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={verifyAdminCode}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: '#DC2626',
                  color: 'white',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1rem' }}>�</span>
                Verify Access Code
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar; 