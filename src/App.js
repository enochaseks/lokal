
import './App.css';
import ExplorePage from './pages/ExplorePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import HelpCenterPage from './pages/HelpCenterPage';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import OnboardingPage from './pages/OnboardingPage';
import OnboardingSellCategoryPage from './pages/OnboardingSellCategoryPage';
import OnboardingSellLocationPage from './pages/OnboardingSellLocationPage';
import CreateShopPage from './pages/CreateShopPage';
import StoreProfilePage from './pages/StoreProfilePage';
import StorePreviewPage from './pages/StorePreviewPage';
import StoreReviewsPage from './pages/StoreReviewsPage';
import FeedPage from './pages/FeedPage';
import SettingsPage from './pages/SettingsPage';
import AboutPage from './pages/AboutPage';
import OnboardingShopTypePage from './pages/OnboardingShopTypePage';
import OnboardingPreferencesPage from './pages/OnboardingPreferencesPage';
import CreateProfilePage from './pages/CreateProfilePage';
import ProfilePage from './pages/ProfilePage';
import StoreReviewPreviewPage from './pages/StoreReviewPreviewPage';
import MessagesPage from './pages/MessagesPage';
import { CartProvider } from './CartContext';
import { MessageProvider } from './MessageContext';
import { ToastProvider } from './contexts/ToastContext';
import ShopCartPage from './pages/ShopCartPage';
import ReportsPage from './pages/ReportsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminSetupPage from './pages/AdminSetupPage';
import ReceiptsPage from './pages/ReceiptsPage';
import { useEffect, useState } from 'react';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import LoadingSplashManager from './components/LoadingSplashManager';
import SimpleLoadingSpinner from './components/SimpleLoadingSpinner';
import PushNotificationPrompt from './components/PushNotificationPrompt';

function DeletedAccountGuard({ children }) {
  useEffect(() => {
    const auth = getAuth();
    
    const checkAccountStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      // Monitor user document for deletion
      const userDocRef = doc(db, 'users', user.uid);
      const userUnsubscribe = onSnapshot(userDocRef, async (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.deleted || userData.accountStatus === 'deleted') {
            console.log('Account was deleted by admin, logging out...');
            await signOut(auth);
            alert('Your account has been deleted by an administrator. You have been logged out.');
            window.location.href = '/login';
            return;
          }
        }
      });
      
      // Also check stores collection for sellers
      const storeDocRef = doc(db, 'stores', user.uid);
      const storeUnsubscribe = onSnapshot(storeDocRef, async (storeDoc) => {
        if (storeDoc.exists()) {
          const storeData = storeDoc.data();
          
          if (storeData.deleted || storeData.accountStatus === 'deleted') {
            console.log('Seller account was deleted by admin, logging out...');
            await signOut(auth);
            alert('Your seller account has been deleted by an administrator. You have been logged out.');
            window.location.href = '/login';
            return;
          }
        }
      });
      
      return () => {
        if (userUnsubscribe) userUnsubscribe();
        if (storeUnsubscribe) storeUnsubscribe();
      };
    };
    
    // Check immediately and on auth state change
    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        checkAccountStatus();
      }
    });
    
    return () => {
      if (authUnsubscribe) authUnsubscribe();
    };
  }, []);
  
  return children;
}

function OnboardingGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const checkOnboarding = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      
      // CRITICAL: Don't redirect if user is on email verification page
      // They need to verify their email before proceeding to onboarding
      if (location.pathname === '/verify-email') {
        console.log('OnboardingGuard: User on email verification page, skipping redirect');
        return;
      }
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const onboardingStep = userData.onboardingStep;
        const emailVerified = userData.emailVerified;
        
        // Only redirect to onboarding if email is verified
        if (onboardingStep && onboardingStep !== 'complete' && !location.pathname.includes(onboardingStep)) {
          if (emailVerified) {
            console.log('OnboardingGuard: Email verified, redirecting to onboarding step:', onboardingStep);
            navigate('/' + onboardingStep, { replace: true });
          } else {
            console.log('OnboardingGuard: Email not verified, redirecting to verification page');
            navigate('/verify-email', { replace: true });
          }
        }
      }
    };
    checkOnboarding();
  }, [location, navigate]);
  return children;
}

// Routes that can be accessed without authentication
function PublicRoute({ element }) {
  return element;
}

// Routes that require authentication
function ProtectedRoute({ element }) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        navigate('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return <SimpleLoadingSpinner message="Authenticating..." overlay={true} />;
  }

  return isAuthenticated ? element : null;
}

