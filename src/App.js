import logo from './logo.svg';
import './App.css';
import ExplorePage from './pages/ExplorePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
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
import CreateProfilePage from './pages/CreateProfilePage';
import ProfilePage from './pages/ProfilePage';
import StoreReviewPreviewPage from './pages/StoreReviewPreviewPage';
import MessagesPage from './pages/MessagesPage';
import { CartProvider } from './CartContext';
import { MessageProvider } from './MessageContext';
import ShopCartPage from './pages/ShopCartPage';
import ReportsPage from './pages/ReportsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminSetupPage from './pages/AdminSetupPage';
import { useEffect } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { db } from './firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';

function DeletedAccountGuard({ children }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    const auth = getAuth();
    let unsubscribe = null;
    
    const checkAccountStatus = () => {
      const user = auth.currentUser;
      if (!user) return;
      
      // Monitor user document for deletion
      const userDocRef = doc(db, 'users', user.uid);
      unsubscribe = onSnapshot(userDocRef, async (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.deleted || userData.accountStatus === 'deleted') {
            console.log('Account was deleted by admin, logging out...');
            await signOut(auth);
            alert('Your account has been deleted by an administrator. You have been logged out.');
            navigate('/login', { replace: true });
            return;
          }
        } else {
          // Also check stores collection for sellers
          const storeDocRef = doc(db, 'stores', user.uid);
          const storeUnsubscribe = onSnapshot(storeDocRef, async (storeDoc) => {
            if (storeDoc.exists()) {
              const storeData = storeDoc.data();
              
              if (storeData.deleted || storeData.accountStatus === 'deleted') {
                console.log('Seller account was deleted by admin, logging out...');
                await signOut(auth);
                alert('Your seller account has been deleted by an administrator. You have been logged out.');
                navigate('/login', { replace: true });
                return;
              }
            }
          });
          
          return () => storeUnsubscribe && storeUnsubscribe();
        }
      });
    };
    
    // Check immediately and on auth state change
    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        checkAccountStatus();
      } else if (unsubscribe) {
        unsubscribe();
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
      if (authUnsubscribe) authUnsubscribe();
    };
  }, [navigate]);
  
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
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const onboardingStep = userDoc.data().onboardingStep;
        if (onboardingStep && onboardingStep !== 'complete' && !location.pathname.includes(onboardingStep)) {
          navigate('/' + onboardingStep, { replace: true });
        }
      }
    };
    checkOnboarding();
  }, [location, navigate]);
  return children;
}

function App() {
  return (
    <MessageProvider>
      <CartProvider>
        <Router>
          <DeletedAccountGuard>
            <OnboardingGuard>
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
              className="main-app-container"
              style={{
                width: '100%',
                maxWidth: '1200px',
                minHeight: '100vh',
                background: 'inherit',
                boxShadow: '0 0 0 #fff',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                padding: '0 16px',
                paddingTop: '10px', // Reduced from 70px for better mobile experience
                position: 'relative'
              }}
            >
              <Routes>
                <Route path="/" element={<ExplorePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/onboarding-sell-category" element={<OnboardingSellCategoryPage />} />
                <Route path="/onboarding-sell-location" element={<OnboardingSellLocationPage />} />
                <Route path="/create-shop" element={<CreateShopPage />} />
                <Route path="/store-profile" element={<StoreProfilePage />} />
                <Route path="/store-preview/:id" element={<StorePreviewPage />} />
                <Route path="/my-reviews" element={<StoreReviewsPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/onboarding-shop-type" element={<OnboardingShopTypePage />} />
                <Route path="/create-profile" element={<CreateProfilePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/store-review-preview/:storeId" element={<StoreReviewPreviewPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/shop-cart" element={<ShopCartPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/admin-setup" element={<AdminSetupPage />} />
                <Route path="/admin-login" element={<AdminLoginPage />} />
                <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
              </Routes>
            </div>
            <style>{`
              @media (max-width: 1024px) {
                .App > div {
                  max-width: 100vw !important;
                  padding: 0 4px !important;
                  padding-top: 10px !important; /* Reduced from 70px to minimize spacing */
                }
                
                /* Global mobile and tablet scroll fixes */
                body {
                  overflow-x: hidden;
                  -webkit-overflow-scrolling: touch;
                }
                
                /* Ensure all page content is scrollable on mobile and tablets */
                .main-app-container {
                  min-height: calc(100vh - 60px) !important;
                  overflow-y: auto;
                  -webkit-overflow-scrolling: touch;
                  scroll-behavior: smooth;
                }
              }
              
              @media (min-width: 1025px) {
                .App > div {
                  padding-top: 70px; /* Keep desktop spacing */
                }
              }
            `}</style>
          </div>
            </OnboardingGuard>
          </DeletedAccountGuard>
      </Router>
    </CartProvider>
    </MessageProvider>
  );
}

export default App;