function App() {
  const [appLoading, setAppLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Initialize Firebase Auth and check authentication state
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthInitialized(true);
      // Add a minimum loading time for better UX
      setTimeout(() => {
        setAppLoading(false);
      }, 1500); // Show splash for at least 1.5 seconds
    });

    return () => unsubscribe();
  }, []);

  return (
    <ToastProvider>
      <MessageProvider>
        <CartProvider>
        <Router>
          <LoadingSplashManager 
            isLoading={appLoading} 
            message="Welcome to Lokal"
            minDisplayTime={1500}
            fadeOutDuration={800}
          >
            <DeletedAccountGuard>
              <OnboardingGuard>
              <PushNotificationPrompt />
          <div className="App" style={{ 
            minHeight: '100vh', 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            background: '#F9F5EE',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            <div
              style={{
                maxWidth: '1200px',
                margin: '0 auto',
                minHeight: '100vh',
                minHeight: 'calc(100vh - var(--safe-area-inset-bottom))',
                width: '100%',
                padding: '0 16px',
                paddingTop: '60px', // Exactly match navbar height
                paddingBottom: '0', // Remove extra padding
                position: 'relative',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS devices
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Routes>
                <Route path="/" element={<ExplorePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<EmailVerificationPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/onboarding-sell-category" element={<OnboardingSellCategoryPage />} />
                <Route path="/onboarding-sell-location" element={<OnboardingSellLocationPage />} />
                <Route path="/create-shop" element={<CreateShopPage />} />
                <Route path="/store-profile" element={<StoreProfilePage />} />
                <Route path="/store-preview/:id" element={<StorePreviewPage />} />
                <Route path="/my-reviews" element={<StoreReviewsPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/help-center" element={<PublicRoute element={<HelpCenterPage />} />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/onboarding-shop-type" element={<OnboardingShopTypePage />} />
                <Route path="/onboarding-preferences" element={<OnboardingPreferencesPage />} />
                <Route path="/create-profile" element={<CreateProfilePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/store-review-preview/:storeId" element={<StoreReviewPreviewPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/shop-cart" element={<ShopCartPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/receipts" element={<ReceiptsPage />} />
                <Route path="/admin-setup" element={<AdminSetupPage />} />
                <Route path="/admin-login" element={<AdminLoginPage />} />
                <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
              </Routes>
            </div>
            <style>{`
              /* Root variables for consistent sizing */
              :root {
                --safe-area-inset-top: env(safe-area-inset-top, 0px);
                --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
                --safe-area-inset-left: env(safe-area-inset-left, 0px);
                --safe-area-inset-right: env(safe-area-inset-right, 0px);
              }

              /* Fix for iOS notch and modern Android displays */
              @supports (padding-top: constant(safe-area-inset-top)) or (padding-top: env(safe-area-inset-top)) {
                body {
                  padding-top: var(--safe-area-inset-top);
                  padding-bottom: var(--safe-area-inset-bottom);
                  padding-left: var(--safe-area-inset-left);
                  padding-right: var(--safe-area-inset-right);
                }
              }
              
              /* Ensure navbar always stays on top without extra spacing */
              nav {
                z-index: 9999 !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                transform: translateZ(0);
                backface-visibility: hidden;
                will-change: transform;
                padding-top: var(--safe-area-inset-top) !important;
                margin-top: 0 !important;
                height: 60px !important;
              }
              
              /* Remove all extra spacing while ensuring content is visible */
              body, html {
                margin: 0 !important;
                padding: 0 !important;
                overflow-x: hidden !important;
                width: 100% !important;
                height: 100% !important;
              }
              
              .App {
                margin: 0 !important;
                padding: 0 !important;
              }
              
              .App > div {
                padding-top: 60px !important; /* Exactly match navbar height */
                padding-bottom: var(--safe-area-inset-bottom) !important;
                padding-left: calc(var(--safe-area-inset-left) + 8px) !important;
                padding-right: calc(var(--safe-area-inset-right) + 8px) !important;
                margin: 0 !important;
              }

              /* Responsive design for all screen sizes without extra spacing */
              
              /* Extra small devices (phones, up to 430px) */
              @media only screen and (max-width: 430px) {
                .App > div {
                  max-width: 100% !important;
                  padding-left: 4px !important;
                  padding-right: 4px !important;
                  padding-top: 60px !important;
                  width: 100vw !important;
                }
                
                nav {
                  height: 60px !important;
                  padding: 0 8px !important;
                }
              }
              
              /* Small devices (large phones, 431px to 767px) */
              @media only screen and (min-width: 431px) and (max-width: 767px) {
                .App > div {
                  max-width: 100% !important;
                  padding-left: 8px !important;
                  padding-right: 8px !important;
                  padding-top: 60px !important;
                  width: 100% !important;
                }
                
                nav {
                  height: 60px !important;
                }
              }
              
              /* Medium devices (tablets, 768px to 1023px) */
              @media only screen and (min-width: 768px) and (max-width: 1023px) {
                .App > div {
                  max-width: 900px !important;
                  padding-left: 16px !important;
                  padding-right: 16px !important;
                  padding-top: 60px !important;
                }
              }
              
              /* Large devices (laptops/desktops, 1024px to 1439px) */
              @media only screen and (min-width: 1024px) and (max-width: 1439px) {
                .App > div {
                  max-width: 1000px !important;
                  padding-top: 60px !important;
                }
              }
              
              /* Extra large devices (large desktops, 1440px and up) */
              @media only screen and (min-width: 1440px) {
                .App > div {
                  max-width: 1200px !important;
                  padding-top: 60px !important;
                }
              }
              
              /* Device-specific fixes */
              
              /* iPhone X to iPhone 16 Pro Max (notched iPhones) */
              @media only screen and (device-width: 375px) and (device-height: 812px),
                     only screen and (device-width: 390px) and (device-height: 844px),
                     only screen and (device-width: 428px) and (device-height: 926px),
                     only screen and (device-width: 430px) and (device-height: 932px) {
                .App > div {
                  padding-bottom: calc(20px + 34px) !important; /* Extra padding for home indicator */
                }
              }
              
              /* Samsung Galaxy phones with cutouts/holes */
              @media only screen and (max-width: 450px) and (min-height: 900px) {
                nav {
                  padding-top: 0.75rem !important;
                }
              }
            `}</style>
          </div>
            </OnboardingGuard>
          </DeletedAccountGuard>
          </LoadingSplashManager>
      </Router>
        </CartProvider>
      </MessageProvider>
    </ToastProvider>
  );
}

export default App;
